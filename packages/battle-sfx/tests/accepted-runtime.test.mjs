import test from 'node:test'
import assert from 'node:assert/strict'
import { ACCEPTED_SFX_RUNTIME_CATALOG, getAcceptedMoveSoundPlan, getAcceptedFxSoundPlan, getAcceptedRuntimeSoundAsset } from '../src/accepted-runtime.js'

test('final sound catalog is immutable, explicit and silent for unreviewed phases and outcomes', () => {
  const ids = Object.keys(ACCEPTED_SFX_RUNTIME_CATALOG.moves)
  assert.equal(ids.length, 18)
  for (const id of ids) {
    const plan = getAcceptedMoveSoundPlan(id)
    assert.equal(getAcceptedFxSoundPlan(plan.fxId), plan)
    assert.throws(() => { plan.segments[0].gainDb = -40 }, TypeError)
    for (const options of [{ phase: 'prepare' }, { mode: 'reduced' }, { outcome: 'miss' }, { outcome: 'immune' }]) assert.equal(getAcceptedMoveSoundPlan(id, options), null)
  }
  assert.equal(getAcceptedMoveSoundPlan('ember'), null)
  assert.equal(getAcceptedFxSoundPlan('Body Slam'), null)
  assert.equal(getAcceptedMoveSoundPlan('__proto__'), null)
})

test('accepted assets use existing hash-addressed files and validate CDN roots', () => {
  const id = getAcceptedMoveSoundPlan('thunderbolt').assetId
  const asset = getAcceptedRuntimeSoundAsset(id)
  assert.equal(asset.url, `/audio/sfx/${asset.sha256}.mp3`)
  assert.equal(getAcceptedRuntimeSoundAsset(id, { baseUrl: 'https://cdn.example.test/sfx' }).url, `https://cdn.example.test/sfx/${asset.file}`)
  for (const baseUrl of ['//elsewhere', 'javascript:evil', 'https://user:pass@example.test', '/sfx?key=secret']) assert.throws(() => getAcceptedRuntimeSoundAsset(id, { baseUrl }), /baseUrl/)
  assert.equal(getAcceptedRuntimeSoundAsset('unknown'), null)
})
