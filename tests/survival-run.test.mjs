import test from 'node:test'
import assert from 'node:assert/strict'
import { createEngineFactory } from '@battle/battle-engine'
import { getSpecies } from '@battle/game-data'
import { createSurvivalRun, SURVIVAL_RULES_VERSION } from '../apps/server/survival-run.js'
import { rankSurvivalActions } from '../apps/server/survival-ai.js'
import { PRESET_TEAMS } from '../apps/server/presets.js'

const clone = value => structuredClone(value)
const player = () => clone(PRESET_TEAMS[0].team)
const maxHp = [400, 301, 1, 100, 360, 362]
const names = player().map(member => member.species)

function fakeFactory() {
  const control = { creates: [], disposed: 0, active: 0, failCreate: false, failRestore: false, failExport: false, failBot: false, terminal: null, battleHp: null, finishOnBot: false }
  function make(state) {
    let disposed = false
    control.active++
    const guard = () => { if (disposed) throw new Error('disposed') }
    const team = seat => state.options.teams[seat].map((set, index) => ({
      memberId: `${seat}:${index + 1}`, name: set.species, species: set.species, active: index === 0,
      hp: { current: seat === 'p1' ? state.hp[index] : 100, max: seat === 'p1' ? maxHp[names.indexOf(set.species)] : 100 },
      fainted: seat === 'p1' && state.hp[index] === 0, condition: null, moves: set.moves, stats: {}, stages: {}, volatiles: [],
    }))
    const getDecision = seat => ({ id: `${state.options.matchId}:${seat}:${state.turn}`, kind: state.result ? 'finished' : seat === 'p1' && state.waiting ? 'wait' : 'move',
      moves: [{ id: 'tackle', name: 'Tackle', slot: 1, pp: 20, maxpp: 35, disabled: false }], switches: [] })
    const getPlayerView = seat => { guard(); return { complete: true, seat, turn: state.turn, cursor: state.cursor, own: { active: `${seat}:1`, team: team(seat) },
      opponent: { active: `${seat === 'p1' ? 'p2' : 'p1'}:revealed:1`, known: [{ ...team(seat === 'p1' ? 'p2' : 'p1')[0], memberId: `${seat === 'p1' ? 'p2' : 'p1'}:revealed:1` }] },
      result: clone(state.result), decision: getDecision(seat), sideConditions: { p1: [], p2: [] }, weather: null } }
    function terminal(result) {
      state.result = result
      if (control.terminal) state.hp = state.options.teams.p1.map((set, index) => control.terminal[set.species] ?? state.hp[index])
      state.cursor++
    }
    return {
      getDecision, getPlayerView,
      submitDecision(seat, command) {
        guard()
        const key = `${seat}:${command.commandId}`
        if (state.receipts[key]) return clone(state.receipts[key])
        if (command.decisionId !== getDecision(seat).id) return { accepted: false, code: 'STALE_DECISION' }
        if (seat === 'p2' && control.failBot) throw new Error('bot fault')
        if (seat === 'p1') state.waiting = true
        else {
          state.waiting = false; state.turn++
          if (control.battleHp) state.hp = state.options.teams.p1.map((set, index) => control.battleHp[set.species] ?? state.hp[index])
          if (control.finishOnBot) terminal({ kind: 'win', winnerSeat: 'p1', reason: 'battle' })
        }
        state.cursor++
        const ack = { accepted: true, commandId: command.commandId }
        state.receipts[key] = ack
        return clone(ack)
      },
      adjudicate(command) {
        guard()
        if (!state.result) terminal(command.kind === 'forfeit' ? { kind: 'win', winnerSeat: command.seat === 'p1' ? 'p2' : 'p1', reason: command.reason ?? 'forfeit' } : { kind: command.kind, reason: command.reason ?? 'agreement' })
        return clone(state.result)
      },
      // Deliberately reversed: mapping must use stable identities, not order.
      getTerminalRoster() { guard(); return team('p1').map(member => ({ memberId: member.memberId, hp: member.hp.current, maxHp: member.hp.max, fainted: member.fainted })).reverse() },
      getEvents() { guard(); return [] },
      exportCheckpoint() { guard(); if (control.failExport) throw new Error('export fault'); return JSON.stringify(state) },
      dispose() { if (!disposed) { disposed = true; control.active--; control.disposed++ } },
    }
  }
  return {
    control, getProfile: () => ({ id: 'gen3survivalsinglesv1' }), getIdentity: () => ({ fingerprint: 'test' }),
    validateTeam: team => ({ valid: true, team: clone(team) }),
    create(options) {
      control.creates.push(clone(options))
      if (control.failCreate) throw new Error('create fault')
      return make({ options: clone(options), hp: options.teams.p1.map((set, index) => options.initialConditions?.p1.find(hp => hp.memberId === `p1:${index + 1}`)?.hp ?? maxHp[names.indexOf(set.species)]),
        result: null, turn: 1, cursor: 0, waiting: false, receipts: {} })
    },
    restore(checkpoint) { if (control.failRestore) throw new Error('restore fault'); return make(JSON.parse(checkpoint)) },
  }
}

