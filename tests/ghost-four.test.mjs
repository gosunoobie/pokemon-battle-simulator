import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS, FX_CATALOG } from '@battle/battle-fx'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { MOVES } from '../apps/game/src/moveCatalog.js'
import { createPreviewState, createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const cases = [
  ['night-shade', .36, .82, 2.1], ['dream-eater', .24, .66, 2.65, 1.38],
  ['curse', .5, 1.04, 2.45], ['destiny-bond', null, .88, 2.25],
]
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
const receiver = (h, id) => h.scene.actor(id === 'destiny-bond' ? 'source' : 'target').anchor('center')
const launch = (source, id) => id === 'night-shade' && source.hasAnchor('eyes') ? 'eyes' : 'emission'
function harness(reverse = false, edge = 0, custom = false, solo = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const actors = [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32], ...(custom ? { eyes: [.45, .13], emission: [.69, .34], aura: [.41, .42] } : {}) } },
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
  for (const actor of h.scene.actors.values()) {
    for (const key of ['x', 'y', 'rotation']) assert.equal(actor.pose[key], 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    assert.equal(actor.pose.tint, 0xffffff)
  }
}
function assertBounds(h, label) {
  const { width, height } = h.scene
  for (const actor of h.scene.actors.values()) {
    const p = actor.anchor('visualCenter'), c = Math.abs(Math.cos(actor.pose.rotation)), s = Math.abs(Math.sin(actor.pose.rotation)),
      rx = (actor.metrics.width * c + actor.metrics.height * s) / 2, ry = (actor.metrics.height * c + actor.metrics.width * s) / 2
    assert.ok(p.x - rx >= -.05 && p.x + rx <= width + .05 && p.y - ry >= -.05 && p.y + ry <= height + .05, label + ' actor bounds')
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  }
  let seen = 0
  function walk(n, alpha = 1) {
    const visible = alpha * n.alpha
    assert.ok(n.alpha >= 0 && n.alpha <= 1, label + ' valid alpha')
    if (visible > .03 && ['Graphics', 'Sprite'].includes(n.constructor.name)) {
      const b = n.getBounds(); seen++
      assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= width + .05 && b.y + b.height <= height + .05,
        `${label} ${n.label}: ${JSON.stringify(b)}`)
    }
    for (const child of n.children ?? []) walk(child, visible)
  }
  walk(h.scene.effects)
  return seen
}
function checkCue(h, id, cue) {
  if (cue.type === 'recovery') {
    assert.equal(id, 'dream-eater')
    const aura = h.scene.actor('source').anchor('aura')
    close(h.point(h.node('dream-eater-recovery-tip')), aura, 'returning mote reaches aura before recovery')
    close(h.point(h.node('dream-eater-receive')), aura, 'receiving art follows aura')
    assert.ok(h.node('dream-eater-recovery-tip').alpha > .6)
  } else {
    assert.equal(cue.type, 'impact')
    close(h.point(h.node(id + '-tip')), receiver(h, id), id + ' visible contact before cue')
    close(h.point(h.node(id + '-impact')), receiver(h, id), id + ' impact before cue')
    assert.ok(h.node(id + '-tip').alpha > .6, id + ' visible contact')
  }
}

test('four moves have distinct catalog entries, host metadata, correct timings and targeting', () => {
  for (const [id, , contact, duration, recovery] of cases) {
    const rule = MOVE_RULES.find(move => move.id === id), move = MOVES.find(move => move.id === id)
    assert.equal(MOVE_RULES.filter(move => move.id === id).length, 1)
    assert.equal(FX_CATALOG.filter(move => move.id === id).length, 1)
    assert.deepEqual(EFFECT_TIMINGS[id], { contact, duration, ...(recovery == null ? {} : { recovery }) })
    assert.ok(move.showcase && move.description && move.mechanicNote)
    assert.equal(rule.target, id === 'destiny-bond' ? 'self' : undefined)
    if (['curse', 'destiny-bond'].includes(id)) assert.equal(move.accuracyText, 'Always')
  }
  assert.equal(MOVE_RULES.find(m => m.id === 'night-shade').levelDamage, true)
  assert.equal(MOVE_RULES.find(m => m.id === 'dream-eater').drain, .5)
  assert.equal(MOVE_RULES.find(m => m.id === 'dream-eater').requiresTargetSleep, true)
  assert.equal(MOVE_RULES.find(m => m.id === 'curse').ghostCurse, true)
})

