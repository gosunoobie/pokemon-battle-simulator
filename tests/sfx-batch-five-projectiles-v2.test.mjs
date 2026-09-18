import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS, EFFECT_TIMINGS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import sludgeBomb, { timing as sludgeTiming } from '../packages/battle-fx/src/review-batch-five-v2/sludge-bomb.js'
import earthquake, { timing as quakeTiming } from '../packages/battle-fx/src/review-batch-five-v2/earthquake.js'
import bubbleBeam, { timing as bubbleTiming } from '../packages/battle-fx/src/review-batch-five-v2/bubble-beam.js'

const entries = [['sludge-bomb', sludgeBomb, sludgeTiming], ['earthquake', earthquake, quakeTiming], ['bubble-beam', bubbleBeam, bubbleTiming]]
const tick = () => new Promise(resolve => setImmediate(resolve))
const close = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .02, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
const drawing = node => JSON.stringify(node.context.instructions.map(instruction => instruction.data.path?.instructions))
function harness(sourceId = 'source', layout = 0) {
  let timeline
  const scene = createSceneGraph(layout ? { width: layout === 1 ? 560 : 720, height: layout === 1 ? 700 : 600, actors: [
    { id: 'source', profile: 'wide', x: layout === 1 ? .32 : .27, y: .81, height: layout === 1 ? .20 : .26, facing: 1, anchors: { emission: [.76, .18] } },
    { id: 'target', profile: 'tall', x: layout === 2 ? .92 : .76, y: layout === 3 ? .31 : .52, height: .19, facing: -1,
      anchors: { center: layout === 3 ? [.5, .05] : [.48, .42] } },
  ] } : {})
  const effects = Object.fromEntries(entries.map(([id, build, timing]) => [id, { ...MOVE_EFFECTS[id], build, contact: timing.contact, duration: timing.duration }]))
  const fx = createBattleFx({ effects, glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } } })
  const targetId = sourceId === 'source' ? 'target' : 'source'
  return { scene, fx, sourceId, source: scene.actor(sourceId), target: scene.actor(targetId), get tl() { return timeline },
    play(id, options = {}) { return fx.play({ moveId: id, sourceId, targetIds: [targetId], visualSeed: 42 }, { scene, ...options }) },
    node: label => scene.effects.getChildByLabel(label, true), point: node => scene.effects.toLocal({ x: 0, y: 0 }, node),
    dispose() { fx.dispose(); scene.dispose(); gsap.ticker.sleep() },
  }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0); assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
  for (const actor of h.scene.actors.values()) {
    assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.tint, 0xffffff)
  }
}
function bounds(h, id) {
  let seen = 0
  function walk(node, alpha = 1) {
    const opacity = alpha * node.alpha
    if (opacity > .025 && ['Graphics', 'Sprite'].includes(node.constructor.name)) {
      const b = node.getBounds()
      if (b.width > 0 && b.height > 0) {
        seen++
        assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
          `${id}/${h.sourceId}/${node.label}: ${JSON.stringify(b)}`)
      }
    }
    for (const child of node.children ?? []) walk(child, opacity)
  }
  walk(h.scene.effects)
  for (const actor of h.scene.actors.values()) {
    const c = actor.anchor('visualCenter'), w = actor.metrics.width / 2, height = actor.metrics.height / 2
    assert.ok(c.x - w >= -.05 && c.x + w <= h.scene.width + .05 && c.y - height >= -.05 && c.y + height <= h.scene.height + .05,
      `${id}/${h.sourceId} ${actor.id} actor silhouette at ${h.tl.time()}: ${JSON.stringify({ c, w, height, width: h.scene.width, fieldHeight: h.scene.height })}`)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  }
  return seen
}

