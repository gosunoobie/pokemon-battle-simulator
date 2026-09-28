import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { createEngineFactory } from '../src/index.js'

const PROFILE = 'gen3survivalsinglesv1'
const factory = createEngineFactory({ profileId: PROFILE })
const seed = [1, 2, 3, 4]
const set = (species, ability, moves, extra = {}) => ({ species, ability, moves, nature: 'Hardy', level: 100, ...extra })
const members = () => [
  set('Charizard', 'Blaze', ['Growl', 'Rest']),
  set('Blastoise', 'Torrent', ['Tail Whip']),
  set('Venusaur', 'Overgrow', ['Growl']),
  set('Pikachu', 'Static', ['Growl']),
  set('Snorlax', 'Immunity', ['Amnesia']),
  set('Ditto', 'Limber', ['Transform']),
]
const harmless = () => [set('Magikarp', 'Swift Swim', ['Splash'])]
const conditions = hp => ({ p1: hp.map((value, index) => ({ memberId: `p1:${index + 1}`, hp: value })) })
const options = (p1 = members().slice(0, 2), p2 = harmless(), hp = [37, 81]) => ({
  matchId: 'survival-engine', seed, teams: { p1, p2 }, ...(hp ? { initialConditions: conditions(hp) } : {}),
})
const own = (t, engine) => { t.after(() => engine.dispose()); return engine }
const views = engine => ['p1', 'p2'].map(seat => engine.getPlayerView(seat))
const events = engine => ['p1', 'p2'].map(seat => engine.getEvents(seat))
const action = (engine, seat, commandId, choice = { kind: 'move', slot: 1 }) => ({
  commandId, decisionId: engine.getDecision(seat).id, action: choice,
})
const turn = (engine, id, choice = { kind: 'move', slot: 1 }) => {
  assert.equal(engine.submitDecision('p1', action(engine, 'p1', `${id}-p1`, choice)).accepted, true)
  assert.equal(engine.submitDecision('p2', action(engine, 'p2', `${id}-p2`)).accepted, true)
}
const rejected = (validation, code) => {
  assert.equal(validation.valid, false)
  assert(validation.errors.some(error => error.code === code), JSON.stringify(validation.errors))
}
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value
const rewriteCheckpoint = (record, change) => {
  const saved = JSON.parse(record)
  change(saved.payload)
  saved.sha256 = createHash('sha256').update(JSON.stringify(ordered(saved.payload))).digest('hex')
  return JSON.stringify(saved)
}

test('Survival permits one through six distinct species with no League NPC exception', () => {
  for (let size = 1; size <= 6; size++) {
    assert.equal(factory.validateTeam(members().slice(0, size)).valid, true)
    assert.equal(factory.validateOpponentTeam(members().slice(0, size)).valid, true)
  }
  rejected(factory.validateTeam([]), 'TEAM_SIZE')
  rejected(factory.validateTeam([...members(), harmless()[0]]), 'TEAM_SIZE')
  rejected(factory.validateTeam([members()[0], members()[0]]), 'SPECIES_CLAUSE')
  rejected(factory.validateOpponentTeam([members()[0], members()[0]]), 'SPECIES_CLAUSE')
  const murkrow = [set('Murkrow', 'Insomnia', ['Quick Attack', 'Whirlwind', 'Pursuit', 'Faint Attack'])]
  rejected(factory.validateTeam(murkrow), 'GEN3_LEGALITY')
  rejected(factory.validateOpponentTeam(murkrow), 'GEN3_LEGALITY')
  assert.equal(factory.getProfile().npcMoveExceptions, undefined)
  rejected(factory.validateTeam([set('Charizard', 'Blaze', ['Growl'], { level: 50 })]), 'LEVEL')
  assert.equal(createEngineFactory().getProfile().team.size, 6)
  assert.equal(createEngineFactory({ profileId: 'gen3regionalleaguev1' }).getProfile().team.distinctBaseSpecies, false)
})

