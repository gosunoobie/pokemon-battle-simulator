import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS, EFFECT_TIMINGS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import sacredFire, { timing } from '../packages/battle-fx/src/review-batch-six-v2/sacred-fire.js'
import previousSacredFire, { timing as previousTiming } from '../packages/battle-fx/src/review-batch-six/sacred-fire.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const closePoint = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .005, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
function harness(sourceId = 'source', edge = 0, build = sacredFire) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const scene = createSceneGraph(edge === -1 ? undefined : { width, height, actors: [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: .28, y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: 1, anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32] } },
    { id: 'target', profile: 'tall', x: edge === 2 || edge === 3 ? .945 : .74, y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: -1, anchors: { center: edge === 3 ? [.5, .04] : [.48, .44] } },
  ] })
  const targetId = sourceId === 'source' ? 'target' : 'source'
  const fx = createBattleFx({ effects: { 'sacred-fire': { ...MOVE_EFFECTS['sacred-fire'], build, contact: timing.contact, duration: timing.duration } },
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
  const source = await readFile(new URL('../packages/battle-fx/src/review-batch-six-v2/sacred-fire.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /from ['"][^'"]*(?:battle-core|battle-sfx|apps\/|vue|pokemon-sprites)/)
})

test('approved purple source charge stays exactly equal to v1 throughout its full lifetime', async () => {
  const capture = node => ({ label: node.label, x: node.x, y: node.y, rotation: node.rotation, alpha: node.alpha,
    width: node.width, height: node.height, tint: node.tint, scale: { x: node.scale.x, y: node.scale.y }, children: node.children.map(capture) })
  for (const sourceId of ['source', 'target']) {
    const old = harness(sourceId, -1, previousSacredFire), h = harness(sourceId, -1)
    try {
      old.run(); h.run(); await tick()
      for (const time of [.08, .18, .32, .65, .84, .93, 1.04, 1.139]) {
        old.tl.time(time, false); h.tl.time(time, false)
        assert.deepEqual(capture(h.node('sacred-fire-review-charge')), capture(old.node('sacred-fire-review-charge')), `approved body flame parity at ${time}`)
        assert.deepEqual(capture(h.node('sacred-fire-review-mouth')), capture(old.node('sacred-fire-review-mouth')), `approved mouth parity at ${time}`)
        closePoint(h.scene.actor(sourceId).anchor('emission'), old.scene.actor(sourceId).anchor('emission'), 'source choreography unchanged')
      }
      assert.equal(timing.contact, previousTiming.contact); assert.equal(timing.duration, previousTiming.duration)
    } finally { old.dispose(); h.dispose() }
  }
})

