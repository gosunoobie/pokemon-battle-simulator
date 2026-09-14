import test from 'node:test'
import assert from 'node:assert/strict'
import { Container, Sprite, Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS, FX_CATALOG } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const cases = [
  ['sand-attack', .22, .68, 1.95, 'emission'], ['mud-slap', .28, .64, 1.85, 'hand'],
  ['mud-shot', .24, .60, 1.90, 'emission'],
  ['magnitude', .38, 1.12, 2.55, 'floor'], ['mirror-move', .36, .98, 2.15, 'emission'],
  ['sketch', .38, 1.08, 2.35, 'hand'], ['transform', .78, 1.36, 2.60, 'emission'],
]
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
const visibleAlpha = node => { let alpha = 1; for (let n = node; n; n = n.parent) alpha *= n.alpha; return alpha }
function harness(reverse = false, edge = 0, custom = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const scene = createSceneGraph({ width, height, actors: [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32], ...(custom ? { origin: [.43, .93], emission: [.64, .23], eyes: [.43, .17], floor: [.43, .95], hand: [.68, .48] } : {}) } },
    { id: 'target', profile: 'tall', x: reverse ? (edge === 2 ? .055 : .26) : (edge === 2 ? .945 : .74),
      y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: reverse ? 1 : -1,
      anchors: { center: edge === 3 ? [.5, .04] : [.48, .44], ...(custom ? { origin: [.56, .89], center: [.37, .31], floor: [.56, .94] } : {}) } },
  ] })
  const fx = createBattleFx({ glowTexture: Texture.WHITE, timelineEngine: {
    timeline(options) { return timeline = gsap.timeline({ ...options, paused: true }) },
  } })
  return { scene, fx, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node), dispose() { fx.dispose(); scene.dispose() } }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
  for (const actor of h.scene.actors.values()) {
    for (const key of ['x', 'y', 'rotation']) assert.equal(actor.pose[key], 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    assert.equal(actor.pose.tint, 0xffffff)
  }
}
function assertBounds(h, label) {
  const { width, height } = h.scene
  for (const actor of h.scene.actors.values()) {
    const p = actor.anchor('visualCenter'), c = Math.abs(Math.cos(actor.pose.rotation)), s = Math.abs(Math.sin(actor.pose.rotation))
    const rx = (actor.metrics.width * c + actor.metrics.height * s) / 2, ry = (actor.metrics.height * c + actor.metrics.width * s) / 2
    assert.ok(p.x - rx >= -.05 && p.x + rx <= width + .05 && p.y - ry >= -.05 && p.y + ry <= height + .05, label + ' complete actor bounds')
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  }
  let seen = 0
  function walk(node, alpha = 1) {
    assert.ok(node.alpha >= 0 && node.alpha <= 1, label + ' valid alpha')
    const visible = alpha * node.alpha
    if (visible > .03 && ['Graphics', 'Sprite'].includes(node.constructor.name)) {
      const b = node.getBounds(); seen++
      assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= width + .05 && b.y + b.height <= height + .05,
        `${label} ${node.label}: ${JSON.stringify(b)}`)
    }
    for (const child of node.children ?? []) walk(child, visible)
  }
  walk(h.scene.effects)
  return seen
}
function checkCue(h, id, cue) {
  assert.equal(cue.type, 'impact')
  const tip = h.node(id + '-tip'), impact = h.node(id + '-impact'), target = receiver(h, id)
  assert.ok(tip && impact, id + ' exposes visible contact artwork')
  close(h.point(tip), target, id + ' front reaches the live target before the cue')
  close(h.point(impact), target, id + ' impact is positioned before the cue')
  assert.ok(visibleAlpha(tip) > .6, id + ' visible front at contact')
}
async function complete(h, run, duration) {
  h.tl.time(duration, false)
  const result = await run.finished
  assert.equal(result.status, 'completed', result.reason)
  clean(h)
}


const receiver = (h, id) => h.scene.actor(id === 'transform' ? 'source' : 'target').anchor(id === 'magnitude' ? 'floor' : 'center')
const launch = (h, id, desired) => h.scene.actor(id === 'transform' ? 'target' : 'source').anchor(id === 'transform' ? 'center' : desired)

test('seven retained earth and copy recipes have unique catalog entries and independent authored timings', () => {
  for (const [id, , contact, duration] of cases) {
    assert.equal(FX_CATALOG.filter(move => move.id === id).length, 1)
    assert.deepEqual(EFFECT_TIMINGS[id], { contact, duration })
  }
})

