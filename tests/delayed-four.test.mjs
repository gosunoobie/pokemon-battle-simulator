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
  ['future-sight', 1.04, 1.42, 2.85, 84, 'Psychic', 120, 100],
  ['doom-desire', 1.10, 1.54, 2.90, 98, 'Steel', 140, 100],
  ['yawn', .30, .94, 2.30, 0, 'Normal', null, null],
  ['bide', 1.18, 1.58, 2.75, 80, 'Normal', null, null],
]
const launchSocket = (id, actor) => id === 'future-sight' && actor.hasAnchor('eyes') ? 'eyes' : 'emission'
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
const visibleAlpha = node => { let alpha = 1; for (let n = node; n; n = n.parent) alpha *= n.alpha; return alpha }
function harness(reverse = false, edge = 0, custom = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const scene = createSceneGraph({ width, height, actors: [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32], ...(custom ? { origin: [.43, .93], emission: [.64, .23], eyes: [.47, .11] } : {}) } },
    { id: 'target', profile: 'tall', x: reverse ? (edge === 2 ? .055 : .26) : (edge === 2 ? .945 : .74),
      y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: reverse ? 1 : -1,
      anchors: { center: edge === 3 ? [.5, .04] : [.48, .44], ...(custom ? { origin: [.56, .89], center: [.37, .31] } : {}) } },
  ] })
  const fx = createBattleFx({ glowTexture: Texture.WHITE, timelineEngine: {
    timeline(options) { return timeline = gsap.timeline({ ...options, paused: true }) },
  } })
  return { scene, fx, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node), dispose() { fx.dispose(); scene.dispose() } }
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
    const p = actor.anchor('visualCenter'), c = Math.abs(Math.cos(actor.pose.rotation)), s = Math.abs(Math.sin(actor.pose.rotation))
    const rx = (actor.metrics.width * c + actor.metrics.height * s) / 2, ry = (actor.metrics.height * c + actor.metrics.width * s) / 2
    assert.ok(p.x - rx >= -.05 && p.x + rx <= width + .05 && p.y - ry >= -.05 && p.y + ry <= height + .05, label + ' complete actor bounds')
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  }
  let seen = 0
  function walk(node, alpha = 1) {
    assert.ok(node.alpha >= 0 && node.alpha <= 1, label + ' valid alpha')
    const visible = alpha * node.alpha
    if (visible > .03 && ['Graphics', 'Sprite'].includes(node.constructor.name)) {
      const b = node.getBounds(); seen++
      assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= width + .05 && b.y + b.height <= height + .05,
        `${label} ${node.label}: ${JSON.stringify(b)}`)
    }
    for (const child of node.children ?? []) walk(child, visible)
  }
  walk(h.scene.effects)
  return seen
}
function checkCue(h, id, cue) {
  assert.equal(cue.type, 'impact')
  const tip = h.node(id + '-tip'), impact = h.node(id + '-impact'), target = h.scene.actor('target').anchor('center')
  assert.ok(tip && impact, id + ' exposes visible contact artwork')
  close(h.point(tip), target, id + ' front reaches the live target before the cue')
  close(h.point(impact), target, id + ' impact is positioned before the cue')
  assert.ok(visibleAlpha(tip) > .6, id + ' visible front at contact')
}
async function complete(h, run, duration) {
  h.tl.time(duration, false)
  const result = await run.finished
  assert.equal(result.status, 'completed', result.reason)
  clean(h)
}


