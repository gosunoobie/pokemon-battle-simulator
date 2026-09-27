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
  let cookie
  async function call(path, { method = 'GET', body, headers = {}, originHeader = true } = {}) {
    const response = await fetch(`${origin}/api/simulation${path}`, { method,
      headers: { ...(originHeader ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]
    return { status: response.status, headers: response.headers, data: await response.json() }
  }
  return { call }
}
const request = () => ({ team: Array.from({ length: 6 }, () => ({})), lockedSlots: [] })

test('solo generation returns an ordinary valid editable team without creating a match', async t => {
  const api = await start(t)
  const rolled = await api.call('/team/random', { method: 'POST', body: request() })
  assert.equal(rolled.status, 200)
  assert.equal(rolled.data.valid, true, JSON.stringify(rolled.data))
  assert.equal(rolled.data.team.length, 6)
  assert.equal(rolled.data.collection.speciesCount, 386)
  assert.equal(rolled.headers.get('set-cookie'), null)
  assert.equal(rolled.headers.get('cache-control'), 'no-store')
  assert.equal((await api.call('/match')).status, 401)
  const checked = await api.call('/team/validate', { method: 'POST', body: { team: rolled.data.team } })
  assert.equal(checked.data.valid, true)
  const created = await api.call('/match', { method: 'POST', body: {
    team: rolled.data.team, leadIndex: 3, expectedMatchId: null, regionId: 'kanto',
  } })
  assert.equal(created.status, 200, JSON.stringify(created.data))
  assert.equal(created.data.teamSelection.kind, 'custom')
  assert.equal(created.data.view.own.team[0].species, rolled.data.team[3].species)
  const snapshot = (await api.call('/match')).data
  const retained = await api.call('/team/random', { method: 'POST', body: { team: rolled.data.team, lockedSlots: [1, 3] } })
  assert.equal(retained.data.valid, true)
  assert.deepEqual(retained.data.team[1], rolled.data.team[1])
  assert.deepEqual(retained.data.team[3], rolled.data.team[3])
  assert.equal(retained.headers.get('set-cookie'), null)
  assert.deepEqual((await api.call('/match')).data, snapshot, 'generation must not mutate the active team or league')
})

test('generation bounds input and preserves same-origin policy', async t => {
  const api = await start(t)
  const config = (await api.call('/config')).data
  const team = structuredClone(config.presets[0].team)
  team[0].moves = ['Surf']
  const invalid = await api.call('/team/random', { method: 'POST', body: { team, lockedSlots: [0] } })
  assert.equal(invalid.status, 200)
  assert.equal(invalid.data.valid, false)
  assert.equal(invalid.data.team, null)
  assert(invalid.data.errors.length)
  assert.equal(invalid.headers.get('set-cookie'), null)
  for (const body of [{}, { ...request(), seed: 1 }, { ...request(), profileId: 'gen3regionalleaguev1' }]) {
    assert.equal((await api.call('/team/random', { method: 'POST', body })).status, 400)
  }
  assert.equal((await api.call('/team/random?seed=1', { method: 'POST', body: request() })).status, 400)
  assert.equal((await api.call('/team/random', { method: 'POST', body: request(), originHeader: false })).status, 403)
  assert.equal((await api.call('/team/random', { method: 'POST', body: request(), headers: { Origin: 'https://foreign.example' } })).status, 403)
  assert.equal((await api.call('/team/random', { method: 'POST', body: { team: 'x'.repeat(21 * 1024), lockedSlots: [] } })).status, 413)
})

test('expensive preparation operations share a bounded budget independent of match capacity', async t => {
  const api = await start(t, { teamRequestsPerMinute: 2 })
  const team = (await api.call('/config')).data.presets[0].team
  assert.equal((await api.call('/team/random', { method: 'POST', body: request() })).status, 200)
  assert.equal((await api.call('/team/validate', { method: 'POST', body: { team } })).status, 200)
  const limited = await api.call('/team/random', { method: 'POST', body: request() })
  assert.equal(limited.status, 429)
  assert(Number(limited.headers.get('retry-after')) > 0)
  assert.equal((await api.call('/config')).status, 200)
  assert.equal((await api.call('/match')).status, 401)
})
