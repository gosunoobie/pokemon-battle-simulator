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
  ['horn-drill', null, 1.04, 2.3], ['guillotine', null, .94, 2.15],
  ['fissure', .44, 1.04, 2.65], ['sheer-cold', .58, 1.16, 2.7],
]
const physical = id => id === 'horn-drill' || id === 'guillotine'
const targetPoint = (target, id) => id === 'fissure' ? target.base('floor') : target.anchor('center')
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
function harness(reverse = false, edge = 0, custom = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const actors = [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32], ...(custom ? { horn: [.55, .15], claw: [.28, .4], ground: [.56, .96] } : {}) } },
    { id: 'target', profile: 'tall', x: reverse ? (edge === 2 ? .055 : .26) : (edge === 2 ? .945 : .74),
      y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: reverse ? 1 : -1,
      anchors: { center: edge === 3 ? [.5, .04] : [.48, .44] } },
  ]
  const scene = createSceneGraph({ width, height, actors })
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
    const p = a.anchor('visualCenter'), c = Math.abs(Math.cos(a.pose.rotation)), s = Math.abs(Math.sin(a.pose.rotation)),
      rx = (a.metrics.width*c + a.metrics.height*s)/2, ry = (a.metrics.height*c + a.metrics.width*s)/2
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

test('four OHKO moves are registered once as successful knockout previews with explicit reference metadata', () => {
  for (const [id,,contact,duration] of cases) {
    const rules = MOVE_RULES.filter(m => m.id === id), details = MOVES.find(m => m.id === id)
    assert.equal(rules.length, 1); assert.equal(FX_CATALOG.filter(m => m.id === id).length, 1)
    assert.equal(rules[0].ohko, true); assert.equal(rules[0].power, null); assert.equal(rules[0].accuracy, 30)
    assert.ok(details.showcase); assert.match(details.mechanicNote, /Successful one-hit knockout preview/)
    assert.match(details.mechanicNote, /Accuracy rolls, level restrictions, type immunities/)
    assert.equal(details.accuracyText, '30% base'); assert.deepEqual(EFFECT_TIMINGS[id], { contact, duration })
  }
})

test('successful OHKO samples remove exactly all remaining target HP for either side without changing any other state', () => {
  for (const [id] of cases) for (const sourceId of ['source', 'target']) for (const hp of [.5, 1, 83, 503, 9999]) for (const condition of [null, 'poison', 'freeze']) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const before = createBattleState([
      { id: sourceId, name: 'User', hp: 1, maxHp: 160, level: 1, condition: 'burn', specialAttackStage: -6, attackStage: -6, heldItem: 'Oran Berry' },
      { id: targetId, name: 'Target', hp, maxHp: 9999, level: 100, condition, defenseStage: 6, specialDefenseStage: 6,
        protected: true, lightScreen: true, reflect: true, confused: true, trapped: true, heldItem: 'Focus Sash' },
      { id: 'observer', name: 'Observer', hp: 42, maxHp: 100, condition: 'sleep' },
    ])
    const tx = resolveMove(before, { moveId: id, sourceId, targetId })
    assert.deepEqual(tx.after.actors, { ...before.actors, [targetId]: { ...before.actors[targetId], hp: 0 } })
    assert.equal(tx.after.revision, before.revision+1); assert.equal(tx.after.weather, before.weather)
    assert.deepEqual(tx.event.targetIds, [targetId]); assert.equal(tx.event.sourceId, sourceId)
    assert.equal(tx.event.beforeHp, hp); assert.equal(tx.event.afterHp, 0); assert.equal(tx.event.outcome, 'hit')
    assert.equal(tx.event.healing, undefined); assert.equal(tx.event.recoil, undefined); assert.equal(tx.event.selfDestruct, undefined)
    assert.equal(tx.event.resultMessage, 'Target was knocked out in one hit!')
    assert.equal(before.actors[targetId].hp, hp); assert.ok(Object.isFrozen(tx.after.actors[targetId])); assert.ok(Object.isFrozen(tx.event))
    assert.throws(() => resolveMove(tx.after, { moveId: id, sourceId, targetId }), /fainted/)
  }
})

test('OHKO previews retain invalid-participant and fainted-actor validation', () => {
  for (const [moveId] of cases) {
    const before = createBattleState()
    for (const [sourceId,targetId] of [['missing','target'],['source','missing'],['source','source']]) {
      assert.throws(() => resolveMove(before, { moveId, sourceId, targetId }), /Invalid move participants/)
    }
    for (const fainted of ['source','target']) {
      const state = createBattleState([{ id: 'source', name: 'User', hp: fainted === 'source' ? 0 : 1, maxHp: 160 },
        { id: 'target', name: 'Target', hp: fainted === 'target' ? 0 : 1, maxHp: 160 }])
      assert.throws(() => resolveMove(state, { moveId, sourceId: 'source', targetId: 'target' }), /fainted/)
    }
  }
})