function makeRun(t, options = {}) {
  const factory = options.factory ?? fakeFactory()
  let generated = 0
  const run = createSurvivalRun({ playerTeam: player(), factory, generateOpponent: () => { generated++; return player() }, ...options })
  t.after(() => run.dispose())
  return { run, factory, generated: () => generated }
}
function nextCommand(run, operationId = 'next-round', leadMemberId = 'slot:1') {
  const summary = run.summary()
  return { runId: summary.id, matchId: run.current().matchId, revision: summary.revision, operationId, leadMemberId }
}
function win(run) { run.adjudicate({ kind: 'forfeit', seat: 'p2' }) }

test('starting order maps original six identities, freezes the team and publishes private-safe detached summaries', t => {
  const team = player()
  const { run, factory } = makeRun(t, { playerTeam: team, leadIndex: 3, id: 'fixed-run', initialMatchId: 'fixed-match', initialSeed: [1, 2, 3, 4] })
  assert.equal(run.summary().id, 'fixed-run')
  assert.equal(SURVIVAL_RULES_VERSION, 'gen3-survival-v2')
  assert.equal(run.summary().rulesVersion, SURVIVAL_RULES_VERSION)
  assert.equal(run.current().matchId, 'fixed-match')
  assert.equal(run.getPlayerView().own.team[0].species, team[3].species)
  assert.equal(run.summary().roster[3].memberId, 'p1:1')
  assert.equal(run.summary().roster[0].memberId, 'p1:2')
  const summary = run.summary()
  summary.roster[0].hp = 0
  team[0].species = 'Mewtwo'
  assert.equal(run.summary().roster[0].species, names[0])
  assert.equal(run.summary().roster[0].hp, 400)
  const text = JSON.stringify(run.summary())
  for (const privateField of ['"seed"', '"opponentTeam"', '"originalTeam"', '"checkpoint"', '"moves"', '"ability"', '"item"']) assert(!text.includes(privateField), privateField)
  assert.equal(factory.control.active, 1)
  assert.deepEqual(factory.control.creates[0].seed, [1, 2, 3, 4])
})

test('win heals survivors by one quarter and revives fainted slots to half once, with odd-HP rounding and a one-HP minimum', t => {
  const { run, factory } = makeRun(t)
  factory.control.terminal = Object.fromEntries(names.map((name, index) => [name, [70, 0, 0, 99, 1, 300][index]]))
  win(run)
  const state = run.summary()
  assert.equal(state.wins, 1)
  assert.equal(state.status, 'between-rounds')
  assert.deepEqual(state.roster.map(member => member.hp), [170, 150, 1, 100, 91, 362])
  assert.deepEqual(state.recovery.map(member => member.healed), [100, 150, 1, 1, 90, 62])
  assert.deepEqual(state.recovery.map(member => member.revived), [false, true, true, false, false, false])
  assert(state.roster.every(member => !member.eliminated))
  assert.equal(run.getPlayerView().own.team[0].hp.current, 70, 'finished battle stays unhealed')
  assert.equal(run.getPlayerView().own.team[1].hp.current, 0, 'reviving does not rewrite final battle HP')
  assert.equal(run.getPlayerView().own.team[2].fainted, true, 'final fainted view remains until next battle')
  const serialized = run.exportRecord()
  win(run)
  run.summary(); run.getPlayerView(); run.getEvents()
  assert.deepEqual(run.exportRecord(), serialized, 'retry/read cannot heal or increment revision')
  const request = nextCommand(run, 'continue-1', 'slot:2')
  run.advance(request)
  assert.equal(run.summary().roundNumber, 2)
  assert.equal(run.summary().wins, 1)
  assert.equal(run.getPlayerView().own.team.length, 6)
  assert.equal(run.getPlayerView().own.team[0].species, names[1], 'revived original slot can lead')
  assert.equal(run.summary().roster[1].memberId, 'p1:1')
  assert.equal(run.summary().roster[0].memberId, 'p1:2')
  assert.equal(run.summary().roster[2].memberId, 'p1:3')
  assert.deepEqual(factory.control.creates[1].initialConditions.p1.map(member => member.hp), [150, 170, 1, 100, 91, 362])
  const next = run.exportRecord()
  run.advance(request)
  assert.deepEqual(run.exportRecord(), next)
  assert.equal(factory.control.active, 1)
  factory.control.terminal = Object.fromEntries(names.map(name => [name, name === names[5] ? 10 : name === names[1] ? 80 : 0]))
  win(run)
  assert.deepEqual(run.summary().roster.map(member => member.hp), [200, 155, 1, 50, 180, 100])
  assert.deepEqual(run.summary().recovery.map(member => [member.id, member.revived]), [
    ['slot:2', false], ['slot:1', true], ['slot:3', true], ['slot:4', true], ['slot:5', true], ['slot:6', false],
  ])
  run.advance(nextCommand(run, 'continue-again', 'slot:3'))
  assert.equal(run.getPlayerView().own.team.length, 6)
  assert.equal(run.summary().survivors, 6)
  assert.equal(run.summary().roster[2].memberId, 'p1:1', 'repeatedly revived original identity can lead')
  assert.equal(run.summary().roster[5].hp, 100)
  assert(run.summary().roster.every(member => !member.eliminated && member.memberId !== null))
})

