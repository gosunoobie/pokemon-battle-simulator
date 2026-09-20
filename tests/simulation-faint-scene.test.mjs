import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationScene } from '../apps/simulation/src/scene.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const point = (x, y) => ({ x, y, copyFrom(value) { this.x = value.x; this.y = value.y } })
function actor(id) {
  return { id, root: { visible: true }, pose: { position: point(0, 0), scale: point(1, 1), rotation: 0, alpha: 1, tint: 0xffffff },
    resetPose() { this.pose.position.copyFrom({ x: 0, y: 0 }); this.pose.scale.copyFrom({ x: 1, y: 1 }); this.pose.rotation = 0; this.pose.alpha = 1; this.pose.tint = 0xffffff },
  }
}
function view() {
  return { matchId: 'faint-scene', own: { active: 'p1:1', team: [
    { memberId: 'p1:1', species: 'Charizard', fainted: false, hp: { current: 100, max: 100 } },
    { memberId: 'p1:2', species: 'Blastoise', fainted: false, hp: { current: 100, max: 100 } },
  ] }, opponent: { active: 'p2:1', known: [
    { memberId: 'p2:1', species: 'Venusaur', fainted: false, hp: { current: 100, max: 100 } },
  ] } }
}
function fainted(before, id = 'source', clearActive = false) {
  const after = structuredClone(before)
  const side = id === 'source' ? after.own : after.opponent
  const member = (side.team ?? side.known).find(candidate => candidate.memberId === side.active)
  member.fainted = true; member.hp.current = 0
  if (clearActive) side.active = null
  return after
}
function harness(options = {}) {
  const scenes = [], plays = []
  const module = { playPokemonFaint(request) {
    const done = deferred(), playback = { ...request, done, cancelled: 0 }
    plays.push(playback)
    request.actorIds.forEach(id => { request.scene.actor(id).pose.alpha = .5 })
    return { finished: done.promise, cancel() { playback.cancelled++; /* Simulate a misbehaving optional clip that never resolves. */ } }
  } }
  const coordinator = createSimulationScene({
    getHost: () => ({ appendChild() {} }), createHost: () => ({ remove() {} }),
    loadScene: async () => ({
      previewSceneActors: (...profiles) => profiles.map((profile, index) => ({ id: index ? 'target' : 'source', profile })),
      async createScene(host, { actors }) {
        const scene = { actors: actors.map(spec => actor(spec.id)), disposed: 0,
          actor(id) { return this.actors.find(candidate => candidate.id === id) }, dispose() { scene.disposed++ },
        }
        scenes.push(scene); return scene
      },
    }), loadFaint: options.loadFaint ?? (async () => module),
  })
  return { coordinator, scenes, plays, module }
}

test('zero HP can retain the outgoing root through a finishing attack and faint, then hide it without rebuilding', async () => {
  for (const id of ['source', 'target']) for (const reducedMotion of [false, true]) {
    const h = harness(), before = view(), after = fainted(before, id), saved = structuredClone(after)
    await h.coordinator.ensure(before)
    const scene = h.coordinator.get(), subject = scene.actor(id), other = scene.actor(id === 'source' ? 'target' : 'source')
    other.pose.alpha = .8; other.pose.position.y = -3
    h.coordinator.display(after, { retainFaintedActorIds: [id] })
    assert.equal(subject.root.visible, true, 'committed zero HP does not disappear at move impact')
    let settled = false
    const result = h.coordinator.faint(after, { actorIds: [id], reducedMotion }).then(value => { settled = true; return value })
    await tick()
    assert.equal(settled, false)
    assert.deepEqual(h.plays[0].actorIds, [id])
    assert.equal(h.plays[0].reducedMotion, reducedMotion)
    assert.equal(subject.root.visible, true, 'root remains visible for live-sprite and reduced-motion fades')
    assert.equal(subject.pose.alpha, .5)
    h.plays[0].done.resolve({ status: 'completed' })
    assert.deepEqual(await result, { status: 'completed' })
    assert.equal(subject.root.visible, false)
    assert.equal(subject.pose.alpha, 1)
    assert.equal(other.root.visible, true)
    assert.equal(other.pose.alpha, .8)
    assert.equal(other.pose.position.y, -3)
    assert.equal(h.scenes.length, 1)
    assert.deepEqual(after, saved)
    assert.deepEqual(await h.coordinator.faint(after, { actorIds: [id] }), { status: 'skipped' })
    h.coordinator.display(after, { retainFaintedActorIds: [id] })
    assert.equal(subject.root.visible, false, 'duplicate faint snapshots cannot revive outgoing artwork')
    h.coordinator.destroy()
  }
})

