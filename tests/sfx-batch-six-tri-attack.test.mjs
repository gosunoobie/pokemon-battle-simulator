import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS, EFFECT_TIMINGS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import triAttack, { timing } from '../packages/battle-fx/src/review-batch-six/tri-attack.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const close = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .02, `${label}: ${a.x},${a.y} / ${b.x},${b.y}`)
const drawing = node => JSON.stringify(node.context.instructions.map(instruction => instruction.data.path?.instructions))
function harness(sourceId = 'source', layout = 0, original = false) {
  let timeline
  const scene = createSceneGraph(layout ? { width: layout === 1 ? 560 : 720, height: layout === 1 ? 700 : 600, actors: [
    { id: 'source', profile: 'wide', x: layout === 1 ? .32 : .27, y: .81, height: layout === 1 ? .20 : .26, facing: 1, anchors: { emission: [.76, .18] } },
    { id: 'target', profile: 'tall', x: layout === 2 ? .92 : .76, y: layout === 3 ? .31 : .52, height: .19, facing: -1,
      anchors: { center: layout === 3 ? [.5, .05] : [.48, .42] } },
  ] } : {})
  const effect = original ? MOVE_EFFECTS['tri-attack'] : { ...MOVE_EFFECTS['tri-attack'], build: triAttack, contact: timing.contact, duration: timing.duration }
  const fx = createBattleFx({ effects: { 'tri-attack': effect }, glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } } })
  const targetId = sourceId === 'source' ? 'target' : 'source'
  return { scene, fx, sourceId, source: scene.actor(sourceId), target: scene.actor(targetId), get tl() { return timeline },
    play(options = {}) { return fx.play({ moveId: 'tri-attack', sourceId, targetIds: [targetId], visualSeed: 42 }, { scene, ...options }) },
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
function bounds(h) {
  let seen = 0
  function walk(node, alpha = 1) {
    const opacity = alpha * node.alpha
    if (opacity > .025 && ['Graphics', 'Sprite'].includes(node.constructor.name)) {
      const b = node.getBounds()
      if (b.width > 0 && b.height > 0) {
        seen++
        assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
          `${h.sourceId}/${h.tl.time()}/${node.label}: ${JSON.stringify(b)}`)
      }
    }
    for (const child of node.children ?? []) walk(child, opacity)
  }
  walk(h.scene.effects)
  for (const actor of h.scene.actors.values()) {
    const c = actor.anchor('visualCenter'), w = actor.metrics.width / 2, height = actor.metrics.height / 2
    assert.ok(c.x - w >= -.05 && c.x + w <= h.scene.width + .05 && c.y - height >= -.05 && c.y + height <= h.scene.height + .05,
      `${h.sourceId}/${actor.id} actor bounds at ${h.tl.time()}`)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  }
  return seen
}

