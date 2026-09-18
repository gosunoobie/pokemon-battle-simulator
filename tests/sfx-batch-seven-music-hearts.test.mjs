import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import sing, { timing as singTiming } from '../packages/battle-fx/src/review-batch-seven/sing.js'
import grassWhistle, { timing as grassTiming } from '../packages/battle-fx/src/review-batch-seven/grass-whistle.js'
import attract, { timing as attractTiming } from '../packages/battle-fx/src/review-batch-seven/attract.js'

const cases = [
  { id: 'sing', build: sing, timing: singTiming, native: 184535 / 44100, originalDuration: 2.5, count: 7, total: 26,
    prefix: 'sing-note-', target: 'sing-lullaby', changingAlpha: ['sing-lullaby'], openingEnd: 1.03, release: 3.2, travel: .76, fade: 3.81 },
  { id: 'grass-whistle', build: grassWhistle, timing: grassTiming, native: 3.44, originalDuration: 2.5, count: 5, total: 17,
    prefix: 'grass-whistle-pulse-', target: 'grass-whistle-drift', changingAlpha: ['grass-whistle-leaf', 'grass-whistle-drift'], openingEnd: 1.029, release: 2.68, travel: .6, fade: 2.99 },
  { id: 'attract', build: attract, timing: attractTiming, native: 6.01, originalDuration: 2.55, count: 5, total: 5,
    prefix: 'attract-heart-', target: 'attract-orbit', changingAlpha: ['attract-orbit'], openingEnd: 1.979, fade: 5.59 },
]
const tick = () => new Promise(resolve => setImmediate(resolve))
const close = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
const fixtures = [undefined,
  { width: 620, height: 650, actors: [
    { id: 'source', profile: 'wide', x: .30, y: .78, height: .20, facing: 1 },
    { id: 'target', profile: 'tall', x: .79, y: .45, height: .20, facing: -1 },
  ] },
  { width: 720, height: 600, actors: [
    { id: 'source', profile: 'wide', x: .23, y: .80, height: .25, facing: 1 },
    { id: 'target', profile: 'tall', x: .93, y: .31, height: .22, facing: -1, anchors: { center: [.12, .06] } },
  ] },
  { width: 720, height: 600, actors: [
    { id: 'source', profile: 'wide', x: .30, y: .84, height: .26, facing: 1 },
    { id: 'target', profile: 'tall', x: .75, y: .27, height: .26, facing: -1, anchors: { center: [.5, .03] } },
  ] },
]
function harness(row, sourceId = 'source', fixture = 0, original = false) {
  const scene = createSceneGraph(fixtures[fixture]); let timeline
  // Holding the comparison clock open also checks the original ongoing orbit math after its old fade.
  const effect = { ...MOVE_EFFECTS[row.id], build: original ? MOVE_EFFECTS[row.id].build : row.build, ...row.timing }
  const fx = createBattleFx({ effects: { [row.id]: effect }, glowTexture: Texture.WHITE,
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } },
  })
  const targetId = sourceId === 'source' ? 'target' : 'source'
  return { scene, fx, source: scene.actor(sourceId), target: scene.actor(targetId), get tl() { return timeline },
    node: label => scene.effects.getChildByLabel(label, true), point: (node, p = { x: 0, y: 0 }) => scene.effects.toLocal(p, node),
    play(onCue, reducedMotion = false) { return fx.play({ moveId: row.id, sourceId, targetIds: [targetId], visualSeed: 42 }, { scene, onCue, reducedMotion }) },
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
const art = node => node.context?.instructions.map(({ action, data }) => ({ action, style: {
  color: data.style.color, alpha: data.style.alpha, width: data.style.width, cap: data.style.cap, join: data.style.join,
}, path: data.path.instructions }))
function snapshot(node, ignoreAlpha = []) {
  return { label: node.label, x: node.x, y: node.y, rotation: node.rotation, scale: [node.scale.x, node.scale.y],
    alpha: ignoreAlpha.includes(node.label) ? null : node.alpha, art: art(node), children: node.children?.map(child => snapshot(child, ignoreAlpha)) }
}
const labels = row => [...Array.from({ length: row.count }, (_, i) => row.prefix + i), ...(row.id === 'grass-whistle' ? ['grass-whistle-leaf'] : []), row.target]
function bounded(h) {
  let visible = 0
  function walk(node, alpha = 1) {
    const opacity = alpha * node.alpha
    assert.ok(node.alpha >= 0 && node.alpha <= 1)
    if (opacity > .03 && node.constructor.name === 'Graphics') {
      const b = node.getBounds(); visible++
      assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
        `${node.label} at ${h.tl.time()}: ${JSON.stringify(b)}`)
    }
    for (const child of node.children ?? []) walk(child, opacity)
  }
  walk(h.scene.effects)
  for (const actor of h.scene.actors.values()) {
    assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    const p = actor.anchor('visualCenter'), w = actor.metrics.width / 2, q = actor.metrics.height / 2
    assert.ok(p.x - w >= -.05 && p.x + w <= h.scene.width + .05 && p.y - q >= -.05 && p.y + q <= h.scene.height + .05)
  }
  return visible
}

