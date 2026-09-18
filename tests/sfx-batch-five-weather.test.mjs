import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import thunder, { timing as thunderTiming } from '../packages/battle-fx/src/review-batch-five/thunder.js'
import blizzard, { timing as blizzardTiming } from '../packages/battle-fx/src/review-batch-five/blizzard.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const definitions = { thunder: { build: thunder, ...thunderTiming }, blizzard: { build: blizzard, ...blizzardTiming } }
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
function harness(sourceId = 'source', custom = false) {
  const scene = createSceneGraph(custom ? { width: 620, height: 650, actors: [
    { id: 'source', profile: 'wide', x: .29, y: .78, height: .2, facing: 1 },
    { id: 'target', profile: 'tall', x: .8, y: .44, height: .2, facing: -1 },
  ] } : {})
  let timeline
  const fx = createBattleFx({ glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    effects: Object.fromEntries(Object.entries(definitions).map(([id, definition]) => [id, { ...MOVE_EFFECTS[id], ...definition }])),
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } },
  })
  const targetId = sourceId === 'source' ? 'target' : 'source'
  return { scene, fx, sourceId, target: scene.actor(targetId), get tl() { return timeline },
    play(id, onCue) { return fx.play({ moveId: id, sourceId, targetIds: [targetId], visualSeed: 42 }, { scene, onCue }) },
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
function boundedReviewArt(h, root) {
  let visible = 0
  function walk(node, alpha = 1) {
    const opacity = alpha * node.alpha
    if (opacity > .03 && node.constructor.name === 'Graphics') {
      const b = node.getBounds()
      if (b.width > 0 && b.height > 0) {
        visible++
        assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
          `${node.label} stays inside field: ${JSON.stringify(b)}`)
      }
    }
    for (const child of node.children ?? []) walk(child, opacity)
  }
  walk(root)
  for (const actor of h.scene.actors.values()) {
    const center = actor.anchor('visualCenter'), width = actor.metrics.width / 2, height = actor.metrics.height / 2
    assert.ok(center.x - width >= -.05 && center.y - height >= -.05 && center.x + width <= h.scene.width + .05 && center.y + height <= h.scene.height + .05, `${actor.id} / ${h.sourceId}: center ${JSON.stringify(center)} radius ${width},${height} in ${h.scene.width}x${h.scene.height}`)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  }
  return visible
}
const drawing = node => JSON.stringify(node.context.instructions.map(instruction => instruction.data.path?.instructions))

