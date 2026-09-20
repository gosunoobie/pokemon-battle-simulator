import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BENCH_ROOT } from '../bench.mjs'
import { createCollectionManifest } from '../collection.mjs'
import { compileSyncBatch, compileSyncAccent, compileSyncFeedback, compileFinalSyncBatch, createSyncBatchManifest, validateSyncComparison, SYNC_BATCH_AUTHORING_FILES, SYNC_REVIEW_PLAYBACK_FILES } from '../sync-batch.mjs'
import { createBenchMiddleware, sfxBenchPlugin } from '../bench-plugin.mjs'
import { sha256 } from '../mp3.mjs'
import { planSyncAudition } from '../../../apps/sfx-bench/src/sync.js'
import approved from '../../../packages/battle-sfx/src/runtime.generated.js'
import draft from '../../../packages/battle-sfx/src/draft-runtime.generated.js'

const manifest = await createCollectionManifest()
const definition = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/review/sync-batch-001.json')))
const analysis = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/reports/sfx-remaining-analysis.json')))
const plans = Object.fromEntries(definition.moves.map(row => [row.id, approved.moves[row.id] ?? draft.moves[row.id]]))
const recipeTexts = Object.fromEntries(await Promise.all(definition.moves.map(async row => [row.id, await readFile(join(BENCH_ROOT, `packages/battle-fx/src/moves/restored/${plans[row.id].fxId}.js`), 'utf8')])) )
const inputs = { manifest, definition, analysis, plans, recipeTexts, revisionPins: [{ path: 'fixture-authoring.js', sha256: '1'.repeat(64) }] }
const mutate = callback => { const value = structuredClone(definition); callback(value); return value }
const feedbackBytes = await readFile(join(BENCH_ROOT, 'tools/audio-import/review/sync-batch-001.feedback-01.json'))
const snapshot = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/review/sync-batch-001.review-01.json')))
const playbackPins = await Promise.all(SYNC_REVIEW_PLAYBACK_FILES.map(async path => ({ path, sha256: sha256(await readFile(join(BENCH_ROOT, path))) })))
const reviewInputs = () => ({ batch: structuredClone(compileSyncBatch(inputs)), snapshot: structuredClone(snapshot), feedbackBytes: Buffer.from(feedbackBytes), playbackPins: structuredClone(playbackPins) })

test('first sync study retains six exact baselines and labels independent cosmetic and result markers', async () => {
  const result = compileSyncBatch(inputs)
  assert.deepEqual(compileSyncBatch(inputs), result)
  assert.deepEqual(result.moves.map(row => row.id), ['bodyslam', 'aerialace', 'hydropump', 'thunderbolt', 'triplekick', 'absorb'])
  assert.equal(result.id, 'sync-001')
  assert.match(result.revision, /^[a-f0-9]{64}$/)
  for (const move of result.moves) {
    assert.equal(move.asset.id, plans[move.id].assetId)
    assert.equal(move.baseline.visualRate, 1)
    assert.deepEqual(move.baseline.segments, [{ startSeconds: 0, endSeconds: null, soundAnchorSeconds: 0, cueSeconds: 0, gainDb: plans[move.id].segments[0].gainDb }])
    assert.ok(move.notes.length > 0)
    assert.ok(!('approvalFingerprint' in move) && !('nativeCompatibility' in move))
    assert.equal(move.candidate.segments.every(segment => segment.endSeconds === null), move.id !== 'thunderbolt')
  }
  const triple = result.moves.find(row => row.id === 'triplekick')
  assert.deepEqual(triple.visual.markers.map(row => [row.id, row.timeSeconds]), [['contact-1', .5], ['contact-2', .84], ['impact', 1.2]])
  assert.deepEqual(triple.candidate.segments.map(row => row.cueSeconds), [.5, .84, 1.2])
  assert.equal(triple.candidate.segments.every(row => row.soundAnchorSeconds === .26), true)
  const body = result.moves[0]
  assert.equal(body.candidate.visualRate, .9)
  assert.ok(body.candidate.segments[0].cueSeconds / .9 - .88 >= 0)
  const absorb = result.moves.at(-1)
  assert.equal(absorb.asset.id, 'source.absorb')
  assert.equal(absorb.candidate.segments[0].soundAnchorSeconds, .1)
  assert.equal(absorb.visual.markers.find(row => row.id === 'recovery').timeSeconds, .98)
  const served = await createSyncBatchManifest()
  assert.equal(served.moves.length, 6)
  assert.ok(SYNC_BATCH_AUTHORING_FILES.includes('apps/sfx-bench/src/syncVisual.js'))
  assert.ok(SYNC_BATCH_AUTHORING_FILES.includes('apps/sfx-bench/src/SyncBench.vue'))
  assert.ok(SYNC_BATCH_AUTHORING_FILES.includes('tools/audio-import/review/sync-batch-001.feedback-01.json'))
  assert.ok(SYNC_BATCH_AUTHORING_FILES.includes('tools/audio-import/review/sync-batch-001.review-01.json'))
  assert.equal(served.status, 'accepted')
  assert.equal(served.defaultMoveId, undefined)
  await assert.rejects(createSyncBatchManifest({ batch: '../../other' }), error => error.status === 404)
})