test('direct faint events with no active member retain the preceding rendered member identity', async () => {
  for (const damageFirst of [true, false]) {
    const h = harness(), before = view(), damage = fainted(before), after = fainted(before, 'source', true)
    await h.coordinator.ensure(before)
    if (damageFirst) h.coordinator.display(damage, { retainFaintedActorIds: ['source'] })
    h.coordinator.display(after, { retainFaintedActorIds: ['source'] })
    assert.equal(h.coordinator.get().actor('source').root.visible, true)
    const result = h.coordinator.faint(after, { actorIds: ['source'] })
    await tick()
    h.plays[0].done.resolve({ status: 'completed' })
    await result
    assert.equal(h.coordinator.get().actor('source').root.visible, false)
    assert.equal(h.scenes.length, 1)
    h.coordinator.destroy()
  }
})

test('synchronous faint start cues carry the retained member even after active clears, once and only while current', async () => {
  for (const id of ['source', 'target']) for (const clearActive of [false, true]) {
    const cues = [], done = deferred(); let retainedCue
    const h = harness({ loadFaint: async () => ({ playPokemonFaint(request) {
      retainedCue = request.onCue
      assert.equal(request.scene.actor(id).root.visible, true)
      retainedCue({ type: 'reveal', actorId: id }); retainedCue({ type: 'faint', actorId: 'missing' })
      retainedCue({ type: 'faint', actorId: id }); retainedCue({ type: 'faint', actorId: id })
      return { finished: done.promise, cancel() {} }
    } }) }), before = view(), after = fainted(before, id, clearActive)
    try {
      await h.coordinator.ensure(before)
      h.coordinator.display(after, { retainFaintedActorIds: [id] })
      const result = h.coordinator.faint(after, { actorIds: [id], onFaintStart: (...cue) => cues.push(cue) })
      await tick()
      assert.deepEqual(cues, [[id, id === 'source' ? 'p1:1' : 'p2:1']])
      h.coordinator.display(after)
      assert.equal((await result).status, 'cancelled')
      retainedCue({ type: 'faint', actorId: id }); done.resolve({ status: 'completed' }); await tick()
      assert.equal(cues.length, 1)
    } finally { h.coordinator.destroy() }
  }
})

test('retention never reveals a different member, form, match, missing member or already hidden actor', async () => {
  const changes = [
    after => { after.own.active = 'p1:2' },
    after => { after.own.team[0].species = 'Blastoise' },
    after => { after.matchId = 'another-match' },
    after => { after.own.active = null; after.own.team.shift() },
  ]
  for (const change of changes) {
    const h = harness(), before = view(), after = fainted(before)
    await h.coordinator.ensure(before); change(after)
    h.coordinator.display(after, { retainFaintedActorIds: ['source'] })
    assert.equal(h.coordinator.get().actor('source').root.visible, false)
    assert.deepEqual(await h.coordinator.faint(after, { actorIds: ['source'] }), { status: 'skipped' })
    assert.equal(h.plays.length, 0)
    h.coordinator.destroy()
  }
  const h = harness(), before = view(), after = fainted(before)
  await h.coordinator.ensure(before)
  h.coordinator.get().actor('source').root.visible = false
  h.coordinator.display(after, { retainFaintedActorIds: ['source'] })
  assert.equal(h.coordinator.get().actor('source').root.visible, false)
  assert.deepEqual(await h.coordinator.faint(after, { actorIds: ['source'] }), { status: 'skipped' })
  h.coordinator.destroy()
})

