import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DRAFT_SFX_RUNTIME_CATALOG, getDraftMoveSoundPlan, getDraftFxSoundPlan, getDraftRuntimeSoundAsset } from '../src/draft-runtime.js'
import { SFX_RUNTIME_CATALOG } from '../src/runtime.js'

test('draft entry covers the 323 explicit remaining moves without replacing any approved pilot', () => {
  assert.equal(Object.keys(DRAFT_SFX_RUNTIME_CATALOG.moves).length, 323)
  assert.equal(Object.keys(DRAFT_SFX_RUNTIME_CATALOG.assets).length, 323)
  assert.equal(DRAFT_SFX_RUNTIME_CATALOG.status, 'technical-draft')
  assert.equal(DRAFT_SFX_RUNTIME_CATALOG.policy.scope, 'battle-simulation-and-move-preview')
  for (const approved of Object.values(SFX_RUNTIME_CATALOG.moves)) {
    assert.equal(getDraftMoveSoundPlan(approved.moveId), null)
    assert.equal(getDraftFxSoundPlan(approved.fxId), null)
    assert.equal(getDraftRuntimeSoundAsset(approved.assetId), null)
  }
  for (const plan of Object.values(DRAFT_SFX_RUNTIME_CATALOG.moves)) {
    assert.equal(getDraftFxSoundPlan(plan.fxId), plan)
    assert.equal(plan.reviewStatus, 'technical-draft')
    assert.equal(plan.playbackPolicy, 'whole-native-buffer-at-visual-start')
    assert.equal(plan.nativeCompatibility, null)
    assert.equal(plan.playbackRate, 1)
    assert.equal(plan.segments.length, 1)
    const segment = plan.segments[0]
    assert.equal(segment.startFrame, 0)
    assert.equal(segment.endFrame, plan.reference.sampleFrames)
    assert.equal(segment.sourceAnchorFrame, 0)
    assert.equal(segment.visualAnchorSeconds, 0)
    assert.equal(segment.nativeOffsetSeconds, 0)
    assert.ok(segment.gainDb <= 0)
  }
})

test('draft variant defaults and exclusions remain explicit instead of inferred', () => {
  assert.equal(getDraftMoveSoundPlan('present').assetId, 'source.present-damage')
  assert.equal(getDraftMoveSoundPlan('doubleslap').assetId, 'source.double-slap-1hit')
  assert.equal(getDraftMoveSoundPlan('recover').assetId, 'source.recover')
  for (const assetId of ['source.present-heal', 'source.absorb-part-1', 'source.absorb-part-2', 'source.double-slap-2hits', 'source.recover-part-1']) assert.equal(getDraftRuntimeSoundAsset(assetId), null)
  for (const id of ['mirrormove', 'naturepower', 'tackle', 'Present', ' present ', 'double-slap', '__proto__', 'constructor', null, 0]) assert.equal(getDraftMoveSoundPlan(id), null)
  assert.equal(getDraftFxSoundPlan('doubleslap'), null)
  for (const options of [{ phase: 'prepare' }, { phase: 'unknown' }, { mode: 'reduced' }, { mode: 'instant' }, { outcome: 'heal' }, { outcome: 'miss' }, { outcome: 'fail' }, { outcome: 'immune' }]) assert.equal(getDraftMoveSoundPlan('present', options), null)
})

test('draft descriptors are immutable and content-addressed URLs accept only safe bases', () => {
  assert.throws(() => { getDraftMoveSoundPlan('earthquake').segments[0].gainDb = 6 }, TypeError)
  assert.throws(() => { DRAFT_SFX_RUNTIME_CATALOG.assets['source.earthquake'].reference.sampleFrames = 1 }, TypeError)
  const asset = getDraftRuntimeSoundAsset('source.earthquake')
  assert.equal(asset.url, `/audio/sfx/${asset.sha256}.mp3`)
  assert.equal(getDraftRuntimeSoundAsset(asset.id, { baseUrl: 'https://cdn.example.test/sfx' }).url, `https://cdn.example.test/sfx/${asset.file}`)
  assert.equal(getDraftRuntimeSoundAsset(asset.id, { baseUrl: '/' }).url, `/${asset.file}`)
  for (const baseUrl of ['//example.test', 'https://user:pass@example.test', 'data:audio/mp3,', 'https://example.test/?x=1', '/a#hash', '/bad\\path', '/bad path']) assert.throws(() => getDraftRuntimeSoundAsset(asset.id, { baseUrl }), TypeError)
  assert.equal(getDraftRuntimeSoundAsset('__proto__'), null)
})

test('draft runtime stays compact and independent from bench, browser and approval records', async () => {
  const source = await readFile(new URL('../src/draft-runtime.js', import.meta.url), 'utf8')
  const generated = await readFile(new URL('../src/draft-runtime.generated.js', import.meta.url), 'utf8')
  assert.equal([...source.matchAll(/^import .*$/gm)].length, 1)
  assert.match(source, /import generated from '\.\/draft-runtime\.generated\.js'/)
  for (const forbidden of ['catalog.generated.js', 'mpg123-decoder', 'window.', 'reviewer', 'approvalFingerprint', 'strongestEnergyWindow', 'thresholdRegion']) assert.ok(!generated.includes(forbidden))
  assert.ok(Buffer.byteLength(generated) < 320_000)
})
