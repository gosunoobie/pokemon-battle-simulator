import test from 'node:test'
import assert from 'node:assert/strict'
import { createAudioPlayer } from '../packages/battle-audio/src/index.js'
import { createMoveAudio } from '../apps/shared/battle/moveAudio.js'

const CHROME = 'Mozilla/5.0 Chrome/152.0.0.0 Safari/537.36'
const tick = () => new Promise(resolve => setImmediate(resolve))
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-10, `${message}: ${actual} versus ${expected}`)

async function harness(t, { sampleFrames = 325440, sampleRate = 48000, throwOnRamp = false } = {}) {
  const sources = [], gains = []
  const pcm = new Float32Array(sampleFrames).fill(.8)
  const buffer = { length: sampleFrames, sampleRate, duration: sampleFrames / sampleRate,
    numberOfChannels: 1, getChannelData: () => pcm }
  const context = {
    state: 'running', currentTime: 10, sampleRate, destination: {},
    async resume() {}, async close() { context.state = 'closed' },
    async decodeAudioData() { return buffer },
    createGain() {
      const events = []
      const node = { events, gain: { value: 1,
        setValueAtTime(value, when) { events.push(['set', value, when]) },
        linearRampToValueAtTime(value, when) {
          if (throwOnRamp) throw new Error('Automation unavailable')
          events.push(['ramp', value, when])
        },
        cancelScheduledValues(when) { events.push(['cancel', when]) },
      }, connect(output) { node.output = output }, disconnect() { node.disconnected = true } }
      gains.push(node)
      return node
    },
    createBufferSource() {
      const source = { playbackRate: { value: 9 }, stopCalls: [],
        connect(output) { source.output = output },
        start(...args) { source.started = args },
        stop(...args) { source.stopCalls.push(args) },
        disconnect() { source.disconnected = true },
      }
      sources.push(source)
      return source
    },
  }
  const player = createAudioPlayer({ resolveAsset: id => ({ url: `/sounds/${id}.mp3` }),
    createContext: () => context, fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }) })
  t.after(() => player.dispose())
  assert.equal(await player.unlock(), true)
  assert.deepEqual(await player.preload(['sound']), [true])
  return { player, context, sources, gains, buffer }
}

function acceptedPlan(h, extra = {}) {
  return { assetId: 'sound', reviewStatus: 'accepted-sync', phase: 'attack', playbackRate: 1,
    visualRate: 1, visualDurationSeconds: 4.75, taperEdits: true,
    nativeCompatibility: { browser: 'Chrome', version: '152.0.0.0',
      sampleRate: h.buffer.sampleRate, sampleFrames: h.buffer.length },
    segments: [{ startSeconds: 2.86, endSeconds: 6.67, soundAnchorSeconds: 3.08, cueSeconds: .94, gainDb: 0 }],
    ...extra }
}

function acceptedRun(t, h, plan, options = {}) {
  const audio = createMoveAudio({ player: h.player, userAgent: CHROME, getPlan: () => plan,
    getCanonicalPlan: () => plan, now: () => 1000, ...options })
  t.after(() => audio.dispose())
  const run = audio.begin({ moveId: 'eruption' })
  run.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: 1000 })
  return { audio, run }
}

test('accepted Eruption propagates its two reviewed 12 ms tapers into the native voice', async t => {
  const h = await harness(t)
  const { audio, run } = acceptedRun(t, h, acceptedPlan(h))
  assert.equal(audio.diagnostics().started, 1)
  const source = h.sources[0], gain = source.output
  close(source.started[0], 10.72, 'audio delay')
  assert.equal(source.started[1], 2.86)
  close(source.started[2], 3.81, 'selected duration')
  assert.equal(source.playbackRate.value, 1)
  assert.equal(source.loop, false)
  assert.equal(gain.gain.value, 1)
  const expected = [['set', 0, 10.72], ['ramp', 1, 10.732], ['set', 1, 14.518], ['ramp', 0, 14.53]]
  assert.equal(gain.events.length, expected.length)
  gain.events.forEach((event, index) => {
    assert.deepEqual(event.slice(0, 2), expected[index].slice(0, 2))
    close(event[2], expected[index][2], 'reviewed boundary automation')
  })
  run.finish({ status: 'completed' })
  assert.deepEqual(source.stopCalls, [], 'visual completion does not cancel the sound')
  source.onended()
  await tick()
  assert.equal(audio.diagnostics().activeRuns, 0)
  assert.equal(h.player.diagnostics().voices, 0)
  assert.equal(source.disconnected, true)
  assert.equal(gain.disconnected, true)
  assert.equal(source.buffer, null)
  assert.equal(h.player.readyInfo('sound').sampleFrames, 325440, 'owned cleanup retains the cached native recording')
})

