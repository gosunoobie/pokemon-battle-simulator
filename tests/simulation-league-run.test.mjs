import test from 'node:test'
import assert from 'node:assert/strict'
import { createEngineFactory } from '@battle/battle-engine'
import { createLeagueRun, publicLeague } from '../apps/server/league-run.js'
import { PRESET_TEAMS } from '../apps/server/presets.js'
import { REGIONAL_LEAGUES } from '../apps/server/league-rosters.js'

const factory = createEngineFactory({ profileId: 'gen3regionalleaguev1' })
const createBattle = options => factory.create({ ...options, seed: [1, 2, 3, 4] })
const player = () => structuredClone(PRESET_TEAMS[0].team)
function makeRun(t, options = {}) {
  const run = createLeagueRun({ league: REGIONAL_LEAGUES[0], presetId: 'kanto', playerTeam: player(), createBattle, ...options })
  t.after(() => run.dispose())
  return run
}
function finishRound(run, decision = { kind: 'forfeit', seat: 'p2' }) {
  const { engine, matchId } = run.current()
  engine.adjudicate(decision)
  return { matchId, runId: run.summary().id }
}

test('five authoritative wins finish each separate regional league in order; repeated advance never skips a trainer', t => {
  for (const league of REGIONAL_LEAGUES) {
    const team = player()
    team.unshift(...team.splice(4, 1))
    const run = makeRun(t, { league, playerTeam: team })
    const id = run.summary().id
    const seen = new Set()
    let oldestRequest
    for (let index = 0; index < 5; index++) {
      const state = run.summary()
      const current = run.current()
      assert.equal(state.id, id)
      assert.equal(state.regionId, league.id)
      assert.equal(state.stageIndex, index)
      assert.equal(state.wins, index)
      assert.equal(state.status, 'active')
      assert.equal(state.opponent.id, league.trainers[index].id)
      assert.equal(current.engine.getPlayerView('p1').own.team[0].species, team[0].species)
      assert(!seen.has(current.matchId))
      seen.add(current.matchId)
      const request = finishRound(run)
      oldestRequest ??= request
      assert.equal(run.summary().wins, index + 1)
      if (index < 4) {
        assert.equal(run.summary().status, 'between-battles')
        assert.equal(run.summary().nextOpponent.id, league.trainers[index + 1].id)
        const next = run.advance(request)
        assert.notEqual(next.matchId, current.matchId)
        assert.throws(() => current.engine.getPlayerView('p1'), { code: 'DISPOSED' })
        assert.equal(run.advance(request).matchId, next.matchId)
        assert.equal(run.advance(oldestRequest).matchId, next.matchId)
        assert.equal(run.summary().stageIndex, index + 1)
      } else {
        assert.equal(run.summary().status, 'won')
        assert.equal(run.summary().nextOpponent, null)
        assert.throws(() => run.advance(request), { code: 'ROUND_NOT_WON' })
      }
    }
    assert.equal(seen.size, 5)
  }
})

test('active battles, losses, draws and no-contests cannot advance; stale run identities cannot change progress', t => {
  for (const outcome of [null, { kind: 'forfeit', seat: 'p1' }, { kind: 'draw' }, { kind: 'no-contest' }]) {
    const run = makeRun(t)
    const current = run.current()
    const body = { runId: run.summary().id, matchId: current.matchId }
    if (outcome) current.engine.adjudicate(outcome)
    const expected = run.summary()
    assert.equal(expected.status, outcome ? 'lost' : 'active')
    assert.throws(() => run.advance(body), { code: 'ROUND_NOT_WON' })
    assert.throws(() => run.advance({ ...body, runId: 'old-run' }), { code: 'RUN_CHANGED' })
    assert.throws(() => run.advance({ ...body, matchId: 'unknown-match' }), { code: 'MATCH_CHANGED' })
    assert.deepEqual(run.summary(), expected)
    assert.equal(run.current().engine, current.engine)
  }
})

test('round creation failure leaves the won round intact and retryable', t => {
  let calls = 0
  const run = makeRun(t, { createBattle: options => {
    if (++calls === 2) throw new Error('Transient engine failure')
    return createBattle(options)
  } })
  const command = finishRound(run)
  const before = run.summary()
  assert.throws(() => run.advance(command), /Transient engine failure/)
  assert.deepEqual(run.summary(), before)
  assert.equal(run.current().matchId, command.matchId)
  run.advance(command)
  assert.equal(run.summary().stageIndex, 1)
})

test('new rounds restore HP, PP, statuses, consumed items and original lead without mutating the starting fixture', t => {
  const team = player()
  // Controlled legal teams exercise real mechanics, including item consumption.
  team[0].moves = ['Rest', 'Double-Edge', 'Flamethrower', 'Protect']
  const opponent = { species: 'Blissey', ability: 'Natural Cure', nature: 'Hardy', level: 100,
    moves: ['Seismic Toss', 'Toxic', 'Soft-Boiled'], evs: { hp: 252, def: 252, spe: 4 } }
  const league = { ...REGIONAL_LEAGUES[0], trainers: REGIONAL_LEAGUES[0].trainers.map(trainer => ({ ...trainer, team: [opponent] })) }
  const original = structuredClone(team)
  const run = makeRun(t, { league, playerTeam: team })
  const engine = run.current().engine
  const start = engine.getPlayerView('p1').own.team
  let turn = 0
  const play = (ownSlot, otherSlot) => {
    turn++
    for (const [seat, slot] of [['p1', ownSlot], ['p2', otherSlot]]) {
      const decision = engine.getDecision(seat)
      assert.equal(decision.kind, 'move')
      assert.equal(engine.submitDecision(seat, { commandId: `recovery-${turn}-${seat}`, decisionId: decision.id, action: { kind: 'move', slot } }).accepted, true)
    }
  }
  play(2, 1) // Both recoil and Seismic Toss remove HP.
  play(1, 3) // Rest consumes the Chesto Berry.
  play(4, 3) // Prove status/PP changes are not merely initial data.
  play(2, 2) // Toxic leaves a major status at the end of the round.
  let damaged = engine.getPlayerView('p1').own.team[0]
  // Toxic has imperfect accuracy: the fixed seed should hit; fail if the fixture drifts.
  assert.equal(damaged.condition, 'tox')
  assert(damaged.hp.current < damaged.hp.max)
  assert.equal(damaged.item, '')
  assert(damaged.moveOptions.some(move => move.pp < move.maxpp))
  const command = finishRound(run)
  assert.deepEqual(team, original)
  team[0].species = 'Pikachu' // Caller mutations must not rewrite the locked-in team.
  const next = run.advance(command).engine.getPlayerView('p1')
  assert.deepEqual(next.own.team, start)
  assert.equal(next.turn, 1)
  assert.equal(next.weather, null)
})

test('public league/run summaries expose trainer labels only and returned data cannot mutate progression', t => {
  const run = makeRun(t)
  const summary = run.summary()
  summary.trainers[0].name = 'Changed'
  summary.opponent.id = 'changed'
  summary.stageIndex = 4
  assert.equal(run.summary().stageIndex, 0)
  assert.equal(run.summary().opponent.name, 'Lorelei')
  const serialized = JSON.stringify([publicLeague(REGIONAL_LEAGUES[0]), run.summary()])
  for (const forbidden of ['"team"', '"moves"', '"seed"', '"originalLevels"', '"sourceParty"', '"ability"', '"item"']) assert(!serialized.includes(forbidden), forbidden)
  run.dispose()
  run.dispose()
  assert.throws(() => run.summary(), /disposed/)
})
