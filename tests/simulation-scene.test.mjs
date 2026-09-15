import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationScene } from '../apps/simulation/src/scene.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const clone = value => structuredClone(value)
function view() {
  return { matchId: 'match-one', own: { active: 'p1:1', team: [
    { memberId: 'p1:1', species: 'Charizard', fainted: false },
    { memberId: 'p1:2', species: 'Charizard', fainted: false },
  ] }, opponent: { active: 'p2:1', known: [{ memberId: 'p2:1', species: 'Venusaur', fainted: false }] } }
}
const point = (x, y) => ({ x, y, copyFrom(value) { this.x = value.x; this.y = value.y } })
function actor(id) {
  return { id, root: { visible: true }, pose: { position: point(0, 0), scale: point(1, 1), rotation: 0, alpha: 1, tint: 0xffffff },
    resetPose() { this.pose.position.copyFrom({ x: 0, y: 0 }); this.pose.scale.copyFrom({ x: 1, y: 1 }); this.pose.rotation = 0; this.pose.alpha = 1; this.pose.tint = 0xffffff },
  }
}
function harness(options = {}) {
  const scenes = [], releases = [], availability = [], attached = [], detached = []
  const host = { appendChild(staging) {
    const scene = scenes.find(value => value.host === staging)
    attached.push({ scene, visible: scene.actors.map(value => value.root.visible) })
  } }
  const callbacks = {
    getHost: () => host, onAvailability: value => availability.push(value),
    createHost: () => { const staging = { remove() { detached.push(staging) } }; return staging },
    loadScene: async () => ({ previewSceneActors: (...profiles) => profiles.map((profile, index) => ({ id: index ? 'target' : 'source', profile })),
      async createScene(staging, { actors }) {
        const result = { host: staging, specs: actors, actors: actors.map(value => actor(value.id)), disposed: 0,
          actor(id) { return this.actors.find(value => value.id === id) }, dispose() { result.disposed++ },
        }
        scenes.push(result)
        if (options.sceneGate) await options.sceneGate.promise
        return result
      },
    }),
    loadRelease: async () => ({ playPokeballRelease(request) {
      const done = deferred()
      const result = { ...request, done, cancelled: 0, initialVisibility: request.actorIds.map(id => request.scene.actor(id).root.visible) }
      releases.push(result)
      for (const id of request.actorIds) {
        request.scene.actor(id).pose.scale.copyFrom({ x: .2, y: .2 })
        request.scene.actor(id).pose.alpha = 0
      }
      if (!options.holdRelease) done.resolve({ status: 'completed' })
      return { finished: done.promise, cancel() { result.cancelled++; if (!options.hangingCancel) done.resolve({ status: 'cancelled' }) } }
    } }),
    ...options.callbacks,
  }
  return { coordinator: createSimulationScene(callbacks), callbacks, scenes, releases, availability, attached, detached }
}

test('opening waits for both releases and never attaches fully visible incoming sprites', async () => {
  const releaseGate = deferred(), h = harness({ holdRelease: true })
  const releaseModule = await h.callbacks.loadRelease()
  h.callbacks.loadRelease = () => releaseGate.promise
  // Build a fresh coordinator with the delayed optional module.
  h.coordinator = createSimulationScene(h.callbacks)
  let finished = false
  const opening = h.coordinator.ensure(view(), { entryActorIds: ['source', 'target'], reducedMotion: true }).then(() => { finished = true })
  await tick()
  assert.deepEqual(h.attached[0].visible, [false, false])
  assert.equal(h.availability.at(-1), true)
  assert.equal(finished, false)
  releaseGate.resolve(releaseModule)
  await tick()
  assert.deepEqual(h.releases[0].actorIds, ['source', 'target'])
  assert.deepEqual(h.releases[0].initialVisibility, [false, false])
  assert.deepEqual(h.coordinator.get().actors.map(value => [value.root.visible, value.pose.alpha]), [[true, 0], [true, 0]])
  h.coordinator.display(view())
  assert.deepEqual(h.coordinator.get().actors.map(value => [value.root.visible, value.pose.alpha]), [[true, 0], [true, 0]])
  assert.equal(h.releases[0].reducedMotion, true)
  assert.equal(finished, false)
  h.releases[0].done.resolve({ status: 'completed' })
  await opening
  assert.deepEqual(h.coordinator.get().actors.map(value => [value.root.visible, value.pose.scale.x]), [[true, 1], [true, 1]])
  h.coordinator.destroy()
})

