import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { analyzeEnvelope, buildCandidate, compileRemainingAnalysis, reviewContext, candidateKey } from '../analysis.mjs'
import { createReviewRecord, approveReviewRecord, importReviewBundle } from '../../../packages/battle-sfx/src/review.js'

const policy = JSON.parse(await readFile(new URL('../analysis-policy.json', import.meta.url)))
const gainReference = { peakDbfs: -8, rmsDbfs: -20 }
const hash = 'a'.repeat(64), otherHash = 'b'.repeat(64)
const pcm = (frames = 1600) => [new Float32Array(frames), new Float32Array(frames)]
function fixture({ kind = 'move', phase = 'attack', variant = { type: 'whole' }, durationSeconds = 2, fxId = 'test', id = 'test' } = {}) {
  const asset = { id: `source.${id}`, variant, file: `${id}.mp3`, sha256: hash, decoded: { sampleRate: 8000, sampleFrames: 1600, pcmSha256: hash, peakDbfs: -10, rmsDbfs: -25 } }
  const subject = { kind, id, phase, fxId, durationSeconds, visualRevision: otherHash, markers: [{ id: 'impact', kind: 'result', timeSeconds: 0.1 }], assetIds: [asset.id], notes: [] }
  const manifest = { assets: { [asset.id]: asset }, moves: kind === 'move' ? { [id]: { assetIds: [asset.id] } } : {}, events: kind === 'event' ? { [id]: { assetIds: [asset.id] } } : {}, visualRevisions: { [`${kind}:${id}:${phase}`]: otherHash }, subjects: [subject], auditLockSha256: hash, provenance: { auditLockSha256: hash } }
  const channels = pcm(); channels[0][80] = 0.25; channels[1][80] = 0.25
  const measurement = { assetId: asset.id, ...analyzeEnvelope(channels, 8000, policy, gainReference) }
  return { asset, subject, manifest, measurement, policy }
}

test('energy analysis uses whole frames, both channels, stable ties, and exact-zero dBFS nulls', () => {
  const channels = pcm(161); channels[1][80] = 0.5
  const result = analyzeEnvelope(channels, 8000, policy, gainReference)
  assert.equal(result.windowFrames, 80); assert.equal(result.windowCount, 3)
  assert.deepEqual(result.strongestEnergyWindow, { startFrame: 80, endFrame: 160, rmsDbfs: -28.06179974, peakDbfs: -6.02059991 })
  assert.equal(result.peak, 0.5)
  assert.equal(result.firstFrameAboveQuietThreshold, 80); assert.equal(result.lastFrameAboveQuietThreshold, 80)
  assert.equal(result.leadingQuietFrames, 80); assert.equal(result.trailingQuietFrames, 80)
  assert.deepEqual(result.envelope.bins[2], [160, 161, null, null])
  assert.equal(result.positiveEnergyRises[0].startFrame, 80)
})

test('all-silent measurements do not invent an onset or boost', () => {
  const result = analyzeEnvelope(pcm(), 8000, policy, gainReference)
  assert.equal(result.peakDbfs, null); assert.equal(result.rmsDbfs, null)
  assert.equal(result.firstFrameAboveQuietThreshold, null); assert.equal(result.lastFrameAboveQuietThreshold, null)
  assert.equal(result.strongestEnergyWindow.startFrame, 0)
  assert.equal(result.suggestedGainDb, 0); assert.equal(result.allBelowQuietThreshold, true)
  assert.deepEqual(result.positiveEnergyRises, [])
})

test('gain suggestions attenuate to both pilot technical ceilings, never boost quiet recordings', () => {
  const channels = pcm(); channels.forEach(channel => channel.fill(0.5))
  const loud = analyzeEnvelope(channels, 8000, policy, gainReference)
  assert.equal(loud.suggestedGainDb, -13.98)
  assert.ok(loud.peakDbfs + loud.suggestedGainDb <= gainReference.peakDbfs)
  assert.ok(loud.rmsDbfs + loud.suggestedGainDb <= gainReference.rmsDbfs)
  channels.forEach(channel => channel.fill(0.0001))
  assert.equal(analyzeEnvelope(channels, 8000, policy, gainReference).suggestedGainDb, 0)
})

