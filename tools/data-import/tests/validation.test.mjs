import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extractGen3 } from '../extract.mjs'
import { validateGen3 } from '../validate.mjs'

const require = createRequire(import.meta.url)
const { Dex } = require('pokemon-showdown')
const source = JSON.parse(readFileSync(new URL('../source-lock.json', import.meta.url), 'utf8'))
const { data } = extractGen3(Dex.mod('gen3'), source)
const changed = mutation => { const copy = structuredClone(data); mutation(copy); return copy }
const learnset = (value, id) => value.learnsets.find(row => row.id === id)
const move = (value, id) => value.moves.find(row => row.id === id)

test('validates the complete pinned metadata projection without mutating it or claiming team legality', () => {
  const before = JSON.stringify(data)
  const report = validateGen3(data)
  assert.deepEqual(report.counts, { species: 386, forms: 33, moves: 354, items: 106, captureBalls: 20, abilities: 76, natures: 25, types: 17, learnsets: 419 })
  assert.equal(report.valid, true)
  assert.equal(report.checks.completeTeamLegality, false)
  assert.ok(report.checks.sourceRows > 30000)
  assert.equal(report.checks.candidatePairs, 20186)
  assert.deepEqual(validateGen3(data), report)
  assert.equal(JSON.stringify(data), before)
})

test('rejects incomplete tables, duplicate IDs, and a missing National Dex number', () => {
  assert.throws(() => validateGen3(changed(d => d.species.pop())), /exactly 386/)
  assert.throws(() => validateGen3(changed(d => { d.moves[1].id = d.moves[0].id })), /duplicate values/)
  assert.throws(() => validateGen3(changed(d => { d.species[1].num = d.species[0].num })), /National Dex/)
})

test('rejects future content and dangling species, ability, or move references', () => {
  assert.throws(() => validateGen3(changed(d => { d.forms[0].upstreamGeneration = 6 })), /upstreamGeneration/)
  assert.throws(() => validateGen3(changed(d => { move(d, 'flamethrower').introducedGeneration = 9 })), /introducedGeneration/)
  assert.throws(() => validateGen3(changed(d => { d.species[0].evos.push('venusaurmega') })), /unresolved reference/)
  assert.throws(() => validateGen3(changed(d => { d.species[0].abilities.H = 'chlorophyll' })), /hidden abilities/)
  assert.throws(() => validateGen3(changed(d => { d.species[0].abilities[0] = 'missingability' })), /unresolved reference/)
  assert.throws(() => validateGen3(changed(d => { d.learnsets[0].sources[0].moveId = 'moonblast' })), /unresolved reference/)
})

test('rejects malformed or foreign-generation sources and broken original event indices', () => {
  for (const source of ['2M', '4M', '3C', '3M2', '3S', '3L101']) {
    assert.throws(() => validateGen3(changed(d => { d.learnsets[0].sources[0].source = source })), /source grammar|\.level/)
  }
  assert.throws(() => validateGen3(changed(d => {
    const row = learnset(d, 'pikachu')
    const entry = row.sources.find(item => item.speciesId === 'pikachu' && item.source === '3S10')
    assert.ok(entry, 'fixture exercises a multi-digit original event index')
    row.events = row.events.filter(item => item.speciesId !== 'pikachu' || item.index !== 10)
  })), /unresolved original event index/)
  assert.throws(() => validateGen3(changed(d => {
    const row = learnset(d, 'bulbasaur')
    const entry = row.sources.find(item => item.source === '3S0' && item.moveId === 'growth')
    assert.ok(entry)
    entry.source = '3S1'
  })), /event index does not contain/)
  assert.throws(() => validateGen3(changed(d => { d.learnsets.find(row => row.events.length).events[0].data.generation = 4 })), /acquisition source is not Gen 3/)
  assert.throws(() => validateGen3(changed(d => { d.learnsets.find(row => row.events.length).events[0].data.pokeball = 'cherishball' })), /pokeball.*unresolved reference/)
  assert.throws(() => validateGen3(changed(d => { d.captureBalls.find(row => row.id === 'safariball').upstreamNonstandard = null })), /Safari Ball must preserve/)
})

test('rejects duplicate sources, invalid ancestry, and fabricated Sketch expansions', () => {
  assert.throws(() => validateGen3(changed(d => { d.learnsets[0].sources.push({ ...d.learnsets[0].sources[0] }) })), /duplicate move source/)
  assert.throws(() => validateGen3(changed(d => { d.learnsets[0].sources[0].speciesId = 'deoxys' })), /outside ancestry/)
  assert.throws(() => validateGen3(changed(d => { learnset(d, 'ditto').sketchMoveIds = ['explosion'] })), /Sketch expansion/)
  assert.throws(() => validateGen3(changed(d => { learnset(d, 'smeargle').sketchMoveIds.push('struggle') })), /not Sketchable/)
  assert.throws(() => validateGen3(changed(d => { learnset(d, 'smeargle').sketchMoveIds.pop() })), /353 Sketch candidates/)
})

test('catches modern metadata, a damaged type chart, and the wrong Hidden Power placeholder', () => {
  assert.throws(() => validateGen3(changed(d => { move(d, 'curse').type = 'ghost' })), /Curse must retain/)
  assert.throws(() => validateGen3(changed(d => { move(d, 'flamethrower').basePower = 90 })), /Flamethrower/)
  assert.throws(() => validateGen3(changed(d => { move(d, 'hiddenpower').name = 'Hidden Power Water'; move(d, 'hiddenpower').type = 'water' })), /canonical variable-power/)
  assert.throws(() => validateGen3(changed(d => { d.types.find(row => row.id === 'steel').damageTaken.ghost = 1 })), /Steel must resist/)
  assert.throws(() => validateGen3(changed(d => { delete d.types[0].damageTaken.normal })), /17 attacking types/)
  assert.throws(() => validateGen3(changed(d => { d.types[0].damageTaken.normal = 4 })), /single-type damage multiplier/)
})

test('rejects non-JSON data, malformed stat ranges, and false capability claims', () => {
  assert.throws(() => validateGen3(changed(d => { d.moves[0].callback = () => {} })), /non-JSON value/)
  assert.throws(() => validateGen3(changed(d => { d.species[0].baseStats.hp = NaN })), /nonfinite number/)
  assert.throws(() => validateGen3(changed(d => { d.species[0].baseStats.hp = 0 })), /baseStats.hp/)
  assert.throws(() => validateGen3(changed(d => { d.capabilities.teamValidation = true })), /must not claim/)
})