test('all seven release from live roots, update visible contact before one cue, and clean normal, reduced and cancelled runs', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id, release, contact, duration, desired] of cases) {
      const cues = [], run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => { checkCue(h, id, cue); cues.push(cue.type) } })
      await tick(); h.tl.time(release, false)
      close(h.point(h.node(id + '-root')), h.scene.actor('source').anchor(desired), id + ' source root')
      close(h.point(h.node(id + '-tip')), launch(h, id, desired), id + ' visible release')
      h.tl.time(contact - .001, false); assert.deepEqual(cues, [])
      h.tl.time(contact, false); assert.deepEqual(cues, ['impact'])
      await complete(h, run, duration); assert.deepEqual(cues, ['impact'])
      for (const at of [.17, contact + .12]) {
        const cancelled = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene }); await tick()
        h.tl.time(at, false); cancelled.cancel(); assert.equal((await cancelled.finished).status, 'cancelled'); clean(h)
      }
      const reducedCues = [], reduced = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene, reducedMotion: true, onCue: cue => reducedCues.push(cue.type) })
      await tick(); await complete(h, reduced, .8); assert.deepEqual(reducedCues, ['impact'])
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('complete effect contours and unchanged actors fit both sides in wide, tall, upper, side and portrait layouts', async () => {
  for (const reverse of [false, true]) for (const edge of [0, 1, 2, 3, 4]) {
    const h = harness(reverse, edge)
    try { for (const [id, , , duration] of cases) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => checkCue(h, id, cue) })
      await tick(); let seen = 0
      for (let time = .04; time < duration - .02; time += .029) { h.tl.time(time, false); seen += assertBounds(h, `${id} reverse${reverse} edge${edge} t${time}`) }
      assert.ok(seen > 0, id + ' visible art'); await complete(h, run, duration)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('custom emission, hand, floor and center anchors remain live through posed actors and target motion', async () => {
  for (const reverse of [false, true]) for (const custom of [false, true]) {
    const h = harness(reverse, 0, custom), source = h.scene.actor('source'), target = h.scene.actor('target')
    try { for (const [id, release, contact, duration, desired] of cases) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => checkCue(h, id, cue) })
      await tick(); h.tl.time(.12, false)
      source.pose.x = reverse ? -7 : 7; source.pose.y = -10; source.pose.rotation = .023
      target.pose.x = reverse ? 7 : -7; target.pose.y = -6; target.pose.rotation = -.018
      if (id === 'transform') { h.tl.time(.24, false); close(h.point(h.node('transform-scan-tip')), source.anchor('emission'), 'outward scan starts at supplied live emission') }
      h.tl.time(release, false)
      close(h.point(h.node(id + '-root')), source.anchor(desired), id + ' custom source socket')
      close(h.point(h.node(id + '-tip')), launch(h, id, desired), id + ' posed release')
      h.tl.time(contact - .025, false)
      target.pose.x = reverse ? 4 : -4; target.pose.y = -11; target.pose.rotation = .019
      source.pose.x = reverse ? -11 : 11; source.pose.y = -13
      h.tl.time(contact, false); close(h.point(h.node(id + '-root')), source.anchor(desired), id + ' live contact root')
      assertBounds(h, id + ' posed contact')
      h.tl.time(contact + .2, false); close(h.point(h.node(id + '-root')), source.anchor(desired), id + ' recovery attachment')
      await complete(h, run, duration)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('earth debris descends in world coordinates and every aftermath continues moving through its fade', async () => {
  const flows = [
    ['sand-attack', 'sand-attack-dust-11', 1.35, 1.55, true], ['mud-slap', 'mud-slap-drop-17', 1.15, 1.35, true],
    ['mud-shot', 'mud-shot-fleck-23', 1.15, 1.35, true],
    ['magnitude', 'magnitude-rock-24', 1.94, 2.09, true], ['mirror-move', 'mirror-move-shard-13', 1.46, 1.67],
    ['sketch', 'sketch-fleck-14', 1.87, 2.04], ['transform', 'transform-mote-19', 2.04, 2.24],
  ]
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id, label, first, second, down] of flows) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene }); await tick()
      h.tl.time(first, false); const node = h.node(label), p = h.point(node); assert.ok(visibleAlpha(node) > .02, label + ' visible')
      h.tl.time(second, false); const q = h.point(node); assert.ok(visibleAlpha(node) > .02, label + ' visible through fade')
      assert.ok(Math.hypot(q.x - p.x, q.y - p.y) > .2, label + ' moving through fade')
      if (down) assert.ok(q.y > p.y + .1, label + ' world-down debris')
      await complete(h, run, EFFECT_TIMINGS[id].duration)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('Transform samples the provided opponent artwork, owns only its clone, and retains shared textures on completion and cancellation', async () => {
  for (const reverse of [false, true]) for (const cancel of [false, true]) {
    const h = harness(reverse)
    try {
      const target = h.scene.actor('target'), original = target.snapshot, texture = Texture.WHITE
      let count = 0, clone
      target.snapshot = () => {
        count++; clone = new Container(); const image = new Sprite(texture); image.label = 'provided-target-test-art'
        image.position.set(-29, -90); image.width = 58; image.height = 90; clone.addChild(image); return clone
      }
      const run = h.fx.play({ moveId: 'transform', sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => checkCue(h, 'transform', cue) })
      await tick(); h.tl.time(1.58, false)
      assert.equal(count, 1); assert.equal(h.node('transform-supplied-silhouette'), clone)
      assert.ok(visibleAlpha(clone) > .2); assert.ok(h.node('provided-target-test-art')); assertBounds(h, 'supplied Transform snapshot')
      assert.equal(h.node('transform-outline'), null)
      if (cancel) { run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h) }
      else await complete(h, run, 2.6)
      assert.equal(clone.destroyed, true); assert.notEqual(texture.destroyed, true); assert.notEqual(texture.source.destroyed, true)
      target.snapshot = original
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('Transform has an owned symbolic silhouette fallback without snapshot support and preserves the supplied actor identity', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse), target = h.scene.actor('target'), source = h.scene.actor('source')
    try {
      target.snapshot = undefined
      const run = h.fx.play({ moveId: 'transform', sourceId: 'source', targetIds: ['target'] }, { scene: h.scene, onCue: cue => checkCue(h, 'transform', cue) })
      await tick(); h.tl.time(1.58, false)
      const outline = h.node('transform-outline'); assert.ok(outline); assert.ok(visibleAlpha(outline) > .2)
      assertBounds(h, 'fallback Transform outline'); assert.equal(h.scene.actor('source'), source); assert.equal(h.scene.actor('target'), target)
      await complete(h, run, 2.6); assert.equal(outline.destroyed, true)
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})
