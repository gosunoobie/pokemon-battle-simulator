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
  ['water-pulse', .28, .76, 2.15, 42, 60, 100],
  ['octazooka', .32, .72, 2.05, 46, 65, 85],
]
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
const visibleAlpha = node => { let alpha = 1; for (let n = node; n; n = n.parent) alpha *= n.alpha; return alpha }
function harness(reverse = false, edge = 0, custom = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const scene = createSceneGraph({ width, height, actors: [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32], ...(custom ? { origin: [.43, .93], emission: [.64, .23] } : {}) } },
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

test('Water Pulse and Octazooka have unique Water rules, host descriptions and independent single-hit timings', () => {
  for (const [id, , contact, duration, damage, power, accuracy] of cases) {
    const rule = MOVE_RULES.find(move => move.id === id), move = MOVES.find(move => move.id === id)
    assert.equal(MOVE_RULES.filter(move => move.id === id).length, 1)
    assert.equal(FX_CATALOG.filter(move => move.id === id).length, 1)
    assert.equal(MOVES.filter(move => move.id === id).length, 1)
    assert.equal(rule.type, 'Water'); assert.equal(rule.power, power); assert.equal(rule.accuracy, accuracy); assert.equal(rule.damage, damage)
    assert.equal(rule.target, undefined); assert.deepEqual(EFFECT_TIMINGS[id], { contact, duration })
    assert.ok(move.showcase && move.description && move.mechanicNote)
    assert.equal(rule.confuses, undefined); assert.equal(rule.accuracyChange, undefined); assert.equal(rule.conditionOnHit, undefined)
    const actors = [{ id: 'a', name: 'User', hp: 19, maxHp: 100, condition: 'burn' }, { id: 'b', name: 'Target', hp: 82, maxHp: 100, condition: 'poison' }]
    assert.deepEqual(createPreviewState(move, { sourceId: 'a', targetId: 'b', actors }), createBattleState(actors), id + ' introduces no battle fixture')
  }
})

test('both successful water hits cap damage at remaining HP without random confusion, accuracy loss or unrelated state changes', () => {
  for (const [id, , , , damage] of cases) for (const sourceId of ['source', 'target']) for (const hp of [1, damage - 1, damage, 160])
    for (const accuracyStage of [-6, 0, 3]) for (const confused of [false, true]) for (const condition of [null, 'poison']) {
      const targetId = sourceId === 'source' ? 'target' : 'source'
      const before = createBattleState([
        { id: sourceId, name: 'User', hp: 39, maxHp: 100, condition: 'burn', attackStage: 2, accuracyStage: 1, protected: true, heldItem: 'Oran Berry', cursed: true },
        { id: targetId, name: 'Target', hp, maxHp: 160, condition, confused, accuracyStage, defenseStage: -2, specialDefenseStage: 3,
          protected: true, lightScreen: true, reflect: true, heldItem: 'Sitrus Berry', consumedItem: 'Lum Berry', seeded: true, destinyBond: true },
        { id: 'observer', name: 'Observer', hp: 17, maxHp: 80, condition: 'sleep', nightmare: true },
      ])
      const tx = resolveMove(before, { moveId: id, sourceId, targetId }), remaining = Math.max(0, hp - damage)
      assert.deepEqual(tx.after.actors[sourceId], before.actors[sourceId])
      assert.deepEqual(tx.after.actors[targetId], { ...before.actors[targetId], hp: remaining })
      assert.deepEqual(tx.after.actors.observer, before.actors.observer)
      assert.equal(tx.event.outcome, 'hit'); assert.deepEqual(tx.event.targetIds, [targetId])
      assert.equal(tx.event.beforeHp, hp); assert.equal(tx.event.afterHp, remaining)
      assert.equal(tx.event.healing, undefined); assert.equal(tx.event.recoil, undefined)
      assert.match(tx.event.resultMessage, new RegExp(`took ${Math.min(hp, damage)} damage`))
      assert.equal(before.actors[targetId].hp, hp); assert.equal(before.actors[sourceId].hp, 39)
      assert.ok(Object.isFrozen(tx.after) && Object.isFrozen(tx.after.actors[targetId]) && Object.isFrozen(tx.event))
    }
  for (const [id] of cases) for (const dead of ['source', 'target']) {
    const before = createBattleState([{ id: 'source', name: 'User', hp: dead === 'source' ? 0 : 50, maxHp: 100 }, { id: 'target', name: 'Target', hp: dead === 'target' ? 0 : 80, maxHp: 100 }])
    assert.throws(() => resolveMove(before, { moveId: id, sourceId: 'source', targetId: 'target' }), /fainted/)
  }
})

test('both committed water results reconcile after effects off, one cue, absent cues, failure or skip with only cosmetic requests entering FX', async () => {
  for (const [id] of cases) for (const sourceId of ['source', 'target']) for (const mode of ['off', 'cue', 'missing', 'failure', 'skip']) {
    const targetId = sourceId === 'source' ? 'target' : 'source', tx = createPreviewTransaction(MOVES.find(move => move.id === id), { sourceId, targetId })
    let display, finish, played = false, cueState
    const presenter = createPresenter({ getScene: () => ({}), onDisplay: next => { display = next; if (next.animate) cueState = next.state }, loadFx: async () => ({ play(request, options) {
      played = true
      assert.deepEqual(Object.keys(request).sort(), ['moveId', 'outcome', 'sourceId', 'targetIds', 'visualSeed'])
      assert.equal(request.moveId, id); assert.equal(request.sourceId, sourceId); assert.deepEqual(request.targetIds, [targetId]); assert.equal(request.outcome, 'hit')
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

test('visible water and ink fronts launch from emission, meet the target before one cue and clean up on normal, reduced and cancelled exits', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id, release, contact, duration] of cases) {
      const cues = [], run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => { checkCue(h, id, cue); cues.push(cue.type) } })
      await tick(); h.tl.time(release, false)
      close(h.point(h.node(id + '-root')), h.scene.actor('source').anchor('emission'), id + ' emitter')
      close(h.point(h.node(id + '-tip')), h.scene.actor('source').anchor('emission'), id + ' release')
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

test('complete water pulse, ink splash and actor contours fit upper, side and portrait fields in both directions', async () => {
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

test('custom registration and emission sockets remain live through posed release and moving target contact', async () => {
  for (const reverse of [false, true]) for (const custom of [false, true]) {
    const h = harness(reverse, 0, custom), source = h.scene.actor('source'), target = h.scene.actor('target')
    try { for (const [id, release, contact, duration] of cases) {
      const cues = [], run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, onCue: cue => { checkCue(h, id, cue); cues.push(cue.type) } })
      await tick(); h.tl.time(.12, false)
      source.pose.x = reverse ? -7 : 7; source.pose.y = -10; source.pose.rotation = .023
      target.pose.x = reverse ? 7 : -7; target.pose.y = -6; target.pose.rotation = -.018
      h.tl.time(release, false)
      close(h.point(h.node(id + '-root')), source.anchor('emission'), id + ' root follows custom posed emission')
      close(h.point(h.node(id + '-tip')), source.anchor('emission'), id + ' front starts at custom posed emission')
      h.tl.time(contact - .025, false)
      target.pose.x = reverse ? 4 : -4; target.pose.y = -11; target.pose.rotation = .019
      h.tl.time(contact, false); assert.deepEqual(cues, ['impact'])
      close(h.point(h.node(id + '-root')), source.anchor('emission'), id + ' emitter stays live at contact')
      assertBounds(h, id + ' posed contact')
      const p = h.point(h.node(id + '-tip')); h.scene.fit(360, 480)
      close(h.point(h.node(id + '-tip')), p, id + ' camera fit preserves logical contact')
      h.scene.fit(h.scene.width, h.scene.height)
      await complete(h, run, duration)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('splash droplets keep falling in world coordinates and ink billows continue moving through their fade', async () => {
  const flows = [
    ['water-pulse', 'water-pulse-drop-27', 1.5, 1.7, true],
    ['octazooka', 'octazooka-drop-0', 1.48, 1.76, true],
    ['octazooka', 'octazooka-billow-0', 1.48, 1.76, false],
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
