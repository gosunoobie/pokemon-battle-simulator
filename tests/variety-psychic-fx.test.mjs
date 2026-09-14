import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS, FX_CATALOG } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const cases = [
  ['psywave', .30, .90, 2.15, 'emission'], ['extrasensory', .42, 1.04, 2.35, 'eyes'],
  ['psycho-boost', .96, 1.30, 2.65, 'emission'], ['beat-up', .94, 1.26, 2.35, 'hand'],
  ['dizzy-punch', null, .70, 1.95, 'fist'],
]
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
const visibleAlpha = node => { let alpha = 1; for (let n = node; n; n = n.parent) alpha *= n.alpha; return alpha }
function harness(reverse = false, edge = 0, custom = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const scene = createSceneGraph({ width, height, actors: [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32], ...(custom ? { origin: [.43, .93], emission: [.64, .23], eyes: [.43, .17], fist: [.38, .39], hand: [.68, .48] } : {}) } },
    { id: 'target', profile: 'tall', x: reverse ? (edge === 2 ? .055 : .26) : (edge === 2 ? .945 : .74),
      y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: reverse ? 1 : -1,
      anchors: { center: edge === 3 ? [.5, .04] : [.48, .44], ...(custom ? { origin: [.56, .89], center: [.37, .31] } : {}) } },
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
  const tip = h.node(id + '-tip'), impact = h.node(id + '-impact'), target = h.scene.actor('target').anchor('center')
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


const attachment = (source, desired) => desired === 'eyes' ? source.hasAnchor('eyes') ? 'eyes' : 'emission' : desired === 'fist' ? source.hasAnchor('fist') ? 'fist' : 'hand' : desired

test('five independent psychic and abstract strike recipes have one catalog entry and their authored timings', () => {
  for (const [id, , contact, duration] of cases) {
    assert.equal(FX_CATALOG.filter(move => move.id === id).length, 1)
    assert.deepEqual(EFFECT_TIMINGS[id], { contact, duration })
  }
})

test('all five visible fronts meet the target before one cue and clean normal, reduced and cancelled playback', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id, release, contact, duration, desired] of cases) {
      const cues = [], run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => { checkCue(h, id, cue); cues.push(cue.type) } })
      await tick(); h.tl.time(release ?? .24, false)
      const source = h.scene.actor('source'), socket = source.anchor(attachment(source, desired))
      close(h.point(h.node(id + '-root')), socket, id + ' root follows source socket')
      if (release != null) close(h.point(h.node(id + '-tip')), socket, id + ' release starts at source socket')
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

test('Beat Up shows separate allied strike marks but emits only its final impact cue', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse), cues = []
    try {
      const run = h.fx.play({ moveId: 'beat-up', sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => cues.push(cue.type) })
      await tick()
      for (const [i, time] of [[0, .62], [1, .84], [2, 1.06]]) {
        h.tl.time(time, false); assert.deepEqual(cues, [])
        const hit = h.node(`beat-up-cosmetic-impact-${i}`), mark = h.node(`beat-up-ally-strike-${i}`)
        close(h.point(hit), h.scene.actor('target').anchor('center'), 'cosmetic strike reaches receiver')
        assert.ok(visibleAlpha(hit) > .6); assert.ok(visibleAlpha(mark) > .6)
      }
      h.tl.time(1.26, false); assert.deepEqual(cues, ['impact']); checkCue(h, 'beat-up', { type: 'impact' })
      await complete(h, run, 2.35); assert.deepEqual(cues, ['impact'])
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('all new artwork and rotated actors fit normal, upper, side and portrait fields from either direction', async () => {
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

test('custom eyes, emission, hand and fist sockets stay live through source poses and moving target contact', async () => {
  for (const reverse of [false, true]) for (const custom of [false, true]) {
    const h = harness(reverse, 0, custom), source = h.scene.actor('source'), target = h.scene.actor('target')
    try { for (const [id, release, contact, duration, desired] of cases) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => checkCue(h, id, cue) })
      await tick(); h.tl.time(.12, false)
      // Dizzy Punch authors its own physical pose; the ranged recipes also follow externally posed sources.
      if (id !== 'dizzy-punch') { source.pose.x = reverse ? -7 : 7; source.pose.y = -10; source.pose.rotation = .023 }
      target.pose.x = reverse ? 7 : -7; target.pose.y = -6; target.pose.rotation = -.018
      h.tl.time(release ?? .36, false)
      close(h.point(h.node(id + '-root')), source.anchor(attachment(source, desired)), id + ' custom source socket')
      if (release != null) close(h.point(h.node(id + '-tip')), source.anchor(attachment(source, desired)), id + ' posed release')
      h.tl.time(contact - .025, false)
      target.pose.x = reverse ? 4 : -4; target.pose.y = -11; target.pose.rotation = .019
      h.tl.time(contact, false); close(h.point(h.node(id + '-root')), source.anchor(attachment(source, desired)), id + ' live contact root')
      assertBounds(h, id + ' posed contact')
      h.tl.time(contact + .2, false); close(h.point(h.node(id + '-root')), source.anchor(attachment(source, desired)), id + ' recovery attachment')
      await complete(h, run, duration)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('all five aftermaths continue moving and Beat Up debris descends in world coordinates', async () => {
  const flows = [['psywave', 'psywave-mote-0', 1.4, 1.7], ['extrasensory', 'extrasensory-glint-0', 1.6, 1.9],
    ['psycho-boost', 'psycho-boost-fragment-27', 1.9, 2.1], ['beat-up', 'beat-up-chip-20', 1.7, 1.9, true],
    ['dizzy-punch', 'dizzy-punch-star-0', 1.15, 1.45]]
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
