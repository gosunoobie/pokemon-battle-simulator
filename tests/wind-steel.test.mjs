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
  ['gust', .24, .62, 1.7, 28], ['icy-wind', .38, .88, 2.25, 38],
  ['silver-wind', .36, .9, 2.3, 42], ['twister', .36, .92, 2.5, 28],
  ['steel-wing', null, .76, 1.85, 48],
]
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
function harness(reverse = false, edge = 0, wing = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const actors = [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32], ...(wing ? { wing: [.28, .23] } : {}) } },
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

test('wind additions and Steel Wing are selectable once with fixed immutable damage and preserved conditions', () => {
  for (const [id,,contact,duration,damage] of cases) {
    assert.equal(MOVE_RULES.filter(m => m.id === id).length, 1)
    assert.equal(FX_CATALOG.filter(m => m.id === id).length, 1)
    assert.ok(MOVES.find(m => m.id === id)?.showcase)
    assert.deepEqual(EFFECT_TIMINGS[id], { contact, duration })
    for (const reverse of [false, true]) for (const hp of [1, 160]) {
      const sourceId = reverse ? 'b' : 'a', targetId = reverse ? 'a' : 'b'
      const before = createBattleState([
        { id: sourceId, name: 'User', hp: 60, maxHp: 100, condition: 'burn', defenseStage: 2, heldItem: 'Oran Berry' },
        { id: targetId, name: 'Target', hp, maxHp: 160, condition: 'poison', speedStage: -2, confused: true },
      ])
      const tx = resolveMove(before, { moveId: id, sourceId, targetId }), afterHp = Math.max(0, hp-damage)
      assert.deepEqual(tx.after.actors[sourceId], before.actors[sourceId])
      assert.deepEqual(tx.after.actors[targetId], { ...before.actors[targetId], hp: afterHp,
        speedStage: id === 'icy-wind' && afterHp > 0 ? -3 : -2 })
      assert.equal(tx.event.outcome, 'hit'); assert.equal(tx.event.healing, undefined)
      assert.deepEqual(tx.event.targetIds, [targetId]); assert.equal(before.actors[targetId].hp, hp)
      assert.ok(Object.isFrozen(tx.after.actors[targetId]))
    }
  }
})

test('Icy Wind damages at the Speed floor and applies its drop only to a surviving target', () => {
  for (const sourceId of ['source', 'target']) for (const speedStage of [-6, -5, 0, 6]) for (const hp of [1, 38, 160]) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const before = createBattleState([
      { id: sourceId, name: 'User', hp: 80, maxHp: 100, specialAttackStage: 2 },
      { id: targetId, name: 'Target', hp, maxHp: 160, speedStage, condition: 'poison', confused: true },
    ])
    const tx = resolveMove(before, { moveId: 'icy-wind', sourceId, targetId }), afterHp = Math.max(0, hp-38)
    assert.deepEqual(tx.after.actors[sourceId], before.actors[sourceId])
    assert.deepEqual(tx.after.actors[targetId], { ...before.actors[targetId], hp: afterHp,
      speedStage: afterHp > 0 ? Math.max(-6, speedStage-1) : speedStage })
    assert.equal(tx.event.outcome, 'hit'); assert.match(tx.event.resultMessage, new RegExp(`took ${Math.min(hp,38)} damage`))
    if (afterHp === 0) assert.doesNotMatch(tx.event.resultMessage, /Speed/)
    else assert.match(tx.event.resultMessage, speedStage === -6 ? /Speed cannot fall further/ : /Speed fell/)
  }
})

test('wind results including Icy Wind Speed reconcile with effects off, a cue, a failure or a skip', async () => {
  for (const [id] of cases) for (const sourceId of ['source', 'target']) for (const mode of ['off', 'cue', 'failure', 'skip']) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const tx = resolveMove(createBattleState(), { moveId: id, sourceId, targetId })
    let display, finish, cueState
    const presenter = createPresenter({ getScene: () => ({}), onDisplay: next => { display = next; if (next.animate) cueState = next.state },
      loadFx: async () => ({ play(request, options) {
        assert.equal(request.sourceId, sourceId); assert.deepEqual(request.targetIds, [targetId])
        assert.equal(request.hp, undefined); assert.equal(request.speedStage, undefined)
        if (mode === 'failure') throw new Error('Simulated renderer failure')
        if (mode === 'cue') options.onCue({ type: 'impact' })
        return { finished: new Promise(resolve => { finish = resolve }), cancel() { finish?.({ status: 'cancelled' }) } }
      } }),
    })
    const pending = presenter.enqueue(tx, { effectsEnabled: mode !== 'off' })
    await tick()
    if (mode === 'skip') presenter.skip(); else finish?.({ status: 'completed' })
    await pending; assert.deepEqual(display.state, tx.after, id+' '+mode)
    if (mode === 'cue') assert.deepEqual(cueState, tx.after)
    presenter.destroy()
  }
})

