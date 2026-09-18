import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS, EFFECT_TIMINGS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import previousEruption, { ERUPTION_ARRIVALS as previousArrivals, ERUPTION_VOLLEY_ARRIVALS as previousVolley, timing as previousTiming } from '../packages/battle-fx/src/review-batch-five-v2/eruption.js'
import eruption, { ERUPTION_ARRIVALS, ERUPTION_VOLLEY_ARRIVALS, timing } from '../packages/battle-fx/src/review-batch-five-v4/eruption.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} / ${expected}`)
const closePoint = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .005, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
const layouts = {
  default: undefined,
  portrait: { width: 620, height: 650, actors: [
    { id: 'source', profile: 'wide', x: .29, y: .78, height: .2, facing: 1 },
    { id: 'target', profile: 'tall', x: .8, y: .44, height: .2, facing: -1 },
  ] },
  tall: { width: 560, height: 720, actors: [
    { id: 'source', profile: 'tall', x: .2, y: .8, height: .26, facing: 1 },
    { id: 'target', profile: 'wide', x: .73, y: .42, height: .18, facing: -1 },
  ] },
  anchored: { width: 1000, height: 700, actors: [
    { id: 'source', profile: 'wide', x: .3, y: .78, height: .22, facing: 1, anchors: { vent: [.5, .5], center: [.5, .5] } },
    { id: 'target', profile: 'tall', x: .74, y: .55, height: .24, facing: -1, anchors: { vent: [.5, .5], center: [.5, .5] } },
  ] },
}
function harness(sourceId = 'source', layout = 'default', previous = false) {
  let timeline
  const scene = createSceneGraph(layouts[layout]), targetId = sourceId === 'source' ? 'target' : 'source'
  const fx = createBattleFx({ effects: { eruption: { ...MOVE_EFFECTS.eruption, build: previous ? previousEruption : eruption, duration: timing.duration, contact: timing.contact } },
    glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } } })
  return { scene, sourceId, targetId, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node),
    run(options = {}) { return fx.play({ moveId: 'eruption', sourceId, targetIds: [targetId], visualSeed: 42 }, { scene, ...options }) },
    dispose() { fx.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
  for (const actor of h.scene.actors.values()) {
    assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.tint, 0xffffff)
  }
}
function bounds(h, time) {
  let seen = 0
  const walk = (node, parentAlpha = 1) => {
    const alpha = parentAlpha * node.alpha
    if (alpha > .02 && ['Sprite', 'Graphics'].includes(node.constructor.name)) {
      const b = node.getBounds()
      assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
        `${node.label || node.parent?.label}/${h.sourceId} at ${time}: ${JSON.stringify(b)}`)
      seen++
    }
    for (const child of node.children ?? []) walk(child, alpha)
  }
  walk(h.scene.effects)
  for (const actor of h.scene.actors.values()) {
    const center = actor.anchor('visualCenter'), rx = actor.metrics.width / 2, ry = actor.metrics.height / 2
    assert.ok(center.x - rx >= -.05 && center.x + rx <= h.scene.width + .05 && center.y - ry >= -.05 && center.y + ry <= h.scene.height + .05,
      `actor ${actor.id} during ${h.sourceId} at ${time} in ${h.scene.width}x${h.scene.height}: ${JSON.stringify({ center, rx, ry })}`)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  }
  return seen
}

test('every Eruption lava layer doubles width and height while volley count, arrival clocks and all other artwork sizes stay unchanged', async () => {
  assert.deepEqual(ERUPTION_ARRIVALS, previousArrivals)
  assert.deepEqual(ERUPTION_VOLLEY_ARRIVALS, previousVolley)
  assert.deepEqual(timing, previousTiming)
  assert.deepEqual(EFFECT_TIMINGS.eruption, { contact: 1.11, duration: 2.85 })
  assert.notEqual(MOVE_EFFECTS.eruption.build, eruption)
  for (const sourceId of ['source', 'target']) {
    const current = harness(sourceId), previous = harness(sourceId, 'default', true)
    try {
      const currentRun = current.run(), previousRun = previous.run(); await tick()
      const lavaChildren = current.node('move-artwork').children.filter(node => /^eruption-review-lava-\d+$/.test(node.label))
      assert.equal(lavaChildren.length, previousVolley.length)
      for (const [index] of previousVolley.entries()) {
        const a = current.node(`eruption-review-lava-${index + 1}`), b = previous.node(`eruption-review-lava-${index + 1}`)
        assert.equal(a.children.length, 3); assert.equal(b.children.length, 3)
        a.children.forEach((sprite, layer) => {
          near(sprite.width, b.children[layer].width * 2, 'doubled layer width')
          near(sprite.height, b.children[layer].height * 2, 'doubled layer height')
          assert.equal(sprite.tint, b.children[layer].tint)
          assert.equal(sprite.alpha, b.children[layer].alpha)
          assert.equal(sprite.blendMode, b.children[layer].blendMode)
        })
      }
      for (const label of ['eruption-review-vent', 'eruption-review-receiver', 'eruption-review-fleck-0-0']) {
        near(current.node(label).width, previous.node(label).width, 'other artwork width')
        near(current.node(label).height, previous.node(label).height, 'other artwork height')
      }
      currentRun.cancel(); previousRun.cancel(); await currentRun.finished; await previousRun.finished; clean(current); clean(previous)
    } finally { current.dispose(); previous.dispose() }
  }
})

