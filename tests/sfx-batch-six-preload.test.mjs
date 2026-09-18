import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Sprite, Texture, TextureSource } from 'pixi.js'
import { gsap } from 'gsap'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'
import { BATCH_SIX_EFFECTS } from '../apps/sfx-bench/src/batchSixVisual.js'
import { BATCH_SIX_V2_EFFECTS, createBatchSixV2Fx } from '../apps/sfx-bench/src/batchSixVisualV2.js'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import { loadMoveAssets } from '../packages/battle-fx/src/assets.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const request = (moveId = 'ancient-power', sourceId = 'source') => ({ moveId, sourceId, targetIds: [sourceId === 'source' ? 'target' : 'source'], visualSeed: 42 })
const texture = () => new Texture({ source: new TextureSource({ width: 12, height: 12 }) })
function clean(scene) {
  assert.equal(scene.effects.children.length, 0)
  assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
  for (const actor of scene.actors.values()) {
    assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.tint, 0xffffff)
  }
}
function harness({ assetLoader, deadlineMs = 6000, failBuild = false, failFrame = false } = {}) {
  const scene = createSceneGraph(), timelines = [], calls = [], builds = [], events = []
  const shared = texture()
  function probe(moveId) {
    return context => {
      events.push(`build:${moveId}`); builds.push({ moveId, context })
      const sprite = new Sprite(moveId === 'ancient-power' ? context.assets.rock : Texture.WHITE)
      sprite.label = 'preload-probe'; context.layer.addChild(sprite)
      context.source.pose.x = 19
      if (failBuild) throw new Error('probe build failed')
      if (failFrame) context.onFrame(() => { throw new Error('probe frame failed') })
      context.tl.to(context.source.pose, { x: 0, duration: .6 }, 0).call(() => context.onCue({ type: 'impact' }), [], .2)
    }
  }
  const effects = { ...BATCH_SIX_V2_EFFECTS,
    'ancient-power': { ...BATCH_SIX_V2_EFFECTS['ancient-power'], duration: .6, contact: .2, build: probe('ancient-power') },
    'tri-attack': { ...BATCH_SIX_V2_EFFECTS['tri-attack'], duration: .6, contact: .2, build: probe('tri-attack') },
    'meteor-mash': { ...BATCH_SIX_V2_EFFECTS['meteor-mash'], duration: .6, contact: .2, build: probe('meteor-mash') },
  }
  const load = (key, url) => { calls.push([key, url]); events.push(`load:${key}`); return assetLoader ? assetLoader(key, url, shared) : Promise.resolve(shared) }
  const timelineEngine = { timeline(options) {
    events.push('timeline')
    const timeline = gsap.timeline({ ...options, paused: true }); timeline.playCalls = []
    timeline.play = (...args) => { timeline.playCalls.push(args); events.push('play'); return timeline }; timelines.push(timeline); return timeline
  } }
  const factory = options => createBatchSixV2Fx({ ...options, effects, deadlineMs, glowTexture: Texture.WHITE, assetLoader: load })
  const fx = factory({ timelineEngine })
  const audition = createSyncVisualAuditioner({ createFx: factory, timelineEngine, now: () => 1000 })
  return { scene, shared, fx, audition, timelines, calls, builds, events,
    dispose() { audition.dispose(); fx.dispose(); scene.dispose(); gsap.ticker.sleep(); assert.equal(shared.destroyed, false); assert.equal(shared.source.destroyed, false); shared.destroy(true) },
  }
}

test('only the three revised descriptors change; kept and unrelated builders retain their exact original identities', () => {
  const revised = new Set(['leaf-blade', 'ancient-power', 'sacred-fire'])
  for (const [id, effect] of Object.entries(BATCH_SIX_EFFECTS)) {
    if (revised.has(id)) assert.notEqual(BATCH_SIX_V2_EFFECTS[id].build, effect.build)
    else assert.equal(BATCH_SIX_V2_EFFECTS[id], effect)
    if (!['leaf-blade', 'tri-attack', 'meteor-mash', 'ancient-power', 'sacred-fire'].includes(id)) assert.equal(BATCH_SIX_V2_EFFECTS[id], MOVE_EFFECTS[id])
  }
  assert.ok(Object.isFrozen(BATCH_SIX_V2_EFFECTS))
})

