import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { createEngineFactory } from '../src/index.js'
import { PRESET_TEAMS } from '../../../apps/server/presets.js'

const LEAGUE_ID = 'gen3regionalleaguev1'
const OPEN_ID = 'gen3opensinglesv1'
const open = createEngineFactory()
const league = createEngineFactory({ profileId: LEAGUE_ID })
const team = () => structuredClone(PRESET_TEAMS[0].team)
const repeatedTeam = size => Array.from({ length: size }, () => team()[0])
const options = (teams = { p1: team().slice(0, 2), p2: team().slice(0, 2) }) => ({
  matchId: 'league-test', seed: [1, 2, 3, 4], teams,
})
const own = (t, engine) => { t.after(() => engine.dispose()); return engine }
const views = engine => ['p1', 'p2'].map(seat => engine.getPlayerView(seat))
const events = engine => ['p1', 'p2'].map(seat => engine.getEvents(seat))
const command = (engine, seat, commandId, action = { kind: 'move', slot: 1 }) => ({
  commandId, decisionId: engine.getDecision(seat).id, action,
})
const rejected = (validation, code) => {
  assert.equal(validation.valid, false)
  assert.equal(validation.team, null)
  assert(validation.errors.some(error => error.code === code), JSON.stringify(validation.errors))
}
const murkrow = () => ({
  species: 'Murkrow', ability: 'Insomnia', nature: 'Hardy', level: 100,
  moves: ['Quick Attack', 'Whirlwind', 'Pursuit', 'Faint Attack'],
})
const withMurkrow = () => {
  const members = team()
  members[0] = murkrow()
  return members
}
const moveIds = moves => moves.map(move => move.toLowerCase().replace(/[^a-z0-9]/g, '').replace('faintattack', 'feintattack'))

test('league permits one through six members and duplicate species without changing Open Singles', () => {
  for (let size = 1; size <= 6; size++) {
    const input = repeatedTeam(size)
    const before = structuredClone(input)
    const validated = league.validateTeam(input)
    assert.equal(validated.valid, true, JSON.stringify(validated.errors))
    assert.equal(validated.team.length, size)
    assert.deepEqual(input, before, 'normalization must not mutate the submitted roster')
    rejected(open.validateTeam(input), size === 6 ? 'SPECIES_CLAUSE' : 'TEAM_SIZE')
  }
  for (const input of [[], repeatedTeam(7)]) rejected(league.validateTeam(input), 'TEAM_SIZE')
  assert.equal(open.validateTeam(team()).valid, true)
  assert.equal(open.getProfile().id, OPEN_ID)
  assert.equal(open.getProfile().team.size, 6)
  assert.equal(open.getProfile().team.distinctBaseSpecies, true)
  assert.equal(league.getProfile().id, LEAGUE_ID)
  assert.equal(league.getProfile().team.distinctBaseSpecies, false)
  assert.throws(() => createEngineFactory({ profileId: 'gen3anythinggoes' }), /Unknown battle profile/)
})

test('league retains Gen 3 move, ability, level and complete-set legality for both seats', () => {
  for (const [change, code] of [
    [member => { member.moves = ['Thunderbolt'] }, 'GEN3_LEGALITY'],
    [member => { member.moves = ['Roost'] }, 'GEN3_LEGALITY'],
    [member => { member.ability = 'Solar Power' }, 'GEN3_LEGALITY'],
    [member => { member.level = 50 }, 'LEVEL'],
    [member => { member.evs = { hp: 255, atk: 255, spe: 1 } }, 'EV_TOTAL'],
    [member => { member.moves = ['Flamethrower', 'flamethrower'] }, 'DUPLICATE_MOVE'],
  ]) {
    const input = team().slice(0, 1)
    change(input[0])
    rejected(league.validateTeam(input), code)
    rejected(league.validateOpponentTeam(input), code)
  }
  const incompatible = [{ species: 'Pikachu', ability: 'Static', nature: 'Hardy', moves: ['Surf', 'Fly'] }]
  rejected(league.validateTeam(incompatible), 'GEN3_LEGALITY')
  rejected(league.validateOpponentTeam(incompatible), 'GEN3_LEGALITY')
})

