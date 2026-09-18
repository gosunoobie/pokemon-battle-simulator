import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import thunder, { timing as thunderTiming } from '../packages/battle-fx/src/review-batch-five-v2/thunder.js'
import blizzard, { timing as blizzardTiming } from '../packages/battle-fx/src/review-batch-five-v2/blizzard.js'
import oldThunder, { timing as oldThunderTiming } from '../packages/battle-fx/src/review-batch-five/thunder.js'
import oldBlizzard, { timing as oldBlizzardTiming } from '../packages/battle-fx/src/review-batch-five/blizzard.js'
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
function bounded(h, root, ground = Infinity) {
  let visible = 0
  function walk(node, alpha = 1) {
    const opacity = alpha * node.alpha
    if (opacity > .03 && node.constructor.name === 'Graphics') {
      const b = node.getBounds()
      if (b.width > 0 && b.height > 0) {
        visible++
        assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
          `${node.label} stays inside field: ${JSON.stringify(b)}`)
        assert.ok(b.y + b.height <= ground + .05, `${node.label} cannot extend below target ground ${ground}: ${JSON.stringify(b)}`)
      }
    }
    for (const child of node.children ?? []) walk(child, opacity)
  }
  walk(root)
  for (const actor of h.scene.actors.values()) {
    const center = actor.anchor('visualCenter'), width = actor.metrics.width / 2, height = actor.metrics.height / 2
    assert.ok(center.x - width >= -.05 && center.y - height >= -.05 && center.x + width <= h.scene.width + .05 && center.y + height <= h.scene.height + .05)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  }
  return visible
}
const drawing = node => JSON.stringify(node.context.instructions.map(instruction => instruction.data.path?.instructions))

test('second weather review preserves every v1 cue, pulse and duration without replacing either earlier builder', () => {
  assert.deepEqual(thunderTiming, oldThunderTiming)
  assert.deepEqual(blizzardTiming, oldBlizzardTiming)
  assert.notEqual(thunder, oldThunder); assert.notEqual(blizzard, oldBlizzard)
  assert.deepEqual(EFFECT_TIMINGS.thunder, { contact: .84, duration: 2.45 })
  assert.deepEqual(EFFECT_TIMINGS.blizzard, { contact: .82, duration: 2.65 })
  assert.notEqual(MOVE_EFFECTS.thunder.build, thunder); assert.notEqual(MOVE_EFFECTS.blizzard.build, blizzard)
})