test('the five Batch 5 end cuts taper only their final 12 ms and retain authored gains', async t => {
  for (const [name, endSeconds, gainDb] of [
    ['Razor Leaf', 1.67, 0], ['Sludge Bomb', 2.83, 0], ['Overheat', 2.86, 0],
    ['Earthquake', 2.70, -2.15], ['Bubble Beam', 3.063333333333333, 0],
  ]) {
    const h = await harness(t)
    const handle = h.player.playSegment('sound', { endSeconds, when: 10.3, gainDb, taperEdits: true })
    const source = h.sources[0], gain = source.output, amplitude = 10 ** (gainDb / 20)
    assert.deepEqual(source.started, [10.3, 0, endSeconds], name)
    assert.equal(source.playbackRate.value, 1, name)
    assert.equal(gain.gain.value, amplitude, name)
    assert.equal(gain.events.length, 2, `${name}: native beginning has no fade-in`)
    assert.deepEqual(gain.events[0].slice(0, 2), ['set', amplitude], name)
    close(gain.events[0][2], 10.3 + endSeconds - .012, `${name}: fade begins inside the edit`)
    assert.deepEqual(gain.events[1], ['ramp', 0, 10.3 + endSeconds], name)
    source.onended()
    assert.deepEqual(await handle.finished, { reason: 'ended' })
  }
})

test('whole recordings and previously accepted untapered edits keep their original envelopes', async t => {
  const h = await harness(t)
  for (const options of [
    { taperEdits: true },
    { endSeconds: 1.91 },
    { endSeconds: 2.60, taperEdits: false },
    { startSeconds: 2.86, endSeconds: 6.67, taperEdits: false },
    { category: 'cries' },
  ]) {
    const handle = h.player.playSegment('sound', options)
    const source = h.sources.at(-1)
    assert.deepEqual(source.output.events, [])
    assert.equal(source.playbackRate.value, 1)
    if (!options.startSeconds && options.endSeconds === undefined) assert.deepEqual(source.started, [10], 'whole native start overload is preserved')
    source.onended()
    assert.deepEqual(await handle.finished, { reason: 'ended' })
  }
  const oldPlan = acceptedPlan(h, { taperEdits: undefined,
    segments: [{ startSeconds: 0, endSeconds: 1.91, soundAnchorSeconds: .5, cueSeconds: .59, gainDb: -2.8 }] })
  acceptedRun(t, h, oldPlan)
  assert.deepEqual(h.sources.at(-1).output.events, [], 'optional plan field does not alter older accepted playback')
})

test('start-only edits preserve the natural ending and very short regions bound both tapers inside the cut', async t => {
  const h = await harness(t)
  const startOnly = h.player.playSegment('sound', { startSeconds: 2.86, taperEdits: true })
  assert.deepEqual(h.sources[0].output.events, [['set', 0, 10], ['ramp', 1, 10.012]])
  h.sources[0].onended()
  await startOnly.finished
  const short = h.player.playSegment('sound', { startSeconds: 1, endSeconds: 1.02, taperEdits: true })
  const events = h.sources[1].output.events
  assert.deepEqual(events.map(event => event.slice(0, 2)), [['set', 0], ['ramp', 1], ['set', 1], ['ramp', 0]])
  events.forEach((event, index) => close(event[2], [10, 10.005, 10.015, 10.02][index], 'short-region quarter-span bound'))
  h.sources[1].onended()
  await short.finished
})

