import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const projectiles = [
  ['bullet-seed', 'emission', .25, .105, .36, 5, 1.7],
  ['pin-missile', 'spike', .3, .12, .46, 4, 1.8],
  ['spike-cannon', 'spike', .28, .19, .31, 3, 1.65],
  ['icicle-spear', 'emission', .34, .2, .5, 3, 2],
  ['barrage', 'emission', .27, .13, .42, 5, 1.95],
  ['rock-blast', 'emission', .32, .2, .4, 3, 1.85],
  ['twineedle', 'stinger', .28, .2, .43, 2, 1.6],
]
const ids = [...projectiles.map(([id]) => id), 'bone-rush', 'bonemerang']
function harness(reverse = false, lower = false) {
  let timeline
  const scene = createSceneGraph({ width: 720, height: 600, actors: [
    { id: 'source', profile: 'wide', x: reverse ? .74 : .26, y: lower ? .99 : .82, height: .26, facing: reverse ? -1 : 1,
      anchors: { emission: [.8, lower ? .97 : .34], spike: [.75, lower ? .97 : .22], stinger: [.87, .63], bone: [.38, .43] } },
    { id: 'target', profile: 'tall', x: reverse ? .26 : .74, y: lower ? .99 : .62, height: .2, facing: reverse ? 1 : -1,
      anchors: { center: [.48, lower ? .95 : .44] } },
  ] })
  const fx = createBattleFx({ glowTexture: Texture.WHITE, timelineEngine: { timeline(options) { return timeline = gsap.timeline({ ...options, paused: true }) } } })
  return { scene, fx, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node), dispose() { fx.dispose(); scene.dispose() } }
}
const close = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  for (const actor of h.scene.actors.values()) {
    for (const key of ['x', 'y', 'rotation']) assert.equal(actor.pose[key], 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    assert.equal(actor.pose.tint, 0xffffff)
  }
}