test('bounded energy envelope and spaced rise candidates are deterministic', () => {
  const channels = pcm(80000)
  for (let frame = 0; frame < channels[0].length; frame += 800) channels[0][frame] = channels[1][frame] = 0.2
  const first = analyzeEnvelope(channels, 8000, policy, gainReference)
  const second = analyzeEnvelope(channels, 8000, policy, gainReference)
  assert.deepEqual(first, second)
  assert.equal(first.envelope.bins.length, 64)
  assert.equal(first.positiveEnergyRises.length, 5)
  assert.deepEqual(first.positiveEnergyRises.map(row => row.startFrame), [0, 800, 1600, 2400, 3200])
})

test('analysis rejects invalid, nonfinite, unbounded PCM and unmeasured gain references', () => {
  assert.throws(() => analyzeEnvelope(pcm(), 8000, policy), /gain reference/)
  assert.throws(() => analyzeEnvelope([], 8000, policy, gainReference), /channels/)
  assert.throws(() => analyzeEnvelope(pcm(), 7999, policy, gainReference), /bounds/)
  assert.throws(() => analyzeEnvelope(pcm(0), 8000, policy, gainReference), /bounds/)
  const channels = pcm(); channels[0][1] = NaN
  assert.throws(() => analyzeEnvelope(channels, 8000, policy, gainReference), /Non-finite/)
  assert.throws(() => analyzeEnvelope(pcm(), 8000, { ...policy, promotion: 'approve' }, gainReference), /non-promoting/)
})

test('draft baseline preserves whole source and never manufactures reviewer/native evidence', () => {
  const input = fixture(), { candidate, record } = buildCandidate(input)
  assert.equal(record.status, 'draft'); assert.equal(record.approvalFingerprint, null)
  assert.equal(record.review.reviewer, ''); assert.equal(record.review.near, false); assert.equal(record.review.far, false)
  assert.equal(record.review.native.sampleRate, null); assert.equal(record.review.native.sampleFrames, null)
  assert.equal(record.review.native.alignmentConfirmed, false)
  assert.equal(record.segments[0].startFrame, 0); assert.equal(record.segments[0].endFrame, 1600)
  assert.equal(record.segments[0].sourceAnchorFrame, 0); assert.equal(record.segments[0].visualAnchorSeconds, 0)
  assert.equal(record.segments[0].gainDb, 0)
  assert.match(record.review.notes, /Automated technical DRAFT/)
  assert.equal(candidate.visualComparisonAllowed, true)
  assert.ok(importReviewBundle(JSON.stringify({ schemaVersion: 1, kind: 'battle-sfx-reviews', auditLockSha256: hash, records: [record] }), reviewContext(input.manifest)))
})

test('optional whole-source energy alignment never trims lead-in or schedules a negative start', () => {
  const input = fixture(), result = buildCandidate(input)
  const alt = result.candidate.alternatives.find(row => row.id === 'energy-window-to-result')
  assert.equal(alt.segments[0].sourceAnchorFrame, 80)
  assert.equal(alt.segments[0].visualAnchorSeconds, 0.1)
  assert.equal(alt.segments[0].startFrame, 0); assert.equal(alt.segments[0].endFrame, 1600)
  input.subject.markers[0].timeSeconds = 0.001
  const impossible = buildCandidate(input)
  assert.ok(!impossible.candidate.alternatives.some(row => row.id === 'energy-window-to-result'))
  assert.match(impossible.candidate.reasoning.join(' '), /No lead-in was cut/)
})

test('threshold region comparison includes bounded padding and does not mutate the original draft', () => {
  const input = fixture(), { record, candidate } = buildCandidate(input)
  const alt = candidate.alternatives.find(row => row.id === 'threshold-edge-comparison')
  assert.deepEqual([alt.segments[0].startFrame, alt.segments[0].endFrame], [0, 481])
  assert.equal(record.segments[0].endFrame, 1600)
  assert.match(alt.description, /no claim of silence/)
})

test('threshold-region gain is measured within the proposed region instead of reusing whole-file RMS', () => {
  const channels = pcm(1600); channels.forEach(channel => channel.fill(0.2, 200, 400))
  const result = analyzeEnvelope(channels, 8000, policy, gainReference)
  assert.equal(result.suggestedGainDb, 0)
  assert.ok(result.thresholdRegion.suggestedGainDb < 0)
  assert.ok(result.thresholdRegion.rmsDbfs + result.thresholdRegion.suggestedGainDb <= gainReference.rmsDbfs)
  const input = fixture(); input.measurement = result
  const comparison = buildCandidate(input).candidate.alternatives.find(row => row.id === 'threshold-edge-comparison')
  assert.equal(comparison.segments[0].gainDb, result.thresholdRegion.suggestedGainDb)
})

