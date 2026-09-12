import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture, TextureSource } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
const weatherMoves = ['rain-dance', 'sunny-day', 'sandstorm', 'hail']
const tick = () => new Promise(resolve => setImmediate(resolve))

test('weather belongs to the field, replaces prior weather and preserves every actor field from either side', () => {
  for (const sourceId of ['a', 'b']) {
    let state = createBattleState([
      { id: 'a', name: 'Near', hp: 72, maxHp: 156, condition: 'burn', attackStage: 2, reflect: true },
      { id: 'b', name: 'Far', hp: 91, maxHp: 160, condition: 'poison', confused: true, trapped: true },
    ])
    const actors = state.actors
    assert.equal(state.weather, null)
    for (const moveId of [...weatherMoves, 'rain-dance', 'rain-dance']) {
      const before = state, tx = resolveMove(before, { moveId, sourceId })
      state = tx.after
      assert.equal(state.weather, MOVE_RULES.find(m => m.id === moveId).weather)
      assert.deepEqual(state.actors, actors); assert.deepEqual(tx.event.targetIds, [])
      assert.equal(tx.event.outcome, 'hit'); assert.equal(tx.event.afterHp, undefined)
      assert.equal(state.revision, before.revision + 1); assert.ok(Object.isFrozen(state))
      assert.equal(tx.before, before); assert.match(tx.event.resultMessage, /Weather preview/)
    }
    const damage = resolveMove(state, { moveId: 'tackle', sourceId, targetId: sourceId === 'a' ? 'b' : 'a' })
    assert.equal(damage.after.weather, 'rain'); assert.equal(createBattleState().weather, null)
  }
  for (const moveId of weatherMoves) {
    for (const hp of [0, 100]) {
      const state = createBattleState([{ id: 'a', name: 'User', hp, maxHp: 100 }])
      if (hp) assert.doesNotThrow(() => resolveMove(state, { moveId, sourceId: 'a' }))
      else assert.throws(() => resolveMove(state, { moveId, sourceId: 'a' }), /fainted/)
      assert.throws(() => resolveMove(state, { moveId, sourceId: 'missing' }), /participants/)
    }
    const state = createBattleState([{ id: 'a', name: 'User', hp: 100, maxHp: 100 }, { id: 'b', name: 'Fainted opponent', hp: 0, maxHp: 100 }])
    assert.doesNotThrow(() => resolveMove(state, { moveId, sourceId: 'a', targetId: 'b' }))
  }
})

test('weather display reconciles on impact, skip, no FX, failed FX and missing cue, and rejects stale cues after reset', async () => {
  for (const moveId of weatherMoves) for (const mode of ['impact', 'skip', 'off', 'failure', 'no-cue']) {
    const tx = resolveMove(createBattleState(), { moveId, sourceId: 'target' })
    let display, options, imports = 0
    const p = createPresenter({ getScene: () => ({}), onDisplay: v => { display = v }, loadFx: () => {
      imports++; if (mode === 'failure') throw Error('unavailable')
      return { play(request, opts) {
        assert.deepEqual(request.targetIds, []); assert.equal(request.weather, undefined)
        options = opts
        return { finished: mode === 'no-cue' ? Promise.resolve({ status: 'completed' }) : new Promise(() => {}), cancel() {} }
      } }
    } })
    const run = p.enqueue(tx, { effectsEnabled: mode !== 'off' }); await tick()
    if (mode === 'impact') {
      assert.equal(display.state.weather, null); options.onCue({ type: 'impact' }); assert.equal(display.state, tx.after)
      p.skip()
    } else if (mode === 'skip') p.skip()
    await run; assert.equal(display.state, tx.after)
    if (mode === 'off') assert.equal(imports, 0)
    const fresh = createBattleState(); p.reset(fresh); options?.onCue({ type: 'impact' })
    assert.equal(display.state, fresh); assert.equal(display.state.weather, null); p.destroy()
  }
})

