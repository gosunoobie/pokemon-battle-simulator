import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'

const clone = value => structuredClone(value)
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
const pokemon = (memberId, species, active = false) => ({ memberId, species, name: species, active,
  hp: { current: 100, max: 100 }, hpPrecision: 'exact', fainted: false, condition: null,
  stages: {}, volatiles: [], moves: [], item: null, ability: null })

function viewFor(seat = 'p1') {
  const ownSeat = seat, opponentSeat = seat === 'p1' ? 'p2' : 'p1'
  return { matchId: 'cry-battle', seat, cursor: 10, turn: 1,
    own: { active: `${ownSeat}:1`, team: [pokemon(`${ownSeat}:1`, 'Charizard', true),
      pokemon(`${ownSeat}:2`, 'Blastoise'), pokemon(`${ownSeat}:3`, 'Sceptile')] },
    opponent: { active: `${opponentSeat}:revealed:1`, known: [pokemon(`${opponentSeat}:revealed:1`, 'Venusaur', true)] },
    weather: null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], result: null,
    decision: { id: 'turn-one', kind: 'move', moves: [] }, complete: true }
}

function select(view, actorId, memberId, species) {
  const side = actorId === 'source' ? view.own : view.opponent
  const list = side.team ?? side.known
  if (!list.some(member => member.memberId === memberId)) list.push(pokemon(memberId, species))
  side.active = memberId
  for (const member of list) member.active = member.memberId === memberId
}

function switchBatch(seat = 'p1', actorId = 'source', opcode = 'switch') {
  const before = viewFor(seat), after = clone(before)
  const switchingSeat = actorId === 'source' ? seat : seat === 'p1' ? 'p2' : 'p1'
  const id = actorId === 'source' ? `${switchingSeat}:2` : `${switchingSeat}:revealed:2`
  select(after, actorId, id, 'Blastoise')
  after.cursor = 11
  return { before, after, events: [event(11, opcode, id, 'Blastoise, L100', '100/100')] }
}

function harness(overrides = {}) {
  const entries = [], cancellations = [], displays = [], sceneRequests = [], moveRequests = []
  const presenter = createSimulationPresenter({
    getScene: () => ({}),
    ensureScene: async (view, options) => {
      sceneRequests.push({ view: clone(view), options })
      for (const actorId of options.entryActorIds) options.onEntryReveal?.(actorId)
    },
    onDisplay: view => displays.push(clone(view)),
    onEntry: (view, actorId) => entries.push({ view: clone(view), actorId }),
    onEntryCancel: () => cancellations.push('cancelled'),
    loadFx: async () => ({ play(request) {
      moveRequests.push(request)
      return { finished: Promise.resolve({ status: 'completed' }) }
    } }),
    ...overrides,
  })
  return { presenter, entries, cancellations, displays, sceneRequests, moveRequests }
}

function entrySpecies({ view, actorId }) {
  const side = actorId === 'source' ? view.own : view.opponent
  return (side.team ?? side.known).find(member => member.memberId === side.active)?.species
}

test('opening cries wait for individual reveal cues and never wait for the cry to finish', async () => {
  const started = deferred(), released = deferred(), after = viewFor(), saved = clone(after)
  let config
  const h = harness({ ensureScene: async (view, options) => { config = options; started.resolve(); await released.promise } })
  const pending = h.presenter.present({ before: null, after })
  await started.promise
  assert.deepEqual(h.entries, [], 'creating or loading the scene is not a reveal')
  config.onEntryReveal('source')
  assert.deepEqual(h.entries.map(entry => [entry.actorId, entrySpecies(entry)]), [['source', 'Charizard']])
  config.onEntryReveal('target')
  config.onEntryReveal('source')
  config.onEntryReveal('unknown')
  assert.deepEqual(h.entries.map(entry => entry.actorId), ['source', 'target'])
  released.resolve()
  assert.equal((await pending).status, 'completed')
  assert.deepEqual(h.cancellations, [], 'normal signal cleanup must not cut off a sounding cry')
  assert.deepEqual(after, saved, 'presentation cannot mutate authoritative state')
  assert.deepEqual(h.displays.at(-1), after)
  config.onEntryReveal('target')
  assert.equal(h.entries.length, 2, 'a retained cue cannot replay after the scene operation completes')
})

