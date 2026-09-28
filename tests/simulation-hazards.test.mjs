import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationScene } from '../apps/shared/battle/scene.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const point = (x, y) => ({ x, y, copyFrom(value) { this.x = value.x; this.y = value.y } })
function view(seat = 'p1') {
  const other = seat === 'p1' ? 'p2' : 'p1'
  const member = (id, species) => ({ memberId: id, species, fainted: false, hp: { current: 100, max: 100 } })
  return { seat, matchId: 'hazard-scene', own: { active: `${seat}:1`, team: [member(`${seat}:1`, 'Charizard'), member(`${seat}:2`, 'Blastoise')] },
    opponent: { active: `${other}:1`, known: [member(`${other}:1`, 'Venusaur')] },
    sideConditions: { p1: ['Spikes'], p2: ['Spikes'] }, sideConditionLayers: { p1: { Spikes: 2 }, p2: { Spikes: 3 } } }
}
function harness(options = {}) {
  const displays = [], scenes = [], loads = []
  const module = { createHazardDisplay({ scene }) {
    const display = { scene, updates: [], destroyed: 0, update(rows) { this.updates.push(structuredClone(rows)) }, destroy() { this.destroyed++ } }
    displays.push(display); return display
  } }
  const coordinator = createSimulationScene({
    getHost: () => ({ appendChild() {} }), createHost: () => ({ remove() {} }),
    loadConditions() { const gate = options.gate; loads.push(gate); return gate?.promise ?? Promise.resolve(module) },
    loadScene: async () => ({ previewSceneActors: (...profiles) => profiles.map((profile, index) => ({ id: index ? 'target' : 'source', profile, x: index ? .75 : .25, y: index ? .6 : .77 })),
      async createScene() {
        const actors = ['source', 'target'].map(id => ({ id, root: { visible: true },
          pose: { position: point(0, 0), scale: point(1, 1), rotation: 0, alpha: 1, tint: 0xffffff }, resetPose() {} }))
        const scene = { actors, width: 1000, height: 450, unit: 1, disposed: false,
          actor(id) { return actors.find(actor => actor.id === id) }, dispose() { scene.disposed = true } }
        scenes.push(scene); return scene
      } }),
  })
  return { coordinator, scenes, displays, loads, module }
}

test('public layer updates route to fixed viewer slots, persist on reconnect and clear on removal', async () => {
  for (const seat of ['p1', 'p2']) {
    const h = harness(), current = view(seat)
    await h.coordinator.ensure(current); await tick()
    assert.equal(h.displays.length, 1)
    assert.deepEqual(h.displays[0].updates.at(-1), [
      { side: seat === 'p1' ? 'near' : 'far', layers: 2 }, { side: seat === 'p2' ? 'near' : 'far', layers: 3 }])
    assert.deepEqual(h.scenes[0].hazardSlots.near, { x: 250, y: 369, rx: 173, ry: 38 })
    h.coordinator.display(structuredClone(current)); await h.coordinator.ensure(current)
    assert.equal(h.loads.length, 1); assert.equal(h.displays.length, 1)
    const clean = structuredClone(current); clean.sideConditions = { p1: [], p2: [] }; clean.sideConditionLayers = { p1: {}, p2: {} }
    h.coordinator.display(clean)
    assert.deepEqual(h.displays[0].updates.at(-1), [])
    h.coordinator.destroy(); assert.equal(h.displays[0].destroyed, 1)
  }
})

test('no hazards and effects-off do not load artwork; enabling restores the latest public layers statically', async () => {
  const h = harness(), current = view(), clean = { ...current, sideConditions: { p1: [], p2: [] } }
  await h.coordinator.ensure(clean); await tick(); assert.equal(h.loads.length, 0)
  h.coordinator.setEffectsEnabled(false); h.coordinator.display(current); await tick(); assert.equal(h.loads.length, 0)
  h.coordinator.setEffectsEnabled(true); await tick(); assert.equal(h.displays.length, 1)
  h.coordinator.setEffectsEnabled(false); assert.equal(h.displays[0].destroyed, 1)
  h.coordinator.destroy()
})

test('late hazard imports cannot attach after removal, effects-off, clear, destruction or scene replacement', async () => {
  for (const mode of ['remove', 'effects-off', 'clear', 'destroy', 'replace']) {
    const gate = deferred(), options = { gate }, h = harness(options), current = view()
    await h.coordinator.ensure(current); await tick(); assert.equal(h.loads.length, 1)
    if (mode === 'remove') h.coordinator.display({ ...current, sideConditions: { p1: [], p2: [] } })
    if (mode === 'effects-off') h.coordinator.setEffectsEnabled(false)
    if (mode === 'clear') h.coordinator.clear()
    if (mode === 'destroy') h.coordinator.destroy()
    if (mode === 'replace') {
      options.gate = null
      const next = structuredClone(current); next.own.active = 'p1:2'
      await h.coordinator.ensure(next); await tick()
      assert.equal(h.displays.length, 1); assert.equal(h.displays[0].scene, h.scenes[1])
    }
    gate.resolve(h.module); await tick()
    assert.equal(h.displays.length, mode === 'replace' ? 1 : 0)
    h.coordinator.destroy()
  }
})

test('switch replacement disposes old hazard artwork and restores the same field counts on the new renderer', async () => {
  const h = harness(), current = view()
  await h.coordinator.ensure(current); await tick()
  const next = structuredClone(current); next.own.active = 'p1:2'
  await h.coordinator.ensure(next); await tick()
  assert.equal(h.displays[0].destroyed, 1); assert.equal(h.scenes[0].disposed, true)
  assert.equal(h.displays.length, 2)
  assert.deepEqual(h.displays[1].updates.at(-1), h.displays[0].updates.at(-1))
  h.coordinator.destroy()
})