test('Night Shade deals source level damage at 1, 50 and 100, caps overkill and preserves unrelated state from either side', () => {
  for (const sourceId of ['source', 'target']) for (const level of [1, 50, 100]) for (const hp of [1, 31, 160]) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const before = createBattleState([{ id: sourceId, name: 'User', hp: 72, maxHp: 100, level, condition: 'burn', heldItem: 'Oran Berry', destinyBond: true },
      { id: targetId, name: 'Target', hp, maxHp: 160, condition: 'sleep', cursed: true, nightmare: true, defenseStage: 2 }])
    const tx = resolveMove(before, { moveId: 'night-shade', sourceId, targetId })
    assert.deepEqual(tx.after.actors[sourceId], before.actors[sourceId])
    assert.deepEqual(tx.after.actors[targetId], { ...before.actors[targetId], hp: Math.max(0, hp - level) })
    assert.equal(tx.event.outcome, 'hit'); assert.equal(tx.event.healing, undefined)
    assert.match(tx.event.resultMessage, new RegExp(`took ${Math.min(level, hp)} damage`))
    assert.equal(before.actors[targetId].hp, hp); assert.ok(Object.isFrozen(tx.after.actors[targetId])); assert.ok(Object.isFrozen(tx.event))
  }
  assert.equal(createBattleState().actors.source.level, 50)
  for (const level of [0, 101, 1.5, '50']) assert.throws(() => createBattleState([{ id: 'x', name: 'X', hp: 1, maxHp: 1, level }]), /Invalid actor level/)
})

test('Dream Eater requires sleep and drains rounded actual damage with caps, overkill and no revival', () => {
  for (const sourceId of ['source', 'target']) for (const condition of [null, 'poison', 'sleep']) for (const hp of [1, 3, 69, 70, 160]) for (const sourceHp of [1, 89, 99, 100]) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const before = createBattleState([{ id: sourceId, name: 'User', hp: sourceHp, maxHp: 100, condition: 'burn', grudge: true, heldItem: 'Sitrus Berry' },
      { id: targetId, name: 'Target', hp, maxHp: 160, condition, cursed: true, consumedItem: 'Lum Berry' }])
    const tx = resolveMove(before, { moveId: 'dream-eater', sourceId, targetId })
    if (condition !== 'sleep') {
      assert.equal(tx.event.outcome, 'failed'); assert.deepEqual(tx.after.actors, before.actors)
      assert.match(tx.event.resultMessage, /must be asleep/); assert.equal(tx.event.healing, undefined)
    } else {
      const damage = Math.min(hp, 70), healing = Math.min(100 - sourceHp, Math.round(damage / 2))
      assert.deepEqual(tx.after.actors[sourceId], { ...before.actors[sourceId], hp: sourceHp + healing })
      assert.deepEqual(tx.after.actors[targetId], { ...before.actors[targetId], hp: hp - damage })
      assert.equal(tx.event.outcome, 'hit'); assert.equal(tx.event.healing, healing)
      assert.equal(tx.event.sourceBeforeHp, sourceHp); assert.equal(tx.event.sourceAfterHp, sourceHp + healing)
      assert.match(tx.event.resultMessage, new RegExp(`restored ${healing} HP`)); assert.equal(tx.event.recoil, undefined)
    }
    assert.equal(before.actors[sourceId].hp, sourceHp); assert.equal(before.actors[targetId].hp, hp)
  }
  for (const dead of ['source', 'target']) {
    const before = createBattleState([{ id: 'source', name: 'User', hp: dead === 'source' ? 0 : 50, maxHp: 100 },
      { id: 'target', name: 'Target', hp: dead === 'target' ? 0 : 80, maxHp: 100, condition: 'sleep' }])
    assert.throws(() => resolveMove(before, { moveId: 'dream-eater', sourceId: 'source', targetId: 'target' }), /fainted/)
    assert.equal(before.actors[dead].hp, 0)
  }
})