test('switch and drag cries map either server seat to the correct local actor and current species', async () => {
  for (const seat of ['p1', 'p2']) for (const actorId of ['source', 'target']) for (const opcode of ['switch', 'drag']) {
    const batch = switchBatch(seat, actorId, opcode), saved = clone(batch), h = harness()
    assert.equal((await h.presenter.present(batch)).status, 'completed')
    assert.deepEqual(h.entries.map(entry => [entry.actorId, entrySpecies(entry)]), [[actorId, 'Blastoise']], `${seat} ${actorId} ${opcode}`)
    assert.deepEqual(h.displays.at(-1), batch.after)
    assert.deepEqual(batch, saved)
    assert.equal(h.moveRequests.length, 0)
    assert.equal(h.cancellations.length, 0)
  }
})

test('duplicate and previously consumed server events cannot emit additional entry cries', async () => {
  const batch = switchBatch(), h = harness()
  batch.events = [event(10, 'switch', 'p1:1', 'Charizard, L100', '100/100'), batch.events[0], batch.events[0]]
  await h.presenter.present(batch)
  assert.equal(h.entries.length, 1)
  assert.equal(entrySpecies(h.entries[0]), 'Blastoise')
})

test('a switch reveal may sound only the actor selected by that server entry', async () => {
  const h = harness({ ensureScene: async (view, options) => {
    options.onEntryReveal?.('target')
    options.onEntryReveal?.('source')
    options.onEntryReveal?.('source')
  } })
  await h.presenter.present(switchBatch())
  assert.deepEqual(h.entries.map(entry => entry.actorId), ['source'])
})

test('form, identity, transform and snapshot corrections are silent even when the renderer offers a cue', async () => {
  for (const opcode of ['replace', 'detailschange', '-formechange', '-transform', 'swap']) {
    const before = viewFor(), after = clone(before)
    after.own.team[0].species = 'Castform-Sunny'; after.cursor = 11
    const h = harness({ ensureScene: async (view, options) => {
      options.onEntryReveal?.('source'); options.onEntryReveal?.('target')
    } })
    await h.presenter.present({ before, after, events: [event(11, opcode, 'p1:1', 'Castform-Sunny, L100', '100/100')] })
    assert.equal(h.entries.length, 0, opcode)
    h.presenter.reset(after)
    assert.equal(h.entries.length, 0, 'reconnect/reset is a snapshot, not an entry')
  }
})

test('an animation with no reveal cue stays silent instead of playing late at completion', async () => {
  const h = harness({ ensureScene: async () => {} })
  await h.presenter.present({ before: null, after: viewFor() })
  assert.equal(h.entries.length, 0)
  assert.equal(h.cancellations.length, 0)
})

test('reduced motion uses the entry reveal cue and leaves sound independent of the shortened animation', async () => {
  const h = harness()
  await h.presenter.present(switchBatch(), { reducedMotion: true })
  assert.equal(h.entries.length, 1)
  assert.ok(h.sceneRequests.every(({ options }) => options.reducedMotion))
  assert.equal(h.cancellations.length, 0)
})

test('effects-off opening plays both live entries after the final scene is ready, without loading FX', async () => {
  const started = deferred(), ready = deferred()
  const h = harness({ ensureScene: async (view, options) => {
    assert.deepEqual(options.entryActorIds, [], 'audio must not request a visual release')
    started.resolve(); await ready.promise
  }, loadFx: () => { throw new Error('Effects must remain unloaded') } })
  const pending = h.presenter.present({ before: null, after: viewFor() }, { effectsEnabled: false })
  await started.promise
  assert.equal(h.entries.length, 0)
  ready.resolve()
  assert.equal((await pending).status, 'skipped')
  assert.deepEqual(h.entries.map(entry => [entry.actorId, entrySpecies(entry)]), [['source', 'Charizard'], ['target', 'Venusaur']])
  assert.equal(h.cancellations.length, 0, 'turning off visuals is not cancelling sound')
})

test('effects-off switch playback sounds only the final live entry justified by fresh server events', async () => {
  const before = viewFor(), after = clone(before)
  select(after, 'source', 'p1:3', 'Sceptile'); after.cursor = 13
  const events = [event(11, 'switch', 'p1:2', 'Blastoise, L100', '100/100'),
    event(12, 'drag', 'p1:3', 'Sceptile, L100', '100/100'), event(13, 'turn', '2')]
  const h = harness()
  await h.presenter.present({ before, after, events: [...events, events[1]] }, { effectsEnabled: false })
  assert.deepEqual(h.entries.map(entry => [entry.actorId, entrySpecies(entry)]), [['source', 'Sceptile']])
  assert.ok(h.sceneRequests.every(({ options }) => options.entryActorIds.length === 0))
  assert.equal(h.moveRequests.length, 0)
})