test('Thunder and Blizzard extend review playback without changing registered timings or importing host state', async () => {
  assert.deepEqual(EFFECT_TIMINGS.thunder, { contact: .84, duration: 2.45 })
  assert.deepEqual(EFFECT_TIMINGS.blizzard, { contact: .82, duration: 2.65 })
  assert.equal(thunderTiming.contact, .84); assert.equal(thunderTiming.duration, 2.65)
  assert.deepEqual(thunderTiming.markers.map(marker => marker.timeSeconds), [1.4925, 1.5825, 2.1975, 2.50])
  assert.equal(blizzardTiming.contact, .82); assert.equal(blizzardTiming.duration, 2.85)
  assert.deepEqual(blizzardTiming.markers.map(marker => marker.timeSeconds), [1.5165, 1.929, 2.004, 2.079, 2.154, 2.229, 2.304])
  assert.notEqual(MOVE_EFFECTS.thunder.build, thunder); assert.notEqual(MOVE_EFFECTS.blizzard.build, blizzard)
  for (const id of ['thunder', 'blizzard']) {
    const text = await readFile(new URL(`../packages/battle-fx/src/review-batch-five/${id}.js`, import.meta.url), 'utf8')
    assert.doesNotMatch(text, /from ['"][^'"]*(?:battle-core|battle-sfx|apps\/|vue)/)
    assert.doesNotMatch(text, /requestAnimationFrame|setInterval|setTimeout/)
  }
})

test('Thunder adds a live-target electrical explosion and moving crackle through the second recording section', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId), cues = []
    try {
      const run = h.play('thunder', cue => cues.push(cue.type)); await tick()
      h.tl.time(.84, false); assert.deepEqual(cues, ['impact'])
      h.tl.time(1.4924, false); assert.equal(h.node('thunder-second-impact').alpha, 0)
      h.tl.time(1.4925, false)
      const second = h.node('thunder-second-impact'), discharge = h.node('thunder-second-discharge'), sparks = h.node('thunder-second-sparks')
      assert.equal(second.alpha, 1); close(h.point(second), h.target.anchor('center'), 'second burst is centered on target')
      h.tl.time(1.5825, false); assert.ok(discharge.getBounds().width > 100)
      const before = drawing(discharge)
      h.target.pose.y += 9
      h.tl.time(1.64, false); close(h.point(second), h.target.anchor('center'), 'electrical blast follows posed center')
      assert.notEqual(drawing(discharge), before)
      h.tl.time(2.08, false); const lateSparks = drawing(sparks), lateDischarge = drawing(discharge)
      h.tl.time(2.19, false)
      assert.ok(sparks.context.instructions.length > 0)
      assert.notEqual(drawing(sparks), lateSparks); assert.notEqual(drawing(discharge), lateDischarge)
      assert.deepEqual(cues, ['impact'], 'second electrical explosion cannot emit another result')
      h.tl.time(2.50, false); assert.equal(second.alpha, 0)
      h.tl.time(thunderTiming.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('Blizzard late crystals meet seven target pulses while snow keeps flowing and fragments fall world-down', async () => {
  const pulses = [1.5165, 1.929, 2.004, 2.079, 2.154, 2.229, 2.304]
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId), cues = []
    try {
      const run = h.play('blizzard', cue => cues.push(cue.type)); await tick()
      h.tl.time(.82, false); assert.deepEqual(cues, ['impact'])
      for (const [i, impact] of pulses.entries()) {
        h.tl.time(impact - .001, false)
        const crystal = h.node(`blizzard-large-crystal-${i}`), flash = h.node(`blizzard-late-impact-${i}`)
        assert.ok(crystal.alpha > .9); assert.equal(flash.alpha, 0)
        assert.ok(crystal.getBounds().width > 20, 'late crystals are visibly larger than the original snow')
        h.tl.time(impact, false)
        close(h.point(crystal), h.point(flash), `crystal ${i} reaches its shatter origin`)
        const center = h.target.anchor('center'), point = h.point(flash)
        assert.ok(Math.abs(point.x - center.x) < .05); assert.ok(Math.abs(point.y - center.y) <= h.target.metrics.height * .08)
        assert.equal(flash.alpha, 1)
        assert.deepEqual(cues, ['impact'])
      }
      const snow = h.node('blizzard-continuing-snow'), wind = h.node('blizzard-continuing-wind')
      h.tl.time(2.43, false); const firstSnow = drawing(snow), firstWind = drawing(wind)
      const shard = h.node('blizzard-large-shard-6-0'), firstY = h.point(shard).y
      h.tl.time(2.49, false); const secondY = h.point(shard).y
      h.tl.time(2.55, false); const thirdY = h.point(shard).y
      assert.notEqual(drawing(snow), firstSnow); assert.notEqual(drawing(wind), firstWind)
      assert.ok(secondY > firstY && thirdY - secondY > secondY - firstY, 'ice fragment accelerates down in both mirrored directions')
      h.tl.time(blizzardTiming.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('new late weather artwork fits both perspectives and portrait fields and cancels without stale poses', async () => {
  for (const sourceId of ['source', 'target']) for (const custom of [false, true]) for (const id of ['thunder', 'blizzard']) {
    const h = harness(sourceId, custom)
    try {
      const run = h.play(id); await tick()
      let visible = 0
      for (let time = 1.46; time < 2.74; time += .017) {
        if (time >= definitions[id].duration - .015) break
        h.tl.time(time, false)
        visible += boundedReviewArt(h, h.node(id === 'thunder' ? 'thunder-second-impact' : 'blizzard-late-storm'))
      }
      assert.ok(visible > 30)
      run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h)
      const early = h.play(id); await tick(); h.tl.time(.45, false)
      early.cancel(); assert.equal((await early.finished).status, 'cancelled'); clean(h)
    } finally { h.dispose() }
  }
})
