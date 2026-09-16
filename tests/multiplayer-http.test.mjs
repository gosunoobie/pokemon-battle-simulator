import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { once } from 'node:events'
import { createMultiplayerService } from '../apps/server/rooms/routes.js'

async function start(t, options = {}) {
  const service = createMultiplayerService({ autoCleanup: false, ...options })
  const server = createServer((req, res) => {
    service.middleware(req, res, () => { res.writeHead(404); res.end('Not found') }).catch(error => { res.destroy(error) })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections() })
    await service.close()
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  const requestOrigin = options.publicOrigin ? new URL(options.publicOrigin).origin : origin
  function browser() {
    let cookie
    const call = async (path, { method = 'GET', body, headers = {}, useOrigin = true, useCookie = true } = {}) => {
      const response = await fetch(`${origin}/api/multiplayer${path}`, {
        method, headers: {
          ...(useOrigin ? { Origin: requestOrigin } : {}),
          ...(useCookie && cookie ? { Cookie: cookie } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers,
        },
        ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
      })
      const setCookie = response.headers.get('set-cookie')
      if (setCookie && useCookie) cookie = setCookie.split(';')[0]
      const data = method === 'HEAD' ? null : await response.json()
      return { status: response.status, data, headers: response.headers }
    }
    return { call, cookie: () => cookie }
  }
  return { browser, origin, service }
}

const post = (api, path, body, options) => api.call(path, { method: 'POST', body, ...options })
const guest = (api, name) => post(api, '/guest', name === undefined ? {} : { name })
const create = (api, operationId = 'create-1', presetId = 'kanto', leadIndex = 0) => post(api, '/rooms', { operationId, presetId, leadIndex })
const poll = (api, roomId, query = '') => api.call(`/rooms/${roomId}/updates${query}`)
const ready = (api, state, operationId) => post(api, `/rooms/${state.room.id}/ready`, {
  operationId, ready: true, selectionRevision: state.room.own.selectionRevision, membershipEpoch: state.room.membershipEpoch,
})

async function pair(t, options) {
  const host = await start(t, options)
  const p1 = host.browser()
  const p2 = host.browser()
  assert.equal((await guest(p1, 'Alice')).status, 200)
  assert.equal((await guest(p2, 'Bob')).status, 200)
  const created = await create(p1)
  assert.equal(created.status, 200, JSON.stringify(created.data))
  const joined = await post(p2, '/rooms/join', { operationId: 'join-1', inviteToken: created.data.room.inviteToken })
  assert.equal(joined.status, 200, JSON.stringify(joined.data))
  const first = (await poll(p1, created.data.room.id)).data
  assert.equal((await ready(p1, first, 'ready-1')).status, 200)
  const started = await ready(p2, joined.data, 'ready-2')
  assert.equal(started.status, 200, JSON.stringify(started.data))
  assert.equal(started.data.room.status, 'active')
  return { ...host, p1, p2, roomId: created.data.room.id, initial1: (await poll(p1, created.data.room.id)).data, initial2: started.data }
}

test('multiplayer HTTP keeps guest credentials out of JSON and resumes the same absolute identity', async t => {
  let now = Date.now()
  const host = await start(t, { clock: () => now, policy: { guestTtlMs: 60_000 } })
  const api = host.browser()
  const config = await api.call('/config', { useOrigin: false })
  assert.equal(config.status, 200)
  assert.equal(config.data.presets.length, 3)
  assert(config.data.moves.flamethrower)
  assert.equal(config.headers.get('cache-control'), 'no-store')
  assert.equal(config.headers.get('set-cookie'), null)
  assert.equal((await api.call('/session')).status, 401)
  const first = await guest(api, 'Alice')
  assert.equal(first.status, 200)
  assert.deepEqual(Object.keys(first.data), ['guest'])
  assert.match(first.headers.get('set-cookie'), /^battle_multiplayer_v1=[a-f0-9]{64}; Path=\/api\/multiplayer; HttpOnly; SameSite=Strict; Max-Age=60$/)
  const savedCookie = api.cookie()
  assert(!JSON.stringify(first.data).includes(savedCookie.split('=')[1]))
  now += 10_000
  const resumed = await guest(api)
  assert.equal(resumed.status, 200)
  assert.deepEqual(resumed.data.guest, first.data.guest)
  assert.equal(api.cookie(), savedCookie)
  assert.match(resumed.headers.get('set-cookie'), /Max-Age=50(?:;|$)/)
  const session = await api.call('/session')
  assert.deepEqual(session.data, { guest: first.data.guest, room: null })
  assert.equal(session.headers.get('set-cookie'), null, 'Polling must not extend the absolute credential lifetime')
  for (const Cookie of [savedCookie.replace('battle_multiplayer_v1', 'battle_simulation_v1'), `${savedCookie}; ${savedCookie}`, 'battle_multiplayer_v1=invalid']) {
    assert.equal((await api.call('/session', { headers: { Cookie } })).status, 401, 'Only one valid multiplayer credential may authenticate')
  }
  const isolated = host.browser()
  assert.equal((await guest(isolated, 'Bob')).status, 200)
  assert.notEqual(isolated.cookie(), savedCookie)
  now += 50_001
  for (const [path, requestOptions] of [
    ['/session', {}], ['/rooms', { method: 'POST', body: { operationId: 'expired-create' } }],
  ]) {
    const expired = await api.call(path, requestOptions)
    assert.equal(expired.status, 401)
    assert.equal(expired.headers.get('set-cookie'), null, 'Gameplay cannot silently create a new guest')
  }
  const replacement = await guest(api)
  assert.equal(replacement.status, 200)
  assert.notEqual(replacement.data.guest.id, first.data.guest.id)
  assert.notEqual(api.cookie(), savedCookie)
})

test('multiplayer HTTP supports the configured Vercel origin and rejects direct-origin and forwarded-header bypasses', async t => {
  const publicOrigin = 'https://battle.example'
  const host = await start(t, { publicOrigin: `${publicOrigin}/` })
  const api = host.browser()
  const initial = await guest(api, 'Proxy player')
  assert.equal(initial.status, 200)
  assert.match(initial.headers.get('set-cookie'), /; Secure(?:;|$)/)
  const originalCookie = api.cookie()
  const spoofed = { Forwarded: 'for=127.0.0.1;host=battle.example;proto=https', 'X-Forwarded-Host': 'battle.example', 'X-Forwarded-Proto': 'https' }
  for (const rejectedOptions of [
    { useOrigin: false }, { headers: { Origin: host.origin } }, { headers: { Origin: 'null' } },
    { headers: { Origin: 'https://other.example' } }, { headers: { Origin: `${publicOrigin}/` } },
    { headers: { 'Sec-Fetch-Site': 'cross-site' } }, { headers: { 'Sec-Fetch-Site': 'same-site' } },
    { headers: { ...spoofed, Origin: 'https://other.example' } }, { useOrigin: false, headers: spoofed },
  ]) {
    const response = await post(api, '/rooms', { operationId: 'bypass-create' }, rejectedOptions)
    assert.equal(response.status, 403, JSON.stringify(rejectedOptions))
    assert.equal(response.data.error.code, 'ORIGIN_REJECTED')
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal(api.cookie(), originalCookie)
  }
  const allowed = await api.call('/session', { headers: { ...spoofed, 'X-Forwarded-Host': 'attacker.example', 'Sec-Fetch-Site': 'same-origin' } })
  assert.equal(allowed.status, 200)
  assert.equal(allowed.data.room, null, 'Rejected creates must not allocate a room')
  assert.equal((await api.call('/session', { headers: { Origin: host.origin } })).status, 403)
})

test('multiplayer HTTP rejects malformed, oversized, unknown, and client-authority inputs without mutating membership', async t => {
  const host = await start(t)
  const api = host.browser()
  assert.equal((await guest(api, 'Validator')).status, 200)
  for (const [path, body, expected, headers] of [
    ['/guest', { token: 'forged' }, 400], ['/rooms', '{broken', 400], ['/rooms', [], 400],
    ['/rooms', '{"__proto__":{"admin":true}}', 400], ['/rooms', '{}', 415, { 'Content-Type': 'text/plain' }],
    ['/rooms', 'x'.repeat(4097), 413], ['/rooms', { operationId: 'extra', seat: 'p2' }, 400],
    ['/rooms', { operationId: 'private', seed: [1, 2, 3, 4] }, 400],
    ['/rooms', { operationId: 'wrong-profile', profileId: 'gen3regionalleaguev1' }, 400],
    ['/rooms', { operationId: 'arbitrary-team', team: [] }, 400],
    ['/rooms?seat=p2', { operationId: 'query' }, 400],
  ]) {
    const response = await post(api, path, body, { headers })
    assert.equal(response.status, expected, JSON.stringify([path, body, response.data]))
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }
  assert.equal((await api.call('/session')).data.room, null)
  const wrongMethod = await api.call('/rooms')
  assert.equal(wrongMethod.status, 405)
  assert.equal(wrongMethod.headers.get('allow'), 'POST')
  assert.equal((await api.call('/config?extra=true')).status, 400)
  assert.equal((await api.call('/checkpoint')).status, 404)
  const created = (await create(api)).data
  for (const query of ['?afterCursor=-1', '?afterRevision=NaN', '?afterRevision=9007199254740992', '?afterCursor=0&afterCursor=1', '?seat=p2', '?sync=maybe', '?matchId=']) {
    assert.equal((await poll(api, created.room.id, query)).status, 400, query)
  }
  const forged = await post(api, `/rooms/${created.room.id}/leave`, { operationId: 'forged-room', roomId: 'other' })
  assert.equal(forged.status, 400)
  assert.equal((await api.call('/session')).data.room.room.id, created.room.id)
})

test('multiplayer HTTP bounds chunked JSON without dropping its error response', async t => {
  const host = await start(t)
  const response = await new Promise((resolve, reject) => {
    const req = request(`${host.origin}/api/multiplayer/guest`, { method: 'POST', headers: { Origin: host.origin, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, res => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { text += chunk })
      res.once('end', () => resolve({ status: res.statusCode, data: JSON.parse(text) }))
    })
    req.once('error', reject)
    req.write('{"name":"')
    req.write('x'.repeat(4096))
    req.end('"}')
  })
  assert.equal(response.status, 413)
  assert.equal(response.data.error.code, 'BODY_TOO_LARGE')
})

test('multiplayer HTTP isolates two seats, hides pending choices and resumes each browser with its own projection', async t => {
  const { p1, p2, roomId, initial1, initial2, browser } = await pair(t)
  assert.notEqual(p1.cookie(), p2.cookie())
  assert.equal(initial1.room.seat, 'p1')
  assert.equal(initial2.room.seat, 'p2')
  assert.equal(initial1.matchId, initial2.matchId)
  assert.equal(initial1.view.own.active, 'p1:1')
  assert.equal(initial2.view.own.active, 'p2:1')
  assert.equal(initial1.view.decision.kind, 'move')
  assert.equal(initial2.view.decision.kind, 'move')
  for (const state of [initial1, initial2]) {
    assert.equal(state.room.inviteToken, undefined)
    assert.equal(state.room.opponent.presetId, undefined)
    assert.equal(state.room.opponent.leadIndex, undefined)
    assert.equal(state.room.opponent.selectionRevision, undefined)
    assert.equal(state.room.opponent.decision, undefined)
    const serialized = JSON.stringify(state)
    for (const forbidden of ['"checkpoint"', '"seed"', '"inputLog"', '"credentialHash"', '"inviteHash"', '"pendingChoices"']) assert(!serialized.includes(forbidden), forbidden)
    assert(!serialized.includes(p1.cookie().split('=')[1]))
    assert(!serialized.includes(p2.cookie().split('=')[1]))
  }
  const anonymous = browser()
  assert.equal((await poll(anonymous, roomId)).status, 401)
  assert.equal((await guest(anonymous, 'Third player')).status, 200)
  const stranger = await poll(anonymous, roomId)
  assert([403, 404].includes(stranger.status), JSON.stringify(stranger.data))
  assert.equal(stranger.data.view, undefined)
  const command = {
    commandId: 'http-p1-choice-1', matchId: initial1.matchId,
    decisionId: initial1.view.decision.id, action: { kind: 'move', slot: 1 }, afterCursor: initial1.view.cursor,
  }
  const firstChoice = await post(p1, `/rooms/${roomId}/choice`, command)
  assert.equal(firstChoice.status, 200, JSON.stringify(firstChoice.data))
  assert.equal(firstChoice.data.view.decision.kind, 'wait')
  assert.equal(firstChoice.data.view.cursor, initial1.view.cursor)
  assert(firstChoice.data.revision > initial1.revision)
  const waiting2 = await poll(p2, roomId, `?afterRevision=${initial2.revision}&afterCursor=${initial2.view.cursor}&matchId=${initial2.matchId}`)
  assert.equal(waiting2.status, 200)
  assert.equal(waiting2.data.revision, initial2.revision, 'A hidden opponent choice cannot advance this viewer revision')
  assert.equal(waiting2.data.mode, 'unchanged')
  assert.equal(waiting2.data.view, undefined)
  const repeated = await post(p1, `/rooms/${roomId}/choice`, command)
  assert.equal(repeated.status, 200)
  assert.deepEqual(repeated.data.ack, firstChoice.data.ack)
  assert.equal(repeated.data.view.cursor, firstChoice.data.view.cursor)
  const secondChoice = await post(p2, `/rooms/${roomId}/choice`, {
    commandId: 'http-p2-choice-1', matchId: initial2.matchId,
    decisionId: initial2.view.decision.id, action: { kind: 'move', slot: 1 }, afterCursor: initial2.view.cursor,
  })
  assert.equal(secondChoice.status, 200, JSON.stringify(secondChoice.data))
  assert(secondChoice.data.view.cursor > initial2.view.cursor)
  assert(secondChoice.data.events.some(event => event.args?.opcode === 'move'))
  for (const [api, seat] of [[p1, 'p1'], [p2, 'p2']]) {
    const resumed = await api.call('/session')
    assert.equal(resumed.status, 200)
    assert.equal(resumed.data.room.room.seat, seat)
    assert.equal(resumed.data.room.matchId, initial1.matchId)
    assert(resumed.data.room.view.cursor > (seat === 'p1' ? initial1.view.cursor : initial2.view.cursor))
    assert.equal(resumed.headers.get('set-cookie'), null)
  }
})

test('multiplayer HTTP rejects seat overrides and stale identities; only the authenticated forfeiting seat loses', async t => {
  const { p1, p2, roomId, initial1, initial2 } = await pair(t)
  const path = `/rooms/${roomId}`
  const base = { commandId: 'authority-choice', matchId: initial2.matchId, decisionId: initial2.view.decision.id, action: { kind: 'move', slot: 1 } }
  for (const body of [{ ...base, seat: 'p1' }, { ...base, actorId: 'source' }, { ...base, state: initial1.view }]) {
    const rejected = await post(p2, `${path}/choice`, body)
    assert.equal(rejected.status, 400, JSON.stringify(rejected.data))
  }
  const foreignSwitch = await post(p2, `${path}/choice`, { ...base, commandId: 'foreign-switch', action: { kind: 'switch', memberId: 'p1:2' } })
  assert.equal(foreignSwitch.status, 200)
  assert.equal(foreignSwitch.data.ack.accepted, false)
  assert.equal(foreignSwitch.data.ack.code, 'ILLEGAL_ACTION')
  const wrongMatch = await post(p2, `${path}/choice`, { ...base, matchId: 'old-match' })
  assert.equal(wrongMatch.status, 409)
  const wrongForfeit = await post(p2, `${path}/forfeit`, { operationId: 'stale-forfeit', matchId: 'old-match' })
  assert.equal(wrongForfeit.status, 409)
  const before = await poll(p2, roomId)
  assert.equal(before.data.view.decision.kind, 'move')
  const leave = await post(p1, `${path}/leave`, { operationId: 'unsafe-delete' })
  assert.equal(leave.status, 409, 'Leaving an active room must require an explicit forfeit')
  const ended = await post(p2, `${path}/forfeit`, { operationId: 'forfeit-p2', matchId: initial2.matchId })
  assert.equal(ended.status, 200, JSON.stringify(ended.data))
  assert.equal(ended.data.room.status, 'ended')
  assert.deepEqual(ended.data.view.result, { kind: 'win', winnerSeat: 'p1', reason: 'forfeit' })
  const observed = await poll(p1, roomId)
  assert.deepEqual(observed.data.view.result, ended.data.view.result)
  const replay = await post(p2, `${path}/forfeit`, { operationId: 'forfeit-p2', matchId: initial2.matchId })
  assert.deepEqual(replay.data.ack, ended.data.ack)
  assert.deepEqual(replay.data.view.result, ended.data.view.result)
})

test('multiplayer HTTP accepts the second player\'s own switch identities without imposing solo p1 assumptions', async t => {
  const { p1, p2, roomId, initial1, initial2 } = await pair(t)
  assert.equal((await post(p1, `/rooms/${roomId}/choice`, {
    commandId: 'before-opponent-switch', matchId: initial1.matchId, decisionId: initial1.view.decision.id,
    action: { kind: 'move', slot: 1 },
  })).status, 200)
  const switched = await post(p2, `/rooms/${roomId}/choice`, {
    commandId: 'own-p2-switch', matchId: initial2.matchId, decisionId: initial2.view.decision.id,
    action: { kind: 'switch', memberId: 'p2:2' }, afterCursor: initial2.view.cursor,
  })
  assert.equal(switched.status, 200, JSON.stringify(switched.data))
  assert.equal(switched.data.ack.accepted, true)
  assert.equal(switched.data.view.own.active, 'p2:2')
  assert(switched.data.events.some(event => event.args?.opcode === 'switch' && event.args.fields[0] === 'p2:2'))
  const observed = (await poll(p1, roomId)).data
  assert.equal(observed.view.opponent.known.find(member => member.active).species, 'Blastoise')
  assert.notEqual(observed.view.opponent.active, 'p2:2', 'Opponent identities remain public reveal identities')
})

test('multiplayer HTTP rate limits guests, public reads and each authenticated principal without trusting forwarded addresses', async t => {
  const host = await start(t, { rateLimits: { read: 1, command: 2, create: 1, guest: 2, publicRead: 1 } })
  const p1 = host.browser()
  const p2 = host.browser()
  assert.equal((await p1.call('/config')).status, 200)
  const publicLimit = await p1.call('/config')
  assert.equal(publicLimit.status, 429)
  assert.equal(publicLimit.headers.get('retry-after'), '60')
  assert.equal((await guest(p1, 'One')).status, 200)
  assert.equal((await guest(p2, 'Two')).status, 200)
  const blockedGuest = await guest(host.browser(), 'Flood')
  assert.equal(blockedGuest.status, 429)
  assert.equal(blockedGuest.headers.get('set-cookie'), null)
  assert.equal((await p1.call('/session')).status, 200)
  assert.equal((await p1.call('/session', { headers: { 'X-Forwarded-For': '192.0.2.5' } })).status, 429)
  assert.equal((await p2.call('/session')).status, 200, 'One guest cannot spend another guest\'s read budget')
  assert.equal((await create(p1)).status, 200)
  const createLimit = await create(p1, 'second-create')
  assert.equal(createLimit.status, 429)
  const commandLimit = await post(p1, '/rooms/join', { operationId: 'third-command', inviteToken: 'invalid' })
  assert.equal(commandLimit.status, 429)
  const globalHost = await start(t, { rateLimits: { global: 1 } })
  const globalApi = globalHost.browser()
  assert.equal((await globalApi.call('/config')).status, 200)
  assert.equal((await guest(globalApi)).status, 429)
})

test('multiplayer HTTP sanitizes unexpected asynchronous failures and closes its owned service', async t => {
  let failing = false
  const host = await start(t, { clock: () => { if (failing) throw new Error('private-checkpoint-secret'); return Date.now() } })
  const api = host.browser()
  failing = true
  const error = await api.call('/config')
  assert.equal(error.status, 503)
  assert.equal(error.data.error.code, 'MULTIPLAYER_UNAVAILABLE')
  assert(!JSON.stringify(error.data).includes('private-checkpoint-secret'))
  assert.equal(error.data.error.stack, undefined)
  failing = false
  await host.service.close()
  const closed = await api.call('/config')
  assert.equal(closed.status, 503)
  assert.equal(closed.data.error.code, 'SERVICE_CLOSED')
})

test('multiplayer HTTP validates public origin settings at construction', () => {
  for (const publicOrigin of ['', '*', 'null', 'battle.example', '//battle.example', 'ftp://battle.example', 'https://*.example', 'https://user:pass@battle.example', 'https://battle.example/path', 'https://battle.example?x=1', 'https://battle.example#fragment', ' https://battle.example', 'https://battle.example\n']) {
    assert.throws(() => createMultiplayerService({ publicOrigin }), undefined, publicOrigin)
  }
})