test('Thunder late dome is rooted on visible ground with glow, varied branching paths and no art below the feet', async () => {
  for (const sourceId of ['source', 'target']) for (const custom of [false, true]) {
    const h = harness(sourceId, custom), cues = []
    try {
      const run = h.play('thunder', cue => cues.push(cue.type)); await tick()
      h.tl.time(.84, false); assert.deepEqual(cues, ['impact'])
      h.tl.time(1.4924, false); assert.equal(h.node('thunder-second-impact').alpha, 0)
      let visible = 0
      for (let time = 1.4925; time <= 2.48; time += .013) {
        h.tl.time(time, false)
        const root = h.node('thunder-second-impact'), center = h.target.anchor('visualCenter')
        const ground = { x: center.x, y: center.y + h.target.metrics.height / 2 }
        close(h.point(root), ground, 'dome roots at actual visible feet, independent of legacy floor')
        visible += bounded(h, root, ground.y)
      }
      assert.ok(visible > 80)
      assert.deepEqual(cues, ['impact'])
      h.tl.time(2.5, false); assert.equal(h.node('thunder-second-impact').alpha, 0)
      h.tl.time(thunderTiming.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      const next = h.play('thunder'); await tick(); h.tl.time(1.5825, false)
      const discharge = h.node('thunder-second-discharge'), before = drawing(discharge)
      const fills = discharge.context.instructions.filter(instruction => instruction.action === 'fill')
      assert.ok(fills.length >= 10, 'layered translucent glow accompanies the branches')
      const linePaths = discharge.context.instructions.filter(instruction => instruction.action === 'stroke')
        .map(instruction => instruction.data.path.instructions)
      const endpointRadii = linePaths.map(path => path.filter(part => part.action === 'lineTo').at(-1)?.data)
        .filter(Boolean).map(([x, y]) => Math.round(Math.hypot(x, y)))
      assert.ok(new Set(endpointRadii).size >= 6, 'visible branch ends vary in distance from the ground root')
      h.tl.time(2.1, false); assert.notEqual(drawing(discharge), before)
      next.cancel(); assert.equal((await next.finished).status, 'cancelled'); clean(h)
    } finally { h.dispose() }
  }
})

test('each small Blizzard crystal visibly flies in, lodges, then grows continuously before the unchanged shatter', async () => {
  const pulses = [1.5165, 1.929, 2.004, 2.079, 2.154, 2.229, 2.304]
  for (const sourceId of ['source', 'target']) for (const [i, impact] of pulses.entries()) {
    const h = harness(sourceId), cues = []
    try {
      const run = h.play('blizzard', cue => cues.push(cue.type)); await tick()
      const start = impact - .42, lodge = impact - .16, crystal = h.node(`blizzard-large-crystal-${i}`), flash = h.node(`blizzard-late-impact-${i}`)
      h.tl.time(start - .001, false); assert.equal(crystal.alpha, 0)
      h.tl.time(start + .04, false)
      const first = h.point(crystal), smallWidth = crystal.getLocalBounds().width
      assert.ok(crystal.alpha > .9); assert.ok(smallWidth < 23, `incoming crystal ${i} starts at the small snow size: ${smallWidth}`)
      h.tl.time(lodge - .00001, false); const almostLodged = h.point(crystal)
      assert.ok(Math.hypot(first.x - almostLodged.x, first.y - almostLodged.y) > 50, 'small crystal is trackable along its flight')
      h.tl.time(lodge, false); const lodged = h.point(crystal)
      close(almostLodged, lodged, 'flight ends continuously at the attachment')
      assert.equal(flash.alpha, 0); assert.ok(crystal.alpha > .9)
      h.tl.time(lodge + .065, false); const growingWidth = crystal.getLocalBounds().width
      close(h.point(crystal), lodged, 'front tip stays lodged while the ice grows')
      assert.ok(growingWidth > smallWidth * 1.6)
      h.tl.time(impact - .001, false); const fullWidth = crystal.getLocalBounds().width
      assert.ok(fullWidth > growingWidth * 1.2)
      close(h.point(crystal), lodged, 'fully grown crystal retains the same attachment')
      assert.equal(flash.alpha, 0)
      h.tl.time(impact, false); close(h.point(crystal), h.point(flash), 'same crystal fractures at the lodged point')
      assert.equal(flash.alpha, 1)
      h.tl.time(impact + .025, false); assert.equal(crystal.alpha, 0)
      assert.ok(h.node(`blizzard-large-shard-${i}-0`).alpha > .5)
      assert.deepEqual(cues, ['impact'])
      run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h)
    } finally { h.dispose() }
  }
})

test('Blizzard keeps moving through the fade with bounded lodged ice, downward fragments and full cleanup', async () => {
  for (const sourceId of ['source', 'target']) for (const custom of [false, true]) {
    const h = harness(sourceId, custom), cues = []
    try {
      const run = h.play('blizzard', cue => cues.push(cue.type)); await tick()
      let visible = 0
      for (let time = 1.09; time <= 2.70; time += .011) {
        h.tl.time(time, false); visible += bounded(h, h.node('blizzard-late-storm'))
      }
      assert.ok(visible > 100); assert.deepEqual(cues, ['impact'])
      h.tl.time(blizzardTiming.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      const next = h.play('blizzard'); await tick()
      const snow = h.node('blizzard-continuing-snow'), wind = h.node('blizzard-continuing-wind'), shard = h.node('blizzard-large-shard-6-0')
      h.tl.time(2.43, false); const firstSnow = drawing(snow), firstWind = drawing(wind), firstY = h.point(shard).y
      h.tl.time(2.49, false); const secondY = h.point(shard).y
      h.tl.time(2.55, false); const thirdY = h.point(shard).y
      assert.notEqual(drawing(snow), firstSnow); assert.notEqual(drawing(wind), firstWind)
      assert.ok(secondY > firstY && thirdY - secondY > secondY - firstY)
      next.cancel(); assert.equal((await next.finished).status, 'cancelled'); clean(h)
      const early = h.play('blizzard'); await tick(); h.tl.time(.4, false); early.cancel()
      assert.equal((await early.finished).status, 'cancelled'); clean(h)
    } finally { h.dispose() }
  }
})
