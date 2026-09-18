import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCollectionManifest } from '../collection.mjs'
import { BENCH_ROOT } from '../bench.mjs'
import { compileDraftRuntime, generateDraftRuntime } from '../draft-runtime.mjs'
import { sha256 } from '../mp3.mjs'

const manifestPromise = createCollectionManifest()
const analysisText = await readFile(join(BENCH_ROOT, 'tools/audio-import/reports/sfx-remaining-analysis.json'), 'utf8')
const selectionText = await readFile(join(BENCH_ROOT, 'tools/audio-import/draft-runtime-selection.json'), 'utf8')
const approvedSelectionText = await readFile(join(BENCH_ROOT, 'tools/audio-import/runtime-selection.json'), 'utf8')
const analysis = JSON.parse(analysisText)
const batchTexts = Object.fromEntries(await Promise.all(analysis.batches.map(async batch => [batch.id, await readFile(join(BENCH_ROOT, batch.path), 'utf8')])))
const inputs = async () => ({ manifest: await manifestPromise, analysisText, selectionText, approvedSelectionText, batchTexts })
function selecting(mutator) { const selection = JSON.parse(selectionText); mutator(selection); return JSON.stringify(selection) }
function evidence(mutator) {
  const report = JSON.parse(analysisText), batches = Object.fromEntries(Object.entries(batchTexts).map(([id, text]) => [id, JSON.parse(text)]))
  mutator(report, batches)
  const changedTexts = Object.fromEntries(Object.entries(batches).map(([id, value]) => [id, JSON.stringify(value)]))
  for (const batch of report.batches) { batch.sha256 = sha256(Buffer.from(changedTexts[batch.id])); batch.bytes = Buffer.byteLength(changedTexts[batch.id]) }
  const text = JSON.stringify(report), selection = JSON.parse(selectionText)
  selection.analysisReportSha256 = sha256(Buffer.from(text)); selection.batches = report.batches.map(({ id, sha256 }) => ({ id, sha256 }))
  return { analysisText: text, batchTexts: changedTexts, selectionText: JSON.stringify(selection) }
}

test('draft compilation is reproducible, preserves exact defaults and reports complete exclusions and footprint', async () => {
  const args = await inputs(), first = compileDraftRuntime(args)
  assert.deepEqual(compileDraftRuntime(args), first)
  assert.equal(first.report.selectedMoveCount, 323)
  assert.equal(first.report.selectedAssetCount, 323)
  assert.equal(first.report.encodedBytes, 28326318)
  assert.equal(first.report.referenceDecodedBytes, 241996968)
  assert.equal(first.report.attenuatedMoveCount, 43)
  assert.deepEqual(first.report.selectedVariantCounts, { whole: 308, oneHit: 14, presentDamage: 1 })
  assert.deepEqual(first.report.coverage, { animatedMoveCount: 335, approvedPilotMoveCount: 10, selectedDraftMoveCount: 323, missingSourceMoves: ['mirrormove', 'naturepower'] })
  assert.equal(first.report.listeningApprovalsAdded, 0)
  assert.equal(first.report.nativeDecoderReviewsAdded, 0)
  assert.equal(first.report.approvedMoveMappingsChanged, 0)
  assert.equal(first.report.excludedCandidates.length + first.report.selectedMoveCount, analysis.candidates.length)
  for (const plan of Object.values(first.catalog.moves)) {
    const candidate = analysis.candidates.find(row => row.key === `move:${plan.moveId}:attack:${plan.assetId}`)
    assert.deepEqual(plan.segments, [candidate.defaultSegment])
    assert.equal(plan.nativeCompatibility, null)
  }
  const report = await generateDraftRuntime({ check: true })
  assert.equal(report.runtimeModuleSha256, sha256(Buffer.from(first.generated)))
})

test('selection rejects changed pins, pilot replacements, inferred parts, alternate hit counts and phases', async () => {
  const args = await inputs()
  for (const [mutator, error] of [
    [s => { s.analysisReportSha256 = '0'.repeat(64) }, /analysis report/],
    [s => { s.collectionRevision = '0'.repeat(64) }, /revision/],
    [s => { s.batches[0].sha256 = '0'.repeat(64) }, /batch pins/],
    [s => { s.policy.playbackRate = 2 }, /policy/],
    [s => { s.entries.pop() }, /323/],
    [s => { s.entries[1] = s.entries[0] }, /Duplicate/],
    [s => { s.entries[0] = { moveId: 'tackle', phase: 'attack', assetId: 'source.tackle' } }, /Already approved/],
    [s => { s.entries[0].phase = 'prepare' }, /Invalid/],
    [s => { s.entries[0].moveId = '__proto__' }, /Invalid/],
    [s => { s.entries.find(row => row.moveId === 'present').assetId = 'source.present-heal' }, /Present damage/],
    [s => { s.entries.find(row => row.moveId === 'recover').assetId = 'source.recover-part-1' }, /whole default/],
    [s => { s.entries.find(row => row.moveId === 'doubleslap').assetId = 'source.double-slap-2hits' }, /one-hit/],
  ]) assert.throws(() => compileDraftRuntime({ ...args, selectionText: selecting(mutator) }), error)
})

