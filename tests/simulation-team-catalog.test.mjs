import test from 'node:test'
import assert from 'node:assert/strict'
import { GEN3, getLearnset } from '@battle/game-data'
import { getTeamBuilderCatalog } from '../apps/server/team-builder.js'

test('team builder exposes all 386 base species and only selectable Gen 3 forms', () => {
  const catalog = getTeamBuilderCatalog()
  assert.equal(catalog.generation, 3)
  const bases = catalog.species.filter(species => species.kind === 'base')
  assert.equal(bases.length, 386)
  assert.deepEqual(bases.map(species => species.num).sort((a, b) => a - b), Array.from({ length: 386 }, (_, index) => index + 1))
  const expected = [...GEN3.species, ...GEN3.forms.filter(form => !form.battleOnly.length)]
  assert.deepEqual(catalog.species.map(species => species.id), expected.map(species => species.id))
  for (const [index, species] of catalog.species.entries()) {
    const source = expected[index]
    assert.equal(species.baseSpeciesId, source.baseSpeciesId)
    assert.deepEqual(species.types, source.types)
    assert.deepEqual(species.abilities, [...new Set(Object.values(source.abilities))])
    assert(!Object.hasOwn(species, 'events'), 'acquisition details do not belong in compact editor choices')
  }
  assert(catalog.species.some(species => species.id === 'deoxysattack'))
  assert(catalog.species.some(species => species.id === 'unownquestion'))
  assert(!catalog.species.some(species => species.id === 'castformsunny'))
  assert.deepEqual(catalog.rules, { teamSize: 6, level: 100, maxMoves: 4, maxEv: 255, totalEvs: 510, maxIv: 31 })
})

test('candidate moves are exactly imported learnset unions including Sketch, with no invented moves', () => {
  const catalog = getTeamBuilderCatalog()
  const knownMoves = new Set(GEN3.moves.map(move => move.id))
  for (const species of catalog.species) {
    const learnset = getLearnset(species.id)
    const expected = [...new Set([...learnset.sources.map(source => source.moveId), ...learnset.sketchMoveIds])].sort()
    assert.deepEqual(species.moveIds, expected, species.id)
    assert(species.moveIds.every(id => knownMoves.has(id)), `${species.id} refers to a move outside the Gen 3 package`)
  }
  const smeargle = catalog.species.find(species => species.id === 'smeargle')
  assert(smeargle.moveIds.includes('sketch'))
  assert(smeargle.moveIds.includes('explosion'))
  assert(!smeargle.moveIds.includes('struggle'))
  assert(!smeargle.moveIds.includes('roost'))
  const pikachu = catalog.species.find(species => species.id === 'pikachu')
  assert(pikachu.moveIds.includes('surf') && pikachu.moveIds.includes('fly'), 'candidates do not pretend that incompatible event moves form one legal set')
})

test('item, move, ability and nature choices preserve the pinned data and exclude capture balls', () => {
  const catalog = getTeamBuilderCatalog()
  assert.deepEqual(catalog.moves, GEN3.moves.map(({ id, name, type, category, pp, shortDesc }) => ({ id, name, type, category, pp, shortDesc })))
  assert.deepEqual(catalog.abilities, GEN3.abilities.map(({ id, name, shortDesc }) => ({ id, name, shortDesc })))
  assert.deepEqual(catalog.items, GEN3.items.filter(item => !item.isPokeball).map(({ id, name, shortDesc }) => ({ id, name, shortDesc })))
  assert.deepEqual(catalog.natures, GEN3.natures.map(({ id, name, plus, minus }) => ({ id, name, plus, minus })))
  assert(!catalog.items.some(item => item.id === 'pokeball'))
  assert(catalog.items.some(item => item.id === 'leftovers'))
})

test('the lazy cached catalog is immutable and does not alter the source package', () => {
  const before = JSON.stringify(GEN3)
  const catalog = getTeamBuilderCatalog()
  assert.equal(getTeamBuilderCatalog(), catalog)
  assert.notEqual(catalog.species[0].types, GEN3.species[0].types)
  assert.notEqual(catalog.moves[0], GEN3.moves[0])
  assert.throws(() => { catalog.species[0].moveIds.push('roost') }, TypeError)
  assert.throws(() => { catalog.species[0].types[0] = 'fairy' }, TypeError)
  assert.throws(() => { catalog.rules.teamSize = 1 }, TypeError)
  assert.equal(JSON.stringify(GEN3), before)
})
