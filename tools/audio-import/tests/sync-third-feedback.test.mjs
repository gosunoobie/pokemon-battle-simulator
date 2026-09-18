import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BENCH_ROOT } from '../bench.mjs'
import { createCollectionManifest } from '../collection.mjs'
import { compileSyncBatch, compileSyncVisualAccent, compileSyncFeedback, createSyncBatchManifest, SYNC_REVIEW_PLAYBACK_FILES } from '../sync-batch.mjs'
import { generateAcceptedRuntime } from '../accepted-runtime.mjs'
import { sha256 } from '../mp3.mjs'
import { normalizeSyncFeedback } from '../../../apps/sfx-bench/src/syncFeedback.js'
import { planSyncAudition } from '../../../apps/sfx-bench/src/sync.js'
import approved from '../../../packages/battle-sfx/src/runtime.generated.js'
import draft from '../../../packages/battle-sfx/src/draft-runtime.generated.js'

const local = path => readFile(join(BENCH_ROOT, path))
const json = async path => JSON.parse(await local(path))
const visualPath = 'apps/sfx-bench/src/thunderPunchImpact.js'
const [manifest, definition, analysis, snapshot, feedbackBytes, visualBytes] = await Promise.all([
  createCollectionManifest(), json('tools/audio-import/review/sync-batch-003.json'),
  json('tools/audio-import/reports/sfx-remaining-analysis.json'),
  json('tools/audio-import/review/sync-batch-003.review-01.json'),
  local('tools/audio-import/review/sync-batch-003.feedback-01.json'), local(visualPath),
])
const plans = Object.fromEntries(definition.moves.map(row => [row.id, approved.moves[row.id] ?? draft.moves[row.id]]))
const recipeTexts = Object.fromEntries(await Promise.all(definition.moves.map(async row => [row.id,
  (await local(`packages/battle-fx/src/moves/restored/${plans[row.id].fxId}.js`)).toString('utf8'),
])))
const playbackPins = await Promise.all(SYNC_REVIEW_PLAYBACK_FILES.map(async path => ({ path, sha256: sha256(await local(path)) })))
const visualPins = [{ path: visualPath, sha256: sha256(visualBytes) }]
const base = compileSyncBatch({ definition, manifest, analysis, plans, recipeTexts, revisionPins: playbackPins })
const accentInputs = () => ({ batch: structuredClone(base), revisionPins: structuredClone(visualPins) })
const reviewInputs = () => ({ batch: compileSyncVisualAccent(accentInputs()), snapshot: structuredClone(snapshot),
  feedbackBytes: Buffer.from(feedbackBytes), playbackPins: structuredClone(playbackPins) })
const bundleFor = batch => ({ schemaVersion: 1, kind: 'battle-sfx-sync-feedback', batchId: batch.id,
  revision: batch.revision, records: structuredClone(batch.feedbackRecords) })
const keptIds = ['surf', 'watergun', 'crunch', 'swift', 'calmmind']

test('historical third feedback carries the five actual keeps and opens only the changed Thunder Punch for review', async () => {
  assert.equal(sha256(feedbackBytes), '4c8addb95dd53ef9e08b7fb1b6b14f83b63593a93d3711cff8f66bf6c7c6cc1d')
  assert.deepEqual(JSON.parse(feedbackBytes), snapshot.feedback)
  const batch = compileSyncFeedback(reviewInputs())
  assert.equal(batch.status, 'unreviewed-comparison')
  assert.equal(batch.defaultMoveId, 'thunderpunch')
  assert.deepEqual(batch.feedbackRecords.filter(row => row.verdict === 'keep').map(row => row.moveId), keptIds)
  assert.deepEqual(batch.feedbackRecords.filter(row => row.verdict === 'unreviewed').map(row => row.moveId), ['thunderpunch'])
  assert.deepEqual(batch.moves.filter(row => row.previousReview.changed).map(row => row.id), ['thunderpunch'])
  for (const move of batch.moves) {
    const captured = snapshot.feedback.records.find(row => row.moveId === move.id)
    const carried = batch.feedbackRecords.find(row => row.moveId === move.id)
    assert.deepEqual(move.candidate, captured.plan)
    assert.deepEqual(carried.plan, captured.plan)
    assert.equal(carried.notes, captured.notes)
    assert.deepEqual(carried.native, captured.native)
    assert.deepEqual(move.previousReview, { verdict: captured.verdict, notes: captured.notes, plan: captured.plan,
      changed: move.id === 'thunderpunch', revision: snapshot.feedback.revision })
    if (move.id !== 'thunderpunch') assert.deepEqual(carried, captured)
    for (const key of ['approvalFingerprint', 'nativeCompatibility']) assert.equal(Object.hasOwn(move, key), false)
  }
  for (const key of ['approval', 'reviewedRevision']) assert.equal(Object.hasOwn(batch, key), false)
  const thunder = batch.moves.find(row => row.id === 'thunderpunch')
  assert.equal(thunder.previousReview.verdict, 'adjust-animation')
  assert.match(thunder.previousReview.notes, /impact timing is perfect/)
  assert.equal(thunder.visualAccent.revision, sha256(await local(visualPath)))
})