test('draft evidence cannot silently claim a listening review or substitute optional regions, gains or source relationships', async () => {
  const args = await inputs()
  const key = 'move:megapunch:attack:source.mega-punch'
  const alterRecord = mutate => evidence((report, batches) => {
    const candidate = report.candidates.find(row => row.key === key)
    mutate(batches[candidate.batchId].records.find(row => row.subject.id === 'megapunch'), candidate)
  })
  for (const [mutator, error] of [
    [r => { r.review.near = true }, /listening or native/],
    [r => { r.review.native.browser = 'Chrome' }, /listening or native/],
    [r => { r.segments[0].gainDb = -6 }, /exact analysis/],
    [r => { r.segments[0].startFrame = 1; r.segments[0].sourceAnchorFrame = 1 }, /exact analysis/],
    [r => { r.segments[0].visualAnchorSeconds = 0.2 }, /exact analysis/],
    [r => { r.source.pcmSha256 = '0'.repeat(64) }, /source is stale/],
    [r => { r.visualRevision = '0'.repeat(64) }, /visualRevision/],
    [(r, c) => { c.visualComparisonAllowed = false }, /compatible technical/],
  ]) assert.throws(() => compileDraftRuntime({ ...args, ...alterRecord(mutator) }), error)
  const changed = { ...batchTexts, 'batch-001': `${batchTexts['batch-001']} ` }
  assert.throws(() => compileDraftRuntime({ ...args, batchTexts: changed }), /batch differs/)
  const missing = { ...batchTexts }; delete missing['batch-001']
  assert.throws(() => compileDraftRuntime({ ...args, batchTexts: missing }), /batch differs/)
  const stale = structuredClone(args.manifest); stale.visualRevisions['move:megapunch:attack'] = '0'.repeat(64)
  assert.throws(() => compileDraftRuntime({ ...args, manifest: stale }), /manifest provenance/)
})

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'sfx-draft-runtime-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const manifest = await manifestPromise
  const lock = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/audit-lock.json')))
  const paths = [...lock.inputs.map(row => row.path), 'tools/audio-import/audit-lock.json', 'tools/audio-import/reports/sfx-generation.json', 'packages/battle-sfx/data/catalog.json', 'tools/audio-import/review/pilot.json', 'tools/audio-import/review/pilot-reviews.json', 'tools/audio-import/runtime-selection.json', 'packages/battle-fx/src', 'packages/battle-fx/package.json', 'apps/sfx-bench/src', 'packages/battle-sfx/src/review.js', 'tools/audio-import/collection.mjs', 'tools/audio-import/analysis.mjs', 'tools/audio-import/analysis-policy.json', 'tools/audio-import/reports/sfx-remaining-analysis.json', 'tools/audio-import/draft-runtime-selection.json', ...analysis.batches.map(row => row.path)]
  for (const asset of Object.values(manifest.assets)) paths.push(`public/sound_effects/${asset.file}`)
  await symlink(join(BENCH_ROOT, 'node_modules'), join(root, 'node_modules'))
  for (const path of new Set(paths)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await cp(join(BENCH_ROOT, path), join(root, path), { recursive: true })
  }
  return root
}

test('check is read-only; stale output, modified analysis batch and corrupted original fail before writes', async t => {
  const root = await fixture(t), output = join(root, 'packages/battle-sfx/src/draft-runtime.generated.js')
  await assert.rejects(generateDraftRuntime({ root, check: true }), /differs or is missing/)
  await assert.rejects(readFile(output), { code: 'ENOENT' })
  await generateDraftRuntime({ root })
  await generateDraftRuntime({ root, check: true })
  await writeFile(output, '// stale output\n')
  await assert.rejects(generateDraftRuntime({ root, check: true }), /differs or is missing/)
  assert.equal(await readFile(output, 'utf8'), '// stale output\n')
  const batch = join(root, analysis.batches[0].path), originalBatch = await readFile(batch)
  await writeFile(batch, Buffer.concat([originalBatch, Buffer.from(' ')]))
  await assert.rejects(generateDraftRuntime({ root }), /batch differs/)
  assert.equal(await readFile(output, 'utf8'), '// stale output\n')
  await writeFile(batch, originalBatch)
  const source = join(root, 'public/sound_effects/Earthquake.mp3'), bytes = await readFile(source)
  bytes[100] ^= 1; await writeFile(source, bytes)
  await assert.rejects(generateDraftRuntime({ root }), /Sound asset differs/)
  assert.equal(await readFile(output, 'utf8'), '// stale output\n')
})