test('one, five and six survivors open at exact supplied HP, with full opponent HP and fresh PP', t => {
  const maximums = [297, 299, 301, 211, 461, 237] // Level 100, zero EVs, 31 IVs.
  for (const size of [6, 5, 1]) {
    const hp = [37, 81, 121, 99, 250, 13].slice(0, size)
    const input = options(members().slice(0, size), harmless(), hp)
    // HP keys are identities, not incoming array order.
    input.initialConditions.p1.reverse()
    const before = structuredClone(input)
    const engine = own(t, factory.create(input))
    assert.deepEqual(input, before)
    assert.deepEqual(engine.getPlayerView('p1').own.team.map(member => member.hp), hp.map((current, index) => ({ current, max: maximums[index] })))
    assert.equal(engine.getPlayerView('p1').own.team.length, size)
    assert.equal(engine.getPlayerView('p2').own.team[0].hp.current, 181)
    assert.equal(engine.getPlayerView('p1').own.team[0].condition, null)
    assert(engine.getDecision('p1').moves.every(move => move.pp === move.maxpp))
    const entry = engine.getEvents('p1').find(event => event.args?.opcode === 'switch' && event.args.fields[0] === 'p1:1')
    assert.equal(entry.args.fields[2], '37/297')
    const enemyEntry = engine.getEvents('p2').find(event => event.args?.opcode === 'switch' && event.args.fields[0] === 'p1:revealed:1')
    assert.notEqual(enemyEntry.args.fields[2], '37/297', 'private exact HP must not leak to the opponent')
    assert.deepEqual(engine.exportReplay().initial.initialConditions, conditions(hp))
  }
})

test('only Survival accepts complete positive player HP, bounded by engine-calculated maximums', t => {
  for (const profileId of ['gen3opensinglesv1', 'gen3regionalleaguev1']) {
    assert.throws(() => createEngineFactory({ profileId }).create(options(members(), members(), [1, 2, 3, 4, 5, 6])), { code: 'INVALID_INITIAL_CONDITIONS' })
  }
  const baseline = options()
  for (const value of [null, {}, { p2: [{ memberId: 'p2:1', hp: 1 }] }, { p1: [] }, conditions([1]), conditions([1, 2, 3]),
    conditions([0, 1]), conditions([-1, 1]), conditions([1.1, 1]), conditions([NaN, 1]), conditions([Infinity, 1]),
    conditions([Number.MAX_SAFE_INTEGER + 1, 1]), conditions([298, 1]),
    { p1: [{ memberId: 'p1:1', hp: 1 }, { memberId: 'p1:1', hp: 2 }] },
    { p1: [{ memberId: 'p2:1', hp: 1 }, { memberId: 'p1:2', hp: 2 }] },
    { p1: [{ memberId: 'p1:1', hp: 1, condition: 'brn' }, { memberId: 'p1:2', hp: 2 }] },
    { p1: [,,] },
  ]) assert.throws(() => factory.create({ ...baseline, initialConditions: value }), { code: 'INVALID_INITIAL_CONDITIONS' })
  let accessed = false
  for (const value of [
    { get p1() { accessed = true; return [] } },
    { p1: [{ get memberId() { accessed = true; return 'p1:1' }, hp: 1 }, { memberId: 'p1:2', hp: 2 }] },
  ]) assert.throws(() => factory.create({ ...baseline, initialConditions: value }), { code: 'INVALID_INITIAL_CONDITIONS' })
  const accessorArray = conditions([1, 2])
  Object.defineProperty(accessorArray.p1, '0', { enumerable: true, get() { accessed = true; return { memberId: 'p1:1', hp: 1 } } })
  assert.throws(() => factory.create({ ...baseline, initialConditions: accessorArray }), { code: 'INVALID_INITIAL_CONDITIONS' })
  assert.equal(accessed, false)
  const shedinja = [set('Shedinja', 'Wonder Guard', ['Harden'])]
  own(t, factory.create(options(shedinja, harmless(), [1])))
  assert.throws(() => factory.create(options(shedinja, harmless(), [2])), { code: 'INVALID_INITIAL_CONDITIONS' })
  const full = own(t, factory.create(options(members().slice(0, 1), harmless(), null)))
  assert.equal(full.getPlayerView('p1').own.team[0].hp.current, 297)
})