test('Thunder Punch accent leaves original visuals, native sound and previous comparison intact', () => {
  const input = accentInputs(), before = structuredClone(input.batch), accented = compileSyncVisualAccent(input)
  assert.deepEqual(input.batch, before)
  assert.deepEqual(compileSyncVisualAccent(accentInputs()), accented)
  assert.notEqual(accented.revision, before.revision)
  const batch = compileSyncFeedback({ ...reviewInputs(), batch: accented })
  for (const move of batch.moves) {
    const original = base.moves.find(row => row.id === move.id)
    for (const field of ['asset', 'visual', 'baseline', 'candidate']) assert.deepEqual(move[field], original[field])
    const captured = snapshot.moves.find(row => row.id === move.id)
    assert.equal(move.asset.sha256, captured.sourceSha256)
    assert.equal(move.asset.decoded.pcmSha256, captured.sourcePcmSha256)
    assert.equal(move.visual.visualRevision, captured.visualRevision)
    const native = snapshot.feedback.records.find(row => row.moveId === move.id).native
    assert.deepEqual(planSyncAudition(move.candidate, native, move.visual), planSyncAudition(move.previousReview.plan, native, move.visual))
    if (move.id !== 'thunderpunch') assert.deepEqual(accented.moves.find(row => row.id === move.id), original)
    assert.equal(Object.hasOwn(move, 'accent'), false, 'no audio layer is introduced')
  }
  const thunder = batch.moves.find(row => row.id === 'thunderpunch')
  assert.equal(thunder.candidate.visualRate, .9)
  assert.equal(thunder.visualAccent.impactSeconds, .52)
  assert.deepEqual(thunder.visual.markers.find(row => row.id === 'impact').timeSeconds, .52)
  assert.equal(thunder.candidate.segments[0].cueSeconds, .52)
  assert.equal(thunder.candidate.segments[0].soundAnchorSeconds, .34)
  assert.equal(thunder.candidate.segments[0].gainDb, 0)
})

test('artwork changes invalidate saved proposal identity without changing the reviewed base', () => {
  const initial = compileSyncFeedback(reviewInputs()), initialBundle = bundleFor(initial)
  assert.deepEqual(normalizeSyncFeedback(initialBundle, initial), initialBundle)
  const updated = accentInputs(); updated.revisionPins[0].sha256 = 'f'.repeat(64)
  const revised = compileSyncFeedback({ ...reviewInputs(), batch: compileSyncVisualAccent(updated) })
  assert.notEqual(revised.revision, initial.revision)
  assert.notEqual(revised.moves[3].visualAccent.revision, initial.moves[3].visualAccent.revision)
  assert.deepEqual(revised.moves[3].visual, initial.moves[3].visual)
  assert.throws(() => normalizeSyncFeedback(initialBundle, revised), /different batch revision/)
  initialBundle.revision = revised.revision
  assert.throws(() => normalizeSyncFeedback(initialBundle, revised), /visual accent revision/)
  assert.equal(revised.feedbackRecords[3].verdict, 'unreviewed')
  for (const change of [
    value => { delete value.records[3].visualAccent },
    value => { value.records[3].visualAccent.id = 'other-artwork' },
    value => { value.records[3].visualAccent.revision = '0'.repeat(64) },
    value => { value.records[0].visualAccent = value.records[3].visualAccent },
  ]) {
    const value = bundleFor(initial); change(value)
    assert.throws(() => normalizeSyncFeedback(value, initial), /saved (feedback record|visual accent)/)
  }
})

test('visual accent requires a pinned module and the original single contact', () => {
  for (const [change, error] of [
    [value => { value.batch.id = 'sync-002' }, /Unsupported visual accent batch/],
    [value => { value.revisionPins = [] }, /exact artwork revision/],
    [value => { value.revisionPins[0].sha256 = 'unversioned' }, /exact artwork revision/],
    [value => { value.batch.moves[3].visual.markers.find(row => row.id === 'impact').timeSeconds = .53 }, /original Thunder Punch contact/],
    [value => { value.batch.moves[3].visualAccent = { id: 'duplicate' } }, /original Thunder Punch contact/],
  ]) {
    const value = accentInputs(); change(value)
    assert.throws(() => compileSyncVisualAccent(value), error)
  }
})