test('Dream Eater fixture selects only its living recipient, preserves existing conditions and never raises low or fainted user HP', () => {
  const move = MOVES.find(move => move.id === 'dream-eater')
  for (const sourceId of ['a', 'b']) for (const sourceHp of [0, 1, 40, 100]) for (const hp of [0, 77]) for (const condition of [null, 'sleep', 'poison']) {
    const targetId = sourceId === 'a' ? 'b' : 'a'
    const actors = [{ id: sourceId, name: 'User', hp: sourceHp, maxHp: 100, condition: 'burn' },
      { id: 'spectator', name: 'Spectator', hp: 60, maxHp: 100 }, { id: targetId, name: 'Target', hp, maxHp: 100, condition }]
    const before = createBattleState(actors), state = createPreviewState(move, { sourceId, targetId, actors })
    assert.deepEqual(state.actors[sourceId], { ...before.actors[sourceId], hp: sourceHp > 0 ? Math.min(sourceHp, 65) : 0 })
    assert.deepEqual(state.actors[targetId], { ...before.actors[targetId], condition: hp > 0 ? condition ?? 'sleep' : condition })
    assert.deepEqual(state.actors.spectator, before.actors.spectator)
    if (sourceHp === 0 || hp === 0) assert.throws(() => createPreviewTransaction(move, { sourceId, targetId, actors }), /fainted/)
    else assert.equal(createPreviewTransaction(move, { sourceId, targetId, actors }).event.outcome, condition === 'poison' ? 'failed' : 'hit')
  }
  const defaults = createPreviewState(move)
  assert.equal(defaults.actors.source.hp, Math.floor(156 * .65)); assert.equal(defaults.actors.target.condition, 'sleep')
})

test('Ghost-style Curse pays half maximum HP with minimum one, can faint its user and charges nothing for repeated curses', () => {
  for (const sourceId of ['source', 'target']) for (const maxHp of [1, 2, 3, 99, 100, 101]) for (const low of [false, true]) for (const cursed of [false, true]) {
    const targetId = sourceId === 'source' ? 'target' : 'source', hp = low ? 1 : maxHp
    const before = createBattleState([{ id: sourceId, name: 'User', hp, maxHp, condition: 'burn', destinyBond: true, heldItem: 'Oran Berry' },
      { id: targetId, name: 'Target', hp: 88, maxHp: 100, condition: 'sleep', cursed, nightmare: true, attackStage: 3 }])
    const tx = resolveMove(before, { moveId: 'curse', sourceId, targetId }), cost = cursed ? 0 : Math.min(hp, Math.max(1, Math.floor(maxHp / 2)))
    assert.deepEqual(tx.after.actors[sourceId], { ...before.actors[sourceId], hp: hp - cost })
    assert.deepEqual(tx.after.actors[targetId], { ...before.actors[targetId], cursed: true })
    assert.equal(tx.event.outcome, cursed ? 'failed' : 'hit'); assert.equal(tx.event.healing, undefined); assert.equal(tx.event.recoil, undefined)
    assert.equal(tx.event.sourceBeforeHp, hp); assert.equal(tx.event.sourceAfterHp, hp - cost)
    assert.equal(tx.event.beforeHp, 88); assert.equal(tx.event.afterHp, 88)
    if (cursed) assert.match(tx.event.resultMessage, /already has/)
    else { assert.match(tx.event.resultMessage, new RegExp(`spent ${cost} HP`)); if (hp === cost) assert.match(tx.event.resultMessage, /User fainted/) }
    if (!cursed && hp > cost) {
      const again = resolveMove(tx.after, { moveId: 'curse', sourceId, targetId })
      assert.equal(again.event.outcome, 'failed'); assert.deepEqual(again.after.actors, tx.after.actors)
    }
    assert.equal(before.actors[sourceId].hp, hp)
  }
  assert.equal(createBattleState().actors.source.cursed, false)
  assert.throws(() => createBattleState([{ id: 'x', name: 'X', hp: 1, maxHp: 1, cursed: 'yes' }]), /Invalid support preview flag/)
})