test('four delayed-move samples have unique metadata, opponent targets and no hidden turn or battle fixtures', () => {
  for (const [id, , contact, duration, damage, type, power, accuracy] of cases) {
    const rule = MOVE_RULES.find(move => move.id === id), move = MOVES.find(move => move.id === id)
    assert.equal(MOVE_RULES.filter(move => move.id === id).length, 1)
    assert.equal(FX_CATALOG.filter(move => move.id === id).length, 1)
    assert.equal(MOVES.filter(move => move.id === id).length, 1)
    assert.equal(rule.type, type); assert.equal(rule.power, power); assert.equal(rule.accuracy, accuracy); assert.equal(rule.damage, damage)
    assert.equal(rule.target, undefined); assert.deepEqual(EFFECT_TIMINGS[id], { contact, duration })
    assert.ok(move.showcase && move.description && move.mechanicNote && move.previewCaption)
    assert.equal(rule.retaliates, undefined); assert.equal(rule.condition, undefined); assert.equal(rule.conditionOnHit, undefined)
    if (id === 'yawn') { assert.equal(rule.supportPreview, 'drowsy'); assert.equal(rule.requiresClearTargetCondition, true); assert.match(move.mechanicNote, /no|without immediate sleep/i) }
    else assert.equal(rule.supportPreview, undefined)
    if (id === 'bide') assert.match(move.mechanicNote, /twice 40 stored damage/)
    if (['future-sight', 'doom-desire'].includes(id)) assert.match(move.mechanicNote, /two-turn delay.*not simulated/i)
    for (const sourceId of ['a', 'b']) for (const hp of [0, 19, 100]) {
      const targetId = sourceId === 'a' ? 'b' : 'a'
      const actors = [
        { id: sourceId, name: 'User', hp, maxHp: 100, condition: 'burn', drowsy: true, heldItem: 'Oran Berry' },
        { id: targetId, name: 'Target', hp, maxHp: 100, condition: 'poison', drowsy: true, consumedItem: 'Lum Berry' },
      ]
      assert.deepEqual(createPreviewState(move, { sourceId, targetId, actors }), createBattleState(actors), id + ' does not invent damage history, turns or condition fixtures')
    }
  }
})

test('Future Sight, Doom Desire and Bide cap their fixed hit at remaining HP and preserve unrelated immutable state', () => {
  for (const [id, , , , damage] of cases.filter(entry => entry[4] > 0)) for (const sourceId of ['source', 'target'])
    for (const hp of [1, damage - 1, damage, 160]) for (const condition of [null, 'poison', 'sleep']) for (const drowsy of [false, true]) {
      const targetId = sourceId === 'source' ? 'target' : 'source'
      const before = createBattleState([
        { id: sourceId, name: 'User', hp: 39, maxHp: 100, condition: 'burn', attackStage: 2, accuracyStage: 1,
          protected: true, heldItem: 'Oran Berry', cursed: true, drowsy: true },
        { id: targetId, name: 'Target', hp, maxHp: 160, condition, drowsy, confused: true, accuracyStage: -3,
          defenseStage: -2, specialDefenseStage: 3, protected: true, lightScreen: true, reflect: true,
          heldItem: 'Sitrus Berry', consumedItem: 'Lum Berry', seeded: true, destinyBond: true },
        { id: 'observer', name: 'Observer', hp: 17, maxHp: 80, condition: 'sleep', nightmare: true, drowsy: true },
      ])
      const tx = resolveMove(before, { moveId: id, sourceId, targetId }), remaining = Math.max(0, hp - damage)
      assert.deepEqual(tx.after, { ...before, revision: before.revision + 1,
        actors: { ...before.actors, [targetId]: { ...before.actors[targetId], hp: remaining } } })
      assert.equal(tx.event.outcome, 'hit'); assert.deepEqual(tx.event.targetIds, [targetId])
      assert.equal(tx.event.beforeHp, hp); assert.equal(tx.event.afterHp, remaining)
      assert.equal(tx.event.healing, undefined); assert.equal(tx.event.recoil, undefined)
      assert.match(tx.event.resultMessage, new RegExp(`took ${Math.min(hp, damage)} damage`))
      assert.equal(before.actors[targetId].hp, hp); assert.equal(before.actors[sourceId].hp, 39)
      assert.ok(Object.isFrozen(tx.after) && Object.isFrozen(tx.after.actors[targetId]) && Object.isFrozen(tx.event))
      if (id === 'bide') {
        const withHistory = resolveMove(before, { moveId: id, sourceId, targetId,
          previousHit: { sourceId: targetId, targetId: sourceId, damage: 3, category: 'physical' } })
        assert.deepEqual(withHistory.after, tx.after, 'Bide is an explicit 40-stored-damage sample independent of hit history')
      }
    }
  for (const [id] of cases) for (const sourceId of ['source', 'target']) for (const dead of ['source', 'target']) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const before = createBattleState([{ id: 'source', name: 'Near', hp: dead === 'source' ? 0 : 50, maxHp: 100 }, { id: 'target', name: 'Far', hp: dead === 'target' ? 0 : 80, maxHp: 100 }])
    assert.throws(() => resolveMove(before, { moveId: id, sourceId, targetId }), /fainted/)
    assert.throws(() => resolveMove(before, { moveId: id, sourceId, targetId: sourceId }), /participants/)
  }
})