test('parts, hit counts, preparation, residuals and outcomes never get inferred energy-to-impact roles', () => {
  for (const variant of [{ type: 'part', part: 1 }, { type: 'hit-count', hitCount: 1 }, { type: 'turn-effect', outcome: 'damage' }, { type: 'outcome', outcome: 'heal' }]) {
    const result = buildCandidate(fixture({ variant }))
    assert.ok(!result.candidate.alternatives.some(row => row.id === 'energy-window-to-result'))
    assert.ok(result.candidate.flags.some(flag => flag.startsWith('variant-role-unassigned')))
  }
  const prepare = buildCandidate(fixture({ phase: 'prepare' }))
  assert.ok(!prepare.candidate.alternatives.some(row => row.id === 'energy-window-to-result'))
  assert.ok(prepare.candidate.flags.includes('prepare-role-unassigned'))
  assert.equal(buildCandidate(fixture({ variant: { type: 'turn-effect', outcome: 'damage' } })).candidate.visualComparisonAllowed, false)
  assert.equal(buildCandidate(fixture({ id: 'present', variant: { type: 'outcome', outcome: 'heal' } })).candidate.visualComparisonAllowed, false)
})

test('no-FX candidates remain report-only and events retain honest audio-only drafts', () => {
  const noFx = buildCandidate(fixture({ fxId: null, durationSeconds: null }))
  assert.equal(noFx.record, null); assert.equal(noFx.candidate.status, 'report-only'); assert.equal(noFx.candidate.visualComparisonAllowed, false)
  const event = buildCandidate(fixture({ kind: 'event', id: 'battle.faint', fxId: null, durationSeconds: null, variant: { type: 'generic' } }))
  assert.equal(event.record.status, 'draft'); assert.equal(event.candidate.visualComparisonAllowed, false)
  assert.ok(!event.candidate.alternatives.some(row => row.id === 'energy-window-to-result'))
})

test('compiler preserves an approved exact key and accounts for missing/no-visual cases', () => {
  const input = fixture()
  const approved = createReviewRecord({ asset: input.asset, subject: input.subject, visualRevision: otherHash, decoderReference: { auditLockSha256: hash } })
  approved.review = { reviewer: 'Original reviewer', notes: 'Existing approved evidence', near: true, far: true, native: { browser: 'Test', version: '1', sampleRate: 8000, sampleFrames: 1600, alignmentConfirmed: true, notes: 'Measured' } }
  const record = approveReviewRecord(approved, reviewContext(input.manifest)), before = JSON.stringify(record)
  input.manifest.subjects.push({ ...input.subject, id: 'missing', assetIds: [], notes: ['No source exists'] })
  input.manifest.moves.missing = { assetIds: [] }
  const result = compileRemainingAnalysis({ manifest: input.manifest, measurements: [input.measurement], approvedRecords: [record], policy })
  assert.equal(result.summary.approvedCandidateCount, 1); assert.equal(result.summary.draftCount, 0); assert.equal(result.summary.missingSourceSubjectCount, 1)
  assert.equal(JSON.stringify(record), before)
  assert.equal(result.candidates.find(row => row.key === candidateKey(record.subject, record.source.assetId)).status, 'approved-existing')
  assert.equal(result.summary.listeningApprovalsAdded, 0); assert.equal(result.summary.runtimeMappingsAdded, 0)
  assert.throws(() => compileRemainingAnalysis({ manifest: input.manifest, measurements: [], approvedRecords: [record], policy }), /Every audited/)
})

test('all draft batches stay within unchanged 64-record importer limits', () => {
  const manifest = { assets: {}, moves: {}, events: {}, subjects: [], visualRevisions: {}, auditLockSha256: hash, provenance: { auditLockSha256: hash } }, measurements = []
  for (let index = 0; index < 65; index++) {
    const row = fixture({ id: `test${index}` })
    Object.assign(manifest.assets, row.manifest.assets); Object.assign(manifest.moves, row.manifest.moves); Object.assign(manifest.visualRevisions, row.manifest.visualRevisions)
    manifest.subjects.push(row.subject); measurements.push(row.measurement)
  }
  const result = compileRemainingAnalysis({ manifest, measurements, approvedRecords: [], policy })
  assert.deepEqual(result.batches.map(batch => batch.count), [64, 1])
  assert.equal(result.summary.candidateCount, 65); assert.equal(result.summary.draftCount, 65)
  for (const output of result.outputs) assert.ok(importReviewBundle(output.bytes.toString(), reviewContext(manifest)))
  assert.ok(result.candidates.every(row => row.batchId))
})