test('Destiny Bond works solo, rejects repeat badges and does not knock out an attacker when its user later faints', () => {
  const solo = createBattleState([{ id: 'solo', name: 'Solo', hp: 37, maxHp: 100, condition: 'poison', cursed: true }])
  const first = resolveMove(solo, { moveId: 'destiny-bond', sourceId: 'solo' }), again = resolveMove(first.after, { moveId: 'destiny-bond', sourceId: 'solo' })
  assert.deepEqual(first.after.actors.solo, { ...solo.actors.solo, destinyBond: true }); assert.deepEqual(first.event.targetIds, ['solo'])
  assert.equal(first.event.outcome, 'hit'); assert.equal(again.event.outcome, 'failed'); assert.deepEqual(again.after.actors, first.after.actors)
  for (const sourceId of ['source', 'target']) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const before = createBattleState([{ id: sourceId, name: 'User', hp: 1, maxHp: 100, heldItem: 'Oran Berry' }, { id: targetId, name: 'Attacker', hp: 77, maxHp: 100 }])
    const bond = resolveMove(before, { moveId: 'destiny-bond', sourceId, targetId }), hit = resolveMove(bond.after, { moveId: 'pound', sourceId: targetId, targetId: sourceId })
    assert.deepEqual(bond.after.actors[targetId], before.actors[targetId]); assert.equal(hit.after.actors[sourceId].hp, 0)
    assert.equal(hit.after.actors[sourceId].destinyBond, true); assert.deepEqual(hit.after.actors[targetId], before.actors[targetId])
  }
  assert.equal(createBattleState().actors.source.destinyBond, false)
  assert.throws(() => createBattleState([{ id: 'x', name: 'X', hp: 1, maxHp: 1, destinyBond: 1 }]), /Invalid support preview flag/)
})

test('all four committed results reconcile through effects off, absent cues, failure, cue playback and skip without rule authority entering FX', async () => {
  for (const [id] of cases) for (const sourceId of ['source', 'target']) for (const mode of ['off', 'missing', 'failure', 'cue', 'skip']) {
    const targetId = sourceId === 'source' ? 'target' : 'source', tx = createPreviewTransaction(MOVES.find(move => move.id === id), { sourceId, targetId })
    let display, finish, cueState
    const presenter = createPresenter({ getScene: () => ({}), onDisplay: next => { display = next; if (next.animate) cueState = next.state }, loadFx: async () => ({ play(request, options) {
      assert.deepEqual(Object.keys(request).sort(), ['moveId', 'outcome', 'sourceId', 'targetIds', 'visualSeed'])
      assert.equal(request.sourceId, sourceId); assert.deepEqual(request.targetIds, [id === 'destiny-bond' ? sourceId : targetId])
      if (mode === 'failure') throw new Error('Simulated renderer failure')
      if (mode === 'cue') { options.onCue({ type: 'impact' }); if (id === 'dream-eater') options.onCue({ type: 'recovery' }) }
      return { finished: new Promise(resolve => { finish = resolve }), cancel() { finish?.({ status: 'cancelled' }) } }
    } }) })
    const pending = presenter.enqueue(tx, { effectsEnabled: mode !== 'off' }); await tick()
    if (mode === 'skip') presenter.skip(); else finish?.({ status: 'completed' })
    await pending; assert.deepEqual(display.state, tx.after, id + ' ' + mode)
    if (mode === 'cue') assert.deepEqual(cueState, tx.after)
    presenter.destroy()
  }
})