test('Tri Attack phases use the original cue and measured native-recording accents without gameplay imports', async () => {
  assert.notEqual(MOVE_EFFECTS['tri-attack'].build, triAttack)
  assert.equal(timing.contact, EFFECT_TIMINGS['tri-attack'].contact)
  const analysis = JSON.parse(await readFile(new URL('../tools/audio-import/reports/sfx-remaining-analysis.json', import.meta.url)))
  const sound = analysis.measurements.find(item => item.assetId === 'source.tri-attack')
  assert.equal(sound.durationSeconds, 4.72); assert.ok(timing.duration > sound.durationSeconds)
  for (const [id, frame] of [['burn-crest', 62622], ['spark', 81144], ['spark-crest', 86436], ['crackle', 95697], ['freeze', 117747], ['ice-shatter', 164493]]) {
    assert.ok([sound.strongestEnergyWindow, ...sound.positiveEnergyRises].some(row => row.startFrame === frame))
    assert.equal(timing.markers.find(marker => marker.id === id).timeSeconds, frame / sound.sampleRate)
  }
  const text = await readFile(new URL('../packages/battle-fx/src/review-batch-six/tri-attack.js', import.meta.url), 'utf8')
  assert.doesNotMatch(text, /from ['"][^'"]*(?:battle-core|battle-sfx|apps\/|vue|pokemon-sprites)/)
  assert.doesNotMatch(text, /requestAnimationFrame|setInterval|setTimeout/)
})

test('the original triangle formation, flight, orb artwork and convergence remain unchanged at default geometry', async () => {
  for (const sourceId of ['source', 'target']) {
    const old = harness(sourceId, 0, true), next = harness(sourceId)
    try {
      const oldRun = old.play(), newRun = next.play(); await tick()
      for (const time of [.15, .30, .42, .48, .66, .90, 1.06]) {
        old.tl.time(time, false); next.tl.time(time, false)
        for (let i = 0; i < 3; i++) {
          const a = old.node(`tri-attack-orb-${i}`), b = next.node(`tri-attack-orb-${i}`)
          close(old.point(a), next.point(b), `orb ${i} at ${time}`)
          close(a.scale, b.scale, 'original orb scale'); assert.equal(a.alpha, b.alpha)
          assert.deepEqual(a.children.map(drawing), b.children.map(drawing))
        }
        close(old.source.pose, next.source.pose, 'original source motion')
      }
      oldRun.cancel(); newRun.cancel(); await Promise.all([oldRun.finished, newRun.finished]); clean(old); clean(next)
    } finally { old.dispose(); next.dispose() }
  }
})

test('fire, electricity and upright freezing progress in sequence while following the posed receiver', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(sourceId), cues = []
    try {
      const run = h.play({ onCue(cue) {
        cues.push(cue.type)
        for (let i = 0; i < 3; i++) close(h.point(h.node(`tri-attack-orb-${i}`)), h.target.anchor('center'), 'all three orbs converge before result')
      } }); await tick()
      h.tl.time(1.06, false); assert.deepEqual(cues, ['impact'])
      h.tl.time(1.41, false); const fire = h.node('tri-attack-burning'), fireDrawing = drawing(fire)
      assert.equal(fire.alpha, 1); assert.equal(h.node('tri-attack-electric').alpha, 0)
      h.tl.time(1.47, false); assert.notEqual(drawing(fire), fireDrawing, 'flames keep moving')
      h.tl.time(1.96, false); const sparks = h.node('tri-attack-electric'), sparksDrawing = drawing(sparks)
      assert.equal(fire.alpha, 0); assert.equal(sparks.alpha, 1)
      h.target.pose.x += 6; h.target.pose.y -= 7
      h.tl.time(2.03, false); assert.notEqual(drawing(sparks), sparksDrawing)
      const c = h.target.anchor('visualCenter')
      close(h.point(sparks), { x: c.x, y: c.y + h.target.metrics.height / 2 }, 'electric dome stays at live visible feet')
      h.tl.time(2.70, false); const crystal = h.node('tri-attack-ice-0'), small = crystal.scale.y
      assert.equal(sparks.alpha, 0); assert.ok(crystal.alpha > .6); assert.equal(crystal.rotation, 0)
      h.tl.time(2.95, false); assert.ok(crystal.scale.y > small * 2)
      const before = h.point(crystal); h.target.pose.x += 5; h.target.pose.y -= 6
      h.tl.time(3.02, false); close(h.point(crystal), { x: before.x + 5, y: before.y - 6 }, 'upright ice stays attached')
      const xs = new Set(Array.from({ length: 7 }, (_, i) => h.point(h.node(`tri-attack-ice-${i}`)).x.toFixed(3)))
      assert.equal(xs.size, 7, 'ice grows around the body instead of one shared lane')
      h.tl.time(3.73, false); assert.equal(crystal.alpha, 0); assert.ok(h.node('tri-attack-ice-flash-0').context.instructions.length > 0)
      const shard = h.node('tri-attack-ice-shard-6-0'), ys = []
      for (const time of [4.51, 4.56, 4.61]) { h.tl.time(time, false); ys.push(h.point(shard).y) }
      assert.ok(ys[1] > ys[0] && ys[2] - ys[1] > ys[1] - ys[0], 'last ice falls with world-down acceleration')
      assert.ok(shard.alpha > .3); assert.deepEqual(cues, ['impact'])
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('Tri Attack fits its complete art and actors from either side in portrait and edge layouts and restores on every exit', async () => {
  for (const sourceId of ['source', 'target']) for (const layout of [0, 1, 2, 3]) {
    const h = harness(sourceId, layout)
    try {
      const run = h.play(); await tick(); let seen = 0
      for (let time = .017; time < timing.duration - .01; time += .037) { h.tl.time(time, false); seen += bounds(h) }
      assert.ok(seen > 200)
      run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h)
      for (const time of [.32, 1.42, 1.96, 3.2, 4.55]) {
        const cancelled = h.play(); await tick(); h.tl.time(time, false); cancelled.cancel()
        assert.equal((await cancelled.finished).status, 'cancelled'); clean(h)
      }
      const skipped = h.play({ reducedMotion: true }); await tick(); h.tl.time(h.tl.duration(), false)
      assert.equal((await skipped.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})
