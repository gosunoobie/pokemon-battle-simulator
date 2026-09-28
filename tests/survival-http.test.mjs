import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createSimulationHttpServer } from '../apps/server/start.mjs'

async function start(t, serviceOptions = {}) {
  const server = createSimulationHttpServer({ serviceOptions })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
  const origin = `http://127.0.0.1:${server.address().port}`
  function client() {
    let cookie
    return { async call(path, { method = 'GET', body, headers = {}, originHeader = true } = {}) {
      const response = await fetch(`${origin}/api/simulation${path}`, { method,
        headers: { ...(originHeader ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]
      return { status: response.status, headers: response.headers, data: await response.json() }
    } }
  }
  return { client, origin }
}

async function request(api, operationId = 'start-1', existing = null) {
  const owner = await api.call('/owner')
  assert.equal(owner.status, 200)
  return { mode: 'survival', operationId, expectedOwnerId: owner.data.id,
    expectedOwnerRevision: owner.data.revision, expectedRunRevision: existing?.run?.revision ?? null,
    expectedMatchId: existing?.matchId ?? null, presetId: 'kanto', leadIndex: 2 }
}
const post = (api, path, body) => api.call(path, { method: 'POST', body })

test('Survival requires acknowledged owner identity and creates a private six-member run', async t => {
  const host = await start(t), api = host.client()
  const body = await request(api)
  const stranger = host.client()
  assert.equal((await post(stranger, '/match', body)).status, 401)
  const started = await post(api, '/match', body)
  assert.equal(started.status, 200, JSON.stringify(started.data))
  assert.equal(started.data.profileId, 'gen3survivalsinglesv1')
  assert.equal(started.data.run.kind, 'survival')
  assert.equal(started.data.run.roundNumber, 1)
  assert.equal(started.data.run.wins, 0)
  assert.equal(started.data.run.status, 'active')
  assert.equal(started.data.run.roster.length, 6)
  assert(started.data.run.roster.every(member => member.hp === member.maxHp && !member.eliminated))
  assert.equal(started.data.view.own.team[0].species, started.data.run.roster[2].species)
  assert.equal(started.data.view.opponent.known.length, 1)
  assert(!/"(?:seed|checkpoint|opponentTeam|originalTeam)"/.test(JSON.stringify(started.data)))
  assert.deepEqual((await api.call('/match')).data, started.data)
  assert.equal((await stranger.call('/match')).status, 401)
  const policy = (await api.call('/config')).data.survivalProfile
  assert.equal(policy.healingPercent, 25)
  assert.equal(policy.revivePercent, 50)
  assert.equal(policy.rulesVersion, 'gen3-survival-v2')
  assert.equal(started.data.run.rulesVersion, policy.rulesVersion)
  assert.equal(policy.restorePp, true)
  assert.equal(policy.restoreStartingItems, true)
  assert.equal(policy.durable, false)
})

test('lost or concurrent Start responses return one run and changed intent fails', async t => {
  const api = (await start(t)).client(), body = await request(api)
  const [a, b] = await Promise.all([post(api, '/match', body), post(api, '/match', { ...body })])
  assert.equal(a.status, 200, JSON.stringify(a.data))
  assert.equal(b.status, 200, JSON.stringify(b.data))
  assert.deepEqual(a.data, b.data)
  const reordered = Object.fromEntries(Object.entries(body).reverse())
  assert.deepEqual((await post(api, '/match', reordered)).data, a.data)
  const changed = await post(api, '/match', { ...body, leadIndex: 1 })
  assert.equal(changed.status, 409)
  assert.equal(changed.data.error.code, 'OPERATION_CONFLICT')
  const stale = await post(api, '/match', { ...body, operationId: 'different-start' })
  assert.equal(stale.status, 409)
  assert.deepEqual((await api.call('/match')).data, a.data)
})

test('bootstrap and pending-start cancellation never replace an active battle', async t => {
  const api = (await start(t)).client(), body = await request(api)
  const initial = (await post(api, '/match', body)).data
  const owner = (await api.call('/owner')).data
  const canceled = await api.call('/owner', { method: 'DELETE', body: { revision: owner.revision } })
  assert.equal(canceled.status, 200)
  assert.equal(canceled.data.revision, owner.revision + 1)
  assert.deepEqual((await api.call('/match')).data, initial)
  assert.equal((await api.call('/owner', { method: 'DELETE', body: { revision: owner.revision } })).status, 409)
  assert.deepEqual((await post(api, '/match', body)).data, initial, 'accepted Start receipt remains retryable')
  const replacement = await post(api, '/match', { presetId: 'kanto', leadIndex: 0, regionId: 'kanto', expectedMatchId: initial.matchId })
  assert.equal(replacement.status, 409, 'a stale League tab cannot replace a Survival run')
  assert.equal((await api.call('/match', { method: 'DELETE', body: { matchId: initial.matchId } })).status, 409)
  assert.deepEqual((await api.call('/match')).data, initial)
})

test('expired/replaced ownership cannot replay an old first-start intent at revision zero', async t => {
  const host = await start(t), first = host.client(), next = host.client()
  const oldBody = await request(first)
  const nextBody = await request(next)
  assert.equal(nextBody.expectedOwnerRevision, oldBody.expectedOwnerRevision)
  assert.notEqual(nextBody.expectedOwnerId, oldBody.expectedOwnerId)
  const rejected = await post(next, '/match', oldBody)
  assert.equal(rejected.status, 409)
  assert.equal(rejected.data.error.code, 'OWNER_CHANGED')
  assert.equal((await next.call('/match')).status, 401)
})

test('Survival actions drive AI and duplicate choices do not replay a turn', async t => {
  const api = (await start(t)).client()
  const initial = (await post(api, '/match', await request(api))).data
  const decision = initial.view.decision
  const move = decision.moves.find(move => !move.disabled && move.pp > 0)
  const body = { matchId: initial.matchId, commandId: 'move-once', decisionId: decision.id,
    action: { kind: 'move', slot: move.slot }, afterCursor: initial.view.cursor }
  const played = await post(api, '/choice', body)
  assert.equal(played.status, 200, JSON.stringify(played.data))
  assert.equal(played.data.ack.accepted, true)
  assert(played.data.view.turn > initial.view.turn || played.data.view.result || played.data.view.decision.kind === 'switch')
  const retry = await post(api, '/choice', body)
  assert.equal(retry.status, 200, JSON.stringify(retry.data))
  assert.deepEqual(retry.data.view, played.data.view)
  assert.deepEqual(retry.data.run, played.data.run)
  const reload = await api.call(`/match?afterCursor=${played.data.view.cursor}`)
  assert.deepEqual(reload.data.view, played.data.view)
  assert.deepEqual(reload.data.events, [])
})

test('forfeit ends Survival without recovery and old run requests cannot replace a new one', async t => {
  const api = (await start(t)).client(), body = await request(api)
  const initial = (await post(api, '/match', body)).data
  const ended = await post(api, '/forfeit', { matchId: initial.matchId, afterCursor: initial.view.cursor })
  assert.equal(ended.status, 200, JSON.stringify(ended.data))
  assert.equal(ended.data.run.status, 'ended')
  assert.equal(ended.data.run.wins, 0)
  assert.equal(ended.data.view.result.winnerSeat, 'p2')
  const advance = { runId: ended.data.run.id, matchId: ended.data.matchId, revision: ended.data.run.revision,
    operationId: 'advance-1', leadMemberId: 'slot:1' }
  assert.equal((await post(api, '/advance', advance)).status, 409)
  const nextBody = await request(api, 'start-2', ended.data)
  const next = await post(api, '/match', nextBody)
  assert.equal(next.status, 200, JSON.stringify(next.data))
  assert.notEqual(next.data.run.id, initial.run.id)
  assert.equal((await post(api, '/match', body)).status, 409)
  assert.equal((await post(api, '/forfeit', { matchId: initial.matchId })).status, 409)
  assert.deepEqual((await api.call('/match')).data, next.data)
})

test('Survival rejects forged state, illegal teams, mixed modes and foreign origins', async t => {
  const api = (await start(t)).client(), body = await request(api)
  for (const extra of [{ hp: 999 }, { wins: 200 }, { seed: [1, 2, 3, 4] }, { roundNumber: 5 }, { regionId: 'kanto' }, { mode: 'unknown' }]) {
    assert.equal((await post(api, '/match', { ...body, ...extra })).status, 400)
  }
  const { presetId, ...custom } = body
  assert.equal((await post(api, '/match', { ...custom, team: [] })).status, 400)
  assert.equal((await api.call('/match', { method: 'POST', body, originHeader: false })).status, 403)
  assert.equal((await api.call('/owner', { headers: { Origin: 'https://foreign.example' } })).status, 403)
  assert.equal((await api.call('/match')).status, 401)
  const started = (await post(api, '/match', body)).data
  for (const extra of [{ hp: 999 }, { roster: [] }, { opponent: [] }]) {
    assert.equal((await post(api, '/advance', { runId: started.run.id, matchId: started.matchId,
      revision: started.run.revision, operationId: 'bad-advance', leadMemberId: 'slot:1', ...extra })).status, 400)
  }
  assert.deepEqual((await api.call('/match')).data, started)
})

test('Survival shares solo capacity while pre-run owners allocate no battle slots', async t => {
  const host = await start(t, { maxSessions: 1 }), a = host.client(), b = host.client()
  const [bodyA, bodyB] = await Promise.all([request(a), request(b)])
  const first = await post(a, '/match', bodyA)
  assert.equal(first.status, 200)
  assert.equal((await post(b, '/match', bodyB)).status, 503)
  assert.deepEqual((await a.call('/match')).data, first.data)
  assert.equal((await a.call('/match', { method: 'DELETE', body: {
    matchId: first.data.matchId, runId: first.data.run.id, revision: first.data.run.revision,
  } })).status, 200)
  assert.equal((await post(b, '/match', bodyB)).status, 200)
})