test('Yawn marks only a clear living opponent drowsy, never inflicts immediate sleep, and fails unchanged for major conditions or an existing badge', () => {
  for (const sourceId of ['source', 'target']) for (const condition of [null, 'burn', 'poison', 'bad-poison', 'paralysis', 'sleep']) for (const drowsy of [false, true]) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const before = createBattleState([
      { id: sourceId, name: 'User', hp: 1, maxHp: 100, condition: 'burn', drowsy: true, heldItem: 'Oran Berry', attackStage: 4 },
      { id: targetId, name: 'Target', hp: 1, maxHp: 160, condition, drowsy, confused: true, accuracyStage: -3,
        protected: true, safeguard: true, lightScreen: true, reflect: true, seeded: true, cursed: true, heldItem: 'Sitrus Berry' },
      { id: 'observer', name: 'Observer', hp: 18, maxHp: 100 },
    ])
    const success = condition === null && !drowsy, tx = resolveMove(before, { moveId: 'yawn', sourceId, targetId })
    assert.deepEqual(tx.after, { ...before, revision: before.revision + 1,
      actors: { ...before.actors, [targetId]: { ...before.actors[targetId], drowsy: success || drowsy } } })
    assert.equal(tx.event.outcome, success ? 'hit' : 'failed'); assert.deepEqual(tx.event.targetIds, [targetId])
    assert.equal(tx.event.beforeHp, 1); assert.equal(tx.event.afterHp, 1)
    assert.equal(tx.after.actors[targetId].condition, condition); assert.equal(before.actors[targetId].drowsy, drowsy)
    assert.ok(Object.isFrozen(tx.after.actors[targetId]) && Object.isFrozen(tx.event))
    const repeat = resolveMove(tx.after, { moveId: 'yawn', sourceId, targetId })
    assert.equal(repeat.event.outcome, 'failed'); assert.deepEqual(repeat.after.actors, tx.after.actors)
    assert.match(tx.event.resultMessage, success ? /became drowsy/ : condition ? /major condition/ : /already/)
  }
})

test('drowsy is a validated default-false preview badge that persists through damage, cures and rest and resets in a fresh preview', () => {
  const actor = { id: 'a', name: 'User', hp: 30, maxHp: 100 }
  for (const invalid of [1, 0, 'true', 'false', {}, []]) assert.throws(() => createBattleState([{ ...actor, drowsy: invalid }]), /support preview flag/)
  assert.equal(createBattleState([actor]).actors.a.drowsy, false)
  for (const drowsy of [false, true]) assert.equal(createBattleState([{ ...actor, drowsy }]).actors.a.drowsy, drowsy)
  for (const moveId of ['refresh', 'rest', 'rain-dance']) {
    const before = createBattleState([{ ...actor, condition: 'burn', drowsy: true }, { id: 'b', name: 'Target', hp: 100, maxHp: 100, drowsy: true }])
    const tx = resolveMove(before, { moveId, sourceId: 'a', targetId: 'b' })
    assert.equal(tx.after.actors.a.drowsy, true); assert.equal(tx.after.actors.b.drowsy, true)
    assert.equal(before.actors.a.condition, 'burn')
  }
  const move = MOVES.find(move => move.id === 'yawn'), tx = createPreviewTransaction(move)
  assert.equal(tx.before.actors.target.drowsy, false); assert.equal(tx.after.actors.target.drowsy, true)
  const reset = createPreviewState(move)
  assert.equal(reset.actors.source.drowsy, false); assert.equal(reset.actors.target.drowsy, false)
  assert.equal(reset.actors.target.condition, null)
  for (const rule of MOVE_RULES.filter(move => move.supportPreview && move.id !== 'yawn'))
    for (const condition of ['burn', 'poison', 'bad-poison', 'paralysis', 'sleep']) for (const sourceId of ['a', 'b']) {
      const targetId = sourceId === 'a' ? 'b' : 'a', affectedId = rule.target === 'self' ? sourceId : targetId
      const before = createBattleState([{ id: 'a', name: 'Near', hp: 100, maxHp: 100, condition, drowsy: true },
        { id: 'b', name: 'Far', hp: 100, maxHp: 100, condition, drowsy: true }])
      const success = !rule.requiresTargetSleep || condition === 'sleep'
      const tx = resolveMove(before, { moveId: rule.id, sourceId, targetId })
      assert.equal(tx.event.outcome, success ? 'hit' : 'failed', rule.id + ' retains its own condition policy')
      assert.deepEqual(tx.after.actors, success ? { ...before.actors, [affectedId]: { ...before.actors[affectedId], [rule.supportPreview]: true } } : before.actors,
        rule.id + ' is unaffected by the opt-in Yawn guard')
    }
})

