import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Graphics, Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createClockedBattleFx } from '@battle/battle-fx/presentation-clock'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { ACCEPTED_SFX_RUNTIME_CATALOG } from '@battle/battle-sfx/accepted-runtime'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const request = Object.freeze({ moveId: 'surf', sourceId: 'source', targetIds: ['target'], visualSeed: 42 })

function harness({ assetLoader = () => Promise.resolve(Texture.WHITE), build, deadlineMs = 6000 } = {}) {
  const timelines = [], built = [], scenes = [], instances = []
  const fx = createClockedBattleFx({
    now: () => 1234,
    createFx: options => {
      const runtime = createBattleFx({ ...options, deadlineMs, glowTexture: Texture.WHITE, assetLoader, effects: {
        surf: { duration: 1, build(context) {
          built.push(context)
          if (build) return build(context)
          context.layer.addChild(new Graphics().rect(0, 0, 10, 10).fill(0xffffff))
          context.tl.to(context.source.pose, { x: 20, duration: 0.8, ease: 'none' }, 0)
            .call(() => context.onCue({ type: 'impact' }), [], 0.4)
          context.onFrame(() => { context.scene.frameGeometry = context.source.pose.x })
        } },
      } })
      const dispose = runtime.dispose.bind(runtime)
      runtime.disposalCount = 0
      runtime.dispose = () => { runtime.disposalCount++; dispose() }
      instances.push(runtime)
      return runtime
    },
    timelineEngine: { timeline(options) {
      const raw = gsap.timeline({ ...options, paused: true })
      raw.playCalls = []
      raw.play = (...args) => { raw.playCalls.push(args); return raw }
      timelines.push(raw)
      return raw
    } },
  })
  function scene() {
    const value = createSceneGraph({ textures: { charizard: Texture.WHITE, venusaur: Texture.WHITE } })
    scenes.push(value)
    return value
  }
  function clean(value) {
    assert.equal(value.effects.children.length, 0)
    assert.equal(value.camera.x, 0); assert.equal(value.camera.y, 0)
    for (const actor of value.actors.values()) {
      assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0)
      assert.equal(actor.pose.rotation, 0); assert.equal(actor.pose.alpha, 1)
      assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    }
  }
  return { fx, timelines, built, instances, scene, clean, dispose() {
    fx.dispose(); for (const value of scenes) value.dispose(); gsap.ticker.sleep()
  } }
}

test('clock starts after asynchronous artwork and recipe construction, then observes updated geometry', async () => {
  const artwork = deferred(), h = harness({ assetLoader: () => artwork.promise }), scene = h.scene()
  const events = [], cues = []
  try {
    const handle = h.fx.play(request, { scene, onCue: cue => cues.push(cue), onPresentation(event) {
      assert.ok(Object.isFrozen(event))
      assert.equal(h.built.length, 1)
      if (event.type === 'frame') assert.equal(scene.frameGeometry, scene.actor('source').pose.x)
      events.push(event)
    } })
    await tick()
    assert.equal(events.length, 0); assert.equal(h.timelines.length, 0)
    artwork.resolve(Texture.WHITE)
    await tick()
    assert.deepEqual(events, [{ type: 'start', timelineSeconds: 0, observedAtMs: 1234, durationSeconds: 1, reducedMotion: false }])
    assert.deepEqual(h.timelines[0].playCalls, [[0]])
    h.timelines[0].time(0.4, false)
    assert.deepEqual(cues, [{ type: 'impact' }])
    assert.equal(events.at(-1).type, 'frame')
    assert.equal(events.at(-1).timelineSeconds, 0.4)
    h.timelines[0].time(1, false)
    assert.deepEqual(await handle.finished, { status: 'completed' })
    assert.equal(h.instances[0].disposalCount, 1)
    h.clean(scene)
  } finally { h.dispose() }
})