test('captured review preserves exactly five unchanged keep decisions and resets the revised Thunderbolt', () => {
  const result = compileSyncFeedback(reviewInputs())
  assert.deepEqual(compileSyncFeedback(reviewInputs()), result)
  assert.notEqual(result.revision, compileSyncBatch(inputs).revision)
  assert.deepEqual(result.feedbackRecords.filter(record => record.verdict === 'keep').map(record => record.moveId), ['bodyslam', 'aerialace', 'hydropump', 'triplekick', 'absorb'])
  assert.equal(result.defaultMoveId, 'thunderbolt')
  for (const move of result.moves) {
    const original = snapshot.feedback.records.find(record => record.moveId === move.id)
    const carried = result.feedbackRecords.find(record => record.moveId === move.id)
    assert.deepEqual(carried.plan, move.candidate)
    assert.equal(carried.notes, original.notes)
    assert.deepEqual(carried.native, original.native)
    assert.deepEqual(move.previousReview, { verdict: original.verdict, notes: original.notes, plan: original.plan, changed: move.id === 'thunderbolt', revision: snapshot.feedback.revision })
    if (move.id !== 'thunderbolt') assert.deepEqual(move.candidate, original.plan)
    assert.ok(!('approvalFingerprint' in move) && !('nativeCompatibility' in move))
  }
  assert.equal(result.feedbackRecords.find(record => record.moveId === 'thunderbolt').verdict, 'unreviewed')
  const changed = reviewInputs()
  changed.batch.moves[0].candidate.visualRate = .8
  const revised = compileSyncFeedback(changed)
  assert.equal(revised.feedbackRecords[0].verdict, 'unreviewed')
  assert.equal(revised.moves[0].previousReview.changed, true)
  assert.equal(revised.defaultMoveId, 'bodyslam')
  assert.notEqual(revised.revision, result.revision)
})

test('Thunderbolt keeps the reviewed onset, impact, pace and gain while ending with the 2 second visual', () => {
  const batch = compileSyncBatch(inputs), move = batch.moves.find(row => row.id === 'thunderbolt')
  const captured = snapshot.feedback.records.find(row => row.moveId === 'thunderbolt')
  assert.deepEqual(move.candidate, { ...captured.plan, segments: [{ ...captured.plan.segments[0], endSeconds: 1.91 }] })
  assert.equal(move.visual.durationSeconds, 2)
  const decoded = move.asset.decoded
  const reference = { sampleRate: decoded.sampleRate, sampleFrames: decoded.sampleFrames, durationSeconds: decoded.sampleFrames / decoded.sampleRate }
  assert.equal(reference.sampleRate, 44100)
  assert.equal(captured.native.sampleRate, 48000)
  for (const native of [reference, captured.native]) {
    const [proposed] = planSyncAudition(move.candidate, native, move.visual)
    const [previous] = planSyncAudition(captured.plan, native, move.visual)
    const [baseline] = planSyncAudition(move.baseline, native, move.visual)
    assert.ok(Math.abs(proposed.delaySeconds - .09) < 1e-12)
    assert.ok(Math.abs(proposed.endSeconds + proposed.delaySeconds - move.visual.durationSeconds) < 1e-12)
    assert.equal(proposed.startSeconds, 0)
    assert.equal(proposed.gainDb, 0)
    assert.equal(previous.delaySeconds, proposed.delaySeconds)
    assert.equal(baseline.endSeconds, native.durationSeconds)
    assert.equal(baseline.delaySeconds, 0)
    assert.ok(previous.endSeconds + previous.delaySeconds > move.visual.durationSeconds)
  }
  assert.equal(captured.native.durationSeconds, 3.07)
})

