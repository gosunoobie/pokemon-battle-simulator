import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import blizzard, { timing } from '../packages/battle-fx/src/review-batch-five-v4/blizzard.js'
import previous, { timing as previousTiming } from '../packages/battle-fx/src/review-batch-five-v3/blizzard.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const pulses = [1.5165, 1.929, 2.004, 2.079, 2.154, 2.229, 2.304]
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .05, `${label}: ${actual} vs ${expected}`)
const closePoint = (actual, expected, label) => assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < .05, label)
function harness(sourceId = 'source', custom = false, builder = blizzard) {
  const scene = createSceneGraph(custom ? { width: 620, height: 650, actors: [
    { id: 'source', profile: 'wide', x: .29, y: .78, height: .2, facing: 1 },
    { id: 'target', profile: 'tall', x: .8, y: .44, height: .2, facing: -1 },
  ] } : {})
  let timeline
  const fx = createBattleFx({ glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    effects: { blizzard: { ...MOVE_EFFECTS.blizzard, build: builder, ...timing } },
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } },
  })
  const targetId = sourceId === 'source' ? 'target' : 'source'
  return { scene, fx, sourceId, target: scene.actor(targetId), get tl() { return timeline },
    play(onCue, reducedMotion = false) { return fx.play({ moveId: 'blizzard', sourceId, targetIds: [targetId], visualSeed: 42 }, { scene, onCue, reducedMotion }) },
    node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node),
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
const dimensions = node => { const bounds = node.getBounds(); return { width: bounds.width, height: bounds.height } }
const drawing = node => JSON.stringify(node.context.instructions.map(instruction => instruction.data.path?.instructions))
function bounded(h) {
  let visible = 0
  function walk(node, alpha = 1) {
    const opacity = alpha * node.alpha
    if (opacity > .03 && node.constructor.name === 'Graphics') {
      const b = node.getBounds()
      if (b.width > 0 && b.height > 0) {
        visible++
        assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
          `${node.label}: ${JSON.stringify(b)}`)
      }
    }
    for (const child of node.children ?? []) walk(child, opacity)
  }
  walk(h.node('blizzard-late-storm'))
  for (const actor of h.scene.actors.values()) {
    const center = actor.anchor('visualCenter'), width = actor.metrics.width / 2, height = actor.metrics.height / 2
    assert.ok(center.x - width >= -.05 && center.y - height >= -.05 && center.x + width <= h.scene.width + .05 && center.y + height <= h.scene.height + .05)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  }
  return visible
}

test('fourth Blizzard review preserves the previous timeline and single result without replacing earlier recipes', () => {
  assert.deepEqual(timing, previousTiming)
  assert.equal(timing.contact, .82); assert.equal(timing.duration, 2.85)
  assert.deepEqual(timing.markers.map(marker => marker.timeSeconds), pulses)
  assert.deepEqual(EFFECT_TIMINGS.blizzard, { contact: .82, duration: 2.65 })
  assert.notEqual(blizzard, previous); assert.notEqual(blizzard, MOVE_EFFECTS.blizzard.build)
})