test('same-species teammate switch releases only the incoming stable field ID and retains the opponent pose', async () => {
  const h = harness(), before = view(), after = clone(before)
  await h.coordinator.ensure(before)
  const old = h.coordinator.get(), opponent = old.actor('target')
  opponent.pose.position.copyFrom({ x: 3, y: -4 }); opponent.pose.rotation = .1; opponent.pose.alpha = .8
  after.own.active = 'p1:2'
  h.coordinator.display(after)
  assert.equal(old.actor('source').root.visible, false)
  assert.equal(opponent.root.visible, true)
  await h.coordinator.ensure(after, { entryActorIds: ['source', 'target'] })
  assert.deepEqual(h.releases[0].actorIds, ['source'])
  assert.deepEqual(h.attached[1].visible, [false, true])
  assert.equal(h.coordinator.get().actor('target').pose.position.x, 3)
  assert.equal(h.coordinator.get().actor('target').pose.rotation, .1)
  assert.equal(h.coordinator.get().actor('target').pose.alpha, .8)
  assert.equal(old.disposed, 1)
  h.coordinator.destroy()
})

test('HP updates, duplicate ensures, syncs and form changes never replay entry', async () => {
  const h = harness(), initial = view()
  await h.coordinator.ensure(initial, { entryActorIds: ['source', 'target'] })
  const updated = clone(initial)
  updated.own.team[0].hp = { current: 100, max: 200 }
  h.coordinator.display(updated)
  await h.coordinator.ensure(updated, { entryActorIds: ['source', 'target'] })
  await h.coordinator.ensure(updated)
  assert.equal(h.scenes.length, 1)
  const changed = clone(updated)
  changed.own.team[0].species = 'Blastoise'
  h.coordinator.display(changed)
  assert.equal(h.coordinator.get().actor('source').root.visible, false)
  await h.coordinator.ensure(changed, { entryActorIds: ['source'] })
  assert.equal(h.scenes.length, 2)
  assert.equal(h.releases.length, 1)
  assert.equal(h.coordinator.get().actor('source').root.visible, true)
  h.coordinator.destroy()
})

test('match identity prevents two matches with identical teams sharing the old canvas', async () => {
  const h = harness(), first = view(), second = clone(first)
  second.matchId = 'match-two'
  await h.coordinator.ensure(first)
  await h.coordinator.ensure(second, { entryActorIds: ['source', 'target'] })
  assert.equal(h.scenes.length, 2)
  assert.equal(h.scenes[0].disposed, 1)
  assert.deepEqual(h.releases[0].actorIds, ['source', 'target'])
  h.coordinator.destroy()
})

test('display updates during release do not reveal the incoming sprite before its clip does', async () => {
  const gate = deferred(), h = harness({ callbacks: { loadRelease: () => gate.promise } })
  const opening = h.coordinator.ensure(view(), { entryActorIds: ['source', 'target'] })
  await tick()
  h.coordinator.display(view())
  assert.deepEqual(h.coordinator.get().actors.map(value => value.root.visible), [false, false])
  gate.reject(new Error('Optional module unavailable'))
  await opening
  assert.deepEqual(h.coordinator.get().actors.map(value => value.root.visible), [true, true])
  assert.equal(h.availability.at(-1), true)
  h.coordinator.destroy()
})

test('skip cancels a running release once and restores final actors even when its finished promise hangs', async () => {
  const h = harness({ holdRelease: true, hangingCancel: true }), controller = new AbortController()
  const opening = h.coordinator.ensure(view(), { entryActorIds: ['source', 'target'], signal: controller.signal })
  await tick()
  controller.abort()
  await opening
  await h.coordinator.ensure(view())
  assert.equal(h.releases[0].cancelled, 1)
  assert.equal(h.releases[0].signal.aborted, true)
  assert.deepEqual(h.coordinator.get().actors.map(value => [value.root.visible, value.pose.scale.x]), [[true, 1], [true, 1]])
  h.coordinator.destroy()
})

test('skip during delayed release import restores sprites and never starts a late clip', async () => {
  const gate = deferred(), h = harness(), controller = new AbortController()
  const module = await h.callbacks.loadRelease()
  h.callbacks.loadRelease = () => gate.promise
  h.coordinator = createSimulationScene(h.callbacks)
  const opening = h.coordinator.ensure(view(), { entryActorIds: ['source', 'target'], signal: controller.signal })
  await tick()
  controller.abort()
  await opening
  assert.deepEqual(h.coordinator.get().actors.map(value => value.root.visible), [true, true])
  gate.resolve(module)
  await tick()
  assert.equal(h.releases.length, 0)
  h.coordinator.destroy()
})

test('an already-aborted signal never starts a release and still permits final renderer reconciliation', async () => {
  const gate = deferred(), h = harness({ sceneGate: gate }), controller = new AbortController()
  controller.abort()
  await h.coordinator.ensure(view(), { entryActorIds: ['source', 'target'], signal: controller.signal })
  assert.equal(h.availability.at(-1), false)
  gate.resolve()
  await h.coordinator.ensure(view())
  await tick()
  assert.equal(h.releases.length, 0)
  assert.deepEqual(h.attached[0].visible, [true, true])
  h.coordinator.destroy()
})

