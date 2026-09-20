import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { EVENT_SFX_RUNTIME_CATALOG, getEventSoundPlan, getEventRuntimeSoundAsset } from '@battle/battle-sfx/event-runtime'
import { getAcceptedMoveSoundPlan, getAcceptedRuntimeSoundAsset } from '../src/accepted-runtime.js'
import { getMoveSoundPlan, getRuntimeSoundAsset } from '../src/runtime.js'
import { getDraftMoveSoundPlan, getDraftRuntimeSoundAsset } from '../src/draft-runtime.js'
import { compileEventRuntime, generateEventRuntime } from '../../../tools/audio-import/event-runtime.mjs'
import { BENCH_ROOT, verifiedCatalog } from '../../../tools/audio-import/bench.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const ids = ['battle.hit.super-effective', 'battle.hit.resisted', 'battle.release.pokeball', 'battle.faint']
const sources = ['Hit Super Effective.mp3', 'Hit Weak Not Very Effective.mp3',
  'In-Battle Recall Switch Pokeball.mp3', 'In-Battle Faint No Health.mp3']
const argsPromise = (async () => {
  const [{ auditLockSha256, decoder }, catalogText, sourceLockText] = await Promise.all([
    verifiedCatalog(BENCH_ROOT), readFile(join(BENCH_ROOT, 'packages/battle-sfx/data/catalog.json'), 'utf8'),
    readFile(join(BENCH_ROOT, 'tools/audio-import/source-lock.json'), 'utf8'),
  ])
  return { auditLockSha256, decoder, catalogText, sourceLockText }
})()

test('event runtime exposes only the four explicitly requested whole-source cues', () => {
  assert.deepEqual(Object.keys(EVENT_SFX_RUNTIME_CATALOG.events), ids)
  assert.equal(Object.keys(EVENT_SFX_RUNTIME_CATALOG.assets).length, 4)
  assert.equal(EVENT_SFX_RUNTIME_CATALOG.status, 'user-authorized-events')
  assert.equal(EVENT_SFX_RUNTIME_CATALOG.authorization.kind, 'user-message')
  assert.equal(EVENT_SFX_RUNTIME_CATALOG.authorization.listeningApproval, false)
  assert.equal(EVENT_SFX_RUNTIME_CATALOG.authorization.nativeDecoderReview, false)
  for (const eventId of ids) {
    const plan = getEventSoundPlan(eventId)
    assert.equal(plan.authorization, 'user-request')
    assert.equal(plan.playbackPolicy, 'whole-native-buffer-at-event-cue')
    assert.equal(plan.playbackRate, 1)
    assert.equal(plan.startSeconds, 0)
    assert.equal(plan.endSeconds, null, 'the actual native buffer determines the end')
    assert.equal(plan.gainDb, eventId.startsWith('battle.hit.') ? -6 : 0)
    assert.equal(plan.nativeCompatibility, null)
    assert.equal(plan.tailPolicy, 'continue-until-source-end')
    assert.equal(plan.segments, undefined, 'reference frames do not become native trims')
    assert.equal(plan.reviewStatus, undefined, 'this is not an exact-sync approval')
    assert.equal(plan.taperEdits, undefined)
  }
  assert.equal(getEventSoundPlan(ids[0]).assetId, 'source.hit-super-effective')
  assert.equal(getEventSoundPlan(ids[1]).assetId, 'source.hit-weak-not-very-effective')
  assert.equal(getEventSoundPlan(ids[2]).assetId, 'source.in-battle-recall-switch-pokeball')
  assert.equal(getEventSoundPlan(ids[2]).sourceEventId, 'battle.recall.pokeball')
  assert.match(getEventSoundPlan(ids[2]).sourceUse, /reuse.*recall\/switch.*not a dedicated release recording/)
  assert.equal(getEventSoundPlan(ids[3]).assetId, 'source.in-battle-faint-no-health')
  assert.equal(getEventSoundPlan(ids[3]).sourceEventId, 'battle.faint')
  for (const id of ['battle.hit.neutral', 'battle.hit.immune', 'battle.hit.not-very-effective', 'battle.recall.pokeball',
    'battle.hit.resisted ', 'Battle.Hit.Resisted', 'tackle', '__proto__', 'constructor', null, 1]) assert.equal(getEventSoundPlan(id), null)
})

