import test from 'node:test'
import assert from 'node:assert/strict'
import { createEngineFactory } from '../packages/battle-engine/src/index.js'
import { createRoomService, RoomError } from '../apps/server/rooms/service.js'
import { createMemoryRoomStore } from '../apps/server/rooms/memoryStore.js'

function setup(t, options = {}) {
  let now = 10_000
  let serial = 0
  const store = options.roomStore ?? createMemoryRoomStore()
  const service = createRoomService({ autoCleanup: false, clock: () => now, ...options, roomStore: store })
  t.after(() => service.close())
  const id = () => `operation-${++serial}`
  const guest = async name => (await service.guest({ name })).guest.id
  const act = (guestId, operation, body = {}) => service.execute(guestId, operation, { operationId: id(), ...body })
  const read = (guestId, roomId, options) => service.updates(guestId, roomId, options)
  const setReady = async (guestId, roomId, extras = {}) => {
    const current = await read(guestId, roomId)
    return act(guestId, 'ready', { roomId, ready: true, selectionRevision: current.room.own.selectionRevision, membershipEpoch: current.room.membershipEpoch, ...extras })
  }
  async function lobby() {
    const a = await guest('Alice'), b = await guest('Bob')
    const created = await act(a, 'create')
    const roomId = created.room.id
    const joined = await act(b, 'join', { inviteToken: created.room.inviteToken })
    return { a, b, roomId, created, joined }
  }
  async function battle() {
    const data = await lobby()
    await setReady(data.a, data.roomId)
    const started = await setReady(data.b, data.roomId)
    return { ...data, started }
  }
  const choiceBody = (current, commandId = id(), action) => ({
    roomId: current.room.id, matchId: current.matchId, commandId, decisionId: current.view.decision.id,
    action: action ?? (current.view.decision.kind === 'switch'
      ? { kind: 'switch', memberId: current.view.decision.switches[0].memberId }
      : { kind: 'move', slot: current.view.decision.moves.find(move => !move.disabled)?.slot }),
    afterCursor: current.view.cursor,
  })
  const choose = (guestId, current, commandId, action) => service.execute(guestId, 'choice', choiceBody(current, commandId, action))
  return { service, store, id, guest, act, read, setReady, lobby, battle, choose, choiceBody, now: () => now, advance: amount => { now += amount } }
}

test('memory transaction publishes detached immutable records only after successful async commit', async () => {
  let reject = false
  const store = createMemoryRoomStore({ beforeCommit: async () => { await Promise.resolve(); if (reject) throw new Error('disk failed') } })
  const source = { nested: { value: 1 } }
  await store.transact('a', tx => tx.put('rooms', 'one', source))
  source.nested.value = 9
  reject = true
  await assert.rejects(store.transact('a', tx => tx.put('rooms', 'one', { nested: { value: 2 } })))
  assert.equal(await store.transact('a', tx => tx.get('rooms', 'one').nested.value), 1)
  await assert.rejects(store.transact('a', tx => { tx.get('rooms', 'one').nested.value = 7 }), TypeError)
  await store.close()
})

test('guest credentials are hashed, absolute, bounded and independent of battle configuration', async t => {
  const h = setup(t, { policy: { guestTtlMs: 1000, maxGuests: 2 } })
  const first = await h.service.guest({ name: 'Alice' })
  assert.match(first.token, /^[a-f0-9]{64}$/)
  const stored = await h.store.transact('inspect', tx => tx.get('guests', first.guest.id))
  assert(!JSON.stringify(stored).includes(first.token))
  h.advance(900)
  assert.equal(await h.service.authenticate(first.token), first.guest.id)
  const resumed = await h.service.guest({ token: first.token, name: 'Renamed' })
  assert.equal(resumed.guest.name, 'Renamed')
  assert.equal(resumed.guest.expiresAt, first.guest.expiresAt)
  await h.service.guest({ name: 'Second' })
  await assert.rejects(h.service.guest({ name: 'Overflow' }), { code: 'GUEST_CAPACITY' })
  const config = await h.service.config()
  assert.equal(config.presets.length, 3)
  assert.equal(config.profile.id, 'gen3opensinglesv1')
  assert.equal(config.moves.flamethrower.type, 'fire')
  config.presets[0].team[0].moves[0] = 'Changed'
  assert.equal((await h.service.config()).presets[0].team[0].moves[0], 'Flamethrower')
  h.advance(100)
  await assert.rejects(h.service.authenticate(first.token), { code: 'GUEST_EXPIRED' })
  const replacement = await h.service.guest({ token: first.token })
  assert.notEqual(replacement.guest.id, first.guest.id)
})

