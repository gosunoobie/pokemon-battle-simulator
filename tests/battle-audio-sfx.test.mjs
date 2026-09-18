import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import { createAudioPlayer } from '../packages/battle-audio/src/index.js'

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
const until = async predicate => {
  for (let attempt = 0; attempt < 1000; attempt += 1) { if (predicate()) return; await tick() }
  assert.fail('Asynchronous phase did not begin')
}
const pcm = (length = 100, peak = 0.8) => ({ length, sampleRate: 100, duration: length / 100, numberOfChannels: 1,
  getChannelData: () => new Float32Array(length).fill(peak) })
const encoded = Uint8Array.of(1, 2, 3)
const sha256 = createHash('sha256').update(encoded).digest('hex')
const response = () => ({ ok: true, arrayBuffer: async () => encoded.slice().buffer })
function harness(options = {}) {
  const calls = { fetched: [], decoded: 0, sources: [], gains: [] }
  const context = {
    state: 'running', currentTime: 10, sampleRate: 100, destination: {}, listeners: new Set(),
    resume: async () => { context.state = 'running' }, close: async () => { context.state = 'closed' },
    addEventListener: (_name, callback) => context.listeners.add(callback), removeEventListener: (_name, callback) => context.listeners.delete(callback),
    decodeAudioData: async bytes => { calls.decoded += 1; return options.decode ? options.decode(bytes) : pcm() },
    createGain() {
      const gain = { gain: { value: 1 }, connect(output) { gain.output = output }, disconnect() { gain.disconnected = true } }
      if (options.fade) Object.assign(gain.gain, {
        setValueAtTime(value, when) { this.value = value; this.set = [value, when] },
        linearRampToValueAtTime(value, when) { this.ramp = [value, when] }, cancelScheduledValues(when) { this.cancelledAt = when },
      })
      calls.gains.push(gain); return gain
    },
    createBufferSource() {
      const source = { playbackRate: { value: 9 }, connect(output) { source.output = output },
        start(...args) { source.started = args }, stop(...args) { source.stopped = args }, disconnect() { source.disconnected = true } }
      calls.sources.push(source); return source
    },
  }
  const player = createAudioPlayer({
    resolveAsset: options.asset ?? (id => ({ url: `/sounds/${id}.mp3`, bytes: 3, sha256 })),
    createContext: () => context, crypto: webcrypto,
    fetch: async (url, init) => { calls.fetched.push({ url, signal: init.signal }); return options.fetch ? options.fetch(url, init) : response() },
    ...options.config,
  })
  return { player, calls, context }
}

test('native region playback uses exact offset, duration, audio clock and rate one; invalid regions stay silent', async t => {
  const { player, calls } = harness(); t.after(() => player.dispose())
  assert.equal(player.readyInfo('a'), null)
  assert.equal(player.contextTime(), null)
  await player.unlock(); await player.preload(['a'])
  assert.deepEqual(player.readyInfo('a'), { sampleRate: 100, sampleFrames: 100, durationSeconds: 1 })
  assert.equal(player.contextTime(), 10)
  for (const options of [{ startSeconds: -1 }, { endSeconds: 1.001 }, { startSeconds: 0.5, endSeconds: 0.5 }, { when: 9.99 }, { gainDb: 7 }, { gainDb: NaN }, { category: '__proto__' }]) {
    assert.equal(player.playSegment('a', options), null)
  }
  assert.equal(calls.sources.length, 0)
  const handle = player.playSegment('a', { startSeconds: 0.2, endSeconds: 0.7, when: 10.3, gainDb: -6 })
  assert.deepEqual(calls.sources[0].started, [10.3, 0.2, 0.7 - 0.2])
  assert.equal(calls.sources[0].playbackRate.value, 1)
  assert.equal(calls.sources[0].loop, false)
  calls.sources[0].onended()
  assert.deepEqual(await handle.finished, { reason: 'ended' })
  assert.equal(player.diagnostics().voices, 0)
})

