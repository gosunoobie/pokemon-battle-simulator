import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import leafBlade, { timing } from '../packages/battle-fx/src/review-batch-six/leaf-blade.js'
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
function harness(sourceId = 'source', fixture = 0) {
  const scene = createSceneGraph(fixtures[fixture])
  let timeline
  const fx = createBattleFx({ glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    effects: { 'leaf-blade': { ...MOVE_EFFECTS['leaf-blade'], build: leafBlade, ...timing } },
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

test('Leaf Blade review exposes three native sound crests and leaves the registered original untouched', () => {
  assert.deepEqual(EFFECT_TIMINGS['leaf-blade'], { contact: .82, duration: 1.95 })
  assert.notEqual(leafBlade, MOVE_EFFECTS['leaf-blade'].build)
  assert.deepEqual(timing.markers.map(marker => marker.timeSeconds), [.81, 1.69, 2.56])
  assert.equal(timing.contact, 2.56); assert.equal(timing.duration, 4.2)
  assert.ok(.4 + 162289 / 44100 < timing.duration, 'full native recording ends before the review clip')
})

test('saved native sound measurements identify the exact source and explain all three visual accents', async () => {
  const evidence = JSON.parse(await readFile(new URL('../tools/audio-import/review/sync-batch-006.leaf-blade-measurements.json', import.meta.url), 'utf8'))
  const bytes = await readFile(new URL('../public/sound_effects/Leaf Blade.mp3', import.meta.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), evidence.source.sha256)
  assert.equal(evidence.source.pcmSha256, 'd2817018f72da2233378ef95764db44438c3c769455cc7cabd5f0119bf3e9f3e')
  assert.equal(evidence.method.windowFrames, 441); assert.equal(evidence.method.windowSeconds, .01)
  assert.equal(evidence.playback.audioStartSeconds, .4); assert.equal(evidence.playback.playbackRate, 1); assert.equal(evidence.playback.gainDb, 0)
  assert.equal(evidence.playback.sourceStartFrame, 0); assert.equal(evidence.playback.sourceEndFrameExclusive, evidence.source.sampleFrames)
  assert.deepEqual(evidence.sections.map(section => section.strongestEnergyWindow.startFrame), [18081, 56889, 95256])
  for (const [i, section] of evidence.sections.entries()) {
    const peak = section.strongestEnergyWindow
    assert.equal(peak.endFrameExclusive - peak.startFrame, 441)
    assert.ok(peak.startFrame >= section.sourceRange.startFrame && peak.endFrameExclusive <= section.sourceRange.endFrameExclusive)
    assert.equal(peak.sourceTimeSeconds, peak.startFrame / evidence.source.sampleRate)
    assert.ok(Math.abs(peak.sourceTimeSeconds + .4 - timing.markers[i].timeSeconds) < 1e-9)
    assert.equal(section.visualAccentSeconds, timing.markers[i].timeSeconds)
    assert.equal(section.resultCue, i === 2)
  }
  assert.equal(evidence.status, 'measured-proposal-awaiting-user-review')
})

test('the inverted curved blade stays rooted and makes two true contacts before the one final result', async () => {
  for (const sourceId of ['source', 'target']) for (let fixture = 0; fixture < fixtures.length; fixture++) {
    const h = harness(sourceId, fixture), cues = []
    try {
      const run = h.play(cue => {
        cues.push(cue.type)
        assert.equal(h.node('leaf-blade-review-cross').alpha, 1, 'both cross lines are already present inside the cue')
      }); await tick()
      const blade = h.node('leaf-blade-review-blade'), tip = h.node('leaf-blade-review-tip')
      assert.ok(tip.x < -60 && tip.y < 0, 'the real pointed end faces backward and curves upward from the holder')
      assert.equal(blade.attachmentSocket, fixture === 4 ? 'blade' : 'hand')
      h.tl.time(.25, false)
      const root = h.point(blade), back = h.point(tip), direction = Math.sign(h.target.base('center').x - h.source.base('center').x)
      assert.ok((back.x - root.x) * direction < 0, 'the wind-up visibly holds the blade behind the elbow')
      for (const time of [.25, .51, .70, .81, .98, 1.30, 1.57, 1.69, 1.89, 2.31, 3.17]) {
        h.tl.time(time, false)
        near(h.point(blade), h.source.anchor(blade.attachmentSocket), 'the blade root remains on the live posed attachment')
        if (time === .81) contact(h, 1)
        if (time === 1.69) contact(h, 2)
        if (time < timing.contact) assert.deepEqual(cues, [])
      }
      assert.deepEqual(cues, ['impact'])
      h.tl.time(timing.duration, false)
      assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('right then left slashes appear on their own beats and both return together as the final cross', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId)
    try {
      const run = h.play(); await tick()
      const first = h.node('leaf-blade-review-slash-1'), second = h.node('leaf-blade-review-slash-2'), cross = h.node('leaf-blade-review-cross')
      h.tl.time(.81, false)
      assert.equal(first.alpha, 1); assert.equal(second.alpha, 0); assert.equal(cross.alpha, 0)
      assert.ok(screenLean(h, first) < -.5, 'the first slash leans right on screen on either side')
      h.tl.time(1.69, false)
      assert.equal(first.alpha, 0); assert.equal(second.alpha, 1); assert.equal(cross.alpha, 0)
      assert.ok(screenLean(h, second) > .5, 'the second slash leans left on screen on either side')
      h.tl.time(2.56, false)
      assert.equal(first.alpha, 0); assert.equal(second.alpha, 0); assert.equal(cross.alpha, 1)
      const a = h.node('leaf-blade-review-cross-1'), b = h.node('leaf-blade-review-cross-2')
      near(h.point(a), h.point(b), 'the two final slashes share one cross center')
      near(h.point(cross), h.target.anchor('center'), 'the cross lands on the live opponent')
      assert.ok(screenLean(h, a) < -.5 && screenLean(h, b) > .5)
      const fragment = h.node('leaf-blade-review-fragment-2-0')
      h.tl.time(3.65, false); assert.ok(fragment.alpha > 0)
      const p = h.point(fragment)
      h.tl.time(3.71, false); const q = h.point(fragment)
      h.tl.time(3.77, false); const r = h.point(fragment)
      assert.ok(Math.hypot(q.x - p.x, q.y - p.y) > .1, 'late leaf shavings continue moving through their fade')
      assert.ok(r.y - q.y > q.y - p.y, 'leaf fragments accelerate world-down under reflection')
      run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h)
    } finally { h.dispose() }
  }
})

test('two full swings, rearward leaf contours and all slash aftermath stay inside wide, portrait and edge stages', async () => {
  for (const sourceId of ['source', 'target']) for (let fixture = 0; fixture < fixtures.length; fixture++) {
    const h = harness(sourceId, fixture)
    try {
      const run = h.play(); await tick()
      let visible = 0
      for (let time = .01; time < timing.duration; time += .019) { h.tl.time(time, false); visible += bounded(h) }
      assert.ok(visible > 200)
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('cancellation during either strike, cross and tail restores poses, and reduced motion emits one result', async () => {
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
