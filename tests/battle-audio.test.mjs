import test from 'node:test'
import assert from 'node:assert/strict'
import { createAudioPlayer } from '../packages/battle-audio/src/index.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const tick = () => new Promise(resolve => setImmediate(resolve))
const response = (id = 1) => ({ ok: true, arrayBuffer: async () => Uint8Array.of(id).buffer })

function harness(options = {}) {
  const calls = { created: 0, resumed: 0, closed: 0, fetched: [], decoded: [], sources: [], gains: [], states: [] }
  const context = {
    state: 'suspended', currentTime: 12, destination: {}, listeners: new Set(),
    addEventListener: (_name, callback) => context.listeners.add(callback),
    removeEventListener: (_name, callback) => context.listeners.delete(callback),
    resume() {
      calls.resumed += 1
      if (options.resume) return options.resume(context)
      context.state = 'running'
      return Promise.resolve()
    },
    close() { calls.closed += 1; context.state = 'closed'; return Promise.resolve() },
    async decodeAudioData(encoded) {
      calls.decoded.push(encoded)
      if (options.decode) return options.decode(encoded)
      return { length: 100, numberOfChannels: 1, duration: 0.725 }
    },
    createBufferSource() {
      const source = {
        started: [], stopped: 0, disconnected: 0, buffer: null, loop: true,
        connect(node) { source.output = node },
        start(time) { source.started.push(time) },
        stop() { source.stopped += 1 },
        disconnect() { source.disconnected += 1 },
      }
      calls.sources.push(source)
      return source
    },
    createGain() {
      const gain = { gain: { value: null }, connect() {}, disconnected: 0, disconnect() { gain.disconnected += 1 } }
      calls.gains.push(gain)
      return gain
    },
  }
  const player = createAudioPlayer({
    resolveAsset: options.resolveAsset ?? (id => id === 'missing' ? null : { url: `/audio/${id}.ogg`, durationSeconds: 20 }),
    createContext() { calls.created += 1; if (options.createFails) throw new Error('unsupported'); return context },
    fetch: async (url, init) => {
      calls.fetched.push({ url, signal: init.signal })
      return options.fetch ? options.fetch(url, init) : response()
    },
    onState(state) { calls.states.push(state); options.onState?.(state) },
    ...options.config,
  })
  return { player, calls, context }
}

test('construction and preloading are silent; unlock creates and resumes synchronously inside the gesture', async t => {
  const { player, calls } = harness()
  t.after(() => player.dispose())
  assert.deepEqual(player.getState(), { enabled: true, volume: 0.6, suspended: false, status: 'locked', loadError: null })
  assert.deepEqual(await player.preload(['a']), [false])
  assert.equal(player.play('a'), false)
  assert.equal(calls.created, 0)
  const unlocking = player.unlock()
  assert.equal(calls.created, 1)
  assert.equal(calls.resumed, 1)
  assert.equal(await unlocking, true)
  assert.equal(player.getState().status, 'ready')
  await player.unlock()
  assert.equal(calls.created, 1)
  assert.equal(calls.resumed, 1)
})

test('loading never replays a missed cue, and playback uses decoded duration with gain headroom', async t => {
  const download = deferred()
  const { player, calls } = harness({ fetch: () => download.promise })
  t.after(() => player.dispose())
  await player.unlock()
  const pending = player.preload(['a'])
  assert.equal(player.play('a'), false)
  download.resolve(response())
  assert.deepEqual(await pending, [true])
  assert.equal(calls.sources.length, 0)
  assert.equal(player.play('a'), true)
  assert.deepEqual(calls.sources[0].started, [12])
  assert.equal(calls.sources[0].buffer.duration, 0.725)
  assert.equal(calls.sources[0].loop, false)
  assert.equal(calls.gains[0].gain.value, 0.21)
  player.setVolume(1)
  assert.equal(calls.gains[0].gain.value, 0.35)
  player.setVolume(3)
  assert.equal(player.getState().volume, 1)
  player.setVolume(-1)
  assert.equal(calls.gains[0].gain.value, 0)
  player.setVolume(NaN)
  assert.equal(player.getState().volume, 0)
})

