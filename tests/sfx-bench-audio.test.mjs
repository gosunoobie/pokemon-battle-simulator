import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { AUDITION_LIMITS, createAuditionAudio } from '../apps/sfx-bench/src/audio.js'

const encoded = new Uint8Array([1, 2, 3, 4])
const asset = Object.freeze({ id: 'test', url: '/sound_effects/test.mp3', bytes: encoded.length, sha256: createHash('sha256').update(encoded).digest('hex') })
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const tick = () => new Promise(resolve => setImmediate(resolve))
const buffer = (channels = [new Float32Array(1024).fill(0.5)], sampleRate = 8000) => ({
  sampleRate, length: channels[0].length, numberOfChannels: channels.length,
  duration: channels[0].length / sampleRate, getChannelData: index => channels[index],
})
function fixture(options = {}) {
  const sources = [], gains = [], listeners = new Map()
  const ctx = {
    state: 'suspended', currentTime: 1, sampleRate: 48000, destination: {}, baseLatency: 0.01, outputLatency: 0.02,
    resumeCalls: 0, decodeCalls: 0, closeCalls: 0,
    resume() { this.resumeCalls++; this.state = 'running'; return Promise.resolve() },
    decodeAudioData(bytes) { this.decodeCalls++; return options.decode?.(bytes) ?? Promise.resolve(options.buffer ?? buffer()) },
    createGain() {
      const gain = { connected: false, disconnected: false,
        gain: { value: 1, cancelScheduledValues() {}, setValueAtTime(value) { this.value = value }, linearRampToValueAtTime(value) { this.value = value } },
        connect() { this.connected = true }, disconnect() { this.disconnected = true },
      }
      gains.push(gain); return gain
    },
    createBufferSource() {
      const source = { playbackRate: { value: 0 }, stopCalls: 0, disconnected: false, connect() {},
        disconnect() { this.disconnected = true }, start(...args) { this.startArgs = args; if (options.startError) throw new Error('native start failed') },
        stop() { this.stopCalls++ },
      }
      sources.push(source); return source
    },
    getOutputTimestamp() { return { contextTime: 0.99, performanceTime: 123 } },
    addEventListener(event, listener) { listeners.set(event, listener) },
    removeEventListener(event) { listeners.delete(event) },
    close() { this.closeCalls++; this.state = 'closed'; return Promise.resolve() },
  }
  let fetchCalls = 0
  const player = createAuditionAudio({
    createContext: () => ctx, now: () => 456,
    fetcher: (...args) => { fetchCalls++; return options.fetcher?.(...args) ?? Promise.resolve(new Response(encoded)) },
    ...(options.timeout ? { loadTimeoutMs: options.timeout } : {}),
  })
  return { player, ctx, sources, gains, listeners, fetchCalls: () => fetchCalls }
}

test('audition unlock resumes within the user gesture and loading never plays', async () => {
  const { player, ctx, sources } = fixture()
  assert.equal(player.diagnostics().state, 'locked')
  const unlocking = player.unlock()
  assert.equal(ctx.resumeCalls, 1)
  assert.equal(await unlocking, true)
  const measured = await player.load(asset)
  assert.equal(sources.length, 0)
  assert.equal(measured.sampleRate, 8000)
  assert.equal(measured.sampleFrames, 1024)
  assert.equal(measured.decodedBytes, 4096)
  assert.equal(measured.durationSeconds, 0.128)
  assert.equal(measured.peak, 0.5)
  assert.equal(measured.waveform.bins, 512)
  assert.equal(measured.waveform.min.length, 512)
  assert.ok(Object.isFrozen(measured.waveform.max))
  assert.equal('buffer' in measured, false)
  const diag = player.diagnostics()
  assert.equal(diag.sampleRate, 48000)
  assert.equal(diag.baseLatency, 0.01)
  assert.equal(diag.outputLatency, 0.02)
  assert.deepEqual(diag.outputTimestamp, { contextTime: 0.99, performanceTime: 123 })
  assert.equal(diag.observedAt, 456)
  assert.match(diag.synchronization, /not proof/)
  player.dispose()
})

test('native waveform includes both channels and quiet ranges without claiming an audible onset', async () => {
  const left = new Float32Array(16), right = new Float32Array(16)
  left[5] = -0.4; right[7] = 0.75; right[15] = 0.0001
  const { player } = fixture({ buffer: buffer([left, right]) })
  await player.unlock()
  const measured = await player.load(asset)
  assert.equal(measured.channels, 2)
  assert.equal(measured.waveform.bins, 16)
  assert.equal(measured.leadingQuietFrames, 5)
  assert.equal(measured.trailingQuietFrames, 8)
  assert.equal(measured.quietThresholdDbfs, -60)
  assert.equal(measured.waveform.min[5], left[5])
  assert.equal(measured.waveform.max[7], 0.75)
  assert.equal(measured.peak, 0.75)
  player.dispose()
})