test('knockout is committed before presentation and reconciles identically with effects off, cues, failure, missing cues or skip', async () => {
  for (const [id] of cases) for (const sourceId of ['source', 'target']) for (const mode of ['off','cue','failure','missing','skip']) {
    const targetId = sourceId === 'source' ? 'target' : 'source', before = createBattleState()
    const tx = resolveMove(before, { moveId: id, sourceId, targetId })
    assert.equal(tx.after.actors[targetId].hp, 0)
    let display, finish, cueState
    const presenter = createPresenter({ getScene: () => ({}), onDisplay: next => { display = next; if (next.animate) cueState = next.state },
      loadFx: async () => ({ play(request, options) {
        assert.equal(request.sourceId, sourceId); assert.deepEqual(request.targetIds, [targetId]); assert.equal(request.outcome, 'hit')
        for (const key of ['hp','damage','ohko','before','after','condition']) assert.equal(request[key], undefined, key+' stays out of FX')
        if (mode === 'failure') throw new Error('Simulated renderer failure')
        if (mode === 'cue') options.onCue({ type: 'impact' })
        return { finished: new Promise(resolve => { finish = resolve }), cancel() { finish?.({ status: 'cancelled' }) } }
      } }),
    })
    const pending = presenter.enqueue(tx, { effectsEnabled: mode !== 'off' }); await tick()
    if (mode === 'skip') presenter.skip(); else finish?.({ status: 'completed' })
    await pending; assert.deepEqual(display.state, tx.after, id+' '+mode); assert.equal(display.message, tx.event.resultMessage)
    if (mode === 'cue') assert.deepEqual(cueState, tx.after)
    assert.ok(before.actors[targetId].hp > 0); presenter.destroy()
  }
})

test('visible horn, pincers, crack and ice front meet their semantic target before one cue and clean up on every exit', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id,release,contact,duration] of cases) {
      const source = h.scene.actor('source'), target = h.scene.actor('target'), cues = []
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, {
        scene: h.scene, onCue: cue => {
          const tip = h.node(id+'-tip'), p = h.point(tip)
          close(p, targetPoint(target,id), id+' contact before cue')
          close(h.point(h.node(id+'-impact')), p, id+' impact meets contact')
          if (id === 'guillotine') close(h.point(h.node('guillotine-tip-lower')), p, 'opposing pincers converge')
          assert.ok(tip.alpha > .6, id+' visible contact'); cues.push(cue.type)
        },
      })
      await tick()
      if (release != null) { h.tl.time(release, false); close(h.point(h.node(id+'-tip')), source.anchor(id === 'fissure' ? 'ground' : 'emission'), id+' launch') }
      h.tl.time(contact-.001, false); assert.equal(cues.length, 0)
      h.tl.time(contact, false); assert.deepEqual(cues, ['impact'])
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

test('complete OHKO artwork and rotated actors fit field edges and portrait layouts from both sides', async () => {
  for (const reverse of [false, true]) for (const edge of [0, 1, 2, 3, 4]) {
    const h = harness(reverse, edge)
    try { for (const [id,,contact,duration] of cases) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, {
        scene: h.scene, onCue: () => close(h.point(h.node(id+'-tip')), targetPoint(h.scene.actor('target'),id), id+' edge contact'),
      })
      await tick(); let seen = 0
      for (let time = .04; time < duration-.02; time += .035) {
        h.tl.time(time, false); seen += assertBounds(h, `${id} edge ${edge} reverse ${reverse} time ${time}`)
      }
      assert.ok(seen > 0, id+' visible artwork'); h.tl.time(duration, false)
      assert.equal((await run.finished).status, 'completed'); clean(h)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('Horn Drill and Guillotine stay attached to supplied horn/claw or fallback emission/hand sockets', async () => {
  for (const reverse of [false, true]) for (const custom of [false, true]) {
    const h = harness(reverse, 0, custom), source = h.scene.actor('source')
    try { for (const [id,,contact,duration] of cases.filter(([id]) => physical(id))) {
      const socket = id === 'horn-drill' ? custom ? 'horn' : 'emission' : custom ? 'claw' : 'hand'
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene })
      await tick()
      for (const time of [.24, .54, contact-.08, contact, contact+.18, 1.35]) {
        h.tl.time(time, false); close(h.point(h.node(id+'-root')), source.anchor(socket), id+' attached root at '+time)
        assertBounds(h, id+' attached weapon')
      }
      h.tl.time(duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('Fissure follows custom ground sockets and its grit and Sheer Cold shards continue falling through the aftermath', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse, 0, true)
    try {
      const fissure = h.fx.play({ moveId: 'fissure', sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene })
      await tick(); h.tl.time(.44, false)
      close(h.point(h.node('fissure-tip')), h.scene.actor('source').anchor('ground'), 'custom ground launch')
      const floor = h.scene.actor('target').base('floor')
      h.tl.time(1.04, false); close(h.point(h.node('fissure-tip')), floor, 'sloped ground arrival')
      h.tl.time(1.14, false); close(h.point(h.node('fissure-impact')), floor, 'ground stays fixed during receiver jolt')
      h.tl.time(1.96, false); const grit = h.node('fissure-grit-39'), p = h.point(grit)
      assert.ok(grit.alpha > .02); h.tl.time(2.08, false); assert.ok(grit.alpha > .02)
      assert.ok(h.point(grit).y > p.y+.2, 'fissure grit falls world-down')
      h.tl.time(2.65, false); assert.equal((await fissure.finished).status, 'completed'); clean(h)
      const cold = h.fx.play({ moveId: 'sheer-cold', sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene })
      await tick(); h.tl.time(2.06, false); const shard = h.node('sheer-cold-shard-25'), q = h.point(shard)
      assert.ok(shard.alpha > .02); h.tl.time(2.22, false); assert.ok(shard.alpha > .02)
      assert.ok(h.point(shard).y > q.y+.2, 'sheer cold shards fall world-down')
      h.tl.time(2.7, false); assert.equal((await cold.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})