test('Dream Eater displays target damage at impact, holds source healing until recovery and reconciles missing recovery', async () => {
  for (const sourceId of ['source', 'target']) for (const mode of ['recovery', 'missing-recovery', 'skip-after-impact']) {
    const targetId = sourceId === 'source' ? 'target' : 'source', tx = createPreviewTransaction(MOVES.find(move => move.id === 'dream-eater'), { sourceId, targetId })
    const displays = []; let emit, finish
    const presenter = createPresenter({ getScene: () => ({}), onDisplay: next => displays.push(next), loadFx: async () => ({ play(request, options) {
      emit = options.onCue
      return { finished: new Promise(resolve => { finish = resolve }), cancel() { finish?.({ status: 'cancelled' }) } }
    } }) })
    const pending = presenter.enqueue(tx); await tick()
    assert.ok(tx.event.healing > 0)
    emit({ type: 'recovery' }); assert.equal(displays.length, 1, 'early recovery is ignored')
    emit({ type: 'impact' })
    const impact = displays.at(-1)
    assert.equal(impact.state.actors[targetId].hp, tx.after.actors[targetId].hp)
    assert.equal(impact.state.actors[sourceId].hp, tx.before.actors[sourceId].hp)
    assert.equal(impact.message, tx.event.impactMessage); assert.equal(impact.animate, true)
    emit({ type: 'impact' }); assert.equal(displays.length, 2, 'duplicate impact is ignored')
    if (mode === 'recovery') {
      emit({ type: 'recovery' }); assert.deepEqual(displays.at(-1).state, tx.after)
      emit({ type: 'recovery' }); assert.equal(displays.length, 3, 'duplicate recovery is ignored')
    }
    if (mode === 'skip-after-impact') presenter.skip(); else finish({ status: 'completed' })
    await pending; assert.deepEqual(displays.at(-1).state, tx.after); assert.equal(displays.at(-1).animate, false)
    assert.equal(tx.after.actors[sourceId].hp, tx.event.sourceAfterHp); presenter.destroy()
  }
})