test('terminal extraction uses permanent names after vendor switches reorder the party', t => {
  const engine = own(t, factory.create(options(members().slice(0, 3), harmless(), [37, 81, 130])))
  assert.throws(() => engine.getTerminalRoster('p1'), { code: 'MATCH_NOT_FINISHED' })
  assert.throws(() => engine.getTerminalRoster('p3'), { code: 'INVALID_SEAT' })
  turn(engine, 'switch-three', { kind: 'switch', memberId: 'p1:3' })
  turn(engine, 'switch-two', { kind: 'switch', memberId: 'p1:2' })
  assert.equal(engine.getPlayerView('p1').own.active, 'p1:2')
  engine.adjudicate({ kind: 'forfeit', seat: 'p2' })
  const expected = [
    { memberId: 'p1:1', hp: 37, maxHp: 297, fainted: false },
    { memberId: 'p1:2', hp: 81, maxHp: 299, fainted: false },
    { memberId: 'p1:3', hp: 130, maxHp: 301, fainted: false },
  ]
  assert.deepEqual(engine.getTerminalRoster('p1'), expected)
  const detached = engine.getTerminalRoster('p1')
  detached[0].hp = 0
  detached.pop()
  assert.deepEqual(engine.getTerminalRoster('p1'), expected)
  for (const recovered of [factory.restore(engine.exportCheckpoint()), factory.replay(engine.exportReplay())]) {
    own(t, recovered)
    assert.deepEqual(recovered.getTerminalRoster('p1'), expected)
    assert.deepEqual(views(recovered), views(engine))
  }
})

test('actual engine defeat reports exact zero HP and fainting instead of relying on the last owner request', t => {
  const engine = own(t, factory.create(options(members().slice(0, 1), [set('Gengar', 'Levitate', ['Night Shade'])], [1])))
  turn(engine, 'knockout')
  assert.deepEqual(engine.getPlayerView('p1').result, { kind: 'win', winnerSeat: 'p2', reason: 'battle' })
  assert.deepEqual(engine.getTerminalRoster('p1'), [{ memberId: 'p1:1', hp: 0, maxHp: 297, fainted: true }])
  for (const recovered of [factory.restore(engine.exportCheckpoint()), factory.replay(engine.exportReplay())]) {
    own(t, recovered)
    assert.deepEqual(recovered.getTerminalRoster('p1'), engine.getTerminalRoster('p1'))
  }
})

test('Transform retains original identity and max HP in terminal extraction', t => {
  const engine = own(t, factory.create(options([set('Ditto', 'Limber', ['Transform'])], [set('Vaporeon', 'Water Absorb', ['Haze'])], [37])))
  turn(engine, 'transform')
  assert.equal(engine.getPlayerView('p1').own.team[0].species, 'Vaporeon')
  engine.adjudicate({ kind: 'draw' })
  assert.deepEqual(engine.getTerminalRoster('p1'), [{ memberId: 'p1:1', hp: 37, maxHp: 237, fainted: false }])
  for (const recovered of [factory.restore(engine.exportCheckpoint()), factory.replay(engine.exportReplay())]) {
    own(t, recovered)
    assert.deepEqual(recovered.getTerminalRoster('p1'), engine.getTerminalRoster('p1'))
  }
})

test('recreating a survivor from its original set restores PP, starting item and clean temporary state', t => {
  const original = [set('Charizard', 'Blaze', ['Rest', 'Growl'], { item: 'Chesto Berry' })]
  const engine = own(t, factory.create(options(original, [set('Blastoise', 'Torrent', ['Tail Whip'])], [37])))
  turn(engine, 'rest')
  assert.equal(engine.getPlayerView('p1').own.team[0].item, '')
  assert.equal(engine.getPlayerView('p1').own.team[0].stages.def, -1)
  assert(engine.getDecision('p1').moves[0].pp < engine.getDecision('p1').moves[0].maxpp)
  engine.adjudicate({ kind: 'forfeit', seat: 'p2' })
  const terminal = engine.getTerminalRoster('p1')
  const next = own(t, factory.create(options(original, harmless(), terminal.map(member => member.hp))))
  const member = next.getPlayerView('p1').own.team[0]
  assert.equal(member.item, 'chestoberry')
  assert.equal(member.condition, null)
  assert.deepEqual(member.stages, {})
  assert.deepEqual(member.volatiles, [])
  assert(next.getDecision('p1').moves.every(move => move.pp === move.maxpp))
  assert.equal(member.hp.current, terminal[0].hp)
})