test('aliases and concurrent requests share one download and decode', async t => {
  const download = deferred()
  const { player, calls } = harness({
    fetch: () => download.promise,
    resolveAsset: () => ({ url: '/one-shared-file.ogg' }),
  })
  t.after(() => player.dispose())
  await player.unlock()
  const first = player.preload(['base', 'form'])
  const second = player.preload(['base'])
  download.resolve(response())
  assert.deepEqual(await first, [true, true])
  assert.deepEqual(await second, [true])
  assert.equal(calls.fetched.length, 1)
  assert.equal(calls.decoded.length, 1)
  assert.equal(player.play('form'), true)
})

test('two voices are bounded; replacement and natural completion disconnect only owned nodes', async t => {
  const { player, calls } = harness()
  t.after(() => player.dispose())
  await player.unlock()
  await player.preload(['a', 'b', 'c'])
  player.play('a')
  player.play('b')
  player.play('c')
  assert.equal(calls.sources.length, 3)
  assert.equal(calls.sources[0].stopped, 1)
  assert.equal(calls.sources[0].disconnected, 1)
  assert.equal(calls.gains[0].disconnected, 1)
  assert.equal(calls.sources[0].onended, null)
  calls.sources[1].onended()
  assert.equal(calls.sources[1].disconnected, 1)
  assert.equal(calls.sources[1].stopped, 0)
  player.stop()
  assert.equal(calls.sources[2].stopped, 1)
  assert.equal(calls.sources[1].disconnected, 1)
  assert.equal(calls.closed, 0)
})

test('decoded LRU is bounded by PCM bytes, and a ready access refreshes recency', async t => {
  const { player, calls } = harness({
    decode: async () => ({ length: 4, numberOfChannels: 1, duration: 0.1 }),
    config: { maxCacheBytes: 32 },
  })
  t.after(() => player.dispose())
  await player.unlock()
  await player.preload(['a', 'b'])
  assert.equal(player.play('a'), true)
  await player.preload(['c'])
  assert.equal(player.play('b'), false)
  assert.equal(player.play('a'), true)
  assert.equal(player.play('c'), true)
  await player.preload(['b'])
  assert.equal(calls.fetched.length, 4)
})

test('oversized or invalid decoded buffers are not cached', async t => {
  const { player } = harness({
    decode: async () => ({ length: 1000, numberOfChannels: 2, duration: 1 }),
    config: { maxCacheBytes: 100 },
  })
  t.after(() => player.dispose())
  await player.unlock()
  assert.deepEqual(await player.preload(['large']), [false])
  assert.equal(player.play('large'), false)
  assert.equal(player.getState().loadError, null)
})

test('fetch and decode together respect the concurrency limit', async t => {
  const decodes = []
  const { player, calls } = harness({
    decode: () => { const gate = deferred(); decodes.push(gate); return gate.promise },
    config: { concurrency: 2 },
  })
  t.after(() => player.dispose())
  await player.unlock()
  const loading = player.preload(['a', 'b', 'c', 'd'])
  await tick()
  assert.equal(calls.fetched.length, 2)
  assert.equal(decodes.length, 2)
  decodes[0].resolve({ length: 4, numberOfChannels: 1, duration: 0.1 })
  await tick()
  assert.equal(calls.fetched.length, 3)
  decodes[1].resolve({ length: 4, numberOfChannels: 1, duration: 0.1 })
  await tick()
  assert.equal(calls.fetched.length, 4)
  decodes[2].resolve({ length: 4, numberOfChannels: 1, duration: 0.1 })
  decodes[3].resolve({ length: 4, numberOfChannels: 1, duration: 0.1 })
  assert.deepEqual(await loading, [true, true, true, true])
})