test('all committed samples and failed Yawn reconcile on effects off, cue, missing cue, failure and skip with cosmetic requests only', async () => {
  for (const [id] of cases) for (const sourceId of ['source', 'target']) for (const failed of id === 'yawn' ? [false, true] : [false])
    for (const mode of ['off', 'cue', 'missing', 'failure', 'skip']) {
      const targetId = sourceId === 'source' ? 'target' : 'source'
      const actors = [{ id: sourceId, name: 'User', hp: 70, maxHp: 100 }, { id: targetId, name: 'Target', hp: 100, maxHp: 100, condition: failed ? 'poison' : null }]
      const tx = createPreviewTransaction(MOVES.find(move => move.id === id), { sourceId, targetId, actors })
      let display, finish, played = false, cueState
      const presenter = createPresenter({ getScene: () => ({}), onDisplay: next => { display = next; if (next.animate) cueState = next.state }, loadFx: async () => ({ play(request, options) {
        played = true
        assert.deepEqual(Object.keys(request).sort(), ['moveId', 'outcome', 'sourceId', 'targetIds', 'visualSeed'])
        assert.equal(request.moveId, id); assert.equal(request.sourceId, sourceId); assert.deepEqual(request.targetIds, [targetId]); assert.equal(request.outcome, failed ? 'failed' : 'hit')
        if (mode === 'failure') throw new Error('Simulated renderer failure')
        if (mode === 'cue') options.onCue({ type: 'impact' })
        return { finished: new Promise(resolve => { finish = resolve }), cancel() { finish?.({ status: 'cancelled' }) } }
      } }) })
      const pending = presenter.enqueue(tx, { effectsEnabled: mode !== 'off' }); await tick()
      if (mode === 'skip') presenter.skip(); else finish?.({ status: 'completed' })
      await pending
      assert.deepEqual(display.state, tx.after, id + ' ' + mode); assert.equal(display.animate, false)
      assert.equal(played, mode !== 'off'); if (mode === 'cue') assert.deepEqual(cueState, tx.after)
      presenter.destroy()
    }
})