test('loss, draw, turn limit and player forfeit end the run without healing or reviving anyone', t => {
  for (const [decision, reason] of [
    [{ kind: 'forfeit', seat: 'p1' }, 'forfeit'],
    [{ kind: 'forfeit', seat: 'p1', reason: 'battle' }, 'defeat'],
    [{ kind: 'draw' }, 'draw'],
    [{ kind: 'draw', reason: 'turn-limit' }, 'turn-limit'],
  ]) {
    const { run, factory } = makeRun(t)
    const health = [0, 80, 0, 99, 1, 300]
    factory.control.terminal = Object.fromEntries(names.map((name, index) => [name, health[index]]))
    run.adjudicate(decision)
    assert.equal(run.summary().status, 'ended')
    assert.equal(run.summary().endingReason, reason)
    assert.equal(run.summary().wins, 0)
    assert.deepEqual(run.summary().roster.map(member => member.hp), health)
    assert.deepEqual(run.summary().roster.map(member => member.eliminated), health.map(hp => hp === 0))
    assert.deepEqual(run.summary().recovery, [])
    assert.throws(() => run.advance(nextCommand(run)), { code: 'ROUND_NOT_WON' })
  }
})

test('an authoritative win with no living members revives everyone and can continue', t => {
  const { run, factory } = makeRun(t)
  factory.control.terminal = Object.fromEntries(names.map(name => [name, 0]))
  win(run)
  assert.equal(run.summary().status, 'between-rounds')
  assert.equal(run.summary().endingReason, null)
  assert.equal(run.summary().wins, 1)
  assert.deepEqual(run.summary().roster.map(member => member.hp), [200, 150, 1, 50, 180, 181])
  assert(run.summary().recovery.every(member => member.revived && !member.eliminated))
  assert(run.getPlayerView().own.team.every(member => member.fainted && member.hp.current === 0))
  run.advance(nextCommand(run, 'all-revived', 'slot:3'))
  assert.equal(run.summary().roundNumber, 2)
  assert.equal(run.getPlayerView().own.team.length, 6)
})

test('a mid-battle faint stays disabled until a win and duplicate settlement cannot revive or heal twice', t => {
  const { run, factory } = makeRun(t)
  factory.control.battleHp = { [names[2]]: 0 }
  const command = { commandId: 'player-move', decisionId: run.getPlayerView().decision.id, action: { kind: 'move', slot: 1 } }
  const ack = run.submitDecision(command)
  assert(ack.accepted)
  assert.equal(run.summary().status, 'active')
  assert.equal(run.summary().roster[2].eliminated, true)
  assert.equal(run.summary().roster[2].hp, 0)
  assert.equal(run.summary().wins, 0)
  assert.deepEqual(run.summary().recovery, [])
  assert.throws(() => run.advance(nextCommand(run, 'too-early', 'slot:3')), { code: 'ROUND_NOT_WON' })
  factory.control.finishOnBot = true
  const finishingCommand = { commandId: 'win-now', decisionId: run.getPlayerView().decision.id, action: { kind: 'move', slot: 1 } }
  assert(run.submitDecision(finishingCommand).accepted)
  assert.equal(run.summary().roster[2].eliminated, false)
  assert.equal(run.summary().roster[2].hp, 1)
  assert.equal(run.getPlayerView().own.team[2].hp.current, 0)
  assert.equal(run.getPlayerView().own.team[2].fainted, true)
  assert.equal(run.summary().wins, 1)
  const record = run.exportRecord()
  run.submitDecision(finishingCommand)
  assert.deepEqual(run.exportRecord(), record)
})