test('review carryover rejects changed source, visual, transport and captured evidence', () => {
  for (const [change, error] of [
    [value => { value.feedbackBytes = Buffer.concat([value.feedbackBytes, Buffer.from('\n')]) }, /feedback hash/],
    [value => { value.snapshot.feedback.records[0].notes = 'Not the exported note' }, /differs from the captured/],
    [value => { value.batch.moves[0].asset.sha256 = '0'.repeat(64) }, /source provenance/],
    [value => { value.batch.moves[0].asset.decoded.pcmSha256 = '0'.repeat(64) }, /source provenance/],
    [value => { value.batch.moves[0].visual.visualRevision = '0'.repeat(64) }, /visual revision/],
    [value => { value.playbackPins[0].sha256 = '0'.repeat(64) }, /transport has changed/],
    [value => { value.snapshot.playbackPins.pop() }, /three exact playback pins/],
    [value => { value.snapshot.moves.pop() }, /all six moves/],
    [value => { value.snapshot.moves[1].id = 'bodyslam' }, /all six moves/],
    [value => { value.snapshot.moves[0].plan.segments[0].gainDb = -1 }, /plan differs from its review/],
    [value => { value.snapshot.unknown = true }, /snapshot shape/],
  ]) { const value = reviewInputs(); change(value); assert.throws(() => compileSyncFeedback(value), error) }
})

test('well-hashed but malformed archived records cannot manufacture carried decisions', () => {
  for (const [change, error] of [
    [feedback => { feedback.records[1].moveId = 'bodyslam' }, /Invalid saved feedback/],
    [feedback => { feedback.records[0].native.sampleFrames = 0 }, /browser measurement/],
    [feedback => { feedback.records[0].plan.visualRate = '' }, /invalid review tuning/],
    [feedback => { feedback.records[0].plan.segments[0].gainDb = -2 }, /plan differs from its review/],
    [feedback => { feedback.records[0].verdict = 'approved' }, /Invalid saved feedback/],
    [feedback => { feedback.revision = 'not-a-sha' }, /review revision/],
    [feedback => { feedback.batchId = 'sync-002' }, /different batch revision/],
  ]) {
    const value = reviewInputs()
    change(value.snapshot.feedback)
    value.feedbackBytes = Buffer.from(JSON.stringify(value.snapshot.feedback))
    value.snapshot.source.sha256 = sha256(value.feedbackBytes)
    assert.throws(() => compileSyncFeedback(value), error)
  }
})

test('sync definitions reject stale visual/source pins, altered baselines and unmeasured anchors', () => {
  for (const [change, error] of [
    [d => { d.moves[0].sourceSha256 = '0'.repeat(64) }, /source provenance/],
    [d => { d.moves[0].sourcePcmSha256 = '0'.repeat(64) }, /source provenance/],
    [d => { d.moves[0].visualRevision = '0'.repeat(64) }, /visual revision/],
    [d => { d.moves[0].assetId = 'source.tackle' }, /runtime asset/],
    [d => { d.moves[0].baseline.segments[0].gainDb = -8 }, /baseline/],
    [d => { d.moves[0].candidate.segments[0].soundAnchorSeconds = .8 }, /differs from its numeric/],
    [d => { d.moves[0].anchorEvidence[0].startFrame = 1 }, /measured energy/],
    [d => { d.moves[0].authoredMarkers[0].evidence = 'invented timing' }, /needs review/],
    [d => { d.moves[0].authoredMarkers[0].id = 'impact' }, /Duplicate/],
    [d => { d.moves[0].authoredMarkers[0].timeSeconds = 999 }, /marker time/],
    [d => { d.status = 'approved' }, /Unsupported/],
    [d => { d.moves.pop() }, /explicit/],
    [d => { d.moves[0].unknown = true }, /shape/],
  ]) assert.throws(() => compileSyncBatch({ ...inputs, definition: mutate(change) }), error)
  const editedPlans = structuredClone(plans)
  editedPlans.bodyslam.segments[0].startFrame = 1
  assert.throws(() => compileSyncBatch({ ...inputs, plans: editedPlans }), /edited runtime region/)
})

