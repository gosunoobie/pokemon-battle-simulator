import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSimulationHttpServer } from '../apps/server/start.mjs'

async function start(t, options) {
  const server = createSimulationHttpServer(options)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
  const origin = `http://127.0.0.1:${server.address().port}`
  let cookie
  let matchId = null
  const call = async (path, { method = 'GET', body, headers = {}, useCookie = true, useOrigin = true } = {}) => {
    const response = await fetch(`${origin}/api/simulation${path}`, {
      method,
      headers: {
        ...(useOrigin ? { Origin: origin } : {}), ...(useCookie && cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers,
      },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie && useCookie) cookie = setCookie.split(';')[0]
    const data = await response.json()
    if (useCookie && !headers.Cookie) {
      if (response.status === 200 && data.matchId) matchId = data.matchId
      else if (data.cleared || data.error?.code === 'NO_MATCH') matchId = null
    }
    return { status: response.status, data, headers: response.headers }
  }
  return { call, origin, cookie: () => cookie, matchId: () => matchId }
}

const create = (api, presetId = 'kanto', leadIndex = 0) => api.call('/match', { method: 'POST', body: { presetId, leadIndex, expectedMatchId: api.matchId() } })
function damagingAction(view, moves) {
  const decision = view.decision
  if (decision.kind === 'switch') return { kind: 'switch', memberId: decision.switches[0].memberId }
  const options = decision.moves.filter(move => !move.disabled)
  const move = options.find(option => moves[option.id]?.category !== 'Status') ?? options[0]
  assert(move, 'Player should have an actionable move or forced replacement')
  return { kind: 'move', slot: move.slot }
}

test('HTTP config validates three six-member four-move presets and starts each selected lead', async t => {
  const api = await start(t)
  const config = await api.call('/config')
  assert.equal(config.status, 200)
  assert.equal(config.data.presets.length, 3)
  assert.equal(Object.keys(config.data.moves).length, 354)
  assert.equal(config.data.profile.id, 'gen3opensinglesv1')
  assert.equal(config.headers.get('cache-control'), 'no-store')
  for (const preset of config.data.presets) {
    assert.equal(preset.team.length, 6)
    assert(preset.team.every(member => member.moves.length === 4 && member.level === 100 && member.item))
    const started = await create(api, preset.id, 4)
    assert.equal(started.status, 200)
    assert.equal(started.data.view.own.team[0].species, preset.team[4].species)
    assert.equal(started.data.view.own.team.length, 6)
    assert.equal(started.data.view.opponent.known.length, 1)
    assert.equal(started.data.view.decision.kind, 'move')
    assert.match(started.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  }
})

test('HTTP session reload, choices and exact retries preserve private ownership and event cursors', async t => {
  const api = await start(t)
  const created = await create(api)
  assert.equal(created.status, 200)
  const initial = created.data
  const reloaded = await api.call('/match')
  assert.deepEqual(reloaded.data, initial)
  const command = { matchId: initial.matchId, commandId: 'http-retry-1', decisionId: initial.view.decision.id, action: { kind: 'move', slot: 1 }, afterCursor: initial.view.cursor }
  const first = await api.call('/choice', { method: 'POST', body: command })
  assert.equal(first.status, 200)
  assert.equal(first.data.ack.accepted, true)
  assert(first.data.events.length > 0)
  assert(first.data.events.every(event => event.cursor > initial.view.cursor))
  assert(['move', 'switch', 'finished'].includes(first.data.view.decision.kind))
  const retry = await api.call('/choice', { method: 'POST', body: command })
  assert.deepEqual(retry.data, first.data)
  const changed = await api.call('/choice', { method: 'POST', body: { ...command, action: { kind: 'move', slot: 2 } } })
  assert.equal(changed.data.ack.accepted, false)
  assert.equal(changed.data.ack.code, 'COMMAND_ID_REUSED')
  assert.deepEqual(changed.data.view, first.data.view)
  const upToDate = await api.call(`/match?afterCursor=${first.data.view.cursor}`)
  assert.deepEqual(upToDate.data.events, [])
  const serialized = JSON.stringify(first.data)
  for (const forbidden of ['"seed"', '"checkpoint"', '"inputLog"', '"p2team"', '"initial"', 'p2-1', 'p2-6']) assert(!serialized.includes(forbidden), forbidden)
  assert.equal((await api.call('/match', { useCookie: false })).status, 401)
  assert.equal((await api.call('/match', { headers: { Cookie: 'battle_simulation_v1=0000000000000000000000000000000000000000000000000000000000000000' } })).status, 401)
})

test('HTTP rejects cross-origin, client authority, malformed JSON and oversized requests safely', async t => {
  const api = await start(t)
  assert.equal((await api.call('/match', { method: 'POST', body: { presetId: 'kanto', leadIndex: 0 }, useOrigin: false })).status, 403)
  assert.equal((await api.call('/match', { method: 'POST', body: { presetId: 'kanto', leadIndex: 0 }, headers: { Origin: 'https://other.example' } })).status, 403)
  assert.equal((await api.call('/config', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403)
  assert.equal((await create(api, 'missing')).status, 400)
  assert.equal((await create(api, 'kanto', 6)).status, 400)
  assert.equal((await api.call('/match', { method: 'POST', body: { presetId: 'kanto', leadIndex: 0, seed: [1, 2, 3, 4] } })).status, 400)
  assert.equal((await api.call('/match', { method: 'POST', body: '{broken' })).status, 400)
  assert.equal((await api.call('/match', { method: 'POST', body: 'x'.repeat(4097) })).status, 413)
  assert.equal((await api.call('/match', { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415)
  const initial = (await create(api)).data
  const command = { matchId: initial.matchId, commandId: 'invalid-authority', decisionId: initial.view.decision.id, action: { kind: 'move', slot: 1 } }
  for (const body of [{ ...command, seat: 'p2' }, { ...command, action: { kind: 'switch', memberId: 'p2:2' } }, { ...command, action: { kind: 'move', slot: 5 } }, { ...command, afterCursor: initial.view.cursor + 100 }]) {
    const response = await api.call('/choice', { method: 'POST', body })
    assert.equal(response.status, 400)
    assert.equal(typeof response.data.error.code, 'string')
  }
  assert.deepEqual((await api.call('/match')).data.view, initial.view)
  assert.equal((await api.call('/match?afterCursor=-1')).status, 400)
  assert.equal((await api.call('/match?seat=p2')).status, 400)
  assert.equal((await api.call('/checkpoint')).status, 404)
})

test('HTTP forfeit is terminal, deletion revokes access and replacement reuses its cookie', async t => {
  const api = await start(t)
  const initial = (await create(api)).data
  const cookie = api.cookie()
  const ended = await api.call('/forfeit', { method: 'POST', body: { matchId: initial.matchId, afterCursor: initial.view.cursor } })
  assert.deepEqual(ended.data.view.result, { kind: 'win', winnerSeat: 'p2', reason: 'forfeit' })
  assert.equal(ended.data.view.decision.kind, 'finished')
  assert.equal((await api.call('/forfeit', { method: 'POST', body: { matchId: initial.matchId } })).data.view.cursor, ended.data.view.cursor)
  const next = (await create(api, 'hoenn')).data
  assert.notEqual(next.matchId, initial.matchId)
  assert.equal(api.cookie(), cookie)
  assert.equal((await api.call('/match', { method: 'DELETE', body: { matchId: next.matchId } })).status, 200)
  assert.equal((await api.call('/match')).status, 401)
})

test('stale tabs cannot choose, forfeit, delete or replace a newer match sharing their cookie', async t => {
  const api = await start(t)
  const original = (await create(api)).data
  const originalCookie = api.cookie()
  const replacement = (await create(api, 'johto')).data
  assert.notEqual(replacement.matchId, original.matchId)
  assert.equal(api.cookie(), originalCookie)
  const staleRequests = [
    ['/choice', 'POST', { matchId: original.matchId, commandId: 'stale-tab', decisionId: original.view.decision.id, action: { kind: 'move', slot: 1 }, afterCursor: original.view.cursor }],
    ['/forfeit', 'POST', { matchId: original.matchId }],
    ['/match', 'DELETE', { matchId: original.matchId }],
    ['/match', 'POST', { presetId: 'hoenn', leadIndex: 0, expectedMatchId: original.matchId }],
    ['/match', 'POST', { presetId: 'hoenn', leadIndex: 0, expectedMatchId: null }],
  ]
  for (const [path, method, body] of staleRequests) {
    const rejected = await api.call(path, { method, body })
    assert.equal(rejected.status, 409)
    assert.equal(rejected.data.error.code, 'MATCH_CHANGED')
    assert.equal(api.cookie(), originalCookie)
    assert.deepEqual((await api.call('/match')).data, replacement)
  }
  const missingIdentityRequests = [
    ['/choice', 'POST', { commandId: 'missing-binding', decisionId: replacement.view.decision.id, action: { kind: 'move', slot: 1 } }],
    ['/forfeit', 'POST', {}], ['/match', 'DELETE', {}],
    ['/match', 'POST', { presetId: 'hoenn', leadIndex: 0 }],
  ]
  for (const [path, method, body] of missingIdentityRequests) {
    assert.equal((await api.call(path, { method, body })).status, 400)
    assert.deepEqual((await api.call('/match')).data, replacement)
  }
  assert.equal((await api.call('/forfeit', { method: 'POST', body: { matchId: replacement.matchId } })).data.view.result.reason, 'forfeit')
})

test('HTTP simulated battles reach a terminal result while the automated side replaces fainted members', async t => {
  const api = await start(t, { serviceOptions: { requestsPerMinute: 2000 } })
  const { moves } = (await api.call('/config')).data
  let state = (await create(api, 'hoenn', 2)).data
  let decisions = 0
  while (!state.view.result && decisions < 1100) {
    assert(['move', 'switch'].includes(state.view.decision.kind), 'Server must return the next player decision')
    const response = await api.call('/choice', { method: 'POST', body: {
      matchId: state.matchId, commandId: `play-${++decisions}`, decisionId: state.view.decision.id,
      action: damagingAction(state.view, moves), afterCursor: state.view.cursor,
    } })
    assert.equal(response.status, 200, JSON.stringify(response.data))
    assert.equal(response.data.ack.accepted, true, JSON.stringify(response.data.ack))
    assert.equal(response.data.view.complete, true)
    state = response.data
  }
  assert(state.view.result, `Battle did not complete after ${decisions} player decisions`)
  assert(['win', 'draw'].includes(state.view.result.kind))
  assert(state.view.opponent.known.length > 1, 'Automated forced replacements should reveal additional members')
  assert(state.view.turn <= 500)
})

test('HTTP expired sessions and bounded capacity dispose battles and allow fresh sessions', async t => {
  const api = await start(t, { serviceOptions: { ttlMs: 1000, maxSessions: 1, requestsPerMinute: 1 } })
  assert.equal((await create(api)).status, 200)
  assert.equal((await api.call('/match', { method: 'POST', useCookie: false, body: { presetId: 'johto', leadIndex: 0, expectedMatchId: null } })).status, 503)
  await new Promise(resolve => setTimeout(resolve, 1100))
  assert.equal((await api.call('/match')).status, 401)
  assert.equal((await create(api, 'johto')).status, 200)
  assert.equal((await api.call('/match')).status, 200)
  assert.equal((await api.call('/match')).status, 429)
})

test('standalone HTTP host serves built assets while rejecting traversal, private files and API fallbacks', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'simulation-static-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const dist = join(directory, 'dist')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(dist)
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>Simulation</title>')
  await writeFile(join(dist, 'entry.js'), 'export const ready = true')
  await writeFile(join(directory, 'secret.json'), '{"secret":true}')
  await symlink(join(directory, 'secret.json'), join(dist, 'escape.json'))
  const api = await start(t, { distDirectory: dist })
  const page = await fetch(`${api.origin}/`)
  assert.equal(page.status, 200)
  assert.match(page.headers.get('content-type'), /text\/html/)
  const script = await fetch(`${api.origin}/entry.js`, { method: 'HEAD' })
  assert.equal(script.status, 200)
  assert.equal(await script.text(), '')
  assert.equal((await fetch(`${api.origin}/missing.js`)).status, 404)
  assert.equal((await fetch(`${api.origin}/escape.json`)).status, 403)
  assert.equal((await fetch(`${api.origin}/%2e%2e%2fsecret.json`)).status, 400)
  assert.equal((await fetch(`${api.origin}/api/unknown`, { headers: { Accept: 'text/html' } })).status, 404)
})