test('stop cancels active and queued work; late decodes cannot repopulate the cache', async t => {
  const decode = deferred()
  const { player, calls } = harness({ decode: () => decode.promise, config: { concurrency: 1 } })
  t.after(() => player.dispose())
  await player.unlock()
  const pending = player.preload(['a', 'b'])
  await tick()
  player.stop()
  assert.deepEqual(await pending, [false, false])
  assert.equal(calls.fetched[0].signal.aborted, true)
  decode.resolve({ length: 4, numberOfChannels: 1, duration: 0.1 })
  await tick()
  assert.equal(player.play('a'), false)
  assert.equal(calls.fetched.length, 1)
  assert.equal(calls.sources.length, 0)
  assert.equal(player.getState().loadError, null)
})

test('a timeout includes queued work and cannot release a still-running decoder slot', async t => {
  const decode = deferred()
  const { player, calls } = harness({ decode: () => decode.promise, config: { concurrency: 1, loadTimeoutMs: 20 } })
  t.after(() => player.dispose())
  await player.unlock()
  assert.deepEqual(await player.preload(['a', 'b']), [false, false])
  assert.equal(calls.fetched.length, 1)
  assert.equal(calls.fetched[0].signal.aborted, true)
  decode.resolve({ length: 4, numberOfChannels: 1, duration: 0.1 })
  await tick()
  assert.equal(player.play('a'), false)
})

test('muting and backgrounding stop voices without replay on resume', async t => {
  const { player, calls } = harness()
  t.after(() => player.dispose())
  player.setEnabled(false)
  assert.equal(await player.unlock(), false)
  assert.equal(calls.created, 0)
  player.setEnabled(true)
  await player.unlock()
  await player.preload(['a'])
  player.play('a')
  player.setEnabled(false)
  assert.equal(calls.sources[0].stopped, 1)
  assert.equal(player.play('a'), false)
  player.setEnabled(true)
  assert.equal(calls.sources.length, 1)
  player.play('a')
  player.setSuspended(true)
  assert.equal(calls.sources[1].stopped, 1)
  assert.equal(player.play('a'), false)
  assert.equal(await player.unlock(), false)
  player.setSuspended(false)
  assert.equal(calls.sources.length, 2)
  assert.equal(player.play('a'), true)
})

test('unsupported contexts and autoplay rejection remain optional and retryable', async t => {
  const unsupported = harness({ createFails: true })
  const blocked = harness({ resume: () => Promise.reject(new Error('gesture needed')) })
  t.after(() => { unsupported.player.dispose(); blocked.player.dispose() })
  assert.equal(await unsupported.player.unlock(), false)
  assert.equal(unsupported.player.getState().status, 'unavailable')
  assert.equal(await blocked.player.unlock(), false)
  assert.equal(blocked.player.getState().status, 'locked')
  assert.equal(blocked.player.play('a'), false)
  assert.deepEqual(await blocked.player.preload(['a']), [true])
  blocked.context.resume = () => { blocked.context.state = 'running'; return Promise.resolve() }
  assert.equal(await blocked.player.unlock(), true)
  assert.equal(blocked.player.play('a'), true)
})

test('missing files and decoder failures are isolated from supported clips', async t => {
  const { player } = harness({
    fetch: url => url.includes('http-error') ? { ok: false } : url.includes('network-error')
      ? Promise.reject(new Error('offline')) : response(url.includes('bad-codec') ? 2 : 1),
    decode: async encoded => {
      if (new Uint8Array(encoded)[0] === 2) throw new Error('unsupported codec')
      return { length: 4, numberOfChannels: 1, duration: 0.1 }
    },
    onState() { throw new Error('bad observer') },
  })
  t.after(() => player.dispose())
  await player.unlock()
  assert.deepEqual(await player.preload(['missing', 'http-error', 'network-error', 'bad-codec', 'good']), [false, false, false, false, true])
  assert.equal(player.getState().status, 'ready')
  assert.equal(player.play('good'), true)
})