test('comparisons bound visual rate, source regions, gain, timeline start and simultaneous voices', () => {
  const limits = { sourceDuration: 2, visualDuration: 3 }
  const base = { visualRate: 1, segments: [{ startSeconds: 0, endSeconds: null, soundAnchorSeconds: 0, cueSeconds: 0, gainDb: 0 }] }
  assert.equal(validateSyncComparison(base, limits), true)
  for (const [change, error] of [
    [c => { c.visualRate = .7 }, /visual rate/],
    [c => { c.visualRate = 1.5 }, /visual rate/],
    [c => { c.visualRate = NaN }, /visual rate/],
    [c => { c.segments[0].startSeconds = -1 }, /source start/],
    [c => { c.segments[0].endSeconds = 3 }, /source end/],
    [c => { c.segments[0].endSeconds = 0 }, /contain sound/],
    [c => { c.segments[0].soundAnchorSeconds = 2 }, /inside its source/],
    [c => { c.segments[0].soundAnchorSeconds = 1 }, /before the animation/],
    [c => { c.segments[0].gainDb = 1 }, /attenuation-only/],
    [c => { c.segments[0].cueSeconds = 4 }, /visual cue/],
    [c => { c.segments = Array(9).fill(c.segments[0]) }, /1–8/],
    [c => { c.segments = [] }, /1–8/],
  ]) { const c = structuredClone(base); change(c); assert.throws(() => validateSyncComparison(c, limits), error) }
  assert.equal(validateSyncComparison({ ...base, segments: Array(8).fill(base.segments[0]) }, limits), true)
  assert.throws(() => validateSyncComparison({ ...base, segments: [{ ...base.segments[0], cueSeconds: 119 }] }, { ...limits, visualDuration: 120 }), /playback duration/)
})

test('changes to comparison content or new authoring pins change revision without touching legacy evidence', () => {
  const initial = compileSyncBatch(inputs)
  const changedPins = compileSyncBatch({ ...inputs, revisionPins: [{ path: 'fixture-authoring.js', sha256: '2'.repeat(64) }] })
  assert.notEqual(changedPins.revision, initial.revision)
  const changedNotes = compileSyncBatch({ ...inputs, definition: mutate(d => { d.moves[0].notes.push('New explicit review note.') }) })
  assert.notEqual(changedNotes.revision, initial.revision)
  assert.equal(SYNC_BATCH_AUTHORING_FILES.includes('apps/sfx-bench/src/main.js'), false)
  assert.equal(SYNC_BATCH_AUTHORING_FILES.includes('apps/sfx-bench/src/CollectionBench.vue'), false)
})

async function request(middleware, url, { method = 'GET', origin } = {}) {
  const headers = {}, req = { url, method, headers: { host: 'localhost:5173', ...(origin ? { origin } : {}) } }
  let body, next = false
  const response = { statusCode: 0, setHeader(name, value) { headers[name] = value }, end(value) { body = JSON.parse(value) } }
  await middleware(req, response, () => { next = true })
  return { req, status: response.statusCode, headers, body, next }
}