test('effects-off correction, ordinary turn and already consumed switch events stay silent', async () => {
  for (const events of [[], [event(11, 'turn', '2')], [event(10, 'switch', 'p1:2', 'Blastoise, L100', '100/100')],
    [event(11, 'replace', 'p1:2', 'Blastoise, L100', '100/100')]]) {
    const batch = switchBatch(), h = harness()
    await h.presenter.present({ ...batch, events }, { effectsEnabled: false })
    assert.equal(h.entries.length, 0)
  }
})

test('a missing active member, a fainted member and zero HP cannot cry on entry', async () => {
  for (const effectsEnabled of [true, false]) for (const unavailable of ['fainted', 'zero-hp', 'missing']) {
    const after = viewFor(), h = harness()
    if (unavailable === 'fainted') after.own.team[0].fainted = true
    if (unavailable === 'zero-hp') after.own.team[0].hp.current = 0
    if (unavailable === 'missing') after.own.active = null
    await h.presenter.present({ before: null, after }, { effectsEnabled })
    assert.deepEqual(h.entries.map(entry => entry.actorId), ['target'], `${effectsEnabled} ${unavailable}`)
  }
})

test('entry callback failures remain optional presentation and cannot fail a committed battle', async () => {
  let calls = 0
  const after = viewFor()
  const h = harness({ onEntry() { calls++; throw new Error('Audio device unavailable') } })
  assert.equal((await h.presenter.present({ before: null, after })).status, 'completed')
  assert.equal(calls, 2)
  assert.deepEqual(h.displays.at(-1), after)
})

test('an unfinished audio callback never holds the battle presentation open', async () => {
  let calls = 0
  const after = viewFor()
  const h = harness({ onEntry() { calls++; return new Promise(() => {}) }, timeoutMs: 25 })
  assert.equal((await h.presenter.present({ before: null, after })).status, 'completed')
  assert.equal(calls, 2)
  assert.deepEqual(h.displays.at(-1), after)
})

test('skip, reset, destroy and timeout stop sounding entries and invalidate retained cues', async () => {
  for (const mode of ['skip', 'reset', 'destroy', 'timeout']) {
    const started = deferred(), released = deferred(), after = viewFor()
    let config
    const h = harness({ timeoutMs: mode === 'timeout' ? 15 : 7500, ensureScene: async (view, options) => {
      if (!options.entryActorIds.length) return
      config = options; started.resolve(); await released.promise
    } })
    const pending = h.presenter.present({ before: null, after })
    await started.promise
    config.onEntryReveal('source')
    assert.equal(h.entries.length, 1)
    if (mode === 'skip') h.presenter.skip()
    if (mode === 'reset') h.presenter.reset({ ...clone(after), matchId: 'fresh-battle' })
    if (mode === 'destroy') h.presenter.destroy()
    const result = await pending
    assert.equal(result.status, mode === 'skip' ? 'skipped' : mode === 'timeout' ? 'failed' : 'cancelled')
    assert.ok(h.cancellations.length >= 1, mode)
    assert.equal(config.signal.aborted, true)
    config.onEntryReveal('target')
    released.resolve(); await tick()
    assert.equal(h.entries.length, 1, `late ${mode} cue must remain silent`)
  }
})

test('a rejected scene stops any sounding cry and reconciliation never emits another entry', async () => {
  let retained
  const h = harness({ ensureScene: async (view, options) => {
    if (!options.entryActorIds.length) return
    retained = options.onEntryReveal
    retained('source')
    throw new Error('Renderer lost')
  } })
  const after = viewFor()
  assert.equal((await h.presenter.present({ before: null, after })).status, 'failed')
  assert.equal(h.entries.length, 1)
  assert.ok(h.cancellations.length >= 1)
  retained('target')
  assert.equal(h.entries.length, 1)
  assert.deepEqual(h.displays.at(-1), after)
})

test('cancellation callback failures cannot prevent a skipped battle from reconciling', async () => {
  const started = deferred(), after = viewFor()
  const h = harness({ onEntryCancel() { throw new Error('Audio cleanup failed') }, ensureScene: async (view, options) => {
    if (!options.entryActorIds.length) return
    started.resolve(); await new Promise(() => {})
  } })
  const pending = h.presenter.present({ before: null, after })
  await started.promise
  h.presenter.skip()
  assert.equal((await pending).status, 'skipped')
  assert.deepEqual(h.displays.at(-1), after)
})
