import test from 'node:test'
import assert from 'node:assert/strict'
import { GEN3 } from '@battle/game-data'
import { createEngineFactory } from '@battle/battle-engine'
import { createRandomTeamGenerator } from '../apps/server/teams/random-team.js'
import { editableTeam } from '../apps/server/teams/selection.js'
import collection from '../apps/server/teams/starter-sets.generated.json' with { type: 'json' }
import { PRESET_TEAMS } from '../apps/server/presets.js'

const factory = createEngineFactory()
const blank = () => Array.from({ length: 6 }, () => ({}))
const request = (team = blank(), lockedSlots = []) => ({ team, lockedSlots })
function seeded(seed) {
  let state = seed >>> 0
  return max => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) % max }
}
const generator = (seed = 1234) => createRandomTeamGenerator({ validateTeam: factory.validateTeam, randomInt: seeded(seed) })
const frozen = value => { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value) }; return value }

test('generation is reproducible, detached and legal for six distinct base species', () => {
  const a = generator(), b = generator()
  const input = frozen(request())
  for (let iteration = 0; iteration < 30; iteration++) {
    const first = a.generate(input), second = b.generate(input)
    assert.deepEqual(first, second)
    assert.equal(first.valid, true, JSON.stringify(first.errors))
    assert.equal(first.team.length, 6)
    assert.equal(new Set(first.team.map(set => set.species)).size, 6)
    assert.equal(factory.validateTeam(first.team).valid, true)
    assert(first.team.every(set => set.level === 100 && !Object.hasOwn(set, 'hpType')))
    assert.deepEqual(Object.keys(first).sort(), ['changes', 'collection', 'errors', 'team', 'valid'])
    assert.equal(first.collection.speciesCount, 386)
  }
  assert.deepEqual(input, request())
})

test('sampling weights base species equally, independently of template and form counts', () => {
  const custom = structuredClone(collection)
  custom.entries.push(structuredClone(custom.entries.find(entry => entry.speciesId === GEN3.species[0].id)))
  const ranges = []
  const result = createRandomTeamGenerator({ validateTeam: factory.validateTeam, collection: custom,
    randomInt: max => { ranges.push(max); return 0 } }).generate(request())
  assert.equal(result.valid, true)
  assert.deepEqual(result.team.map(set => set.species), GEN3.species.slice(0, 6).map(species => species.name))
  assert.deepEqual(ranges.filter((_, index) => index % 2 === 0), [386, 385, 384, 383, 382, 381])
  assert.equal(ranges[1], 2)
})

test('one through five locks preserve the complete latest edited set and slot', () => {
  const source = structuredClone(PRESET_TEAMS[0].team)
  source[4].nature = 'Timid'
  source[4].ivs.atk = 0
  source[4].evs = { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 }
  for (let count = 1; count <= 5; count++) {
    const locks = Array.from({ length: count }, (_, i) => 5 - i)
    const input = frozen(request(structuredClone(source), locks))
    const result = generator(count + 1).generate(input)
    assert.equal(result.valid, true, JSON.stringify(result.errors))
    for (const slot of locks) assert.deepEqual(result.team[slot], source[slot])
    assert.equal(factory.validateTeam(result.team).valid, true)
    result.team[locks[0]].moves[0] = 'Changed'
    assert.deepEqual(input.team, source)
  }
})

test('invalid locks, duplicate base species and meaningful form normalization fail atomically', () => {
  const source = structuredClone(PRESET_TEAMS[0].team), before = structuredClone(source)
  source[0].moves = ['Surf']
  const invalid = generator().generate(request(source, [0]))
  assert.equal(invalid.valid, false)
  assert.equal(invalid.team, null)
  assert(invalid.errors.length)
  assert.deepEqual(source[1], before[1])
  const duplicates = structuredClone(before)
  duplicates[1] = structuredClone(duplicates[0])
  assert.equal(generator().generate(request(duplicates, [0, 1])).errors[0].code, 'SPECIES_CLAUSE')
  const transformed = structuredClone(before)
  transformed[0] = { species: 'Castform-Sunny', ability: 'Forecast', nature: 'Modest', moves: ['Weather Ball'] }
  const changed = generator().generate(request(transformed, [0]))
  assert.equal(changed.valid, false)
  assert.equal(changed.team, null)
  assert(changed.errors.some(error => error.code === 'LOCKED_SET_CHANGED'))
  assert.equal(generator().generate(request(before, [0, 1, 2, 3, 4, 5])).errors[0].code, 'ALL_LOCKED')
})