test('sync route and HTML selection require exactly one known batch and remain read-only, same-origin and dev-only', async () => {
  const calls = [], middleware = createBenchMiddleware(null, { syncBatchService: async id => { calls.push(id); return { id } } })
  const page = await request(middleware, '/sfx-bench?batch=sync-001')
  assert.equal(page.req.url, '/sfx-bench.html?batch=sync-001')
  assert.equal(page.next, true)
  const result = await request(middleware, '/__sfx-bench/sync-batch?batch=sync-001')
  assert.equal(result.status, 200)
  assert.equal(result.headers['Cache-Control'], 'no-store')
  assert.equal(result.body.id, 'sync-001')
  for (const path of ['/__sfx-bench/sync-batch', '/__sfx-bench/sync-batch?batch=sync-008', '/__sfx-bench/sync-batch?batch=sync-001&batch=sync-001', '/__sfx-bench/sync-batch?batch=sync-001&extra=1', '/sfx-bench?batch=sync-008', '/sfx-bench.html?batch=sync-001&extra=1', '/sfx-bench?batch=sync-001&collection=remaining']) assert.equal((await request(middleware, path)).status, 404, path)
  assert.equal((await request(middleware, '/__sfx-bench/sync-batch?batch=sync-001', { method: 'POST' })).status, 405)
  assert.equal((await request(middleware, '/__sfx-bench/sync-batch?batch=sync-001', { origin: 'https://elsewhere.example' })).status, 403)
  const second = await request(middleware, '/__sfx-bench/sync-batch?batch=sync-002')
  assert.equal(second.status, 200)
  assert.equal(second.body.id, 'sync-002')
  const secondPage = await request(middleware, '/sfx-bench?batch=sync-002')
  assert.equal(secondPage.req.url, '/sfx-bench.html?batch=sync-002')
  assert.equal(secondPage.next, true)
  const third = await request(middleware, '/__sfx-bench/sync-batch?batch=sync-003')
  assert.equal(third.status, 200); assert.equal(third.body.id, 'sync-003')
  assert.deepEqual(calls, ['sync-001', 'sync-002', 'sync-003'])
  const preview = createBenchMiddleware(null, { preview: true })
  for (const path of ['/sfx-bench?batch=sync-001', '/__sfx-bench/sync-batch?batch=sync-001', '/apps/sfx-bench/src/sync-main.js', '/apps/sfx-bench/src/syncVisual.js']) assert.equal((await request(preview, path)).status, 404)
})

test('HTML transformation swaps only the requested local study, leaving original bench and production input intact', () => {
  const plugin = sfxBenchPlugin(), html = '<script type="module" src="/apps/sfx-bench/src/main.js"></script>'
  assert.match(plugin.transformIndexHtml(html, { server: {}, path: '/sfx-bench.html', originalUrl: '/sfx-bench.html?batch=sync-001' }), /sync-main\.js/)
  assert.match(plugin.transformIndexHtml(html, { server: {}, path: '/sfx-bench.html', originalUrl: '/sfx-bench.html?batch=sync-002' }), /sync-main\.js/)
  assert.match(plugin.transformIndexHtml(html, { server: {}, path: '/sfx-bench.html', originalUrl: '/sfx-bench.html?batch=sync-003' }), /sync-main\.js/)
  for (const originalUrl of ['/sfx-bench', '/sfx-bench?collection=remaining', '/sfx-bench?batch=sync-008', '/sfx-bench?batch=sync-001&extra=1', '/preview?batch=sync-001']) assert.equal(plugin.transformIndexHtml(html, { server: {}, path: '/sfx-bench.html', originalUrl }), html)
  assert.equal(plugin.transformIndexHtml(html, { path: '/sfx-bench.html', originalUrl: '/sfx-bench?batch=sync-001' }), html)
})

const final = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/review/sync-batch-001.final.json')))
const finalInputs = () => ({ final: structuredClone(final), batch: compileSyncFeedback(reviewInputs()), revisionPins: playbackPins })

test('accepted manifest contains only exact approved finals, with no prior plans or feedback overrides', async () => {
  const compiled = compileFinalSyncBatch(finalInputs())
  assert.equal(compiled.status, 'accepted')
  assert.equal(compiled.reviewedRevision, final.reviewedRevision)
  assert.deepEqual(compiled.approval, final.approval)
  assert.deepEqual(compiled.moves, final.moves)
  assert.equal(compiled.feedbackRecords, undefined)
  assert.equal(compiled.defaultMoveId, undefined)
  for (const move of compiled.moves) for (const key of ['baseline', 'candidate', 'previousReview']) assert.equal(Object.hasOwn(move, key), false)
  const served = await createSyncBatchManifest({ batch: 'sync-001' })
  assert.deepEqual(served.moves, final.moves)
  assert.deepEqual(served.batches.map(batch => [batch.id, batch.status]), [['sync-001', 'accepted'], ['sync-002', 'accepted'], ['sync-003', 'accepted'], ['sync-004', 'accepted'], ['sync-005', 'accepted'], ['sync-006', 'accepted'], ['sync-007', 'accepted']])
  compiled.moves[0].plan.visualRate = .8
  assert.equal(final.moves[0].plan.visualRate, .9, 'served mutable objects must not change the captured approval')
})