test('join races reserve one seat and one active room per guest across different rooms', async t => {
  const h = setup(t)
  const host = await h.guest('Host'), x = await h.guest('X'), y = await h.guest('Y')
  const room = await h.act(host, 'create')
  const joined = await Promise.allSettled([x, y].map(guest => h.act(guest, 'join', { inviteToken: room.room.inviteToken })))
  assert.equal(joined.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(joined.find(result => result.status === 'rejected').reason.code, 'ROOM_FULL')
  const host2 = await h.guest('Host 2'), host3 = await h.guest('Host 3'), entrant = await h.guest('Entrant')
  const rooms = await Promise.all([h.act(host2, 'create'), h.act(host3, 'create')])
  const simultaneous = await Promise.allSettled(rooms.map(room => h.act(entrant, 'join', { inviteToken: room.room.inviteToken })))
  assert.equal(simultaneous.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(simultaneous.find(result => result.status === 'rejected').reason.code, 'ALREADY_IN_ROOM')
  const self = await h.act(host, 'join', { inviteToken: room.room.inviteToken })
  assert.equal(self.room.seat, 'p1')
})

test('selection and membership revisions invalidate stale readiness; replacement requires consent', async t => {
  const h = setup(t)
  const { a, b, roomId } = await h.lobby()
  const prior = await h.read(a, roomId)
  const selected = await h.act(a, 'selection', { roomId, presetId: 'hoenn', leadIndex: 5, selectionRevision: 0 })
  assert.equal(selected.room.own.selectionRevision, 1)
  await assert.rejects(h.act(a, 'ready', { roomId, ready: true, selectionRevision: 0, membershipEpoch: prior.room.membershipEpoch }), { code: 'SELECTION_CHANGED' })
  await h.setReady(a, roomId)
  const leave = await h.act(b, 'leave', { roomId })
  assert(leave.left)
  const next = await h.guest('Next')
  const invitation = (await h.read(a, roomId)).room.inviteToken
  await h.act(next, 'join', { inviteToken: invitation })
  const current = await h.read(a, roomId)
  assert.equal(current.room.own.ready, false)
  assert.equal(current.room.opponent.ready, false)
  await assert.rejects(h.act(a, 'ready', { roomId, ready: true, selectionRevision: 1, membershipEpoch: prior.room.membershipEpoch }), { code: 'MEMBERSHIP_CHANGED' })
})

test('both ready requests create one match, freeze lead ordering and retain original ready receipt', async t => {
  const base = createEngineFactory()
  let starts = 0
  const h = setup(t, { engineFactory: { ...base, create: value => { starts++; return base.create(value) } } })
  const { a, b, roomId } = await h.lobby()
  await h.act(a, 'selection', { roomId, presetId: 'johto', leadIndex: 5, selectionRevision: 0 })
  const r1 = 'ready-a', r2 = 'ready-b'
  await Promise.all([h.setReady(a, roomId, { operationId: r1 }), h.setReady(b, roomId, { operationId: r2 })])
  assert.equal(starts, 1)
  const aView = await h.read(a, roomId), bView = await h.read(b, roomId)
  assert.equal(aView.room.status, 'active')
  assert.equal(aView.view.own.team[0].species, 'Heracross')
  assert.equal(bView.view.seat, 'p2')
  assert.equal(bView.view.own.active, 'p2:1')
  assert.equal(bView.view.opponent.known.length, 1)
  assert.equal(bView.room.opponent.presetId, undefined)
  assert.equal(bView.room.inviteToken, undefined)
  const retried = await h.act(b, 'ready', { operationId: r2, roomId, ready: true, selectionRevision: 0, membershipEpoch: bView.room.membershipEpoch })
  assert.equal(retried.matchId, aView.matchId)
  assert.equal(retried.ack.accepted, true)
  assert.equal(starts, 1)
})

test('first human choice changes only its viewer revision; retries retain ack with fresh state', async t => {
  const h = setup(t)
  const { a, b, roomId } = await h.battle()
  const beforeA = await h.read(a, roomId), beforeB = await h.read(b, roomId)
  const body = h.choiceBody(beforeA, 'same-command')
  const chosen = await h.service.execute(a, 'choice', body)
  assert.equal(chosen.view.cursor, beforeA.view.cursor)
  assert.equal(chosen.events.length, 0)
  assert.equal(chosen.view.decision.kind, 'wait')
  assert(chosen.revision > beforeA.revision)
  assert.equal(chosen.deadlineAt, null)
  const unchanged = await h.read(b, roomId, { afterRevision: beforeB.revision, afterCursor: beforeB.view.cursor })
  assert.equal(unchanged.mode, 'unchanged')
  assert.equal(unchanged.revision, beforeB.revision)
  assert.equal(unchanged.view, undefined)
  await h.choose(b, beforeB, 'same-command')
  const retried = await h.service.execute(a, 'choice', { ...body, afterCursor: 0 })
  assert.deepEqual(retried.ack, chosen.ack)
  assert.equal(retried.view.turn, 2)
  assert.equal(retried.view.decision.kind, 'move')
  await assert.rejects(h.service.execute(a, 'choice', { ...body, action: { kind: 'move', slot: 2 } }), { code: 'OPERATION_ID_REUSED' })
  await assert.rejects(h.service.execute(a, 'choice', { ...body, commandId: 'other', matchId: 'wrong-match' }), { code: 'MATCH_CHANGED' })
})

test('same-seat competing tabs cannot submit twice, forged switches cannot control the other seat', async t => {
  const h = setup(t)
  const { a, b, roomId } = await h.battle()
  const before = await h.read(a, roomId)
  const illegal = await h.choose(a, before, 'wrong-seat', { kind: 'switch', memberId: 'p2:2' })
  assert.equal(illegal.ack.code, 'ILLEGAL_ACTION')
  const results = await Promise.all([h.choose(a, before, 'first'), h.choose(a, before, 'second')])
  assert.equal(results.filter(result => result.ack.accepted).length, 1)
  assert.equal(results.find(result => !result.ack.accepted).ack.code, 'ALREADY_SUBMITTED')
  const stranger = await h.guest('Stranger')
  await assert.rejects(h.read(stranger, roomId), { code: 'NOT_A_MEMBER' })
  await assert.rejects(h.act(stranger, 'forfeit', { roomId, matchId: before.matchId }), { code: 'NOT_A_MEMBER' })
  const ownB = await h.read(b, roomId)
  assert.equal(ownB.view.decision.kind, 'move')
  const secrets = JSON.stringify(ownB)
  assert(!secrets.includes('checkpoint'))
  assert(!secrets.includes('sodium,'))
  assert(!secrets.includes('p1-6'))
  assert.equal(ownB.view.opponent.known[0].hp.max, 48)
})

test('forfeit is seat-specific, immutable, retryable and frees both guests for another room', async t => {
  const h = setup(t)
  const { a, b, roomId, started } = await h.battle()
  await assert.rejects(h.act(a, 'leave', { roomId }), { code: 'FORFEIT_REQUIRED' })
  const body = { roomId, matchId: started.matchId, operationId: 'forfeit-b' }
  const ended = await h.service.execute(b, 'forfeit', body)
  assert.deepEqual(ended.view.result, { kind: 'win', winnerSeat: 'p1', reason: 'forfeit' })
  assert.equal(ended.room.status, 'ended')
  const late = await h.act(a, 'forfeit', { roomId, matchId: started.matchId })
  assert.equal(late.ack.accepted, false)
  assert.deepEqual(late.view.result, ended.view.result)
  assert.deepEqual((await h.service.execute(b, 'forfeit', body)).ack, ended.ack)
  assert.equal((await h.service.session(a)).room.room.id, roomId)
  assert.equal((await h.act(a, 'create')).room.status, 'lobby')
  assert.equal((await h.act(b, 'create')).room.status, 'lobby')
})

test('late choice commits timeout before returning rejection; polling and reconnect do not reset clocks', async t => {
  const h = setup(t, { policy: { decisionMs: 5000 } })
  const { a, b, roomId } = await h.battle()
  const first = await h.read(a, roomId), second = await h.read(b, roomId)
  await h.choose(a, first)
  h.advance(4500)
  assert.equal((await h.service.session(b)).room.deadlineAt, second.deadlineAt)
  h.advance(500)
  const rejected = await h.choose(b, second)
  assert.equal(rejected.ack.code, 'MATCH_FINISHED')
  assert.deepEqual(rejected.view.result, { kind: 'win', winnerSeat: 'p1', reason: 'timeout' })
  assert.equal(rejected.deadlineAt, null)
  assert.equal((await h.read(a, roomId)).room.status, 'ended')
  assert.equal((await h.act(b, 'create')).room.status, 'lobby')
})

test('equal pending deadlines produce no contest; delayed sweep honors earliest unequal deadline', async t => {
  const h = setup(t, { policy: { decisionMs: 1000 } })
  const first = await h.battle()
  h.advance(1000)
  const ended = await h.read(first.a, first.roomId)
  assert.deepEqual(ended.view.result, { kind: 'no-contest', reason: 'timeout' })
  const second = await h.battle()
  // A host clock fixture represents decisions required at different times.
  await h.store.transact('clock-fixture', tx => {
    const room = structuredClone(tx.get('rooms', second.roomId))
    room.match.clocks.p2.deadlineAt -= 1
    tx.put('rooms', room.id, room)
  })
  h.advance(5000)
  assert.deepEqual((await h.read(second.a, second.roomId)).view.result, { kind: 'win', winnerSeat: 'p1', reason: 'timeout' })
})

test('presence is informational, same-guest contacts preserve it, and active polls do not reset decisions', async t => {
  const h = setup(t, { policy: { presenceMs: 100, decisionMs: 1000 } })
  const { a, b, roomId } = await h.battle()
  const initial = await h.read(a, roomId)
  h.advance(101)
  const absent = await h.read(a, roomId)
  assert.equal(absent.room.opponent.connected, false)
  assert.equal(absent.room.status, 'active')
  assert.equal(absent.deadlineAt, initial.deadlineAt)
  await h.service.session(b)
  const present = await h.read(a, roomId)
  assert.equal(present.room.opponent.connected, true)
  assert(present.revision > absent.revision)
})

test('lobby polling never extends expiry; retired create and leave receipts cannot resurrect rooms', async t => {
  const h = setup(t, { policy: { lobbyTtlMs: 100, terminalTtlMs: 100 } })
  const a = await h.guest('A')
  const body = { operationId: 'initial-create' }
  const room = await h.service.execute(a, 'create', body)
  h.advance(90)
  assert.equal((await h.read(a, room.room.id)).room.expiresAt, room.room.expiresAt)
  h.advance(111)
  const retried = await h.service.execute(a, 'create', body)
  assert.equal(retried.expired, true)
  assert.deepEqual(retried.ack, room.ack)
  assert.equal(await h.store.transact('inspect', tx => tx.size('rooms')), 0)
  const fresh = await h.act(a, 'create')
  const leaving = { operationId: 'leave', roomId: fresh.room.id }
  const left = await h.service.execute(a, 'leave', leaving)
  assert.equal((await h.service.execute(a, 'leave', leaving)).left, true)
  assert.deepEqual((await h.service.execute(a, 'leave', leaving)).ack, left.ack)
  assert.equal((await h.service.session(a)).room, null)
})

test('operation caps preserve admitted retries and always allow leaving or forfeiting', async t => {
  const h = setup(t, { policy: { maxGuestOperations: 1, maxRoomReceipts: 2 } })
  const { a, b, roomId, created } = await h.lobby()
  await h.setReady(a, roomId)
  const match = await h.setReady(b, roomId)
  const ended = await h.act(a, 'forfeit', { roomId, matchId: match.matchId })
  assert.equal(ended.room.status, 'ended')
  const retried = await h.service.execute(a, 'create', { operationId: created.ack.operationId })
  assert.deepEqual(retried.ack, created.ack)
  assert((await h.act(a, 'leave', { roomId })).left)
  await assert.rejects(h.act(a, 'create'), { code: 'OPERATION_LIMIT' })
})

test('candidate export failure preserves checkpoint and receipts; repeated failure interrupts without fabrication', async t => {
  const base = createEngineFactory()
  let broken = false
  const h = setup(t, { engineFactory: { ...base, restore(record) {
    const engine = base.restore(record)
    return { ...engine, exportCheckpoint() { if (broken) throw new Error('forced export failure'); return engine.exportCheckpoint() } }
  } } })
  const { a, b, roomId } = await h.battle()
  const before = await h.read(a, roomId)
  const original = await h.store.transact('inspect', tx => tx.get('rooms', roomId).match.checkpoint)
  broken = true
  const body = h.choiceBody(before, 'pending-failure')
  await assert.rejects(h.service.execute(a, 'choice', body), { code: 'BATTLE_UNAVAILABLE' })
  assert.equal(await h.store.transact('inspect', tx => tx.get('rooms', roomId).match.checkpoint), original)
  const interrupted = await h.service.execute(a, 'choice', body)
  assert.equal(interrupted.room.status, 'interrupted')
  assert.equal(interrupted.view.result, null)
  assert.equal(interrupted.deadlineAt, null)
  assert.equal((await h.read(b, roomId)).room.status, 'interrupted')
  assert.equal(await h.store.transact('inspect', tx => tx.get('rooms', roomId).match.checkpoint), original)
  assert.equal((await h.act(a, 'create')).room.status, 'lobby')
})

test('repository commit failure rolls back admitted choice and allows its original retry', async t => {
  let reject = false
  const store = createMemoryRoomStore({ beforeCommit() { if (reject) throw new Error('storage failure') } })
  const h = setup(t, { roomStore: store })
  const { a, roomId } = await h.battle()
  const current = await h.read(a, roomId)
  const body = h.choiceBody(current, 'uncertain-command')
  const before = await store.transact('inspect', tx => tx.get('rooms', roomId).match.checkpoint)
  reject = true
  await assert.rejects(h.service.execute(a, 'choice', body), { code: 'ROOM_UNAVAILABLE' })
  reject = false
  assert.equal(await store.transact('inspect', tx => tx.get('rooms', roomId).match.checkpoint), before)
  const retried = await h.service.execute(a, 'choice', body)
  assert.equal(retried.ack.accepted, true)
  assert.equal(retried.view.decision.kind, 'wait')
})

test('failed start retains prior lobby readiness and can be retried once capacity returns', async t => {
  const base = createEngineFactory()
  let reject = true
  const h = setup(t, { engineFactory: { ...base, create(value) { if (reject) throw new Error('start failed'); return base.create(value) } } })
  const { a, b, roomId } = await h.lobby()
  await h.setReady(a, roomId)
  const readyBody = { roomId, operationId: 'retry-start', ready: true, selectionRevision: 0, membershipEpoch: 2 }
  await assert.rejects(h.service.execute(b, 'ready', readyBody), { code: 'ROOM_UNAVAILABLE' })
  const unchanged = await h.read(b, roomId)
  assert.equal(unchanged.room.status, 'lobby')
  assert.equal(unchanged.room.own.ready, false)
  assert.equal(unchanged.room.opponent.ready, true)
  reject = false
  assert.equal((await h.service.execute(b, 'ready', readyBody)).room.status, 'active')
})

test('active match capacity rejects a start atomically and permits its retry after another match ends', async t => {
  const h = setup(t, { policy: { maxActiveMatches: 1 } })
  const first = await h.battle()
  const second = await h.lobby()
  await h.setReady(second.a, second.roomId)
  const body = { roomId: second.roomId, operationId: 'capacity-start', ready: true, selectionRevision: 0, membershipEpoch: 2 }
  await assert.rejects(h.service.execute(second.b, 'ready', body), { code: 'BATTLE_CAPACITY' })
  const waiting = await h.read(second.b, second.roomId)
  assert.equal(waiting.room.own.ready, false)
  assert.equal(waiting.room.opponent.ready, true)
  await h.act(first.a, 'forfeit', { roomId: first.roomId, matchId: first.started.matchId })
  assert.equal((await h.service.execute(second.b, 'ready', body)).room.status, 'active')
})

test('bounded delivery explicitly synchronizes instead of splitting old move groups', async t => {
  const h = setup(t, { policy: { maxDeliveryEvents: 1 } })
  const { a, roomId } = await h.battle()
  const snapshot = await h.read(a, roomId, { afterCursor: 0 })
  assert.equal(snapshot.mode, 'sync')
  assert.deepEqual(snapshot.events, [])
  assert(snapshot.view.cursor > 0)
  const future = await h.read(a, roomId, { afterCursor: snapshot.view.cursor + 1 })
  assert.equal(future.mode, 'sync')
})

test('service validation rejects unknown fields and getters without running caller code', async t => {
  const h = setup(t)
  const a = await h.guest('A')
  await assert.rejects(h.act(a, 'create', { seat: 'p2' }), { code: 'INVALID_OPERATION' })
  let read = false
  await assert.rejects(h.service.execute(a, 'create', { get operationId() { read = true; return 'bad' } }), { code: 'INVALID_OPERATION' })
  assert.equal(read, false)
  await assert.rejects(h.service.guest({ name: 'bad\nname' }), { code: 'INVALID_NAME' })
  await assert.rejects(h.service.authenticate('fake'), error => error instanceof RoomError && error.status === 401)
  assert.throws(() => createRoomService({ engineFactory: createEngineFactory({ profileId: 'gen3regionalleaguev1' }) }), /Open Singles/)
})

test('two independent humans complete a real battle, forced switches and both projections stay consistent', async t => {
  const h = setup(t)
  const { a, b, roomId } = await h.battle()
  let forcedSwitches = 0
  for (let index = 0; index < 180; index++) {
    const states = await Promise.all([h.read(a, roomId), h.read(b, roomId)])
    if (states[0].view.result) {
      assert.deepEqual(states[0].view.result, states[1].view.result)
      assert.equal(states[0].room.status, 'ended')
      assert(forcedSwitches > 0)
      return
    }
    for (const [seatIndex, guestId] of [a, b].entries()) {
      const state = states[seatIndex]
      if (!['move', 'switch'].includes(state.view.decision.kind)) continue
      if (state.view.decision.kind === 'switch') forcedSwitches++
      assert.equal((await h.choose(guestId, state)).ack.accepted, true)
    }
  }
  assert.fail('Expected battle completion within the bounded fixture')
})