test('actual Rock Slide asset loading completes before the review timeline or audio scheduling observer starts', async () => {
  const pending = deferred(), h = harness({ assetLoader: () => pending.promise }), starts = []
  try {
    const expected = [], originalTexture = texture()
    await loadMoveAssets('rock-slide', (key, url) => { expected.push([key, url]); return originalTexture })
    originalTexture.destroy(true)
    const run = h.audition.play({ fxId: 'ancient-power', visual: { durationSeconds: .6, markers: [] } }, { scene: h.scene,
      onStart(value) { h.events.push('audio'); starts.push(value); assert.equal(h.builds[0].context.assets.rock, h.shared) } })
    await tick()
    assert.deepEqual(h.calls, expected); assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], 'rock')
    assert.match(h.calls[0][1], /\/packages\/battle-fx\/assets\/rock\.svg$/)
    assert.deepEqual(h.timelines, []); assert.deepEqual(h.builds, []); assert.deepEqual(starts, []); clean(h.scene)
    pending.resolve(h.shared); await tick()
    assert.equal(h.shared.source.scaleMode, 'nearest')
    assert.deepEqual(h.events, ['load:rock', 'timeline', 'build:ancient-power', 'audio', 'play'])
    assert.equal(starts.length, 1); assert.deepEqual(h.timelines[0].playCalls, [[0]])
    h.timelines[0].time(.6, false); assert.equal((await run.finished).status, 'completed'); clean(h.scene)
    assert.equal(h.shared.destroyed, false); assert.equal(h.shared.source.destroyed, false)
  } finally { h.dispose() }
})

test('cancellation during loading settles immediately and a late successful texture cannot start a clock or borrow poses', async () => {
  for (const sourceId of ['source', 'target']) {
    const pending = deferred(), h = harness({ assetLoader: () => pending.promise })
    try {
      const run = h.fx.play(request('ancient-power', sourceId), { scene: h.scene })
      let result; run.finished.then(value => { result = value })
      run.cancel(); await tick()
      assert.deepEqual(result, { status: 'cancelled' }); clean(h.scene)
      pending.resolve(h.shared); await tick()
      assert.deepEqual(h.timelines, []); assert.deepEqual(h.builds, []); clean(h.scene)
      run.cancel(); assert.deepEqual(await run.finished, result)
    } finally { h.dispose() }
  }
})

test('superseding between pending rocks and kept move types cancels only the old run on the same scene', async () => {
  for (const direction of ['rock-to-kept', 'kept-to-rock']) {
    const pending = deferred(), h = harness({ assetLoader: () => pending.promise })
    try {
      const first = h.fx.play(request(direction === 'rock-to-kept' ? 'ancient-power' : 'tri-attack'), { scene: h.scene })
      await tick()
      const next = h.fx.play(request(direction === 'rock-to-kept' ? 'meteor-mash' : 'ancient-power', 'target'), { scene: h.scene })
      assert.equal((await first.finished).status, 'cancelled'); await tick()
      if (direction === 'kept-to-rock') clean(h.scene)
      pending.resolve(h.shared); await tick()
      assert.equal(h.builds.filter(x => x.moveId === 'ancient-power').length, direction === 'rock-to-kept' ? 0 : 1)
      assert.equal(h.timelines.length, direction === 'rock-to-kept' ? 1 : 2)
      assert.equal(h.scene.actor('target').pose.x, 19)
      first.cancel(); assert.equal(h.scene.actor('target').pose.x, 19, 'stale handles cannot reset the replacement actor')
      h.timelines.at(-1).time(.6, false); assert.equal((await next.finished).status, 'completed'); clean(h.scene)
    } finally { h.dispose() }
  }
})

test('separate scenes share one cached rock load without cancelling one another or destroying the shared texture', async () => {
  const pending = deferred(), h = harness({ assetLoader: () => pending.promise }), other = createSceneGraph()
  try {
    const first = h.fx.play(request(), { scene: h.scene }), second = h.fx.play(request(), { scene: other })
    assert.equal(h.calls.length, 1)
    first.cancel(); assert.equal((await first.finished).status, 'cancelled')
    pending.resolve(h.shared); await tick()
    assert.equal(h.timelines.length, 1); assert.equal(h.builds[0].context.scene, other); clean(h.scene)
    h.timelines[0].time(.6, false); assert.equal((await second.finished).status, 'completed'); clean(other)
    const third = h.fx.play(request(), { scene: h.scene }); await tick()
    assert.equal(h.calls.length, 1, 'later plays reuse the resolved cache entry')
    h.timelines[1].time(.6, false); assert.equal((await third.finished).status, 'completed'); clean(h.scene)
    assert.equal(h.shared.destroyed, false)
  } finally { other.dispose(); h.dispose() }
})

