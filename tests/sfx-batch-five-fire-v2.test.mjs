import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS, EFFECT_TIMINGS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import previousFire from '../packages/battle-fx/src/review-batch-five/fire-blast.js'
import fireBlast, { timing as fireTiming } from '../packages/battle-fx/src/review-batch-five-v2/fire-blast.js'
import overheat, { timing as overheatTiming } from '../packages/battle-fx/src/review-batch-five-v2/overheat.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const variations = [['fire-blast', fireBlast, fireTiming], ['overheat', overheat, overheatTiming]]
const close = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .005, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
function harness(reverse = false, edge = 0, previous = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const scene = createSceneGraph({ width, height, actors: [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28, y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1, anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32] } },
    { id: 'target', profile: 'tall', x: reverse ? (edge >= 2 && edge !== 4 ? .055 : .26) : (edge >= 2 && edge !== 4 ? .945 : .74), y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: reverse ? 1 : -1, anchors: { center: edge === 3 ? [.5, .04] : [.48, .44] } },
  ] })
  const effects = Object.fromEntries(variations.map(([id, build, timing]) => [id, { ...MOVE_EFFECTS[id], build: previous && id === 'fire-blast' ? previousFire : build, contact: timing.contact, duration: timing.duration }]))
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

test('second fire review preserves prior registrations and anchors the added Overheat arrivals at later source crests', async () => {
  assert.deepEqual(EFFECT_TIMINGS['fire-blast'], { contact: 1.07, duration: 2.5 })
  assert.deepEqual(EFFECT_TIMINGS.overheat, { contact: .98, duration: 2.5 })
  assert.notEqual(MOVE_EFFECTS['fire-blast'].build, fireBlast); assert.notEqual(MOVE_EFFECTS.overheat.build, overheat)
  assert.equal(fireTiming.contact, 2.0225); assert.equal(fireTiming.duration, 3.15)
  assert.equal(overheatTiming.contact, .98); assert.equal(overheatTiming.duration, 2.5)
  assert.ok(Math.abs(fireTiming.contact / .75 - (1.07 / .75 - .91 + 2.18)) < 1e-9)
  for (const [id, sourceTime] of [['wave-four-impact', 1.63], ['wave-five-impact', 2.22], ['wave-six-impact', 2.39]]) {
    const marker = overheatTiming.markers.find(marker => marker.id === id)
    assert.ok(Math.abs(marker.timeSeconds / .8 - (.265 + sourceTime)) < 1e-9)
  }
  assert.equal(.265 + 2.86, overheatTiming.duration / .8)
  for (const [id] of variations) {
    const source = await readFile(new URL(`../packages/battle-fx/src/review-batch-five-v2/${id}.js`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from ['"][^'"]*(?:battle-core|battle-sfx|apps\/|vue|pokemon-sprites)/)
  }
})

test('Fire Blast charges earlier with a larger live orb while keeping the exact approved impact', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse), old = harness(reverse, 0, true), source = h.scene.actor('source'), target = h.scene.actor('target'), cues = []
    try {
      const run = h.run('fire-blast', { onCue(cue) {
        cues.push([cue.type, h.tl.time()])
        close(h.point(h.node('fire-blast-review-orb')), target.anchor('center'), 'orb arrives before cue')
        close(h.point(h.node('fire-blast-review-five-rays')), target.anchor('center'), 'flame burst starts at current receiver')
        assert.equal(h.node('fire-blast-review-five-rays').alpha, 1)
      } })
      const oldRun = old.run('fire-blast'); await tick()
      h.tl.time(.25, false); old.tl.time(.25, false)
      assert.equal(h.node('fire-blast-review-orb').alpha, 1, 'new orb is plainly visible in early windup')
      assert.equal(old.node('fire-blast-review-orb').alpha, 0)
      for (const time of [.25, .6, 1.2, 1.5, 1.5425]) { h.tl.time(time, false); close(h.point(h.node('fire-blast-review-orb')), source.anchor('emission'), 'live charge attachment') }
      for (const time of [1.2, 1.6, 1.95]) {
        h.tl.time(time, false); old.tl.time(time, false)
        assert.ok(h.node('fire-blast-review-orb').getBounds().width > old.node('fire-blast-review-orb').getBounds().width * 1.3, 'charge and flight orb are larger')
      }
      h.tl.time(2.0224, false); assert.deepEqual(cues, [])
      h.tl.time(2.0225, false); assert.deepEqual(cues, [['impact', 2.0225]])
      h.tl.time(fireTiming.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      oldRun.cancel(); await oldRun.finished; clean(old)
    } finally { h.dispose(); old.dispose() }
  }
})

test('all five Fire Blast arms contain moving flame puffs through the fading aftermath', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try {
      const run = h.run('fire-blast'); await tick()
      const arms = h.node('fire-blast-review-five-rays').children
      assert.equal(arms.length, 5)
      for (const arm of arms) assert.ok(arm.children.filter(child => child.constructor.name === 'Sprite').length >= 20, 'flame stream replaces the straight line')
      for (const [start, end] of [[2.18, 2.24], [2.7, 2.78]]) {
        h.tl.time(start, false)
        const puffs = arms.map(arm => arm.children[5]), before = puffs.map(node => h.point(node))
        assert.ok(h.node('fire-blast-review-five-rays').alpha > .2)
        h.tl.time(end, false)
        puffs.forEach((node, i) => assert.ok(Math.hypot(before[i].x - h.point(node).x, before[i].y - h.point(node).y) > 1, `arm ${i} keeps flowing`))
      }
      h.tl.time(fireTiming.duration, false); await run.finished; clean(h)
    } finally { h.dispose() }
  }
})

