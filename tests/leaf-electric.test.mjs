import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS, FX_CATALOG } from '@battle/battle-fx'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { MOVES } from '../apps/game/src/moveCatalog.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const cases = [
  ['magical-leaf', .42, 1.06, 2.05, 42], ['petal-dance', .4, 1.02, 2.65, 84],
  ['razor-wind', .84, 1.16, 2.35, 56], ['charge', null, .95, 2.1, 0],
  ['spark', null, .64, 1.7, 46], ['volt-tackle', null, .98, 2.45, 84],
]
const physical = id => id === 'spark' || id === 'volt-tackle'
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
function harness(reverse = false, edge = 0, solo = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const actors = [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32] } },
    { id: 'target', profile: 'tall', x: reverse ? (edge === 2 ? .055 : .26) : (edge === 2 ? .945 : .74),
      y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: reverse ? 1 : -1,
      anchors: { center: edge === 3 ? [.5, .04] : [.48, .44] } },
  ]
  const scene = createSceneGraph({ width, height, actors: solo ? actors.slice(0, 1) : actors })
  const fx = createBattleFx({ glowTexture: Texture.WHITE, timelineEngine: {
    timeline(options) { return timeline = gsap.timeline({ ...options, paused: true }) },
  } })
  return { scene, fx, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true),
    point: n => scene.effects.toLocal({ x: 0, y: 0 }, n), dispose() { fx.dispose(); scene.dispose() } }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
  for (const a of h.scene.actors.values()) {
    for (const key of ['x', 'y', 'rotation']) assert.equal(a.pose[key], 0)
    assert.equal(a.pose.alpha, 1); assert.equal(a.pose.scale.x, 1); assert.equal(a.pose.scale.y, 1)
    assert.equal(a.pose.tint, 0xffffff)
  }
}
function assertBounds(h, label) {
  const { width, height } = h.scene
  for (const a of h.scene.actors.values()) {
    const p = a.anchor('visualCenter'), rx = a.metrics.width / 2, ry = a.metrics.height / 2
    assert.ok(p.x-rx >= -.05 && p.x+rx <= width+.05 && p.y-ry >= -.05 && p.y+ry <= height+.05, label+' actor bounds')
    assert.equal(a.pose.alpha, 1); assert.equal(a.pose.scale.x, 1); assert.equal(a.pose.scale.y, 1)
  }
  let seen = 0
  function walk(n, alpha = 1) {
    const visible = alpha * n.alpha
    assert.ok(n.alpha >= 0 && n.alpha <= 1, label+' valid alpha')
    if (visible > .03 && ['Graphics', 'Sprite'].includes(n.constructor.name)) {
      const b = n.getBounds(); seen++
      assert.ok(b.x >= -.05 && b.y >= -.05 && b.x+b.width <= width+.05 && b.y+b.height <= height+.05,
        `${label} ${n.label}: ${JSON.stringify(b)}`)
    }
    for (const child of n.children ?? []) walk(child, visible)
  }
  walk(h.scene.effects)
  return seen
}

test('six additions are selectable once and preserve fixed outcomes, conditions and immutable source state', () => {
  for (const [id,,contact,duration,damage] of cases) {
    assert.equal(MOVE_RULES.filter(m => m.id === id).length, 1)
    assert.equal(FX_CATALOG.filter(m => m.id === id).length, 1)
    assert.ok(MOVES.find(m => m.id === id)?.showcase)
    assert.deepEqual(EFFECT_TIMINGS[id], { contact, duration })
    for (const reverse of [false, true]) for (const hp of [1, 160]) {
      const sourceId = reverse ? 'b' : 'a', targetId = reverse ? 'a' : 'b'
      const before = createBattleState([
        { id: sourceId, name: 'User', hp: 60, maxHp: 100, condition: 'burn', specialDefenseStage: 2, heldItem: 'Oran Berry' },
        { id: targetId, name: 'Target', hp, maxHp: 160, condition: 'poison', defenseStage: -2, confused: true },
      ])
      const tx = resolveMove(before, { moveId: id, sourceId, targetId })
      const recoil = id === 'volt-tackle' ? Math.max(1, Math.round(Math.min(hp, damage)*.33)) : 0
      assert.deepEqual(tx.after.actors[sourceId], { ...before.actors[sourceId], hp: 60-recoil,
        specialDefenseStage: id === 'charge' ? 3 : 2 })
      assert.deepEqual(tx.after.actors[targetId], { ...before.actors[targetId], hp: id === 'charge' ? hp : Math.max(0, hp-damage) })
      assert.equal(tx.event.outcome, 'hit'); assert.equal(tx.event.healing, undefined)
      assert.deepEqual(tx.event.targetIds, [id === 'charge' ? sourceId : targetId])
      assert.equal(before.actors[sourceId].hp, 60); assert.equal(before.actors[targetId].hp, hp)
      assert.ok(Object.isFrozen(tx.after.actors[sourceId]))
    }
  }
  assert.equal(MOVES.find(m => m.id === 'magical-leaf').accuracyText, 'Always')
})