test('third carryover rejects altered source, visual, transport and archived evidence', () => {
  for (const [change, error] of [
    [value => { value.feedbackBytes = Buffer.concat([value.feedbackBytes, Buffer.from('\n')]) }, /feedback hash/],
    [value => { value.snapshot.feedback.records[3].notes = 'Approved the new sparkle' }, /differs from the captured/],
    [value => { value.snapshot.source.name = 'sync-002-feedback.json' }, /review source identity/],
    [value => { value.batch.moves[3].asset.sha256 = '0'.repeat(64) }, /source provenance/],
    [value => { value.batch.moves[3].asset.decoded.pcmSha256 = '0'.repeat(64) }, /source provenance/],
    [value => { value.batch.moves[3].visual.visualRevision = '0'.repeat(64) }, /visual revision/],
    [value => { value.playbackPins[1].sha256 = '0'.repeat(64) }, /transport has changed/],
    [value => { value.snapshot.moves.pop() }, /all six moves/],
  ]) {
    const value = reviewInputs(); change(value)
    assert.throws(() => compileSyncFeedback(value), error)
  }
  for (const [change, error] of [
    [feedback => { feedback.records[3].visualAccent = { id: 'thunder-punch-impact-v1', revision: visualPins[0].sha256 } }, /saved feedback record/],
    [feedback => { feedback.records[3].verdict = 'approved' }, /Invalid saved feedback/],
    [feedback => { feedback.records[0].plan.visualRate = '' }, /invalid review tuning/],
    [feedback => { feedback.records[0].native.sampleFrames = 0 }, /browser measurement/],
    [feedback => { feedback.records[0].plan.segments[0].gainDb = -2 }, /plan differs from its review/],
  ]) {
    const value = reviewInputs(); change(value.snapshot.feedback)
    value.feedbackBytes = Buffer.from(JSON.stringify(value.snapshot.feedback)); value.snapshot.source.sha256 = sha256(value.feedbackBytes)
    assert.throws(() => compileSyncFeedback(value), error)
  }
})

test('a previous keep can never become approval of a changed visual proposal', () => {
  const value = reviewInputs()
  value.snapshot.feedback.records[3].verdict = 'keep'
  value.feedbackBytes = Buffer.from(JSON.stringify(value.snapshot.feedback)); value.snapshot.source.sha256 = sha256(value.feedbackBytes)
  const result = compileSyncFeedback(value)
  assert.equal(result.moves[3].previousReview.verdict, 'keep')
  assert.equal(result.moves[3].previousReview.changed, true)
  assert.equal(result.feedbackRecords[3].verdict, 'unreviewed')
  assert.deepEqual(result.feedbackRecords.filter(row => row.verdict === 'keep').map(row => row.moveId), keptIds)
  assert.equal(result.defaultMoveId, 'thunderpunch')
})

test('batch three acceptance preserves both earlier final batches and all unrelated generated runtime bytes', async () => {
  const pinned = {
    'tools/audio-import/review/sync-batch-001.final.json': '02e88453cbe4938df7dcd98596a5e10bd070929658f5d1e244273f357586ebee',
    'tools/audio-import/review/sync-batch-002.final.json': 'caf88668e7104c5351a97516654fe84e82c181464e19b3518b1515e683f3085f',
    'packages/battle-sfx/src/catalog.generated.js': 'fd5719b38ffab66078e29dc0c7c59931dd3276c501e3e0cbc7a64d7cd7d2bfbe',
    'packages/battle-sfx/src/draft-runtime.generated.js': '4c6c93c8ee63b8b857b1d9a9a61a43a9f4e6d30601a85bbc1195a922c6b84008',
    'packages/battle-sfx/src/runtime.generated.js': 'c84257eb2308debc7747a1fa081f597ee9f9732cab4705c9561c7b49a9d31e5e',
  }
  for (const [path, expected] of Object.entries(pinned)) assert.equal(sha256(await local(path)), expected, path)
  for (const id of ['sync-001', 'sync-002']) {
    const final = await json(`tools/audio-import/review/sync-batch-${id.slice(-3)}.final.json`)
    const served = await createSyncBatchManifest({ batch: id })
    assert.equal(served.status, 'accepted')
    assert.deepEqual(served.moves, final.moves)
    assert.deepEqual(served.approval, final.approval)
    assert.equal(Object.hasOwn(served, 'feedbackRecords'), false)
    for (const move of served.moves) for (const key of ['visualAccent', 'previousReview', 'candidate', 'baseline']) assert.equal(Object.hasOwn(move, key), false)
  }
  const runtime = await generateAcceptedRuntime({ check: true })
  assert.deepEqual(runtime.catalog.provenance.batches.map(row => row.batchId), ['sync-001', 'sync-002', 'sync-003'])
  assert.equal(Object.keys(runtime.catalog.moves).length, 18)
  for (const move of definition.moves) assert.equal(Object.hasOwn(runtime.catalog.moves, move.id), true)
})