test('cancellation before a tapered future start settles and disconnects immediately', async t => {
  const h = await harness(t)
  const controller = new AbortController()
  const handle = h.player.playSegment('sound', { startSeconds: 2.86, endSeconds: 6.67,
    taperEdits: true, when: 10.72, signal: controller.signal })
  const source = h.sources[0], gain = source.output
  controller.abort()
  assert.deepEqual(await handle.finished, { reason: 'cancelled' })
  assert.deepEqual(source.stopCalls, [[]])
  assert.equal(source.disconnected, true)
  assert.equal(gain.disconnected, true)
  assert.equal(source.onended, null)
  assert.equal(source.buffer, null)
  assert.equal(h.player.diagnostics().voices, 0)
  handle.cancel()
  assert.equal(source.stopCalls.length, 1, 'late cancellation cannot revive a scheduled voice')
})

test('active cancellation replaces future edit automation with the established owned 8 ms fade', async t => {
  const h = await harness(t)
  const scope = {}
  const handle = h.player.playSegment('sound', { endSeconds: 2.7, taperEdits: true, scope })
  const source = h.sources[0], gain = source.output
  h.context.currentTime = 10.5
  h.player.stopScope(scope)
  assert.deepEqual(await handle.finished, { reason: 'cancelled' })
  assert.deepEqual(gain.events.slice(-3), [['cancel', 10.5], ['set', 1, 10.5], ['ramp', 0, 10.508]])
  assert.deepEqual(source.stopCalls, [[10.508]])
  source.onended()
  assert.equal(source.disconnected, true)
  assert.equal(gain.disconnected, true)
  assert.equal(h.player.diagnostics().voices, 0)
})

test('completed presentation preserves a native tail but explicit cancellation still owns it', async t => {
  const h = await harness(t)
  const plan = acceptedPlan(h, { visualDurationSeconds: 1.8,
    segments: [{ startSeconds: 0, endSeconds: null, soundAnchorSeconds: 0, cueSeconds: .3, gainDb: 0 }] })
  const { audio, run } = acceptedRun(t, h, plan)
  const source = h.sources[0]
  run.finish({ status: 'completed' })
  assert.deepEqual(source.stopCalls, [])
  assert.deepEqual(source.output.events, [], 'taper opt-in leaves the full source envelope intact')
  assert.equal(audio.diagnostics().activeRuns, 1)
  run.cancel()
  await tick()
  assert.deepEqual(source.stopCalls, [[]])
  assert.equal(source.disconnected, true)
  assert.equal(audio.diagnostics().activeRuns, 0)
})

test('invalid taper metadata and incompatible native buffers stay silent before voice allocation', async t => {
  const h = await harness(t)
  for (const taperEdits of ['true', 1, null, {}]) {
    assert.equal(h.player.playSegment('sound', { taperEdits }), null)
    const { audio } = acceptedRun(t, h, acceptedPlan(h, { taperEdits }))
    assert.equal(audio.diagnostics().unsupported, 1)
  }
  const incompatible = acceptedPlan(h)
  incompatible.nativeCompatibility.sampleFrames += incompatible.nativeCompatibility.sampleRate
  const { audio } = acceptedRun(t, h, incompatible)
  assert.equal(audio.diagnostics().unsupported, 1)
  assert.equal(h.sources.length, 0)
})

test('failed taper scheduling releases the allocated voice without starting or damaging its cached buffer', async t => {
  const h = await harness(t, { throwOnRamp: true })
  assert.equal(h.player.playSegment('sound', { endSeconds: 2.7, taperEdits: true }), null)
  const source = h.sources[0]
  assert.equal(source.started, undefined)
  assert.deepEqual(source.stopCalls, [[]])
  assert.equal(source.disconnected, true)
  assert.equal(source.output, undefined, 'failure occurs before graph connection')
  assert.equal(h.gains.at(-1).disconnected, true)
  assert.equal(h.player.diagnostics().voices, 0)
  assert.equal(h.player.readyInfo('sound').sampleFrames, 325440)
})
