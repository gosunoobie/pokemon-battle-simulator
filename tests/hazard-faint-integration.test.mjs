import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { gsap } from 'gsap'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { previewSceneActors } from '../apps/game/src/scene/previewActors.js'
import { createSimulationScene } from '../apps/shared/battle/scene.js'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'
import { createHazardDisplay, playConditionReaction } from '@battle/battle-fx/conditions'
import { playPokeballRelease, playPokemonFaint } from '@battle/battle-fx/transitions'

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture() {
  const member = (memberId, species, active = true) => ({ memberId, species, name: species, active,
    hp: { current: 48, max: 48 }, fainted: false, stages: {}, volatiles: [], moves: [] })
  const before = { matchId: 'hazard-faint', seat: 'p1', cursor: 1, turn: 2,
    own: { active: 'p1:1', team: [member('p1:1', 'Charizard')] },
    opponent: { active: 'p2:1', known: [member('p2:1', 'Venusaur'), member('p2:2', 'Blastoise', false)] },
    sideConditions: { p1: [], p2: ['Spikes'] }, sideConditionLayers: { p1: {}, p2: { Spikes: 3 } }, fieldConditions: [] }
  before.opponent.known[1].hp.current = 1
  const after = structuredClone(before)
  after.opponent.active = null; after.opponent.known[0].active = false
  Object.assign(after.opponent.known[1], { active: false, fainted: true, hp: { current: 0, max: 48 } }); after.cursor = 4
  const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
  return { before, after, events: [event(2, 'switch', 'p2:2', 'Blastoise, L100', '1/48'),
    event(3, '-damage', 'p2:2', '0 fnt', '[from] Spikes'), event(4, 'faint', 'p2:2')] }
}

test('real Spikes reaction retains a knocked-out entrant after release, then awaits real faint cleanup', async () => {
  const ready = { entry: deferred(), reaction: deferred(), faint: deferred() }, timelines = {}, order = [], displays = []
  const engine = kind => ({ timeline(options) { return timelines[kind] = gsap.timeline({ ...options, paused: true }) } })
  const coordinator = createSimulationScene({
    getHost: () => ({ appendChild() {} }), createHost: () => ({ remove() {} }),
    loadScene: async () => ({ previewSceneActors, createScene: async (host, options) => createSceneGraph(options) }),
    loadConditions: async () => ({ createHazardDisplay }),
    loadRelease: async () => ({ playPokeballRelease(options) {
      order.push('entry'); const run = playPokeballRelease({ ...options, timelineEngine: engine('entry') }); ready.entry.resolve(); return run
    } }),
    loadFaint: async () => ({ playPokemonFaint(options) {
      order.push('faint'); const run = playPokemonFaint({ ...options, timelineEngine: engine('faint') }); ready.faint.resolve(); return run
    } }),
  })
  const presenter = createSimulationPresenter({ getScene: coordinator.get, ensureScene: coordinator.ensure, faintScene: coordinator.faint,
    onDisplay(view, options) { displays.push(view); coordinator.display(view, options) },
    loadFx: async () => { throw new Error('Hazard damage must not replay a move') },
    loadConditions: async () => ({ playConditionReaction(request, options) {
      assert.equal(request.kind, 'spikes'); assert.equal(request.actorId, 'target')
      order.push('reaction'); const run = playConditionReaction(request, { ...options, timelineEngine: engine('reaction') }); ready.reaction.resolve(); return run
    } }),
  })
  try {
    const batch = fixture(); await coordinator.ensure(batch.before)
    const pending = presenter.present(batch)
    await ready.entry.promise
    assert.deepEqual(order, ['entry'])
    const scene = coordinator.get(), target = scene.actor('target')
    timelines.entry.time(1.35, false)
    await ready.reaction.promise
    assert.deepEqual(order, ['entry', 'reaction'])
    assert.equal(displays.at(-1).opponent.known[1].hp.current, 0)
    assert.equal(target.root.visible, true, 'zero HP keeps the entrant visible for its hazard reaction')
    assert.equal(target.pose.alpha, 1)
    assert.ok(scene.effects.getChildByLabel('condition-spikes'))
    assert.ok(scene.terrain.getChildByLabel('spikes-far-3', true))
    timelines.reaction.time(.3, false)
    assert.equal(target.root.visible, true); assert.equal(target.pose.alpha, 1)
    assert.deepEqual(order, ['entry', 'reaction'])
    timelines.reaction.time(.64, false)
    await ready.faint.promise
    assert.deepEqual(order, ['entry', 'reaction', 'faint'])
    assert.equal(target.root.visible, true); assert.equal(target.pose.alpha, 0)
    assert.ok(scene.effects.getChildByLabel('faint-copy-target', true))
    timelines.faint.time(.9, false)
    assert.equal((await pending).status, 'completed')
    assert.equal(coordinator.get().actor('target').root.visible, false)
    assert.equal(scene.effects.children.length, 0)
    assert.ok(coordinator.get().terrain.getChildByLabel('spikes-far-3', true), 'faint cleanup retains field hazards')
    assert.deepEqual(displays.at(-1), batch.after)
  } finally { presenter.destroy(); coordinator.destroy() }
})