test('canceling one preload subscriber does not abort another subscriber to the same verified asset', async t => {
  const download = deferred(), controller = new AbortController()
  const { player, calls } = harness({ fetch: () => download.promise }); t.after(() => player.dispose())
  await player.unlock()
  const cancelled = player.preload(['a'], { signal: controller.signal })
  const survivor = player.preload(['a'])
  controller.abort()
  assert.deepEqual(await cancelled, [false])
  assert.equal(calls.fetched[0].signal.aborted, false)
  download.resolve(response())
  assert.deepEqual(await survivor, [true])
  assert.equal(calls.fetched.length, 1)
  assert.equal(calls.decoded, 1)
  assert.equal(calls.sources.length, 0)
})

test('scoped preload cancellation retains another scope and cancels only matching voices', async t => {
  const download = deferred(), scopeA = {}, scopeB = {}
  const { player, calls } = harness({ fetch: () => download.promise }); t.after(() => player.dispose())
  await player.unlock()
  const first = player.preload(['a'], { scope: scopeA }), second = player.preload(['a'], { scope: scopeB })
  player.stopScope(scopeA)
  assert.deepEqual(await first, [false])
  assert.equal(calls.fetched[0].signal.aborted, false)
  download.resolve(response()); assert.deepEqual(await second, [true])
  const a = player.playSegment('a', { scope: scopeA }), b = player.playSegment('a', { scope: scopeB })
  player.stopScope(scopeA)
  assert.deepEqual(await a.finished, { reason: 'cancelled' })
  assert.equal(calls.sources[1].stopped, undefined)
  calls.sources[1].onended(); assert.deepEqual(await b.finished, { reason: 'ended' })
})

test('last subscriber cancellation settles immediately but an uncancellable decode retains its slot and reservation', async t => {
  const decode = deferred(), controller = new AbortController()
  const { player, calls } = harness({ decode: () => decode.promise, config: { concurrency: 1 } }); t.after(() => player.dispose())
  await player.unlock()
  const first = player.preload(['a'], { signal: controller.signal }); await until(() => calls.decoded === 1); controller.abort()
  assert.deepEqual(await first, [false])
  const second = player.preload(['b'])
  assert.equal(player.diagnostics().physicalJobs, 1)
  assert.ok(player.diagnostics().reservedBytes > 0)
  assert.equal(calls.fetched.length, 1)
  decode.resolve(pcm()); await tick()
  assert.deepEqual(await second, [true])
  assert.equal(player.readyInfo('a'), null)
  assert.equal(calls.fetched.length, 2)
  assert.equal(calls.sources.length, 0)
})

test('queued priority selects urgent work first and a shared subscriber can promote a queued asset', async t => {
  const gate = deferred()
  const { player, calls } = harness({ fetch: url => url.includes('/first.') ? gate.promise : response(), config: { concurrency: 1 } }); t.after(() => player.dispose())
  await player.unlock()
  const first = player.preload(['first'])
  const low = player.preload(['low'], { priority: -10 })
  const middle = player.preload(['middle'], { priority: 0 })
  const promotion = player.preload(['low'], { priority: 100 })
  gate.resolve(response())
  assert.deepEqual(await first, [true]); assert.deepEqual(await low, [true]); assert.deepEqual(await promotion, [true]); assert.deepEqual(await middle, [true])
  assert.deepEqual(calls.fetched.map(call => call.url), ['/sounds/first.mp3', '/sounds/low.mp3', '/sounds/middle.mp3'])
})

test('the queue is bounded and refuses excess work without fetching', async t => {
  const gate = deferred()
  const { player, calls } = harness({ fetch: () => gate.promise, config: { concurrency: 1, maxQueued: 2 } }); t.after(() => player.dispose())
  await player.unlock()
  const first = player.preload(['a', 'b', 'c'])
  assert.deepEqual(await player.preload(['d']), [false])
  assert.equal(player.diagnostics().queuedJobs, 2)
  player.stop(); gate.resolve(response())
  assert.deepEqual(await first, [false, false, false])
  assert.equal(calls.fetched.length, 1)
})

