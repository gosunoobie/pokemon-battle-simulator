import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
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
  const requestOrigin = options?.serviceOptions?.publicOrigin ? new URL(options.serviceOptions.publicOrigin).origin : origin
  let cookie
  let matchId = null
  const call = async (path, { method = 'GET', body, headers = {}, useCookie = true, useOrigin = true } = {}) => {
    const response = await fetch(`${origin}/api/simulation${path}`, {
      method,
      headers: {
        ...(useOrigin ? { Origin: requestOrigin } : {}), ...(useCookie && cookie ? { Cookie: cookie } : {}),
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
const createLeague = (api, regionId = 'kanto', presetId = 'kanto', leadIndex = 0) => api.call('/match', {
  method: 'POST', body: { regionId, presetId, leadIndex, expectedMatchId: api.matchId() },
})
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

test('HTTP league config exposes three regions and trainer identities without private NPC rosters', async t => {
  const api = await start(t)
  const response = await api.call('/config')
  assert.equal(response.status, 200)
  assert.equal(response.data.leagueProfile.id, 'gen3regionalleaguev1')
  assert.equal(response.data.profile.id, 'gen3opensinglesv1')
  assert.deepEqual(response.data.leagues.map(region => region.id), ['kanto', 'johto', 'hoenn'])
  for (const region of response.data.leagues) {
    assert.equal(region.trainers.length, 5)
    assert.deepEqual(region.trainers.map(trainer => trainer.title), ['Elite Four', 'Elite Four', 'Elite Four', 'Elite Four', 'Champion'])
    assert.equal(new Set(region.trainers.map(trainer => trainer.id)).size, 5)
    for (const trainer of region.trainers) {
      assert.deepEqual(Object.keys(trainer).sort(), ['id', 'name', 'specialty', 'title'])
      assert(Object.values(trainer).every(value => typeof value === 'string' && value.length > 0))
    }
  }
  const publicLeagues = JSON.stringify(response.data.leagues)
  for (const privateField of ['team', 'moves', 'evs', 'ivs', 'originalLevels', 'sourceParty', 'seed']) {
    assert(!publicLeagues.includes(`"${privateField}"`), `${privateField} leaked into regional configuration`)
  }
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('HTTP league starts every region with the selected preset lead at level 100 and reconnects to the same run', async t => {
  const api = await start(t)
  const config = (await api.call('/config')).data
  for (const [regionId, presetId, leadIndex, trainerId, species] of [
    ['kanto', 'hoenn', 2, 'lorelei', 'Dewgong'],
    ['johto', 'kanto', 4, 'will', 'Xatu'],
    ['hoenn', 'johto', 1, 'sidney', 'Mightyena'],
  ]) {
    const created = await createLeague(api, regionId, presetId, leadIndex)
    assert.equal(created.status, 200, JSON.stringify(created.data))
    const { run, view, profileId } = created.data
    const preset = config.presets.find(candidate => candidate.id === presetId)
    assert.equal(profileId, 'gen3regionalleaguev1')
    assert.equal(run.regionId, regionId)
    assert.equal(run.presetId, presetId)
    assert.equal(run.opponent.id, trainerId)
    assert.equal(run.stageIndex, 0)
    assert.equal(run.totalStages, 5)
    assert.equal(run.wins, 0)
    assert.equal(run.status, 'active')
    assert.equal(run.nextOpponent, null)
    assert.equal(view.own.team.length, 6)
    assert.equal(view.own.team[0].species, preset.team[leadIndex].species)
    assert.equal(view.own.active, view.own.team[0].memberId)
    assert(preset.team.every(member => member.level === 100))
    assert.equal(view.opponent.known.length, 1)
    assert.equal(view.opponent.known[0].species, species)
    for (const event of created.data.events.filter(event => event.args.opcode === 'switch')) {
      const level = Number(event.args.fields[1].match(/(?:^|, )L(\d+)(?:,|$)/)?.[1] ?? 100)
      assert.equal(level, 100, 'the simulator must start normalized level-100 battlers')
    }
    const cookie = api.cookie()
    assert.deepEqual((await api.call('/match')).data, created.data)
    const response = await api.call('/choice', { method: 'POST', body: {
      matchId: created.data.matchId, commandId: `${regionId}-first-choice`, decisionId: view.decision.id,
      action: { kind: 'move', slot: 1 }, afterCursor: view.cursor,
    } })
    assert.equal(response.status, 200, JSON.stringify(response.data))
    assert.equal(response.data.ack.accepted, true)
    assert.equal(response.data.run.id, run.id)
    assert.equal(response.data.run.stageIndex, 0)
    const reconnected = await api.call(`/match?afterCursor=${response.data.view.cursor}`)
    assert.equal(reconnected.status, 200)
    assert.deepEqual(reconnected.data.run, response.data.run)
    assert.deepEqual(reconnected.data.view, response.data.view)
    assert.deepEqual(reconnected.data.events, [])
    assert.equal(api.cookie(), cookie)
  }
})

test('HTTP league advancement requires a server win and rejects forfeit and legacy single battles', async t => {
  const api = await start(t)
  const created = (await createLeague(api)).data
  const advance = () => api.call('/advance', { method: 'POST', body: { matchId: created.matchId, runId: created.run.id } })
  const early = await advance()
  assert.equal(early.status, 409)
  assert.equal(early.data.error.code, 'ROUND_NOT_WON')
  assert.deepEqual((await api.call('/match')).data, created)
  const forfeited = await api.call('/forfeit', { method: 'POST', body: { matchId: created.matchId } })
  assert.equal(forfeited.status, 200)
  assert.equal(forfeited.data.run.status, 'lost')
  assert.equal(forfeited.data.run.wins, 0)
  assert.equal(forfeited.data.run.nextOpponent, null)
  assert.deepEqual(forfeited.data.view.result, { kind: 'win', winnerSeat: 'p2', reason: 'forfeit' })
  const afterLoss = await advance()
  assert.equal(afterLoss.status, 409)
  assert.equal(afterLoss.data.error.code, 'ROUND_NOT_WON')
  assert.deepEqual((await api.call('/match')).data, forfeited.data)
  const legacy = await create(api)
  assert.equal(legacy.status, 200)
  assert.equal(legacy.data.run, null)
  assert.equal(legacy.data.profileId, 'gen3opensinglesv1')
  const noLeague = await api.call('/advance', { method: 'POST', body: { matchId: legacy.data.matchId, runId: created.run.id } })
  assert.equal(noLeague.status, 409)
  assert.equal(noLeague.data.error.code, 'NO_LEAGUE')
  assert.deepEqual((await api.call('/match')).data, legacy.data)
})

test('HTTP league payloads cannot supply progress, battle results, teams or target trainers', async t => {
  const api = await start(t)
  const initial = (await createLeague(api)).data
  const validStart = { regionId: 'johto', presetId: 'kanto', leadIndex: 0, expectedMatchId: initial.matchId }
  for (const addition of [
    { stageIndex: 4 }, { wins: 5 }, { opponentId: 'lance' }, { playerTeam: [] },
    { run: { status: 'won' } }, { result: { kind: 'win', winnerSeat: 'p1' } },
  ]) {
    const response = await api.call('/match', { method: 'POST', body: { ...validStart, ...addition } })
    assert.equal(response.status, 400)
    assert.equal(response.data.error.code, 'INVALID_MATCH')
    assert.deepEqual((await api.call('/match')).data, initial)
  }
  for (const regionId of ['sinnoh', '', 'Kanto']) {
    const response = await api.call('/match', { method: 'POST', body: { ...validStart, regionId } })
    assert.equal(response.status, 400)
    assert.equal(response.data.error.code, 'INVALID_REGION')
  }
  const ids = { matchId: initial.matchId, runId: initial.run.id }
  for (const body of [
    {}, { matchId: initial.matchId }, { runId: initial.run.id }, { ...ids, runId: null },
    { ...ids, stageIndex: 4 }, { ...ids, wins: 1 }, { ...ids, nextOpponent: 'blue' },
    { ...ids, result: { kind: 'win', winnerSeat: 'p1' } }, { ...ids, view: { result: { kind: 'win', winnerSeat: 'p1' } } },
    { ...ids, playerTeam: [] }, { ...ids, afterCursor: 0 },
  ]) {
    const response = await api.call('/advance', { method: 'POST', body })
    assert.equal(response.status, 400)
    assert.equal(response.data.error.code, 'INVALID_ADVANCE')
    assert.deepEqual((await api.call('/match')).data, initial)
  }
  const query = await api.call('/advance?stageIndex=4', { method: 'POST', body: ids })
  assert.equal(query.status, 400)
  assert.equal(query.data.error.code, 'INVALID_QUERY')
  const anonymous = await api.call('/advance', { method: 'POST', body: ids, useCookie: false })
  assert.equal(anonymous.status, 401)
  assert.equal(anonymous.data.error.code, 'NO_MATCH')
  assert.deepEqual((await api.call('/match')).data, initial)
})

test('HTTP league run identities isolate replacement runs and stale tabs cannot advance them', async t => {
  const api = await start(t)
  const previous = (await createLeague(api)).data
  const cookie = api.cookie()
  const replacement = (await createLeague(api, 'hoenn', 'johto', 3)).data
  assert.notEqual(replacement.matchId, previous.matchId)
  assert.notEqual(replacement.run.id, previous.run.id)
  assert.equal(replacement.run.regionId, 'hoenn')
  assert.equal(replacement.run.presetId, 'johto')
  assert.equal(replacement.run.opponent.id, 'sidney')
  assert.equal(replacement.run.status, 'active')
  assert.equal(replacement.run.stageIndex, 0)
  assert.equal(replacement.run.wins, 0)
  assert.equal(replacement.view.turn, 1)
  assert.equal(api.cookie(), cookie)
  for (const [body, expectedCode] of [
    [{ matchId: previous.matchId, runId: previous.run.id }, 'RUN_CHANGED'],
    [{ matchId: replacement.matchId, runId: previous.run.id }, 'RUN_CHANGED'],
    [{ matchId: replacement.matchId, runId: 'unknown-run' }, 'RUN_CHANGED'],
    [{ matchId: previous.matchId, runId: replacement.run.id }, 'MATCH_CHANGED'],
    [{ matchId: 'unknown-match', runId: replacement.run.id }, 'MATCH_CHANGED'],
  ]) {
    const response = await api.call('/advance', { method: 'POST', body })
    assert.equal(response.status, 409)
    assert.equal(response.data.error.code, expectedCode)
    assert.deepEqual((await api.call('/match')).data, replacement)
    assert.equal(api.cookie(), cookie)
  }
  const outdatedStart = await api.call('/match', { method: 'POST', body: {
    regionId: 'johto', presetId: 'kanto', leadIndex: 0, expectedMatchId: previous.matchId,
  } })
  assert.equal(outdatedStart.status, 409)
  assert.equal(outdatedStart.data.error.code, 'MATCH_CHANGED')
  assert.deepEqual((await api.call('/match')).data, replacement)
  const removed = await api.call('/match', { method: 'DELETE', body: { matchId: replacement.matchId } })
  assert.equal(removed.status, 200)
  const revoked = await api.call('/advance', { method: 'POST', body: { matchId: replacement.matchId, runId: replacement.run.id } })
  assert.equal(revoked.status, 401)
  assert.equal(revoked.data.error.code, 'NO_MATCH')
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

test('configured HTTPS origin supports proxied battles, retries and reconnects with secure session cookies', async t => {
  const publicOrigin = 'https://battle.example'
  const api = await start(t, { serviceOptions: { publicOrigin: `${publicOrigin}/` } })
  assert.notEqual(api.origin, publicOrigin, 'The backend connection must differ from the browser origin')
  assert.equal((await api.call('/config', { useOrigin: false })).status, 200)
  const created = await create(api)
  assert.equal(created.status, 200)
  assert.match(created.headers.get('set-cookie'), /; Secure(?:;|$)/)
  const cookie = api.cookie()
  const initial = created.data
  const command = { matchId: initial.matchId, commandId: 'proxy-retry-1', decisionId: initial.view.decision.id, action: { kind: 'move', slot: 1 }, afterCursor: initial.view.cursor }
  const first = await api.call('/choice', { method: 'POST', body: command, headers: { 'Sec-Fetch-Site': 'same-origin' } })
  assert.equal(first.status, 200)
  assert.equal(first.data.ack.accepted, true)
  assert(first.data.view.cursor > initial.view.cursor)
  assert.match(first.headers.get('set-cookie'), /; Secure(?:;|$)/)
  const retry = await api.call('/choice', { method: 'POST', body: command })
  assert.deepEqual(retry.data, first.data)
  const resumed = await api.call(`/match?afterCursor=${first.data.view.cursor}`, { headers: { 'Sec-Fetch-Site': 'none' } })
  assert.equal(resumed.status, 200)
  assert.deepEqual(resumed.data.view, first.data.view)
  assert.deepEqual(resumed.data.events, [])
  assert.equal(api.cookie(), cookie)
  assert.match(resumed.headers.get('set-cookie'), /; Secure(?:;|$)/)
  const deleted = await api.call('/match', { method: 'DELETE', body: { matchId: initial.matchId } })
  assert.equal(deleted.status, 200)
  assert.match(deleted.headers.get('set-cookie'), /Max-Age=0(?:;|$)/)
  assert.match(deleted.headers.get('set-cookie'), /; Secure(?:;|$)/)
  assert.equal((await api.call('/match', { headers: { Cookie: cookie } })).status, 401)
})

test('proxy mode rejects foreign origins and forwarded-header spoofing before changing a battle', async t => {
  const publicOrigin = 'https://battle.example'
  const api = await start(t, { serviceOptions: { publicOrigin } })
  const initial = (await create(api)).data
  const cookie = api.cookie()
  const command = { matchId: initial.matchId, commandId: 'proxy-rejected', decisionId: initial.view.decision.id, action: { kind: 'move', slot: 1 }, afterCursor: initial.view.cursor }
  const spoofed = {
    Forwarded: 'for=127.0.0.1;host=battle.example;proto=https',
    'X-Forwarded-Host': 'battle.example',
    'X-Forwarded-Proto': 'https',
    'X-Forwarded-Port': '443',
  }
  const rejectedRequests = [
    { useOrigin: false },
    { headers: { Origin: 'null' } },
    { headers: { Origin: 'https://other.example' } },
    { headers: { Origin: api.origin } },
    { headers: { Origin: 'http://battle.example' } },
    { headers: { Origin: `${publicOrigin}:444` } },
    { headers: { Origin: `${publicOrigin}/` } },
    { headers: { 'Sec-Fetch-Site': 'cross-site' } },
    { headers: { 'Sec-Fetch-Site': 'same-site' } },
    { headers: { Origin: 'https://other.example', ...spoofed } },
    { useOrigin: false, headers: spoofed },
  ]
  for (const request of rejectedRequests) {
    const rejected = await api.call('/choice', { method: 'POST', body: command, ...request })
    assert.equal(rejected.status, 403, JSON.stringify(request))
    assert.equal(rejected.data.error.code, 'ORIGIN_REJECTED')
    assert.equal(rejected.headers.get('set-cookie'), null)
    assert.equal(api.cookie(), cookie)
    assert.deepEqual((await api.call('/match')).data, initial)
  }
  const accepted = await api.call('/choice', { method: 'POST', body: command, headers: {
    Forwarded: 'host=attacker.example;proto=http',
    'X-Forwarded-Host': 'attacker.example',
    'X-Forwarded-Proto': 'http',
  } })
  assert.equal(accepted.status, 200, 'Forwarded headers must not override the explicitly configured origin')
  assert.equal(accepted.data.ack.accepted, true, 'Rejected commands must not consume their command identity')
  assert.match(accepted.headers.get('set-cookie'), /; Secure(?:;|$)/)
})

test('HTTP local development and configured HTTP origins do not force Secure cookies', async t => {
  for (const publicOrigin of [undefined, 'http://localhost:5173/']) {
    const api = await start(t, { serviceOptions: { publicOrigin } })
    const created = await create(api)
    assert.equal(created.status, 200)
    assert.doesNotMatch(created.headers.get('set-cookie'), /; Secure(?:;|$)/)
    const refreshed = await api.call('/match')
    assert.doesNotMatch(refreshed.headers.get('set-cookie'), /; Secure(?:;|$)/)
    const deleted = await api.call('/match', { method: 'DELETE', body: { matchId: created.data.matchId } })
    assert.equal(deleted.status, 200)
    assert.doesNotMatch(deleted.headers.get('set-cookie'), /; Secure(?:;|$)/)
  }
})

test('public origin configuration rejects malformed or non-origin values at startup', () => {
  for (const publicOrigin of [
    '', ' ', 'null', '*', 'battle.example', '//battle.example',
    'ftp://battle.example', 'https://*.example', 'https://user:password@battle.example',
    'https://battle.example/path', 'https://battle.example//',
    'https://battle.example?token=x', 'https://battle.example#fragment',
    ' https://battle.example', 'https://battle.example ', 'https://battle. example',
    'https://battle.example\n',
  ]) {
    assert.throws(() => createSimulationHttpServer({ serviceOptions: { publicOrigin } }), undefined, JSON.stringify(publicOrigin))
  }
})

test('standalone startup reads PUBLIC_ORIGIN for HTTPS frontend requests', { timeout: 20_000 }, async t => {
  const publicOrigin = 'https://deployed-battle.example'
  const child = spawn(process.execPath, ['apps/server/start.mjs'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', PUBLIC_ORIGIN: publicOrigin },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const exited = once(child, 'exit')
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return
    const force = setTimeout(() => child.kill('SIGKILL'), 1000)
    try { child.kill('SIGTERM'); await exited } finally { clearTimeout(force) }
  })
  let output = ''
  let errors = ''
  child.stderr.setEncoding('utf8').on('data', chunk => { errors += chunk })
  const backendOrigin = await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error(`Server startup timed out: ${errors}`)), 10_000)
    const finish = (error, value) => {
      clearTimeout(deadline)
      child.stdout.off('data', onData)
      child.off('error', onError)
      child.off('exit', onExit)
      if (error) reject(error)
      else resolve(value)
    }
    const onData = chunk => {
      output += chunk
      const address = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]
      if (address) finish(null, address)
    }
    const onError = error => finish(error)
    const onExit = code => finish(new Error(`Server exited ${code}: ${errors}`))
    child.stdout.setEncoding('utf8').on('data', onData)
    child.once('error', onError)
    child.once('exit', onExit)
  })
  const created = await fetch(`${backendOrigin}/api/simulation/match`, {
    method: 'POST', headers: { Origin: publicOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ presetId: 'kanto', leadIndex: 0, expectedMatchId: null }),
  })
  assert.equal(created.status, 200, await created.text())
  assert.match(created.headers.get('set-cookie'), /; Secure(?:;|$)/)
  const foreign = await fetch(`${backendOrigin}/api/simulation/config`, { headers: { Origin: backendOrigin } })
  assert.equal(foreign.status, 403)
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