test('checksum, truncated, oversized and declared-size mismatches are rejected before decoding', async t => {
  for (const [name, makeResponse, expected] of [
    ['checksum', () => new Response(new Uint8Array([1, 2, 3, 5])), /checksum/],
    ['truncated', () => new Response(encoded.slice(0, 2)), /truncated/],
    ['oversized', () => new Response(new Uint8Array(5)), /byte limit/],
    ['declared-size', () => new Response(encoded, { headers: { 'content-length': '5' } }), /size/],
    ['http-error', () => new Response('', { status: 404 }), /404/],
  ]) await t.test(name, async () => {
    const { player, ctx } = fixture({ fetcher: async () => makeResponse() })
    await player.unlock()
    await assert.rejects(player.load(asset), expected)
    assert.equal(ctx.decodeCalls, 0)
    assert.equal(player.diagnostics().ready, false)
    player.dispose()
  })
})

test('invalid pins and resource bounds do not fetch, decode or allocate waveform output', async () => {
  const { player, fetchCalls } = fixture()
  await assert.rejects(player.load(asset), /Unlock/)
  await player.unlock()
  for (const invalid of [{ ...asset, bytes: AUDITION_LIMITS.encodedBytes + 1 }, { ...asset, sha256: 'unknown' }, { ...asset, bytes: 0 }]) {
    await assert.rejects(player.load(invalid), /Invalid pinned/)
  }
  assert.equal(fetchCalls(), 0)
  player.dispose()
  const oversized = { sampleRate: 48000, numberOfChannels: 2, length: 5_000_000, duration: 5_000_000 / 48000, getChannelData() { throw new Error('must not allocate') } }
  const other = fixture({ buffer: oversized })
  await other.player.unlock()
  await assert.rejects(other.player.load(asset), /limits/)
  other.player.dispose()
})

test('invalid native metadata, nonfinite samples and decoder failures never become ready', async t => {
  for (const [name, value] of [
    ['nonfinite', buffer([new Float32Array([0, NaN])])],
    ['wrong-duration', { ...buffer(), duration: 1 }],
    ['channel-length', { ...buffer(), getChannelData: () => new Float32Array(8) }],
    ['invalid-rate', buffer([new Float32Array(16)], 0)],
  ]) await t.test(name, async () => {
    const { player } = fixture({ buffer: value })
    await player.unlock()
    await assert.rejects(player.load(asset), /audio/i)
    assert.equal(player.diagnostics().ready, false)
    player.dispose()
  })
  const failed = fixture({ decode: () => Promise.reject(new Error('bad decoder')) })
  await failed.player.unlock()
  await assert.rejects(failed.player.load(asset), /bad decoder/)
  failed.player.dispose()
})

test('stop rejects a pending decode immediately and a late result cannot become ready', async () => {
  const decoding = deferred(), { player, ctx } = fixture({ decode: () => decoding.promise })
  await player.unlock()
  const loading = player.load(asset)
  const rejected = assert.rejects(loading, { name: 'AbortError' })
  while (!ctx.decodeCalls) await tick()
  player.stop()
  await rejected
  assert.equal(player.diagnostics().inFlight, true)
  decoding.resolve(buffer())
  await tick()
  assert.equal(player.diagnostics().ready, false)
  assert.equal(player.diagnostics().inFlight, false)
  assert.throws(() => player.play(), /No decoded/)
  player.dispose()
})

test('replacing selections keeps only one uncancellable decode and the newest queued load', async () => {
  const firstDecode = deferred()
  let decodeCount = 0
  const { player, ctx, fetchCalls } = fixture({ decode: () => ++decodeCount === 1 ? firstDecode.promise : Promise.resolve(buffer()) })
  await player.unlock()
  const a = player.load({ ...asset, id: 'a' }), rejectedA = assert.rejects(a, { name: 'AbortError' })
  while (!ctx.decodeCalls) await tick()
  const b = player.load({ ...asset, id: 'b' }), rejectedB = assert.rejects(b, { name: 'AbortError' })
  const c = player.load({ ...asset, id: 'c' })
  await Promise.all([rejectedA, rejectedB])
  assert.equal(fetchCalls(), 1)
  assert.equal(ctx.decodeCalls, 1)
  assert.equal(player.diagnostics().queued, true)
  firstDecode.resolve(buffer())
  await c
  assert.equal(fetchCalls(), 2)
  assert.equal(ctx.decodeCalls, 2)
  assert.equal(player.diagnostics().assetId, 'c')
  player.dispose()
})

test('a load deadline includes time queued behind an uncancellable decode', async () => {
  const firstDecode = deferred()
  const { player, ctx, fetchCalls } = fixture({ decode: () => firstDecode.promise, timeout: 150 })
  await player.unlock()
  const first = player.load(asset), firstRejected = assert.rejects(first, { name: 'AbortError' })
  while (!ctx.decodeCalls) await tick()
  const second = player.load({ ...asset, id: 'queued' })
  await firstRejected
  await assert.rejects(second, /deadline/)
  assert.equal(fetchCalls(), 1)
  firstDecode.resolve(buffer())
  await tick()
  assert.equal(player.diagnostics().ready, false)
  assert.equal(player.diagnostics().queued, false)
  player.dispose()
})