test('the enlarged volley retains each exact arrival, continuous moving flight and its one result cue', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId), cues = []
    try {
      const run = h.run({ onCue(cue) {
        cues.push([cue.type, h.tl.time()])
        closePoint(h.point(h.node('eruption-review-lava-1')), h.point(h.node('eruption-review-fleck-0-0')), 'first collision and debris are ready before the result')
      } }); await tick(); assert.equal(h.tl.duration(), 4.75)
      for (const [index, arrive] of ERUPTION_VOLLEY_ARRIVALS.entries()) {
        h.tl.time(arrive - .001, false); assert.ok(h.node(`eruption-review-lava-${index + 1}`).alpha > .9, 'lava is visible before its existing arrival')
        h.tl.time(arrive, false)
        assert.equal(h.node(`eruption-review-lava-${index + 1}`).alpha, 0, 'lava collides at its existing arrival')
        closePoint(h.point(h.node(`eruption-review-lava-${index + 1}`)), h.point(h.node(`eruption-review-fleck-${index}-0`)), 'debris begins at the lava collision')
      }
      assert.deepEqual(cues, [['impact', .94]])
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      const replay = h.run(); await tick()
      for (let time = .66; time < 3.5; time += .071) {
        h.tl.time(time, false)
        const visible = ERUPTION_VOLLEY_ARRIVALS.map((arrive, i) => ({ arrive, node: h.node(`eruption-review-lava-${i + 1}`) })).filter(item => item.node.alpha > .1)
        assert.ok(visible.length >= 3, `continuous volley at ${time}`)
        const moving = visible.find(item => item.arrive > time + .06), point = h.point(moving.node)
        h.tl.time(time + .02, false)
        assert.ok(Math.hypot(point.x - h.point(moving.node).x, point.y - h.point(moving.node).y) > .05, 'live lava keeps traveling between sound crests')
      }
      replay.cancel(); await replay.finished; clean(h)
    } finally { h.dispose() }
  }
})

test('lava launch sockets and target destinations remain dynamic after enlargement', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId, 'anchored'), control = harness(sourceId, 'anchored')
    try {
      const run = h.run(), other = control.run(); await tick()
      h.scene.actor(sourceId).pose.x += 14
      h.scene.actor(h.targetId).pose.y += 8
      const firstLaunch = ERUPTION_VOLLEY_ARRIVALS[0] - .66
      h.tl.time(firstLaunch, false); control.tl.time(firstLaunch, false)
      const a = h.point(h.node('eruption-review-lava-1')), b = control.point(control.node('eruption-review-lava-1'))
      near(a.x - b.x, 14, 'launch follows changed source anatomy')
      near(a.y - b.y, 0, 'source horizontal change preserves world height')
      h.tl.time(timing.contact, false); control.tl.time(timing.contact, false)
      const impact = h.point(h.node('eruption-review-lava-1')), normal = control.point(control.node('eruption-review-lava-1'))
      near(impact.y - normal.y, 8, 'arrival follows changed target anatomy')
      run.cancel(); other.cancel(); await run.finished; await other.finished; clean(h); clean(control)
    } finally { h.dispose(); control.dispose() }
  }
})

test('doubled Eruption contours stay inside wide and portrait fields in both perspectives, then clean up on every exit', async () => {
  for (const sourceId of ['source', 'target']) for (const layout of ['default', 'portrait', 'tall']) {
    const h = harness(sourceId, layout)
    try {
      const run = h.run(); await tick(); let seen = 0
      for (let time = .02; time < timing.duration - .01; time += .027) { h.tl.time(time, false); seen += bounds(h, time) }
      assert.ok(seen > 1000)
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      for (const time of [.4, 2.1, 4.2]) {
        const cancelled = h.run(); await tick(); h.tl.time(time, false); cancelled.cancel()
        assert.equal((await cancelled.finished).status, 'cancelled'); clean(h)
      }
      const stale = h.run(); await tick(); h.tl.time(2.1, false)
      const reduced = h.run({ reducedMotion: true }); assert.equal((await stale.finished).status, 'cancelled'); await tick(); stale.cancel()
      h.tl.time(.8, false); assert.equal((await reduced.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})
