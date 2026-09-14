import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { extractGen3 } from '../extract.mjs'

const require = createRequire(new URL('../package.json', import.meta.url))
const { Dex } = require('pokemon-showdown')
const dex = Dex.mod('gen3')
const source = JSON.parse(readFileSync(new URL('../source-lock.json', import.meta.url)))

function changedSpecies(change) {
  return {
    gen: 3, types: dex.types, moves: dex.moves, items: dex.items,
    abilities: dex.abilities, natures: dex.natures,
    species: {
      all: () => dex.species.all().map(row => row.id === 'bulbasaur' ? { ...row, ...change } : row),
      get: dex.species.get.bind(dex.species),
      getFullLearnset: dex.species.getFullLearnset.bind(dex.species),
      getMovePool: dex.species.getMovePool.bind(dex.species),
    },
  }
}

test('unknown upstream relationships fail instead of being silently classified as future content', () => {
  assert.throws(() => extractGen3(changedSpecies({ prevo: 'nonexistent-upstream-species' }), source), /Unknown upstream species relationship bulbasaur.prevo/)
})

test('missing required upstream values are rejected without fallback or invented defaults', () => {
  assert.throws(() => extractGen3(changedSpecies({ baseStats: undefined }), source), /Missing required upstream field bulbasaur.baseStats/)
})

test('legitimate future relationships are omitted with their original owner and field recorded', () => {
  const { data, audit } = extractGen3(changedSpecies({ evos: [...dex.species.get('bulbasaur').evos, 'Sylveon'] }), source)
  assert.deepEqual(data.species.find(row => row.id === 'bulbasaur').evos, ['ivysaur'])
  assert.ok(audit.omittedRelationships.some(row => row.speciesId === 'bulbasaur' && row.field === 'evos' && row.referencedId === 'sylveon'))
})