test('every incoming crystal hands off to upright 20-percent ice that grows to half the old final size', async () => {
  for (const sourceId of ['source', 'target']) for (const [i, impact] of pulses.entries()) {
    const start = impact - .58, lodge = impact - .32
    let oldFlight, oldFinal
    const old = harness(sourceId, false, previous)
    try {
      const run = old.play(); await tick()
      old.tl.time(impact - .42 + .05, false)
      const crystal = old.node(`blizzard-large-crystal-${i}`)
      oldFlight = { width: crystal.getLocalBounds().width, height: crystal.getLocalBounds().height }
      old.tl.time(impact - .001, false)
      oldFinal = { point: old.point(crystal), bounds: dimensions(crystal) }
      run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(old)
    } finally { old.dispose() }
    const h = harness(sourceId), cues = []
    try {
      const run = h.play(cue => cues.push(cue.type)); await tick()
      const small = h.node(`blizzard-small-crystal-${i}`), crystal = h.node(`blizzard-large-crystal-${i}`)
      h.tl.time(start + .05, false)
      assert.equal(crystal.alpha, 0); assert.equal(small.alpha, 1)
      close(small.getLocalBounds().width, oldFlight.width, 'small flying crystal keeps its previous width')
      close(small.getLocalBounds().height, oldFlight.height, 'small flying crystal keeps its previous height')
      const launchPoint = h.point(small)
      assert.ok(Math.hypot(launchPoint.x - oldFinal.point.x, launchPoint.y - oldFinal.point.y) > 50, 'small particle still flies visibly toward the opponent')
      h.tl.time(lodge, false)
      const initial = dimensions(crystal), position = h.point(crystal)
      const centerAtLodge = h.target.anchor('visualCenter')
      const attachment = { x: position.x - centerAtLodge.x, y: position.y - centerAtLodge.y }
      assert.equal(crystal.alpha, 0); close(small.alpha, 1, 'handoff starts with the incoming particle')
      closePoint(h.point(small), position, `incoming tip reaches the lodged upright ice ${sourceId}/${i}/${lodge}: ${JSON.stringify(h.point(small))}/${JSON.stringify(position)}`)
      assert.equal(crystal.rotation, Math.PI / 2, 'even its first constructed pose is upright')
      h.tl.time(lodge + .0001, false)
      assert.ok(crystal.alpha > 0 && crystal.alpha < .01, 'the first visible growth fades in gently')
      assert.equal(crystal.rotation, Math.PI / 2)
      let lastHeight = crystal.getBounds().height
      for (const offset of [.02, .06, .12, .18, .23, .24]) {
        h.tl.time(lodge + offset, false)
        const center = h.target.anchor('visualCenter')
        closePoint(h.point(crystal), { x: center.x + attachment.x, y: center.y + attachment.y }, 'growth remains attached during the target recoil')
        assert.equal(crystal.rotation, Math.PI / 2, 'large ice never turns in from horizontal')
        const height = crystal.getBounds().height
        assert.ok(height > lastHeight, 'complete crystal grows smoothly in successive frames'); lastHeight = height
      }
      assert.equal(small.alpha, 0); close(crystal.alpha, 1, 'fully grown ice is visible before its fade')
      h.tl.time(impact - .08, false)
      const final = crystal.getBounds()
      close(final.width, oldFinal.bounds.width * .5, 'new final crystal width is exactly half')
      close(final.height, oldFinal.bounds.height * .5, 'new final crystal height is exactly half')
      close(initial.width, final.width * .2, 'growth starts at twenty percent width')
      close(initial.height, final.height * .2, 'growth starts at twenty percent height')
      closePoint(h.point(crystal), oldFinal.point, 'distributed contact remains unchanged')
      assert.ok(final.height > final.width * 1.3)
      h.tl.time(impact - .04, false); close(crystal.alpha, .5, 'fully grown ice fades smoothly over the final .08 seconds')
      close(crystal.getBounds().width, final.width, 'fading preserves the final size')
      h.tl.time(impact, false)
      assert.equal(crystal.alpha, 0); assert.equal(small.alpha, 0)
      const flash = h.node(`blizzard-late-impact-${i}`)
      assert.equal(flash.alpha, 1); closePoint(h.point(flash), oldFinal.point, 'disappearance stays on the original beat and contact')
      assert.deepEqual(cues, ['impact'])
      run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h)
    } finally { h.dispose() }
  }
})

test('smaller distributed upright ice remains bounded while snowfall and downward shards continue through the fade', async () => {
  for (const sourceId of ['source', 'target']) for (const custom of [false, true]) {
    const h = harness(sourceId, custom), cues = []
    try {
      const run = h.play(cue => cues.push(cue.type)); await tick()
      let visible = 0
      for (let time = 1.09; time <= 2.7; time += .011) { h.tl.time(time, false); visible += bounded(h) }
      assert.ok(visible > 100); assert.deepEqual(cues, ['impact'])
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      const next = h.play(); await tick()
      const snow = h.node('blizzard-continuing-snow'), wind = h.node('blizzard-continuing-wind'), shard = h.node('blizzard-large-shard-6-0')
      h.tl.time(2.43, false); const firstSnow = drawing(snow), firstWind = drawing(wind), firstY = h.point(shard).y
      h.tl.time(2.49, false); const secondY = h.point(shard).y
      h.tl.time(2.55, false); const thirdY = h.point(shard).y
      assert.notEqual(drawing(snow), firstSnow); assert.notEqual(drawing(wind), firstWind)
      assert.ok(secondY > firstY && thirdY - secondY > secondY - firstY)
      next.cancel(); assert.equal((await next.finished).status, 'cancelled'); clean(h)
    } finally { h.dispose() }
  }
})

test('early cancellation and reduced motion still clean the new handoff without extra cues or poses', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId)
    try {
      for (const at of [.4, 1.37, 2.11]) {
        const run = h.play(); await tick(); h.tl.time(at, false); run.cancel()
        assert.equal((await run.finished).status, 'cancelled'); clean(h)
      }
      const cues = [], reduced = h.play(cue => cues.push(cue.type), true)
      await tick(); h.tl.time(.8, false)
      assert.equal((await reduced.finished).status, 'completed'); assert.deepEqual(cues, ['impact']); clean(h)
    } finally { h.dispose() }
  }
})
