import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'

const clone = value => structuredClone(value)
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
const member = (memberId, species) => ({ memberId, species, name: species, fainted: false, active: true,
  hp: { current: 100, max: 100 }, stages: {}, volatiles: [], moves: [] })
function fixture(seat = 'p1') {
  const opponent = seat === 'p1' ? 'p2' : 'p1'
  return { matchId: 'transition-battle', seat, cursor: 10, turn: 1,
    own: { active: `${seat}:1`, team: [member(`${seat}:1`, 'Charizard'), member(`${seat}:2`, 'Blastoise')] },
    opponent: { active: `${opponent}:1`, known: [member(`${opponent}:1`, 'Venusaur'), member(`${opponent}:2`, 'Gengar')] },
    weather: null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], result: null }
}
const sideFor = (view, actorId) => actorId === 'source' ? view.own : view.opponent
function batchFor(seat, actorId, opcode) {
  const before = fixture(seat), after = clone(before), side = sideFor(after, actorId)
  const outgoing = side.active, list = side.team ?? side.known
  if (opcode === 'faint') { list[0].fainted = true; list[0].hp.current = 0; side.active = null }
  else side.active = list[1].memberId
  after.cursor = 11
  return { before, after, events: [event(11, opcode, opcode === 'faint' ? outgoing : side.active,
    list[1].species, '100/100')] }
}
function harness(overrides = {}) {
  const transitions = [], reveals = [], displays = [], requests = []
  const presenter = createSimulationPresenter({ getScene: () => ({}), onDisplay: view => displays.push(clone(view)),
    ensureScene: async (view, options) => {
      requests.push({ view, options })
      for (const actorId of ['source', 'target', 'missing', 'source']) {
        options.onEntrySound?.(actorId); options.onEntryReveal?.(actorId)
      }
    },
    faintScene: async (view, options) => {
      for (const actorId of options.actorIds) {
        const side = sideFor(view, actorId), id = (side.team ?? side.known)[0].memberId
        options.onFaintStart?.('missing', id); options.onFaintStart?.(actorId, 'wrong-member')
        options.onFaintStart?.(actorId, id); options.onFaintStart?.(actorId, id)
      }
      return { status: 'completed' }
    },
    onEntry: (view, actorId) => reveals.push(actorId),
    onTransition: (view, cue) => transitions.push({ view: clone(view), cue }),
    loadFx: async () => ({ play: () => ({ finished: Promise.resolve({ status: 'completed' }) }) }),
    ...overrides,
  })
  return { presenter, transitions, reveals, displays, requests }
}

test('opening sounds are separate from unchanged cry reveals and carry each local member identity', async () => {
  for (const seat of ['p1', 'p2']) for (const reducedMotion of [false, true]) {
    const h = harness(), after = fixture(seat)
    try {
      assert.equal((await h.presenter.present({ before: null, after }, { reducedMotion })).status, 'completed')
      assert.deepEqual(h.transitions.map(value => value.cue), ['source', 'target'].map(actorId => ({
        type: 'pokeball', actorId, memberId: sideFor(after, actorId).active,
      })))
      assert.deepEqual(h.reveals, ['source', 'target'])
      h.requests[0].options.onEntrySound('source')
      assert.equal(h.transitions.length, 2, 'completed cue cannot replay')
    } finally { h.presenter.destroy() }
  }
})

test('switch and drag sounds follow either local side while faint sounds identify outgoing members after active clears', async () => {
  for (const seat of ['p1', 'p2']) for (const actorId of ['source', 'target']) {
    for (const opcode of ['switch', 'drag', 'faint']) for (const reducedMotion of [false, true]) {
      const h = harness(), batch = batchFor(seat, actorId, opcode), saved = clone(batch)
      try {
        assert.equal((await h.presenter.present(batch, { reducedMotion })).status, 'completed')
        assert.deepEqual(h.transitions.map(value => value.cue), [{ type: opcode === 'faint' ? 'faint' : 'pokeball', actorId,
          memberId: sideFor(opcode === 'faint' ? batch.before : batch.after, actorId).active }])
        if (opcode === 'faint') assert.equal(sideFor(h.transitions[0].view, actorId).active, null)
        assert.deepEqual(batch, saved)
      } finally { h.presenter.destroy() }
    }
  }
})