test('a locked Hidden Power set survives draft, normalization, reroll and actual engine creation', () => {
  const source = structuredClone(PRESET_TEAMS[0].team)
  source[0].moves = ['Flamethrower', 'Hidden Power', 'Fly', 'Rest']
  source[0].ivs = { hp: 31, atk: 30, def: 30, spa: 31, spd: 31, spe: 31 }
  const checked = factory.validateTeam(source)
  assert.equal(checked.valid, true)
  assert(Object.hasOwn(checked.team[0], 'hpType'))
  const editable = editableTeam(checked.team)
  assert.equal(Object.hasOwn(editable[0], 'hpType'), false)
  assert.deepEqual(editable[0].ivs, source[0].ivs)
  const rolled = generator().generate(request(editable, [0]))
  assert.equal(rolled.valid, true, JSON.stringify(rolled.errors))
  assert.deepEqual(rolled.team[0], editable[0])
  const engine = factory.create({ matchId: 'generated-roundtrip', teams: { p1: rolled.team, p2: PRESET_TEAMS[1].team } })
  try { assert.equal(engine.getPlayerView('p1').own.team.length, 6) } finally { engine.dispose() }
})

test('locked catalog IDs and unconventional legal sets remain allowed', () => {
  const source = structuredClone(PRESET_TEAMS[0].team)
  source[0].species = 'charizard'
  source[0].moves = ['rest']
  source[0].item = ''
  source[0].evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  const output = generator().generate(request(source, [0]))
  assert.equal(output.valid, true, JSON.stringify(output.errors))
  assert.deepEqual(output.team[0], source[0])
})

test('meaningful locked normalization reports proposed values without applying them', () => {
  const source = structuredClone(PRESET_TEAMS[0].team)
  source[0].moves = ['Hidden Power Ice', 'Flamethrower']
  const output = generator().generate(request(source, [0]))
  assert.equal(output.valid, false)
  assert.equal(output.errors[0].code, 'LOCKED_SET_CHANGED')
  assert(output.changes.some(change => change.field === 'ivs.atk' && change.before === 31 && change.after === 30))
  assert.match(output.errors[0].message, /31 → 30/)
  assert.equal(source[0].ivs.atk, 31)
  assert.equal(output.team, null)
})

test('invalid collection results never trigger resampling species or partial output', () => {
  let validations = 0, randomCalls = 0
  const service = createRandomTeamGenerator({ validateTeam: () => { validations++; return { valid: false, errors: [{ code: 'GEN3_LEGALITY', message: 'Invalid sample.' }] } },
    randomInt: () => { randomCalls++; return 0 } })
  const output = service.generate(request())
  assert.equal(output.valid, false)
  assert.equal(output.team, null)
  assert.equal(validations, 1)
  assert.equal(randomCalls, 12)
})

test('untrusted generation input cannot invoke accessors or bypass shape and size bounds', () => {
  let accessed = 0
  const input = request()
  Object.defineProperty(input.team[0], 'species', { enumerable: true, get() { accessed++; return 'Charizard' } })
  assert.equal(generator().generate(input).valid, false)
  assert.equal(accessed, 0)
  for (const value of [null, {}, { ...request(), seed: 3 }, request([], []), request(blank(), [0, 0]),
    request(blank(), [-1]), request(blank(), [6]), request(blank(), ['1']), request(blank(), [1.2]),
    request(Array.from({ length: 6 }, () => ({ species: 'x'.repeat(257) })))]) {
    assert.equal(generator().generate(value).valid, false)
  }
  const unsafe = JSON.parse('{"team":[{"__proto__":{}},{},{},{},{},{}],"lockedSlots":[]}')
  assert.equal(generator().generate(unsafe).valid, false)
  const inherited = Object.create({ team: blank(), lockedSlots: [] })
  assert.equal(generator().generate(inherited).valid, false)
})