function harness(width, height, size, facing) {
  let tl
  const tex = new Texture({ source: new TextureSource({ width: 96, height: 96 }) })
  const scene = createSceneGraph({ width, height, textures: { charizard: tex }, actors: [
    { id: 'only', profile: 'charizard', x: facing === 1 ? .27 : .73, y: .75, height: size, facing },
  ] })
  const fx = createBattleFx({ glowTexture: Texture.WHITE, timelineEngine: { timeline(options) { return tl = gsap.timeline({ ...options, paused: true }) } } })
  return { scene, fx, get tl() { return tl }, dispose() { fx.dispose(); scene.dispose(); tex.destroy(true) } }
}
function snapshot(node) {
  return [node.label, node.x, node.y, node.alpha, node.rotation, node.scale.x, node.scale.y,
    node.context ? [node.getLocalBounds().x, node.getLocalBounds().y, node.getLocalBounds().width, node.getLocalBounds().height] : null,
    ...node.children.map(snapshot)]
}

test('weather uses identical field geometry for small/large sprites and either user, and keeps flowing until fade', async () => {
  for (const [width, height] of [[1000, 450], [720, 600]]) for (const moveId of weatherMoves) {
    const frames = []
    for (const [size, facing] of [[.17, 1], [.47, -1]]) {
      const h = harness(width, height, size, facing), actor = h.scene.actor('only'), cues = []
      const base = actor.anchor('center'), platforms = snapshot(h.scene.terrain)
      const run = h.fx.play({ moveId, sourceId: 'only', targetIds: [], visualSeed: 42 }, { scene: h.scene, onCue: c => cues.push(c.type) })
      await tick(); const timing = EFFECT_TIMINGS[moveId]
      h.tl.time(timing.contact - .01, false); assert.deepEqual(cues, [])
      h.tl.time(timing.contact + .01, false); assert.deepEqual(cues, ['impact'])
      const art = h.scene.effects.getChildByLabel('move-artwork', true); assert.ok(art.alpha > .8)
      h.tl.time(1.15, false); const first = snapshot(art); frames.push(first)
      h.tl.time(1.4, false); assert.notDeepEqual(snapshot(art), first, moveId + ' continuous movement')
      assert.deepEqual(actor.anchor('center'), base); assert.equal(actor.pose.alpha, 1)
      assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
      assert.deepEqual(snapshot(h.scene.terrain), platforms)
      const beforeFit = snapshot(art); h.scene.fit(320, 480); assert.deepEqual(snapshot(art), beforeFit)
      h.tl.time(timing.duration - .02, false); assert.equal(art.alpha, 0)
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed')
      assert.equal(h.scene.effects.children.length, 0); h.dispose()
    }
    assert.deepEqual(frames[0], frames[1], moveId + ' independent of sprite dimensions/facing/position')
  }
  gsap.ticker.sleep()
})

test('weather works without an opponent in reduced motion and cleans up on cancellation and replacement', async () => {
  const h = harness(1000, 450, .3, -1)
  for (const moveId of weatherMoves) {
    const cues = [], run = h.fx.play({ moveId, sourceId: 'only' }, { scene: h.scene, reducedMotion: true, onCue: c => cues.push(c.type) })
    await tick(); h.tl.time(.2, false)
    const wash = h.scene.effects.getChildByLabel('weather-reduced-wash', true)
    assert.equal(wash.width, 1000); assert.equal(wash.height, 450); assert.equal(wash.alpha, .1)
    h.tl.time(.8, false); assert.equal((await run.finished).status, 'completed'); assert.deepEqual(cues, ['impact'])
    const first = h.fx.play({ moveId, sourceId: 'only' }, { scene: h.scene }); await tick(); h.tl.time(1, false)
    const next = h.fx.play({ moveId, sourceId: 'only' }, { scene: h.scene }); await tick()
    assert.equal((await first.finished).status, 'cancelled'); next.cancel()
    assert.equal((await next.finished).status, 'cancelled'); assert.equal(h.scene.effects.children.length, 0)
  }
  h.dispose(); gsap.ticker.sleep()
})