test('bytes and hash are checked before decoding; cache identity includes expected integrity', async t => {
  const { player, calls } = harness({ asset: id => ({ url: '/shared.mp3', bytes: id === 'size' ? 4 : 3, sha256: id === 'hash' ? '0'.repeat(64) : sha256 }) }); t.after(() => player.dispose())
  await player.unlock()
  assert.deepEqual(await player.preload(['good']), [true])
  assert.deepEqual(await player.preload(['size', 'hash']), [false, false])
  assert.equal(calls.decoded, 1)
  assert.equal(player.play('hash'), false)
  assert.equal(player.play('good'), true)
})

test('hashed assets fail silently when integrity verification is unavailable', async t => {
  const { player, calls } = harness({ config: { crypto: null } }); t.after(() => player.dispose())
  await player.unlock()
  assert.deepEqual(await player.preload(['a']), [false])
  assert.equal(calls.decoded, 0)
  assert.equal(player.getState().loadError, 'load')
})

test('stream byte limits cancel overflow before decoding and content-length rejects oversized bodies', async t => {
  let cancelled = 0, reads = 0
  const { player, calls } = harness({ fetch: url => url.includes('header') ? {
    ok: true, headers: { get: () => '4' }, arrayBuffer: () => { throw new Error('must not read') },
  } : {
    ok: true, body: { getReader: () => ({ read: async () => { reads += 1; return { done: false, value: new Uint8Array(4) } },
      cancel: async () => { cancelled += 1 }, releaseLock() {} }) },
  } }); t.after(() => player.dispose())
  await player.unlock()
  assert.deepEqual(await player.preload(['overflow', 'header']), [false, false])
  assert.equal(cancelled, 1); assert.equal(reads, 1); assert.equal(calls.decoded, 0)
})

test('retained playing buffers still count after cache eviction and block new jobs until released', async t => {
  const { player, calls } = harness({ decode: () => pcm(100), config: {
    maxCacheBytes: 400, maxDecodedBytes: 400, maxEncodedBytes: 3, maxWorkingBytes: 806, concurrency: 3,
  } }); t.after(() => player.dispose())
  await player.unlock(); await player.preload(['a'])
  const a = player.playSegment('a')
  await player.preload(['b'])
  const b = player.playSegment('b')
  assert.equal(player.readyInfo('a'), null)
  assert.equal(player.diagnostics().retainedBytes, 800)
  const third = player.preload(['c'])
  assert.equal(calls.fetched.length, 2)
  assert.equal(player.diagnostics().queuedJobs, 1)
  assert.ok(player.diagnostics().workingBytes <= 806)
  a.cancel(); assert.deepEqual(await a.finished, { reason: 'cancelled' })
  assert.deepEqual(await third, [true])
  assert.equal(calls.fetched.length, 3)
  assert.ok(player.diagnostics().workingBytes <= 806)
  b.cancel()
})

test('three physical jobs and the working memory reservation are bounded independently', async t => {
  const gates = []
  const { player } = harness({ decode: () => { const gate = deferred(); gates.push(gate); return gate.promise } }); t.after(() => player.dispose())
  await player.unlock()
  const load = player.preload(['a', 'b', 'c', 'd']); await until(() => gates.length === 3)
  assert.equal(player.diagnostics().physicalJobs, 3)
  assert.equal(player.diagnostics().queuedJobs, 1)
  assert.equal(gates.length, 3)
  assert.ok(player.diagnostics().workingBytes <= 48 * 1024 * 1024)
  player.stop(); assert.deepEqual(await load, [false, false, false, false])
  assert.equal(player.diagnostics().physicalJobs, 3)
  for (const gate of gates) gate.resolve(pcm())
  await tick(); assert.equal(player.diagnostics().reservedBytes, 0)
})