test('independent music and heart extensions retain original contacts and end with the full native recordings', () => {
  assert.deepEqual(cases.map(row => row.timing.contact), [.96, .88, .92])
  assert.deepEqual(cases.map(row => row.timing.duration), [4.19, 3.44, 6.01])
  for (const row of cases) {
    assert.deepEqual(EFFECT_TIMINGS[row.id], { contact: row.timing.contact, duration: row.originalDuration })
    assert.notEqual(row.build, MOVE_EFFECTS[row.id].build)
    assert.ok(row.timing.duration >= row.native && row.timing.duration - row.native <= .01)
    assert.ok(row.timing.markers.every(marker => marker.timeSeconds > row.timing.contact && marker.timeSeconds < row.timing.duration))
  }
})

test('original openings, first arrivals, artwork and ongoing paths remain identical in both field directions', async () => {
  for (const row of cases) for (const sourceId of ['source', 'target']) {
    const h = harness(row, sourceId), old = harness(row, sourceId, 0, true), cues = [], oldCues = []
    try {
      const run = h.play(cue => { cues.push(cue.type); close(h.point(h.node(row.prefix + 0)), h.target.anchor('center'), 'first particle reaches the live target before its cue') })
      const before = old.play(cue => oldCues.push(cue.type)); await tick()
      for (const time of [.05, .2, .43, row.timing.contact - .0001, row.timing.contact, row.openingEnd]) {
        h.tl.time(time, false); old.tl.time(time, false)
        assert.deepEqual(labels(row).map(label => snapshot(h.node(label))), labels(row).map(label => snapshot(old.node(label))), `${row.id} opening at ${time}`)
        for (let i = row.count; i < row.total; i++) assert.equal(h.node(row.prefix + i).alpha, 0, 'continuing emissions begin only after the original batch')
      }
      for (let time = row.openingEnd + .04; time < row.timing.duration; time += .061) {
        h.tl.time(time, false); old.tl.time(time, false)
        assert.deepEqual(labels(row).map(label => snapshot(h.node(label), row.changingAlpha)), labels(row).map(label => snapshot(old.node(label), row.changingAlpha)),
          `${row.id} original geometry continues with the same phase and speed at ${time}`)
      }
      assert.deepEqual(cues, ['impact']); assert.deepEqual(cues, oldCues)
      h.tl.time(row.timing.duration, false); old.tl.time(row.timing.duration, false)
      assert.equal((await run.finished).status, 'completed'); assert.equal((await before.finished).status, 'completed'); clean(h); clean(old)
    } finally { h.dispose(); old.dispose() }
  }
})