test('accepted compilation rejects changed plans, sources, visuals, native evidence and extra comparison fields', () => {
  for (const [change, error] of [
    [value => { value.final.moves[0].plan.visualRate = .8 }, /approved plan has changed/],
    [value => { value.final.moves[0].asset.sha256 = '0'.repeat(64) }, /asset provenance/],
    [value => { value.final.moves[0].visual.visualRevision = '0'.repeat(64) }, /visual provenance/],
    [value => { value.final.moves[0].native.sampleFrames++ }, /native measurement/],
    [value => { value.final.moves[0].baseline = value.final.moves[0].plan }, /final move shape/],
    [value => { value.final.approval.source = 'automated-playback' }, /explicit user approval/],
    [value => { value.final.batchId = 'sync-002' }, /Unsupported final sync batch/],
    [value => { value.final.moves.reverse() }, /six approved moves/],
  ]) { const value = finalInputs(); change(value); assert.throws(() => compileFinalSyncBatch(value), error) }
})

const secondDefinition = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/review/sync-batch-002.json')))
const secondSnapshot = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/review/sync-batch-002.review-01.json')))
const secondFeedbackBytes = await readFile(join(BENCH_ROOT, 'tools/audio-import/review/sync-batch-002.feedback-01.json'))
const accentOverlay = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/review/sync-batch-002.accent-01.json')))
const secondPlans = Object.fromEntries(secondDefinition.moves.map(row => [row.id, approved.moves[row.id] ?? draft.moves[row.id]]))
const secondRecipes = Object.fromEntries(await Promise.all(secondDefinition.moves.map(async row => [row.id, await readFile(join(BENCH_ROOT, `packages/battle-fx/src/moves/restored/${secondPlans[row.id].fxId}.js`), 'utf8')])) )
const secondBatchInputs = { ...inputs, definition: secondDefinition, plans: secondPlans, recipeTexts: secondRecipes }
const accentInputs = () => ({ batch: compileSyncBatch(secondBatchInputs), overlay: structuredClone(accentOverlay), manifest, analysis, recipeTexts: secondRecipes, revisionPins: [{ path: 'fixture-accent-player.js', sha256: '3'.repeat(64) }] })
const secondReviewInputs = () => ({ batch: compileSyncAccent(accentInputs()), snapshot: structuredClone(secondSnapshot), feedbackBytes: Buffer.from(secondFeedbackBytes), playbackPins: structuredClone(playbackPins) })

test('historical second-batch review retains five keeps and unreviewed Psychic accent before chat approval', async () => {
  const first = await createSyncBatchManifest({ batch: 'sync-001' })
  const second = compileSyncFeedback(secondReviewInputs())
  assert.equal(second.status, 'unreviewed-comparison')
  assert.deepEqual(second.moves.map(move => move.id), ['icebeam', 'psychic', 'flamethrower', 'shadowball', 'rockslide', 'gigadrain'])
  assert.notEqual(second.revision, first.revision)
  for (const key of ['approval', 'reviewedRevision']) assert.equal(Object.hasOwn(second, key), false)
  assert.equal(second.defaultMoveId, 'psychic')
  assert.deepEqual(second.feedbackRecords.filter(record => record.verdict === 'keep').map(record => record.moveId), ['icebeam', 'flamethrower', 'shadowball', 'rockslide', 'gigadrain'])
  for (const move of second.moves) {
    const captured = secondSnapshot.feedback.records.find(record => record.moveId === move.id)
    const carried = second.feedbackRecords.find(record => record.moveId === move.id)
    assert.ok(move.baseline && move.candidate)
    assert.equal(Object.hasOwn(move, 'plan'), false)
    assert.deepEqual(move.candidate, captured.plan, 'all reviewed base plans remain unchanged')
    assert.deepEqual(move.previousReview, { verdict: captured.verdict, notes: captured.notes, plan: captured.plan, changed: move.id === 'psychic', revision: secondSnapshot.feedback.revision })
    assert.equal(carried.notes, captured.notes)
    assert.deepEqual(carried.native, captured.native)
    if (move.id !== 'psychic') { assert.equal(Object.hasOwn(move, 'accent'), false); assert.deepEqual(carried, captured) }
    assert.equal(first.moves.some(prior => prior.id === move.id), false)
  }
  const psychic = second.moves.find(move => move.id === 'psychic'), psychicFeedback = second.feedbackRecords.find(record => record.moveId === 'psychic')
  assert.equal(psychicFeedback.verdict, 'unreviewed')
  assert.deepEqual(psychicFeedback.accent, { assetId: psychic.accent.asset.id, sha256: psychic.accent.asset.sha256, segment: psychic.accent.segment, native: null })
  assert.ok(psychic.notes.some(note => /new listening proposal/.test(note)))
  const wrongDefinition = structuredClone(definition); wrongDefinition.id = 'sync-002'
  assert.throws(() => compileSyncBatch({ ...inputs, definition: wrongDefinition }), /explicit review moves/)
  await assert.rejects(createSyncBatchManifest({ batch: 'sync-008' }), error => error.status === 404)
})