test('four effects update exact impact and recovery geometry before one cue and clean normal, reduced and cancelled playback', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id, release, contact, duration, recovery] of cases) {
      const cues = [], run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => { checkCue(h, id, cue); cues.push(cue.type) } })
      await tick()
      if (release != null) {
        h.tl.time(release, false); const at = h.scene.actor('source').anchor(launch(h.scene.actor('source'), id))
        close(h.point(h.node(id + '-root')), at, id + ' root'); close(h.point(h.node(id + '-tip')), at, id + ' release')
      }
      h.tl.time(contact - .001, false); assert.deepEqual(cues, [])
      h.tl.time(contact, false); assert.deepEqual(cues, ['impact'])
      if (recovery != null) {
        h.tl.time(.72, false); close(h.point(h.node('dream-eater-recovery-tip')), h.scene.actor('target').anchor('center'), 'first returning mote launches from target')
        h.tl.time(recovery - .001, false); assert.deepEqual(cues, ['impact'])
        h.tl.time(recovery, false); assert.deepEqual(cues, ['impact', 'recovery'])
      }
      h.tl.time(duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      for (const time of [contact * .5, contact + .1, ...(recovery ? [recovery + .1] : [])]) {
        const cancelled = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene }); await tick()
        h.tl.time(time, false); cancelled.cancel(); assert.equal((await cancelled.finished).status, 'cancelled'); clean(h)
      }
      const reducedCues = [], reduced = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene, reducedMotion: true, onCue: cue => reducedCues.push(cue.type) })
      await tick(); h.tl.time(.8, false); assert.equal((await reduced.finished).status, 'completed')
      assert.deepEqual(reducedCues, recovery ? ['impact', 'recovery'] : ['impact']); clean(h)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('all four effects fit complete artwork and actors in wide, upper-edge, side-edge and portrait fields from both directions', async () => {
  for (const reverse of [false, true]) for (const edge of [0, 1, 2, 3, 4]) {
    const h = harness(reverse, edge)
    try { for (const [id, , , duration] of cases) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => checkCue(h, id, cue) })
      await tick(); let seen = 0
      for (let time = .04; time < duration - .02; time += .031) { h.tl.time(time, false); seen += assertBounds(h, `${id} edge${edge} reverse${reverse} t${time}`) }
      assert.ok(seen > 0, id + ' visible art'); h.tl.time(duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('custom eyes, emission and aura remain live through posed release, impact and Dream Eater recovery', async () => {
  for (const reverse of [false, true]) for (const custom of [false, true]) {
    const h = harness(reverse, 0, custom), source = h.scene.actor('source'), target = h.scene.actor('target')
    try { for (const [id, release, contact, duration, recovery] of cases) {
      const cues = [], run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => { checkCue(h, id, cue); cues.push(cue.type) } })
      await tick(); h.tl.time(.15, false)
      source.pose.x = reverse ? -8 : 8; source.pose.y = -12; source.pose.rotation = .025
      if (id !== 'destiny-bond') { target.pose.x = reverse ? 8 : -8; target.pose.y = -6; target.pose.rotation = -.02 }
      if (release != null) {
        h.tl.time(release, false); const socket = source.anchor(launch(source, id))
        close(h.point(h.node(id + '-root')), socket, id + ' follows live launch socket'); close(h.point(h.node(id + '-tip')), socket, id + ' live release')
      } else {
        h.tl.time(.3, false); close(h.point(h.node(id + '-tip')), source.anchor('center'), 'Destiny Bond live center')
      }
      h.tl.time(contact, false); assertBounds(h, id + ' posed contact')
      if (recovery) {
        source.pose.x = reverse ? -4 : 4; source.pose.y = -8; source.pose.rotation = -.025
        h.tl.time(recovery, false); assertBounds(h, id + ' posed recovery')
        close(h.point(h.node('dream-eater-root')), source.anchor('emission'), 'source emission remains live during return')
      }
      h.tl.time(duration, false); assert.equal((await run.finished).status, 'completed')
      assert.deepEqual(cues, recovery ? ['impact', 'recovery'] : ['impact']); clean(h)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('Destiny Bond completes and cancels without an opponent in both directions and motion modes', async () => {
  for (const reverse of [false, true]) for (const reducedMotion of [false, true]) for (const targetIds of [undefined, ['missing'], ['source']]) {
    const h = harness(reverse, 0, false, true), cues = []
    try {
      const run = h.fx.play({ moveId: 'destiny-bond', sourceId: 'source', targetIds }, { scene: h.scene, reducedMotion, onCue: cue => cues.push(cue.type) })
      await tick(); h.tl.time(reducedMotion ? .8 : 2.25, false); assert.equal((await run.finished).status, 'completed'); assert.deepEqual(cues, ['impact']); clean(h)
      const cancelled = h.fx.play({ moveId: 'destiny-bond', sourceId: 'source' }, { scene: h.scene, reducedMotion }); await tick()
      h.tl.time(.3, false); cancelled.cancel(); assert.equal((await cancelled.finished).status, 'cancelled'); clean(h)
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('dream energy, ghost wisps and fragments continue flowing through aftermath and Curse fragments fall in world coordinates', async () => {
  const flows = [['night-shade', 'night-shade-grain-0', 1.2, 1.5], ['dream-eater', 'dream-eater-return-mote-11', 1.53, 1.75],
    ['dream-eater', 'dream-eater-receive-glint-0', 1.85, 2.13], ['curse', 'curse-fragment-24', 1.87, 2.04, true],
    ['destiny-bond', 'destiny-bond-wisp-0', 1.5, 1.7]]
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id, label, first, second, down] of flows) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene }); await tick()
      h.tl.time(first, false); const node = h.node(label), p = h.point(node); assert.ok(node.alpha > .02, label + ' initially visible')
      h.tl.time(second, false); const q = h.point(node); assert.ok(node.alpha > .02, label + ' remains visible')
      assert.ok(Math.hypot(q.x - p.x, q.y - p.y) > .2, label + ' remains moving')
      if (down) assert.ok(q.y > p.y + .1, label + ' gravity stays world-down')
      h.tl.time(EFFECT_TIMINGS[id].duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})
