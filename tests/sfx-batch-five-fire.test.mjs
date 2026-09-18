import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS, EFFECT_TIMINGS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import fireBlast, { timing as fireTiming } from '../packages/battle-fx/src/review-batch-five/fire-blast.js'
import solarBeam, { timing as solarTiming } from '../packages/battle-fx/src/review-batch-five/solar-beam.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const variations = [['fire-blast', fireBlast, fireTiming], ['solar-beam', solarBeam, solarTiming]]
const close = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .005, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
function harness(reverse = false, edge = 0) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const scene = createSceneGraph({ width, height, actors: [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28, y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1, anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32] } },
    { id: 'target', profile: 'tall', x: reverse ? (edge >= 2 && edge !== 4 ? .055 : .26) : (edge >= 2 && edge !== 4 ? .945 : .74), y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: reverse ? 1 : -1, anchors: { center: edge === 3 ? [.5, .04] : [.48, .44] } },
  ] })
  const effects = Object.fromEntries(variations.map(([id, build, timing]) => [id, { ...MOVE_EFFECTS[id], build, contact: timing.contact, duration: timing.duration }]))
  const fx = createBattleFx({ effects, glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } } })
  return { scene, fx, width, height, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node),
    run(id, options = {}) { return fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene, ...options }) },
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