test('dense widening purple flames release continuously from the live mouth and reach the target before one cue', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId, -1), source = h.scene.actor(sourceId), target = h.scene.actor(h.targetId), cues = []
    try {
      const run = h.run({ onCue(cue) {
        cues.push([cue.type, h.tl.time()])
        closePoint(h.point(h.node('sacred-fire-review-stream-front')), target.anchor('center'), 'leading flow arrives before cue')
        closePoint(h.point(h.node('sacred-fire-review-stream-puff-0')), target.anchor('center'), 'actual flame leading edge reaches target')
        assert.ok(h.node('sacred-fire-review-stream-puff-0').alpha > .35)
        assert.ok(h.node('sacred-fire-review-flash').alpha > .85)
        closePoint(h.point(h.node('sacred-fire-review-explosion')), target.anchor('center'), 'explosion is at target before cue')
      } }); await tick()
      h.tl.time(.84, false); const firing = source.anchor('emission')
      for (const i of [0, 24, 60, 96, 126]) {
        if (i === 126) h.tl.time(timing.contact, false)
        h.tl.time(.84 + i / 180, false)
        closePoint(h.point(h.node(`sacred-fire-review-stream-puff-${i}`)), source.anchor('emission'), 'each launch uses live emission')
        closePoint(h.point(h.node('sacred-fire-review-stream-root')), source.anchor('emission'), 'continuous nozzle root stays attached')
        closePoint(source.anchor('emission'), firing, 'source holds through final release')
      }
      // Use a fresh run so this test exercises strictly forward contact playback.
      run.cancel(); await run.finished
      const second = h.run({ onCue: cue => cues.push([cue.type, h.tl.time()]) }); await tick()
      h.tl.time(1.25, false)
      const puffs = Array.from({ length: 127 }, (_, i) => h.node(`sacred-fire-review-stream-puff-${i}`))
      assert.ok(puffs.filter(p => p.alpha > .1).length > 60, 'stream is dense rather than seven isolated projectiles')
      assert.ok(puffs[6].width > puffs[60].width * 1.2, 'released fire widens in flight')
      assert.deepEqual(new Set(puffs.map(p => p.tint)), new Set([0x6331db, 0x9b48ef, 0xc786ff, 0xf0d8ff]))
      const p = h.point(puffs[20]); h.tl.time(1.29, false)
      assert.ok(Math.hypot(p.x - h.point(puffs[20]).x, p.y - h.point(puffs[20]).y) > 5, 'fire keeps flowing toward receiver')
      h.tl.time(1.4199, false); assert.equal(cues.length, 1)
      h.tl.time(1.42, false); assert.deepEqual(cues, [['impact', 1.42], ['impact', 1.42]])
      h.tl.time(1.65, false); const moving = h.point(puffs[115])
      h.tl.time(1.7, false); assert.ok(Math.hypot(moving.x - h.point(puffs[115]).x, moving.y - h.point(puffs[115]).y) > 3, 'released flames keep traveling after cutoff')
      h.tl.time(2.24, false); assert.ok(puffs.every(p => p.alpha === 0))
      h.tl.time(timing.duration, false); assert.equal((await second.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('seven spaced purple crown plumes use the approved opening flame material at exactly twice both dimensions and keep flowing', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId, -1), reference = harness(sourceId, -1, previousSacredFire), target = h.scene.actor(h.targetId), cues = []
    try {
      const run = h.run({ onCue: cue => cues.push(cue.type) }); reference.run(); await tick()
      const time = 2.1; h.tl.time(time, false)
      const crown = h.node('sacred-fire-review-crown'), flames = Array.from({ length: 7 }, (_, i) => h.node(`sacred-fire-review-crown-flame-${i}`))
      assert.equal(crown.alpha, 1)
      assert.ok(flames.every(f => f.constructor.name === 'Container'), 'crown consists of flowing puff plumes, with no vector fence')
      for (let i = 1; i < 7; i++) assert.ok(Math.abs(flames[i].x - flames[i - 1].x - 78) < .001, 'crown has even generous spacing')
      const colors = new Set()
      for (let i = 0; i < 126; i++) {
        const puff = h.node(`sacred-fire-review-crown-puff-${i}`), openingIndex = i % 72
        colors.add(puff.tint)
        const q = ((time - timing.contact) * 1.5 + Math.floor(i / 7) / 18) % 1
        const openingTime = .08 + ((q - openingIndex / 72 + 1) % 1) / 1.5
        reference.tl.time(openingTime, false)
        const opening = reference.node(`sacred-fire-review-charge-puff-${openingIndex}`)
        assert.ok(Math.abs(puff.width - opening.width * 2) < .0001, 'flame width doubles')
        assert.ok(Math.abs(puff.height - opening.height * 2) < .0001, 'flame height doubles')
        assert.ok(Math.abs(puff.alpha - opening.alpha) < .0001, 'opening burn/fade law is preserved')
        assert.equal(puff.tint, opening.tint)
      }
      assert.deepEqual(colors, new Set([0x6331db, 0x9b48ef, 0xc786ff, 0xf0d8ff]))
      for (const [start, end] of [[2.6, 2.66], [3.6, 3.66], [4.05, 4.13]]) {
        h.tl.time(start, false)
        const puff = h.node('sacred-fire-review-crown-puff-7'), point = h.point(puff)
        assert.ok(crown.alpha > .3)
        h.tl.time(end, false)
        assert.ok(Math.hypot(point.x - h.point(puff).x, point.y - h.point(puff).y) > 1, 'purple flames rise through the fade')
      }
      h.tl.time(3.15, false); const quiet = flames[3].getLocalBounds().height
      h.tl.time(3.44, false); assert.ok(flames[3].getLocalBounds().height > quiet * 1.05, 'crown rises at later sound maximum')
      target.pose.y -= 5; h.tl.time(3.5, false)
      closePoint(h.point(crown), target.anchor('center'), 'sustained crown root follows current receiver')
      h.tl.time(4.32, false); assert.equal(crown.alpha, 0)
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      assert.deepEqual(cues, ['impact'], 'crown surges add no result cue')
    } finally { h.dispose(); reference.dispose() }
  }
})

test('purple charge, flowing release, doubled purple crown and full actors fit both perspectives and constrained fields', async () => {
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