test('same-species team members retain distinct private and public identities through switches', t => {
  const engine = own(t, league.create(options({ p1: repeatedTeam(2), p2: repeatedTeam(2) })))
  assert.deepEqual(engine.getPlayerView('p1').own.team.map(member => member.memberId), ['p1:1', 'p1:2'])
  assert.equal(engine.getPlayerView('p1').opponent.known.length, 1, 'the reserve duplicate stays unrevealed')
  for (const target of [2, 1]) {
    for (const seat of ['p1', 'p2']) {
      const choice = command(engine, seat, `switch-${target}-${seat}`, { kind: 'switch', memberId: `${seat}:${target}` })
      assert.equal(engine.submitDecision(seat, choice).accepted, true)
    }
    const view = engine.getPlayerView('p1')
    assert.equal(view.complete, true)
    assert.equal(view.own.active, `p1:${target}`)
    assert.equal(view.opponent.active, `p2:revealed:${target}`)
    assert.equal(view.opponent.known.length, 2)
    assert.equal(new Set(view.opponent.known.map(member => member.memberId)).size, 2)
    assert(view.opponent.known.every(member => member.species === 'Charizard'))
    assert(!JSON.stringify(view.opponent).includes('p2-2'), 'public identities must not expose private party tokens')
  }
})

test('coexisting profiles use distinct identities and reject each other’s recovery artifacts', t => {
  const standard = own(t, open.create(options({ p1: team(), p2: team() })))
  const regional = own(t, league.create(options()))
  assert.equal(standard.getIdentity().format.id, OPEN_ID)
  assert.equal(regional.getIdentity().format.id, LEAGUE_ID)
  assert.notEqual(standard.getIdentity().fingerprint, regional.getIdentity().fingerprint)
  for (const [factory, foreign] of [[open, regional], [league, standard]]) {
    assert.throws(() => factory.restore(foreign.exportCheckpoint()), { code: 'INCOMPATIBLE_CHECKPOINT' })
    assert.throws(() => factory.replay(foreign.exportReplay()), { code: 'INCOMPATIBLE_REPLAY' })
  }
  assert.equal(createEngineFactory().getIdentity().fingerprint, open.getIdentity().fingerprint)
  assert.equal(createEngineFactory({ profileId: LEAGUE_ID }).getIdentity().fingerprint, league.getIdentity().fingerprint)
  assert.equal(open.validateTeam(team()).valid, true, 'registering league format cannot change the default validator')
})

test('league pending choices restore and replay with identical views, events and continuation', t => {
  const original = own(t, league.create(options()))
  const pending = command(original, 'p1', 'pending-league')
  assert.equal(original.submitDecision('p1', pending).accepted, true)
  const recovered = [
    own(t, league.restore(original.exportCheckpoint())),
    own(t, league.replay(original.exportReplay())),
  ]
  for (const engine of recovered) {
    assert.deepEqual(views(engine), views(original))
    assert.deepEqual(events(engine), events(original))
    assert.deepEqual(engine.submitDecision('p1', pending), original.submitDecision('p1', pending))
  }
  const opponent = command(original, 'p2', 'complete-league-turn')
  for (const engine of [original, ...recovered]) assert.equal(engine.submitDecision('p2', opponent).accepted, true)
  assert.equal(original.getPlayerView('p1').turn, 2)
  for (const engine of recovered) {
    assert.deepEqual(views(engine), views(original))
    assert.deepEqual(events(engine), events(original))
    assert.deepEqual(JSON.parse(engine.exportCheckpoint()), JSON.parse(original.exportCheckpoint()))
  }
})