test('different scenes retain their own clocks when asset loads finish out of order', async () => {
  const first = deferred(), second = deferred(), loads = [first, second]
  const h = harness({ assetLoader: () => loads.shift().promise }), a = h.scene(), b = h.scene()
  const aEvents = [], bEvents = []
  try {
    const one = h.fx.play(request, { scene: a, onPresentation: value => aEvents.push(value) })
    const two = h.fx.play({ ...request, sourceId: 'target', targetIds: ['source'] }, { scene: b, onPresentation: value => bEvents.push(value) })
    second.resolve(Texture.WHITE); await tick()
    assert.equal(aEvents.length, 0); assert.equal(bEvents.length, 1)
    first.resolve(Texture.WHITE); await tick()
    assert.equal(aEvents.length, 1); assert.equal(bEvents.length, 1)
    h.timelines[0].time(0.4, false)
    assert.equal(bEvents.at(-1).timelineSeconds, 0.4)
    assert.equal(aEvents.length, 1)
    h.timelines[1].time(0.2, false)
    assert.equal(aEvents.at(-1).timelineSeconds, 0.2)
    one.cancel()
    assert.deepEqual(await one.finished, { status: 'cancelled' })
    assert.equal(b.actor('target').pose.x, 10)
    h.timelines[0].time(1, false)
    assert.deepEqual(await two.finished, { status: 'completed' })
    h.clean(a); h.clean(b)
  } finally { h.dispose() }
})

test('same-scene replacement cancels its predecessor and stale handles cannot affect the replacement', async () => {
  const h = harness(), scene = h.scene(), events = []
  try {
    const one = h.fx.play(request, { scene, onPresentation: event => events.push(['one', event.type]) })
    await tick(); h.timelines[0].time(0.2, false)
    const two = h.fx.play({ ...request, sourceId: 'target', targetIds: ['source'] }, { scene, onPresentation: event => events.push(['two', event.type]) })
    assert.deepEqual(await one.finished, { status: 'cancelled' })
    await tick(); one.cancel()
    h.timelines[1].time(0.4, false)
    assert.equal(scene.actor('source').pose.x, 0)
    assert.equal(scene.actor('target').pose.x, 10)
    h.timelines[1].time(1, false)
    assert.deepEqual(await two.finished, { status: 'completed' })
    assert.equal(events.filter(([id, type]) => id === 'two' && type === 'start').length, 1)
    h.clean(scene)
  } finally { h.dispose() }
})

test('failed construction kills the queued clock start and preserves the actual failure', async () => {
  const h = harness({ build(context) { context.source.pose.x = 42; throw new Error('construction failed') } }), scene = h.scene()
  const events = []
  try {
    const handle = h.fx.play(request, { scene, onPresentation: value => events.push(value) })
    assert.deepEqual(await handle.finished, { status: 'failed', reason: 'construction failed' })
    await tick()
    assert.deepEqual(events, []); assert.deepEqual(h.timelines[0].playCalls, [])
    h.clean(scene)
  } finally { h.dispose() }
})

test('cancelling before late artwork prevents construction and clock notifications', async () => {
  const artwork = deferred(), h = harness({ assetLoader: () => artwork.promise }), scene = h.scene(), events = []
  try {
    const handle = h.fx.play(request, { scene, onPresentation: value => events.push(value) })
    handle.cancel(); assert.deepEqual(await handle.finished, { status: 'cancelled' })
    artwork.resolve(Texture.WHITE); await tick()
    assert.deepEqual(events, []); assert.equal(h.timelines.length, 0)
    h.clean(scene)
  } finally { h.dispose() }
})

test('failed asset loads preserve their failure without producing cosmetic starts', async () => {
  const artwork = deferred(), h = harness({ assetLoader: () => artwork.promise }), scene = h.scene(), events = []
  try {
    const handle = h.fx.play(request, { scene, onPresentation: value => events.push(value) })
    artwork.reject(new Error('missing texture'))
    assert.deepEqual(await handle.finished, { status: 'failed', reason: 'missing texture' })
    assert.deepEqual(events, []); h.clean(scene)
  } finally { h.dispose() }
})

test('cosmetic observer exceptions do not change cues, completion or cleanup', async () => {
  const h = harness(), scene = h.scene(), cues = []
  let observations = 0
  try {
    const handle = h.fx.play(request, { scene, onCue: value => cues.push(value), onPresentation() { observations++; throw new Error('audio unavailable') } })
    await tick(); h.timelines[0].time(0.4, false); h.timelines[0].time(1, false)
    assert.deepEqual(await handle.finished, { status: 'completed' })
    assert.deepEqual(cues, [{ type: 'impact' }]); assert.ok(observations >= 2)
    h.clean(scene)
  } finally { h.dispose() }
})

