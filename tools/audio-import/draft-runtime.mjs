import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { BENCH_ROOT } from './bench.mjs'
import { createCollectionManifest } from './collection.mjs'
import { readRemainingAnalysis, candidateKey, reviewContext } from './analysis.mjs'
import { assert, atomicWrite, json, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { importReviewBundle } from '../../packages/battle-sfx/src/review.js'

const SELECTION = 'tools/audio-import/draft-runtime-selection.json'
const ANALYSIS = 'tools/audio-import/reports/sfx-remaining-analysis.json'
const APPROVED_SELECTION = 'tools/audio-import/runtime-selection.json'
const GENERATED = 'packages/battle-sfx/src/draft-runtime.generated.js'
const REPORT = 'tools/audio-import/reports/sfx-draft-runtime.json'
const POLICY = {
  scope: 'battle-simulation-and-move-preview', mode: 'normal', outcome: 'hit', phase: 'attack',
  reviewStatus: 'technical-draft', playbackPolicy: 'whole-native-buffer-at-visual-start',
  playbackRate: 1, tailPolicy: 'continue-until-region-end',
  gainPolicy: 'exact-attenuation-only-analysis-default', unselected: 'silence',
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const hash = text => sha256(Buffer.from(text))
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
function keys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) && equal(Object.keys(value).sort(), [...expected].sort())
}