test('each delayed sample exposes its actual release and exact one-cue contact and cleans up on normal, reduced and cancelled exits', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id, release, contact, duration] of cases) {
      const cues = [], run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => { checkCue(h, id, cue); cues.push(cue.type) } })
      await tick(); h.tl.time(release, false)
      const source = h.scene.actor('source'), socket = source.anchor(launchSocket(id, source))
      close(h.point(h.node(id + '-root')), socket, id + ' live emitter')
      close(h.point(h.node(id + '-tip')), id === 'doom-desire' ? h.point(h.node('doom-desire-strike-origin')) : socket, id + ' visible release')
      h.tl.time(contact - .001, false); assert.deepEqual(cues, [])
      h.tl.time(contact, false); assert.deepEqual(cues, ['impact'])
      await complete(h, run, duration); assert.deepEqual(cues, ['impact'])
      for (const at of [release * .5, contact + .12]) {
        const cancelled = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene }); await tick()
        h.tl.time(at, false); cancelled.cancel(); assert.equal((await cancelled.finished).status, 'cancelled'); clean(h)
      }
      const reducedCues = [], reduced = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene, reducedMotion: true, onCue: cue => reducedCues.push(cue.type) })
      await tick(); await complete(h, reduced, .8); assert.deepEqual(reducedCues, ['impact'])
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('full psychic, metallic, breath and stored-energy artwork plus actor contours fit both directions in five edge and portrait layouts', async () => {
  for (const reverse of [false, true]) for (const edge of [0, 1, 2, 3, 4]) {
    const h = harness(reverse, edge)
    try { for (const [id, , , duration] of cases) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => checkCue(h, id, cue) })
      await tick(); let seen = 0
      for (let time = .04; time < duration - .02; time += .031) { h.tl.time(time, false); seen += assertBounds(h, `${id} reverse${reverse} edge${edge} t${time}`) }
      assert.ok(seen > 0, id + ' visible art'); await complete(h, run, duration)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('posed custom eyes and emission sockets remain live, while Doom Desire descends from its target-side origin to the moving target', async () => {
  for (const reverse of [false, true]) for (const custom of [false, true]) {
    const h = harness(reverse, 0, custom), source = h.scene.actor('source'), target = h.scene.actor('target')
    try { for (const [id, release, contact, duration] of cases) {
      const cues = [], run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => { checkCue(h, id, cue); cues.push(cue.type) } })
      await tick(); h.tl.time(.12, false)
      source.pose.x = reverse ? -7 : 7; source.pose.y = -10; source.pose.rotation = .023
      target.pose.x = reverse ? 7 : -7; target.pose.y = -6; target.pose.rotation = -.018
      h.tl.time(release, false)
      const socket = source.anchor(launchSocket(id, source))
      close(h.point(h.node(id + '-root')), socket, id + ' root follows posed semantic socket')
      if (id === 'doom-desire') {
        const origin = h.point(h.node('doom-desire-strike-origin')), tip = h.point(h.node(id + '-tip'))
        close(tip, origin, 'Doom Desire starts at its strike origin above the opponent')
        assert.ok(origin.y < target.anchor('center').y - .1, 'Doom Desire has visible descent headroom')
        h.tl.time((release + contact) / 2, false)
        const middle = h.point(h.node(id + '-tip'))
        assert.ok(middle.y > origin.y + .1 && middle.y < target.anchor('center').y, 'Doom Desire falls world-down in either direction')
      } else close(h.point(h.node(id + '-tip')), socket, id + ' front starts at posed semantic socket')
      h.tl.time(contact - .025, false)
      target.pose.x = reverse ? 4 : -4; target.pose.y = -11; target.pose.rotation = .019
      h.tl.time(contact, false); assert.deepEqual(cues, ['impact'])
      close(h.point(h.node(id + '-root')), source.anchor(launchSocket(id, source)), id + ' root remains live at contact')
      assertBounds(h, id + ' posed contact')
      const p = h.point(h.node(id + '-tip')); h.scene.fit(360, 480)
      close(h.point(h.node(id + '-tip')), p, id + ' camera fit preserves logical contact'); h.scene.fit(h.scene.width, h.scene.height)
      await complete(h, run, duration)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('late fragments, sparks, breath wisps and Bide motes continue flowing through their visible fade', async () => {
  const flows = [
    ['future-sight', 'future-sight-fragment-23', 2.10, 2.30, false],
    ['doom-desire', 'doom-desire-spark-27', 2.16, 2.36, true],
    ['yawn', 'yawn-wisp-0', 1.72, 1.99, false],
    ['yawn', 'yawn-pearl-0', 1.72, 1.99, true],
    ['bide', 'bide-force-ripple-0', 2.14, 2.44, false],
    ['bide', 'bide-cinder-0', 2.14, 2.44, true],
  ]
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id, label, first, second, down] of flows) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene }); await tick()
      h.tl.time(first, false); const node = h.node(label)
      assert.ok(node, label + ' exists'); const p = h.point(node); assert.ok(visibleAlpha(node) > .02, label + ' initially visible')
      h.tl.time(second, false); const q = h.point(node); assert.ok(visibleAlpha(node) > .02, label + ' visible during fade')
      assert.ok(Math.hypot(q.x - p.x, q.y - p.y) > .2, label + ' keeps moving')
      if (down) assert.ok(q.y > p.y + .1, label + ' gravity remains world-down')
      await complete(h, run, EFFECT_TIMINGS[id].duration)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})