test('invalid, stale, concurrent and changed operation identities cannot alter progress', t => {
  const { run, factory } = makeRun(t)
  assert.throws(() => run.advance(nextCommand(run)), { code: 'ROUND_NOT_WON' })
  factory.control.terminal = { [names[2]]: 0 }
  win(run)
  const body = nextCommand(run)
  const before = run.exportRecord()
  for (const [change, code] of [
    [{ runId: 'another-run' }, 'RUN_CHANGED'], [{ matchId: 'another-match' }, 'MATCH_CHANGED'],
    [{ revision: body.revision - 1 }, 'RUN_CHANGED'], [{ leadMemberId: 'slot:7' }, 'INVALID_ADVANCE'],
    [{ hp: 400 }, 'INVALID_ADVANCE'], [{ leadMemberId: 'p1:1' }, 'INVALID_ADVANCE'],
  ]) assert.throws(() => run.advance({ ...body, ...change }), { code })
  assert.deepEqual(run.exportRecord(), before)
  run.advance(body)
  assert.throws(() => run.advance({ ...body, operationId: 'second-tab' }), { code: 'MATCH_CHANGED' })
  assert.throws(() => run.advance({ ...body, leadMemberId: 'slot:2' }), { code: 'OPERATION_ID_REUSED' })
  assert.equal(run.summary().roundNumber, 2)
})

test('engine creation failure freezes next opponent, seed and lead; retry cannot draw another team', t => {
  const { run, factory, generated } = makeRun(t)
  win(run)
  const body = nextCommand(run, 'failure-retry', 'slot:4')
  factory.control.failCreate = true
  assert.throws(() => run.advance(body), { code: 'SURVIVAL_INTERRUPTED', status: 503 })
  assert.equal(run.summary().status, 'starting-next')
  assert.deepEqual(run.summary().pending, { operationId: body.operationId, leadMemberId: body.leadMemberId, expectedRevision: body.revision, matchId: body.matchId })
  assert.equal(run.summary().wins, 1)
  const pending = run.exportRecord().pending
  assert.throws(() => run.advance({ ...body, leadMemberId: 'slot:5' }), { code: 'OPERATION_ID_REUSED' })
  assert.throws(() => run.advance({ ...body, operationId: 'reroll' }), { code: 'RUN_CHANGED' })
  assert.equal(generated(), 2)
  factory.control.failCreate = false
  run.advance(body)
  assert.equal(generated(), 2)
  assert.equal(run.exportRecord().current.seed, pending.seed)
  assert.deepEqual(run.exportRecord().current.opponentTeam, pending.opponentTeam)
  assert.equal(run.current().matchId, pending.matchId)
  assert.equal(run.summary().interruption, null)
})

test('generation, restore, bot, checkpoint and atomic commit faults preserve the last valid engine and score', t => {
  for (const failure of ['failRestore', 'failBot', 'failExport', 'store']) {
    let failStore = false
    const { run, factory } = makeRun(t, { beforeCommit: () => { if (failStore) throw new Error('store fault') } })
    const before = run.exportRecord()
    const old = run.current().engine
    const command = { commandId: `try-${failure}`, decisionId: run.getPlayerView().decision.id, action: { kind: 'move', slot: 1 } }
    if (failure === 'store') failStore = true
    else factory.control[failure] = true
    assert.throws(() => run.submitDecision(command), { code: 'SURVIVAL_INTERRUPTED' }, failure)
    assert.deepEqual(run.exportRecord(), before, failure)
    assert.equal(run.current().engine, old)
    assert.equal(factory.control.active, 1)
    failStore = false
    factory.control[failure] = false
    assert.equal(run.submitDecision(command).accepted, true)
    assert.equal(run.summary().revision, before.revision + 1)
    assert.equal(run.summary().wins, 0)
    assert.equal(factory.control.active, 1)
  }
  let failGeneration = false
  const { run } = makeRun(t, { generateOpponent: () => { if (failGeneration) throw new Error('generation unavailable'); return player() } })
  win(run)
  const before = run.exportRecord()
  const command = nextCommand(run)
  failGeneration = true
  assert.throws(() => run.advance(command), { code: 'SURVIVAL_INTERRUPTED' })
  assert.deepEqual(run.exportRecord(), before)
  failGeneration = false
  run.advance(command)
  assert.equal(run.summary().roundNumber, 2)
})

