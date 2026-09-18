import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import leafBlade, { timing } from '../packages/battle-fx/src/review-batch-six-v2/leaf-blade.js'
import previous, { timing as previousTiming } from '../packages/battle-fx/src/review-batch-six/leaf-blade.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const near = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
const fixtures = [
  undefined,
  { width: 720, height: 600, actors: [
    { id: 'source', profile: 'wide', x: .24, y: .86, height: .24, facing: 1 },
    { id: 'target', profile: 'tall', x: .78, y: .48, height: .24, facing: -1 },
  ] },
  { width: 620, height: 650, actors: [
    { id: 'source', profile: 'wide', x: .30, y: .78, height: .20, facing: 1 },
    { id: 'target', profile: 'tall', x: .79, y: .45, height: .20, facing: -1 },
  ] },
  { width: 900, height: 520, actors: [
    { id: 'source', profile: 'wide', x: .22, y: .87, height: .20, facing: 1 },
    { id: 'target', profile: 'tall', x: .935, y: .29, height: .23, facing: -1 },
  ] },
  { width: 900, height: 520, actors: [
    { id: 'source', profile: 'tall', x: .27, y: .90, height: .47, facing: 1, anchors: { blade: [.37, .44] } },
    { id: 'target', profile: 'wide', x: .75, y: .27, height: .23, facing: -1, anchors: { blade: [.69, .54] } },
  ] },
]
function harness(sourceId = 'source', fixture = 0, builder = leafBlade) {
  const scene = createSceneGraph(fixtures[fixture])
  let timeline
  const fx = createBattleFx({ glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    effects: { 'leaf-blade': { ...MOVE_EFFECTS['leaf-blade'], build: builder, ...timing } },
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } },
  })
  const targetId = sourceId === 'source' ? 'target' : 'source'
  return { scene, fx, source: scene.actor(sourceId), target: scene.actor(targetId), get tl() { return timeline },
    play(onCue, reducedMotion = false) { return fx.play({ moveId: 'leaf-blade', sourceId, targetIds: [targetId], visualSeed: 41 }, { scene, onCue, reducedMotion }) },
    node: label => scene.effects.getChildByLabel(label, true),
    point: (node, local = { x: 0, y: 0 }) => scene.effects.toLocal(local, node),
    dispose() { fx.dispose(); scene.dispose(); gsap.ticker.sleep() },
  }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
  for (const actor of h.scene.actors.values()) {
    assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.tint, 0xffffff)
  }
}
function contact(h, index) {
  const tip = h.node('leaf-blade-review-tip'), slash = h.node(`leaf-blade-review-slash-${index}`)
  near(h.point(tip), h.point(slash), 'the drawn rearward blade tip physically meets the slash center')
  const point = h.point(tip), center = h.target.anchor('visualCenter')
  assert.ok(Math.abs(point.x - center.x) <= h.target.metrics.width / 2 + .05 && Math.abs(point.y - center.y) <= h.target.metrics.height / 2 + .05,
    `physical contact is inside the visible opponent: ${JSON.stringify(point)} / ${JSON.stringify(center)}`)
}
function bounded(h) {
  let visible = 0
  const check = (b, label) => assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
    `${label} at ${h.tl.time()}: ${JSON.stringify(b)}`)
  for (const actor of h.scene.actors.values()) {
    const center = actor.anchor('visualCenter'), cos = Math.abs(Math.cos(actor.pose.rotation)), sin = Math.abs(Math.sin(actor.pose.rotation))
    const width = actor.metrics.width * cos + actor.metrics.height * sin, height = actor.metrics.height * cos + actor.metrics.width * sin
    check({ x: center.x - width / 2, y: center.y - height / 2, width, height }, actor.id)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  }
  function walk(node, alpha = 1) {
    const opacity = alpha * node.alpha
    assert.ok(node.alpha >= 0 && node.alpha <= 1, `${node.label} valid alpha`)
    if (opacity > .03 && node.constructor.name === 'Graphics') {
      const b = node.getBounds()
      if (b.width > 0 && b.height > 0) { visible++; check(b, node.label) }
    }
    for (const child of node.children ?? []) walk(child, opacity)
  }
  walk(h.scene.effects)
  return visible
}
function screenLean(h, graphic) {
  const a = h.point(graphic, { x: -10, y: 0 }), b = h.point(graphic, { x: 10, y: 0 })
  return (b.y - a.y) / (b.x - a.x)
}