test('event descriptors and plans are immutable and preserve safe content-addressed delivery', async () => {
  const sourceCatalog = JSON.parse((await argsPromise).catalogText)
  for (const eventId of ids) {
    const plan = getEventSoundPlan(eventId), asset = getEventRuntimeSoundAsset(plan.assetId)
    assert.equal(asset.url, `/audio/sfx/${asset.sha256}.mp3`)
    assert.equal(asset.bytes, sourceCatalog.assets[asset.id].bytes)
    assert.equal(asset.sha256, sourceCatalog.assets[asset.id].sha256)
    assert.equal(asset.mime, 'audio/mpeg')
    const source = await readFile(join(BENCH_ROOT, 'public/sound_effects', sourceCatalog.assets[asset.id].file))
    const delivered = await readFile(join(BENCH_ROOT, 'public/audio/sfx', asset.file))
    assert.deepEqual(delivered, source, 'all original MPEG bytes are preserved')
    assert.equal(hash(delivered), asset.sha256)
    assert.throws(() => { plan.gainDb = 0 }, TypeError)
    assert.throws(() => { asset.reference.sampleFrames = 1 }, TypeError)
    assert.throws(() => { asset.bytes = 1 }, TypeError)
    assert.equal(getEventRuntimeSoundAsset(asset.id, { baseUrl: '/' }).url, `/${asset.file}`)
    assert.equal(getEventRuntimeSoundAsset(asset.id, { baseUrl: 'https://cdn.example.test/events/' }).url,
      `https://cdn.example.test/events/${asset.file}`)
    for (const baseUrl of ['//example.test', 'https://user:pass@example.test', 'data:audio/mp3,', 'file:///sounds',
      'https://example.test/?x=1', '/a#hash', '/bad\\path', '/bad path', 'relative', '', null]) {
      assert.throws(() => getEventRuntimeSoundAsset(asset.id, { baseUrl }), TypeError)
    }
  }
  assert.equal(getEventRuntimeSoundAsset('__proto__'), null)
  assert.equal(getEventRuntimeSoundAsset('source.tackle'), null)
})

test('event selection remains independent of all existing move sound packs and browser code', async () => {
  for (const eventId of ids) {
    assert.equal(getAcceptedMoveSoundPlan(eventId), null)
    assert.equal(getMoveSoundPlan(eventId), null)
    assert.equal(getDraftMoveSoundPlan(eventId), null)
    const assetId = getEventSoundPlan(eventId).assetId
    assert.equal(getAcceptedRuntimeSoundAsset(assetId), null)
    assert.equal(getRuntimeSoundAsset(assetId), null)
    assert.equal(getDraftRuntimeSoundAsset(assetId), null)
  }
  const source = await readFile(new URL('../src/event-runtime.js', import.meta.url), 'utf8')
  const generated = await readFile(new URL('../src/event-runtime.generated.js', import.meta.url), 'utf8')
  assert.deepEqual([...source.matchAll(/^import .*$/gm)].map(match => match[0]), ["import generated from './event-runtime.generated.js'"])
  for (const forbidden of ['mpg123-decoder', 'window.', 'AudioContext', 'approvalFingerprint', 'nativeOffsetSeconds', 'startFrame', 'endFrame']) {
    assert.ok(!generated.includes(forbidden), forbidden)
  }
  assert.ok(Buffer.byteLength(source) + Buffer.byteLength(generated) < 9000, 'runtime does not load the authoring collection')
})

test('event generation reproduces the installed pack with zero invented reviews or move changes', async () => {
  const args = await argsPromise, first = compileEventRuntime(args), second = compileEventRuntime(args)
  assert.deepEqual(first, second)
  assert.deepEqual(first.catalog, EVENT_SFX_RUNTIME_CATALOG)
  assert.equal(first.report.selectedEventCount, 4)
  assert.equal(first.report.encodedBytes, 180230)
  assert.equal(first.report.listeningApprovalsAdded, 0)
  assert.equal(first.report.nativeDecoderReviewsAdded, 0)
  assert.equal(first.report.acceptedMoveMappingsChanged, 0)
  assert.deepEqual(first.report.selected.map(row => row.referenceDurationSeconds), [1.72, .7, .83, 1])
  assert.deepEqual(first.report.selected.map(row => row.referencePeakDbfs), [-6.31419665, -7.55436357, -2.31373742, -7.41954872])
  assert.deepEqual(first.report.selected.map(row => row.referenceRmsDbfs), [-24.00688591, -23.62250375, -16.46296578, -23.81593938])
  const report = await generateEventRuntime({ check: true })
  assert.equal(report.runtimeModuleSha256, hash(first.generated))
  assert.equal(report.outputs.length, 5)
  assert.ok(report.outputs.every(row => row.path.includes('/event-runtime.generated.js') || row.path.startsWith('public/audio/sfx/')))
})

