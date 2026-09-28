import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const moves = [
  ['double-slap', 5, 'palm'], ['comet-punch', 5, 'fist'], ['fury-attack', 5, 'tip'],
  ['fury-swipes', 5, 'tip'], ['arm-thrust', 5, 'palm'], ['double-kick', 2, 'foot'],
  ['triple-kick', 3, 'foot'], ['beat-up', 6, 'tip'],
]
function harness(reverse = false, portrait = false, edge = false) {
  let timeline
  const scene = createSceneGraph({ width: portrait ? 560 : 720, height: portrait ? 700 : 600, actors: [
    { id: 'source', profile: 'wide', x: reverse ? .72 : .28, y: .82, height: portrait ? .2 : .24, facing: reverse ? -1 : 1,
      anchors: { origin: [.43, .94], hand: [.76, .43], palm: [.71, .41], fist: [.69, .42], horn: [.72, .19], claw: [.65, .43], foot: [.77, .86] } },
    { id: 'target', profile: 'tall', x: reverse ? (edge ? .06 : .26) : (edge ? .94 : .74), y: .62, height: .18, facing: reverse ? 1 : -1 },
  ] })
  const fx = createBattleFx({ glowTexture: Texture.WHITE, timelineEngine: { timeline(options) { return timeline = gsap.timeline({ ...options, paused: true }) } } })
  return { scene, fx, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true), point: (node, x = 0) => scene.effects.toLocal({ x, y: 0 }, node), dispose() { fx.dispose(); scene.dispose() } }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
  for (const actor of h.scene.actors.values()) {
    assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.tint, 0xffffff)
  }
}
const close = (a, b, label, tolerance = .06) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < tolerance, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
function contact(h, moveId, part, index, count) {
  const source = h.scene.actor('source'), target = h.scene.actor('target')
  const node = h.node(moveId === 'beat-up' && index < count ? `beat-up-ally-strike-${index - 1}` : `${moveId}-${part}`)
  assert.ok(node?.alpha > .7, `${moveId} strike ${index} is visible at its cue`)
  if (part === 'foot') {
    const unit = Math.min(h.scene.unit * 1.25, Math.max(h.scene.unit * .6, target.metrics.height / 168.90625))
    const r = moveId === 'double-kick' ? Math.min(34, Math.max(21, source.metrics.height / unit * .135)) : Math.min(29, Math.max(18, source.metrics.height / unit * .115))
    close(h.point(node), source.anchor('foot'), `${moveId} live foot attachment`)
    close(h.point(node, r), h.point(h.node(`${moveId}-impact-${index - 1}`)), `${moveId} toe contact ${index}`)
  } else {
    close(h.point(node), target.anchor('center'), `${moveId} leading contact ${index}`, moveId === 'fury-attack' ? 8 : .06)
    if (moveId === 'fury-swipes') close(h.point(h.node('fury-swipes-root')), source.anchor('claw'), 'live claw root')
  }
}

test('every supported physical hit count reveals only its visible contacts from either perspective', async () => {
  for (const reverse of [false, true]) for (const portrait of [false, true]) {
    const h = harness(reverse, portrait)
    try {
      for (const [moveId, max, part] of moves) for (let hitCount = 1; hitCount <= max; hitCount++) {
        const cues = []
        const run = h.fx.play({ moveId, sourceId: 'source', targetIds: ['target'], visualSeed: 42, hitCount }, { scene: h.scene, onCue: cue => {
          contact(h, moveId, part, cue.type === 'hit' ? cue.hitIndex : hitCount, hitCount)
          cues.push(cue)
        } })
        await tick()
        const times = h.tl.data.hitTimes, duration = h.tl.duration()
        assert.equal(times.length, hitCount)
        assert.ok(duration > times.at(-1), `${moveId} has recovery after its last hit`)
        for (const [index, at] of times.entries()) {
          h.tl.time(at - .001, false); assert.equal(cues.length, index, `${moveId} does not reveal a hit early`)
          h.tl.time(at, false)
          assert.deepEqual(cues.slice(0, index + 1), Array.from({ length: index + 1 }, (_, i) => ({ type: 'hit', hitIndex: i + 1 })))
          if (index + 1 < hitCount) assert.equal(cues.length, index + 1)
        }
        assert.deepEqual(cues, [...Array.from({ length: hitCount }, (_, i) => ({ type: 'hit', hitIndex: i + 1 })), { type: 'impact' }])
        h.tl.time(duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      }
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('single-hit termination and maximum physical sequences clean up on cancellation and reduced motion', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try {
      for (const [moveId, max] of moves) for (const hitCount of [1, max]) {
        for (const afterContact of [false, true]) {
          const cues = []
          const run = h.fx.play({ moveId, sourceId: 'source', targetIds: ['target'], hitCount }, { scene: h.scene, onCue: cue => cues.push(cue) })
          await tick()
          const timeline = h.tl, first = timeline.data.hitTimes[0], duration = timeline.duration()
          timeline.time(afterContact ? first + .06 : first / 2, false)
          run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h)
          const seen = cues.length; timeline.time(duration, false); assert.equal(cues.length, seen, 'cancelled hits cannot reveal stale results')
        }
        const cues = []
        const run = h.fx.play({ moveId, sourceId: 'source', targetIds: ['target'], hitCount }, { scene: h.scene, reducedMotion: true, onCue: cue => cues.push(cue) })
        await tick(); h.tl.time(.8, false)
        assert.equal((await run.finished).status, 'completed'); assert.deepEqual(cues, [{ type: 'impact' }]); clean(h)
      }
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('extended physical sequences retain full actor bounds and scale at field edges', async () => {
  for (const reverse of [false, true]) for (const portrait of [false, true]) {
    const h = harness(reverse, portrait, true)
    try {
      for (const [moveId, hitCount] of moves) {
        const run = h.fx.play({ moveId, sourceId: 'source', targetIds: ['target'], hitCount, visualSeed: 42 }, { scene: h.scene })
        await tick()
        for (let time = .03; time < h.tl.duration(); time += .035) {
          h.tl.time(time, false)
          for (const actor of h.scene.actors.values()) {
            const p = actor.anchor('visualCenter'), c = Math.abs(Math.cos(actor.pose.rotation)), s = Math.abs(Math.sin(actor.pose.rotation))
            const rx = (actor.metrics.width * c + actor.metrics.height * s) / 2, ry = (actor.metrics.height * c + actor.metrics.width * s) / 2
            assert.ok(p.x - rx >= -.05 && p.y - ry >= -.05 && p.x + rx <= h.scene.width + .05 && p.y + ry <= h.scene.height + .05, `${moveId} ${actor.id} at ${time}`)
            assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
          }
        }
        h.tl.time(h.tl.duration(), false); assert.equal((await run.finished).status, 'completed'); clean(h)
      }
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})