test('file failures expose their phase and a later successful load clears the warning', async t => {
  const { player, calls } = harness({
    fetch: url => url.includes('http-error') ? { ok: false } : url.includes('network-error')
      ? Promise.reject(new Error('offline')) : response(url.includes('bad-codec') ? 2 : 1),
    decode: async encoded => {
      if (new Uint8Array(encoded)[0] === 2) throw new Error('unsupported codec')
      return { length: 4, numberOfChannels: 1, duration: 0.1 }
    },
  })
  t.after(() => player.dispose())
  await player.unlock()
  await player.preload(['http-error'])
  assert.equal(player.getState().loadError, 'load')
  assert.equal(player.getState().status, 'ready')
  await player.preload(['good'])
  assert.equal(player.getState().loadError, null)
  await player.preload(['bad-codec'])
  assert.equal(player.getState().loadError, 'decode')
  await player.preload(['missing', 'good'])
  assert.equal(player.getState().loadError, 'decode', 'unknown IDs and cache hits are not a successful retry')
  await player.preload(['another-good'])
  assert.equal(player.getState().loadError, null)
  await player.preload(['network-error'])
  assert.equal(player.getState().loadError, 'load')
  assert.ok(calls.states.some(state => state.loadError === 'decode'))
  assert.equal(player.play('good'), true)
})

test('loading and decoding deadlines report warnings without caching late results', async t => {
  const download = deferred()
  const decode = deferred()
  const network = harness({ fetch: () => download.promise, config: { loadTimeoutMs: 20 } })
  const codec = harness({ decode: () => decode.promise, config: { loadTimeoutMs: 20 } })
  t.after(() => { network.player.dispose(); codec.player.dispose() })
  await network.player.unlock()
  await codec.player.unlock()
  const [networkResult, codecResult] = await Promise.all([
    network.player.preload(['a']), codec.player.preload(['a']),
  ])
  assert.deepEqual(networkResult, [false])
  assert.deepEqual(codecResult, [false])
  assert.equal(network.player.getState().loadError, 'load')
  assert.equal(codec.player.getState().loadError, 'decode')
  download.resolve(response())
  decode.resolve({ length: 4, numberOfChannels: 1, duration: 0.1 })
  await tick()
  assert.equal(network.player.getState().loadError, 'load')
  assert.equal(codec.player.getState().loadError, 'decode')
  assert.equal(codec.player.play('a'), false)
})

test('deliberate cancellation never presents a network failure warning', async t => {
  const { player } = harness({
    fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }),
  })
  t.after(() => player.dispose())
  await player.unlock()
  const loading = player.preload(['a'])
  player.stop()
  assert.deepEqual(await loading, [false])
  await tick()
  assert.equal(player.getState().loadError, null)
})

test('a failed context factory does not poison a later explicit unlock retry', async t => {
  let candidate = {}
  const { player, context } = harness({ config: { createContext: () => candidate } })
  t.after(() => player.dispose())
  assert.equal(await player.unlock(), false)
  assert.equal(player.getState().status, 'unavailable')
  candidate = context
  assert.equal(await player.unlock(), true)
  assert.equal(player.getState().status, 'ready')
})

test('external context suspension stops voices and requires running state before new playback', async t => {
  const { player, calls, context } = harness()
  t.after(() => player.dispose())
  await player.unlock()
  await player.preload(['a'])
  player.play('a')
  context.state = 'interrupted'
  for (const listener of context.listeners) listener()
  assert.equal(player.getState().status, 'locked')
  assert.equal(calls.sources[0].stopped, 1)
  assert.equal(player.play('a'), false)
  await player.unlock()
  assert.equal(calls.sources.length, 1)
  assert.equal(player.play('a'), true)
})

test('dispose aborts downloads, closes its context once, and rejects all late work', async () => {
  const download = deferred()
  const { player, calls, context } = harness({ fetch: () => download.promise })
  await player.unlock()
  const pending = player.preload(['a'])
  player.dispose()
  player.dispose()
  assert.deepEqual(await pending, [false])
  assert.equal(calls.fetched[0].signal.aborted, true)
  assert.equal(calls.closed, 1)
  assert.equal(context.listeners.size, 0)
  download.resolve(response())
  await tick()
  assert.equal(calls.decoded.length, 0)
  assert.equal(player.play('a'), false)
  assert.equal(await player.unlock(), false)
  assert.deepEqual(await player.preload(['a']), [false])
  assert.equal(player.getState().status, 'unavailable')
})
