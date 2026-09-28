import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Container, Graphics } from 'pixi.js'
import { gsap } from 'gsap'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createHazardDisplay, playConditionReaction } from '@battle/battle-fx/conditions'

const kinds = ['spikes', 'poison', 'burn', 'leech-seed', 'sleep', 'paralysis', 'freeze', 'confusion', 'cure', 'blocked', 'boost', 'unboost']
function harness(options = {}) {
  const scene = createSceneGraph(options), timelines = []
  scene.hazardSlots = { near: { x: 246, y: 346, rx: 173, ry: 38 }, far: { x: 746, y: 267, rx: 143, ry: 31 } }
  const sibling = new Graphics().circle(10, 10, 5).fill(0xff0000); scene.effects.addChild(sibling)
  const engine = { timeline(options) { const result = gsap.timeline({ ...options, paused: true }); timelines.push(result); return result } }
  return { scene, timelines, sibling, play(kind, actorId = 'source', options = {}) {
    return playConditionReaction({ kind, actorId, visualSeed: 41 }, { scene, timelineEngine: engine, ...options })
  } }
}
const pose = actor => ({ x: actor.pose.x, y: actor.pose.y, rotation: actor.pose.rotation, sx: actor.pose.scale.x, sy: actor.pose.scale.y, alpha: actor.pose.alpha, visible: actor.root.visible })

test('every condition reaction supports both sides and restores only its owned artwork', async () => {
  const h = harness()
  try {
    for (const actorId of ['source', 'target']) for (const kind of kinds) {
      const actor = h.scene.actor(actorId)
      actor.pose.position.set(9, -4); actor.pose.rotation = .05
      const before = pose(actor), run = h.play(kind, actorId), timeline = h.timelines.at(-1)
      assert.ok(timeline, `${kind} starts`)
      timeline.time(.3, false)
      const layer = h.scene.effects.getChildByLabel(`condition-${kind}`)
      assert.ok(layer && layer.children.length === 1)
      assert.ok(layer.getBounds().width > 0, `${kind} draws visible geometry`)
      assert.deepEqual(pose(actor), before)
      timeline.time(.64, false)
      assert.deepEqual(await run.finished, { status: 'completed' })
      assert.deepEqual(h.scene.effects.children, [h.sibling]); assert.deepEqual(pose(actor), before)
    }
  } finally { h.scene.dispose() }
})

test('reduced motion is a brief stationary wash and does not erase persistent hazards', async () => {
  const h = harness(), display = createHazardDisplay({ scene: h.scene })
  display.update([{ side: 'near', layers: 3 }])
  const hazard = h.scene.terrain.getChildByLabel('persistent-spikes')
  for (const kind of kinds) {
    const run = h.play(kind, 'target', { reducedMotion: true }), timeline = h.timelines.at(-1)
    timeline.time(.1, false)
    const art = h.scene.effects.getChildByLabel(`condition-${kind}-art`, true), before = art.getBounds()
    timeline.time(.15, false)
    assert.deepEqual(art.getBounds(), before)
    timeline.time(.22, false); assert.equal((await run.finished).status, 'completed')
    assert.equal(hazard.destroyed, false)
  }
  display.destroy(); h.scene.dispose()
})

test('reaction cancellation, abort, replacement, scene disposal and timeout clear only owned art', async () => {
  for (const mode of ['cancel', 'abort', 'replace', 'dispose', 'timeout', 'throw']) {
    const h = harness(), controller = new AbortController()
    const run = h.play('poison', 'source', { signal: controller.signal, deadlineMs: 5,
      ...(mode === 'throw' ? { timelineEngine: { timeline() { throw new Error('unavailable') } } } : {}) })
    let second
    if (mode === 'cancel') run.cancel()
    if (mode === 'abort') controller.abort()
    if (mode === 'replace') second = h.play('cure')
    if (mode === 'dispose') h.scene.dispose()
    assert.equal((await run.finished).status, ['timeout', 'throw'].includes(mode) ? 'failed' : 'cancelled')
    if (mode !== 'dispose') {
      assert.equal(h.sibling.destroyed, false)
      second?.cancel(); assert.deepEqual(h.scene.effects.children, [h.sibling]); h.scene.dispose()
    }
  }
})