test('aborted and disposed pending runs settle safely while pre-aborted, disposed, skipped and reduced runs never fetch rocks', async () => {
  for (const mode of ['abort-before', 'abort-pending', 'dispose-before', 'dispose-pending', 'miss', 'prepare', 'reduced']) {
    const pending = deferred(), h = harness({ assetLoader: () => pending.promise }), aborter = new AbortController(), cues = []
    try {
      if (mode === 'abort-before') aborter.abort()
      if (mode === 'dispose-before') h.fx.dispose()
      const run = h.fx.play({ ...request(), ...(mode === 'miss' ? { outcome: 'miss' } : {}), ...(mode === 'prepare' ? { phase: 'prepare' } : {}) },
        { scene: h.scene, signal: aborter.signal, reducedMotion: mode === 'reduced', onCue: cue => cues.push(cue.type) })
      if (mode === 'abort-pending') aborter.abort()
      if (mode === 'dispose-pending') h.fx.dispose()
      await tick()
      assert.equal(h.calls.length, mode.endsWith('-pending') ? 1 : 0)
      if (mode === 'reduced') {
        assert.equal(h.builds.length, 0); h.timelines[0].time(.8, false)
        assert.equal((await run.finished).status, 'completed'); assert.deepEqual(cues, ['impact'])
      } else assert.equal((await run.finished).status, ['miss', 'prepare'].includes(mode) ? 'skipped' : 'cancelled')
      clean(h.scene); pending.resolve(h.shared); await tick()
      assert.equal(h.timelines.length, mode === 'reduced' ? 1 : 0); clean(h.scene)
    } finally { h.dispose() }
  }
})

test('load failures resolve cleanly and can retry; builder or frame failures release the loaded texture without destroying it', async () => {
  const pending = deferred(); let attempt = 0
  const h = harness({ assetLoader: (key, url, shared) => ++attempt === 1 ? pending.promise : Promise.resolve(shared) })
  try {
    const first = h.fx.play(request(), { scene: h.scene }); pending.reject(new Error('rock image failed'))
    assert.deepEqual(await first.finished, { status: 'failed', reason: 'rock image failed' }); clean(h.scene); assert.equal(h.timelines.length, 0)
    const retry = h.fx.play(request(), { scene: h.scene }); await tick()
    assert.equal(h.calls.length, 2); assert.equal(h.timelines.length, 1)
    h.timelines[0].time(.6, false); assert.equal((await retry.finished).status, 'completed'); clean(h.scene)
  } finally { h.dispose() }
  for (const mode of ['failBuild', 'failFrame']) {
    const h = harness({ [mode]: true })
    try {
      const run = h.fx.play(request(), { scene: h.scene }); await tick()
      if (mode === 'failFrame') h.timelines[0].time(.1, false)
      const result = await run.finished
      assert.equal(result.status, 'failed'); assert.match(result.reason, /probe (?:build|frame) failed/); clean(h.scene)
      assert.equal(h.shared.destroyed, false)
    } finally { h.dispose() }
  }
})

test('a loading timeout ignores late assets and a successful slow load receives the normal independent playback deadline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = deferred(), h = harness({ assetLoader: () => pending.promise, deadlineMs: 100 })
  try {
    const run = h.fx.play(request(), { scene: h.scene })
    t.mock.timers.tick(100); await tick()
    assert.equal((await run.finished).status, 'failed'); clean(h.scene)
    pending.resolve(h.shared); await tick(); assert.equal(h.timelines.length, 0)
  } finally { h.dispose() }
  const loading = deferred(), next = harness({ assetLoader: () => loading.promise, deadlineMs: 100 })
  try {
    const run = next.fx.play(request(), { scene: next.scene }); let result
    run.finished.then(value => { result = value })
    t.mock.timers.tick(80); loading.resolve(next.shared); await tick()
    assert.equal(next.timelines.length, 1); assert.equal(result, undefined)
    t.mock.timers.tick(25); await tick()
    assert.equal(result, undefined, 'the finished loading deadline cannot cancel healthy playback after only 25 ms')
    t.mock.timers.tick(75); await tick()
    assert.equal(result.status, 'failed'); assert.match(result.reason, /playback deadline/i); clean(next.scene)
  } finally { next.dispose() }
})

test('non-Error asset rejections settle promptly without unhandled failures, including after pending cancellation', async () => {
  for (const error of [null, undefined, 'image unavailable']) {
    const pending = deferred(), h = harness({ assetLoader: () => pending.promise })
    try {
      const run = h.fx.play(request(), { scene: h.scene }); let result
      run.finished.then(value => { result = value })
      pending.reject(error); await tick()
      assert.deepEqual(result, { status: 'failed', reason: String(error) })
      assert.equal(h.timelines.length, 0); clean(h.scene)
    } finally { h.dispose() }
  }
  const pending = deferred(), h = harness({ assetLoader: () => pending.promise })
  try {
    const run = h.fx.play(request(), { scene: h.scene }); run.cancel()
    pending.reject(null); await tick()
    assert.deepEqual(await run.finished, { status: 'cancelled' }); assert.equal(h.timelines.length, 0); clean(h.scene)
  } finally { h.dispose() }
})
