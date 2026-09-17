import test from 'node:test'
import assert from 'node:assert/strict'
import { getPokemonCry, CRY_CATALOG } from '../../../packages/pokemon-cries/src/index.js'

test('catalog lookup is exact, immutable and shares only explicitly mapped identities', () => {
  assert.equal(Object.keys(CRY_CATALOG.pokemon).length, 419)
  assert.equal(Object.keys(CRY_CATALOG.assets).length, 386)
  assert.equal(getPokemonCry('Bulbasaur'), null)
  assert.equal(getPokemonCry('missing'), null)
  assert.equal(getPokemonCry('__proto__'), null)
  assert.equal(getPokemonCry(1), null)
  assert.equal(getPokemonCry('unownb').assetId, getPokemonCry('unown').assetId)
  assert.equal(getPokemonCry('deoxysattack').assetId, getPokemonCry('deoxys').assetId)
  assert.notEqual(getPokemonCry('deoxysattack').assetId, getPokemonCry('unownb').assetId)
  assert.throws(() => { CRY_CATALOG.pokemon.bulbasaur.assetId = 'edited' }, TypeError)
  assert.throws(() => { getPokemonCry('bulbasaur').url = 'edited' }, TypeError)
})

test('asset base URL supports local/CDN paths and rejects ambiguous or invalid URLs', () => {
  const file = getPokemonCry('bulbasaur').file
  assert.equal(getPokemonCry('bulbasaur').url, `/audio/cries/${file}`)
  assert.equal(getPokemonCry('bulbasaur', { baseUrl: '/custom/' }).url, `/custom/${file}`)
  assert.equal(getPokemonCry('bulbasaur', { baseUrl: 'https://assets.example.com/cries' }).url, `https://assets.example.com/cries/${file}`)
  for (const baseUrl of ['', '//evil.example', '/\\evil.example/', 'https://bad host/', 'javascript:alert(1)', 'https://user:pass@host/', '/audio?query', '/audio#hash', '/audio\n', 'https:evil.example', null]) {
    assert.throws(() => getPokemonCry('bulbasaur', { baseUrl }), TypeError)
  }
})