test('counted projectiles launch only the actual shots, hold their live socket, and cue every visible contact', async () => {
  for (const reverse of [false, true]) for (const lower of [false, true]) {
    const h = harness(reverse, lower), source = h.scene.actor('source'), target = h.scene.actor('target')
    try {
      for (const [id, anchor, start, gap, flight, legacyCount, legacyDuration] of projectiles) {
        for (let count = 1; count <= (id === 'twineedle' ? 2 : 5); count++) {
          const cues = [], launches = [], hits = [], shot = i => h.node(`${id}-${id === 'rock-blast' ? 'stone' : 'shot'}-${i}`)
          const times = Array.from({ length: count }, (_, i) => start + gap * i + flight + (id === 'barrage' ? i % 2 * .03 : 0))
          const run = h.fx.play({ moveId: id, hitCount: count, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => {
            cues.push(cue.type === 'hit' ? cue.hitIndex : cue.type)
            if (cue.type !== 'hit') return
            const i = cue.hitIndex - 1, point = h.point(shot(i)), center = target.anchor('visualCenter')
            close(point, h.point(h.node(`${id}-impact-${i}`)), `${id} contact geometry before cue ${i}`)
            assert.ok(Math.abs(point.y - center.y) <= target.metrics.height / 2 + .05, `${id} visible target lane`)
            assert.ok(shot(i).alpha > .9, `${id} shot visible at contact`)
            hits.push(point)
          } })
          await tick()
          assert.ok(h.tl.data?.hitTimes, `${id} publishes actual contacts`)
          assert.equal(h.tl.data.hitTimes.length, count)
          for (let i = 0; i < count; i++) assert.ok(Math.abs(h.tl.data.hitTimes[i] - times[i]) < .000001)
          assert.equal(shot(count), null, `${id} has no extra shot`)
          const events = times.map((at, i) => ({ at, hit: i })).concat(times.map((_, i) => ({ at: start + gap * i, launch: i }))).sort((a, b) => a.at - b.at)
          for (const event of events) {
            h.tl.time(event.at, false)
            if (event.launch !== undefined) {
              const point = h.point(shot(event.launch))
              close(point, source.anchor(anchor), `${id} live launch ${event.launch}`)
              launches.push(point)
            }
          }
          for (const point of launches) close(point, launches[0], `${id} holds firing pose through final launch`)
          assert.deepEqual(cues, [...Array.from({ length: count }, (_, i) => i + 1), 'impact'])
          assert.equal(hits.length, count)
          const duration = legacyDuration + (count - legacyCount) * gap
          assert.ok(Math.abs(h.tl.duration() - duration) < .000001, `${id} uses count duration`)
          h.tl.time(duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
        }
      }
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('Bone Rush repeats its attached alternating strikes once per landed hit and then recovers', async () => {
  for (const reverse of [false, true]) for (let count = 1; count <= 5; count++) {
    const h = harness(reverse), cues = []
    try {
      const run = h.fx.play({ moveId: 'bone-rush', hitCount: count, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene, onCue: cue => {
        cues.push(cue.type === 'hit' ? cue.hitIndex : cue.type)
        close(h.point(h.node('bone-rush-root')), h.scene.actor('source').anchor('bone'), 'Bone Rush attached root')
        close(h.point(h.node('bone-rush-tip')), h.scene.actor('target').anchor('center'), 'Bone Rush leading cap')
      } })
      await tick()
      for (let i = 0; i < count; i++) {
        h.tl.time(.54 + i * .31, false)
        close(h.point(h.node(`bone-rush-contact-${i}`)), h.scene.actor('target').anchor('center'), 'Bone Rush contact marker')
      }
      assert.equal(h.node(`bone-rush-contact-${count}`), null)
      assert.deepEqual(cues, [...Array.from({ length: count }, (_, i) => i + 1), 'impact'])
      h.tl.time(h.tl.duration(), false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('Bonemerang catches after its actual final hit, including a direct return after an early knockout', async () => {
  for (const reverse of [false, true]) for (const count of [1, 2]) {
    const h = harness(reverse), cues = []
    try {
      const run = h.fx.play({ moveId: 'bonemerang', hitCount: count, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene, onCue: cue => {
        cues.push(cue.type === 'hit' ? cue.hitIndex : cue.type)
        close(h.point(h.node('bonemerang-tip')), h.scene.actor('target').anchor('center'), 'Bonemerang foremost cap at every cue')
      } })
      await tick(); h.tl.time(.28, false)
      close(h.point(h.node('bonemerang-tip')), h.scene.actor('source').anchor('bone'), 'Bonemerang release')
      h.tl.time(.7, false)
      if (count === 2) h.tl.time(1.35, false)
      else {
        h.tl.time(.9, false)
        assert.ok(Math.hypot(h.point(h.node('bonemerang-tip')).x - h.scene.actor('target').anchor('center').x, h.point(h.node('bonemerang-tip')).y - h.scene.actor('target').anchor('center').y) > 20, 'one-hit Bonemerang immediately returns')
        assert.equal(h.node('bonemerang-impact').alpha, 0, 'no phantom second burst')
      }
      h.tl.time(count === 1 ? 1.28 : 1.93, false)
      close(h.point(h.node('bonemerang-tip')), h.scene.actor('source').anchor('bone'), 'Bonemerang catch')
      assert.deepEqual(cues, [...Array.from({ length: count }, (_, i) => i + 1), 'impact'])
      h.tl.time(h.tl.duration(), false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('counted projectile and bone sequences cancel between hits and reconcile reduced motion cleanly', async () => {
  const h = harness()
  try {
    for (const id of ids) {
      const count = ['twineedle', 'bonemerang'].includes(id) ? 2 : 5, cues = []
      const run = h.fx.play({ moveId: id, hitCount: count, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene, onCue: cue => cues.push(cue) })
      await tick(); h.tl.time(h.tl.data.hitTimes[0] + .01, false)
      assert.deepEqual(cues.map(cue => cue.hitIndex), [1])
      const oldTimeline = h.tl; run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h)
      oldTimeline.time(oldTimeline.duration(), false); assert.equal(cues.length, 1, 'cancelled playback cannot emit later hits')
      const reduced = []
      const reducedRun = h.fx.play({ moveId: id, hitCount: count, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene, reducedMotion: true, onCue: cue => reduced.push(cue.type) })
      await tick(); h.tl.time(.8, false); assert.equal((await reducedRun.finished).status, 'completed')
      assert.deepEqual(reduced, ['impact']); clean(h)
    }
  } finally { h.dispose() }
  gsap.ticker.sleep()
})

test('counted Icicle Spear keeps every rotating shard inside portrait field edges', async () => {
  const vertices = [[0, -5], [2, 0], [0, 4], [-2, 0]]
  for (const reverse of [false, true]) for (const edge of ['side', 'top', 'bottom']) {
    let timeline
    const scene = createSceneGraph({ width: 560, height: 700, actors: [
      { id: 'source', profile: 'wide', x: reverse ? .75 : .25, y: .82, height: .24, facing: reverse ? -1 : 1, anchors: { emission: [.8, .34] } },
      { id: 'target', profile: 'tall', x: reverse ? (edge === 'side' ? .06 : .26) : (edge === 'side' ? .94 : .74),
        y: edge === 'top' ? .2 : edge === 'bottom' ? .99 : .62, height: .18, facing: reverse ? 1 : -1 },
    ] })
    const fx = createBattleFx({ glowTexture: Texture.WHITE, timelineEngine: { timeline(options) { return timeline = gsap.timeline({ ...options, paused: true }) } } })
    try {
      const run = fx.play({ moveId: 'icicle-spear', hitCount: 5, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene })
      await tick()
      const shards = Array.from({ length: 5 }, (_, shot) => Array.from({ length: 12 }, (_, shard) => scene.effects.getChildByLabel(`icicle-spear-shard-${shot}-${shard}`, true))).flat()
      assert.ok(shards.every(Boolean))
      let seen = 0
      for (let time = .83; time < 2.12; time += .01) {
        timeline.time(time, false)
        for (const shard of shards) if (shard.alpha > .001) {
          seen++
          for (const [x, y] of vertices) {
            const point = scene.effects.toLocal({ x, y }, shard)
            assert.ok(point.x >= -.001 && point.x <= scene.width + .001 && point.y >= -.001 && point.y <= scene.height + .001,
              `Icicle Spear ${shard.label} ${edge} reflected ${reverse} at ${time}: ${JSON.stringify(point)}`)
          }
        }
      }
      assert.ok(seen > 0)
      timeline.time(timeline.duration(), false); assert.equal((await run.finished).status, 'completed')
      assert.equal(scene.effects.children.length, 0)
    } finally { fx.dispose(); scene.dispose() }
  }
  gsap.ticker.sleep()
})