test('terminal commit faults cannot heal, revive or award wins before successful retry', t => {
  let failStore = false
  const { run, factory } = makeRun(t, { beforeCommit: () => { if (failStore) throw new Error('store fault') } })
  factory.control.terminal = { [names[0]]: 70, [names[1]]: 0 }
  const before = run.exportRecord()
  failStore = true
  assert.throws(() => win(run), { code: 'SURVIVAL_INTERRUPTED' })
  assert.deepEqual(run.exportRecord(), before)
  failStore = false
  win(run)
  assert.equal(run.summary().roster[0].hp, 170)
  assert.equal(run.summary().roster[1].hp, 150)
  assert.equal(run.summary().recovery.find(member => member.id === 'slot:2').revived, true)
  assert.equal(run.summary().wins, 1)
})

test('infrastructure results preserve the active run instead of becoming gameplay defeats', t => {
  const { run } = makeRun(t)
  const before = run.exportRecord()
  assert.throws(() => run.adjudicate({ kind: 'no-contest', reason: 'infrastructure' }), { code: 'SURVIVAL_INTERRUPTED' })
  assert.deepEqual(run.exportRecord(), before)
  assert.equal(run.summary().status, 'active')
})

test('thousands of synthetic rounds retain bounded history and receipts and dispose replaced engines', t => {
  const { run, factory } = makeRun(t)
  let oldest
  for (let index = 0; index < 1200; index++) {
    win(run)
    const command = nextCommand(run, `long-${index}`)
    oldest ??= command
    run.advance(command)
  }
  const record = run.exportRecord()
  assert.equal(record.wins, 1200)
  assert.equal(record.roundNumber, 1201)
  assert.equal(record.recentRounds.length, 16)
  assert.equal(record.receipts.length, 64)
  assert.equal(factory.control.active, 1)
  assert.equal(factory.control.disposed, 2400)
  assert(JSON.stringify(record).length < 35_000)
  assert.throws(() => run.advance(oldest), { code: 'MATCH_CHANGED' })
})

test('real engine runs AI on a restored candidate, keeps owned views private, and restores later-round checkpoints/replays', t => {
  const factory = createEngineFactory({ profileId: 'gen3survivalsinglesv1' })
  const { run } = makeRun(t, { factory, generateOpponent: () => clone(PRESET_TEAMS[1].team), initialSeed: [1, 2, 3, 4] })
  const initial = run.getPlayerView()
  assert.equal(initial.opponent.known.length, 1)
  const ack = run.submitDecision({ commandId: 'real-1', decisionId: initial.decision.id, action: { kind: 'move', slot: 1 } })
  assert.equal(ack.accepted, true)
  assert.equal(run.getPlayerView().turn, 2)
  assert(run.getPlayerView().own.team[0].hp.current < run.getPlayerView().own.team[0].hp.max)
  win(run)
  const recovered = run.summary().roster.map(member => member.hp)
  run.advance(nextCommand(run, 'real-next', 'slot:2'))
  assert.equal(run.getPlayerView().own.team[0].species, player()[1].species)
  assert.deepEqual(run.summary().roster.map(member => member.hp), recovered)
  const restored = factory.restore(run.exportRecord().checkpoint)
  const replayed = factory.replay(run.current().engine.exportReplay())
  t.after(() => { restored.dispose(); replayed.dispose() })
  assert.deepEqual(restored.getPlayerView('p1'), run.getPlayerView())
  assert.deepEqual(replayed.getPlayerView('p1'), run.getPlayerView())
})

