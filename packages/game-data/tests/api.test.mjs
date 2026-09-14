import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  GEN3, GEN3_MANIFEST,
  getSpecies, getForm, getMove, getItem, getCaptureBall,
  getAbility, getNature, getType, getLearnset,
} from '@battle/game-data'

const collections = [
  ['species', getSpecies], ['forms', getForm], ['moves', getMove],
  ['items', getItem], ['captureBalls', getCaptureBall],
  ['abilities', getAbility], ['natures', getNature],
  ['types', getType], ['learnsets', getLearnset],
]

test('exports the generated generation-three data and its manifest without a browser', async () => {
  const data = JSON.parse(await readFile(new URL('../data/gen3.json', import.meta.url), 'utf8'))
  const manifest = JSON.parse(await readFile(new URL('../data/manifest.json', import.meta.url), 'utf8'))
  assert.deepEqual(GEN3, data)
  assert.deepEqual(GEN3_MANIFEST, manifest)
  assert.equal(GEN3.schemaVersion, 1)
  assert.equal(GEN3.generation, 3)
  assert.equal(GEN3.source.version, '0.11.11')
})

test('every exact-ID getter returns the corresponding shared record', () => {
  for (const [collection, getRecord] of collections) {
    assert.ok(GEN3[collection].length > 0, collection)
    for (const record of GEN3[collection]) {
      assert.equal(getRecord(record.id), record, `${collection}: ${record.id}`)
    }
  }
})

test('base species and forms are separate lookups', () => {
  for (const species of GEN3.species) assert.equal(getForm(species.id), undefined, species.id)
  for (const form of GEN3.forms) assert.equal(getSpecies(form.id), undefined, form.id)
})

test('capture-ball references remain available separately from standard item records', () => {
  assert.equal(GEN3.captureBalls.length, 20)
  const safariBall = getCaptureBall('safariball')
  assert.equal(safariBall.isPokeball, true)
  assert.equal(safariBall.upstreamNonstandard, 'Unobtainable')
  assert.equal(getItem('safariball'), undefined)
  const golduck = getLearnset('golduck')
  assert.ok(golduck.encounters.some(encounter => encounter.data.pokeball === safariBall.id))
  // These are upstream identity flags, not a complete game-availability rule.
  assert.equal(getCaptureBall('friendball').upstreamNonstandard, null)
})

test('missing IDs and inherited-object names cannot retrieve records', () => {
  for (const [, getRecord] of collections) {
    for (const id of [
      'not-a-real-data-id', '__proto__', 'constructor', 'prototype',
      'toString', 'valueOf', 'hasOwnProperty', '', undefined, null, 1, {}, [], Symbol('id'),
    ]) assert.equal(getRecord(id), undefined)
  }
})

test('getters do not normalize case, spaces, or display names', () => {
  for (const [collection, getRecord] of collections) {
    const record = GEN3[collection][0]
    assert.notEqual(record.id.toUpperCase(), record.id, collection)
    assert.equal(getRecord(record.id.toUpperCase()), undefined, collection)
    assert.equal(getRecord(` ${record.id}`), undefined, collection)
    assert.equal(getRecord(`${record.id} `), undefined, collection)
    assert.equal(getRecord(new String(record.id)), undefined, collection)
    if (record.name && record.name !== record.id) {
      assert.equal(getRecord(record.name), undefined, collection)
    }
  }
})

test('all exported records, nested collections, and provenance are immutable', () => {
  function assertDeeplyFrozen(value) {
    if (value === null || typeof value !== 'object') return
    assert.ok(Object.isFrozen(value))
    for (const child of Object.values(value)) assertDeeplyFrozen(child)
  }
  assertDeeplyFrozen(GEN3)
  assertDeeplyFrozen(GEN3_MANIFEST)
  assert.throws(() => { GEN3.generation = 4 }, TypeError)
  assert.throws(() => { GEN3.source.version = 'changed' }, TypeError)
  assert.throws(() => { GEN3.species.push({ id: 'changed' }) }, TypeError)
  const species = GEN3.species[0]
  const originalId = species.id
  assert.throws(() => { species.id = 'changed' }, TypeError)
  assert.equal(getSpecies(originalId), species)
  assert.equal(getSpecies('changed'), undefined)
})

test('package has no dependencies and exposes only the documented runtime and JSON entries', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.name, '@battle/game-data')
  assert.deepEqual(manifest.dependencies ?? {}, {})
  assert.deepEqual(manifest.peerDependencies ?? {}, {})
  assert.deepEqual(manifest.optionalDependencies ?? {}, {})
  assert.deepEqual(manifest.exports, {
    '.': './src/index.js',
    './gen3.json': './data/gen3.json',
    './manifest.json': './data/manifest.json',
  })
})