test('abort while rendering releases the caller, exposes fallback, and completes without animation when textures arrive', async () => {
  const gate = deferred(), h = harness({ sceneGate: gate }), controller = new AbortController()
  const opening = h.coordinator.ensure(view(), { entryActorIds: ['source', 'target'], signal: controller.signal })
  await tick()
  controller.abort()
  await opening
  assert.equal(h.availability.at(-1), false)
  assert.equal(h.coordinator.get(), null)
  // Final reconciliation after skip must not wait for the same slow textures.
  await h.coordinator.ensure(view())
  assert.equal(h.coordinator.get(), null)
  gate.resolve()
  await h.coordinator.ensure(view())
  await tick()
  assert.equal(h.releases.length, 0)
  assert.deepEqual(h.attached[0].visible, [true, true])
  h.coordinator.destroy()
})

test('same-key concurrent ensures share renderer loading and one release', async () => {
  const gate = deferred(), h = harness({ sceneGate: gate })
  const first = h.coordinator.ensure(view(), { entryActorIds: ['source', 'target'] })
  const duplicate = h.coordinator.ensure(view(), { entryActorIds: ['source', 'target'] })
  gate.resolve()
  await Promise.all([first, duplicate])
  assert.equal(h.scenes.length, 1)
  assert.equal(h.releases.length, 1)
  h.coordinator.destroy()
})

test('a one-side switch keeps the old opponent visible while new textures load', async () => {
  const controls = {}, h = harness(controls), initial = view(), next = clone(initial)
  await h.coordinator.ensure(initial)
  controls.sceneGate = deferred(); next.own.active = 'p1:2'
  const old = h.coordinator.get()
  const switching = h.coordinator.ensure(next, { entryActorIds: ['source'] })
  await tick()
  assert.equal(h.coordinator.get(), old)
  assert.equal(old.actor('target').root.visible, true)
  assert.equal(old.actor('source').root.visible, false)
  assert.equal(old.disposed, 0)
  controls.sceneGate.resolve()
  await switching
  assert.equal(old.disposed, 1)
  h.coordinator.destroy()
})

test('clear/destroy release waiting calls, cancel playback and prevent delayed canvases mounting', async () => {
  for (const action of ['clear', 'destroy']) {
    const gate = deferred(), h = harness({ sceneGate: gate })
    const loading = h.coordinator.ensure(view(), { entryActorIds: ['source', 'target'] })
    await tick()
    h.coordinator[action]()
    await loading
    gate.resolve()
    await tick()
    assert.equal(h.attached.length, 0)
    assert.equal(h.scenes[0].disposed, 1)
    assert.equal(h.detached.length, 1)
    assert.equal(h.coordinator.get(), null)
    assert.equal(h.availability.at(-1), null)
  }
  const h = harness({ holdRelease: true, hangingCancel: true })
  const opening = h.coordinator.ensure(view(), { entryActorIds: ['source', 'target'] })
  await tick()
  h.coordinator.clear()
  await opening
  assert.equal(h.releases[0].cancelled, 1)
  assert.equal(h.scenes[0].disposed, 1)
  assert.equal(h.coordinator.get(), null)
})

test('a newer scene supersedes delayed work and disposes late renderers without attaching', async () => {
  const gate = deferred(), h = harness({ sceneGate: gate }), first = view(), second = clone(first)
  second.own.active = 'p1:2'
  const stale = h.coordinator.ensure(first, { entryActorIds: ['source', 'target'] })
  await tick()
  const current = h.coordinator.ensure(second, { entryActorIds: ['source', 'target'] })
  await stale
  gate.resolve()
  await current
  assert.equal(h.scenes.length, 2)
  assert.equal(h.scenes[0].disposed, 1)
  assert.equal(h.attached.length, 1)
  assert.equal(h.attached[0].scene, h.scenes[1])
  h.coordinator.destroy()
})

test('resetting to the mounted view cancels an in-flight replacement instead of mounting it later', async () => {
  const controls = {}, h = harness(controls), initial = view(), replacement = clone(initial)
  await h.coordinator.ensure(initial)
  const original = h.coordinator.get()
  controls.sceneGate = deferred(); replacement.own.active = 'p1:2'
  const stale = h.coordinator.ensure(replacement, { entryActorIds: ['source'] })
  await tick()
  await h.coordinator.ensure(initial)
  await stale
  controls.sceneGate.resolve()
  await tick()
  assert.equal(h.coordinator.get(), original)
  assert.equal(original.actor('source').root.visible, true)
  assert.equal(h.scenes[1].disposed, 1)
  assert.equal(h.attached.length, 1)
  h.coordinator.destroy()
})

test('renderer failure leaves fallback available and a later ensure retries', async () => {
  const h = harness()
  const original = h.callbacks.loadScene
  let fails = true
  h.callbacks.loadScene = () => { if (fails) throw new Error('WebGL unavailable'); return original() }
  h.coordinator = createSimulationScene(h.callbacks)
  await h.coordinator.ensure(view(), { entryActorIds: ['source', 'target'] })
  assert.equal(h.availability.at(-1), false)
  assert.equal(h.coordinator.get(), null)
  fails = false
  await h.coordinator.ensure(view())
  assert.equal(h.availability.at(-1), true)
  assert.equal(h.releases.length, 0)
  h.coordinator.destroy()
})