test('replay and checkpoint preserve exact initial HP, Hidden Power and pending choices', t => {
  const p1 = [set('Alakazam', 'Synchronize', ['Hidden Power', 'Recover'])]
  const engine = own(t, factory.create(options(p1, [set('Vaporeon', 'Water Absorb', ['Haze'])], [81])))
  const first = action(engine, 'p1', 'pending-hp')
  engine.submitDecision('p1', first)
  const recovered = [own(t, factory.restore(engine.exportCheckpoint())), own(t, factory.replay(engine.exportReplay()))]
  for (const copy of recovered) {
    assert.deepEqual(views(copy), views(engine))
    assert.deepEqual(events(copy), events(engine))
    assert.deepEqual(copy.submitDecision('p1', first), engine.submitDecision('p1', first))
  }
  const opponent = action(engine, 'p2', 'complete-hp')
  for (const copy of [engine, ...recovered]) {
    assert.equal(copy.submitDecision('p2', opponent).accepted, true)
    copy.adjudicate({ kind: 'forfeit', seat: 'p2' })
  }
  for (const copy of recovered) {
    assert.deepEqual(views(copy), views(engine))
    assert.deepEqual(events(copy), events(engine))
    assert.deepEqual(copy.getTerminalRoster('p1'), engine.getTerminalRoster('p1'))
    assert.deepEqual(JSON.parse(copy.exportCheckpoint()), JSON.parse(engine.exportCheckpoint()))
  }
})

test('canonical Hidden Power recovery works for existing profiles without accepting hpType in editable teams', t => {
  for (const profileId of ['gen3opensinglesv1', 'gen3regionalleaguev1']) {
    const older = createEngineFactory({ profileId })
    const team = members()
    team[0].moves = ['Hidden Power']
    const engine = own(t, older.create({ seed, matchId: 'existing-hidden-power', teams: { p1: team, p2: members() } }))
    assert.equal(engine.exportReplay().initial.teams.p1[0].hpType, 'Dark')
    rejected(older.validateTeam(engine.exportReplay().initial.teams.p1), 'UNKNOWN_FIELD')
    for (const copy of [older.restore(engine.exportCheckpoint()), older.replay(engine.exportReplay())]) {
      own(t, copy)
      assert.deepEqual(views(copy), views(engine))
    }
  }
})

test('recovery rejects malformed initial HP and altered derived Hidden Power metadata', t => {
  const engine = own(t, factory.create(options([set('Alakazam', 'Synchronize', ['Hidden Power'])], harmless(), [37])))
  for (const hp of [0, 252, '37']) {
    const replay = engine.exportReplay()
    replay.initial.initialConditions.p1[0].hp = hp
    assert.throws(() => factory.replay(replay), { code: 'INVALID_INITIAL_CONDITIONS' })
    const checkpoint = rewriteCheckpoint(engine.exportCheckpoint(), payload => { payload.initial.initialConditions.p1[0].hp = hp })
    assert.throws(() => factory.restore(checkpoint), { code: 'INVALID_INITIAL_CONDITIONS' })
  }
  const replay = engine.exportReplay()
  replay.initial.teams.p1[0].hpType = 'Ice'
  assert.throws(() => factory.replay(replay), { code: 'INVALID_RECORD' })
  const checkpoint = rewriteCheckpoint(engine.exportCheckpoint(), payload => { payload.initial.teams.p1[0].hpType = 'Ice' })
  assert.throws(() => factory.restore(checkpoint), { code: 'INVALID_RECORD' })
})

test('a Survival checkpoint registers and restores its format and HP in a fresh Node process', t => {
  const engine = own(t, factory.create(options()))
  engine.submitDecision('p1', action(engine, 'p1', 'survival-fresh-process'))
  const url = new URL('../src/index.js', import.meta.url).href
  const script = `import fs from 'node:fs'; import {createEngineFactory} from ${JSON.stringify(url)}; const engine=createEngineFactory({profileId:${JSON.stringify(PROFILE)}}).restore(fs.readFileSync(0,'utf8')); process.stdout.write(JSON.stringify([engine.getPlayerView('p1'),engine.getPlayerView('p2')])); engine.dispose();`
  assert.deepEqual(JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { input: engine.exportCheckpoint(), encoding: 'utf8' })), views(engine))
  const older = createEngineFactory()
  assert.throws(() => older.restore(engine.exportCheckpoint()), { code: 'INCOMPATIBLE_CHECKPOINT' })
  assert.throws(() => older.replay(engine.exportReplay()), { code: 'INCOMPATIBLE_REPLAY' })
})