const graphicsData = graphic => graphic.context.instructions.map(instruction => ({ action: instruction.action,
  style: Object.fromEntries(['color', 'alpha', 'width', 'alignment', 'cap', 'join', 'miterLimit'].map(key => [key, instruction.data.style?.[key]])),
  path: instruction.data.path?.instructions,
}))
function snapshot(h) {
  const actors = [...h.scene.actors.values()].map(actor => ({ id: actor.id, x: actor.pose.x, y: actor.pose.y, rotation: actor.pose.rotation,
    scale: [actor.pose.scale.x, actor.pose.scale.y], alpha: actor.pose.alpha, tint: actor.pose.tint }))
  const nodes = []
  function walk(node) {
    nodes.push({ label: node.label, x: node.x, y: node.y, rotation: node.rotation, alpha: node.alpha, scale: [node.scale.x, node.scale.y],
      graphics: node.constructor.name === 'Graphics' && !['leaf-blade-review-curved-leaf', 'leaf-blade-review-edge-glow'].includes(node.label) ? graphicsData(node) : null })
    for (const child of node.children ?? []) walk(child)
  }
  walk(h.scene.effects)
  return { actors, camera: [h.scene.camera.x, h.scene.camera.y], nodes }
}
const fillContains = (g, x, y) => g.context.instructions.filter(i => i.action === 'fill').some(i =>
  i.data.path.shapePath.shapePrimitives.some(p => p.shape.contains(x, y)))
function curveY(x, first, second, end) {
  let low = 0, high = 1
  for (let i = 0; i < 35; i++) {
    const t = (low + high) / 2, s = 1 - t
    const q = 3 * s * s * t * first[0] + 3 * s * t * t * second[0] + t * t * t * end[0]
    if (q > x) low = t; else high = t
  }
  const t = (low + high) / 2, s = 1 - t
  return 3 * s * s * t * first[1] + 3 * s * t * t * second[1] + t * t * t * end[1]
}

test('Leaf Blade v2 preserves the frozen original review, contact markers and every non-blade source section', async () => {
  const old = await readFile(new URL('../packages/battle-fx/src/review-batch-six/leaf-blade.js', import.meta.url), 'utf8')
  const current = await readFile(new URL('../packages/battle-fx/src/review-batch-six-v2/leaf-blade.js', import.meta.url), 'utf8')
  assert.equal(createHash('sha256').update(old).digest('hex'), '0ffe1e4b36ab9d1f9dfbd3c144df791c034ff981352024f294909f8afc058d7f')
  assert.equal(current.split('  function outline(g)')[0], old.split('  function outline(g)')[0], 'the contact solver, bounds and poses are byte-identical')
  assert.equal(current.slice(current.indexOf('  const grip =')), old.slice(old.indexOf('  const grip =')), 'grip, particles, updates and timeline are byte-identical')
  assert.deepEqual(timing, previousTiming)
  assert.deepEqual(timing.markers.map(marker => marker.timeSeconds), [.81, 1.69, 2.56])
  assert.equal(timing.contact, 2.56); assert.equal(timing.duration, 4.2)
  assert.deepEqual(EFFECT_TIMINGS['leaf-blade'], { contact: .82, duration: 1.95 })
  assert.notEqual(leafBlade, previous); assert.notEqual(leafBlade, MOVE_EFFECTS['leaf-blade'].build)
})

