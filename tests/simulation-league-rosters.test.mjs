import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createEngineFactory } from '@battle/battle-engine'
import { getSpecies, getAbility, getMove, getItem } from '@battle/game-data'
import { REGIONAL_LEAGUES } from '../apps/server/league-rosters.js'
import { PRESET_TEAMS } from '../apps/server/presets.js'

const leagueFactory = createEngineFactory({ profileId: 'gen3regionalleaguev1' })
const idOf = name => name.toLowerCase().replace(/[^a-z0-9]/g, '')
const karen = REGIONAL_LEAGUES.find(league => league.id === 'johto').trainers.find(trainer => trainer.id === 'karen')
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

test('regional leagues preserve the selected editions, trainer order, party sizes and duplicate species', () => {
  assert.deepEqual(REGIONAL_LEAGUES.map(league => [league.id, league.edition, league.trainers.map(trainer => trainer.name)]), [
    ['kanto', 'FireRed / LeafGreen', ['Lorelei', 'Bruno', 'Agatha', 'Lance', 'Blue']],
    ['johto', 'Gold / Silver', ['Will', 'Koga', 'Bruno', 'Karen', 'Lance']],
    ['hoenn', 'Ruby / Sapphire', ['Sidney', 'Phoebe', 'Glacia', 'Drake', 'Steven']],
  ])
  assert.equal(REGIONAL_LEAGUES.flatMap(league => league.trainers).flatMap(trainer => trainer.team).length, 78)
  for (const league of REGIONAL_LEAGUES) {
    assert.deepEqual(league.trainers.map(trainer => trainer.team.length), [5, 5, 5, 5, 6])
    assert.deepEqual(league.trainers.map(trainer => trainer.title), ['Elite Four', 'Elite Four', 'Elite Four', 'Elite Four', 'Champion'])
    assert.equal(new Set(league.trainers.map(trainer => trainer.id)).size, 5)
  }
  assert.equal(REGIONAL_LEAGUES[0].trainers[4].team[5].species, 'Blastoise')
  assert.equal(REGIONAL_LEAGUES[0].trainers[1].team.filter(member => member.species === 'Onix').length, 2)
  assert.equal(REGIONAL_LEAGUES[1].trainers[4].team.filter(member => member.species === 'Dragonite').length, 3)
  assert.equal(REGIONAL_LEAGUES[2].trainers[3].team.filter(member => member.species === 'Flygon').length, 2)
})

test('the reviewed roster catalog retains its pinned source content and explicit adaptations', () => {
  // Golden digest of all 78 source-verified slots, including move order, items,
  // provenance levels and chosen Gen 3 stats/abilities. See LEAGUE_ROSTERS.md for
  // independent upstream commits and file hashes. Change this only after an
  // intentional roster revision has been checked against those source blocks.
  // Descriptive UI copy is excluded so wording edits need no fixture revision.
  const normalized = REGIONAL_LEAGUES.map(({ id, edition, trainers }) => ({
    id, edition,
    trainers: trainers.map(({ id, name, title, specialty, sourceParty, originalLevels, team }) => ({
      id, name, title, specialty, sourceParty, originalLevels, team,
    })),
  }))
  assert.equal(createHash('sha256').update(canonical(normalized)).digest('hex'), '89fca33516267109f2a4b4292f739878584b9b4ebdec76b00a64d5703271abba')
})

test('all 15 NPC teams validate under the independent league profile without mutating the fixtures', () => {
  const before = JSON.stringify(REGIONAL_LEAGUES)
  for (const league of REGIONAL_LEAGUES) for (const trainer of league.trainers) {
    const validation = leagueFactory.validateOpponentTeam(trainer.team)
    assert.equal(validation.valid, true, `${league.id}/${trainer.id}: ${JSON.stringify(validation.errors)}`)
    assert.deepEqual(validation.errors, [])
    assert.equal(validation.team.length, trainer.team.length)
    assert.equal(trainer.originalLevels.length, trainer.team.length)
    for (const [index, member] of trainer.team.entries()) {
      const species = getSpecies(idOf(member.species))
      assert.ok(species, member.species)
      assert.equal(member.ability, getAbility(species.abilities['0']).name)
      assert.equal(member.level, 100)
      assert.equal(member.nature, 'Hardy')
      assert.ok(Object.values(member.evs).every(value => value === 0))
      assert.ok(Object.values(member.ivs).every(value => value === 31))
      assert.ok(member.moves.every(move => getMove(idOf(move))))
      if (member.item) assert.ok(getItem(idOf(member.item)))
      assert.ok(Object.isFrozen(member) && Object.isFrozen(member.moves) && Object.isFrozen(member.evs))
      assert.deepEqual(validation.team[index].moves, member.moves)
      assert.deepEqual(validation.team[index].evs, member.evs)
    }
  }
  assert.equal(JSON.stringify(REGIONAL_LEAGUES), before)
})

test('Karen\'s sourced Quick Attack exception is confined to the exact NPC moveset', () => {
  assert.deepEqual(karen.team[3].moves, ['Quick Attack', 'Whirlwind', 'Pursuit', 'Feint Attack'])
  assert.equal(leagueFactory.validateOpponentTeam(karen.team).valid, true)
  const playerResult = leagueFactory.validateTeam(karen.team)
  assert.equal(playerResult.valid, false)
  assert.ok(playerResult.errors.some(error => error.message.includes("Murkrow's move Quick Attack")))

  const changedMoves = structuredClone(karen.team)
  changedMoves[3].moves[1] = 'Peck'
  assert.equal(leagueFactory.validateOpponentTeam(changedMoves).valid, false)

  const wrongSpecies = structuredClone(karen.team)
  wrongSpecies[3].species = 'Sableye'
  wrongSpecies[3].ability = 'Keen Eye'
  assert.equal(leagueFactory.validateOpponentTeam(wrongSpecies).valid, false)

  const invalidAbility = structuredClone(karen.team)
  invalidAbility[3].ability = 'Levitate'
  assert.equal(leagueFactory.validateOpponentTeam(invalidAbility).valid, false)

  const excessiveEvs = structuredClone(karen.team)
  excessiveEvs[3].evs = { hp: 252, atk: 252, def: 252, spa: 0, spd: 0, spe: 0 }
  assert.equal(leagueFactory.validateOpponentTeam(excessiveEvs).valid, false)
})

test('engine creation applies the trainer exception only to p2 and leaves Open Singles unchanged', () => {
  const engine = leagueFactory.create({ teams: { p1: PRESET_TEAMS[0].team, p2: karen.team } })
  engine.dispose()
  assert.throws(() => leagueFactory.create({ teams: { p1: karen.team, p2: PRESET_TEAMS[0].team } }), error => error.code === 'INVALID_TEAM')
  const ordinary = createEngineFactory()
  assert.equal(ordinary.getProfile().id, 'gen3opensinglesv1')
  assert.equal(ordinary.validateTeam(PRESET_TEAMS[0].team).valid, true)
  assert.equal(ordinary.validateOpponentTeam(karen.team).valid, false)
  assert.equal(ordinary.validateTeam(REGIONAL_LEAGUES[0].trainers[0].team).valid, false)
  const duplicates = structuredClone(PRESET_TEAMS[0].team)
  duplicates[5] = structuredClone(duplicates[0])
  assert.equal(ordinary.validateTeam(duplicates).valid, false)
  assert.notEqual(ordinary.getIdentity().fingerprint, leagueFactory.getIdentity().fingerprint)
})
