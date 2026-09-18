import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createBenchManifest, BENCH_ROOT } from '../bench.mjs'
import { compileRuntime, generateRuntime } from '../runtime.mjs'
import { sha256 } from '../mp3.mjs'

const manifestPromise = createBenchManifest()
const reviewText = await readFile(join(BENCH_ROOT, 'tools/audio-import/review/pilot-reviews.json'), 'utf8')
const selectionText = await readFile(join(BENCH_ROOT, 'tools/audio-import/runtime-selection.json'), 'utf8')
const inputs = async () => ({ manifest: await manifestPromise, reviewText, selectionText })

function selecting(mutator) { const value = JSON.parse(selectionText); mutator(value); return JSON.stringify(value) }
function reviewing(mutator) {
  const value = JSON.parse(reviewText); mutator(value)
  const text = JSON.stringify(value), selection = JSON.parse(selectionText)
  selection.reviewBundleSha256 = sha256(Buffer.from(text))
  return { reviewText: text, selectionText: JSON.stringify(selection) }
}

test('compilation preserves the exact approved subset, bytes and complete whole-recording regions', async () => {
  const args = await inputs(), first = compileRuntime(args), second = compileRuntime(args)
  assert.deepEqual(first, second)
  assert.equal(first.report.selectedMoveCount, 10)
  assert.equal(first.report.selectedAssetCount, 10)
  assert.equal(first.report.approvedReviewCount, 11)
  assert.equal(first.report.encodedBytes, 887339)
  assert.deepEqual(first.report.approvedAlternativesNotScheduled, [{ subject: { kind: 'move', id: 'absorb', phase: 'attack' }, assetId: 'source.absorb-part-1' }])
  for (const plan of Object.values(first.catalog.moves)) {
    const original = JSON.parse(reviewText).records.find(r => r.source.assetId === plan.assetId)
    assert.deepEqual(plan.segments, original.segments)
    assert.equal(plan.visualRevision, original.visualRevision)
    assert.equal(plan.nativeCompatibility.sampleFrames, original.review.native.sampleFrames)
    assert.equal(first.catalog.assets[plan.assetId].file, `${original.source.sha256}.mp3`)
  }
  const report = await generateRuntime({ check: true })
  assert.equal(report.runtimeModuleSha256, sha256(Buffer.from(first.generated)))
})

test('selection cannot infer part roles, duplicate a default, select unreviewed phases or change policy', async () => {
  const args = await inputs()
  for (const [mutate, error] of [
    [s => { s.entries[0].assetId = 'source.absorb-part-1' }, /lacks an approved/],
    [s => { s.entries.push(s.entries[0]) }, /Duplicate/],
    [s => { s.entries[0].phase = 'prepare' }, /Invalid runtime/],
    [s => { s.entries[0].moveId = '__proto__' }, /Invalid runtime/],
    [s => { s.policy.playbackRate = 1.5 }, /policy/],
    [s => { s.reviewBundleSha256 = '0'.repeat(64) }, /pins a different/],
  ]) assert.throws(() => compileRuntime({ ...args, selectionText: selecting(mutate) }), error)
  // A specifically selected, already-approved alternative is valid; its name does not become a prepare role.
  const alternative = compileRuntime({ ...args, selectionText: selecting(s => { s.entries.find(r => r.moveId === 'absorb').assetId = 'source.absorb-part-1' }) })
  assert.equal(alternative.catalog.moves.absorb.phase, 'attack')
  assert.equal(alternative.catalog.moves.absorb.assetId, 'source.absorb-part-1')
  assert.equal(alternative.report.approvedAlternativesNotScheduled[0].assetId, 'source.absorb')
})

test('draft, tampered, stale visual and changed source approvals fail before promotion', async () => {
  const args = await inputs()
  const draft = reviewing(b => { b.records[0].status = 'draft'; b.records[0].approvalFingerprint = null })
  assert.throws(() => compileRuntime({ ...args, ...draft }), /lacks an approved/)
  const edited = reviewing(b => { b.records[0].segments[0].gainDb = -3 })
  assert.throws(() => compileRuntime({ ...args, ...edited }), /fingerprint|approval/i)
  const stale = structuredClone(args.manifest)
  stale.visualRevisions['move:tackle:attack'] = '0'.repeat(64)
  assert.throws(() => compileRuntime({ ...args, manifest: stale }), /visual/i)
  const source = structuredClone(args.manifest)
  source.assets['source.tackle'].sha256 = '0'.repeat(64)
  assert.throws(() => compileRuntime({ ...args, manifest: source }), /source/i)
})

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'sfx-runtime-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const lock = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/audit-lock.json')))
  const paths = [...lock.inputs.map(row => row.path), 'tools/audio-import/audit-lock.json', 'tools/audio-import/reports/sfx-generation.json', 'packages/battle-sfx/data/catalog.json', 'tools/audio-import/review/pilot.json', 'tools/audio-import/review/pilot-reviews.json', 'tools/audio-import/runtime-selection.json', 'packages/battle-fx/src', 'packages/battle-fx/package.json', 'apps/sfx-bench/src/visual.js', 'apps/sfx-bench/src/timing.js', 'apps/sfx-bench/src/audio.js', 'apps/sfx-bench/src/Bench.vue', 'packages/battle-sfx/src/review.js']
  for (const asset of Object.values((await manifestPromise).assets)) paths.push(`public/sound_effects/${asset.file}`)
  await symlink(join(BENCH_ROOT, 'node_modules'), join(root, 'node_modules'))
  for (const path of new Set(paths)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await cp(join(BENCH_ROOT, path), join(root, path), { recursive: true })
  }
  return root
}

test('check mode is read-only and catches absent/stale output; regeneration verifies source bytes and visual revisions', async t => {
  const root = await fixture(t)
  await assert.rejects(generateRuntime({ root, check: true }), /differs or is missing/)
  await assert.rejects(readFile(join(root, 'packages/battle-sfx/src/runtime.generated.js')), { code: 'ENOENT' })
  await generateRuntime({ root })
  await generateRuntime({ root, check: true })
  const output = join(root, 'packages/battle-sfx/src/runtime.generated.js')
  await writeFile(output, '// stale\n')
  await assert.rejects(generateRuntime({ root, check: true }), /differs or is missing/)
  assert.equal(await readFile(output, 'utf8'), '// stale\n')
  const recipe = join(root, 'packages/battle-fx/src/moves/restored/tackle.js'), recipeBytes = await readFile(recipe)
  await writeFile(recipe, Buffer.concat([recipeBytes, Buffer.from('\n// stale fixture\n')]))
  await assert.rejects(generateRuntime({ root }), /visual/i)
  assert.equal(await readFile(output, 'utf8'), '// stale\n')
  await writeFile(recipe, recipeBytes)
  const source = join(root, 'public/sound_effects/Tackle.mp3'), bytes = await readFile(source)
  bytes[100] ^= 1
  await writeFile(source, bytes)
  await assert.rejects(generateRuntime({ root }), /Sound asset differs/)
  assert.equal(await readFile(output, 'utf8'), '// stale\n')
})
