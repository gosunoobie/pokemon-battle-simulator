import test from 'node:test'
import assert from 'node:assert/strict'
import { createEngineFactory } from '../src/index.js'
import { createTeamFixture } from '../fixtures/team-fixtures.js'

function quietTeam() {
  const team = createTeamFixture()
  team[0].moves = ['Growl']
  return team
}
function create(factory, matchId = 'review') {
  return factory.create({ matchId, teams: { p1: quietTeam(), p2: quietTeam() }, seed: [1, 2, 3, 4] })
}
function choose(battle, seat, commandId) {
  const decision = battle.getDecision(seat)
  assert.equal(decision.kind, 'move')
  return battle.submitDecision(seat, {
    commandId, decisionId: decision.id, action: { kind: 'move', slot: 1 },
  })
}

test('maximum-length accepted match IDs produce actionable decision IDs as counters grow', () => {
  const factory = createEngineFactory()
  for (const length of [123, 128]) {
    const battle = create(factory, 'm'.repeat(length))
    try {
      for (let turn = 0; turn < 12; turn++) {
        for (const seat of ['p1', 'p2']) {
          const result = choose(battle, seat, `choice-${turn}-${seat}`)
          assert.equal(result.accepted, true, `match ID length ${length}, turn ${turn + 1}, ${seat}: ${JSON.stringify(result)}`)
        }
      }
      assert.ok(battle.getDecision('p1').id.length > 128, 'the fixture exercises the former command ID limit')
      const restored = factory.restore(battle.exportCheckpoint())
      try {
        assert.deepEqual(restored.getDecision('p1'), battle.getDecision('p1'))
        assert.equal(choose(restored, 'p1', 'after-restore').accepted, true)
      } finally { restored.dispose() }
    } finally { battle.dispose() }
  }
})

test('rejected stale requests cannot exhaust the match journal or prevent legal play and system termination', () => {
  const factory = createEngineFactory(), battle = create(factory)
  try {
    const original = battle.getDecision('p1')
    for (let index = 0; index < 8192; index++) {
      const result = battle.submitDecision('p1', {
        commandId: `stale-${index}`, decisionId: 'a-stale-decision', action: { kind: 'move', slot: 1 },
      })
      assert.equal(result.accepted, false)
      assert.equal(result.code, 'STALE_DECISION')
    }
    assert.deepEqual(battle.getDecision('p1'), original)
    assert.equal(battle.exportReplay().journal.length, 0, 'nonadmitted requests have no replay effects')
    const payload = JSON.parse(battle.exportCheckpoint()).payload
    assert.equal(payload.receipts.length, 0, 'nonadmitted requests do not occupy accepted-command receipts')
    assert.equal(choose(battle, 'p2', 'legal-opponent-choice').accepted, true)
    assert.equal(choose(battle, 'p1', 'legal-own-choice').accepted, true)
    assert.deepEqual(battle.adjudicate({ kind: 'no-contest', reason: 'infrastructure' }), { kind: 'no-contest', reason: 'infrastructure' })
    assert.equal(battle.getDecision('p1').kind, 'finished')
    assert.equal(battle.getDecision('p2').kind, 'finished')
  } finally { battle.dispose() }
})
