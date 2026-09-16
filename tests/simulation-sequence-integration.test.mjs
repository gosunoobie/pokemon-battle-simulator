import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationPresenter } from '../apps/simulation/src/presentation.js'
import { createSimulationScene } from '../apps/simulation/src/scene.js'
import { createBattleSequence, OVERLAY_TIMINGS } from '../apps/simulation/src/sequence.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const point = (x, y) => ({ x, y, copyFrom(value) { this.x = value.x; this.y = value.y } })
const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
function fixture(matchId = 'sequence-battle') {
  const member = (memberId, species, max) => ({ memberId, species, name: species, active: true,
    hp: { current: max, max }, fainted: false, stages: {}, volatiles: [], moves: [] })
  const before = { matchId, seat: 'p1', complete: true, cursor: 1, turn: 1, result: null,
    own: { active: 'p1:1', team: [member('p1:1', 'Charizard', 300)] },
    opponent: { active: 'p2:1', known: [member('p2:1', 'Venusaur', 48)] },
    sideConditions: { p1: [], p2: [] }, fieldConditions: [],
  }
  const after = structuredClone(before)
  Object.assign(after.opponent.known[0], { hp: { current: 0, max: 48 }, fainted: true, active: false })
  after.opponent.active = null
  after.cursor = 5
  after.result = { kind: 'win', winnerSeat: 'p1', reason: 'battle' }
  return { before, after, events: [event(2, 'move', 'p1:1', 'Flamethrower', 'p2:1'),
    event(3, '-damage', 'p2:1', '0 fnt'), event(4, 'faint', 'p2:1'),
    { cursor: 5, type: 'result', args: { ...after.result } }],
  }
}