test('review fire variants retain independent production registrations and align only presentation timing', async () => {
  assert.deepEqual(EFFECT_TIMINGS['fire-blast'], { contact: 1.07, duration: 2.5 })
  assert.deepEqual(EFFECT_TIMINGS['solar-beam'], { contact: 1.26, duration: 2.9 })
  assert.notEqual(MOVE_EFFECTS['fire-blast'].build, fireBlast); assert.notEqual(MOVE_EFFECTS['solar-beam'].build, solarBeam)
  assert.equal(fireTiming.contact, 2.0225); assert.equal(fireTiming.duration, 3.15)
  assert.equal(solarTiming.contact, 1.26); assert.equal(solarTiming.duration, 3.8)
  assert.ok(Math.abs(fireTiming.contact / .75 - (1.07 / .75 - .91 + 2.18)) < 1e-9)
  for (const [id, sourceTime] of [['pulse-one', 2.72], ['pulse-main', 3.5], ['pulse-last', 3.68]]) {
    const marker = solarTiming.markers.find(marker => marker.id === id)
    assert.ok(Math.abs(marker.timeSeconds / .75 - (.08 / .75 - .09 + sourceTime)) < 1e-9)
  }
  for (const [id] of variations) {
    const source = await readFile(new URL(`../packages/battle-fx/src/review-batch-five/${id}.js`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from ['"][^'"]*(?:battle-core|battle-sfx|apps\/|vue|pokemon-sprites)/)
  }
})

test('Fire Blast stays at the live mouth through delayed charge and arrives before its one main flash cue', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse), source = h.scene.actor('source'), target = h.scene.actor('target'), cues = []
    try {
      const run = h.run('fire-blast', { onCue(cue) {
        cues.push([cue.type, h.tl.time()])
        close(h.point(h.node('fire-blast-review-orb')), target.anchor('center'), 'orb arrives before cue')
        close(h.point(h.node('fire-blast-review-five-rays')), target.anchor('center'), 'five-ray flash on current receiver')
        assert.equal(h.node('fire-blast-review-five-rays').alpha, 1)
        assert.ok(h.node('fire-blast-review-impact-glow').alpha > .7)
      } })
      await tick()
      assert.equal(h.tl.duration(), fireTiming.duration)
      h.tl.time(.9, false); assert.equal(h.node('fire-blast-review-orb').alpha, 0)
      for (const time of [1.2, 1.38, 1.5, 1.5425]) { h.tl.time(time, false); close(h.point(h.node('fire-blast-review-orb')), source.anchor('emission'), 'live charge attachment') }
      h.tl.time(1.8, false); target.pose.y = -5
      h.tl.time(fireTiming.contact - .0001, false); assert.deepEqual(cues, [])
      h.tl.time(fireTiming.contact, false); assert.deepEqual(cues, [['impact', 2.0225]])
      h.tl.time(2.12, false); const spark = h.node('fire-blast-review-ember-0'), before = h.point(spark)
      h.tl.time(2.2, false); assert.ok(Math.hypot(before.x - h.point(spark).x, before.y - h.point(spark).y) > .5, 'embers continue moving')
      h.tl.time(fireTiming.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('Solar Beam stays attached through recoil, late impact pulses and continuous flow until cutoff', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse), source = h.scene.actor('source'), target = h.scene.actor('target'), cues = []
    try {
      const run = h.run('solar-beam', { onCue(cue) {
        cues.push([cue.type, h.tl.time()])
        close(h.point(h.node('solar-beam-review-tip')), target.anchor('center'), 'beam tip at target before cue')
        close(h.point(h.node('solar-beam-review-beam')), source.anchor('emission'), 'beam root at live mouth')
      } })
      await tick(); assert.equal(h.tl.duration(), solarTiming.duration)
      h.tl.time(1.26, false); assert.deepEqual(cues, [['impact', 1.26]])
      const firing = source.anchor('emission')
      for (const time of [1.32, 1.44, 2.0525, 2.6375, 2.7725, 3.2, 3.4]) {
        h.tl.time(time, false)
        close(h.point(h.node('solar-beam-review-beam')), source.anchor('emission'), 'beam keeps live nozzle')
        close(h.point(h.node('solar-beam-review-tip')), target.anchor('center'), 'beam follows current target')
        close(h.point(h.node('solar-beam-review-impact-glow')), target.anchor('center'), 'glow follows current target')
        close(source.anchor('emission'), firing, 'source holds firing pose until cutoff')
        assert.ok(h.node('solar-beam-review-beam').alpha > .8, 'beam remains continuous')
      }
      h.tl.time(2.6375, false); const strong = h.node('solar-beam-review-impact-glow').alpha
      h.tl.time(2.5, false); const quiet = h.node('solar-beam-review-impact-glow').alpha
      assert.ok(strong > quiet + .3, 'main late pulse is visibly stronger')
      h.tl.time(3.05, false); const glint = h.node('solar-beam-review-glint-0'), point = h.point(glint)
      const spark = h.node('solar-beam-review-spark-3-0'), sparkPoint = h.point(spark)
      h.tl.time(3.1, false)
      assert.ok(Math.hypot(point.x - h.point(glint).x, point.y - h.point(glint).y) > 1, 'fresh glints keep traveling late')
      assert.ok(Math.hypot(sparkPoint.x - h.point(spark).x, sparkPoint.y - h.point(spark).y) > .5, 'last burst particles keep moving')
      target.pose.y = -7; h.tl.time(3.3, false)
      close(h.point(h.node('solar-beam-review-tip')), target.anchor('center'), 'late displaced receiver remains tracked')
      h.tl.time(3.56, false); assert.equal(h.node('solar-beam-review-beam').alpha, 0)
      close(source.anchor('emission'), firing, 'recovery starts only after beam fully clears')
      h.tl.time(solarTiming.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      assert.equal(cues.length, 1, 'later pulses have no gameplay cue')
    } finally { h.dispose() }
  }
})

test('review fire actor silhouettes and visible artwork remain bounded in both directions and edge layouts', async () => {
  for (const reverse of [false, true]) for (const edge of [0, 1, 2, 3, 4]) {
    const h = harness(reverse, edge)
    try {
      for (const [id, , timing] of variations) {
        const run = h.run(id); await tick(); let visible = 0
        for (let time = .045; time < timing.duration - .02; time += .047) {
          h.tl.time(time, false)
          for (const a of h.scene.actors.values()) {
            const p = a.anchor('visualCenter'), rx = a.metrics.width / 2, ry = a.metrics.height / 2
            assert.ok(p.x - rx >= -.05 && p.x + rx <= h.width + .05 && p.y - ry >= -.05 && p.y + ry <= h.height + .05, `${id} actor bounds`)
            assert.equal(a.pose.alpha, 1); assert.equal(a.pose.scale.x, 1); assert.equal(a.pose.scale.y, 1)
          }
          const walk = (node, parentAlpha = 1) => {
            const alpha = parentAlpha * node.alpha
            if (alpha > .03 && ['Graphics', 'Sprite'].includes(node.constructor.name)) {
              visible++; const b = node.getBounds()
              assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.width + .05 && b.y + b.height <= h.height + .05,
                `${id}/${node.label} edge=${edge} reverse=${reverse} t=${time}: ${JSON.stringify(b)}`)
            }
            for (const child of node.children ?? []) walk(child, alpha)
          }
          walk(h.scene.effects)
        }
        assert.ok(visible > 100); h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      }
    } finally { h.dispose() }
  }
})

test('review fire cancellation, replacement and reduced motion restore all owned presentation', async () => {
  for (const reverse of [false, true]) for (const [id, , timing] of variations) {
    const h = harness(reverse)
    try {
      for (const time of [.4, timing.contact + .035, timing.duration - .15]) {
        const run = h.run(id); await tick(); h.tl.time(time, false); run.cancel()
        assert.equal((await run.finished).status, 'cancelled'); clean(h)
      }
      const old = h.run(id); await tick(); h.tl.time(timing.contact + .03, false)
      const replacement = h.run(id, { reducedMotion: true }); assert.equal((await old.finished).status, 'cancelled'); await tick(); old.cancel()
      assert.equal(h.node(`${id}-review-orb`), null)
      h.tl.time(.8, false); assert.equal((await replacement.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})
