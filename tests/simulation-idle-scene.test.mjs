import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationScene } from '../apps/simulation/src/scene.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const point = (x, y) => ({ x, y, copyFrom(value) { this.x = value.x; this.y = value.y } })
function view() {
  const member = (memberId, species) => ({ memberId, species, fainted: false, hp: { current: 100, max: 100 } })
  return { matchId: 'match-one', own: { active: 'p1:1', team: [member('p1:1', 'Charizard'), member('p1:2', 'Blastoise')] },
    opponent: { active: 'p2:1', known: [member('p2:1', 'Venusaur')] } }
}
function makeActor(id) {
  return { id, root: { visible: true }, pose: { position: point(0, 0), scale: point(1, 1), rotation: 0, alpha: 1, tint: 0xffffff },
    resetPose() { this.pose.position.copyFrom({ x: 0, y: 0 }); this.pose.scale.copyFrom({ x: 1, y: 1 }); this.pose.rotation = 0; this.pose.alpha = 1; this.pose.tint = 0xffffff } }
}
function harness(options = {}) {
  const scenes = [], idles = [], releases = [], faints = [], events = [], loads = []
  const module = { createIdleMotion({ scene }) {
    const state = { scene, ids: [], starts: 0, pauses: 0, disposed: 0, owned: new Map() }
    const restore = () => {
      for (const [id, position] of state.owned) scene.actor(id).pose.position.copyFrom(position)
      state.owned.clear(); state.ids = []
    }
    idles.push(state)
    return { setActors(ids) {
      restore(); state.ids = [...ids]; state.starts++
      for (const id of ids) {
        const position = scene.actor(id).pose.position
        state.owned.set(id, { x: position.x, y: position.y })
        position.x += 3; position.y -= 2
      }
    }, pause() { state.pauses++; restore() }, dispose() { restore(); state.disposed++; events.push(['idle-dispose', scene]) } }
  } }
  function clip(list, request) {
    const done = deferred(), state = { ...request, done }
    list.push(state)
    return { finished: done.promise, cancel() { done.resolve({ status: 'cancelled' }) } }
  }
  const coordinator = createSimulationScene({
    getHost: () => ({ appendChild() {} }), createHost: () => ({ remove() {} }),
    loadScene: async () => ({ previewSceneActors: (...profiles) => profiles.map((profile, index) => ({ id: index ? 'target' : 'source', profile })),
      async createScene() {
        const scene = { actors: ['source', 'target'].map(makeActor), disposed: 0,
          actor(id) { return this.actors.find(actor => actor.id === id) },
          dispose() { scene.disposed++; events.push(['scene-dispose', scene]) } }
        scenes.push(scene)
        if (options.sceneGate) await options.sceneGate.promise
        return scene
      } }),
    loadIdle: () => { const gate = options.loadIdle?.(); loads.push(gate); return gate ?? Promise.resolve(module) },
    loadRelease: async () => ({ playPokeballRelease: request => clip(releases, request) }),
    loadFaint: async () => ({ playPokemonFaint: request => clip(faints, request) }),
  })
  return { coordinator, scenes, idles, releases, faints, events, loads, module }
}

async function start(h, current = view()) {
  h.coordinator.setIdleMotion({ enabled: true })
  await h.coordinator.ensure(current)
  await tick()
  return current
}

test('idle remains opt-in and repeated enabled settings or display updates reuse one controller', async () => {
  const h = harness(), current = view()
  await h.coordinator.ensure(current)
  await tick()
  assert.equal(h.loads.length, 0)
  h.coordinator.setIdleMotion({ enabled: true })
  await tick()
  assert.deepEqual(h.idles[0].ids, ['source', 'target'])
  for (let i = 0; i < 4; i++) {
    h.coordinator.setIdleMotion({ enabled: true, reducedMotion: false, paused: false })
    h.coordinator.display(structuredClone(current))
  }
  assert.equal(h.loads.length, 1)
  assert.equal(h.idles.length, 1)
  assert.equal(h.idles[0].starts, 1)
  h.coordinator.destroy()
})

test('pause synchronously releases idle poses and repeated pause or disposal preserves a subsequent attack pose', async () => {
  const h = harness(), current = await start(h), scene = h.coordinator.get()
  assert.equal(scene.actor('source').pose.position.x, 3)
  h.coordinator.setIdleMotion({ paused: true })
  assert.equal(scene.actor('source').pose.position.x, 0)
  scene.actor('source').pose.position.copyFrom({ x: 57, y: -16 })
  h.coordinator.setIdleMotion({ paused: true })
  h.coordinator.setIdleMotion({ enabled: false, reducedMotion: true })
  h.coordinator.display(current)
  await h.coordinator.ensure(current)
  assert.equal(scene.actor('source').pose.position.x, 57)
  assert.equal(scene.actor('source').pose.position.y, -16)
  assert.equal(h.idles[0].pauses, 1)
  h.coordinator.destroy()
  assert.equal(scene.actor('source').pose.position.x, 57)
  assert.equal(h.idles[0].disposed, 1)
  assert.deepEqual(h.events.map(([event]) => event), ['idle-dispose', 'scene-dispose'])
})

test('effects-off, reduced motion and battle completion stop idle until every enabling condition allows it', async () => {
  const h = harness(), current = await start(h)
  h.coordinator.setIdleMotion({ reducedMotion: true })
  assert.deepEqual(h.idles[0].ids, [])
  h.coordinator.setIdleMotion({ enabled: false, reducedMotion: false })
  assert.deepEqual(h.idles[0].ids, [])
  h.coordinator.setIdleMotion({ enabled: true })
  assert.deepEqual(h.idles[0].ids, ['source', 'target'])
  h.coordinator.display({ ...current, result: { winner: 'p1' } })
  assert.deepEqual(h.idles[0].ids, [])
  h.coordinator.display(current)
  assert.deepEqual(h.idles[0].ids, ['source', 'target'])
  assert.equal(h.idles.length, 1)
  h.coordinator.destroy()
})

