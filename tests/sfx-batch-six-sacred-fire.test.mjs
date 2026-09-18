import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS, EFFECT_TIMINGS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import sacredFire, { timing } from '../packages/battle-fx/src/review-batch-six/sacred-fire.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const closePoint = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .005, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
const geometry = g => JSON.stringify(g.context.instructions.map(instruction => instruction.data.path.instructions))
function harness(sourceId = 'source', edge = 0) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const scene = createSceneGraph(edge === -1 ? undefined : { width, height, actors: [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: .28, y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: 1, anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32] } },
    { id: 'target', profile: 'tall', x: edge === 2 || edge === 3 ? .945 : .74, y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: -1, anchors: { center: edge === 3 ? [.5, .04] : [.48, .44] } },
  ] })
  const targetId = sourceId === 'source' ? 'target' : 'source'
  const fx = createBattleFx({ effects: { 'sacred-fire': { ...MOVE_EFFECTS['sacred-fire'], build: sacredFire, contact: timing.contact, duration: timing.duration } },
    glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } } })
  return { scene, sourceId, targetId, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node),
    run(options = {}) { return fx.play({ moveId: 'sacred-fire', sourceId, targetIds: [targetId], visualSeed: 42 }, { scene, ...options }) },
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

test('Sacred Fire review aligns the full native recording with charge and crown landmarks without changing production', async () => {
  assert.deepEqual(EFFECT_TIMINGS['sacred-fire'], { contact: .94, duration: 2.2 })
  assert.notEqual(MOVE_EFFECTS['sacred-fire'].build, sacredFire)
  const report = JSON.parse(await readFile(new URL('../tools/audio-import/reports/sfx-remaining-analysis.json', import.meta.url)))
  const measured = report.measurements.find(row => row.assetId === 'source.sacred-fire')
  assert.ok(measured.positiveEnergyRises.some(row => row.startFrame / measured.sampleRate === .12))
  assert.equal(measured.strongestEnergyWindow.startFrame / measured.sampleRate, 3.38)
  assert.equal(timing.markers.find(marker => marker.id === 'charge-rise').timeSeconds, .18)
  assert.equal(timing.markers.find(marker => marker.id === 'crown-surge').timeSeconds, 3.44)
  assert.ok(Math.abs(.18 - .12 - .06) < 1e-9)
  assert.ok(Math.abs(3.44 - 3.38 - .06) < 1e-9)
  assert.ok(.06 + measured.sampleFrames / measured.sampleRate < timing.duration)
  assert.equal(timing.contact, 1.42); assert.equal(timing.duration, 4.5)
  const source = await readFile(new URL('../packages/battle-fx/src/review-batch-six/sacred-fire.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /from ['"][^'"]*(?:battle-core|battle-sfx|apps\/|vue|pokemon-sprites)/)
})

