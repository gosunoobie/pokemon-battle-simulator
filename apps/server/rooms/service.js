import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createEngineFactory } from '@battle/battle-engine'
import { createMemoryRoomStore } from './memoryStore.js'
import { roomPolicy } from './policy.js'
import { createRoomCatalog } from './presets.js'

const SEATS = ['p1', 'p2']
const ID = /^[a-zA-Z0-9:_-]{1,128}$/
const TOKEN = /^[a-f0-9]{64}$/
const INVITE = /^[a-f0-9]{32}$/
const clone = value => structuredClone(value)
const digest = value => createHash('sha256').update(value).digest('hex')
const canonical = value => JSON.stringify(sort(value))
const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value
const dataObject = value => value && Object.getPrototypeOf(value) === Object.prototype &&
  Reflect.ownKeys(value).every(key => typeof key === 'string' && Object.getOwnPropertyDescriptor(value, key)?.enumerable && 'value' in Object.getOwnPropertyDescriptor(value, key))
const memberSeat = (room, guestId) => SEATS.find(seat => room.members[seat]?.guestId === guestId)
const terminal = room => ['ended', 'interrupted', 'closed'].includes(room.status)
const ready = (member, room) => Boolean(member && member.readySelectionRevision === member.selectionRevision && member.readyMembershipEpoch === room.membershipEpoch)

export class RoomError extends Error {
  constructor(status, code, message) { super(message); this.name = 'RoomError'; this.status = status; this.code = code }
}
class EngineFailure extends Error {
  constructor(room) { super('Room engine failed'); this.roomId = room.id; this.version = room.version }
}
const fail = (status, code, message) => { throw new RoomError(status, code, message) }
const safeError = error => ({ status: error.status, code: error.code, message: error.message })

/** Authoritative guest room domain. The injected asynchronous store is the commit boundary.
 * Engine instances are candidates, restored for one mutation and always disposed.
 */
