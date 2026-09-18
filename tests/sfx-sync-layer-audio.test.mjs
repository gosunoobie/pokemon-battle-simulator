import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createSyncLayerAudio, planSyncLayers } from '../apps/sfx-bench/src/syncLayerAudio.js'

const encoded = new Uint8Array([1, 2, 3, 4])
const asset = { id: 'base', url: '/audio/base.mp3', bytes: encoded.length, sha256: createHash('sha256').update(encoded).digest('hex') }
const accentAsset = { ...asset, id: 'accent', url: '/audio/accent.mp3' }
const tick = () => new Promise(resolve => setImmediate(resolve))
const buffer = peak => ({ sampleRate: 48000, length: 48000, numberOfChannels: 1, duration: 1, getChannelData: () => new Float32Array(48000).fill(peak) })
const region = (layer, delaySeconds = 0, gainDb = 0) => ({ layer, delaySeconds, gainDb, startSeconds: 0, endSeconds: 1 })
function fixture({ decode, fetcher, peak = .8, failStartAt = -1 } = {}) {
  const gains = [], sources = [], listeners = new Set()
  let creations = 0
  const context = {
    state: 'suspended', currentTime: 2, destination: {}, sampleRate: 48000, closes: 0, decodes: 0,
    resume() { assert.equal(this, context); this.state = 'running'; return Promise.resolve() },
    decodeAudioData(bytes) { assert.equal(this, context); this.decodes++; return decode?.(bytes) ?? Promise.resolve(buffer(peak)) },
    createGain() {
      assert.equal(this, context)
      const node = { gain: { value: 1, setValueAtTime(value) { this.value = value }, linearRampToValueAtTime(value) { this.value = value }, cancelScheduledValues() {} },
        connect(to) { this.to = to }, disconnect() { this.disconnected = true } }
      gains.push(node); return node
    },
    createBufferSource() {
      assert.equal(this, context)
      const node = { playbackRate: { value: 0 }, connect(to) { this.to = to }, disconnect() { this.disconnected = true },
        start(...args) { this.args = args; if (sources.indexOf(this) === failStartAt) throw new Error('Native start failed') }, stop() { this.stopped = true } }
      sources.push(node); return node
    },
    addEventListener(name, listener) { assert.equal(this, context); listeners.add(listener) },
    removeEventListener(name, listener) { assert.equal(this, context); listeners.delete(listener) },
    close() { assert.equal(this, context); this.closes++; this.state = 'closed'; return Promise.resolve() },
  }
  const player = createSyncLayerAudio({ createContext: () => { creations++; return context }, fetcher: fetcher ?? (async () => new Response(encoded)) })
  return { player, context, gains, sources, listeners, creations: () => creations }
}

test('Psychic original and impact recordings share one clock and original playback rate', async () => {
  const { player, context, sources, creations, listeners } = fixture()
  const unlocking = player.unlock()
  assert.equal(context.state, 'running')
  assert.equal(await unlocking, true)
  assert.equal(creations(), 1)
  assert.equal(listeners.size, 2)
  const natives = await player.load(asset, accentAsset)
  assert.equal(sources.length, 0)
  const visual = { durationSeconds: 2.15 }
  const plan = { visualRate: 1, segments: [{ startSeconds: 0, endSeconds: null, soundAnchorSeconds: .97, cueSeconds: 1.03, gainDb: 0 }] }
  const accent = { segment: { startSeconds: 0, endSeconds: null, soundAnchorSeconds: .1, cueSeconds: .95, gainDb: -6 } }
  const regions = planSyncLayers(plan, natives.base, visual, accent, natives.accent)
  assert.ok(Math.abs(regions[0].delaySeconds - .06) < 1e-10)
  assert.ok(Math.abs(regions[1].delaySeconds - .85) < 1e-10)
  const run = player.play(regions)
  assert.equal(run.contextTime, 2)
  assert.ok(Math.abs(sources[0].args[0] - 2.06) < 1e-10)
  assert.ok(Math.abs(sources[1].args[0] - 2.85) < 1e-10)
  assert.ok(sources.every(source => source.playbackRate.value === 1))
  sources.forEach(source => source.onended())
  assert.deepEqual(await run.finished, [{ reason: 'ended' }, { reason: 'ended' }])
  assert.ok(sources.every(source => source.disconnected && source.buffer === null))
  player.dispose(); player.dispose()
  assert.equal(context.closes, 1)
  assert.equal(listeners.size, 0)
})