function harness() {
  const displayed = [], overlays = [], attacks = [], faints = [], entries = [], scenes = [], ensures = []
  const pendingTimers = new Map()
  let timerId = 0
  const timers = {
    setTimeout(callback, ms) { const id = ++timerId; pendingTimers.set(id, { callback, ms }); return id },
    clearTimeout(id) { pendingTimers.delete(id) },
  }
  function actor(id) {
    return { id, root: { visible: true },
      pose: { position: point(0, 0), scale: point(1, 1), alpha: 1, rotation: 0, tint: 0xffffff },
      resetPose() { this.pose.position.copyFrom({ x: 0, y: 0 }); this.pose.scale.copyFrom({ x: 1, y: 1 }); this.pose.alpha = 1; this.pose.rotation = 0; this.pose.tint = 0xffffff },
    }
  }
  const coordinator = createSimulationScene({
    getHost: () => ({ appendChild() {} }), createHost: () => ({ remove() {} }),
    loadScene: async () => ({
      previewSceneActors: (...profiles) => profiles.map((profile, index) => ({ id: index ? 'target' : 'source', profile })),
      async createScene(host, { actors }) {
        const members = new Map(actors.map(spec => [spec.id, actor(spec.id)]))
        const scene = { actor: id => members.get(id), disposed: 0, dispose() { scene.disposed++ } }
        scenes.push(scene)
        return scene
      },
    }),
    loadRelease: async () => ({ playPokeballRelease(options) {
      entries.push(options)
      return { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
    } }),
    loadFaint: async () => ({ playPokemonFaint(options) {
      const done = deferred()
      const clip = { options, done, cancelled: 0 }
      faints.push(clip)
      for (const id of options.actorIds) options.scene.actor(id).pose.alpha = .5
      return { finished: done.promise, cancel() { clip.cancelled++ } }
    } }),
  })
  const presenter = createSimulationPresenter({
    getScene: coordinator.get,
    ensureScene: (view, options) => { ensures.push({ view, options }); return coordinator.ensure(view, options) },
    faintScene: coordinator.faint,
    onDisplay(view, options) { displayed.push(structuredClone(view)); coordinator.display(view, options) },
    loadFx: async () => ({ play(request, options) {
      const done = deferred()
      const clip = { request, options, done, cancelled: 0 }
      attacks.push(clip)
      options.onCue({ type: 'impact' })
      return { finished: done.promise, cancel() { clip.cancelled++ } }
    } }),
  })
  const sequence = createBattleSequence({ presenter, timers, onOverlay: value => overlays.push(value) })
  return { coordinator, sequence, displayed, overlays, attacks, faints, entries, scenes, ensures, pendingTimers,
    get overlay() { return overlays.at(-1) },
    finishOverlay(expectedMs) {
      assert.equal(pendingTimers.size, 1)
      const [id, timer] = pendingTimers.entries().next().value
      assert.equal(timer.ms, expectedMs)
      pendingTimers.delete(id)
      timer.callback()
    },
    dispose() { sequence.destroy(); coordinator.destroy() },
  }
}

test('sequence victory waits for actual presenter impact, attack recovery and deferred final faint', async () => {
  const h = harness(), batch = fixture(), saved = structuredClone(batch)
  try {
    await h.coordinator.ensure(batch.before)
    const defeated = h.coordinator.get().actor('target')
    let settled = false
    const pending = h.sequence.present(batch).then(result => { settled = true; return result })
    await tick()
    assert.equal(h.attacks.length, 1)
    assert.equal(h.displayed.at(-1).opponent.known[0].hp.current, 0)
    assert.equal(defeated.root.visible, true, 'impact retains the defeated sprite during attack recovery')
    assert.equal(h.faints.length, 0)
    assert.equal(h.overlay, null)
    h.attacks[0].done.resolve({ status: 'completed' })
    await tick()
    assert.equal(h.faints.length, 1)
    assert.equal(h.faints[0].options.actorIds[0], 'target')
    assert.equal(defeated.root.visible, true)
    assert.equal(settled, false)
    assert.equal(h.overlay, null, 'the victory screen must not cover the final faint')
    assert.equal(h.pendingTimers.size, 0)
    h.faints[0].done.resolve({ status: 'completed' })
    await tick()
    assert.equal(defeated.root.visible, false)
    assert.equal(h.coordinator.get().actor('target').root.visible, false)
    assert.deepEqual(h.displayed.at(-1), batch.after)
    assert.equal(h.overlay.kind, 'victory')
    assert.equal(h.overlay.animated, true)
    assert.equal(settled, false, 'the sequence stays locked through result presentation')
    h.finishOverlay(OVERLAY_TIMINGS.result)
    assert.equal((await pending).status, 'completed')
    assert.equal(h.overlay.animated, false)
    assert.equal(h.pendingTimers.size, 0)
    assert.deepEqual(batch, saved, 'all intermediate displays remain cosmetic')
  } finally { h.dispose() }
})

test('sequence forfeit shows defeat without creating a fake attack or faint', async () => {
  const h = harness(), { before } = fixture()
  const after = structuredClone(before)
  after.result = { kind: 'win', winnerSeat: 'p2', reason: 'forfeit' }
  after.cursor = 2
  try {
    await h.coordinator.ensure(before)
    const pending = h.sequence.present({ before, after, events: [{ cursor: 2, type: 'result', args: after.result }] })
    await tick()
    assert.deepEqual(h.displayed.at(-1), after)
    assert.equal(h.overlay.kind, 'defeat')
    assert.equal(h.overlay.detail, 'You forfeited the battle.')
    assert.equal(h.attacks.length, 0)
    assert.equal(h.faints.length, 0)
    assert.equal(h.coordinator.get().actor('source').root.visible, true)
    assert.equal(h.coordinator.get().actor('target').root.visible, true)
    h.finishOverlay(OVERLAY_TIMINGS.result)
    assert.equal((await pending).status, 'completed')
    assert.equal(h.overlay.animated, false)
    assert.deepEqual(after.own.team[0].hp, before.own.team[0].hp)
  } finally { h.dispose() }
})

test('skipping the intro suppresses subsequent opening entries and immediately presents the true lineup', async () => {
  const h = harness(), { before: after } = fixture()
  try {
    const pending = h.sequence.present({ before: null, after, events: [] })
    await tick()
    assert.equal(h.overlay.kind, 'intro')
    assert.equal(h.coordinator.get(), null)
    assert.equal(h.ensures.length, 0, 'send-outs cannot start underneath the intro')
    h.sequence.skip()
    assert.equal((await pending).status, 'skipped')
    assert.equal(h.overlay, null)
    assert.equal(h.pendingTimers.size, 0)
    assert.equal(h.entries.length, 0)
    assert.equal(h.attacks.length, 0)
    assert.deepEqual(h.displayed.at(-1), after)
    assert.equal(h.coordinator.get().actor('source').root.visible, true)
    assert.equal(h.coordinator.get().actor('target').root.visible, true)
  } finally { h.dispose() }
})

test('skipping either the finishing attack or faint reconciles a static victory and cannot revive the defeated actor', async () => {
  for (const phase of ['attack', 'faint']) {
    const h = harness(), batch = fixture(`skip-${phase}`)
    try {
      await h.coordinator.ensure(batch.before)
      const defeated = h.coordinator.get().actor('target')
      const pending = h.sequence.present(batch)
      await tick()
      if (phase === 'faint') {
        h.attacks[0].done.resolve({ status: 'completed' })
        await tick()
        assert.equal(h.faints.length, 1)
      }
      h.sequence.skip()
      assert.equal((await pending).status, 'skipped')
      assert.deepEqual(h.displayed.at(-1), batch.after)
      assert.equal(h.overlay.kind, 'victory')
      assert.equal(h.overlay.animated, false)
      assert.equal(h.pendingTimers.size, 0)
      assert.equal(defeated.root.visible, false)
      assert.equal(h.coordinator.get().actor('target').root.visible, false)
      if (phase === 'attack') assert.equal(h.attacks[0].cancelled, 1)
      else assert.equal(h.faints[0].cancelled, 1)
      const currentScene = h.coordinator.get(), displayCount = h.displayed.length, overlayCount = h.overlays.length
      h.attacks[0].options.onCue({ type: 'impact' })
      h.attacks[0].done.resolve({ status: 'completed' })
      h.faints[0]?.done.resolve({ status: 'completed' })
      await tick()
      assert.equal(h.coordinator.get(), currentScene)
      assert.equal(h.coordinator.get().actor('target').root.visible, false)
      assert.equal(h.displayed.length, displayCount)
      assert.equal(h.overlays.length, overlayCount)
      assert.equal(h.entries.length, 0)
    } finally { h.dispose() }
  }
})

test('a new match reset invalidates late attack and faint callbacks and cannot publish the old result', async () => {
  for (const phase of ['attack', 'faint']) {
    const h = harness(), oldBatch = fixture(`old-${phase}`), { before: replacement } = fixture(`new-${phase}`)
    try {
      await h.coordinator.ensure(oldBatch.before)
      const pending = h.sequence.present(oldBatch)
      await tick()
      if (phase === 'faint') {
        h.attacks[0].done.resolve({ status: 'completed' })
        await tick()
        assert.equal(h.faints.length, 1)
      }
      h.sequence.reset(replacement)
      h.coordinator.clear()
      await h.coordinator.ensure(replacement)
      assert.equal((await pending).status, 'cancelled')
      assert.deepEqual(h.displayed.at(-1), replacement)
      assert.equal(h.overlay, null)
      const currentScene = h.coordinator.get(), displayCount = h.displayed.length
      h.attacks[0].options.onCue({ type: 'impact' })
      h.attacks[0].done.resolve({ status: 'completed' })
      h.faints[0]?.done.resolve({ status: 'completed' })
      await tick()
      assert.equal(h.coordinator.get(), currentScene)
      assert.equal(h.displayed.length, displayCount)
      assert.deepEqual(h.displayed.at(-1), replacement)
      assert.equal(h.overlay, null)
      assert.equal(h.pendingTimers.size, 0)
      assert.equal(currentScene.actor('source').root.visible, true)
      assert.equal(currentScene.actor('target').root.visible, true)
      assert(!h.overlays.some(overlay => overlay?.key === `${oldBatch.after.matchId}:result`))
    } finally { h.dispose() }
  }
})