export function createRoomService(options = {}) {
  const policy = roomPolicy(options.policy)
  const clock = options.clock ?? Date.now
  const store = options.roomStore ?? createMemoryRoomStore()
  const factory = options.engineFactory ?? createEngineFactory()
  if (factory.getProfile().id !== 'gen3opensinglesv1') throw new TypeError('Human rooms require the Open Singles profile')
  const catalog = createRoomCatalog(factory, options.presetCatalog)
  let closed = false
  let cleanup
  const nowValue = () => {
    const now = clock()
    if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('Room clock must return epoch milliseconds')
    return now
  }
  const ensureOpen = () => { if (closed) fail(503, 'SERVICE_CLOSED', 'Private battles are unavailable.') }
  const preset = id => catalog.presets.find(value => value.id === id)

  function requireGuest(tx, id, now, contact = true) {
    const guest = tx.get('guests', id)
    if (!guest || guest.expiresAt <= now) fail(401, 'GUEST_EXPIRED', 'Your guest session expired. Create a new guest to play.')
    if (contact && guest.lastContactAt !== now) {
      const updated = { ...guest, lastContactAt: now }
      tx.put('guests', id, updated)
      return updated
    }
    return guest
  }
  const publicGuest = guest => ({ id: guest.id, name: guest.name, expiresAt: guest.expiresAt })
  function releaseActive(tx, room) {
    for (const member of Object.values(room.members)) if (member && tx.get('active', member.guestId) === room.id) tx.delete('active', member.guestId)
  }
  function deleteRoom(tx, room) {
    releaseActive(tx, room)
    tx.delete('rooms', room.id)
    tx.delete('invites', room.inviteHash)
  }
  function publicRoom(tx, room, seat, now) {
    const own = room.members[seat]
    const opponent = room.members[seat === 'p1' ? 'p2' : 'p1']
    const otherGuest = opponent && tx.get('guests', opponent.guestId)
    const creator = tx.get('guests', room.creatorId)
    const invitation = seat === 'p1' && own?.guestId === room.creatorId && room.status === 'lobby'
      ? creator?.receipts[room.createOperationId]?.ack.inviteToken : undefined
    return {
      id: room.id, status: room.status, seat, membershipEpoch: room.membershipEpoch,
      own: { name: own.name, presetId: own.presetId, leadIndex: own.leadIndex, selectionRevision: own.selectionRevision, ready: ready(own, room) },
      opponent: opponent ? { name: opponent.name, ready: ready(opponent, room), connected: Boolean(otherGuest && otherGuest.expiresAt > now && now - otherGuest.lastContactAt < policy.presenceMs) } : null,
      ...(invitation ? { inviteToken: invitation } : {}),
      expiresAt: room.status === 'active' ? null : room.expiresAt,
      ...(room.status === 'interrupted' ? { interruption: { reason: 'infrastructure', endedAt: room.endedAt } } : {}),
    }
  }
  function saveRoom(tx, candidate, now, force = true) {
    const room = { ...candidate, revisions: { ...candidate.revisions }, fingerprints: { ...candidate.fingerprints } }
    let changed = false
    for (const seat of SEATS) {
      if (!room.members[seat]) continue
      const fingerprint = digest(canonical({
        room: publicRoom(tx, room, seat, now), view: room.match?.views[seat] ?? null,
        deadlineAt: room.match?.clocks[seat]?.deadlineAt ?? null,
      }))
      if (room.fingerprints[seat] !== fingerprint) { room.fingerprints[seat] = fingerprint; room.revisions[seat]++; changed = true }
    }
    if (force || changed) { room.version++; tx.put('rooms', room.id, room) }
    return force || changed ? room : candidate
  }
  function syncEngine(tx, room, engine, now) {
    const previous = room.match
    const checkpoint = engine.exportCheckpoint()
    const views = Object.fromEntries(SEATS.map(seat => [seat, engine.getPlayerView(seat)]))
    if (SEATS.some(seat => !views[seat].complete)) throw new Error('Incomplete room projection')
    const batches = clone(previous?.batches ?? { p1: [], p2: [] })
    const clocks = {}
    for (const seat of SEATS) {
      const fromCursor = previous?.views[seat]?.cursor ?? 0
      const events = engine.getEvents(seat, fromCursor)
      if (events.length) batches[seat].push({ fromCursor, toCursor: views[seat].cursor, events })
      while (batches[seat].length && (batches[seat].reduce((total, batch) => total + batch.events.length, 0) > policy.maxDeliveryEvents || Buffer.byteLength(JSON.stringify(batches[seat])) > policy.maxEventBytes)) batches[seat].shift()
      const decision = views[seat].decision
      clocks[seat] = ['move', 'switch'].includes(decision.kind)
        ? previous?.clocks[seat]?.decisionId === decision.id ? previous.clocks[seat] : { decisionId: decision.id, requiredSince: now, deadlineAt: now + policy.decisionMs }
        : null
    }
    room.match = { ...previous, id: views.p1.matchId, identity: engine.getIdentity(), checkpoint, views, batches, clocks, result: views.p1.result }
    room.failureCount = 0
    if (views.p1.result) {
      room.status = 'ended'; room.endedAt = now; room.expiresAt = now + policy.terminalTtlMs
      releaseActive(tx, room)
    }
  }
  function withEngine(tx, room, now, mutation) {
    let engine
    try {
      engine = factory.restore(room.match.checkpoint)
      const result = mutation(engine)
      syncEngine(tx, room, engine, now)
      return result
    } catch { throw new EngineFailure(room) }
    finally { engine?.dispose() }
  }
  function settleRoom(tx, stored, now) {
    if (terminal(stored) && stored.expiresAt <= now) { deleteRoom(tx, stored); return null }
    if (stored.status === 'lobby' && stored.expiresAt <= now) {
      const room = { ...stored, status: 'closed', endedAt: stored.expiresAt, expiresAt: stored.expiresAt + policy.terminalTtlMs }
      releaseActive(tx, room)
      if (room.expiresAt <= now) { deleteRoom(tx, room); return null }
      return saveRoom(tx, room, now)
    }
    if (stored.status === 'active') {
      const due = SEATS.filter(seat => stored.match.clocks[seat]?.deadlineAt <= now)
        .sort((a, b) => stored.match.clocks[a].deadlineAt - stored.match.clocks[b].deadlineAt)
      if (due.length) {
        const room = clone(stored)
        withEngine(tx, room, now, engine => {
          const current = due.filter(seat => {
            const decision = engine.getDecision(seat)
            return ['move', 'switch'].includes(decision.kind) && decision.id === room.match.clocks[seat].decisionId
          })
          if (!current.length) return
          const simultaneous = current.length === 2 && room.match.clocks[current[0]].deadlineAt === room.match.clocks[current[1]].deadlineAt
          engine.adjudicate(simultaneous ? { kind: 'no-contest', reason: 'timeout' } : { kind: 'forfeit', seat: current[0], reason: 'timeout' })
        })
        return saveRoom(tx, room, now)
      }
    }
    return stored
  }
  function prune(tx, now) {
    for (const guest of tx.values('guests')) if (guest.expiresAt <= now) {
      tx.delete('guests', guest.id); tx.delete('tokens', guest.tokenHash)
    }
    for (const room of tx.values('rooms')) {
      if (terminal(room) && room.expiresAt <= now) deleteRoom(tx, room)
      else if (room.status === 'lobby' && room.expiresAt <= now) settleRoom(tx, room, now)
    }
  }
  function response(tx, stored, guestId, now, delivery = {}, ack) {
    const seat = memberSeat(stored, guestId)
    if (!seat) fail(403, 'NOT_A_MEMBER', 'You do not own a seat in this room.')
    const room = saveRoom(tx, stored, now, false)
    const view = room.match?.views[seat] ?? null
    const afterCursor = delivery.afterCursor ?? 0
    const batches = room.match?.batches[seat] ?? []
    const boundaries = new Set([view?.cursor ?? 0, ...batches.flatMap(batch => [batch.fromCursor, batch.toCursor])])
    const needsSync = delivery.sync === true || delivery.afterRevision > room.revisions[seat] || Boolean(delivery.matchId && delivery.matchId !== room.match?.id) || afterCursor > (view?.cursor ?? 0) || !boundaries.has(afterCursor)
    const unchanged = !ack && !needsSync && delivery.afterRevision === room.revisions[seat] && afterCursor === (view?.cursor ?? 0)
    const mode = needsSync ? 'sync' : unchanged ? 'unchanged' : 'changes'
    return {
      protocolVersion: 1, room: publicRoom(tx, room, seat, now), matchId: room.match?.id ?? null,
      revision: room.revisions[seat], fromCursor: afterCursor,
      ...(unchanged ? {} : { view: view ?? null, events: needsSync ? [] : batches.flatMap(batch => batch.events).filter(event => event.cursor > afterCursor) }),
      mode, ...(ack ? { ack } : {}), deadlineAt: room.match?.clocks[seat]?.deadlineAt ?? null, serverNow: now,
    }
  }
  function acknowledged(tx, receipt, guestId, now, delivery) {
    const stored = tx.get('rooms', receipt.roomId)
    const room = stored && settleRoom(tx, stored, now)
    if (!room) return { protocolVersion: 1, roomId: receipt.roomId, expired: true, ack: receipt.ack, serverNow: now }
    if (receipt.left || !memberSeat(room, guestId)) return { protocolVersion: 1, roomId: room.id, left: true, ack: receipt.ack, serverNow: now }
    return response(tx, room, guestId, now, delivery, receipt.ack)
  }
  function validateDelivery(value) {
    for (const key of ['afterCursor', 'afterRevision']) if (value[key] !== undefined && (!Number.isSafeInteger(value[key]) || value[key] < 0)) fail(400, 'INVALID_CURSOR', 'Use nonnegative integer delivery cursors.')
    if (value.sync !== undefined && typeof value.sync !== 'boolean') fail(400, 'INVALID_SYNC', 'Use a boolean synchronization flag.')
    if (value.matchId !== undefined && (typeof value.matchId !== 'string' || !ID.test(value.matchId))) fail(400, 'INVALID_MATCH', 'Use a valid match identity.')
  }
  function validateOperation(operation, input) {
    const fields = {
      create: ['presetId', 'leadIndex'], join: ['inviteToken'],
      selection: ['roomId', 'presetId', 'leadIndex', 'selectionRevision'],
      ready: ['roomId', 'ready', 'selectionRevision', 'membershipEpoch'],
      choice: ['roomId', 'commandId', 'decisionId', 'action', 'matchId'],
      forfeit: ['roomId', 'matchId'], leave: ['roomId'],
    }
    if (!Object.hasOwn(fields, operation) || !dataObject(input) || Object.keys(input).some(key => ![...fields[operation], 'operationId', 'afterCursor', 'afterRevision', 'sync'].includes(key))) fail(400, 'INVALID_OPERATION', 'Invalid private-room operation.')
    validateDelivery(input)
    const operationId = input.operationId ?? (operation === 'choice' ? input.commandId : undefined)
    if (typeof operationId !== 'string' || !ID.test(operationId)) fail(400, 'INVALID_OPERATION_ID', 'Supply a bounded operation identity.')
    if (!['create', 'join'].includes(operation) && (typeof input.roomId !== 'string' || !ID.test(input.roomId))) fail(400, 'INVALID_ROOM', 'Supply a valid room identity.')
    if (['create', 'selection'].includes(operation)) {
      if (operation === 'selection' || input.presetId !== undefined) if (!preset(input.presetId)) fail(400, 'INVALID_PRESET', 'Choose an available preset team.')
      if (operation === 'selection' || input.leadIndex !== undefined) if (!Number.isInteger(input.leadIndex) || input.leadIndex < 0 || input.leadIndex > 5) fail(400, 'INVALID_LEAD', 'Choose one of your six team members.')
    }
    if (['selection', 'ready'].includes(operation) && (!Number.isSafeInteger(input.selectionRevision) || input.selectionRevision < 0)) fail(400, 'INVALID_SELECTION', 'Supply your current selection revision.')
    if (operation === 'ready' && (typeof input.ready !== 'boolean' || !Number.isSafeInteger(input.membershipEpoch) || input.membershipEpoch < 1)) fail(400, 'INVALID_READY', 'Supply readiness and the current membership epoch.')
    if (operation === 'join' && (typeof input.inviteToken !== 'string' || !INVITE.test(input.inviteToken))) fail(400, 'INVALID_INVITATION', 'Use the complete room invitation link.')
    if (['choice', 'forfeit'].includes(operation) && (typeof input.matchId !== 'string' || !ID.test(input.matchId))) fail(400, 'INVALID_MATCH', 'Supply the current match identity.')
    if (operation === 'choice') {
      if (typeof input.commandId !== 'string' || !ID.test(input.commandId) || input.commandId !== operationId || typeof input.decisionId !== 'string' || !/^[a-zA-Z0-9:_-]{1,160}$/.test(input.decisionId) || !dataObject(input.action)) fail(400, 'INVALID_CHOICE', 'Supply a structured current battle decision.')
      const action = input.action
      if (!(action.kind === 'move' && Object.keys(action).every(key => ['kind', 'slot'].includes(key)) && Number.isInteger(action.slot) && action.slot >= 1 && action.slot <= 4) &&
          !(action.kind === 'switch' && Object.keys(action).every(key => ['kind', 'memberId'].includes(key)) && typeof action.memberId === 'string' && /^p[12]:[1-6]$/.test(action.memberId))) fail(400, 'INVALID_ACTION', 'Select an available move or owned team member.')
    }
    const body = clone(input)
    body.operationId = operationId
    const { afterCursor, afterRevision, sync, ...semantic } = body
    return { body, hash: digest(canonical({ operation, ...semantic })) }
  }
  async function interrupted(failure, guestId, delivery) {
    const outcome = await store.transact('failure', tx => {
      const now = nowValue()
      const stored = tx.get('rooms', failure.roomId)
      if (!stored || stored.status !== 'active' || stored.version !== failure.version) return null
      const room = { ...stored, failureCount: (stored.failureCount ?? 0) + 1 }
      if (room.failureCount >= 2) {
        room.status = 'interrupted'; room.endedAt = now; room.expiresAt = now + policy.terminalTtlMs
        room.match = { ...room.match, clocks: { p1: null, p2: null } }
        releaseActive(tx, room)
      }
      const saved = saveRoom(tx, room, now)
      return room.status === 'interrupted' && guestId && memberSeat(room, guestId) ? response(tx, saved, guestId, now, { ...delivery, sync: true }) : null
    })
    if (outcome) return outcome
    fail(503, 'BATTLE_UNAVAILABLE', 'The battle could not continue. Retry to reconnect to its committed state.')
  }
  async function transaction(scope, guestId, delivery, operation) {
    ensureOpen()
    try {
      const result = await store.transact(scope, tx => {
        try { return operation(tx, nowValue()) }
        catch (error) { if (error instanceof RoomError) return { roomError: safeError(error) }; throw error }
      })
      if (result?.roomError) throw new RoomError(result.roomError.status, result.roomError.code, result.roomError.message)
      return result
    } catch (error) {
      if (error instanceof RoomError) throw error
      if (error instanceof EngineFailure) return interrupted(error, guestId, delivery)
      fail(503, 'ROOM_UNAVAILABLE', 'Private battles are temporarily unavailable. Your last committed state was preserved.')
    }
  }

  async function guest({ token, name } = {}) {
    ensureOpen()
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(name))) fail(400, 'INVALID_NAME', 'Use a plain-text name between 1 and 40 characters.')
    return transaction('guests', null, null, (tx, now) => {
      prune(tx, now)
      const existing = typeof token === 'string' && TOKEN.test(token) && tx.get('guests', tx.get('tokens', digest(token)))
      if (existing && existing.expiresAt > now) {
        let resumed = requireGuest(tx, existing.id, now)
        if (name !== undefined && !tx.get('active', resumed.id)) { resumed = { ...resumed, name: name.trim() }; tx.put('guests', resumed.id, resumed) }
        return { token, guest: publicGuest(resumed) }
      }
      if (tx.size('guests') >= policy.maxGuests) fail(503, 'GUEST_CAPACITY', 'Guest capacity is currently full. Please try later.')
      const nextToken = randomBytes(32).toString('hex')
      const id = randomUUID()
      const value = { id, name: name?.trim() ?? `Guest ${id.slice(0, 6)}`, tokenHash: digest(nextToken), createdAt: now, expiresAt: now + policy.guestTtlMs, lastContactAt: now, receipts: {}, operationCount: 0, lastRoomId: null }
      tx.put('guests', id, value); tx.put('tokens', value.tokenHash, id)
      return { token: nextToken, guest: publicGuest(value) }
    })
  }
  async function authenticate(token) {
    if (typeof token !== 'string' || !TOKEN.test(token)) fail(401, 'GUEST_REQUIRED', 'Create a guest session before joining a room.')
    return transaction('guests', null, null, (tx, now) => requireGuest(tx, tx.get('tokens', digest(token)), now).id)
  }
  async function config() { ensureOpen(); return clone({ protocolVersion: 1, ...catalog, policy }) }
  async function session(guestId) {
    return transaction('session', guestId, { sync: true }, (tx, now) => {
      const own = requireGuest(tx, guestId, now)
      const stored = tx.get('rooms', tx.get('active', guestId) ?? own.lastRoomId)
      const room = stored && memberSeat(stored, guestId) && settleRoom(tx, stored, now)
      return { guest: publicGuest(own), room: room ? response(tx, room, guestId, now, { sync: true }) : null }
    })
  }
  async function updates(guestId, roomId, delivery = {}) {
    if (!dataObject(delivery) || Object.keys(delivery).some(key => !['afterRevision', 'afterCursor', 'matchId', 'sync'].includes(key))) fail(400, 'INVALID_QUERY', 'Invalid update query.')
    validateDelivery(delivery)
    if (typeof roomId !== 'string' || !ID.test(roomId)) fail(400, 'INVALID_ROOM', 'Supply a valid room identity.')
    return transaction(roomId, guestId, delivery, (tx, now) => {
      requireGuest(tx, guestId, now)
      const stored = tx.get('rooms', roomId)
      if (!stored) fail(404, 'ROOM_EXPIRED', 'This room expired or the server restarted.')
      if (!memberSeat(stored, guestId)) fail(403, 'NOT_A_MEMBER', 'You do not own a seat in this room.')
      const room = settleRoom(tx, stored, now)
      if (!room) fail(404, 'ROOM_EXPIRED', 'This room is no longer available.')
      return response(tx, room, guestId, now, delivery)
    })
  }
  async function execute(guestId, operation, input = {}) {
    const { body, hash } = validateOperation(operation, input)
    return transaction(body.roomId ?? 'ownership', guestId, body, (tx, now) => {
      let own = requireGuest(tx, guestId, now)
      const tombstone = Object.hasOwn(own.receipts, body.operationId) ? own.receipts[body.operationId] : undefined
      const knownRoomId = body.roomId ?? (operation === 'join' ? tx.get('invites', digest(body.inviteToken)) : undefined)
      const stored = knownRoomId && tx.get('rooms', knownRoomId)
      const existing = tombstone ?? stored?.receipts[`${guestId}:${body.operationId}`]
      if (existing) {
        if (existing.hash !== hash) fail(409, 'OPERATION_ID_REUSED', 'This operation identity already describes a different request.')
        return acknowledged(tx, existing, guestId, now, body)
      }
      prune(tx, now)
      const previousId = tx.get('active', guestId)
      if (previousId) {
        const previous = tx.get('rooms', previousId)
        if (previous) settleRoom(tx, previous, now)
      }
      own = tx.get('guests', guestId)
      const lifecycle = ['create', 'join', 'leave'].includes(operation)
      if (['create', 'join'].includes(operation) && own.operationCount >= policy.maxGuestOperations) fail(429, 'OPERATION_LIMIT', 'This guest reached its room-operation limit. Leaving and existing room retries remain available.')
      let room
      let ack = { operationId: body.operationId, accepted: true }
      let left = false
      if (operation === 'create') {
        if (tx.get('active', guestId)) fail(409, 'ALREADY_IN_ROOM', 'Leave or finish your current room before creating another.')
        if (tx.size('rooms') >= policy.maxRooms) fail(503, 'ROOM_CAPACITY', 'Private rooms are currently full. Please try later.')
        const inviteToken = randomBytes(16).toString('hex')
        room = {
          schemaVersion: 1, id: randomUUID(), creatorId: guestId, createOperationId: body.operationId, inviteHash: digest(inviteToken),
          status: 'lobby', version: 0, membershipEpoch: 1, policyVersion: policy.version, createdAt: now, expiresAt: now + policy.lobbyTtlMs,
          members: { p1: makeMember(own, body), p2: null }, match: null,
          revisions: { p1: 0, p2: 0 }, fingerprints: {}, receipts: {}, failureCount: 0,
        }
        ack = { ...ack, inviteToken }
        tx.put('invites', room.inviteHash, room.id); tx.put('active', guestId, room.id)
      } else {
        const current = knownRoomId && tx.get('rooms', knownRoomId)
        if (!current) fail(404, 'ROOM_EXPIRED', 'This room is unavailable or its invitation expired.')
        room = settleRoom(tx, current, now)
        if (!room) fail(404, 'ROOM_EXPIRED', 'This room is no longer available.')
        room = clone(room)
        let seat = memberSeat(room, guestId)
        if (operation === 'join') {
          if (!seat) {
            if (tx.get('active', guestId)) fail(409, 'ALREADY_IN_ROOM', 'Leave or finish your current room before joining another.')
            if (room.status !== 'lobby') fail(409, 'ROOM_STARTED', 'This invitation no longer accepts players.')
            if (room.members.p2) fail(409, 'ROOM_FULL', 'Both seats in this room are occupied.')
            room.members.p2 = makeMember(own, {}); room.membershipEpoch++
            clearReady(room); room.expiresAt = now + policy.lobbyTtlMs
            tx.put('active', guestId, room.id)
          }
        } else {
          if (!seat) fail(403, 'NOT_A_MEMBER', 'You do not own a seat in this room.')
          if (Object.keys(room.receipts).length >= policy.maxRoomReceipts && !['leave', 'forfeit'].includes(operation)) fail(429, 'OPERATION_LIMIT', 'This room reached its operation limit. You can still forfeit or wait for the deadline.')
          const member = room.members[seat]
          if (['selection', 'ready'].includes(operation)) {
            if (room.status !== 'lobby') fail(409, 'ROOM_STARTED', 'Team selection is locked after the battle starts.')
            if (body.selectionRevision !== member.selectionRevision) fail(409, 'SELECTION_CHANGED', 'Your selected team changed. Refresh before continuing.')
            if (operation === 'selection') {
              if (body.presetId !== member.presetId || body.leadIndex !== member.leadIndex) {
                member.presetId = body.presetId; member.leadIndex = body.leadIndex; member.selectionRevision++
                member.readySelectionRevision = null; member.readyMembershipEpoch = null
                room.expiresAt = now + policy.lobbyTtlMs
              }
            } else {
              if (body.membershipEpoch !== room.membershipEpoch) fail(409, 'MEMBERSHIP_CHANGED', 'The players in this lobby changed. Confirm readiness again.')
              if (body.ready && !room.members.p2) fail(409, 'OPPONENT_REQUIRED', 'Wait for your opponent to join before becoming ready.')
              const changed = ready(member, room) !== body.ready
              member.readySelectionRevision = body.ready ? member.selectionRevision : null
              member.readyMembershipEpoch = body.ready ? room.membershipEpoch : null
              if (changed) room.expiresAt = now + policy.lobbyTtlMs
              if (SEATS.every(value => ready(room.members[value], room))) start(tx, room, now)
            }
          } else if (['choice', 'forfeit'].includes(operation)) {
            if (!room.match || room.match.id !== body.matchId) fail(409, 'MATCH_CHANGED', 'This command belongs to a different battle.')
            if (room.status !== 'active') ack = { ...ack, accepted: false, code: room.status === 'interrupted' ? 'BATTLE_INTERRUPTED' : 'MATCH_FINISHED' }
            else ack = { ...ack, ...withEngine(tx, room, now, engine => operation === 'choice'
              ? engine.submitDecision(seat, { commandId: body.commandId, decisionId: body.decisionId, action: body.action })
              : { accepted: true, result: engine.adjudicate({ kind: 'forfeit', seat, reason: 'forfeit' }) }) }
          } else if (operation === 'leave') {
            if (room.status === 'active') fail(409, 'FORFEIT_REQUIRED', 'Use Forfeit battle to leave an active match.')
            room.members[seat] = null; room.membershipEpoch++; clearReady(room)
            if (tx.get('active', guestId) === room.id) tx.delete('active', guestId)
            if (room.status === 'lobby' && seat === 'p1') {
              room.status = 'closed'; room.endedAt = now; room.expiresAt = now + policy.terminalTtlMs; releaseActive(tx, room)
            } else if (room.status === 'lobby') room.expiresAt = now + policy.lobbyTtlMs
            left = true
          }
        }
      }
      const receipt = { hash, roomId: room.id, ack, left }
      // Invalid arbitrary battle intent does not allocate a receipt or extend clocks.
      if (ack.accepted) {
        if (lifecycle) own = { ...own, operationCount: own.operationCount + (operation === 'leave' ? 0 : 1), receipts: { ...own.receipts, [body.operationId]: receipt } }
        else room.receipts[`${guestId}:${body.operationId}`] = receipt
      }
      own = { ...own, lastRoomId: left ? null : room.id }
      tx.put('guests', guestId, own)
      room = saveRoom(tx, room, now)
      return left ? { protocolVersion: 1, roomId: room.id, left: true, ack, serverNow: now } : response(tx, room, guestId, now, body, ack)
    })
  }
  function makeMember(guest, selection) {
    return { guestId: guest.id, name: guest.name, presetId: selection.presetId ?? catalog.presets[0].id, catalogRevision: catalog.revision, leadIndex: selection.leadIndex ?? 0, selectionRevision: 0, readySelectionRevision: null, readyMembershipEpoch: null }
  }
  function clearReady(room) {
    for (const member of Object.values(room.members)) if (member) { member.readySelectionRevision = null; member.readyMembershipEpoch = null }
  }
  function start(tx, room, now) {
    if (tx.values('rooms').filter(value => value.status === 'active').length >= policy.maxActiveMatches) fail(503, 'BATTLE_CAPACITY', 'Battle capacity is currently full. Please try again shortly.')
    const teams = Object.fromEntries(SEATS.map(seat => {
      const member = room.members[seat]
      const team = clone(preset(member.presetId).team)
      team.unshift(...team.splice(member.leadIndex, 1))
      return [seat, team]
    }))
    let engine
    try {
      engine = factory.create({ matchId: randomUUID(), teams })
      room.status = 'active'; room.match = null
      syncEngine(tx, room, engine, now)
      room.match.teams = teams; room.match.presetRevision = catalog.revision
      room.startedAt = now; room.expiresAt = null
    } finally { engine?.dispose() }
  }
  async function sweep() {
    if (closed) return
    const ids = await store.transact('maintenance', tx => { prune(tx, nowValue()); return tx.values('rooms').filter(room => room.status === 'active').map(room => room.id) })
    for (const id of ids) {
      if (closed) break
      try { await transaction(id, null, null, (tx, now) => { const room = tx.get('rooms', id); if (room) settleRoom(tx, room, now) }) } catch { /* The last committed state remains available; a repeat failure becomes interrupted. */ }
    }
  }
  if (options.autoCleanup !== false) {
    cleanup = setInterval(() => { sweep().catch(() => {}) }, policy.cleanupMs)
    cleanup.unref?.()
  }
  return Object.freeze({ guest, authenticate, config, session, execute, updates,
    async close() { if (closed) return; closed = true; clearInterval(cleanup); await store.close?.() },
  })
}