test('Overheat sends exactly six waves from its live nozzle and only the first arrival emits a result', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse), source = h.scene.actor('source'), target = h.scene.actor('target'), cues = []
    try {
      const run = h.run('overheat', { onCue(cue) {
        cues.push([cue.type, h.tl.time()])
        close(h.point(h.node('overheat-review-wave-1')), target.anchor('center'), 'first wave arrives before cue')
      } }); await tick()
      assert.equal(h.tl.duration(), 2.5)
      assert.equal(h.node('move-artwork').children.filter(node => /^overheat-review-wave-\d$/.test(node.label)).length, 6)
      const arrivals = [.98, 1.07, 1.16, 1.516, 1.988, 2.124]
      h.tl.time(.58, false); const firing = source.anchor('emission')
      for (const [i, arrival] of arrivals.entries()) {
        h.tl.time(arrival - .4, false)
        close(h.point(h.node(`overheat-review-wave-${i + 1}`)), source.anchor('emission'), `wave ${i + 1} uses current nozzle`)
        close(source.anchor('emission'), firing, 'source holds firing pose for every launch')
        h.tl.time(arrival, false)
        close(h.point(h.node(`overheat-review-wave-${i + 1}`)), target.anchor('center'), `wave ${i + 1} arrives at current target`)
        assert.ok(h.node(`overheat-review-wave-${i + 1}`).alpha > .85)
        assert.ok(h.node('overheat-review-impact-glow').alpha >= .68)
      }
      assert.deepEqual(cues, [['impact', .98]])
      h.tl.time(2.17, false); const last = h.node('overheat-review-spark-6-0'), before = h.point(last)
      h.tl.time(2.22, false); assert.ok(Math.hypot(before.x - h.point(last).x, before.y - h.point(last).y) > .5, 'last arrival emits moving sparks')
      h.tl.time(2.5, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('second-review fire artwork and full-scale actors fit both perspectives and constrained layouts', async () => {
  for (const reverse of [false, true]) for (const edge of [0, 1, 2, 3, 4]) {
    const h = harness(reverse, edge)
    try {
      for (const [id, , timing] of variations) {
        const run = h.run(id); await tick(); let visible = 0
        for (let time = .045; time < timing.duration - .02; time += .041) {
          h.tl.time(time, false)
          for (const actor of h.scene.actors.values()) {
            const p = actor.anchor('visualCenter'), rx = actor.metrics.width / 2, ry = actor.metrics.height / 2
            assert.ok(p.x - rx >= -.05 && p.x + rx <= h.width + .05 && p.y - ry >= -.05 && p.y + ry <= h.height + .05, `${id} actor bounds`)
            assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
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

test('second-review fire cancellation and reduced-motion replacement restore all presentation', async () => {
  for (const reverse of [false, true]) for (const [id, , timing] of variations) {
    const h = harness(reverse)
    try {
      for (const time of [.4, timing.contact + .035, timing.duration - .15]) {
        const run = h.run(id); await tick(); h.tl.time(time, false); run.cancel()
        assert.equal((await run.finished).status, 'cancelled'); clean(h)
      }
      const old = h.run(id); await tick(); h.tl.time(timing.contact + .03, false)
      const replacement = h.run(id, { reducedMotion: true }); assert.equal((await old.finished).status, 'cancelled'); await tick(); old.cancel()
      h.tl.time(.8, false); assert.equal((await replacement.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})
