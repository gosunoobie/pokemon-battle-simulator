import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCollectionManifest } from '../collection.mjs'
import { compileAcceptedRuntime, generateAcceptedRuntime, ACCEPTED_BATCH, ACCEPTED_BATCHES } from '../accepted-runtime.mjs'
import { sha256 } from '../mp3.mjs'
import { planSyncAudition } from '../../../apps/sfx-bench/src/sync.js'
import { compileFinalSyncBatch, THIRD_REVIEW_PLAYBACK_FILES } from '../sync-batch.mjs'

const manifest = await createCollectionManifest()
const finalBytes = await readFile(new URL(`../../../${ACCEPTED_BATCH}`, import.meta.url))
const final = JSON.parse(finalBytes)
const compile = value => compileAcceptedRuntime({ final: value, finalBytes: Buffer.from(JSON.stringify(value)), manifest })
const secondBytes = await readFile(new URL(`../../../${ACCEPTED_BATCHES[1]}`, import.meta.url))
const second = JSON.parse(secondBytes)
const nativeEvidenceBytes = await readFile(new URL(`../../../${second.nativeEvidence.path}`, import.meta.url))
const compileSecond = value => compileAcceptedRuntime({ final: value, finalBytes: Buffer.from(JSON.stringify(value)), manifest, nativeEvidenceBytes })
const thirdBytes = await readFile(new URL(`../../../${ACCEPTED_BATCHES[2]}`, import.meta.url))
const third = JSON.parse(thirdBytes)
const reviewEvidenceBytes = await readFile(new URL(`../../../${third.reviewEvidence.path}`, import.meta.url))
const feedbackEvidenceBytes = await readFile(new URL(`../../../${third.reviewEvidence.feedbackPath}`, import.meta.url))
const thirdPlaybackPins = await Promise.all(THIRD_REVIEW_PLAYBACK_FILES.map(async path => ({ path, sha256: sha256(await readFile(new URL(`../../../${path}`, import.meta.url))) })))
const thirdInputs = () => ({ final: structuredClone(third), manifest, finalBytes: Buffer.from(thirdBytes),
  reviewEvidenceBytes: Buffer.from(reviewEvidenceBytes), feedbackEvidenceBytes: Buffer.from(feedbackEvidenceBytes), playbackPins: structuredClone(thirdPlaybackPins) })
const compileThird = input => compileAcceptedRuntime({ ...input, finalBytes: Buffer.from(JSON.stringify(input.final)) })

test('accepted runtime is reproducible and retains only the six final playback plans', async () => {
  const result = compile(final)
  assert.deepEqual(compile(final), result)
  assert.equal(Object.keys(result.catalog.moves).length, 6)
  assert.doesNotMatch(result.generated, /previousReview|baseline|sound_effects|Sounds perfect|userAgent/)
  for (const move of final.moves) {
    const plan = result.catalog.moves[move.id]
    assert.deepEqual(plan.segments, move.plan.segments)
    assert.equal(plan.visualRate, move.plan.visualRate)
    assert.equal(plan.nativeCompatibility.sampleFrames, move.native.sampleFrames)
    assert.equal(result.catalog.assets[plan.assetId].file, `${move.asset.sha256}.mp3`)
  }
  await generateAcceptedRuntime({ check: true })
})

test('second acceptance preserves all six exact native plans and the independent Psychic impact', async () => {
  const { catalog } = compileSecond(second)
  assert.deepEqual(Object.keys(catalog.moves), ['icebeam', 'psychic', 'flamethrower', 'shadowball', 'rockslide', 'gigadrain'])
  assert.equal(Object.keys(catalog.assets).length, 7)
  for (const move of second.moves) {
    assert.deepEqual(catalog.moves[move.id].segments, move.plan.segments)
    assert.equal(catalog.moves[move.id].visualRate, move.plan.visualRate)
    assert.equal(catalog.moves[move.id].nativeCompatibility.sampleFrames, move.native.sampleFrames)
  }
  const psychic = catalog.moves.psychic
  assert.equal(psychic.accent.assetId, 'source.hit-normal-damage')
  assert.equal(psychic.accent.nativeCompatibility.sampleFrames, 43348)
  assert.equal(psychic.accent.nativeCompatibility.sampleRate, 48000)
  assert.equal(psychic.accent.segment.gainDb, -6)
  const [region] = planSyncAudition({ visualRate: psychic.visualRate, segments: [psychic.accent.segment] }, second.moves[1].accent.native, second.moves[1].visual)
  assert.ok(Math.abs(region.delaySeconds - .85) < 1e-9)
  assert.equal(region.endSeconds, 43348 / 48000)
  const result = await generateAcceptedRuntime({ check: true })
  assert.equal(Object.keys(result.catalog.moves).length, 18)
  assert.equal(Object.keys(result.catalog.assets).length, 19)
  assert.deepEqual(result.catalog.provenance.batches.map(row => row.batchId), ['sync-001', 'sync-002', 'sync-003'])
  for (const [id, plan] of Object.entries(compile(final).catalog.moves)) assert.deepEqual(result.catalog.moves[id], plan)
  assert.equal(sha256(finalBytes), '02e88453cbe4938df7dcd98596a5e10bd070929658f5d1e244273f357586ebee', 'first accepted evidence stays byte-identical')
})

