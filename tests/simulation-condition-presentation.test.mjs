import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'
import { conditionReactions } from '../apps/shared/battle/conditionReactions.js'

const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture(seat = 'p1') {
  const member = (memberId, name) => ({ memberId, name, species: name, hp: { current: 100, max: 100 },
    active: true, fainted: false, stages: {}, volatiles: [], condition: null, moves: [] })
  return { matchId: 'conditions', seat, cursor: 10, turn: 1, result: null,
    own: { active: `${seat}:1`, team: [member(`${seat}:1`, 'Charizard')] },
    opponent: { active: `${seat === 'p1' ? 'p2' : 'p1'}:revealed:1`, known: [member(`${seat === 'p1' ? 'p2' : 'p1'}:revealed:1`, 'Venusaur')] },
    weather: null, sideConditions: { p1: [], p2: [] }, sideConditionLayers: { p1: {}, p2: {} }, fieldConditions: [] }
}
function harness({ holdMove = false, holdReaction = false, loadConditions, ...overrides } = {}) {
  const actions = [], displays = [], messages = [], requests = [], reactions = [], moveDone = deferred(), reactionDone = deferred()
  let imports = 0
  const module = { playConditionReaction(request, options) {
    reactions.push({ request, options }); actions.push(`reaction:${request.kind}`)
    return { finished: holdReaction ? reactionDone.promise : Promise.resolve({ status: 'completed' }),
      cancel() { actions.push('cancel-reaction') } }
  } }
  const presenter = createSimulationPresenter({ getScene: () => ({}),
    ensureScene: async (_view, options) => { if (options.entryActorIds.length) actions.push('entry') },
    onDisplay: (view, options) => displays.push({ view: structuredClone(view), options }), onMessage: text => messages.push(text),
    onMove: request => { actions.push(`audio:${request.moveId}`) },
    loadFx: async () => ({ play(request, options) {
      requests.push(request); actions.push(`move:${request.moveId}`); options.onCue({ type: 'impact' })
      return { finished: holdMove ? moveDone.promise : Promise.resolve({ status: 'completed' }), cancel() {} }
    } }),
    loadConditions: async () => { imports++; return loadConditions ? loadConditions(module) : module },
    faintScene: async () => { actions.push('faint'); return { status: 'completed' } }, ...overrides,
  })
  return { presenter, actions, displays, messages, requests, reactions, moveDone, reactionDone, module, get imports() { return imports } }
}

test('setup is revealed at impact; its reaction waits for recovery and finishes before the next move', async () => {
  for (const seat of ['p1', 'p2']) {
    const before = fixture(seat), after = structuredClone(before), h = harness({ holdMove: true, holdReaction: true })
    const own = before.own.active, foe = before.opponent.active
    after.own.team[0].stages.atk = 2; after.cursor = 13
    const batch = { before, after, events: [event(11, 'move', own, 'Swords Dance', own), event(12, '-boost', own, 'atk', '2'), event(13, 'move', foe, 'Splash', foe)] }
    try {
      const pending = h.presenter.present(batch); await tick()
      assert.equal(h.displays.at(-1).view.own.team[0].stages.atk, 2)
      assert.equal(h.reactions.length, 0)
      assert.ok(h.messages.some(message => message.includes('Attack rose sharply')))
      h.moveDone.resolve({ status: 'completed' }); await tick()
      assert.deepEqual(h.reactions[0].request, { kind: 'boost', actorId: 'source', visualSeed: 12 })
      assert.equal(h.requests.length, 1)
      h.reactionDone.resolve({ status: 'completed' }); assert.equal((await pending).status, 'completed')
      assert.deepEqual(h.actions, ['audio:swords-dance', 'move:swords-dance', 'reaction:boost', 'audio:splash', 'move:splash'])
      assert.deepEqual(h.displays.at(-1).view, after)
    } finally { h.presenter.destroy() }
  }
})

test('Spikes activation follows entry, holds the defeated sprite through the reaction, then faints', async () => {
  const before = fixture(), after = structuredClone(before), incoming = 'p2:revealed:2', h = harness({ holdReaction: true })
  after.opponent.active = null
  after.opponent.known[0].active = false
  after.opponent.known.push({ ...structuredClone(before.opponent.known[0]), memberId: incoming, name: 'Blastoise', species: 'Blastoise',
    active: false, fainted: true, hp: { current: 0, max: 100 } })
  after.cursor = 13
  const batch = { before, after, events: [event(11, 'switch', incoming, 'Blastoise, L100', '6/100'),
    event(12, '-damage', incoming, '0 fnt', '[from] Spikes'), event(13, 'faint', incoming)] }
  try {
    const pending = h.presenter.present(batch); await tick()
    assert.deepEqual(h.actions, ['entry', 'reaction:spikes'])
    assert.deepEqual(h.displays.at(-1).options.retainFaintedActorIds, ['target'])
    assert.equal(h.displays.at(-1).view.opponent.known.at(-1).hp.current, 0)
    h.reactionDone.resolve({ status: 'completed' }); await pending
    assert.deepEqual(h.actions, ['entry', 'reaction:spikes', 'faint'])
    assert.deepEqual(h.displays.at(-1).view, after)
  } finally { h.presenter.destroy() }
})