test('effects-off, reconnect, consumed facts and form correction cannot produce transition sounds', async () => {
  for (const opcode of ['switch', 'faint']) {
    const h = harness(), batch = batchFor('p1', 'source', opcode)
    try {
      assert.equal((await h.presenter.present(batch, { effectsEnabled: false })).status, 'skipped')
      h.presenter.reset(batch.after)
      assert.equal(h.transitions.length, 0)
    } finally { h.presenter.destroy() }
  }
  for (const opcode of ['replace', 'detailschange', '-formechange', 'switch']) {
    const h = harness(), batch = batchFor('p1', 'source', opcode)
    if (opcode === 'switch') batch.events[0].cursor = batch.before.cursor
    try { await h.presenter.present(batch); assert.equal(h.transitions.length, 0) }
    finally { h.presenter.destroy() }
  }
  const h = harness()
  try { await h.presenter.present({ before: null, after: fixture() }, { effectsEnabled: false }); assert.equal(h.transitions.length, 0) }
  finally { h.presenter.destroy() }
})

test('missing, fainted or zero-HP members cannot emit opening sounds even if an adapter supplies a cue', async () => {
  for (const state of ['missing', 'fainted', 'zero']) {
    const h = harness(), after = fixture()
    if (state === 'missing') after.own.active = null
    if (state === 'fainted') after.own.team[0].fainted = true
    if (state === 'zero') after.own.team[0].hp.current = 0
    try { await h.presenter.present({ before: null, after }); assert.deepEqual(h.transitions.map(value => value.cue.actorId), ['target']) }
    finally { h.presenter.destroy() }
  }
})

test('skip, reset, timeout and destruction invalidate retained opening and faint-start callbacks', async () => {
  for (const kind of ['pokeball', 'faint']) for (const action of ['skip', 'reset', 'destroy', 'timeout']) {
    const started = deferred(), released = deferred(); let cue
    const block = async (view, options) => {
      if (kind === 'pokeball' && !options.entryActorIds.length) return
      cue = kind === 'pokeball' ? () => options.onEntrySound('source') : () => options.onFaintStart('source', 'p1:1')
      started.resolve(); await released.promise; return { status: 'completed' }
    }
    const h = harness({ [kind === 'pokeball' ? 'ensureScene' : 'faintScene']: block, timeoutMs: action === 'timeout' ? 20 : 7500 })
    const batch = kind === 'pokeball' ? { before: null, after: fixture() } : batchFor('p1', 'source', 'faint')
    try {
      const pending = h.presenter.present(batch); await started.promise
      if (action === 'skip') h.presenter.skip()
      if (action === 'reset') h.presenter.reset(batch.after)
      if (action === 'destroy') h.presenter.destroy()
      const result = await pending
      assert.equal(result.status, action === 'timeout' ? 'failed' : action === 'skip' ? 'skipped' : 'cancelled')
      cue(); released.resolve(); await tick(); assert.equal(h.transitions.length, 0)
    } finally { released.resolve(); h.presenter.destroy() }
  }
})

test('missing transition cues stay silent and optional sound callback errors cannot fail presentation', async () => {
  for (const fail of [false, true]) {
    let count = 0
    const h = harness(fail ? { onTransition() { count++; throw new Error('Optional audio unavailable') } } :
      { ensureScene: async () => {}, faintScene: async () => ({ status: 'completed' }) })
    try {
      assert.equal((await h.presenter.present({ before: null, after: fixture() })).status, 'completed')
      assert.equal((await h.presenter.present(batchFor('p1', 'source', 'faint'))).status, 'completed')
      assert.equal(count, fail ? 3 : 0); assert.equal(h.transitions.length, 0)
    } finally { h.presenter.destroy() }
  }
})