test('the green fill stops at the old curved center vein, retaining the upper crescent, white edge, root and tip', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId), old = harness(sourceId, 0, previous)
    try {
      const run = h.play(), before = old.play(); await tick()
      h.tl.time(.4, false); old.tl.time(.4, false)
      const leaf = h.node('leaf-blade-review-curved-leaf'), oldLeaf = old.node('leaf-blade-review-curved-leaf')
      const length = -h.node('leaf-blade-review-tip').x
      assert.equal(leaf.context.instructions.filter(i => i.action === 'fill').length, 1, 'the lower dark green filled face is removed')
      assert.ok(leaf.context.instructions.some(i => i.action === 'stroke' && i.data.style.color === 0xf8fff0), 'the white blade edge remains')
      const firstPath = leaf.context.instructions.find(i => i.action === 'fill').data.path.instructions
      const oldFirstPath = oldLeaf.context.instructions.find(i => i.action === 'fill').data.path.instructions
      assert.deepEqual(firstPath.slice(0, 2), oldFirstPath.slice(0, 2), 'the original upper contour and its sharp tip are unchanged')
      const veins = leaf.context.instructions.filter(i => i.action === 'stroke' && i.data.style.color === 0xc8ed9c)
      assert.equal(veins.length, 4)
      for (const vein of veins) {
        const [move, line] = vein.data.path.instructions
        for (const command of [move, line]) {
          const [x, y] = command.data
          const edgeY = curveY(x / length, [-.24, -.06], [-.6, -.3], [-1, -.14]) * length
          assert.ok(y <= edgeY + .001, 'surviving vein segments do not extend into the removed half')
        }
      }
      let retained = 0, removed = 0
      for (let x = -.90; x < -.10; x += .027) {
        const upper = curveY(x, [-.09, -.22], [-.48, -.48], [-1, -.14])
        const middle = curveY(x, [-.24, -.06], [-.6, -.3], [-1, -.14])
        const y = (upper + middle) / 2
        assert.ok(fillContains(oldLeaf, x * length, y * length)); assert.ok(fillContains(leaf, x * length, y * length)); retained++
        for (let y = middle + .035; y < .1; y += .026) {
          if (!fillContains(oldLeaf, x * length, y * length)) continue
          assert.equal(fillContains(leaf, x * length, y * length), false, 'all sampled old lower interior is now empty'); removed++
        }
      }
      assert.ok(retained > 20 && removed > 60)
      near(h.point(h.node('leaf-blade-review-tip')), old.point(old.node('leaf-blade-review-tip')), 'the actual point stays in place')
      assert.deepEqual(graphicsData(h.node('leaf-blade-review-grip')), graphicsData(old.node('leaf-blade-review-grip')))
      run.cancel(); before.cancel(); assert.equal((await run.finished).status, 'cancelled'); assert.equal((await before.finished).status, 'cancelled')
      clean(h); clean(old)
    } finally { h.dispose(); old.dispose() }
  }
})

test('both perspectives preserve every sampled pose, slash, cross and particle while keeping two true contacts and full bounds', async () => {
  for (const sourceId of ['source', 'target']) for (let fixture = 0; fixture < fixtures.length; fixture++) {
    const h = harness(sourceId, fixture), old = harness(sourceId, fixture, previous), cues = [], oldCues = []
    try {
      const run = h.play(cue => cues.push(cue.type)), before = old.play(cue => oldCues.push(cue.type)); await tick()
      const times = [.81, 1.69, 2.56]
      for (let t = .01; t < timing.duration; t += .019) times.push(t)
      times.sort((a, b) => a - b)
      let visible = 0
      for (const time of times) {
        h.tl.time(time, false); old.tl.time(time, false)
        assert.deepEqual(snapshot(h), snapshot(old), `only the blade fill/edge drawing may differ at ${sourceId}/${fixture}/${time}`)
        visible += bounded(h)
        const blade = h.node('leaf-blade-review-blade')
        near(h.point(blade), h.source.anchor(blade.attachmentSocket), 'the blade remains rooted')
        if (time === .81 || time === 1.69) { contact(h, time === .81 ? 1 : 2); assert.deepEqual(cues, []) }
        if (time === 2.56) {
          assert.deepEqual(cues, ['impact']); assert.equal(h.node('leaf-blade-review-cross').alpha, 1)
          assert.ok(screenLean(h, h.node('leaf-blade-review-cross-1')) < -.5 && screenLean(h, h.node('leaf-blade-review-cross-2')) > .5)
        }
      }
      assert.ok(visible > 200); assert.deepEqual(cues, oldCues)
      h.tl.time(timing.duration, false); old.tl.time(timing.duration, false)
      assert.equal((await run.finished).status, 'completed'); assert.equal((await before.finished).status, 'completed'); clean(h); clean(old)
    } finally { h.dispose(); old.dispose() }
  }
})

test('cancelling either strike or the cross tail restores actors, and reduced motion still emits one cue', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId)
    try {
      for (const time of [.25, .83, 1.72, 2.60, 3.80]) {
        const cues = [], run = h.play(cue => cues.push(cue.type)); await tick()
        h.tl.time(time, false); run.cancel()
        assert.equal((await run.finished).status, 'cancelled'); assert.deepEqual(cues, time < timing.contact ? [] : ['impact']); clean(h)
      }
      const cues = [], run = h.play(cue => cues.push(cue.type), true); await tick()
      h.tl.time(.8, false)
      assert.equal((await run.finished).status, 'completed'); assert.deepEqual(cues, ['impact']); clean(h)
    } finally { h.dispose() }
  }
})