test('invalid conditions and absent actors are optional and do not interrupt a current reaction', async () => {
  const h = harness(), run = h.play('burn'), layer = h.scene.effects.getChildByLabel('condition-burn')
  for (const request of [{ kind: 'unknown', actorId: 'source' }, { kind: 'poison', actorId: 'missing' }, { kind: '__proto__', actorId: 'source' }]) {
    assert.equal((await playConditionReaction(request, { scene: h.scene }).finished).status, 'skipped')
    assert.equal(layer.destroyed, false)
  }
  assert.equal((await playConditionReaction({ kind: 'poison', actorId: 'source' }, { scene: {} }).finished).status, 'skipped')
  const controller = new AbortController(); controller.abort()
  assert.equal((await h.play('poison', 'source', { signal: controller.signal }).finished).status, 'cancelled')
  assert.equal(layer.destroyed, false); run.cancel(); h.scene.dispose()
})

test('Spikes artwork preserves fixed slots through actor motion and changes only with public layer updates', () => {
  const h = harness(), display = createHazardDisplay({ scene: h.scene })
  display.update([{ side: 'near', layers: 1 }, { side: 'far', layers: 2 }])
  const layer = h.scene.terrain.getChildByLabel('persistent-spikes'), near = layer.getChildByLabel('spikes-near-1')
  const initial = near.getBounds()
  h.scene.actor('source').pose.position.set(99, -20); h.scene.actor('source').pose.scale.set(2)
  display.update([{ side: 'near', layers: 1 }, { side: 'far', layers: 2 }])
  assert.equal(layer.getChildByLabel('spikes-near-1'), near)
  assert.deepEqual(near.getBounds(), initial)
  assert.equal(h.timelines.length, 0)
  display.update([{ side: 'far', layers: 3 }])
  assert.equal(near.destroyed, true)
  assert.equal(layer.children.length, 1); assert.equal(layer.children[0].label, 'spikes-far-3')
  display.update([]); assert.equal(layer.children.length, 0)
  display.destroy(); display.destroy(); assert.equal(layer.destroyed, true)
  assert.equal(h.scene.terrain.children.length, 2); assert.equal(h.sibling.destroyed, false)
  h.scene.dispose()
})

test('hazard display tolerates unavailable terrain and parent destruction', () => {
  const display = createHazardDisplay({ scene: {} }); display.update([{ side: 'near', layers: 3 }]); display.destroy()
  const h = harness(), attached = createHazardDisplay({ scene: h.scene })
  attached.update([{ side: 'near', layers: 1 }]); h.scene.dispose()
  attached.update([{ side: 'far', layers: 2 }]); attached.destroy()
})

test('reaction contours fit edge actors in landscape, portrait and small fields', async () => {
  for (const [width, height] of [[1000, 450], [560, 700], [160, 90]]) {
    const h = harness({ width, height, actors: [
      { id: 'source', profile: 'charizard', x: .02, y: .06, height: .3, facing: 1 },
      { id: 'target', profile: 'venusaur', x: .98, y: .98, height: .3, facing: -1 },
    ] })
    for (const actorId of ['source', 'target']) for (const kind of kinds) {
      const run = h.play(kind, actorId), timeline = h.timelines.at(-1)
      for (const time of [.08, .22, .43, .59]) {
        timeline.time(time, false)
        const bounds = h.scene.effects.getChildByLabel(`condition-${kind}`).getBounds()
        assert.ok(bounds.minX >= 0 && bounds.minY >= 0 && bounds.maxX <= width && bounds.maxY <= height,
          `${kind} ${actorId} ${width}×${height}: ${JSON.stringify(bounds)}`)
      }
      timeline.time(.64, false); assert.equal((await run.finished).status, 'completed')
    }
    h.scene.dispose()
  }
})