/** Compile explicit integration choices without creating or upgrading listening approvals. */
export function compileDraftRuntime({ manifest, analysisText, batchTexts, approvedSelectionText, selectionText }) {
  const analysis = JSON.parse(analysisText), selection = JSON.parse(selectionText)
  assert(keys(selection, ['schemaVersion', 'kind', 'analysisReportSha256', 'collectionRevision', 'batches', 'policy', 'entries']) && selection.schemaVersion === 1 && selection.kind === 'battle-sfx-draft-runtime-selection', 'Unsupported draft runtime selection schema')
  assert(selection.analysisReportSha256 === hash(analysisText), 'Draft selection pins a different analysis report')
  assert(selection.collectionRevision === manifest.collectionRevision && analysis.provenance?.collectionRevision === manifest.collectionRevision && analysis.provenance?.auditLockSha256 === manifest.auditLockSha256, 'Draft collection or audit revision is stale')
  assert(analysis.schemaVersion === 1 && analysis.kind === 'battle-sfx-remaining-technical-analysis' && analysis.status === 'drafts-only', 'Unsupported remaining-analysis report')
  assert(analysis.provenance.manifestSha256 === hash(JSON.stringify(manifest)), 'Analysis manifest provenance is stale')
  assert(analysis.provenance.runtimeSelection?.sha256 === hash(approvedSelectionText), 'Approved runtime selection changed')
  assert(equal(selection.policy, POLICY), 'Draft runtime playback policy changed')
  assert(Array.isArray(selection.entries) && selection.entries.length === 323, 'Draft selection must explicitly list all 323 remaining playable move defaults')
  assert(equal(selection.batches, analysis.batches.map(({ id, sha256 }) => ({ id, sha256 }))), 'Draft selection batch pins changed')
  const context = reviewContext(manifest), records = new Map(), candidates = new Map(), measurements = new Map()
  for (const batch of analysis.batches) {
    const text = batchTexts[batch.id]
    assert(typeof text === 'string' && hash(text) === batch.sha256 && Buffer.byteLength(text) === batch.bytes, `Draft batch differs from analysis report: ${batch.id}`)
    const bundle = importReviewBundle(text, context)
    assert(bundle.records.length === batch.count, `Draft batch count differs: ${batch.id}`)
    for (const record of bundle.records) {
      assert(record.status === 'draft' && record.approvalFingerprint === null, 'Technical drafts must not claim approval')
      const review = record.review, native = review.native
      assert(review.reviewer === '' && !review.near && !review.far && native.browser === '' && native.version === '' && native.sampleRate === null && native.sampleFrames === null && !native.alignmentConfirmed, 'Technical drafts must not invent listening or native decoder evidence')
      const key = candidateKey(record.subject, record.source.assetId)
      assert(!records.has(key), `Duplicate technical draft: ${key}`)
      records.set(key, { record, batch })
    }
  }
  assert(records.size === analysis.summary.draftCount, 'Incomplete technical draft batches')
  for (const candidate of analysis.candidates) {
    assert(!candidates.has(candidate.key), `Duplicate analysis candidate: ${candidate.key}`)
    candidates.set(candidate.key, candidate)
  }
  for (const measurement of analysis.measurements) {
    const asset = manifest.assets[measurement.assetId]
    assert(asset && !measurements.has(asset.id), 'Missing or duplicate analysis measurement')
    assert(measurement.sha256 === asset.sha256 && measurement.pcmSha256 === asset.decoded.pcmSha256 && measurement.sampleRate === asset.decoded.sampleRate && measurement.sampleFrames === asset.decoded.sampleFrames && measurement.channels === asset.decoded.channels && measurement.peak === asset.decoded.peak, 'Analysis measurement differs from pinned source/PCM')
    measurements.set(asset.id, measurement)
  }
  assert(measurements.size === Object.keys(manifest.assets).length && analysis.provenance.sourceSetSha256 === hash(JSON.stringify(analysis.measurements.map(({ assetId, sha256, pcmSha256 }) => ({ assetId, sha256, pcmSha256 })))), 'Analysis source set is incomplete or stale')
  const approved = new Set(JSON.parse(approvedSelectionText).entries.map(row => row.moveId))
  const assets = {}, moves = {}, fxMoves = {}, selected = []
  for (const row of selection.entries) {
    assert(keys(row, ['moveId', 'phase', 'assetId']) && /^[a-z][a-z0-9]*$/.test(row.moveId) && row.phase === 'attack' && typeof row.assetId === 'string', 'Invalid draft runtime selection entry')
    assert(!approved.has(row.moveId), `Already approved move cannot enter draft pack: ${row.moveId}`)
    assert(!Object.hasOwn(moves, row.moveId), `Duplicate draft default: ${row.moveId}`)
    const subject = manifest.subjects.find(s => s.kind === 'move' && s.id === row.moveId && s.phase === row.phase)
    assert(subject?.fxId && subject.assetIds.includes(row.assetId) && Number.isFinite(subject.durationSeconds), 'Draft visual/source relationship is unavailable')
    const asset = manifest.assets[row.assetId], variant = asset.variant
    const hasWhole = subject.assetIds.some(id => manifest.assets[id].variant.type === 'whole')
    assert(variant.type === 'whole' || (!hasWhole && variant.type === 'hit-count' && variant.hitCount === 1) || (!hasWhole && row.moveId === 'present' && variant.type === 'outcome' && variant.outcome === 'damage'), 'Draft selection must use a whole default, explicit one-hit alternative, or Present damage')
    const key = candidateKey(subject, asset.id), candidate = candidates.get(key), entry = records.get(key)
    assert(candidate?.status === 'draft' && candidate.visualComparisonAllowed === true && entry && candidate.batchId === entry.batch.id, 'Selected candidate lacks a compatible technical draft')
    const { record, batch } = entry, measurement = measurements.get(asset.id)
    const gainDb = measurement.suggestedGainDb
    assert(Number.isFinite(gainDb) && gainDb >= -60 && gainDb <= 0, 'Draft gain must remain attenuation-only')
    const segment = { startFrame: 0, endFrame: asset.decoded.sampleFrames, sourceAnchorFrame: 0, visualAnchorSeconds: 0, gainDb, nativeOffsetSeconds: 0 }
    assert(equal(candidate.defaultSegment, segment) && equal(record.segments, [segment]), 'Draft must retain the exact analysis whole-region default and gain')
    assets[asset.id] = { id: asset.id, file: `${asset.sha256}.mp3`, bytes: asset.bytes, sha256: asset.sha256, mime: asset.mime, reference: { sampleRate: asset.decoded.sampleRate, sampleFrames: asset.decoded.sampleFrames, channels: asset.decoded.channels, peak: asset.decoded.peak } }
    moves[row.moveId] = {
      moveId: row.moveId, fxId: subject.fxId, phase: row.phase, assetId: asset.id,
      reviewStatus: POLICY.reviewStatus, playbackPolicy: POLICY.playbackPolicy,
      visualRevision: record.visualRevision, segments: [segment],
      reference: { sampleRate: record.source.sampleRate, sampleFrames: record.source.sampleFrames },
      nativeCompatibility: null, playbackRate: 1, visualDurationSeconds: subject.durationSeconds, tailPolicy: POLICY.tailPolicy,
    }
    assert(!Object.hasOwn(fxMoves, subject.fxId), `Duplicate draft FX identifier: ${subject.fxId}`)
    fxMoves[subject.fxId] = row.moveId
    selected.push({ moveId: row.moveId, phase: row.phase, assetId: asset.id, sourceFile: asset.file, sourceSha256: asset.sha256, sourcePcmSha256: record.source.pcmSha256, visualRevision: record.visualRevision, batchId: batch.id, batchSha256: batch.sha256, draftRecordSha256: hash(JSON.stringify(record)), variant, gainDb, assetBytes: asset.bytes })
  }
  const missingSourceMoves = manifest.subjects.filter(s => s.kind === 'move' && s.phase === 'attack' && s.fxId && !s.assetIds.length).map(s => s.id)
  const expected = manifest.subjects.filter(s => s.kind === 'move' && s.phase === 'attack' && s.fxId && s.assetIds.length && !approved.has(s.id)).map(s => s.id).sort(compare)
  assert(equal(Object.keys(moves).sort(compare), expected), 'Draft selection does not cover every remaining animated move with a source')
  const provenance = { auditLockSha256: manifest.auditLockSha256, collectionRevision: manifest.collectionRevision, analysisReportSha256: selection.analysisReportSha256, selectionSha256: hash(selectionText) }
  const catalog = { schemaVersion: 1, kind: 'battle-sfx-draft-runtime', status: 'technical-draft', provenance, policy: POLICY, assets, moves, fxMoves }
  const generated = `// Generated by tools/audio-import/draft-runtime.mjs. Technical drafts; no listening approval.\nexport default ${JSON.stringify(catalog)}\n`
  const excludedCandidates = analysis.candidates.filter(c => !selected.some(row => candidateKey({ kind: 'move', id: row.moveId, phase: row.phase }, row.assetId) === c.key)).map(candidate => ({ key: candidate.key, status: candidate.status, reason: candidate.subject.kind === 'event' ? 'generic-event' : candidate.subject.phase !== 'attack' ? 'preparation' : approved.has(candidate.subject.id) ? 'approved-pilot-preserved' : candidate.status === 'missing-source' ? 'missing-source' : candidate.status === 'report-only' ? 'no-registered-animation' : 'unselected-variant-or-alternative' }))
  const report = {
    schemaVersion: 1, stage: 'D', status: 'technical-draft', scope: POLICY.scope, provenance,
    listeningApprovalsAdded: 0, nativeDecoderReviewsAdded: 0, approvedMoveMappingsChanged: 0,
    selectedMoveCount: selected.length, selectedAssetCount: Object.keys(assets).length,
    selectedVariantCounts: { whole: selected.filter(row => row.variant.type === 'whole').length, oneHit: selected.filter(row => row.variant.type === 'hit-count').length, presentDamage: selected.filter(row => row.variant.type === 'outcome').length },
    attenuatedMoveCount: selected.filter(row => row.gainDb < 0).length,
    encodedBytes: Object.values(assets).reduce((sum, row) => sum + row.bytes, 0),
    referenceDecodedBytes: Object.values(assets).reduce((sum, row) => sum + row.reference.sampleFrames * row.reference.channels * 4, 0),
    maximumAssetBytes: Math.max(...Object.values(assets).map(row => row.bytes)),
    maximumReferenceDecodedAssetBytes: Math.max(...Object.values(assets).map(row => row.reference.sampleFrames * row.reference.channels * 4)),
    maximumReferenceDurationSeconds: Math.max(...Object.values(assets).map(row => row.reference.sampleFrames / row.reference.sampleRate)),
    runtimeModuleBytes: Buffer.byteLength(generated), runtimeModuleSha256: hash(generated),
    coverage: { animatedMoveCount: manifest.summary.animatedMoveCount, approvedPilotMoveCount: approved.size, selectedDraftMoveCount: selected.length, missingSourceMoves },
    selected, excludedCandidates,
    silence: ['unselected variants and optional cue/trim alternatives', 'prepare phase', 'generic events', 'no registered animation or source', 'reduced motion', 'instant presentation', 'miss', 'fail', 'immune', 'Present healing outcome'],
    limitations: ['Whole actual native buffers play once at visual start; reference frames document source provenance, not browser trimming boundaries.', 'One-hit variants play once; no additional per-hit or part sequencing is inferred.', 'Timing and perceived volume remain technical drafts without listening approval. Native decoding and output latency vary by browser/device.'],
  }
  return { catalog, generated, report }
}