test('a real fainted Shedinja remains out during battle, then revives to one HP and can lead the next round', t => {
  const factory = createEngineFactory({ profileId: 'gen3survivalsinglesv1' })
  const team = player()
  team[0] = { species: 'Shedinja', ability: 'Wonder Guard', nature: 'Hardy', moves: ['Scratch'], level: 100, item: '' }
  const { run } = makeRun(t, { factory, playerTeam: team, generateOpponent: () => clone(PRESET_TEAMS[1].team), initialSeed: [21, 22, 23, 24] })
  const initial = run.getPlayerView()
  assert.equal(initial.own.team[0].hp.max, 1)
  assert(run.submitDecision({ commandId: 'shedinja-faints', decisionId: initial.decision.id, action: { kind: 'move', slot: 1 } }).accepted)
  const fainted = run.getPlayerView()
  assert.equal(fainted.own.team[0].hp.current, 0)
  assert.equal(fainted.own.team[0].fainted, true)
  assert.equal(fainted.decision.kind, 'switch')
  assert(!fainted.decision.switches.some(member => member.memberId === 'p1:1'))
  assert.equal(run.summary().roster[0].eliminated, true)
  assert.deepEqual(run.summary().recovery, [])
  win(run)
  const recovered = run.summary()
  assert.equal(recovered.roster[0].hp, 1)
  assert.equal(recovered.roster[0].eliminated, false)
  assert.deepEqual(recovered.recovery.find(member => member.id === 'slot:1'), {
    id: 'slot:1', before: 0, after: 1, healed: 1, maxHp: 1, eliminated: false, revived: true,
  })
  assert.equal(run.getPlayerView().own.team[0].hp.current, 0)
  const command = nextCommand(run, 'shedinja-revived-lead', 'slot:1')
  run.advance(command)
  const next = run.getPlayerView()
  assert.equal(next.own.team[0].species, 'Shedinja')
  assert.equal(next.own.team[0].hp.current, 1)
  assert.equal(next.own.team[0].fainted, false)
  assert.equal(next.decision.kind, 'move')
  assert.equal(run.summary().roster[0].id, 'slot:1')
  assert.equal(next.own.team.length, 6)
})

test('complete real battles settle once, reset full PP and original sets, and continue with a different lead', t => {
  const factory = createEngineFactory({ profileId: 'gen3survivalsinglesv1' })
  const opponent = ['magikarp', 'spoink', 'hoppip', 'azurill', 'feebas', 'wynaut'].map(id => ({
    species: getSpecies(id).name, ability: getSpecies(id).abilities[0], nature: 'Hardy', moves: ['Splash'], level: 100,
  }))
  assert(factory.validateTeam(opponent).valid)
  const { run } = makeRun(t, { factory, generateOpponent: () => opponent, initialSeed: [51, 52, 53, 54], collection: { version: 'fixed-corpus' } })
  let commandNumber = 0
  for (let round = 1; round <= 2; round++) {
    for (let count = 0; count < 100 && run.summary().status === 'active'; count++) {
      const view = run.getPlayerView()
      const action = rankSurvivalActions(view, { ownTeam: run.exportRecord().originalTeam })[0]
      assert(action, 'player policy has a legal move or forced replacement')
      assert(run.submitDecision({ commandId: `smoke-${++commandNumber}`, decisionId: view.decision.id, action }).accepted)
    }
    assert.equal(run.getPlayerView().result?.winnerSeat, 'p1')
    assert.equal(run.summary().status, 'between-rounds')
    assert.equal(run.summary().wins, round)
    assert.equal(run.getPlayerView().opponent.known.filter(member => member.fainted).length, 6)
    assert.equal(run.exportRecord().collection.version, 'fixed-corpus')
    if (round === 1) {
      const body = nextCommand(run, 'complete-next', 'slot:2')
      run.advance(body)
      assert.equal(run.getPlayerView().own.team[0].species, 'Blastoise')
      assert(run.getPlayerView().own.team[0].moveOptions.every(move => move.pp === move.maxpp))
      assert(run.getPlayerView().own.team.every(member => member.condition === null && Object.keys(member.stages).length === 0 && member.volatiles.length === 0))
      const record = run.exportRecord()
      run.advance(body)
      assert.deepEqual(run.exportRecord(), record)
    }
  }
  assert(commandNumber > 5)
})

test('malformed initial size/lead rejects before any opponent allocation and disposal is idempotent', t => {
  const factory = fakeFactory()
  let generated = 0
  for (const options of [{ playerTeam: player().slice(0, 5) }, { leadIndex: 6 }, { id: 'invalid id' }]) {
    assert.throws(() => createSurvivalRun({ playerTeam: player(), factory, generateOpponent: () => { generated++; return player() }, ...options }), { code: 'INVALID_SURVIVAL_TEAM' })
  }
  assert.equal(generated, 0)
  const { run } = makeRun(t, { factory })
  run.dispose(); run.dispose()
  assert.throws(() => run.summary(), { code: 'RUN_DISPOSED' })
  assert.equal(factory.control.active, 0)
})
