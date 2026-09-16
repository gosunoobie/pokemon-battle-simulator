import test from 'node:test'
import assert from 'node:assert/strict'
import { createCommandId, simulationRequest, SimulationError } from '../apps/simulation/src/api.js'

test('command IDs support HTTP LAN browsers without randomUUID', () => {
  let next = 0
  const random = { getRandomValues(bytes) { return bytes.fill(++next) } }
  const first = createCommandId(random), second = createCommandId(random)
  assert.match(first, /^[a-f0-9]{32}$/)
  assert.notEqual(first, second)
})

test('client transport keeps the same command payload and same-origin cookie on retry', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options })
    if (calls.length === 1) throw new TypeError('offline')
    return new Response(JSON.stringify({ ack: { accepted: true } }), { status: 200 })
  })
  const body = { commandId: 'one-command', matchId: 'one-match', decisionId: 'one-decision', action: { kind: 'move', slot: 1 }, afterCursor: 12 }
  await assert.rejects(simulationRequest('choice', { method: 'POST', body }), error => error.code === 'CONNECTION_FAILED')
  const response = await simulationRequest('choice', { method: 'POST', body })
  assert.equal(response.ack.accepted, true)
  assert.equal(calls[0].url, '/api/simulation/choice')
  assert.equal(calls[0].credentials, 'same-origin')
  assert.equal(calls[0].body, calls[1].body)
  assert.deepEqual(JSON.parse(calls[1].body), body)
})

test('transport preserves match-conflict errors and detects an HTML-only static host', async t => {
  const responses = [new Response(JSON.stringify({ error: { code: 'MATCH_CHANGED', message: 'Sync the newer match.' } }), { status: 409 }), new Response('<html>Home page</html>')]
  t.mock.method(globalThis, 'fetch', async () => responses.shift())
  await assert.rejects(simulationRequest('match'), error => error instanceof SimulationError && error.code === 'MATCH_CHANGED' && error.status === 409)
  await assert.rejects(simulationRequest('config'), error => error.code === 'SERVER_UNAVAILABLE')
})

test('custom-team validation failures preserve actionable set issues without changing the submitted team', async t => {
  const issues = [{ code: 'GEN3_LEGALITY', message: 'Charizard cannot learn Surf.', setIndex: 0 }]
  let submitted
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    submitted = JSON.parse(options.body)
    return new Response(JSON.stringify({ error: { code: 'INVALID_TEAM', message: 'Review your team.', errors: issues } }), { status: 400 })
  })
  const command = { team: [{ species: 'Charizard', moves: ['Surf'] }], leadIndex: 0, expectedMatchId: null }
  await assert.rejects(simulationRequest('match', { method: 'POST', body: command }), error => {
    assert.equal(error.code, 'INVALID_TEAM')
    assert.equal(error.status, 400)
    assert.deepEqual(error.issues, issues)
    return true
  })
  assert.deepEqual(submitted, command)
})

test('requests abort at their deadline instead of leaving controls waiting indefinitely', async t => {
  let aborted = false
  t.mock.method(globalThis, 'fetch', (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')) }, { once: true })
  }))
  await assert.rejects(simulationRequest('match', { timeoutMs: 10 }), error => error.code === 'CONNECTION_FAILED')
  assert.equal(aborted, true)
})
