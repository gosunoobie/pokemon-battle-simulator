import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const subject = { fxId: 'triple-kick', phase: 'attack', visual: { durationSeconds: 2.25,
  markers: [.5, .84, 1.2].map((timeSeconds, i) => ({ id: `contact-${i + 1}`, label: `Cosmetic contact ${i + 1}`, timeSeconds })) } }
function harness({ assetLoader = async () => Texture.WHITE, createFx } = {}) {
  const scene = createSceneGraph({ textures: { charizard: Texture.WHITE, venusaur: Texture.WHITE } }), timelines = []
  let wallTime = 1000
  const auditioner = createSyncVisualAuditioner({ now: () => wallTime,
    createFx: createFx ?? (options => createBattleFx({ ...options, glowTexture: Texture.WHITE, assetLoader })),
    timelineEngine: { timeline(vars) {
      const raw = gsap.timeline({ ...vars, paused: true }); raw.playCalls = []
      raw.play = (...args) => { raw.playCalls.push(args); return raw }; timelines.push(raw); return raw
    } },
  })
  function clean() {
    assert.equal(scene.effects.children.length, 0)
    assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
    for (const actor of scene.actors.values()) {
      assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
      assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    }
  }
  return { scene, timelines, auditioner, clean, advanceWall: time => { wallTime += time },
    dispose() { auditioner.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}

test('retiming preserves actual Triple Kick geometry and its single result cue from both field positions', async () => {
  for (const sourceId of ['source', 'target']) {
    let baseline
    for (const visualRate of [1, .8, 1.15]) {
      const h = harness(), starts = [], markers = [], frames = [], samples = []
      try {
        const handle = h.auditioner.play(subject, { scene: h.scene, sourceId, visualRate,
          onStart: value => starts.push(value), onMarker: value => markers.push(value), onFrame: (elapsed, details) => frames.push({ elapsed, details }) })
        await tick()
        const raw = h.timelines[0]
        assert.equal(raw.timeScale(), visualRate); assert.deepEqual(raw.playCalls, [[0]])
        assert.equal(starts[0].durationSeconds, 2.25 / visualRate)
        assert.equal(starts[0].authoredDurationSeconds, 2.25)
        for (const marker of subject.visual.markers) {
          h.advanceWall(100); raw.time(marker.timeSeconds, false)
          const source = h.scene.actor(sourceId), target = h.scene.actor(sourceId === 'source' ? 'target' : 'source')
          const burst = h.scene.effects.getChildByLabel(`triple-kick-impact-${samples.length}`, true)
          samples.push({ sourceX: source.pose.x, sourceY: source.pose.y, sourceRotation: source.pose.rotation,
            targetX: target.pose.x, targetY: target.pose.y, burstX: burst.x, burstY: burst.y })
        }
        if (!baseline) baseline = samples
        else assert.deepEqual(samples, baseline, 'rate changes pacing only; authored contact geometry remains identical')
        const guides = markers.filter(marker => marker.origin === 'authored-guide'), results = markers.filter(marker => marker.origin === 'observed-result-cue')
        assert.deepEqual(guides.map(marker => marker.id), ['contact-1', 'contact-2', 'contact-3'])
        assert.deepEqual(results.map(marker => marker.id), ['impact'])
        assert.equal(results[0].authoredTimelineSeconds, 1.2)
        assert.equal(results[0].elapsedSeconds, 1.2 / visualRate)
        assert.equal(guides[0].timeSeconds, .5); assert.equal(guides[0].elapsedCueSeconds, .5 / visualRate)
        assert.ok(frames.some(frame => frame.elapsed === .84 / visualRate && frame.details.authoredTimelineSeconds === .84))
        assert.ok(frames.every(frame => frame.details.elapsedWallSeconds >= 0))
        raw.time(2.25, false); assert.equal((await handle.finished).status, 'completed'); h.clean()
      } finally { h.dispose() }
    }
  }
})

test('retimed auditions wait for asynchronous artwork and ignore cancellation before it arrives', async () => {
  const artwork = deferred(), h = harness({ assetLoader: () => artwork.promise }), starts = []
  try {
    const first = h.auditioner.play({ fxId: 'surf', visual: { durationSeconds: 3.2, markers: [] } },
      { scene: h.scene, visualRate: .8, onStart: value => starts.push(value) })
    await tick(); assert.equal(starts.length, 0); assert.equal(h.timelines.length, 0)
    first.cancel(); assert.equal((await first.finished).status, 'cancelled')
    artwork.resolve(Texture.WHITE); await tick()
    assert.equal(starts.length, 0); assert.equal(h.timelines.length, 0); h.clean()
  } finally { h.dispose() }
})

test('supersession and disposal clean owned poses without letting old handles stop the replacement', async () => {
  const h = harness(), markers = []
  try {
    const first = h.auditioner.play(subject, { scene: h.scene, visualRate: .8 }); await tick(); h.timelines[0].time(.5, false)
    const next = h.auditioner.play(subject, { scene: h.scene, sourceId: 'target', visualRate: 1.1, onMarker: marker => markers.push(marker) })
    assert.equal((await first.finished).status, 'cancelled'); await tick(); first.cancel()
    h.timelines[1].time(1.2, false)
    assert.equal(markers.filter(marker => marker.origin === 'observed-result-cue').length, 1)
    h.auditioner.dispose(); assert.equal((await next.finished).status, 'cancelled'); h.clean()
    assert.throws(() => h.auditioner.play(subject, { scene: h.scene }), /disposed/)
  } finally { h.dispose() }
})

test('an audio scheduling observer failure cancels the prepared comparison without starting its clock', async () => {
  const h = harness()
  try {
    const handle = h.auditioner.play(subject, { scene: h.scene, visualRate: .9, onStart() { throw new Error('audio schedule failed') } })
    assert.deepEqual(await handle.finished, { status: 'failed', reason: 'audio schedule failed' })
    assert.deepEqual(h.timelines[0].playCalls, []); h.clean()
  } finally { h.dispose() }
})

test('invalid visual rates and authored markers are rejected without cancelling a valid comparison', async () => {
  const h = harness()
  try {
    const handle = h.auditioner.play(subject, { scene: h.scene }); await tick()
    assert.throws(() => h.auditioner.play(subject, { scene: h.scene, visualRate: 0 }), /Visual rate/)
    assert.throws(() => h.auditioner.play({ ...subject, visual: { ...subject.visual, markers: [{ id: 'late', label: 'Late', timeSeconds: 3 }] } }, { scene: h.scene }), /markers/)
    h.timelines[0].time(2.25, false); assert.equal((await handle.finished).status, 'completed'); h.clean()
  } finally { h.dispose() }
})

test('recipe failures and markers beyond the actual timeline never start audio or extend the original clip', async () => {
  for (const mode of ['build-failure', 'invalid-marker']) {
    const h = harness({ createFx: options => createBattleFx({ ...options, glowTexture: Texture.WHITE,
      effects: { 'triple-kick': { duration: 1, build(context) {
        context.source.pose.x = 12
        if (mode === 'build-failure') throw new Error('recipe failed')
        context.tl.to(context.source.pose, { x: 0, duration: 1 }, 0)
      } } },
    }) })
    let starts = 0
    try {
      const handle = h.auditioner.play(subject, { scene: h.scene, onStart: () => starts++ })
      const result = await handle.finished; await tick()
      assert.equal(result.status, 'failed')
      assert.match(result.reason, mode === 'build-failure' ? /recipe failed/ : /cannot extend/)
      assert.equal(starts, 0); assert.deepEqual(h.timelines[0].playCalls, []); h.clean()
    } finally { h.dispose() }
  }
})