test('purple body fire stays attached, seven burning embers release from the live mouth and explode before one cue', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId, -1), source = h.scene.actor(sourceId), target = h.scene.actor(h.targetId), cues = []
    try {
      const run = h.run({ onCue(cue) {
        cues.push([cue.type, h.tl.time()])
        for (let i = 0; i < 7; i++) closePoint(h.point(h.node(`sacred-fire-review-ember-${i}`)), target.anchor('center'), 'every ember converges before the cue')
        assert.ok(h.node('sacred-fire-review-flash').alpha > .85)
        closePoint(h.point(h.node('sacred-fire-review-explosion')), target.anchor('center'), 'explosion is at target before cue')
      } }); await tick()
      h.tl.time(.3, false)
      closePoint(h.point(h.node('sacred-fire-review-charge')), source.anchor('visualCenter'), 'body fire follows visible center')
      closePoint(h.point(h.node('sacred-fire-review-mouth')), source.anchor('emission'), 'mouth glow follows emission')
      assert.ok(h.node('sacred-fire-review-charge').alpha > .9)
      const puff = h.node('sacred-fire-review-charge-puff-10'), p = h.point(puff)
      h.tl.time(.36, false); assert.ok(Math.hypot(p.x - h.point(puff).x, p.y - h.point(puff).y) > 1, 'source flames flow during charge')
      const colors = new Set(h.node('sacred-fire-review-charge').children.filter(node => node.label.includes('puff')).map(node => node.tint))
      assert.deepEqual(colors, new Set([0x6331db, 0x9b48ef, 0xc786ff, 0xf0d8ff]))
      h.tl.time(.84, false); const firing = source.anchor('emission')
      for (let i = 0; i < 7; i++) {
        h.tl.time(.84 + i * .025, false)
        closePoint(h.point(h.node(`sacred-fire-review-ember-${i}`)), source.anchor('emission'), 'live launch attachment')
        closePoint(source.anchor('emission'), firing, 'source holds through final release')
      }
      h.tl.time(timing.contact - .0001, false); assert.deepEqual(cues, [])
      h.tl.time(timing.contact, false); assert.deepEqual(cues, [['impact', 1.42]])
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('seven long layered rainbow flames stay live on the target and continue moving through the sustained crown fade', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId, -1), target = h.scene.actor(h.targetId), cues = []
    try {
      const run = h.run({ onCue: cue => cues.push(cue.type) }); await tick()
      h.tl.time(2.1, false)
      const crown = h.node('sacred-fire-review-crown'), flames = Array.from({ length: 7 }, (_, i) => h.node(`sacred-fire-review-crown-flame-${i}`))
      assert.equal(crown.alpha, 1)
      const fills = new Set(flames.flatMap(flame => flame.context.instructions.filter(instruction => instruction.action === 'fill').map(instruction => instruction.data.style.color)))
      for (const color of [0xff5874, 0xff964d, 0xffd95f, 0x93ed86, 0x69dfec, 0x7f9aff, 0xd98cff]) assert.ok(fills.has(color), 'all rainbow colors appear within layered flames')
      for (const flame of flames) {
        const b = flame.getLocalBounds()
        assert.ok(b.height > b.width * 2.5, 'separate crown tongues read as long flames')
      }
      for (const [start, end] of [[2.6, 2.66], [3.6, 3.66], [4.05, 4.13]]) {
        h.tl.time(start, false)
        const body = geometry(flames[3]), puff = h.node('sacred-fire-review-crown-puff-7'), point = h.point(puff)
        assert.ok(crown.alpha > .3)
        h.tl.time(end, false)
        assert.notEqual(geometry(flames[3]), body, 'flame contours curl continuously')
        assert.ok(Math.hypot(point.x - h.point(puff).x, point.y - h.point(puff).y) > 1, 'bright puffs keep rising through the fade')
      }
      h.tl.time(3.1, false); const quiet = flames[3].getLocalBounds().height
      h.tl.time(3.44, false); assert.ok(flames[3].getLocalBounds().height > quiet * 1.1, 'crown rises at the later sound maximum')
      target.pose.y -= 5; h.tl.time(3.5, false)
      closePoint(h.point(crown), target.anchor('center'), 'sustained crown follows current receiver')
      h.tl.time(4.32, false); assert.equal(crown.alpha, 0)
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      assert.deepEqual(cues, ['impact'], 'crown surges add no result cue')
    } finally { h.dispose() }
  }
})

test('purple charge, ember contours, rainbow crown and full actors fit both perspectives and constrained fields', async () => {
  for (const sourceId of ['source', 'target']) for (const edge of [-1, 0, 1, 2, 3, 4]) {
    const h = harness(sourceId, edge)
    try {
      const run = h.run(); await tick(); let seen = 0
      for (let time = .025; time < timing.duration - .02; time += .037) {
        h.tl.time(time, false)
        for (const actor of h.scene.actors.values()) {
          const p = actor.anchor('visualCenter'), rx = actor.metrics.width / 2, ry = actor.metrics.height / 2
          assert.ok(p.x - rx >= -.05 && p.x + rx <= h.scene.width + .05 && p.y - ry >= -.05 && p.y + ry <= h.scene.height + .05, 'full actor bounds')
          assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
        }
        const walk = (node, parentAlpha = 1) => {
          const alpha = parentAlpha * node.alpha
          if (alpha > .02 && ['Graphics', 'Sprite'].includes(node.constructor.name)) {
            seen++; const b = node.getBounds()
            assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
              `${node.label} edge=${edge} actor=${sourceId} t=${time}: ${JSON.stringify(b)}`)
          }
          for (const child of node.children ?? []) walk(child, alpha)
        }
        walk(h.scene.effects)
      }
      assert.ok(seen > 1000); h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('Sacred Fire cancellation, replacement and reduced motion restore all owned effects, poses and camera', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId, -1)
    try {
      for (const time of [.4, 1.1, 1.46, 2.8, 4.1]) {
        const run = h.run(); await tick(); h.tl.time(time, false); run.cancel()
        assert.equal((await run.finished).status, 'cancelled'); clean(h)
      }
      const old = h.run(); await tick(); h.tl.time(2.1, false)
      const replacement = h.run({ reducedMotion: true }); assert.equal((await old.finished).status, 'cancelled'); await tick(); old.cancel()
      assert.equal(h.node('sacred-fire-review-crown'), null)
      h.tl.time(.8, false); assert.equal((await replacement.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})