/** All source and authoring evidence is verified before any output is written. */
export async function generateDraftRuntime({ root = BENCH_ROOT, check = false } = {}) {
  const manifest = await createCollectionManifest({ root })
  const analysis = await readRemainingAnalysis({ root, manifest })
  const [analysisBytes, approvedSelectionBytes, selectionBytes] = await Promise.all([readLocal(root, ANALYSIS), readLocal(root, APPROVED_SELECTION), readLocal(root, SELECTION)])
  const batchTexts = Object.fromEntries(await Promise.all(analysis.batches.map(async batch => [batch.id, (await readLocal(root, batch.path)).toString('utf8')])))
  const result = compileDraftRuntime({ manifest, analysisText: analysisBytes.toString(), batchTexts, approvedSelectionText: approvedSelectionBytes.toString(), selectionText: selectionBytes.toString() })
  const outputs = [{ path: GENERATED, bytes: Buffer.from(result.generated) }]
  for (const row of result.report.selected) {
    const bytes = await readLocal(root, `public/sound_effects/${row.sourceFile}`)
    assert(bytes.length === row.assetBytes && sha256(bytes) === row.sourceSha256, `Selected draft source changed during compilation: ${row.assetId}`)
    outputs.push({ path: `public/audio/sfx/${result.catalog.assets[row.assetId].file}`, bytes })
  }
  result.report.compiler = { path: 'tools/audio-import/draft-runtime.mjs', sha256: sha256(await readFile(fileURLToPath(import.meta.url))) }
  result.report.outputs = outputs.map(row => ({ path: row.path, bytes: row.bytes.length, sha256: sha256(row.bytes) }))
  outputs.push({ path: REPORT, bytes: Buffer.from(json(result.report)) })
  if (check) for (const row of outputs) {
    const existing = await readLocal(root, row.path, true)
    assert(existing?.equals(row.bytes), `Draft runtime output differs or is missing: ${row.path}`)
  }
  else for (const row of outputs) await atomicWrite(root, row.path, row.bytes)
  return result.report
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2)
    assert(args.every(arg => arg === '--check') && args.length <= 1, 'Usage: node tools/audio-import/draft-runtime.mjs [--check]')
    const report = await generateDraftRuntime({ check: args.includes('--check') })
    console.log(`${args.includes('--check') ? 'Verified' : 'Generated'} ${report.selectedMoveCount} technical-draft moves, ${report.selectedAssetCount} assets, ${report.encodedBytes} encoded bytes; no listening approvals changed.`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