test('voice category budgets preserve two cries and four SFX; low priority cannot steal a higher priority voice', async t => {
  const { player, calls } = harness(); t.after(() => player.dispose())
  await player.unlock(); await player.preload(['a'])
  assert.equal(player.play('a'), true); assert.equal(player.play('a'), true)
  const effects = Array.from({ length: 4 }, () => player.playSegment('a', { priority: 10 }))
  assert.equal(player.playSegment('a', { priority: 0 }), null)
  const replacement = player.playSegment('a', { priority: 10 })
  assert.ok(replacement)
  assert.deepEqual(await effects[0].finished, { reason: 'replaced' })
  assert.equal(calls.sources[0].stopped, undefined)
  assert.equal(calls.sources[1].stopped, undefined)
  assert.ok(player.playSegment('a', { category: 'ui' })); assert.ok(player.playSegment('a', { category: 'ui' }))
  assert.equal(player.diagnostics().voices, 8)
  assert.deepEqual(player.diagnostics().categoryVoices, { cries: 2, sfx: 4, ui: 2 })
})

test('category mute leaves other voices and shared cache intact and never auto-plays on re-enable', async t => {
  const { player, calls } = harness(); t.after(() => player.dispose())
  await player.unlock(); await player.preload(['a'])
  player.play('a'); const effect = player.playSegment('a')
  player.setCategoryEnabled('sfx', false)
  assert.deepEqual(await effect.finished, { reason: 'cancelled' })
  assert.equal(calls.sources[0].stopped, undefined)
  assert.equal(player.playSegment('a'), null)
  assert.deepEqual(await player.preload(['a']), [true])
  player.setCategoryEnabled('sfx', true)
  assert.equal(calls.sources.length, 2)
  assert.ok(player.playSegment('a'))
  player.stopCategory('cries')
  assert.equal(calls.sources[0].disconnected, true)
  assert.equal(calls.sources[2].stopped, undefined)
})

test('cancellation fades owned playing nodes, but scheduled voices cancel immediately and never sound later', async t => {
  const { player, calls } = harness({ fade: true }); t.after(() => player.dispose())
  await player.unlock(); await player.preload(['a'])
  const active = player.playSegment('a'), scheduled = player.playSegment('a', { when: 11 })
  active.cancel(); scheduled.cancel()
  assert.deepEqual(await active.finished, { reason: 'cancelled' })
  assert.deepEqual(await scheduled.finished, { reason: 'cancelled' })
  assert.deepEqual(calls.sources[0].stopped, [10.008])
  assert.deepEqual(calls.sources[1].stopped, [])
  assert.deepEqual(calls.gains[4].gain.ramp, [0, 10.008])
  assert.equal(player.diagnostics().fadingVoices, 1)
  calls.sources[0].onended()
  assert.equal(player.diagnostics().fadingVoices, 0)
  assert.equal(calls.sources[0].disconnected, true)
})

test('SFX attenuation preserves authored relative gain and bounds four +6dB peaks', async t => {
  const { player, calls } = harness({ decode: () => pcm(100, 1.2) }); t.after(() => player.dispose())
  await player.unlock(); await player.preload(['a'])
  player.playSegment('a', { gainDb: -6 }); player.playSegment('a', { gainDb: 0 })
  assert.ok(Math.abs(calls.gains[5].gain.value / calls.gains[4].gain.value - 10 ** (6 / 20)) < 1e-10)
  player.stop()
  for (let index = 0; index < 4; index += 1) player.playSegment('a', { gainDb: 6 })
  const nativePeak = new Float32Array([1.2])[0]
  const mix = calls.gains.slice(-4).reduce((sum, gain) => sum + gain.gain.value * nativePeak, 0) * calls.gains[2].gain.value
  assert.ok(mix <= 0.250000001)
})