test('second final requires real measured base and accent evidence and cannot promote another move', () => {
  for (const change of [
    value => { value.batchId = 'sync-003' },
    value => { value.moves[1].accent.native.sampleFrames++ },
    value => { value.moves[1].accent.asset.sha256 = '0'.repeat(64) },
    value => { value.moves[1].accent.asset.decoded.pcmSha256 = '0'.repeat(64) },
    value => { value.moves[1].accent.segment.gainDb = -5 },
    value => { value.moves[1].accent.segment.cueSeconds = 1 },
    value => { value.moves[1].accent.asset.id = 'source.tackle' },
    value => { delete value.moves[1].accent },
    value => { value.moves[0].native.sampleFrames++ },
    value => { value.nativeEvidence.sha256 = '0'.repeat(64) },
    value => { value.reviewedRevision = '0'.repeat(64) },
  ]) {
    const value = structuredClone(second); change(value)
    assert.throws(() => compileSecond(value))
  }
  assert.throws(() => compileAcceptedRuntime({ final: second, finalBytes: secondBytes, manifest }), /native evidence bytes/)
})

test('third acceptance preserves the six measured native plans and approved visual accent identity', async () => {
  const input = thirdInputs(), { catalog } = compileThird(input)
  assert.deepEqual(Object.keys(catalog.moves), ['surf', 'watergun', 'crunch', 'thunderpunch', 'swift', 'calmmind'])
  assert.equal(Object.keys(catalog.assets).length, 6)
  const captured = JSON.parse(reviewEvidenceBytes), feedback = JSON.parse(feedbackEvidenceBytes)
  assert.equal(third.reviewedRevision, captured.manifest.revision)
  assert.equal(third.reviewedRevision, feedback.revision)
  assert.equal(third.approval.text, 'Okay now everything looks perfect now go ahead with the next batch')
  assert.equal(third.approval.date, '2026-09-18')
  for (const move of third.moves) {
    const native = feedback.records.find(record => record.moveId === move.id)
    assert.equal(native.verdict, 'keep')
    assert.deepEqual(move.plan, native.plan)
    assert.deepEqual(move.native, native.native)
    assert.deepEqual(catalog.moves[move.id].segments, native.plan.segments)
    assert.equal(catalog.moves[move.id].nativeCompatibility.version, '152.0.0.0')
    assert.equal(catalog.moves[move.id].nativeCompatibility.sampleRate, 48000)
    assert.equal(catalog.moves[move.id].nativeCompatibility.sampleFrames, native.native.sampleFrames)
    assert.equal(catalog.moves[move.id].accent, undefined)
  }
  assert.deepEqual(catalog.moves.thunderpunch.visualAccent, { id: 'thunder-punch-impact-v1',
    revision: 'c7eb5f957abef8f40f97c74f23e371c6768a921ec7ef9b17ff63f0cd93c55235', impactSeconds: .52 })
  assert.equal(catalog.moves.thunderpunch.visualRate, .9)
  assert.equal(catalog.moves.watergun.visualRate, .8)
  assert.equal(catalog.moves.calmmind.visualRate, .75)
  const combined = await generateAcceptedRuntime({ check: true })
  assert.equal(Object.keys(combined.catalog.moves).length, 18)
  assert.equal(Object.keys(combined.catalog.assets).length, 19)
  for (const prior of [compile(final).catalog, compileSecond(second).catalog])
    for (const [id, plan] of Object.entries(prior.moves)) assert.deepEqual(combined.catalog.moves[id], plan)
  assert.equal(sha256(finalBytes), '02e88453cbe4938df7dcd98596a5e10bd070929658f5d1e244273f357586ebee')
  assert.equal(sha256(secondBytes), 'caf88668e7104c5351a97516654fe84e82c181464e19b3518b1515e683f3085f')
})