test('a disabled observer preserves result cues and a throwing result consumer still fails normally', async () => {
  const h = harness(), scene = h.scene(), cues = []
  try {
    const good = h.fx.play(request, { scene, onCue: value => cues.push(value) })
    await tick(); h.timelines[0].time(0.4, false); h.timelines[0].time(1, false)
    assert.deepEqual(await good.finished, { status: 'completed' })
    assert.deepEqual(cues, [{ type: 'impact' }])
    const bad = h.fx.play(request, { scene, onCue() { throw new Error('result consumer failed') } })
    await tick(); h.timelines[1].time(0.4, false)
    assert.deepEqual(await bad.finished, { status: 'failed', reason: 'result consumer failed' })
    h.clean(scene)
  } finally { h.dispose() }
})

test('reduced motion reports its actual short timeline without inventing a normal-duration plan', async () => {
  const h = harness({ assetLoader() { throw new Error('Reduced motion must not load move assets') } }), scene = h.scene(), events = [], cues = []
  try {
    const handle = h.fx.play(request, { scene, reducedMotion: true, onPresentation: value => events.push(value), onCue: value => cues.push(value) })
    await tick()
    assert.deepEqual(events[0], { type: 'start', timelineSeconds: 0, observedAtMs: 1234, durationSeconds: 0.8, reducedMotion: true })
    h.timelines[0].time(0.2, false); h.timelines[0].time(0.8, false)
    assert.deepEqual(cues, [{ type: 'impact' }])
    assert.deepEqual(await handle.finished, { status: 'completed' }); h.clean(scene)
  } finally { h.dispose() }
})

test('abort, deadline and dispose cannot start a stale pending timeline', async () => {
  const artwork = deferred(), h = harness({ assetLoader: () => artwork.promise, deadlineMs: 15 })
  const a = h.scene(), b = h.scene(), c = h.scene(), events = [], controller = new AbortController()
  const options = scene => ({ scene, onPresentation: value => events.push(value) })
  try {
    const aborted = h.fx.play(request, { ...options(a), signal: controller.signal })
    controller.abort()
    assert.deepEqual(await aborted.finished, { status: 'cancelled' })
    const expired = h.fx.play(request, options(b))
    assert.deepEqual(await expired.finished, { status: 'failed', reason: 'Effect playback deadline exceeded.' })
    const disposed = h.fx.play(request, options(c))
    h.fx.dispose()
    assert.deepEqual(await disposed.finished, { status: 'cancelled' })
    assert.deepEqual(await h.fx.play(request, options(c)).finished, { status: 'cancelled' })
    artwork.resolve(Texture.WHITE); await tick()
    assert.deepEqual(events, []); assert.equal(h.timelines.length, 0)
    h.clean(a); h.clean(b); h.clean(c)
  } finally { h.dispose() }
})

test('cancellation from the start observer prevents the paused visual from playing', async () => {
  const h = harness(), scene = h.scene()
  let handle
  try {
    handle = h.fx.play(request, { scene, onPresentation(event) { if (event.type === 'start') handle.cancel() } })
    assert.deepEqual(await handle.finished, { status: 'cancelled' })
    assert.deepEqual(h.timelines[0].playCalls, []); h.clean(scene)
  } finally { h.dispose() }
})

test('unsupported and non-hit requests remain skipped without a clock or result cue', async () => {
  const h = harness(), scene = h.scene(), events = []
  try {
    for (const value of [{ ...request, moveId: 'not-a-move' }, { ...request, outcome: 'miss' }, { ...request, phase: 'prepare' }]) {
      assert.deepEqual(await h.fx.play(value, { scene, onCue: item => events.push(item), onPresentation: item => events.push(item) }).finished, { status: 'skipped' })
    }
    assert.deepEqual(events, []); assert.equal(h.timelines.length, 0); h.clean(scene)
  } finally { h.dispose() }
})