test('caller abort cancels streamed fetching and invalidates a late response', async () => {
  const fetching = deferred(), aborter = new AbortController()
  let requestSignal
  const { player, ctx } = fixture({ fetcher: (url, options) => { requestSignal = options.signal; return fetching.promise } })
  await player.unlock()
  const loading = player.load(asset, { signal: aborter.signal })
  const rejected = assert.rejects(loading, { name: 'AbortError' })
  aborter.abort(); await rejected
  assert.equal(requestSignal.aborted, true)
  fetching.resolve(new Response(encoded)); await tick()
  assert.equal(ctx.decodeCalls, 0)
  assert.equal(player.diagnostics().ready, false)
  player.dispose()
})

test('regions play at native rate and use strict coordinates with bounded concurrent voices', async () => {
  const { player, ctx, sources } = fixture()
  await player.unlock(); await player.load(asset)
  const first = player.play({ startSeconds: 0.01, endSeconds: 0.1, gainDb: -3, when: 1.5 })
  assert.deepEqual(sources[0].startArgs, [1.5, 0.01, 0.09000000000000001])
  assert.equal(sources[0].playbackRate.value, 1)
  assert.equal(sources[0].loop, false)
  assert.throws(() => player.play({ endSeconds: 0.129 }), /outside/)
  assert.throws(() => player.play({ startSeconds: -1 }), /outside/)
  assert.throws(() => player.play({ startSeconds: 0.1, endSeconds: 0.1 }), /outside/)
  assert.throws(() => player.play({ gainDb: 6.01 }), /gain/)
  assert.throws(() => player.play({ startSeconds: NaN }), /finite/)
  assert.throws(() => player.play({ when: ctx.currentTime - 1 }), /past/)
  for (let i = 1; i < AUDITION_LIMITS.voices; i++) player.play({ when: 1.5 })
  assert.equal(player.diagnostics().voices, 8)
  assert.equal(sources[0].stopCalls, 0)
  assert.throws(() => player.play(), /limit/)
  player.stop()
  assert.deepEqual(await first.finished, { reason: 'cancelled' })
  assert.ok(sources.every(source => source.stopCalls === 1 && source.disconnected && source.buffer === null))
  assert.equal(player.diagnostics().voices, 0)
  assert.equal(player.diagnostics().ready, true)
  const replay = player.play()
  sources.at(-1).onended()
  assert.deepEqual(await replay.finished, { reason: 'ended' })
  player.dispose()
})

test('owned voices finish once on end, abort, context interruption, start failure or dispose', async () => {
  const { player, sources, ctx, listeners } = fixture()
  await player.unlock(); await player.load(asset)
  let notifications = 0
  const aborter = new AbortController()
  const handle = player.play({ signal: aborter.signal, onEnded: () => { notifications++; throw new Error('observer') } })
  const staleEnd = sources[0].onended
  aborter.abort(); staleEnd(); handle.cancel()
  assert.deepEqual(await handle.finished, { reason: 'cancelled' })
  assert.equal(notifications, 1)
  const interrupted = player.play()
  ctx.state = 'suspended'; listeners.get('statechange')()
  assert.deepEqual(await interrupted.finished, { reason: 'interrupted' })
  await player.unlock()
  const closing = player.play()
  player.dispose(); player.dispose()
  assert.deepEqual(await closing.finished, { reason: 'cancelled' })
  assert.equal(ctx.closeCalls, 1)
  assert.equal(listeners.size, 0)
  assert.equal(player.diagnostics().decodedBytes, 0)
  assert.equal(await player.unlock(), false)
  const failed = fixture({ startError: true })
  await failed.player.unlock(); await failed.player.load(asset)
  assert.throws(() => failed.player.play(), /native start failed/)
  assert.equal(failed.player.diagnostics().voices, 0)
  assert.equal(failed.sources[0].disconnected, true)
  failed.player.dispose()
})

test('master volume is bounded and summed sample peaks retain conservative output headroom', async () => {
  const { player, gains } = fixture({ buffer: buffer([new Float32Array(1024).fill(1.01)]) })
  await player.unlock(); await player.load(asset)
  assert.equal(player.diagnostics().volume, 0.2)
  player.setVolume(1)
  assert.equal(player.diagnostics().volume, 0.6)
  assert.throws(() => player.setVolume(Infinity), /finite/)
  assert.throws(() => player.setVolume(-1), /between/)
  for (let i = 0; i < 8; i++) player.play({ gainDb: 6 })
  assert.ok(gains[0].gain.value * (10 ** (6 / 20)) * 8 * 1.01 <= 0.950001)
  assert.ok(player.diagnostics().safetyAttenuation < 1)
  player.setVolume(0)
  assert.equal(gains[0].gain.value, 0)
  player.dispose()
})

test('stop observers cannot restart an owned voice during cancellation', async () => {
  const { player, sources } = fixture()
  await player.unlock(); await player.load(asset)
  const playing = player.play({ onEnded() {
    player.stop()
    assert.throws(() => player.play(), /No decoded/)
  } })
  player.stop()
  assert.deepEqual(await playing.finished, { reason: 'cancelled' })
  assert.equal(sources.length, 1)
  assert.equal(player.diagnostics().voices, 0)
  player.dispose()
})
