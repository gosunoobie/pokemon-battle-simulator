import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Graphics, Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createVisualAuditioner } from '../apps/sfx-bench/src/visual.js'
import { planAudition, waveformPath } from '../apps/sfx-bench/src/timing.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const subject = Object.freeze({ fxId: 'surf', phase: 'attack', markers: [{ id: 'release', label: 'Authored release guide', timeSeconds: 0.3 }] })
function harness({ assetLoader = () => Promise.resolve(Texture.WHITE), build } = {}) {
  const scene = createSceneGraph({ textures: { charizard: Texture.WHITE, venusaur: Texture.WHITE } })
  const timelines = [], built = []
  const auditioner = createVisualAuditioner({
    now: () => 1234,
    createFx: options => createBattleFx({ ...options, glowTexture: Texture.WHITE, assetLoader, effects: {
      surf: { duration: 1, build(context) {
        built.push(context)
        if (build) return build(context)
        context.layer.addChild(new Graphics().rect(0, 0, 10, 10).fill(0xffffff))
        context.tl.to(context.source.pose, { x: 20, duration: 0.8, ease: 'none' }, 0)
          .call(() => context.onCue({ type: 'impact' }), [], 0.4)
      } },
    } }),
    timelineEngine: { timeline(options) {
      const timeline = gsap.timeline({ ...options, paused: true })
      // Keep the real GSAP timeline deterministic. The bench must request its
      // start; the test advances time explicitly instead of using wall clocks.
      timeline.playCalls = []
      timeline.play = (...args) => { timeline.playCalls.push(args); return timeline }
      timelines.push(timeline)
      return timeline
    } },
  })
  const clean = () => {
    assert.equal(scene.effects.children.length, 0)
    assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
    for (const actor of scene.actors.values()) {
      assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0)
      assert.equal(actor.pose.rotation, 0); assert.equal(actor.pose.alpha, 1)
      assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    }
  }
  return { scene, auditioner, timelines, built, clean, dispose() { auditioner.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}

test('audition visual start waits for async artwork and complete recipe construction', async () => {
  const artwork = deferred(), h = harness({ assetLoader: () => artwork.promise })
  const starts = [], markers = [], frames = []
  try {
    const handle = h.auditioner.play(subject, { scene: h.scene,
      onStart: event => { assert.equal(h.built.length, 1); starts.push(event) },
      onMarker: event => markers.push(event), onFrame: time => frames.push(time),
    })
    await tick()
    assert.equal(starts.length, 0)
    assert.equal(h.timelines.length, 0)
    assert.equal(h.scene.effects.children.length, 0)
    artwork.resolve(Texture.WHITE)
    await tick()
    assert.deepEqual(starts, [{ startedAtMs: 1234, durationSeconds: 1 }])
    assert.deepEqual(h.timelines[0].playCalls, [[0]])
    h.timelines[0].time(0.3, false)
    assert.equal(markers.length, 1)
    assert.equal(markers[0].origin, 'authored-guide')
    assert.equal(markers[0].id, 'release')
    assert.equal(markers[0].timeSeconds, 0.3)
    assert.equal(markers[0].observedTimelineSeconds, 0.3)
    assert.equal(markers[0].observedAtMs, 1234)
    h.timelines[0].time(0.4, false)
    assert.equal(markers.length, 2)
    assert.equal(markers[1].origin, 'observed-result-cue')
    assert.equal(markers[1].id, 'impact')
    assert.equal(markers[1].observedTimelineSeconds, 0.4)
    assert.equal(h.scene.actor('source').pose.x, 10)
    assert.ok(frames.includes(0.4))
    h.timelines[0].time(1, false)
    assert.equal((await handle.finished).status, 'completed')
    h.clean()
  } finally { h.dispose() }
})

test('failed builders kill their paused timeline before a queued audio-start callback', async () => {
  const h = harness({ build(context) {
    context.source.pose.x = 42
    context.scene.camera.position.set(4, 5)
    context.layer.addChild(new Graphics().rect(0, 0, 10, 10).fill(0xffffff))
    throw new Error('recipe construction failed')
  } })
  let starts = 0
  try {
    const handle = h.auditioner.play(subject, { scene: h.scene, onStart: () => starts++ })
    const result = await handle.finished
    await tick()
    assert.equal(result.status, 'failed')
    assert.match(result.reason, /recipe construction/)
    assert.equal(starts, 0)
    assert.deepEqual(h.timelines[0].playCalls, [])
    h.clean()
  } finally { h.dispose() }
})

test('audio-start failure cancels the prepared visual and restores borrowed poses', async () => {
  const h = harness({ build(context) {
    context.source.pose.alpha = 0.5
    context.tl.to(context.source.pose, { x: 20, duration: 0.8 }, 0)
  } })
  try {
    const handle = h.auditioner.play(subject, { scene: h.scene, onStart() { throw new Error('audio scheduling failed') } })
    const result = await handle.finished
    assert.equal(result.status, 'failed')
    assert.equal(result.reason, 'audio scheduling failed')
    assert.deepEqual(h.timelines[0].playCalls, [])
    h.clean()
  } finally { h.dispose() }
})

test('cancellation before late assets prevents timeline construction and stale audio start', async () => {
  const artwork = deferred(), h = harness({ assetLoader: () => artwork.promise })
  let starts = 0, markers = 0
  try {
    const handle = h.auditioner.play(subject, { scene: h.scene, onStart: () => starts++, onMarker: () => markers++ })
    handle.cancel()
    assert.equal((await handle.finished).status, 'cancelled')
    artwork.resolve(Texture.WHITE)
    await tick()
    assert.equal(starts, 0)
    assert.equal(markers, 0)
    assert.equal(h.built.length, 0)
    assert.equal(h.timelines.length, 0)
    h.clean()
  } finally { h.dispose() }
})

test('late rejected assets settle as failure without scheduling audio', async () => {
  const artwork = deferred(), h = harness({ assetLoader: () => artwork.promise })
  let starts = 0
  try {
    const handle = h.auditioner.play(subject, { scene: h.scene, onStart: () => starts++ })
    artwork.reject(new Error('artwork missing'))
    assert.deepEqual(await handle.finished, { status: 'failed', reason: 'artwork missing' })
    assert.equal(starts, 0)
    h.clean()
  } finally { h.dispose() }
})

test('stale visual handles cannot cancel or clear a replacement audition', async () => {
  const h = harness()
  const starts = [], replacementMarkers = []
  try {
    const old = h.auditioner.play(subject, { scene: h.scene, onStart: () => starts.push('old') })
    await tick()
    h.timelines[0].time(0.2, false)
    assert.ok(h.scene.actor('source').pose.x > 0)
    const replacement = h.auditioner.play(subject, { scene: h.scene, sourceId: 'target',
      onStart: () => starts.push('replacement'), onMarker: event => replacementMarkers.push(event),
    })
    assert.equal((await old.finished).status, 'cancelled')
    await tick()
    old.cancel()
    assert.deepEqual(starts, ['old', 'replacement'])
    const timeline = h.timelines[1]
    timeline.time(0.4, false)
    assert.equal(h.scene.actor('source').pose.x, 0)
    assert.equal(h.scene.actor('target').pose.x, 10)
    assert.ok(replacementMarkers.some(event => event.origin === 'observed-result-cue'))
    timeline.time(1, false)
    assert.equal((await replacement.finished).status, 'completed')
    h.clean()
  } finally { h.dispose() }
})

test('dispose cancels an active visual and no new audition is accepted', async () => {
  const h = harness()
  try {
    const handle = h.auditioner.play(subject, { scene: h.scene })
    await tick()
    h.timelines[0].time(0.5, false)
    h.auditioner.dispose()
    assert.equal((await handle.finished).status, 'cancelled')
    h.clean()
    assert.throws(() => h.auditioner.play(subject, { scene: h.scene }), /disposed/)
  } finally { h.dispose() }
})

const record = (segment = {}, source = {}) => ({
  source: { sampleRate: 44100, sampleFrames: 44100, ...source },
  segments: [{ startFrame: 4410, endFrame: 22050, sourceAnchorFrame: 8820, visualAnchorSeconds: 0.6, gainDb: -3, nativeOffsetSeconds: 0, ...segment }],
})
const native = Object.freeze({ sampleRate: 48000, sampleFrames: 48000, durationSeconds: 1 })

test('audition timing aligns a named reference anchor while quantizing only native sample coordinates', () => {
  assert.deepEqual(planAudition(record(), native), [{ startSeconds: 0.1, endSeconds: 0.5, delaySeconds: 0.5, gainDb: -3 }])
  const plan = planAudition(record({ startFrame: 1, endFrame: 101, sourceAnchorFrame: 2, visualAnchorSeconds: 0.1 }), native)[0]
  assert.equal(plan.startSeconds, Math.ceil(48000 / 44100) / 48000)
  assert.equal(plan.endSeconds, Math.floor(101 * 48000 / 44100) / 48000)
  assert.equal(plan.delaySeconds, 0.1 - 1 / 44100)
})

test('native resampling quantizes a complete reference region inward without clamping', () => {
  const frames = 23933
  const nativeFrames = 26049
  const browser = { sampleRate: 48000, sampleFrames: nativeFrames, durationSeconds: nativeFrames / 48000 }
  const plan = planAudition(record({ startFrame: 0, endFrame: frames, sourceAnchorFrame: 0, visualAnchorSeconds: 0 }, { sampleFrames: frames }), browser)[0]
  assert.equal(plan.endSeconds, browser.durationSeconds)
  const changed = { ...browser, sampleFrames: nativeFrames - 2, durationSeconds: (nativeFrames - 2) / 48000 }
  assert.throws(() => planAudition(record({ startFrame: 0, endFrame: frames, sourceAnchorFrame: 0, visualAnchorSeconds: 0 }, { sampleFrames: frames }), changed), /outside/)
})

test('native offsets are explicit and never guessed from shorter decoded durations', () => {
  const plan = planAudition(record({ nativeOffsetSeconds: 0.01 }), native)[0]
  assert.equal(plan.startSeconds, 0.11)
  assert.equal(plan.endSeconds, 0.51)
  assert.equal(plan.delaySeconds, 0.5)
  assert.throws(() => planAudition(record({ startFrame: 0, sourceAnchorFrame: 0, nativeOffsetSeconds: -0.01 }), native), /outside/)
  assert.throws(() => planAudition(record(), { ...native, sampleFrames: 20000, durationSeconds: 20000 / 48000 }), /outside/)
})

test('invalid region values and starts before the animation are rejected before scheduling', () => {
  for (const segment of [
    { startFrame: -1 }, { startFrame: 0.5 }, { endFrame: 44101 }, { endFrame: 4410 },
    { sourceAnchorFrame: 1 }, { sourceAnchorFrame: 22050 }, { visualAnchorSeconds: -1 },
    { gainDb: 6.01 }, { gainDb: -60.01 }, { nativeOffsetSeconds: NaN },
  ]) assert.throws(() => planAudition(record(segment), native), /Region 1/)
  assert.throws(() => planAudition(record({ visualAnchorSeconds: 0.05 }), native), /before the animation/)
  assert.throws(() => planAudition(record(), null), /Load/)
  assert.throws(() => planAudition(record(), { ...native, durationSeconds: Infinity }), /Load/)
})

test('waveform SVG uses finite native extrema and omits malformed bins', () => {
  const path = waveformPath({ min: [-0.5, -1], max: [0.5, 1] }, 100, 100)
  assert.equal(path, 'M25.00,27.50V72.50 M75.00,5.00V95.00')
  assert.equal(waveformPath({ min: [0], max: [] }), '')
  assert.equal(waveformPath(null), '')
  assert.doesNotMatch(waveformPath({ min: [NaN, -1], max: [0.5, 1] }), /NaN|Infinity/)
})