test('four wind fronts and the wing tip contact before one cue and clean up on completion, cancel and reduced motion', async () => {
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id,release,contact,duration] of cases) {
      const source = h.scene.actor('source'), target = h.scene.actor('target'), cues = []
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, {
        scene: h.scene, onCue: cue => {
          const tip = h.node(id+'-tip'), p = h.point(tip)
          close(p, target.anchor('center'), id+' contact before cue')
          close(h.point(h.node(id+'-impact')), p, id+' impact meets contact')
          assert.ok(tip.alpha > .6, id+' visible contact'); cues.push(cue.type)
        },
      })
      await tick()
      if (release != null) { h.tl.time(release, false); close(h.point(h.node(id+'-tip')), source.anchor('emission'), id+' launch') }
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

test('full wind and metal artwork and rotated actors fit both directions, field edges and portrait layouts', async () => {
  for (const reverse of [false, true]) for (const edge of [0, 1, 2, 3, 4]) {
    const h = harness(reverse, edge)
    try { for (const [id,,contact,duration] of cases) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, {
        scene: h.scene, onCue: () => close(h.point(h.node(id+'-tip')), h.scene.actor('target').anchor('center'), id+' edge contact'),
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

test('Steel Wing stays rooted to the supplied wing or fallback hand and Gust honors a custom wing release', async () => {
  for (const reverse of [false, true]) for (const custom of [false, true]) {
    const h = harness(reverse, 0, custom), source = h.scene.actor('source')
    try {
      const run = h.fx.play({ moveId: 'steel-wing', sourceId: 'source', targetIds: ['target'] }, { scene: h.scene })
      await tick()
      for (const time of [.24, .46, .66, .76, .92, 1.12]) {
        h.tl.time(time, false)
        close(h.point(h.node('steel-wing-root')), source.anchor(custom ? 'wing' : 'hand'), 'attached wing root at '+time)
        assertBounds(h, 'attached wing')
      }
      h.tl.time(1.85, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      const gust = h.fx.play({ moveId: 'gust', sourceId: 'source', targetIds: ['target'] }, { scene: h.scene })
      await tick(); h.tl.time(.24, false)
      close(h.point(h.node('gust-tip')), source.anchor(custom ? 'wing' : 'emission'), 'Gust release socket')
      h.tl.time(1.7, false); assert.equal((await gust.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('wind particles keep moving through their aftermath and Icy Wind holds its source through stream cutoff', async () => {
  const flow = [
    ['gust', 'gust-curl-17', .84, .98], ['icy-wind', 'icy-wind-flake-33', 1.73, 1.83],
    ['silver-wind', 'silver-wind-scale-51', 1.75, 1.85], ['twister', 'twister-debris-7', 1.93, 2.1],
  ]
  for (const reverse of [false, true]) {
    const h = harness(reverse)
    try { for (const [id, label, first, second] of flow) {
      const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene })
      await tick()
      if (id === 'icy-wind') {
        h.tl.time(.38, false); const emission = h.scene.actor('source').anchor('emission')
        h.tl.time(1.6, false); close(h.scene.actor('source').anchor('emission'), emission, 'held cold-stream release pose')
      }
      h.tl.time(first, false); const particle = h.node(label), p = h.point(particle)
      assert.ok(particle.alpha > .02, label+' visible during aftermath')
      h.tl.time(second, false); const q = h.point(particle)
      assert.ok(particle.alpha > .02, label+' stays visible during fade')
      assert.ok(Math.hypot(p.x-q.x, p.y-q.y) > .5, label+' keeps moving')
      h.tl.time(EFFECT_TIMINGS[id].duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})