test('only the matching visible living actor idles; retained defeats and mismatched members cannot borrow motion', async () => {
  const h = harness(), current = await start(h), after = structuredClone(current)
  after.own.team[0].fainted = true; after.own.team[0].hp.current = 0
  h.coordinator.display(after, { retainFaintedActorIds: ['source'] })
  assert.equal(h.coordinator.get().actor('source').root.visible, true)
  assert.deepEqual(h.idles[0].ids, ['target'])
  assert.equal(h.coordinator.get().actor('source').pose.position.x, 0)
  const mismatched = structuredClone(after)
  mismatched.opponent.known[0].species = 'Blastoise'
  h.coordinator.display(mismatched)
  assert.deepEqual(h.idles[0].ids, [])
  const missing = structuredClone(current); missing.own.active = null
  h.coordinator.display(missing)
  assert.deepEqual(h.idles[0].ids, ['target'])
  missing.opponent.known[0].hp.current = 0
  h.coordinator.display(missing)
  assert.deepEqual(h.idles[0].ids, [])
  h.coordinator.destroy()
})

test('rendering a switch restores idle before copying the unchanged side and waits for release settlement', async () => {
  const options = {}, h = harness(options), current = await start(h), old = h.coordinator.get(), next = structuredClone(current)
  options.sceneGate = deferred(); next.own.active = 'p1:2'
  const switching = h.coordinator.ensure(next, { entryActorIds: ['source'] })
  assert.equal(old.actor('target').pose.position.x, 0)
  await tick()
  assert.deepEqual(h.idles[0].ids, [])
  options.sceneGate.resolve()
  await tick()
  const incoming = h.coordinator.get()
  assert.notEqual(incoming, old)
  assert.equal(incoming.actor('target').pose.position.x, 0)
  assert.equal(h.idles.length, 1)
  assert.deepEqual(h.events.map(([event]) => event), ['idle-dispose', 'scene-dispose'])
  h.coordinator.setIdleMotion({ paused: true })
  h.releases[0].done.resolve({ status: 'completed' })
  await switching; await tick()
  assert.equal(h.idles.length, 1, 'the presenter pause remains authoritative after entry')
  h.coordinator.setIdleMotion({ paused: false })
  await tick()
  assert.deepEqual(h.idles[1].ids, ['source', 'target'])
  assert.equal(h.idles[1].scene, incoming)
  h.coordinator.destroy()
})

test('fainting pauses all idle during the transition then resumes only the survivor', async () => {
  const h = harness(), current = await start(h), after = structuredClone(current)
  after.own.team[0].fainted = true; after.own.team[0].hp.current = 0
  h.coordinator.display(after, { retainFaintedActorIds: ['source'] })
  const fainting = h.coordinator.faint(after, { actorIds: ['source'] })
  assert.deepEqual(h.idles[0].ids, [])
  assert.equal(h.coordinator.get().actor('target').pose.position.x, 0)
  await tick()
  h.faints[0].done.resolve({ status: 'completed' })
  await fainting
  assert.deepEqual(h.idles[0].ids, ['target'])
  assert.equal(h.coordinator.get().actor('source').root.visible, false)
  h.coordinator.destroy()
})

test('clear, destroy, disabled settings and paused settings invalidate an unresolved idle import', async () => {
  for (const action of ['clear', 'destroy', 'disable', 'pause']) {
    const gate = deferred(), h = harness({ loadIdle: () => gate.promise })
    await start(h)
    assert.equal(h.loads.length, 1)
    if (action === 'disable') h.coordinator.setIdleMotion({ enabled: false })
    else if (action === 'pause') h.coordinator.setIdleMotion({ paused: true })
    else h.coordinator[action]()
    gate.resolve(h.module)
    await tick()
    assert.equal(h.idles.length, 0, action)
    h.coordinator.destroy()
  }
})

test('a late import cannot attach to a replaced scene and repeated pending syncs share the current request', async () => {
  const gates = [], h = harness({ loadIdle: () => { const gate = deferred(); gates.push(gate); return gate.promise } })
  const current = await start(h), old = h.coordinator.get(), next = structuredClone(current)
  next.own.active = 'p1:2'
  await h.coordinator.ensure(next)
  await tick()
  assert.equal(gates.length, 2)
  h.coordinator.display(next); h.coordinator.setIdleMotion({ enabled: true })
  assert.equal(gates.length, 2)
  gates[0].resolve(h.module)
  await tick()
  assert.equal(h.idles.length, 0)
  gates[1].resolve(h.module)
  await tick()
  assert.equal(h.idles.length, 1)
  assert.notEqual(h.idles[0].scene, old)
  assert.equal(h.idles[0].scene, h.coordinator.get())
  h.coordinator.destroy()
})

test('skip during entry leaves no late idle owner and resumes only after the presenter unpauses', async () => {
  const h = harness(), controller = new AbortController(), current = view()
  h.coordinator.setIdleMotion({ enabled: true, paused: true })
  const opening = h.coordinator.ensure(current, { entryActorIds: ['source', 'target'], signal: controller.signal })
  await tick()
  controller.abort()
  await opening; await tick()
  assert.equal(h.loads.length, 0)
  h.coordinator.setIdleMotion({ paused: false })
  await tick()
  assert.equal(h.idles.length, 1)
  assert.deepEqual(h.idles[0].ids, ['source', 'target'])
  h.coordinator.destroy()
})