test('league checkpoints register their exact format in a fresh Node process', t => {
  const original = own(t, league.create(options()))
  original.submitDecision('p1', command(original, 'p1', 'league-fresh-process'))
  const engineUrl = new URL('../src/index.js', import.meta.url).href
  const script = `import fs from 'node:fs'; import {createEngineFactory} from ${JSON.stringify(engineUrl)}; const e=createEngineFactory({profileId:${JSON.stringify(LEAGUE_ID)}}).restore(fs.readFileSync(0,'utf8')); process.stdout.write(JSON.stringify([e.getIdentity(),e.getPlayerView('p1'),e.getPlayerView('p2')])); e.dispose();`
  const restored = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    input: original.exportCheckpoint(), encoding: 'utf8',
  }))
  assert.deepEqual(restored, [original.getIdentity(), ...views(original)])
})

test('the historical Murkrow moveset is an explicit league-opponent exception only', t => {
  const npc = [murkrow()]
  const original = structuredClone(npc)
  const checked = league.validateOpponentTeam(npc)
  assert.equal(checked.valid, true, JSON.stringify(checked.errors))
  assert.deepEqual(moveIds(checked.team[0].moves), ['quickattack', 'whirlwind', 'pursuit', 'feintattack'])
  assert.deepEqual(npc, original)
  rejected(league.validateTeam(npc), 'GEN3_LEGALITY')
  rejected(open.validateTeam(withMurkrow()), 'GEN3_LEGALITY')
  rejected(open.validateOpponentTeam(withMurkrow()), 'GEN3_LEGALITY')
  assert.throws(() => league.create(options({ p1: npc, p2: team().slice(0, 1) })), { code: 'INVALID_TEAM' })
  assert.throws(() => open.create(options({ p1: team(), p2: withMurkrow() })), { code: 'INVALID_TEAM' })

  const engine = own(t, league.create(options({ p1: team().slice(0, 1), p2: npc })))
  const decision = engine.getDecision('p2')
  assert.deepEqual(moveIds(decision.moves.map(move => move.id)), ['quickattack', 'whirlwind', 'pursuit', 'feintattack'])
  assert.equal(engine.submitDecision('p2', command(engine, 'p2', 'npc-quick-attack')).accepted, true)
  assert.equal(engine.submitDecision('p1', command(engine, 'p1', 'player-flamethrower')).accepted, true)
  assert(engine.getEvents('p1').some(event => event.args?.opcode === 'move' && event.args.fields.includes('Quick Attack')))
  for (const restored of [league.restore(engine.exportCheckpoint()), league.replay(engine.exportReplay())]) {
    own(t, restored)
    assert.deepEqual(views(restored), views(engine))
    assert.deepEqual(events(restored), events(engine))
  }
})

test('the NPC exception cannot bypass other moves, abilities, levels or teammates’ legality', () => {
  for (const change of [
    member => { member.moves = ['Quick Attack'] },
    member => { member.moves[3] = 'Thunderbolt' },
    member => { member.moves[3] = 'Roost' },
    member => { member.ability = 'Prankster' },
    member => { member.species = 'Bulbasaur'; member.ability = 'Overgrow' },
  ]) {
    const input = [murkrow()]
    change(input[0])
    rejected(league.validateOpponentTeam(input), 'GEN3_LEGALITY')
  }
  const wrongLevel = [murkrow()]
  wrongLevel[0].level = 44
  rejected(league.validateOpponentTeam(wrongLevel), 'LEVEL')
  const unrelatedIllegal = [murkrow(), team()[0]]
  unrelatedIllegal[1].moves = ['Thunderbolt']
  rejected(league.validateOpponentTeam(unrelatedIllegal), 'GEN3_LEGALITY')
  const legalMurkrow = [murkrow()]
  legalMurkrow[0].moves = ['Pursuit']
  assert.equal(league.validateTeam(legalMurkrow).valid, true)
})