test('interruption settles handles without treating them as natural endings; dispose rejects subsequent work', async () => {
  const { player, calls, context } = harness({ fade: true })
  await player.unlock(); await player.preload(['a'])
  const active = player.playSegment('a'), future = player.playSegment('a', { when: 11 })
  context.state = 'interrupted'; for (const callback of context.listeners) callback()
  assert.deepEqual(await active.finished, { reason: 'interrupted' })
  assert.deepEqual(await future.finished, { reason: 'interrupted' })
  assert.equal(player.contextTime(), null)
  assert.equal(player.diagnostics().voices, 0)
  await player.unlock(); assert.equal(calls.sources.length, 2)
  player.dispose(); player.dispose()
  assert.deepEqual(await player.preload(['a']), [false])
  assert.equal(player.playSegment('a'), null)
  assert.equal(player.readyInfo('a'), null)
  assert.equal(player.diagnostics().retainedBytes, 0)
})

test('rapid cancellation cannot exceed the category budget with fading physical voices', async t => {
  const { player, calls } = harness({ fade: true }); t.after(() => player.dispose())
  await player.unlock(); await player.preload(['a'])
  for (let index = 0; index < 4; index += 1) player.playSegment('a').cancel()
  assert.equal(player.diagnostics().fadingVoices, 4)
  assert.equal(player.playSegment('a'), null)
  assert.equal(calls.sources.length, 4)
  for (const source of calls.sources) source.onended()
  assert.ok(player.playSegment('a'))
})

test('shared job subscriber count is bounded and last unsubscribe releases queued work', async t => {
  const download = deferred()
  const { player, calls } = harness({ fetch: () => download.promise }); t.after(() => player.dispose())
  await player.unlock()
  const controllers = Array.from({ length: 64 }, () => new AbortController())
  const loads = controllers.map(controller => player.preload(['a'], { signal: controller.signal }))
  assert.equal(player.diagnostics().subscribers, 64)
  assert.deepEqual(await player.preload(['a']), [false])
  for (const controller of controllers) controller.abort()
  assert.equal(calls.fetched[0].signal.aborted, true)
  assert.deepEqual(await Promise.all(loads), Array.from({ length: 64 }, () => [false]))
  assert.equal(player.diagnostics().subscribers, 0)
  download.resolve(response()); await tick()
  assert.equal(player.readyInfo('a'), null)
})

test('an isolated ordinary SFX keeps authored gain and all categories together stay within the sample-peak budget', async t => {
  const { player, calls } = harness(); t.after(() => player.dispose())
  await player.unlock(); await player.preload(['a'])
  const isolated = player.playSegment('a')
  assert.equal(calls.gains[4].gain.value, 1)
  assert.equal(calls.gains[2].gain.value, 0.25)
  assert.equal(calls.gains[4].gain.value * calls.gains[2].gain.value * calls.gains[0].gain.value, 0.15)
  isolated.cancel(); assert.equal(calls.sources[0].buffer, null, 'completed handles release their retained source buffer')
  player.setVolume(1)
  for (let index = 0; index < 2; index += 1) player.playSegment('a', { category: 'cries', gainDb: 6 })
  for (let index = 0; index < 4; index += 1) player.playSegment('a', { gainDb: 6 })
  for (let index = 0; index < 2; index += 1) player.playSegment('a', { category: 'ui', gainDb: 6 })
  const actualPeak = new Float32Array([0.8])[0]
  const output = calls.sources.slice(1).reduce((sum, source) => sum + actualPeak * source.output.gain.value * source.output.output.gain.value * calls.gains[0].gain.value, 0)
  assert.ok(output <= 1.000000001)
})

test('fading SFX retain mix headroom until cleanup; released headroom ramps up only afterward', async t => {
  const { player, calls } = harness({ fade: true, decode: () => pcm(100, 1) }); t.after(() => player.dispose())
  await player.unlock(); await player.preload(['a'])
  const first = player.playSegment('a'), second = player.playSegment('a')
  assert.equal(calls.gains[2].gain.value, 0.125)
  first.cancel(); assert.equal(calls.gains[2].gain.value, 0.125)
  calls.sources[0].onended()
  assert.deepEqual(calls.gains[2].gain.ramp, [0.25, 10.015])
  assert.ok(player.playSegment('a'))
  assert.equal(calls.gains[2].gain.value, 0.125)
  assert.equal(calls.gains[2].gain.cancelledAt, 10)
  second.cancel()
})
