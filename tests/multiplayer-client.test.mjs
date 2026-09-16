import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoomSession } from '../apps/multiplayer/src/roomSession.js'
import { multiplayerRequest, createOperationId } from '../apps/multiplayer/src/api.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function update(revision, cursor, extras = {}) {
  return { protocolVersion: 1, room: { id: 'room', status: 'active', seat: 'p2' }, matchId: 'match', revision,
    view: { complete: true, seat: 'p2', matchId: 'match', cursor, decision: { id: 'choice1', kind: 'move' } },
    events: Array.from({ length: cursor }, (_, i) => ({ cursor: i + 1 })), ...extras }
}
function harness(options = {}) {
  const calls = [], syncs = [], states = [], errors = []
  const controller = createRoomSession({ present: async batch => { calls.push(batch); await options.play?.() }, sync: value => { syncs.push(value) }, onChange: state => states.push(state), onError: error => errors.push(error), ...options })
  return { controller, calls, syncs, states, errors }
}
test('eventless wait updates never restart a running animation or clear an unrelated command', async () => {
  const gate = deferred(), h = harness({ play: () => gate.promise })
  h.controller.enter(update(1, 2))
  h.controller.setPending({ operationId: 'a', decisionId: 'choice1' })
  h.controller.ingest(update(2, 2))
  assert.equal(h.calls.length, 1)
  assert.equal(h.controller.snapshot().pending.operationId, 'a')
  const waiting = update(3, 2); waiting.view.decision.kind = 'wait'
  h.controller.ingest(waiting)
  assert.equal(h.controller.snapshot().pending, null)
  assert.equal(h.calls.length, 1)
  gate.resolve(); await tick(); h.controller.dispose()
})
test('new complete batches queue behind playback, duplicates and late POST snapshots do not regress', async () => {
  const gate = deferred(), h = harness({ play: () => gate.promise })
  h.controller.enter(update(1, 2))
  h.controller.ingest(update(2, 4))
  h.controller.ingest(update(2, 4))
  h.controller.ingest(update(1, 2))
  assert.equal(h.calls.length, 1)
  assert.equal(h.controller.snapshot().cursor, 4)
  gate.resolve(); await tick()
  assert.equal(h.calls.length, 2)
  assert.deepEqual(h.calls[1].events.map(e => e.cursor), [3, 4])
  assert.equal(h.calls[1].before.cursor, 2)
  h.controller.dispose()
})
test('stale acknowledgement resolves only its pending operation without replacing newer state', () => {
  const h = harness(); h.controller.enter(update(2, 2), { synchronize: true })
  h.controller.setPending({ operationId: 'send' })
  h.controller.ingest(update(1, 1, { ack: { operationId: 'send', accepted: true } }))
  assert.equal(h.controller.snapshot().pending, null)
  assert.equal(h.controller.snapshot().revision, 2)
  h.controller.dispose()
})
test('gapped events and reconnect reconcile snapshots instead of replaying history', () => {
  const h = harness(); h.controller.enter(update(1, 2), { synchronize: true })
  h.controller.ingest(update(2, 5, { events: [{ cursor: 5 }] }))
  assert.deepEqual(h.syncs.map(v => v.cursor), [2, 5])
  assert.equal(h.calls.length, 0)
  h.controller.dispose()
})
test('a room change invalidates old playback and rejects late responses', async () => {
  const gate = deferred(), h = harness({ play: () => gate.promise })
  h.controller.enter(update(1, 1))
  const next = update(1, 1); next.room.id = 'replacement'
  h.controller.enter(next, { synchronize: true })
  assert.equal(h.controller.ingest(update(2, 2)), false)
  gate.resolve(); await tick()
  assert.equal(h.controller.snapshot().envelope.room.id, 'replacement')
  assert.equal(h.controller.snapshot().playing, false)
  h.controller.dispose()
})
test('bad viewer seat fails closed and interrupted host status cancels playback', () => {
  const h = harness(); const invalid = update(1, 1); invalid.view.seat = 'p1'
  assert.equal(h.controller.enter(invalid), false)
  assert.equal(h.errors.length, 1)
  const interrupted = update(2, 1); interrupted.room.status = 'interrupted'
  h.controller.ingest(interrupted)
  assert.equal(h.calls.length, 0)
  assert.equal(h.syncs.length, 1)
  h.controller.dispose()
})
test('absent or unrelated receipt identifiers never clear a pending operation', () => {
  const h = harness(); h.controller.enter(update(2, 2), { synchronize: true })
  for (const pending of [{ operationId: 'send' }, { commandId: 'send' }, { operationId: 'send', commandId: 'send' }]) {
    h.controller.setPending(pending)
    for (const ack of [{ accepted: true }, { operationId: 'other' }, { commandId: 'other' }, { operationId: '' }]) {
      h.controller.ingest(update(1, 1, { ack }))
      assert.deepEqual(h.controller.snapshot().pending, pending)
    }
  }
  h.controller.dispose()
})
test('a matching ID from another room, seat or match cannot acknowledge the current command', () => {
  const h = harness(); h.controller.enter(update(2, 2), { synchronize: true })
  h.controller.setPending({ commandId: 'send' })
  for (const change of [response => { response.room.id = 'different' }, response => { response.room.seat = 'p1' }, response => { response.matchId = 'old-match' }]) {
    const response = update(1, 1, { ack: { commandId: 'send', accepted: true } }); change(response)
    assert.equal(h.controller.ingest(response), false)
    assert.equal(h.controller.snapshot().pending.commandId, 'send')
  }
  h.controller.dispose()
})
test('unchanged heartbeat clock samples retain the active view and do not restart playback', async () => {
  const gate = deferred(), h = harness({ play: () => gate.promise })
  const initial = update(1, 2, { serverNow: 1000, _receivedAt: 900 })
  h.controller.enter(initial)
  h.controller.ingest({ protocolVersion: 1, room: initial.room, matchId: 'match', revision: 1,
    mode: 'unchanged', serverNow: 3000, _receivedAt: 2900 })
  assert.equal(h.controller.snapshot().envelope.view, initial.view)
  assert.equal(h.controller.snapshot().envelope.serverNow, 3000)
  assert.equal(h.controller.snapshot().envelope._receivedAt, 2900)
  assert.equal(h.calls.length, 1)
  h.controller.ingest(update(0, 1, { serverNow: 500, _receivedAt: 2901 }))
  assert.equal(h.controller.snapshot().envelope.serverNow, 3000, 'an older response cannot regress the clock sample')
  gate.resolve(); await tick(); h.controller.dispose()
})
test('a complete battle batch waits for asynchronous synchronization before presenting from that snapshot', async () => {
  const gate = deferred(), syncs = [], h = harness({ sync: async (view, options) => { syncs.push({ view, options }); await gate.promise } })
  h.controller.enter(update(1, 2), { synchronize: true })
  h.controller.ingest(update(2, 4))
  assert.equal(h.calls.length, 0)
  assert.equal(h.controller.snapshot().playing, true)
  assert.equal(syncs[0].options.isCurrent(), true)
  gate.resolve(); await tick()
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].before.cursor, 2)
  assert.deepEqual(h.calls[0].events.map(event => event.cursor), [3, 4])
  assert.equal(h.controller.snapshot().displayed.cursor, 4)
  assert.equal(h.controller.snapshot().playing, false)
  h.controller.dispose()
})
test('sync during playback invalidates old host callbacks and an old completion cannot unlock new synchronization', async () => {
  const attack = deferred(), recovery = deferred(), callbacks = []
  const h = harness({ present: async (batch, options) => { callbacks.push(options); await attack.promise }, sync: () => recovery.promise })
  h.controller.enter(update(1, 2))
  h.controller.ingest(update(2, 4), { synchronize: true })
  assert.equal(callbacks[0].isCurrent(), false)
  attack.resolve(); await tick()
  assert.equal(h.controller.snapshot().playing, true)
  assert.equal(h.controller.snapshot().displayed.cursor, 4)
  recovery.resolve(); await tick()
  assert.equal(h.controller.snapshot().playing, false)
  h.controller.dispose()
})
test('a newer room cancels delayed synchronization and ignores its late resolution', async () => {
  const gate = deferred(), callbacks = []
  const h = harness({ sync: async (view, options) => { callbacks.push(options); await gate.promise } })
  h.controller.enter(update(1, 2), { synchronize: true })
  const replacement = update(1, 1); replacement.room.id = 'replacement'; replacement.matchId = replacement.view.matchId = 'new-match'
  h.controller.enter(replacement)
  assert.equal(callbacks[0].isCurrent(), false)
  gate.resolve(); await tick()
  assert.equal(h.controller.snapshot().envelope.room.id, 'replacement')
  assert.equal(h.controller.snapshot().displayed.matchId, 'new-match')
  assert.equal(h.controller.snapshot().cursor, 1)
  h.controller.dispose()
})
test('eventless metadata received during a batch survives its final displayed snapshot', async () => {
  const gate = deferred(), h = harness({ play: () => gate.promise })
  h.controller.enter(update(1, 2))
  const waiting = update(2, 2); waiting.view.decision.kind = 'wait'
  h.controller.ingest(waiting)
  gate.resolve(); await tick()
  assert.equal(h.controller.snapshot().displayed.decision.kind, 'wait')
  assert.equal(h.calls.length, 1)
  h.controller.dispose()
})
test('malformed and gapped facts reconcile the full view without publishing partial history', async () => {
  const events = [], h = harness({ onEvents: values => events.push(values) })
  h.controller.enter(update(1, 2), { synchronize: true })
  assert.doesNotThrow(() => h.controller.ingest(update(2, 4, { events: [null] })))
  assert.deepEqual(events.at(-1), [])
  h.controller.ingest(update(3, 7, { events: [{ cursor: 7 }] }))
  assert.deepEqual(events.at(-1), [])
  assert.equal(h.syncs.at(-1).cursor, 7)
  assert.equal(h.calls.length, 0)
  await tick(); h.controller.dispose()
})
test('queue overflow reconciles the newest complete snapshot and discards intermediate playback', async () => {
  const gate = deferred(), h = harness({ play: () => gate.promise, maxQueue: 1 })
  h.controller.enter(update(1, 1))
  h.controller.ingest(update(2, 2))
  h.controller.ingest(update(3, 3))
  assert.equal(h.syncs.at(-1).cursor, 3)
  gate.resolve(); await tick()
  assert.equal(h.calls.length, 1)
  assert.equal(h.controller.snapshot().displayed.cursor, 3)
  h.controller.dispose()
})
test('a throwing renderer sync or failed presentation cannot escape ingestion or roll back the newest state', async () => {
  const broken = harness({ sync() { throw Error('renderer unavailable') } })
  assert.doesNotThrow(() => broken.controller.enter(update(1, 1), { synchronize: true }))
  await tick()
  assert.equal(broken.errors.length, 1)
  assert.equal(broken.controller.snapshot().playing, false)
  broken.controller.dispose()
  const gate = deferred(), h = harness({ play: async () => { await gate.promise; throw Error('FX unavailable') } })
  h.controller.enter(update(1, 1)); h.controller.ingest(update(2, 3))
  gate.resolve(); await tick()
  assert.equal(h.syncs.at(-1).cursor, 3)
  assert.equal(h.controller.snapshot().displayed.cursor, 3)
  assert.equal(h.calls.length, 1)
  h.controller.dispose()
})
test('disposed controllers reject future entry, updates and commands without touching the host', async () => {
  let clears = 0
  const h = harness({ clear: () => { clears++ } })
  h.controller.enter(update(1, 1), { synchronize: true })
  h.controller.dispose(); const previous = clears
  h.controller.enter(update(2, 3)); h.controller.ingest(update(2, 3)); h.controller.setPending({ operationId: 'late' }); h.controller.reset(); h.controller.dispose()
  await tick()
  assert.equal(clears, previous)
  assert.equal(h.controller.snapshot().envelope, null)
  assert.equal(h.controller.snapshot().pending, null)
})
test('transport retries preserve the payload and use independent same-origin requests', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options }); if (calls.length === 1) throw Error('offline')
    return new Response(JSON.stringify({ ack: { accepted: true } }))
  })
  const body = { operationId: 'one', commandId: 'one', decisionId: 'd', action: { kind: 'move', slot: 1 } }
  await assert.rejects(multiplayerRequest('rooms/r/choice', { method: 'POST', body }), e => e.code === 'CONNECTION_FAILED')
  await multiplayerRequest('rooms/r/choice', { method: 'POST', body })
  assert.equal(calls[0].body, calls[1].body); assert.equal(calls[0].credentials, 'same-origin')
  assert.equal(calls[0].url, '/api/multiplayer/rooms/r/choice')
  assert.notEqual(calls[0].signal, calls[1].signal)
  assert.match(createOperationId({ getRandomValues: bytes => bytes.fill(1) }), /^[a-f0-9]{32}$/)
})