test('Psychic overlay preserves base sound and visuals while aligning an independent native-speed impact', () => {
  const value = accentInputs(), before = structuredClone(value.batch), result = compileSyncAccent(value)
  assert.deepEqual(value.batch, before, 'compiler must not mutate base definitions')
  assert.deepEqual(compileSyncAccent(accentInputs()), result)
  assert.notEqual(result.revision, before.revision)
  const psychic = result.moves.find(move => move.id === 'psychic'), original = before.moves.find(move => move.id === 'psychic')
  for (const field of ['asset', 'visual', 'baseline', 'candidate']) assert.deepEqual(psychic[field], original[field])
  for (const move of result.moves.filter(move => move.id !== 'psychic')) assert.deepEqual(move, before.moves.find(row => row.id === move.id))
  const { asset, segment } = psychic.accent
  assert.equal(asset.id, 'source.hit-normal-damage')
  assert.equal(asset.sha256, accentOverlay.sourceSha256)
  assert.equal(asset.decoded.pcmSha256, accentOverlay.sourcePcmSha256)
  assert.equal(segment.gainDb, -6)
  const native = { sampleRate: asset.decoded.sampleRate, sampleFrames: asset.decoded.sampleFrames, durationSeconds: asset.decoded.sampleFrames / asset.decoded.sampleRate }
  const [accentVoice] = planSyncAudition({ visualRate: psychic.candidate.visualRate, segments: [segment] }, native, psychic.visual)
  assert.equal(accentVoice.startSeconds, 0)
  assert.equal(accentVoice.endSeconds, native.durationSeconds)
  assert.ok(Math.abs(accentVoice.delaySeconds - .85) < 1e-12)
  assert.ok(Math.abs(accentVoice.delaySeconds + segment.soundAnchorSeconds - .95) < 1e-12)
  assert.ok(accentVoice.delaySeconds + accentVoice.endSeconds < psychic.visual.durationSeconds)
  const changed = accentInputs(); changed.revisionPins[0].sha256 = '4'.repeat(64)
  assert.notEqual(compileSyncAccent(changed).revision, result.revision, 'new layer transport changes only its review revision')
})

test('accent compiler rejects stale sources, unmeasured anchors, wrong move/cue and altered visual evidence', () => {
  for (const [change, error] of [
    [value => { value.overlay.batchId = 'sync-001' }, /Unsupported sync accent/],
    [value => { value.overlay.moveId = 'icebeam' }, /Unsupported sync accent/],
    [value => { value.overlay.assetId = 'source.tackle' }, /explicit Psychic impact recording/],
    [value => { value.overlay.sourceSha256 = '0'.repeat(64) }, /accent source provenance/],
    [value => { value.overlay.sourcePcmSha256 = '0'.repeat(64) }, /accent source provenance/],
    [value => { value.overlay.visualRevision = '0'.repeat(64) }, /accent visual revision/],
    [value => { value.overlay.anchorEvidence.startFrame = 1 }, /measured positive energy rise/],
    [value => { value.overlay.segment.soundAnchorSeconds = .2 }, /differs from numeric evidence/],
    [value => { value.overlay.segment.cueSeconds = 1.03 }, /existing result impact marker/],
    [value => { value.overlay.segment.gainDb = 1 }, /attenuation-only gain/],
    [value => { value.overlay.segment.endSeconds = .3 }, /whole impact recording/],
    [value => { value.overlay.visualEvidence.recipe = 'invented impact' }, /recipe evidence is stale/],
    [value => { value.overlay.unknown = true }, /accent overlay shape/],
  ]) { const value = accentInputs(); change(value); assert.throws(() => compileSyncAccent(value), error) }
})

