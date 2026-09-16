import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { createImpactPlayback, impactPosition } from '../apps/simulation/src/impactPlayback.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

function manualTimers() {
  let nextId = 0
  const pending = new Map(), history = new Map()
  return {
    pending, history,
    setTimeout(callback, delay) {
      const id = ++nextId, job = { callback, delay }
      pending.set(id, job); history.set(id, job)
      return id
    },
    clearTimeout(id) { pending.delete(id) },
    fire(id) {
      const job = pending.get(id)
      assert.ok(job, `Timer ${id} is pending`)
      pending.delete(id); job.callback()
    },
    late(id) { history.get(id).callback() },
  }
}
function harness(options = {}) {
  const timers = manualTimers(), values = []
  const playback = createImpactPlayback({ timers, onFeedback: value => values.push(value), ...options })
  return { timers, values, playback }
}
const cue = (actorId = 'target') => Object.freeze({ key: 'event-12-impact', kind: 'super-effective', actorId, label: 'Super effective!', damageText: '−82 HP' })
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} vs ${expected}`)

test('normal completion and every cancellation path remove feedback, timer and abort listener exactly once', async t => {
  for (const path of ['completed', 'abort', 'skip', 'clear', 'destroy']) await t.test(path, async () => {
    const h = harness(), controller = new AbortController(), feedback = cue()
    const handle = h.playback.play(feedback, { signal: controller.signal })
    const timerId = [...h.timers.pending.keys()][0]
    assert.equal(h.values.length, 1)
    assert.equal(h.timers.history.get(timerId).delay, 1100)
    assert.equal(getEventListeners(controller.signal, 'abort').length, 1)

    if (path === 'completed') h.timers.fire(timerId)
    else if (path === 'abort') controller.abort()
    else if (path === 'skip') handle.cancel()
    else h.playback[path]()

    assert.deepEqual(await handle.finished, { status: path === 'completed' ? 'completed' : 'cancelled' })
    assert.deepEqual(h.values, [h.values[0], null])
    assert.equal(h.timers.pending.size, 0)
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
    handle.cancel(); h.playback.clear(); h.playback.destroy(); controller.abort(); h.timers.late(timerId)
    assert.equal(h.values.length, 2, 'Repeated cleanup and an already-queued timeout publish nothing')
    assert.deepEqual(feedback, cue(), 'Presentation never modifies the supplied cue')
  })
})

test('a cancelled old timer and old handle cannot clear a replacement on the other field side', async () => {
  const h = harness(), oldController = new AbortController(), nextController = new AbortController()
  const old = h.playback.play(cue('source'), { signal: oldController.signal })
  const oldTimer = [...h.timers.pending.keys()][0]
  const next = h.playback.play(cue('target'), { signal: nextController.signal })
  const nextTimer = [...h.timers.pending.keys()][0], nextOverlay = h.values.at(-1)
  assert.deepEqual(await old.finished, { status: 'cancelled' })
  assert.equal(getEventListeners(oldController.signal, 'abort').length, 0)
  assert.equal(nextOverlay.actorId, 'target')
  assert.notEqual(h.values[0].key, nextOverlay.key)
  const published = h.values.length
  h.timers.late(oldTimer); old.cancel(); oldController.abort()
  assert.equal(h.values.length, published)
  assert.equal(h.values.at(-1), nextOverlay)
  assert.deepEqual([...h.timers.pending.keys()], [nextTimer])
  assert.equal(getEventListeners(nextController.signal, 'abort').length, 1)
  h.timers.fire(nextTimer)
  assert.deepEqual(await next.finished, { status: 'completed' })
  assert.equal(h.values.at(-1), null)
  assert.equal(getEventListeners(nextController.signal, 'abort').length, 0)
})

test('disposed or pre-aborted playback never publishes a new overlay or schedules a timer', async () => {
  const h = harness(), controller = new AbortController()
  controller.abort()
  const aborted = h.playback.play(cue(), { signal: controller.signal })
  assert.deepEqual(await aborted.finished, { status: 'cancelled' })
  assert.equal(h.values.length, 0)
  assert.equal(h.timers.history.size, 0)
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  h.playback.destroy()
  for (const request of [cue(), null]) {
    const handle = h.playback.play(request)
    handle.cancel()
    assert.deepEqual(await handle.finished, { status: 'cancelled' })
  }
  assert.equal(h.values.length, 0)
  assert.equal(h.timers.history.size, 0)
})

test('reduced motion uses its shorter lifetime and repeated identical cues receive distinct render keys', async () => {
  const h = harness(), feedback = cue(), keys = new Set()
  for (const reducedMotion of [false, true, true]) {
    const handle = h.playback.play(feedback, { reducedMotion })
    const overlay = h.values.at(-1), timerId = [...h.timers.pending.keys()][0]
    assert.equal(overlay.reducedMotion, reducedMotion)
    assert.equal(overlay.durationMs, reducedMotion ? 800 : 1100)
    assert.equal(h.timers.pending.get(timerId).delay, overlay.durationMs)
    assert.equal(overlay.label, feedback.label)
    assert.equal(overlay.damageText, feedback.damageText)
    keys.add(overlay.key)
    h.timers.fire(timerId)
    assert.deepEqual(await handle.finished, { status: 'completed' })
  }
  assert.equal(keys.size, 3, 'The Vue animation key changes even when the event key repeats')
  assert.equal(feedback.key, 'event-12-impact')
})

test('throwing scene providers and feedback callbacks cannot prevent completion or subsequent playback', async () => {
  const published = [], h = harness({
    getScene() { throw new Error('Renderer unavailable') },
    onFeedback(value) { published.push(value); throw new Error('Optional UI failed') },
  })
  for (const actorId of ['source', 'target']) {
    const handle = h.playback.play(cue(actorId))
    const overlay = published.at(-1)
    assert.equal(overlay.x, actorId === 'source' ? .25 : .75)
    assert.equal(overlay.y, actorId === 'source' ? .57 : .4)
    h.timers.fire([...h.timers.pending.keys()][0])
    assert.deepEqual(await handle.finished, { status: 'completed' })
    assert.equal(published.at(-1), null)
    assert.equal(h.timers.pending.size, 0)
  }
  assert.doesNotThrow(() => h.playback.destroy())
})

test('impact positions use the posed visual center, clamp edges and fall back safely for unavailable geometry', () => {
  let requestedAnchor
  const scene = { width: 1000, height: 450, actor: () => ({ anchor(name) { requestedAnchor = name; return { x: 420, y: 126 } } }) }
  assert.deepEqual(impactPosition(scene, 'target'), { x: .42, y: .28 })
  assert.equal(requestedAnchor, 'visualCenter')
  scene.actor = () => ({ anchor: () => ({ x: -200, y: 900 }) })
  assert.deepEqual(impactPosition(scene, 'source'), { x: 0, y: 1 })
  scene.actor = () => ({ anchor: () => ({ x: 1200, y: -45 }) })
  assert.deepEqual(impactPosition(scene, 'target'), { x: 1, y: 0 })
  for (const broken of [null, { ...scene, width: 0 }, { ...scene, height: -1 },
    { ...scene, actor: () => null }, { ...scene, actor() { throw new Error('Actor removed') } },
    { ...scene, actor: () => ({ anchor: () => ({ x: NaN, y: Infinity }) }) },
    { ...scene, actor: () => ({ anchor() { throw new Error('Destroyed display tree') } }) },
    { ...scene, effects: {}, root: { toLocal: () => ({ x: Infinity, y: 40 }) } },
  ]) {
    assert.deepEqual(impactPosition(broken, 'source'), { x: .25, y: .57 })
    assert.deepEqual(impactPosition(broken, 'target'), { x: .75, y: .4 })
  }
})

test('real Pixi positions include contact pose and camera offsets while cancelling viewport fitting for both sides', () => {
  for (const [width, height] of [[1000, 450], [560, 700]]) {
    const specs = [
      { id: 'source', profile: 'tall', x: .25, y: .82, height: .38, facing: 1, anchors: { center: [.15, .9] } },
      { id: 'target', profile: 'wide', x: .75, y: .6, height: .22, facing: -1, anchors: { center: [.9, .2] } },
    ]
    const scene = createSceneGraph({ width, height, actors: specs })
    try {
      scene.camera.position.set(-17, 9)
      // An effect-layer transform must be converted back to root coordinates too.
      scene.effects.position.set(8, -6); scene.effects.scale.set(.9, 1.05)
      for (const [index, spec] of specs.entries()) {
        const actor = scene.actor(spec.id), angle = index ? -.14 : .11
        actor.pose.position.set(index ? -19 : 23, -14)
        actor.pose.rotation = angle; actor.pose.scale.set(1.07, .96)
        const halfHeight = actor.metrics.height / 2 * .96
        const expected = {
          x: (spec.x * width + actor.pose.x + halfHeight * Math.sin(angle) - 17) / width,
          y: (spec.y * height + actor.pose.y - halfHeight * Math.cos(angle) + 9) / height,
        }
        const originalPose = { x: actor.pose.x, y: actor.pose.y, rotation: actor.pose.rotation, sx: actor.pose.scale.x, sy: actor.pose.scale.y }
        for (const viewport of [[390, 620], [1200, 380]]) {
          scene.fit(...viewport)
          assert.ok(scene.root.x !== 0 || scene.root.y !== 0, 'Exercise letterboxing, not just a unit transform')
          const point = impactPosition(scene, spec.id)
          close(point.x, expected.x, `${spec.id} x in ${width}×${height}, viewport ${viewport}`)
          close(point.y, expected.y, `${spec.id} y in ${width}×${height}, viewport ${viewport}`)
        }
        assert.deepEqual({ x: actor.pose.x, y: actor.pose.y, rotation: actor.pose.rotation, sx: actor.pose.scale.x, sy: actor.pose.scale.y }, originalPose)
      }
      assert.equal(scene.effects.children.length, 0, 'Position lookup creates no display objects')
    } finally { scene.dispose() }
  }
})