test('delayed sleep and residual poison are separate from the preceding move result', async () => {
  for (const [opcode, fields, kind] of [['-status', ['slp', '[from] move: Yawn'], 'sleep'], ['-damage', ['90/100 psn', '[from] psn'], 'poison']]) {
    const before = fixture(), after = structuredClone(before), h = harness({ holdMove: true })
    after.cursor = 13
    if (opcode === '-status') after.opponent.known[0].condition = 'slp'
    else Object.assign(after.opponent.known[0], { hp: { current: 90, max: 100 }, condition: 'psn' })
    try {
      const pending = h.presenter.present({ before, after, events: [event(11, 'move', before.own.active, 'Splash', before.own.active),
        event(12, '-nothing'), event(13, opcode, before.opponent.active, ...fields)] }); await tick()
      assert.equal(h.displays.at(-1).view.cursor, 12)
      assert.equal(h.displays.at(-1).view.opponent.known[0].condition, null)
      assert.equal(h.reactions.length, 0)
      h.moveDone.resolve({ status: 'completed' }); await pending
      assert.equal(h.reactions[0].request.kind, kind)
      assert.deepEqual(h.displays.at(-1).view, after)
    } finally { h.presenter.destroy() }
  }
})

test('public Spikes layers increment at each cast and clear at removal in displayed snapshots', async () => {
  const before = fixture(), after = structuredClone(before), h = harness()
  const events = [1, 2, 3].flatMap((layer, index) => [event(11 + index * 2, 'move', before.own.active, 'Spikes', before.opponent.active),
    event(12 + index * 2, '-sidestart', 'p2', 'Spikes')])
  events.push(event(17, 'move', before.opponent.active, 'Rapid Spin', before.own.active), event(18, '-sideend', 'p2', 'Spikes')); after.cursor = 18
  try {
    await h.presenter.present({ before, after, events })
    assert.deepEqual(h.displays.filter(row => row.view.cursor <= 16).map(row => row.view.sideConditionLayers.p2.Spikes), [1, 2, 3])
    assert.deepEqual(h.displays.at(-1).view.sideConditionLayers.p2, {})
    assert.ok(h.messages.some(message => message.includes('3 layers')))
    assert.ok(h.messages.some(message => message.includes('Spikes ended')))
  } finally { h.presenter.destroy() }
})

test('skip, reset, timeout and failure cancel owned reactions and reconcile the authoritative snapshot', async () => {
  for (const mode of ['skip', 'reset', 'timeout', 'failure']) {
    const before = fixture(), after = structuredClone(before), h = harness({ holdReaction: true, ...(mode === 'timeout' ? { timeoutMs: 20 } : {}) })
    after.cursor = 11; after.own.team[0].condition = 'brn'
    try {
      const pending = h.presenter.present({ before, after, events: [event(11, '-status', before.own.active, 'brn')] }); await tick()
      assert.equal(h.reactions.length, 1)
      if (mode === 'skip') h.presenter.skip()
      if (mode === 'reset') h.presenter.reset(before)
      if (mode === 'failure') h.reactionDone.resolve({ status: 'failed' })
      assert.equal((await pending).status, { skip: 'skipped', reset: 'cancelled', timeout: 'failed', failure: 'failed' }[mode])
      assert.ok(h.reactions[0].options.signal.aborted)
      assert.ok(h.actions.includes('cancel-reaction'))
      assert.deepEqual(h.displays.at(-1).view, mode === 'reset' ? before : after)
      const count = h.displays.length; h.reactionDone.resolve({ status: 'completed' }); await tick()
      assert.equal(h.displays.length, count)
    } finally { h.presenter.destroy() }
  }
})

test('effects off, reconnect and old events never replay condition reactions; reduced motion is forwarded', async () => {
  for (const mode of ['off', 'reconnect', 'old', 'reduced']) {
    const before = fixture(), after = structuredClone(before), h = harness()
    after.cursor = 11; after.own.team[0].condition = 'par'
    try {
      await h.presenter.present({ before: mode === 'reconnect' ? null : before, after,
        events: [event(mode === 'old' ? 10 : 11, '-status', before.own.active, 'par')] },
      { effectsEnabled: mode !== 'off', reducedMotion: mode === 'reduced' })
      assert.equal(h.imports, mode === 'reduced' ? 1 : 0)
      if (mode === 'reduced') assert.equal(h.reactions[0].options.reducedMotion, true)
      assert.deepEqual(h.displays.at(-1).view, after)
    } finally { h.presenter.destroy() }
  }
})

test('late optional imports cannot start a skipped reaction; future batches retry', async () => {
  const loading = deferred(), h = harness({ loadConditions: () => loading.promise }), before = fixture(), after = { ...structuredClone(before), cursor: 11 }
  try {
    const pending = h.presenter.present({ before, after, events: [event(11, 'cant', before.own.active, 'slp')] }); await tick()
    h.presenter.skip(); assert.equal((await pending).status, 'skipped')
    loading.resolve(h.module); await tick(); assert.equal(h.reactions.length, 0)
    await h.presenter.present({ before: after, after: { ...after, cursor: 12 }, events: [event(12, 'cant', before.own.active, 'slp')] })
    assert.equal(h.reactions.length, 1)
  } finally { h.presenter.destroy() }
})

test('reaction requests contain cosmetic identity only, ignore inactive members and deduplicate combined boosts', () => {
  const view = fixture(), own = view.own.active, foe = view.opponent.active
  const events = [event(11, '-boost', own, 'atk', '1'), event(12, '-boost', own, 'def', '1'), event(13, '-boost', own, 'spe', '0'),
    event(14, '-status', 'p1:2', 'brn'), event(15, '-damage', foe, '90/100', '[from] Leech Seed'),
    event(16, '-heal', own, '100/100', '[from] Leech Seed'), event(17, 'cant', foe, 'frz')]
  const saved = structuredClone({ events, view })
  assert.deepEqual(conditionReactions(events, view), [{ kind: 'boost', actorId: 'source', visualSeed: 11 },
    { kind: 'leech-seed', actorId: 'target', visualSeed: 15 }, { kind: 'leech-seed', actorId: 'source', visualSeed: 16 },
    { kind: 'freeze', actorId: 'target', visualSeed: 17 }])
  assert.deepEqual({ events, view }, saved)
})
