import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS, EFFECT_TIMINGS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import previousFire, { timing as previousTiming } from '../packages/battle-fx/src/review-batch-five-v2/fire-blast.js'
import fireBlast, { timing } from '../packages/battle-fx/src/review-batch-five-v3/fire-blast.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const close = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .005, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
function harness(reverse = false, edge = 0, previous = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const scene = createSceneGraph({ width, height, actors: [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28, y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1, anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32] } },
    { id: 'target', profile: 'tall', x: reverse ? (edge >= 2 && edge !== 4 ? .055 : .26) : (edge >= 2 && edge !== 4 ? .945 : .74), y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: reverse ? 1 : -1, anchors: { center: edge === 3 ? [.5, .04] : [.48, .44] } },
  ] })
  const fx = createBattleFx({ effects: { 'fire-blast': { ...MOVE_EFFECTS['fire-blast'], build: previous ? previousFire : fireBlast, contact: timing.contact, duration: timing.duration } },
    glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } } })
  return { scene, fx, width, height, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node),
    run(options = {}) { return fx.play({ moveId: 'fire-blast', sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene, ...options }) },
    dispose() { fx.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
  for (const a of h.scene.actors.values()) {
    assert.equal(a.pose.x, 0); assert.equal(a.pose.y, 0); assert.equal(a.pose.rotation, 0)
    assert.equal(a.pose.alpha, 1); assert.equal(a.pose.scale.x, 1); assert.equal(a.pose.scale.y, 1); assert.equal(a.pose.tint, 0xffffff)
  }
}
function display(node) {
  return { label: node.label, x: node.x, y: node.y, rotation: node.rotation, alpha: node.alpha, sx: node.scale.x, sy: node.scale.y, tint: node.tint,
    graphics: node.context?.instructions.map(({ action, data }) => {
      const { texture, ...style } = data.style
      return { action, style, path: data.path.instructions }
    }), children: node.children?.map(display) }
}
const sample = h => JSON.parse(JSON.stringify({ effects: display(h.scene.effects), camera: display(h.scene.camera), actors: [...h.scene.actors.values()].map(a => display(a.pose)) }))

test('Fire Blast releases .30 authored seconds earlier while preserving its approved sound impact and duration', async () => {
  assert.deepEqual(EFFECT_TIMINGS['fire-blast'], { contact: 1.07, duration: 2.5 })
  assert.notEqual(MOVE_EFFECTS['fire-blast'].build, fireBlast)
  assert.equal(timing.contact, previousTiming.contact); assert.equal(timing.duration, previousTiming.duration)
  assert.equal(timing.markers.find(m => m.id === 'charge').timeSeconds, .1)
  assert.equal(timing.markers.find(m => m.id === 'launch').timeSeconds, 1.2425)
  assert.ok(Math.abs(previousTiming.markers.find(m => m.id === 'launch').timeSeconds - 1.2425 - .3) < 1e-9)
  assert.ok(Math.abs(timing.contact / .75 - (.5166666666666667 + 2.18)) < 1e-9)
  for (const reverse of [false, true]) {
    const h = harness(reverse), old = harness(reverse, 0, true), source = h.scene.actor('source'), cues = []
    try {
      const run = h.run({ onCue(cue) {
        cues.push([cue.type, h.tl.time()])
        close(h.point(h.node('fire-blast-review-orb')), h.scene.actor('target').anchor('center'), 'orb contact before cue')
        assert.equal(h.node('fire-blast-review-five-rays').alpha, 1)
      } }), previous = old.run()
      await tick()
      for (const time of [.15, .4, 1.15, 1.2425]) { h.tl.time(time, false); close(h.point(h.node('fire-blast-review-orb')), source.anchor('emission'), 'live mouth through shorter charge') }
      h.tl.time(1.45, false); old.tl.time(1.45, false)
      const orb = h.point(h.node('fire-blast-review-orb')), mouth = source.anchor('emission')
      assert.ok(Math.hypot(orb.x - mouth.x, orb.y - mouth.y) > 10, 'new orb is already flying')
      close(old.point(old.node('fire-blast-review-orb')), old.scene.actor('source').anchor('emission'), 'previous orb is still charging')
      assert.ok(h.node('fire-blast-review-mouth').alpha < old.node('fire-blast-review-mouth').alpha - .3, 'mouth glow clears earlier with release')
      h.tl.time(2.0224, false); assert.deepEqual(cues, [])
      h.tl.time(2.0225, false); assert.deepEqual(cues, [['impact', 2.0225]])
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      previous.cancel(); await previous.finished; clean(old)
    } finally { h.dispose(); old.dispose() }
  }
})

test('the approved five flame streams, flashes, particles and recovery are unchanged from impact onward', async () => {
  for (const reverse of [false, true]) {
    const current = harness(reverse), previous = harness(reverse, 0, true)
    try {
      const currentRun = current.run(), previousRun = previous.run(); await tick()
      for (const time of [2.0225, 2.08, 2.2, 2.4425, 2.6, 2.85, 3.05]) {
        current.tl.time(time, false); previous.tl.time(time, false)
        assert.deepEqual(sample(current), sample(previous), `same approved artwork and pose at ${time}`)
      }
      current.tl.time(timing.duration, false); previous.tl.time(previousTiming.duration, false)
      await currentRun.finished; await previousRun.finished; clean(current); clean(previous)
    } finally { current.dispose(); previous.dispose() }
  }
})

test('the earlier Fire Blast flight and complete artwork remain inside both perspectives and edge layouts', async () => {
  for (const reverse of [false, true]) for (const edge of [0, 1, 2, 3, 4]) {
    const h = harness(reverse, edge)
    try {
      const run = h.run(); await tick(); let visible = 0
      for (let time = .045; time < timing.duration - .02; time += .041) {
        h.tl.time(time, false)
        for (const actor of h.scene.actors.values()) {
          const p = actor.anchor('visualCenter'), rx = actor.metrics.width / 2, ry = actor.metrics.height / 2
          assert.ok(p.x - rx >= -.05 && p.x + rx <= h.width + .05 && p.y - ry >= -.05 && p.y + ry <= h.height + .05, 'actor bounds')
          assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
        }
        const walk = (node, parentAlpha = 1) => {
          const alpha = parentAlpha * node.alpha
          if (alpha > .03 && ['Graphics', 'Sprite'].includes(node.constructor.name)) {
            visible++; const b = node.getBounds()
            assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.width + .05 && b.y + b.height <= h.height + .05,
              `${node.label} edge=${edge} reverse=${reverse} t=${time}: ${JSON.stringify(b)}`)
          }
          for (const child of node.children ?? []) walk(child, alpha)
        }
        walk(h.scene.effects)
      }
      assert.ok(visible > 100); h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('Fire Blast cleans its shorter charge and longer flight on cancellation and reduced-motion replacement', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try {
      for (const time of [.4, 1.3, 1.8, 2.1, 2.9]) {
        const run = h.run(); await tick(); h.tl.time(time, false); run.cancel()
        assert.equal((await run.finished).status, 'cancelled'); clean(h)
      }
      const old = h.run(); await tick(); h.tl.time(1.3, false)
      const replacement = h.run({ reducedMotion: true }); assert.equal((await old.finished).status, 'cancelled'); await tick(); old.cancel()
      h.tl.time(.8, false); assert.equal((await replacement.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})