test('abort immediately settles a hanging faint, restores poses and hides the committed fainted root', async () => {
  for (const alreadyAborted of [false, true]) {
    const h = harness(), before = view(), after = fainted(before), controller = new AbortController()
    await h.coordinator.ensure(before)
    h.coordinator.display(after, { retainFaintedActorIds: ['source'] })
    if (alreadyAborted) controller.abort()
    const result = h.coordinator.faint(after, { actorIds: ['source'], signal: controller.signal })
    await tick()
    controller.abort()
    assert.deepEqual(await result, { status: 'cancelled' })
    assert.equal(h.coordinator.get().actor('source').root.visible, false)
    assert.equal(h.coordinator.get().actor('source').pose.alpha, 1)
    assert.equal(h.plays.length, alreadyAborted ? 0 : 1)
    if (!alreadyAborted) {
      assert.equal(h.plays[0].cancelled, 1)
      assert.equal(h.plays[0].signal.aborted, true)
    }
    h.coordinator.destroy()
  }
})

test('load/playback failures and skipped clips still hide fainted sprites and settle', async () => {
  for (const cause of ['load', 'play', 'finished', 'skip']) {
    const h = harness({ loadFaint: async () => {
      if (cause === 'load') throw new Error('Missing optional transition')
      return { playPokemonFaint() {
        if (cause === 'play') throw new Error('Unsupported renderer')
        return { finished: cause === 'finished' ? Promise.reject(new Error('Playback failure')) : Promise.resolve({ status: 'skipped' }) }
      } }
    } }), before = view(), after = fainted(before)
    await h.coordinator.ensure(before)
    h.coordinator.display(after, { retainFaintedActorIds: ['source'] })
    assert.deepEqual(await h.coordinator.faint(after, { actorIds: ['source'] }), { status: cause === 'skip' ? 'skipped' : 'failed' })
    assert.equal(h.coordinator.get().actor('source').root.visible, false)
    assert.equal(h.coordinator.get().actor('target').root.visible, true)
    h.coordinator.destroy()
  }
})

test('plain display reconciliation cancels faint playback and cannot replay it on reconnect', async () => {
  const h = harness(), before = view(), after = fainted(before)
  await h.coordinator.ensure(before)
  h.coordinator.display(after, { retainFaintedActorIds: ['source'] })
  const result = h.coordinator.faint(after, { actorIds: ['source'] })
  await tick()
  h.coordinator.display(after)
  assert.deepEqual(await result, { status: 'cancelled' })
  assert.equal(h.plays[0].cancelled, 1)
  await h.coordinator.ensure(after)
  assert.equal(h.coordinator.get().actor('source').root.visible, false)
  assert.equal(h.plays.length, 1)
  h.coordinator.destroy()
})

test('aborting a delayed import prevents late playback, and old completion cannot alter a replacement scene', async () => {
  for (const delayedImport of [true, false]) {
    const gate = deferred(), h = harness(delayedImport ? { loadFaint: () => gate.promise } : {})
    const before = view(), after = fainted(before), replacement = structuredClone(after)
    replacement.own.active = 'p1:2'
    await h.coordinator.ensure(before)
    h.coordinator.display(after, { retainFaintedActorIds: ['source'] })
    const result = h.coordinator.faint(after, { actorIds: ['source'] })
    await tick()
    const oldScene = h.coordinator.get()
    await h.coordinator.ensure(replacement)
    assert.deepEqual(await result, { status: 'cancelled' })
    const nextScene = h.coordinator.get()
    assert.notEqual(oldScene, nextScene)
    assert.equal(nextScene.actor('source').root.visible, true)
    nextScene.actor('source').pose.alpha = .9
    if (delayedImport) gate.resolve(h.module)
    else h.plays[0].done.resolve({ status: 'completed' })
    await tick()
    assert.equal(h.coordinator.get(), nextScene)
    assert.equal(nextScene.actor('source').root.visible, true)
    assert.equal(nextScene.actor('source').pose.alpha, .9)
    assert.equal(h.plays.length, delayedImport ? 0 : 1)
    h.coordinator.destroy()
  }
})

test('clear and destroy settle faint waits even when the optional import never finishes', async () => {
  for (const action of ['clear', 'destroy']) {
    const gate = deferred(), h = harness({ loadFaint: () => gate.promise }), before = view(), after = fainted(before)
    await h.coordinator.ensure(before)
    h.coordinator.display(after, { retainFaintedActorIds: ['source'] })
    const result = h.coordinator.faint(after, { actorIds: ['source'] })
    await tick()
    h.coordinator[action]()
    assert.deepEqual(await result, { status: 'cancelled' })
    assert.equal(h.coordinator.get(), null)
    gate.resolve(h.module); await tick()
    assert.equal(h.plays.length, 0)
  }
})