test('second-review projectile extensions preserve all production registrations and original single-contact timing', async () => {
  for (const [id, build, timing] of entries) {
    assert.notEqual(MOVE_EFFECTS[id].build, build)
    assert.equal(timing.contact, EFFECT_TIMINGS[id].contact)
    assert.ok(timing.duration > EFFECT_TIMINGS[id].duration)
    const text = await readFile(new URL(`../packages/battle-fx/src/review-batch-five-v2/${id}.js`, import.meta.url), 'utf8')
    assert.doesNotMatch(text, /from ['"][^'"]*(?:battle-core|battle-sfx|apps\/|vue|pokemon-sprites)/)
    assert.doesNotMatch(text, /requestAnimationFrame|setInterval|setTimeout/)
  }
  assert.equal(sludgeTiming.markers.find(m => m.id === 'wet-burst-one').timeSeconds, (.17 + 2.47) * .75)
  assert.ok(Math.abs(sludgeTiming.markers.find(m => m.id === 'wet-burst-two').timeSeconds - (.17 + 2.54) * .75) < 1e-9)
  for (const [timing, soundEnd] of [[sludgeTiming, 3], [quakeTiming, 2.8], [bubbleTiming, 3.0666666666666664]]) {
    assert.ok(timing.duration / .75 > soundEnd)
    assert.ok(timing.duration / .75 - soundEnd < .25, 'extension is only a short final recovery')
  }
})

test('Sludge Bomb keeps live launch and aim, disperses visibly at contact and through its two late wet accents', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId), cues = []
    try {
      const run = h.play('sludge-bomb', { onCue(cue) {
        cues.push(cue.type)
        close(h.point(h.node('sludge-bomb-v2-ball')), h.target.anchor('center'), 'ball reaches target before result')
        close(h.point(h.node('sludge-bomb-v2-drop-0-0')), h.target.anchor('center'), 'dispersion starts at actual contact')
        assert.ok(h.node('sludge-bomb-v2-drop-0-0').alpha > .9)
      } }); await tick()
      for (const time of [.33, .36, .38]) { h.tl.time(time, false); close(h.point(h.node('sludge-bomb-v2-ball')), h.source.anchor('emission'), 'ball attachment through release') }
      h.tl.time(.8, false); h.target.pose.y = -9
      h.tl.time(1.02, false); assert.deepEqual(cues, ['impact'])
      h.tl.time(1.09, false); assert.ok(h.node('sludge-bomb-v2-wet-threads').context.instructions.length > 0)
      for (const [wave, time] of [[5, 1.98], [6, 2.0325]]) {
        h.tl.time(time - .0001, false); assert.equal(h.node(`sludge-bomb-v2-drop-${wave}-0`).alpha, 0)
        h.tl.time(time, false); assert.ok(h.node(`sludge-bomb-v2-drop-${wave}-0`).alpha > .9)
      }
      const drop = h.node('sludge-bomb-v2-drop-6-0'), ys = []
      for (const time of [2.10, 2.15, 2.20]) { h.tl.time(time, false); ys.push(h.point(drop).y) }
      assert.ok(ys[1] > ys[0] && ys[2] - ys[1] > ys[1] - ys[0], 'wet droplet falls world-down under either reflection')
      h.tl.time(2.25, false); assert.ok(drop.alpha > .2)
      assert.deepEqual(cues, ['impact'])
      h.tl.time(sludgeTiming.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('Earthquake retains its first wave and crack geometry while fresh aftershocks expand through the sound tail', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId), cues = []
    try {
      const run = h.play('earthquake', { onCue: cue => cues.push(cue.type) }); await tick()
      h.tl.time(.66, false); assert.deepEqual(cues, ['impact'])
      h.tl.time(1.94, false); const ring = h.node('earthquake-v2-wave-9'), before = drawing(ring)
      const pebble = h.node('earthquake-v2-pebble-2-9'), position = h.point(pebble)
      h.tl.time(2.04, false); assert.notEqual(drawing(ring), before)
      assert.ok(Math.hypot(h.point(pebble).x - position.x, h.point(pebble).y - position.y) > .5)
      const moving = drawing(ring); h.tl.time(2.10, false); assert.notEqual(drawing(ring), moving)
      assert.ok(ring.context.instructions.length > 0); assert.deepEqual(cues, ['impact'])
      h.tl.time(quakeTiming.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('Bubble Beam holds its live nozzle for fresh late bubbles and tracks displaced targets until each pop', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId), cues = []
    try {
      const run = h.play('bubble-beam', { onCue: cue => cues.push(cue.type) }); await tick()
      h.tl.time(.78, false); assert.deepEqual(cues, ['impact'])
      h.tl.time(.9, false); const held = h.source.anchor('emission')
      for (const [index, time] of [[24, 1.24], [36, 1.66], [43, 1.905]]) {
        h.tl.time(time, false)
        close(h.point(h.node(`bubble-beam-v2-bubble-${index}`)), h.source.anchor('emission'), 'fresh bubble uses its live launch')
        close(h.point(h.node('bubble-beam-v2-thread')), h.source.anchor('emission'), 'thin thread stays attached')
        close(h.source.anchor('emission'), held, 'source holds release until final launch')
      }
      h.target.pose.y -= 7
      h.tl.time(2.2849, false); const last = h.node('bubble-beam-v2-bubble-43'); assert.ok(last.alpha > .8)
      h.tl.time(2.285, false)
      close(h.point(last), h.point(h.node('bubble-beam-v2-pop-43')), 'last bubble arrives exactly at its live pop')
      assert.ok(Math.abs(h.point(last).x - h.target.anchor('center').x) < .02)
      assert.ok(Math.abs(h.point(last).y - h.target.anchor('center').y) <= 12)
      h.tl.time(2.30, false); assert.ok(h.node('bubble-beam-v2-pop-43').alpha > .6)
      const drop = h.node('bubble-beam-v2-drop-43-0'), point = h.point(drop)
      h.tl.time(2.36, false); assert.ok(h.point(drop).y > point.y); assert.ok(drop.alpha > .4)
      assert.deepEqual(cues, ['impact'])
      h.tl.time(bubbleTiming.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('all second-review art and actors fit both directions, edges and portrait fields and clean up on every exit', async () => {
  for (const sourceId of ['source', 'target']) for (const layout of [0, 1, 2, 3]) for (const [id, , timing] of entries) {
    const h = harness(sourceId, layout)
    try {
      const run = h.play(id); await tick(); let seen = 0
      for (let time = .017; time < timing.duration - .01; time += .031) { h.tl.time(time, false); seen += bounds(h, id) }
      assert.ok(seen > 100)
      run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h)
      for (const at of [timing.contact / 2, timing.contact + .03]) {
        const early = h.play(id); await tick(); h.tl.time(at, false)
        early.cancel(); assert.equal((await early.finished).status, 'cancelled'); clean(h)
      }
      const reduced = h.play(id, { reducedMotion: true }); await tick(); h.tl.time(h.tl.duration(), false)
      assert.equal((await reduced.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})