test('changed event assignments, source pins, reference PCM, levels and original provenance fail compilation', async () => {
  const args = await argsPromise
  for (const [mutate, pattern] of [
    [catalog => { catalog.events[ids[0]].assetIds[0] = 'source.tackle' }, /relationship/],
    [catalog => { catalog.assets['source.hit-super-effective'].eventId = 'battle.hit.neutral' }, /relationship/],
    [catalog => { catalog.assets['source.in-battle-recall-switch-pokeball'].eventId = 'battle.release.pokeball' }, /relationship/],
    [catalog => { catalog.events['battle.recall.pokeball'].assetIds[0] = 'source.in-battle-faint-no-health' }, /relationship/],
    [catalog => { catalog.assets['source.in-battle-faint-no-health'].decoded.sampleFrames++ }, /reference PCM/],
    [catalog => { catalog.assets['source.hit-super-effective'].sha256 = '0'.repeat(64) }, /Pinned event source/],
    [catalog => { catalog.assets['source.hit-super-effective'].decoded.sampleFrames++ }, /reference PCM/],
    [catalog => { catalog.assets['source.hit-super-effective'].decoded.pcmSha256 = '0'.repeat(64) }, /reference PCM/],
    [catalog => { catalog.assets['source.hit-super-effective'].decoded.peak = 1.1 }, /levels/],
    [catalog => { catalog.assets['source.hit-super-effective'].sourceSha256 = '0'.repeat(64) }, /Original source/],
    [catalog => { catalog.provenance.auditLockSha256 = '0'.repeat(64) }, /provenance/],
  ]) {
    const catalog = JSON.parse(args.catalogText); mutate(catalog)
    assert.throws(() => compileEventRuntime({ ...args, catalogText: JSON.stringify(catalog) }), pattern)
  }
  const sourceLock = JSON.parse(args.sourceLockText)
  sourceLock.transform = 'resample-and-normalize'
  assert.throws(() => compileEventRuntime({ ...args, sourceLockText: JSON.stringify(sourceLock) }), /original source provenance/)
})

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'sfx-event-runtime-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const lock = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/audit-lock.json')))
  const paths = new Set([...lock.inputs.map(row => row.path), 'tools/audio-import/audit-lock.json',
    'tools/audio-import/reports/sfx-generation.json', 'packages/battle-sfx/data/catalog.json',
    ...sources.map(file => `public/sound_effects/${file}`)])
  for (const path of paths) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await cp(join(BENCH_ROOT, path), join(root, path))
  }
  return root
}

test('read-only checks reject missing/stale delivery and source corruption fails before writing outputs', async t => {
  const root = await fixture(t), path = join(root, 'packages/battle-sfx/src/event-runtime.generated.js')
  await assert.rejects(generateEventRuntime({ root, check: true }), /differs or is missing/)
  await assert.rejects(readFile(path), { code: 'ENOENT' })
  await generateEventRuntime({ root })
  await generateEventRuntime({ root, check: true })
  await writeFile(path, '// stale\n')
  await assert.rejects(generateEventRuntime({ root, check: true }), /differs or is missing/)
  assert.equal(await readFile(path, 'utf8'), '// stale\n')
  const input = join(root, 'public/sound_effects/Hit Weak Not Very Effective.mp3')
  const bytes = await readFile(input); bytes[100] ^= 1
  await writeFile(input, bytes)
  await assert.rejects(generateEventRuntime({ root }), /Sound asset differs/)
  assert.equal(await readFile(path, 'utf8'), '// stale\n', 'all inputs must pass before any output is written')
})