test('second-batch archived review uses its own exact source and does not claim the new accent was reviewed', () => {
  const result = compileSyncFeedback(secondReviewInputs())
  assert.equal(result.defaultMoveId, 'psychic')
  assert.equal(result.feedbackRecords.find(record => record.moveId === 'psychic').accent.native, null)
  const wrongSource = secondReviewInputs(); wrongSource.snapshot.source.name = 'sync-001-feedback.json'
  assert.throws(() => compileSyncFeedback(wrongSource), /review source identity/)
  const badTransport = secondReviewInputs(); badTransport.playbackPins[1].sha256 = '0'.repeat(64)
  assert.throws(() => compileSyncFeedback(badTransport), /transport has changed/)
  const forged = secondReviewInputs()
  forged.snapshot.feedback.records.find(record => record.moveId === 'psychic').accent = result.feedbackRecords.find(record => record.moveId === 'psychic').accent
  forged.feedbackBytes = Buffer.from(JSON.stringify(forged.snapshot.feedback)); forged.snapshot.source.sha256 = sha256(forged.feedbackBytes)
  assert.throws(() => compileSyncFeedback(forged), /saved feedback record/)
})

const secondFinal = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/review/sync-batch-002.final.json')))
const secondNativeBytes = await readFile(join(BENCH_ROOT, secondFinal.nativeEvidence.path))
const secondFinalInputs = () => ({ final: structuredClone(secondFinal), batch: compileSyncFeedback(secondReviewInputs()), nativeEvidenceBytes: Buffer.from(secondNativeBytes), revisionPins: playbackPins })

test('second accepted manifest retains the approved base plus measured Psychic accent and no old proposals', async () => {
  const result = compileFinalSyncBatch(secondFinalInputs())
  assert.equal(result.status, 'accepted')
  assert.deepEqual(result.moves, secondFinal.moves)
  assert.deepEqual(result.approval, secondFinal.approval)
  assert.equal(result.moves[1].accent.native.sampleFrames, 43348)
  assert.equal(result.moves[1].accent.segment.gainDb, -6)
  for (const move of result.moves) for (const key of ['baseline', 'candidate', 'previousReview']) assert.equal(Object.hasOwn(move, key), false)
  const served = await createSyncBatchManifest({ batch: 'sync-002' })
  assert.equal(served.feedbackRecords, undefined)
  assert.deepEqual(served.moves, secondFinal.moves)
})

test('second final rejects changed native capture, accent identity, approved geometry and base evidence', () => {
  for (const change of [
    value => { value.nativeEvidenceBytes = Buffer.concat([value.nativeEvidenceBytes, Buffer.from('\n')]) },
    value => { value.final.reviewedRevision = '0'.repeat(64) },
    value => { value.final.moves[1].accent.asset.sha256 = '0'.repeat(64) },
    value => { value.final.moves[1].accent.segment.gainDb = -5 },
    value => { value.final.moves[1].accent.native.sampleFrames++ },
    value => { value.final.moves[1].native.sampleFrames++ },
    value => { delete value.final.moves[1].accent },
  ]) { const value = secondFinalInputs(); change(value); assert.throws(() => compileFinalSyncBatch(value)) }
})

test('third accepted manifest retains only the six approved plans and the reviewed Thunder Punch spark', async () => {
  const third = await createSyncBatchManifest({ batch: 'sync-003' })
  const final = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/review/sync-batch-003.final.json')))
  assert.equal(third.status, 'accepted')
  assert.deepEqual(third.moves, final.moves)
  assert.deepEqual(third.approval, final.approval)
  assert.equal(third.reviewedRevision, final.reviewedRevision)
  assert.equal(third.defaultMoveId, undefined)
  assert.equal(third.feedbackRecords, undefined)
  for (const move of third.moves) {
    assert.ok(move.plan && move.native)
    for (const key of ['baseline', 'candidate', 'previousReview', 'accent']) assert.equal(Object.hasOwn(move, key), false)
    assert.equal(Boolean(move.visualAccent), move.id === 'thunderpunch')
  }
})
