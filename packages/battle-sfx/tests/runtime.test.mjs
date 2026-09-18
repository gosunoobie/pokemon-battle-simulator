import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SFX_RUNTIME_CATALOG, getMoveSoundPlan, getFxSoundPlan, getRuntimeSoundAsset } from '../src/runtime.js'

test('compact runtime exposes exactly the selected reviewed defaults and explicit FX mappings', () => {
  assert.equal(Object.keys(SFX_RUNTIME_CATALOG.moves).length, 10)
  assert.equal(Object.keys(SFX_RUNTIME_CATALOG.assets).length, 10)
  assert.equal(getFxSoundPlan('double-kick'), getMoveSoundPlan('doublekick'))
  assert.equal(getFxSoundPlan('hyper-beam'), getMoveSoundPlan('hyperbeam'))
  assert.equal(getMoveSoundPlan('double-kick'), null)
  assert.equal(getFxSoundPlan('doublekick'), null)
  assert.equal(getMoveSoundPlan('absorb').assetId, 'source.absorb')
  assert.equal(getRuntimeSoundAsset('source.absorb-part-1'), null)
  for (const plan of Object.values(SFX_RUNTIME_CATALOG.moves)) {
    assert.equal(plan.phase, 'attack')
    assert.equal(plan.playbackRate, 1)
    assert.equal(plan.tailPolicy, 'continue-until-region-end')
    assert.equal(plan.segments.length, 1)
    assert.equal(plan.segments[0].startFrame, 0)
    assert.equal(plan.segments[0].endFrame, plan.reference.sampleFrames)
    assert.equal(plan.segments[0].visualAnchorSeconds, 0)
    assert.equal(plan.segments[0].gainDb, 0)
    assert.equal(plan.nativeCompatibility.browser, 'Chrome')
    assert.equal(plan.nativeCompatibility.version, '152.0.0.0')
    assert.equal(plan.nativeCompatibility.sampleRate, 48000)
  }
})

test('unsupported outcomes, modes, phases and prototype spellings remain silent', () => {
  for (const id of ['present', 'mirrormove', 'Tackle', ' tackle ', '__proto__', 'constructor', null, 4]) {
    assert.equal(getMoveSoundPlan(id), null)
    assert.equal(getFxSoundPlan(id), null)
  }
  for (const options of [{ phase: 'prepare' }, { phase: 'other' }, { mode: 'reduced' }, { mode: 'instant' }, { mode: 'normal', outcome: 'miss' }, { outcome: 'fail' }, { outcome: 'immune' }, { outcome: 'success' }]) assert.equal(getMoveSoundPlan('tackle', options), null)
})

test('all plans and nested descriptors are immutable and asset paths are content addressed', () => {
  assert.throws(() => { getMoveSoundPlan('tackle').segments[0].gainDb = 5 }, TypeError)
  assert.throws(() => { SFX_RUNTIME_CATALOG.assets['source.tackle'].reference.sampleRate = 1 }, TypeError)
  const asset = getRuntimeSoundAsset('source.tackle')
  assert.equal(asset.url, `/audio/sfx/${asset.sha256}.mp3`)
  assert.equal(getRuntimeSoundAsset('source.tackle', { baseUrl: 'https://cdn.example.test/game/' }).url, `https://cdn.example.test/game/${asset.sha256}.mp3`)
  assert.equal(getRuntimeSoundAsset('source.tackle', { baseUrl: '/' }).url, `/${asset.sha256}.mp3`)
  for (const baseUrl of ['//example.test', 'https://user:pass@example.test', 'data:audio/mp3,', 'https://example.test/?x=1', '/a#hash', '/bad\\path', '/bad path']) assert.throws(() => getRuntimeSoundAsset('source.tackle', { baseUrl }), TypeError)
  assert.equal(getRuntimeSoundAsset('__proto__'), null)
})

test('runtime entry contains no candidate catalog, browser, tool decoder or personal review metadata', async () => {
  const source = await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8')
  const generated = await readFile(new URL('../src/runtime.generated.js', import.meta.url), 'utf8')
  assert.equal([...source.matchAll(/^import .*$/gm)].length, 1)
  assert.match(source, /import generated from '\.\/runtime\.generated\.js'/)
  for (const forbidden of ['catalog.generated.js', 'mpg123-decoder', 'window.', 'reviewer', 'Sounds good', 'Perfect']) assert.ok(!generated.includes(forbidden))
  assert.ok(Buffer.byteLength(generated) < 20_000)
})