test('third acceptance rejects changed review, source, PCM, visual, plan, native and accent evidence', () => {
  for (const change of [
    value => { value.final.moves[0].asset.sha256 = '0'.repeat(64) },
    value => { value.final.moves[0].asset.decoded.pcmSha256 = '0'.repeat(64) },
    value => { value.final.moves[0].visual.visualRevision = '0'.repeat(64) },
    value => { value.final.moves[0].plan.visualRate = .9 },
    value => { value.final.moves[0].native.sampleFrames++ },
    value => { value.final.moves[3].visualAccent.id = 'different-spark' },
    value => { value.final.moves[3].visualAccent.revision = '0'.repeat(64) },
    value => { value.final.moves[3].visualAccent.impactSeconds = .53 },
    value => { delete value.final.moves[3].visualAccent },
    value => { value.final.moves[0].visualAccent = value.final.moves[3].visualAccent },
    value => { value.final.reviewedRevision = '0'.repeat(64) },
    value => { value.final.approval.source = 'automatic-analysis' },
    value => { value.reviewEvidenceBytes = Buffer.concat([value.reviewEvidenceBytes, Buffer.from('\n')]) },
    value => { value.feedbackEvidenceBytes = Buffer.concat([value.feedbackEvidenceBytes, Buffer.from('\n')]) },
    value => { value.playbackPins[0].sha256 = '0'.repeat(64) },
    value => { value.playbackPins[3].sha256 = '0'.repeat(64) },
    value => { value.playbackPins.pop() },
  ]) {
    const value = thirdInputs(); change(value)
    assert.throws(() => compileThird(value))
  }
  for (const change of [
    value => { value.records[3].verdict = 'unreviewed' },
    value => { value.records[3].plan.segments[0].cueSeconds = .53 },
    value => { delete value.records[3].visualAccent },
    value => { value.records[3].visualAccent.revision = '0'.repeat(64) },
    value => { value.records[3].native.sampleFrames = 0 },
  ]) {
    const input = thirdInputs(), feedback = JSON.parse(input.feedbackEvidenceBytes), capture = JSON.parse(input.reviewEvidenceBytes)
    change(feedback)
    input.feedbackEvidenceBytes = Buffer.from(JSON.stringify(feedback))
    capture.source.sha256 = sha256(input.feedbackEvidenceBytes)
    input.reviewEvidenceBytes = Buffer.from(JSON.stringify(capture))
    input.final.reviewEvidence.feedbackSha256 = sha256(input.feedbackEvidenceBytes)
    input.final.reviewEvidence.sha256 = sha256(input.reviewEvidenceBytes)
    assert.throws(() => compileThird(input), 'coherently rehashed unfinished or invalid feedback cannot fabricate approval')
  }
})

test('third final page rejects comparison overrides while preserving its precise approved review', () => {
  const captured = JSON.parse(reviewEvidenceBytes).manifest
  const input = { ...thirdInputs(), batch: captured, revisionPins: thirdPlaybackPins }
  const result = compileFinalSyncBatch(input)
  assert.equal(result.status, 'accepted')
  assert.deepEqual(result.moves, third.moves)
  assert.equal(result.feedbackRecords, undefined)
  assert.equal(result.defaultMoveId, undefined)
  for (const move of result.moves) for (const field of ['candidate', 'baseline', 'previousReview']) assert.equal(Object.hasOwn(move, field), false)
  for (const change of [
    value => { value.final.moves[0].baseline = value.final.moves[0].plan },
    value => { value.final.moves[0].native.sampleFrames++ },
    value => { value.final.moves[3].visualAccent.impactSeconds = .53 },
    value => { value.batch.moves[0].asset.sha256 = '0'.repeat(64) },
    value => { value.batch.moves[0].candidate.visualRate = .9 },
  ]) { const value = structuredClone(input); value.reviewEvidenceBytes = Buffer.from(reviewEvidenceBytes); value.feedbackEvidenceBytes = Buffer.from(feedbackEvidenceBytes); change(value); assert.throws(() => compileFinalSyncBatch(value)) }
})

test('accepted timing retains slowed Body Slam, three cosmetic kicks and the shortened Thunderbolt', () => {
  const { catalog } = compile(final)
  const regions = id => {
    const move = final.moves.find(move => move.id === id), plan = catalog.moves[id]
    return planSyncAudition({ visualRate: plan.visualRate, segments: plan.segments }, move.native, move.visual)
  }
  assert.equal(catalog.moves.bodyslam.visualRate, .9)
  assert.ok(Math.abs(regions('bodyslam')[0].delaySeconds - (.82 / .9 - .88)) < 1e-9)
  assert.deepEqual(regions('triplekick').map(region => Number(region.delaySeconds.toFixed(2))), [.24, .58, .94])
  const thunder = regions('thunderbolt')[0]
  assert.equal(thunder.delaySeconds + thunder.endSeconds - thunder.startSeconds, 2)
  assert.equal(catalog.moves.thunderbolt.segments[0].endSeconds, 1.91)
})

test('changed source, visual provenance, approval identity and invalid native regions are rejected', () => {
  const mutate = callback => { const value = structuredClone(final); callback(value); return value }
  for (const [change, message] of [
    [v => { v.moves[0].asset.sha256 = '0'.repeat(64) }, /source\/PCM/],
    [v => { v.moves[0].asset.decoded.pcmSha256 = '0'.repeat(64) }, /source\/PCM/],
    [v => { v.moves[0].visual.visualRevision = '0'.repeat(64) }, /visual revision/],
    [v => { v.moves[0].fxId = 'invented' }, /mapping/],
    [v => { v.approval.source = 'automatic-analysis' }, /user approval/],
    [v => { v.moves.pop() }, /six accepted/],
    [v => { v.moves[0].plan.segments[0].endSeconds = 40 }, /outside this native/],
    [v => { v.moves[0].plan.segments[0].gainDb = 1 }, /attenuation-only/],
    [v => { v.moves[0].native.sampleFrames = 1 }, /native recording/],
    [v => { v.moves[0].native.userAgent = 'Firefox/145.0' }, /Chrome decoder/],
  ]) assert.throws(() => compile(mutate(change)), message)
  assert.throws(() => compileAcceptedRuntime({ final, finalBytes: Buffer.from('{}'), manifest }), /bytes differ/)
})
