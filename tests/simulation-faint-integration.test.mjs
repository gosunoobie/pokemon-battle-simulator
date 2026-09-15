import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { gsap } from 'gsap'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { previewSceneActors } from '../apps/game/src/scene/previewActors.js'
import { createSimulationScene } from '../apps/simulation/src/scene.js'
import { createSimulationPresenter } from '../apps/simulation/src/presentation.js'
import { playPokemonFaint } from '@battle/battle-fx/transitions'

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture() {
  const member = (memberId, species, hp) => ({ memberId, species, name: species, active: true, hp: { current: hp, max: hp }, fainted: false, stages: {}, volatiles: [], moves: [] })
  const before = { matchId: 'faint-integration', seat: 'p1', cursor: 1, turn: 1,
    own: { active: 'p1:1', team: [member('p1:1', 'Charizard', 300)] },
    opponent: { active: 'p2:1', known: [member('p2:1', 'Venusaur', 48)] }, sideConditions: { p1: [], p2: [] }, fieldConditions: [] }
  const after = structuredClone(before)
  Object.assign(after.opponent.known[0], { fainted: true, active: false, hp: { current: 0, max: 48 } })
  after.opponent.known.push(member('p2:2', 'Gengar', 48)); after.opponent.active = 'p2:2'; after.cursor = 5
  const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
  return { before, after, events: [event(2, 'move', 'p1:1', 'Flamethrower', 'p2:1'), event(3, '-damage', 'p2:1', '0 fnt'),
    event(4, 'faint', 'p2:1'), event(5, 'switch', 'p2:2', 'Gengar, L100', '48/48')] }
}
function harness({ holdAttack = false, timeoutMs = 7500 } = {}) {
  const attackReady = deferred(), attackDone = deferred(), faintReady = deferred(), displayed = [], scenes = [], entries = []
  let faintTimeline, faintCount = 0, visibilityBeforeReplacement
  const coordinator = createSimulationScene({
    getHost: () => ({ appendChild() {} }), createHost: () => ({ remove() {} }),
    loadScene: async () => ({ previewSceneActors, createScene: async (host, options) => {
      if (options.actors[1].profile === 'gengar') visibilityBeforeReplacement = coordinator.get()?.actor('target').root.visible
      const scene = createSceneGraph(options); scenes.push(scene); return scene
    } }),
    loadFaint: async () => ({ playPokemonFaint(options) {
      faintCount++
      const playback = playPokemonFaint({ ...options, timelineEngine: { timeline(config) { return faintTimeline = gsap.timeline({ ...config, paused: true }) } } })
      faintReady.resolve(); return playback
    } }),
    loadRelease: async () => ({ playPokeballRelease(options) { entries.push(options.actorIds); return { finished: Promise.resolve({ status: 'completed' }), cancel() {} } } }),
  })
  const presenter = createSimulationPresenter({ getScene: coordinator.get, ensureScene: coordinator.ensure,
    faintScene: coordinator.faint, onDisplay(view, options) { displayed.push(view); coordinator.display(view, options) }, timeoutMs,
    loadFx: async () => ({ play(request, options) { options.onCue({ type: 'impact' }); attackReady.resolve();
      return { finished: holdAttack ? attackDone.promise : Promise.resolve({ status: 'completed' }), cancel() {} }
    } }),
  })
  return { coordinator, presenter, attackReady, attackDone, faintReady, displayed, scenes, entries,
    get timeline() { return faintTimeline }, get faintCount() { return faintCount }, get visibilityBeforeReplacement() { return visibilityBeforeReplacement },
    dispose() { presenter.destroy(); coordinator.destroy() },
  }
}

test('real faint clip follows HP impact and attack recovery, hides the old root, then permits replacement', async () => {
  const h = harness({ holdAttack: true }), batch = fixture()
  try {
    await h.coordinator.ensure(batch.before)
    const scene = h.coordinator.get(), opponent = scene.actor('target')
    const pending = h.presenter.present(batch)
    await h.attackReady.promise
    assert.equal(h.displayed.at(-1).opponent.known[0].hp.current, 0)
    assert.equal(opponent.root.visible, true, 'zero HP does not pop artwork out during the attack')
    assert.equal(h.faintCount, 0)
    h.attackDone.resolve({ status: 'completed' }); await h.faintReady.promise
    assert.equal(opponent.root.visible, true)
    assert.equal(opponent.pose.alpha, 0, 'owned copy replaces the retained live pose')
    assert.ok(scene.effects.getChildByLabel('faint-copy-target', true))
    h.timeline.time(.44, false)
    assert.equal(scene.actor('source').pose.alpha, 1)
    assert.equal(h.entries.length, 0)
    h.timeline.time(.9, false)
    assert.equal((await pending).status, 'completed')
    assert.equal(h.faintCount, 1)
    assert.equal(h.visibilityBeforeReplacement, false, 'outgoing sprite is hidden before constructing its replacement')
    assert.deepEqual(h.entries, [['target']])
    assert.equal(h.coordinator.get().actor('target').root.visible, true)
    assert.equal(h.coordinator.get().effects.children.length, 0)
    assert.deepEqual(h.displayed.at(-1), batch.after)
  } finally { h.dispose() }
})

test('skip, reset and a stalled faint deadline clean real copies and never affect replacement artwork later', async () => {
  for (const action of ['skip', 'reset', 'timeout']) {
    const h = harness({ timeoutMs: action === 'timeout' ? 30 : 7500 }), batch = fixture()
    try {
      await h.coordinator.ensure(batch.before)
      const original = h.coordinator.get()
      const pending = h.presenter.present(batch)
      await h.faintReady.promise
      h.timeline.time(.44, false)
      if (action === 'skip') h.presenter.skip()
      if (action === 'reset') h.presenter.reset(batch.before)
      const result = await pending
      assert.equal(result.status, action === 'skip' ? 'skipped' : action === 'reset' ? 'cancelled' : 'failed')
      assert.equal(original.effects.children.length, 0)
      const current = h.coordinator.get(), expected = action === 'reset' ? batch.before : batch.after
      assert.deepEqual(h.displayed.at(-1), expected)
      assert.equal(current.actor('target').root.visible, true)
      assert.equal(current.actor('target').pose.alpha, 1)
      h.timeline.time(.9, false); await tick()
      assert.equal(h.coordinator.get(), current)
      assert.equal(current.actor('target').root.visible, true)
      assert.equal(current.actor('target').pose.alpha, 1)
      assert.equal(h.entries.length, 0, 'reconciliation never replays a replacement entry')
    } finally { h.dispose() }
  }
})