test('extended notes and whistle pulses keep traveling from live emitters while lullabies, seeds and hearts move through their final fades', async () => {
  for (const row of cases) for (const sourceId of ['source', 'target']) {
    const h = harness(row, sourceId), cues = []
    try {
      const run = h.play(cue => cues.push(cue.type)); await tick()
      if (row.release) {
        const note = h.node(row.prefix + (row.total - 1))
        h.source.pose.x = 7; h.source.pose.y = -4; h.target.pose.x = -8; h.target.pose.y = 3
        h.tl.time(row.release, false)
        close(h.point(note), h.source.anchor('emission'), 'the last release uses the live source socket')
        h.tl.time(row.release + .15, false); const a = h.point(note); assert.ok(note.alpha > .1)
        h.tl.time(row.release + .25, false); const b = h.point(note)
        assert.ok(Math.hypot(b.x - a.x, b.y - a.y) > 10, 'late particles continue traveling at their original pace')
        if (row.id === 'sing') assert.ok(h.point(note, { x: 1, y: 0 }).x > b.x, 'late musical notation remains readable from either side')
        h.tl.time(row.release + row.travel, false)
        close(h.point(note), h.target.anchor('center'), 'the last particle completes the original travel to the live target')
      }
      const receiver = h.node(row.target)
      h.tl.time(row.timing.duration - .20, false)
      assert.ok(receiver.alpha > 0 && receiver.alpha < 1, 'the ending is a real fade')
      close(h.point(receiver), h.target.anchor('center'), 'the ending stays attached to the live receiver')
      const first = snapshot(receiver)
      h.tl.time(row.timing.duration - .10, false)
      const second = snapshot(receiver)
      assert.ok(receiver.alpha > 0 && receiver.alpha < first.alpha)
      if (row.id === 'sing') assert.notDeepEqual(second.art, first.art, 'lullaby curves continue drifting while fading')
      else assert.notDeepEqual(second.children.map(child => [child.x, child.y]), first.children.map(child => [child.x, child.y]), 'seed or heart orbits keep moving through the fade')
      h.tl.time(row.timing.duration - .001, false); assert.ok(receiver.alpha > 0)
      assert.deepEqual(cues, ['impact'])
      h.tl.time(row.timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('full extended art fits default, portrait, side and top edges with stationary full-size actors and readable notes', async () => {
  for (const row of cases) for (const sourceId of ['source', 'target']) for (let fixture = 0; fixture < fixtures.length; fixture++) {
    const h = harness(row, sourceId, fixture)
    try {
      const run = h.play(); await tick(); let visible = 0
      for (let time = .04; time < row.timing.duration - .01; time += .023) {
        h.tl.time(time, false); visible += bounded(h)
        if (row.id === 'sing') for (let i = 0; i < row.total; i++) {
          const note = h.node(row.prefix + i)
          if (note.alpha > .03 && Math.abs(note.scale.x) > .001) assert.ok(h.point(note, { x: 1, y: 0 }).x > h.point(note).x)
        }
      }
      assert.ok(visible > 100)
      h.tl.time(row.timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('cancellation before contact and during extended music or heart fades clears ownership; reduced motion remains a single short cue', async () => {
  for (const row of cases) for (const sourceId of ['source', 'target']) {
    const h = harness(row, sourceId)
    try {
      for (const time of [.3, row.timing.contact + .1, row.originalDuration + .15, row.timing.duration - .12]) {
        const cues = [], run = h.play(cue => cues.push(cue.type)); await tick()
        h.tl.time(time, false); run.cancel()
        assert.equal((await run.finished).status, 'cancelled'); assert.deepEqual(cues, time < row.timing.contact ? [] : ['impact']); clean(h)
      }
      const cues = [], run = h.play(cue => cues.push(cue.type), true); await tick()
      h.tl.time(.8, false); assert.equal((await run.finished).status, 'completed'); assert.deepEqual(cues, ['impact']); clean(h)
    } finally { h.dispose() }
  }
})