test('visual pace changes elapsed media time while preserving authored geometry and the single result cue', async () => {
  for (const visualRate of [.75, .9, 1.25]) for (const sourceId of ['source', 'target']) {
    const h = harness(), scene = h.scene(), events = [], cues = []
    try {
      const handle = h.fx.play({ ...request, sourceId, targetIds: [sourceId === 'source' ? 'target' : 'source'] }, {
        scene, visualRate, onPresentation: value => events.push(value), onCue: value => cues.push(value),
      })
      await tick()
      assert.equal(h.timelines[0].timeScale(), visualRate)
      assert.equal(events[0].durationSeconds, 1 / visualRate)
      h.timelines[0].time(.4, false)
      assert.equal(scene.actor(sourceId).pose.x, 10, 'the same authored contact geometry is reached at every pace')
      assert.equal(events.at(-1).timelineSeconds, .4 / visualRate)
      assert.deepEqual(cues, [{ type: 'impact' }])
      h.timelines[0].time(1, false)
      assert.deepEqual(await handle.finished, { status: 'completed' })
      assert.deepEqual(cues, [{ type: 'impact' }]); h.clean(scene)
    } finally { h.dispose() }
  }
})

test('invalid rates never construct a visual and cancelling a paced run clears its owned presentation', async () => {
  const h = harness(), scene = h.scene(), events = []
  try {
    for (const visualRate of [0, -.9, .74, 1.26, NaN, Infinity, '0.9', null]) {
      assert.equal((await h.fx.play(request, { scene, visualRate }).finished).status, 'failed')
    }
    assert.equal(h.timelines.length, 0)
    const handle = h.fx.play(request, { scene, visualRate: .9, onPresentation: value => events.push(value) })
    await tick(); h.timelines[0].time(.4, false)
    handle.cancel(); assert.deepEqual(await handle.finished, { status: 'cancelled' })
    const count = events.length
    await tick()
    assert.equal(events.length, count); h.clean(scene)
  } finally { h.dispose() }
})

test('accepted production pacing preserves all six original recipes and result cues from either perspective', async () => {
  const sample = actor => ({ x: actor.pose.x, y: actor.pose.y, rotation: actor.pose.rotation,
    scaleX: actor.pose.scale.x, scaleY: actor.pose.scale.y, alpha: actor.pose.alpha })
  for (const plan of Object.values(ACCEPTED_SFX_RUNTIME_CATALOG.moves)) for (const sourceId of ['source', 'target']) {
    let baseline
    for (const visualRate of [1, plan.visualRate]) {
      const scene = createSceneGraph({ textures: { charizard: Texture.WHITE, venusaur: Texture.WHITE } }), timelines = [], events = [], cues = [], snapshots = []
      const fx = createClockedBattleFx({ glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
        timelineEngine: { timeline(vars) {
          const raw = gsap.timeline({ ...vars, paused: true }); raw.play = () => raw; timelines.push(raw); return raw
        } },
      })
      try {
        const handle = fx.play({ moveId: plan.fxId, sourceId, targetIds: [sourceId === 'source' ? 'target' : 'source'], visualSeed: 42 }, {
          scene, visualRate, onCue: cue => cues.push({ type: cue.type, authoredTime: timelines[0].time() }), onPresentation: event => events.push(event),
        })
        await tick()
        const raw = timelines[0]
        assert.equal(raw.timeScale(), visualRate, plan.moveId)
        assert.equal(events[0].durationSeconds, plan.visualDurationSeconds / visualRate)
        for (const at of [...new Set(plan.segments.map(segment => segment.cueSeconds))].sort((a, b) => a - b)) {
          raw.time(at, false)
          snapshots.push([...scene.actors.values()].map(sample))
          assert.equal(events.at(-1).timelineSeconds, at / visualRate)
        }
        raw.time(raw.duration(), false)
        assert.deepEqual(await handle.finished, { status: 'completed' })
        assert.equal(cues.filter(cue => cue.type === 'impact').length, 1, `${plan.moveId} still has one result impact`)
        const outcome = { cues, snapshots }
        if (baseline) assert.deepEqual(outcome, baseline, `${plan.moveId} keeps its original contacts and cosmetic positions`)
        else baseline = outcome
        assert.equal(scene.effects.children.length, 0)
        for (const actor of scene.actors.values()) assert.deepEqual(sample(actor), { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 })
      } finally { fx.dispose(); scene.dispose(); gsap.ticker.sleep() }
    }
  }
})