test('Charge caps Special Defense without an opponent and Volt Tackle caps recoil by actual damage and user HP', () => {
  for (const stage of [-6, 5, 6]) {
    const before = createBattleState([{ id: 'user', name: 'User', hp: 41, maxHp: 100, specialDefenseStage: stage, condition: 'poison' }])
    const tx = resolveMove(before, { moveId: 'charge', sourceId: 'user' })
    assert.deepEqual(tx.after.actors.user, { ...before.actors.user, specialDefenseStage: Math.min(6, stage+1) })
    assert.equal(tx.event.outcome, stage === 6 ? 'failed' : 'hit')
    assert.match(tx.event.resultMessage, /Special Defense/)
  }
  for (const sourceHp of [1, 12, 100]) for (const targetHp of [1, 30, 200]) {
    const before = createBattleState([{ id: 'a', name: 'User', hp: sourceHp, maxHp: 100 }, { id: 'b', name: 'Target', hp: targetHp, maxHp: 200 }])
    const tx = resolveMove(before, { moveId: 'volt-tackle', sourceId: 'a', targetId: 'b' })
    const loss = Math.min(84, targetHp), recoil = Math.min(sourceHp, Math.max(1, Math.round(loss*.33)))
    assert.equal(tx.after.actors.a.hp, sourceHp-recoil); assert.equal(tx.after.actors.b.hp, targetHp-loss)
    assert.equal(tx.event.recoil, recoil); assert.match(tx.event.resultMessage, /recoil damage/)
  }
})

test('new results reconcile identically with effects off, a cue, a failure or a skipped animation', async () => {
  for (const [id] of cases) for (const sourceId of ['source', 'target']) for (const mode of ['off', 'cue', 'failure', 'skip']) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const tx = resolveMove(createBattleState(), { moveId: id, sourceId, targetId })
    let display, finish, cueState
    const presenter = createPresenter({ getScene: () => ({}), onDisplay: next => { display = next; if (next.animate) cueState = next.state },
      loadFx: async () => ({ play(request, options) {
        assert.equal(request.sourceId, sourceId)
        assert.deepEqual(request.targetIds, [id === 'charge' ? sourceId : targetId])
        if (mode === 'failure') throw new Error('Simulated renderer failure')
        if (mode === 'cue') options.onCue({ type: 'impact' })
        return { finished: new Promise(resolve => { finish = resolve }), cancel() { finish?.({ status: 'cancelled' }) } }
      } }),
    })
    const pending = presenter.enqueue(tx, { effectsEnabled: mode !== 'off' })
    await tick()
    if (mode === 'skip') presenter.skip()
    else finish?.({ status: 'completed' })
    await pending
    assert.deepEqual(display.state, tx.after, id+' '+mode)
    if (mode === 'cue') assert.deepEqual(cueState, tx.after)
    presenter.destroy()
  }
})

test('all six effects contact before one cue and clean up in normal, reduced and cancelled playback', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id,release,contact,duration] of cases) {
      const source = h.scene.actor('source'), target = id === 'charge' ? source : h.scene.actor('target'), cues = []
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, {
        scene: h.scene, onCue: cue => {
          const tip = h.node(id+'-tip'), p = h.point(tip)
          if (physical(id)) close(p, source.anchor('tackle'), id+' tackle attachment')
          else close(p, target.anchor('center'), id+' contact')
          close(h.point(h.node(id+'-impact')), p, id+' impact meets contact')
          assert.ok(tip.alpha > .6, id+' visible contact'); cues.push(cue.type)
        },
      })
      await tick()
      if (release != null) { h.tl.time(release, false); close(h.point(h.node(id+'-tip')), source.anchor('emission'), id+' launch') }
      h.tl.time(contact-.001, false); assert.equal(cues.length, 0)
      h.tl.time(contact, false); assert.deepEqual(cues, ['impact'])
      if (physical(id)) close(h.point(h.node(id+'-tip')), target.anchor('center'), id+' ordinary target contact')
      h.tl.time(duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      for (const time of [contact*.5, contact+.1]) {
        const cancelled = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene })
        await tick(); h.tl.time(time, false); cancelled.cancel(); assert.equal((await cancelled.finished).status, 'cancelled'); clean(h)
      }
      const reducedCues = [], reduced = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene, reducedMotion: true, onCue: c => reducedCues.push(c.type) })
      await tick(); h.tl.time(.8, false); assert.equal((await reduced.finished).status, 'completed'); assert.deepEqual(reducedCues, ['impact']); clean(h)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('full leaf, wind and electric artwork and actors fit both directions, field edges and portrait layouts', async () => {
  for (const reverse of [false, true]) for (const edge of [0, 1, 2, 3, 4]) {
    const h = harness(reverse, edge)
    try { for (const [id,,contact,duration] of cases) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene })
      await tick(); let seen = 0
      for (let time = .04; time < duration-.02; time += .035) {
        h.tl.time(time, false); seen += assertBounds(h, `${id} edge ${edge} reverse ${reverse} time ${time}`)
        if (physical(id) && time < contact && time+.035 >= contact) {
          h.tl.time(contact, false)
          const p = h.point(h.node(id+'-tip')), target = h.scene.actor('target'), center = target.anchor('visualCenter')
          assert.ok(Math.abs(p.x-center.x) <= target.metrics.width/2+.05 && Math.abs(p.y-center.y) <= target.metrics.height/2+.05,
            `${id} edge ${edge} reverse ${reverse}: adjusted contact stays on the target body`)
        }
      }
      assert.ok(seen > 0, id+' visible artwork'); h.tl.time(duration, false)
      assert.equal((await run.finished).status, 'completed'); clean(h)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('Charge plays with no opponent in normal and reduced motion', async () => {
  for (const reverse of [false, true]) for (const reducedMotion of [false, true]) {
    const h = harness(reverse, 0, true), cues = []
    try {
      const run = h.fx.play({ moveId: 'charge', sourceId: 'source', visualSeed: 42 }, { scene: h.scene, reducedMotion, onCue: c => cues.push(c.type) })
      await tick(); h.tl.time(reducedMotion ? .8 : 2.1, false)
      assert.equal((await run.finished).status, 'completed'); assert.deepEqual(cues, ['impact']); clean(h)
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})
