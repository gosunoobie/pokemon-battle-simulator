import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  SFX_CATALOG, getSoundAsset, getMoveSound, getBattleSound,
} from '../src/index.js'

test('Stage A accounts for every source and move without approving playback', () => {
  assert.equal(SFX_CATALOG.schemaVersion, 1)
  assert.equal(SFX_CATALOG.stage, 'A')
  assert.equal(SFX_CATALOG.generation, 3)
  assert.equal(SFX_CATALOG.packId, 'gen3-sfx-candidates-v1')
  assert.equal(Object.keys(SFX_CATALOG.assets).length, 530)
  assert.equal(Object.keys(SFX_CATALOG.moves).length, 354)
  const candidates = Object.values(SFX_CATALOG.moves).filter(move => move.status === 'candidate')
  const called = Object.values(SFX_CATALOG.moves).filter(move => move.status === 'called-move')
  assert.equal(candidates.length, 352)
  assert.deepEqual(called.map(move => move.id).sort(), ['mirrormove', 'naturepower'])
  for (const move of Object.values(SFX_CATALOG.moves)) {
    assert.equal(move.reviewStatus, 'needs-listening')
    assert.deepEqual(move.playback, { normal: 'unreviewed', reduced: 'unreviewed', instant: 'unreviewed' })
    for (const id of move.assetIds) assert.ok(Object.hasOwn(SFX_CATALOG.assets, id), `Missing asset for ${move.id}: ${id}`)
    if (move.status === 'candidate') assert.ok(move.assetIds.length > 0)
    if (move.status === 'called-move') assert.deepEqual(move.assetIds, [])
  }
  for (const asset of Object.values(SFX_CATALOG.assets)) {
    assert.equal(asset.reviewStatus, 'candidate')
    assert.equal(asset.mime, 'audio/mpeg')
    assert.match(asset.sha256, /^[a-f0-9]{64}$/)
    assert.match(asset.decoded.pcmSha256, /^[a-f0-9]{64}$/)
    assert.ok(asset.decoded.sampleFrames > 0)
    assert.ok(asset.decoded.sampleRate > 0)
    assert.ok(asset.decoded.channels > 0)
    assert.ok(Number.isFinite(asset.decoded.durationSeconds) && asset.decoded.durationSeconds > 0)
  }
})

test('lookups require exact IDs and do not guess names, aliases or object properties', () => {
  const assetId = Object.keys(SFX_CATALOG.assets)[0]
  const eventId = Object.keys(SFX_CATALOG.events)[0]
  assert.ok(eventId, 'Generic battle records must be represented')
  assert.equal(getMoveSound('flamethrower'), SFX_CATALOG.moves.flamethrower)
  assert.equal(getMoveSound('visegrip'), SFX_CATALOG.moves.visegrip)
  assert.equal(getMoveSound('visegrip').fxId, 'vice-grip')
  assert.equal(getBattleSound(eventId), SFX_CATALOG.events[eventId])
  assert.equal(getSoundAsset(assetId).id, assetId)
  for (const id of [undefined, null, 1, {}, [], '__proto__', 'constructor', 'toString', 'unknown']) {
    assert.equal(getSoundAsset(id), null)
    assert.equal(getMoveSound(id), null)
    assert.equal(getBattleSound(id), null)
  }
  for (const id of ['Flamethrower', 'Flame Thrower', 'vice-grip', 'vicegrip', 'Vise Grip']) {
    assert.equal(getMoveSound(id), null)
  }
})

test('catalog and returned nested metadata cannot be mutated', () => {
  const move = getMoveSound('flamethrower')
  const asset = getSoundAsset(move.assetIds[0])
  const event = getBattleSound(Object.keys(SFX_CATALOG.events)[0])
  assert.throws(() => { SFX_CATALOG.stage = 'approved' }, TypeError)
  assert.throws(() => { move.playback.normal = 'approved' }, TypeError)
  assert.throws(() => { move.assetIds.push('invented') }, TypeError)
  assert.throws(() => { asset.url = '/other.mp3' }, TypeError)
  assert.throws(() => { asset.decoded.durationSeconds = 0 }, TypeError)
  assert.throws(() => { event.assetIds.push('invented') }, TypeError)
})

test('asset URLs encode source filenames and support explicit static/CDN bases', () => {
  const asset = Object.values(SFX_CATALOG.assets).find(entry => entry.file.includes(' '))
  assert.ok(asset, 'This source collection contains spaced filenames')
  const file = encodeURIComponent(asset.file)
  assert.equal(getSoundAsset(asset.id).url, `/sound_effects/${file}`)
  assert.equal(getSoundAsset(asset.id, { baseUrl: '/custom/' }).url, `/custom/${file}`)
  assert.equal(getSoundAsset(asset.id, { baseUrl: '/' }).url, `/${file}`)
  assert.equal(getSoundAsset(asset.id, { baseUrl: 'https://assets.example.com/sfx' }).url, `https://assets.example.com/sfx/${file}`)
  assert.equal(getSoundAsset(asset.id, { baseUrl: 'http://localhost:5173/custom/' }).url, `http://localhost:5173/custom/${file}`)
  for (const baseUrl of ['', 'relative/path', '//evil.example', '/\\evil.example/', 'https://bad host/', 'javascript:alert(1)', 'data:audio/mpeg;base64,AAAA', 'https://user:pass@host/', '/audio?query', '/audio#hash', '/audio\n', 'https:evil.example', null, 1]) {
    assert.throws(() => getSoundAsset(asset.id, { baseUrl }), TypeError, `Accepted invalid base: ${String(baseUrl)}`)
  }
  assert.equal(getSoundAsset('unknown', { baseUrl: 'invalid' }), null)
})

test('JSON and JavaScript exports describe the same generated catalog', async () => {
  const json = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'))
  assert.deepEqual(SFX_CATALOG, json)
})