test('combined peak headroom includes every voice and remains safe after volume changes', async () => {
  const { player, gains, sources } = fixture({ peak: 1 })
  await player.unlock(); await player.load(asset, accentAsset)
  player.setVolume(.6)
  const run = player.play([region('base', 0, 6), region('accent', .1, 6)])
  const outputBound = () => gains[0].gain.value * (gains[1].gain.value * gains[3].gain.value + gains[2].gain.value * gains[4].gain.value)
  assert.ok(outputBound() <= .950001)
  player.setVolume(.1); assert.ok(outputBound() <= .950001)
  player.setVolume(.6); assert.ok(outputBound() <= .950001)
  player.stop()
  assert.deepEqual(await run.finished, [{ reason: 'cancelled' }, { reason: 'cancelled' }])
  assert.ok(sources.every(source => source.stopped && source.disconnected))
  player.dispose()
})

test('invalid groups and inherited layer names fail before scheduling any sound', async () => {
  const { player, sources } = fixture()
  await player.unlock(); await player.load(asset, accentAsset)
  for (const regions of [[], Array.from({ length: 9 }, () => region('base')), [region('base'), region('toString')],
    [region('base'), { ...region('accent'), endSeconds: 2 }], [region('base'), region('accent', 120)],
    [region('base'), region('accent', -1)], [region('base'), region('accent', 0, 7)]]) {
    assert.throws(() => player.play(regions), /limit|Invalid/)
    assert.equal(sources.length, 0)
  }
  player.dispose()
})

test('partial native scheduling failures cancel the whole group and settle its owned sources', async () => {
  const { player, sources } = fixture({ failStartAt: 1 })
  await player.unlock(); await player.load(asset, accentAsset)
  assert.throws(() => player.play([region('base'), region('accent')]), /Native start failed/)
  assert.ok(sources.every(source => source.stopped && source.disconnected && source.buffer === null))
  player.dispose()
})

test('stopping pending native decodes prevents late completions becoming a playable pair', async () => {
  const decoders = []
  const { player, context, sources } = fixture({ decode: () => new Promise(resolve => decoders.push(resolve)) })
  await player.unlock()
  const loading = player.load(asset, accentAsset), rejected = assert.rejects(loading, { name: 'AbortError' })
  while (context.decodes < 2) await tick()
  player.stop(); await rejected
  decoders.forEach(resolve => resolve(buffer(.5))); await tick()
  assert.throws(() => player.play([region('base')]), /Load both/)
  assert.equal(sources.length, 0)
  player.dispose(); assert.equal(context.closes, 1)
})

test('an accent load failure cancels its sibling and never leaves a partially ready pair', async () => {
  const { player, sources } = fixture({ fetcher: async url => url.includes('accent') ? new Response('', { status: 404 }) : new Response(encoded) })
  await player.unlock()
  await assert.rejects(player.load(asset, accentAsset), /404/)
  assert.throws(() => player.play([region('base')]), /Load both/)
  assert.equal(sources.length, 0)
  player.dispose()
})

test('previous proposal schedules only its original recording and accent plan uses separate bounds', async () => {
  const { player } = fixture()
  await player.unlock(); const native = await player.load(asset, accentAsset)
  const plan = { visualRate: 1, segments: [{ startSeconds: 0, endSeconds: null, soundAnchorSeconds: .2, cueSeconds: .3, gainDb: 0 }] }, visual = { durationSeconds: 2 }
  assert.equal(planSyncLayers(plan, native.base, visual).length, 1)
  assert.throws(() => planSyncLayers(plan, native.base, visual, { segment: { ...plan.segments[0], endSeconds: 1.1 } }, native.accent), /outside this native/)
  assert.throws(() => planSyncLayers({ ...plan, segments: Array.from({ length: 8 }, () => plan.segments[0]) }, native.base, visual, { segment: plan.segments[0] }, native.accent), /eight/)
  player.dispose()
})
