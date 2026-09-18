import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { BENCH_ROOT, BenchError } from './bench.mjs'
import { createCollectionManifest } from './collection.mjs'
import { readRemainingAnalysis } from './analysis.mjs'
import { assert, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { normalizeSyncFeedback } from '../../apps/sfx-bench/src/syncFeedback.js'
import { planSyncAudition } from '../../apps/sfx-bench/src/sync.js'
import { FIFTH_FILES, reviseFifthBatch } from './sync-fifth-revision.mjs'
import { FIFTH_SECOND_FILES, reviseFifthBatchAgain } from './sync-fifth-second-revision.mjs'
import { FIFTH_THIRD_FILES, reviseFifthBatchThird } from './sync-fifth-third-revision.mjs'
import { FIFTH_FOURTH_FILES, reviseFifthBatchFourth } from './sync-fifth-fourth-revision.mjs'
import { SIXTH_FILES, reviseSixthBatch } from './sync-sixth-batch.mjs'
import { SIXTH_SECOND_FILES, reviseSixthBatchAgain } from './sync-sixth-second-revision.mjs'
import { SIXTH_FINAL_FILES, compileSixthFinalBatch } from './sync-sixth-final.mjs'
import { SEVENTH_FILES, reviseSeventhBatch } from './sync-seventh-batch.mjs'

const DEFINITION = 'tools/audio-import/review/sync-batch-001.json'
const FEEDBACK = 'tools/audio-import/review/sync-batch-001.feedback-01.json'
const REVIEW = 'tools/audio-import/review/sync-batch-001.review-01.json'
const FINAL = 'tools/audio-import/review/sync-batch-001.final.json'
const SECOND_FEEDBACK = 'tools/audio-import/review/sync-batch-002.feedback-01.json'
const SECOND_REVIEW = 'tools/audio-import/review/sync-batch-002.review-01.json'
const SECOND_ACCENT = 'tools/audio-import/review/sync-batch-002.accent-01.json'
const SECOND_FINAL = 'tools/audio-import/review/sync-batch-002.final.json'
const SECOND_NATIVE = 'tools/audio-import/review/sync-batch-002.native-01.json'
const SECOND_PLAYBACK_FILES = ['apps/sfx-bench/src/syncLayerAudio.js']
const THIRD_FEEDBACK = 'tools/audio-import/review/sync-batch-003.feedback-01.json'
const THIRD_REVIEW = 'tools/audio-import/review/sync-batch-003.review-01.json'
const THIRD_VISUAL = 'apps/sfx-bench/src/thunderPunchImpact.js'
export const THIRD_FINAL_FEEDBACK = 'tools/audio-import/review/sync-batch-003.feedback-02.json'
export const THIRD_FINAL_REVIEW = 'tools/audio-import/review/sync-batch-003.review-02.json'
const THIRD_FINAL = 'tools/audio-import/review/sync-batch-003.final.json'
const FOURTH_FEEDBACK = 'tools/audio-import/review/sync-batch-004.feedback-01.json'
const FOURTH_REVIEW = 'tools/audio-import/review/sync-batch-004.review-01.json'
const ANALYSIS = 'tools/audio-import/reports/sfx-remaining-analysis.json'
const RUNTIME_FILES = ['packages/battle-sfx/src/runtime.generated.js', 'packages/battle-sfx/src/draft-runtime.generated.js']
export const SYNC_REVIEW_PLAYBACK_FILES = Object.freeze([
  'apps/sfx-bench/src/audio.js', 'apps/sfx-bench/src/sync.js', 'apps/sfx-bench/src/syncVisual.js',
])
export const THIRD_REVIEW_PLAYBACK_FILES = Object.freeze([...SYNC_REVIEW_PLAYBACK_FILES, THIRD_VISUAL])
export const SYNC_BATCH_AUTHORING_FILES = Object.freeze([
  DEFINITION, FEEDBACK, REVIEW, 'tools/audio-import/sync-batch.mjs', 'tools/audio-import/bench-plugin.mjs',
  'apps/sfx-bench/src/sync-main.js', 'apps/sfx-bench/src/SyncBench.vue', 'apps/sfx-bench/src/sync.css',
  'apps/sfx-bench/src/sync.js', 'apps/sfx-bench/src/syncVisual.js', 'apps/sfx-bench/src/syncFeedback.js',
])
export const SYNC_BATCH_LIMITS = Object.freeze({ moves: 10, segments: 8, voices: 8, minimumVisualRate: .75, maximumVisualRate: 1.25, durationSeconds: 120 })
const IDS = ['bodyslam', 'aerialace', 'hydropump', 'thunderbolt', 'triplekick', 'absorb']
export const SYNC_BATCH_CATALOG = Object.freeze([
  Object.freeze({ id: 'sync-001', label: 'Batch 1 · Accepted', status: 'accepted', moveIds: Object.freeze(IDS) }),
  Object.freeze({ id: 'sync-002', label: 'Batch 2 · Accepted', status: 'accepted', moveIds: Object.freeze(['icebeam', 'psychic', 'flamethrower', 'shadowball', 'rockslide', 'gigadrain']) }),
  Object.freeze({ id: 'sync-003', label: 'Batch 3 · Accepted', status: 'accepted', moveIds: Object.freeze(['surf', 'watergun', 'crunch', 'thunderpunch', 'swift', 'calmmind']) }),
  Object.freeze({ id: 'sync-004', label: 'Batch 4 · Review', status: 'unreviewed-comparison', moveIds: Object.freeze(['ember', 'waterfall', 'dragonclaw', 'ancientpower', 'shadowpunch', 'swordsdance']) }),
  Object.freeze({ id: 'sync-005', label: 'Batch 5 · Odd ones out', status: 'unreviewed-comparison', moveIds: Object.freeze(['fireblast', 'solarbeam', 'razorleaf', 'sludgebomb', 'overheat', 'eruption', 'earthquake', 'thunder', 'blizzard', 'bubblebeam']) }),
  Object.freeze({ id: 'sync-006', label: 'Batch 6 · Accepted', status: 'accepted', moveIds: Object.freeze(['leafblade', 'triattack', 'meteormash', 'ancientpower', 'sacredfire']) }),
  Object.freeze({ id: 'sync-007', label: 'Batch 7 · Songs and healing', status: 'unreviewed-comparison', moveIds: Object.freeze(['sing', 'grasswhistle', 'attract', 'morningsun', 'moonlight', 'confuseray']) }),
])
export const isSyncBatchId = id => SYNC_BATCH_CATALOG.some(batch => batch.id === id)
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const hash = value => sha256(Buffer.from(JSON.stringify(value)))
function shape(value, fields, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value) && equal(Object.keys(value).sort(), [...fields].sort()), `Invalid ${label} shape`)
}
function finite(value, minimum, maximum, label) { assert(Number.isFinite(value) && value >= minimum && value <= maximum, `Invalid ${label}`) }
function text(value, max, label) { assert(typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value), `Invalid ${label}`) }

/** Validates authoring seconds only. Playback must also validate the actual native buffer. */
export function validateSyncComparison(comparison, { sourceDuration, visualDuration }) {
  shape(comparison, ['visualRate', 'segments'], 'sync comparison')
  finite(comparison.visualRate, SYNC_BATCH_LIMITS.minimumVisualRate, SYNC_BATCH_LIMITS.maximumVisualRate, 'visual rate')
  assert(Array.isArray(comparison.segments) && comparison.segments.length >= 1 && comparison.segments.length <= SYNC_BATCH_LIMITS.segments, 'Sync comparison must have 1–8 segments')
  const events = []
  for (const segment of comparison.segments) {
    shape(segment, ['startSeconds', 'endSeconds', 'soundAnchorSeconds', 'cueSeconds', 'gainDb'], 'sync segment')
    finite(segment.startSeconds, 0, sourceDuration, 'source start')
    assert(segment.endSeconds === null || Number.isFinite(segment.endSeconds), 'Invalid source end')
    const end = segment.endSeconds ?? sourceDuration
    finite(end, 0, sourceDuration, 'source end')
    assert(end > segment.startSeconds, 'Sync segment must contain sound')
    finite(segment.soundAnchorSeconds, segment.startSeconds, end, 'sound anchor')
    assert(segment.soundAnchorSeconds < end, 'Sound anchor must be inside its source region')
    finite(segment.cueSeconds, 0, visualDuration, 'visual cue')
    finite(segment.gainDb, -60, 0, 'attenuation-only gain')
    // Cues use authored visual seconds; audio always retains its native speed.
    const start = segment.cueSeconds / comparison.visualRate - (segment.soundAnchorSeconds - segment.startSeconds)
    assert(start >= -1e-9, 'Sync comparison would require sound before the animation')
    const finish = Math.max(0, start) + end - segment.startSeconds
    assert(finish <= SYNC_BATCH_LIMITS.durationSeconds, 'Sync comparison exceeds playback duration limit')
    events.push([Math.max(0, start), 1], [finish, -1])
  }
  let voices = 0
  for (const [, delta] of events.sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    voices += delta
    assert(voices <= SYNC_BATCH_LIMITS.voices, 'Sync comparison exceeds simultaneous voice limit')
  }
  return true
}

/** Builds one bounded, read-only A/B study. It never modifies a production mapping. */
export function compileSyncBatch({ definition, manifest, analysis, plans, recipeTexts, revisionPins }) {
  shape(definition, ['schemaVersion', 'id', 'title', 'status', 'moves'], 'sync batch')
  const catalog = SYNC_BATCH_CATALOG.find(batch => batch.id === definition.id)
  assert(definition.schemaVersion === 1 && catalog && definition.status === 'unreviewed-comparison', 'Unsupported sync batch')
  text(definition.title, 150, 'sync batch title')
  assert(Array.isArray(definition.moves) && definition.moves.length <= SYNC_BATCH_LIMITS.moves && equal(definition.moves.map(row => row.id), catalog.moveIds), 'Sync batch must contain the explicit review moves in order')
  const moves = definition.moves.map(row => {
    shape(row, ['id', 'assetId', 'sourceSha256', 'sourcePcmSha256', 'visualRevision', 'baseline', 'candidate', 'anchorEvidence', 'authoredMarkers', 'notes'], 'sync move')
    const subject = manifest.subjects.find(s => s.kind === 'move' && s.id === row.id && s.phase === 'attack')
    const plan = plans[row.id], asset = manifest.assets[row.assetId]
    assert(subject?.fxId && plan && plan.assetId === row.assetId && subject.assetIds.includes(row.assetId), 'Sync baseline must retain the selected runtime asset')
    assert(asset.sha256 === row.sourceSha256 && asset.decoded.pcmSha256 === row.sourcePcmSha256, 'Sync source provenance is stale')
    assert(row.visualRevision === subject.visualRevision && plan.visualRevision === subject.visualRevision, 'Sync visual revision is stale')
    assert(plan.phase === 'attack' && plan.playbackRate === 1 && plan.segments.length === 1, 'Sync baseline needs one existing whole attack recording at native speed')
    const selectedSegment = plan.segments[0]
    assert(selectedSegment.startFrame === 0 && selectedSegment.endFrame === asset.decoded.sampleFrames && selectedSegment.sourceAnchorFrame === 0 && selectedSegment.visualAnchorSeconds === 0 && selectedSegment.nativeOffsetSeconds === 0, 'Sync baseline cannot reinterpret an edited runtime region')
    const baseline = { visualRate: 1, segments: [{ startSeconds: 0, endSeconds: null, soundAnchorSeconds: 0, cueSeconds: 0, gainDb: plan.segments[0].gainDb }] }
    assert(equal(row.baseline, baseline), 'Sync baseline must preserve the existing whole-clip timing and gain')
    const durations = { sourceDuration: asset.decoded.sampleFrames / asset.decoded.sampleRate, visualDuration: subject.durationSeconds }
    validateSyncComparison(row.baseline, durations); validateSyncComparison(row.candidate, durations)
    const measurement = analysis.measurements.find(m => m.assetId === asset.id)
    assert(measurement?.sha256 === asset.sha256 && measurement.pcmSha256 === asset.decoded.pcmSha256, 'Sync numeric anchor evidence is stale')
    assert(Array.isArray(row.anchorEvidence) && row.anchorEvidence.length === row.candidate.segments.length, 'Every candidate anchor needs explicit numeric evidence')
    row.anchorEvidence.forEach((evidence, index) => {
      shape(evidence, ['kind', 'startFrame'], 'anchor evidence')
      const windows = evidence.kind === 'strongest-energy-window' ? [measurement.strongestEnergyWindow] : evidence.kind === 'positive-energy-rise' ? measurement.positiveEnergyRises : []
      assert(windows.some(window => window.startFrame === evidence.startFrame), 'Candidate anchor is not a measured energy hypothesis')
      assert(Math.abs(row.candidate.segments[index].soundAnchorSeconds - evidence.startFrame / measurement.sampleRate) < 1e-9, 'Candidate anchor differs from its numeric evidence')
    })
    const markers = subject.markers.map(({ id, label, timeSeconds }) => ({ id, label, timeSeconds }))
    assert(Array.isArray(row.authoredMarkers) && row.authoredMarkers.length <= 8, 'Too many authored visual markers')
    for (const marker of row.authoredMarkers) {
      shape(marker, ['id', 'label', 'timeSeconds', 'evidence'], 'authored marker')
      assert(/^[a-z][a-z0-9-]*$/.test(marker.id) && !markers.some(existing => existing.id === marker.id), 'Duplicate or invalid visual marker')
      text(marker.label, 150, 'marker label'); text(marker.evidence, 1000, 'marker evidence')
      finite(marker.timeSeconds, 0, subject.durationSeconds, 'marker time')
      assert(recipeTexts[row.id]?.includes(marker.evidence), `Authored marker needs review after recipe change: ${row.id}/${marker.id}`)
      markers.push({ id: marker.id, label: marker.label, timeSeconds: marker.timeSeconds })
    }
    markers.sort((a, b) => a.timeSeconds - b.timeSeconds || a.id.localeCompare(b.id))
    assert(Array.isArray(row.notes) && row.notes.length >= 1 && row.notes.length <= 8, 'Sync move needs concise comparison notes')
    row.notes.forEach(note => text(note, 1200, 'comparison note'))
    return {
      id: row.id, fxId: subject.fxId, name: subject.name,
      asset: { id: asset.id, url: asset.url, bytes: asset.bytes, sha256: asset.sha256, decoded: asset.decoded },
      visual: { durationSeconds: subject.durationSeconds, visualRevision: subject.visualRevision, markers },
      baseline: row.baseline, candidate: row.candidate, notes: row.notes,
    }
  })
  const revision = hash({ definition, auditLockSha256: manifest.auditLockSha256, collectionRevision: manifest.collectionRevision, revisionPins, moves })
  return { schemaVersion: 1, id: definition.id, title: definition.title, status: definition.status, revision, moves }
}

/** A deliberately narrow second-batch overlay. It layers an existing recording
 * for local audition only, without modifying the reviewed base sound or FX. */
export function compileSyncAccent({ batch, overlay, manifest, analysis, recipeTexts, revisionPins = [] }) {
  shape(overlay, ['schemaVersion', 'kind', 'batchId', 'moveId', 'sourceSha256', 'sourcePcmSha256', 'visualRevision', 'assetId', 'segment', 'anchorEvidence', 'visualEvidence', 'notes'], 'sync accent overlay')
  assert(overlay.schemaVersion === 1 && overlay.kind === 'battle-sfx-sync-accent' && overlay.batchId === 'sync-002' && batch.id === overlay.batchId && overlay.moveId === 'psychic', 'Unsupported sync accent overlay')
  const move = batch.moves.find(row => row.id === overlay.moveId), asset = manifest.assets[overlay.assetId]
  assert(move && !move.accent && overlay.assetId === 'source.hit-normal-damage' && asset, 'Sync accent must use the explicit Psychic impact recording')
  assert(asset.sha256 === overlay.sourceSha256 && asset.decoded.pcmSha256 === overlay.sourcePcmSha256, 'Sync accent source provenance is stale')
  assert(move.visual.visualRevision === overlay.visualRevision, 'Sync accent visual revision is stale')
  validateSyncComparison({ visualRate: move.candidate.visualRate, segments: [overlay.segment] }, {
    sourceDuration: asset.decoded.sampleFrames / asset.decoded.sampleRate, visualDuration: move.visual.durationSeconds,
  })
  assert(overlay.segment.startSeconds === 0 && overlay.segment.endSeconds === null, 'Sync accent must preserve the whole impact recording')
  const measurement = analysis.measurements.find(row => row.assetId === asset.id)
  assert(measurement?.sha256 === asset.sha256 && measurement.pcmSha256 === asset.decoded.pcmSha256, 'Sync accent numeric evidence is stale')
  shape(overlay.anchorEvidence, ['kind', 'startFrame'], 'accent anchor evidence')
  assert(overlay.anchorEvidence.kind === 'positive-energy-rise' && measurement.positiveEnergyRises.some(window => window.startFrame === overlay.anchorEvidence.startFrame), 'Sync accent needs a measured positive energy rise')
  assert(Math.abs(overlay.segment.soundAnchorSeconds - overlay.anchorEvidence.startFrame / measurement.sampleRate) < 1e-9, 'Sync accent anchor differs from numeric evidence')
  shape(overlay.visualEvidence, ['markerId', 'recipe'], 'accent visual evidence')
  const marker = move.visual.markers.find(row => row.id === overlay.visualEvidence.markerId)
  assert(marker?.id === 'impact' && marker.timeSeconds === overlay.segment.cueSeconds, 'Sync accent must match the existing result impact marker')
  text(overlay.visualEvidence.recipe, 1000, 'accent recipe evidence')
  assert(recipeTexts[move.id]?.includes(overlay.visualEvidence.recipe), 'Sync accent impact recipe evidence is stale')
  assert(Array.isArray(overlay.notes) && overlay.notes.length >= 1 && overlay.notes.length <= 4, 'Sync accent needs concise review notes')
  overlay.notes.forEach(note => text(note, 1200, 'accent review note'))
  const accent = { asset: { id: asset.id, url: asset.url, bytes: asset.bytes, sha256: asset.sha256, decoded: asset.decoded }, segment: structuredClone(overlay.segment) }
  const moves = batch.moves.map(row => row.id === move.id ? { ...row, accent, notes: [...row.notes, ...overlay.notes] } : row)
  return { ...batch, revision: hash({ batchRevision: batch.revision, overlay, revisionPins, moves }), moves }
}

/** This review-only accent preserves the original move and sound comparison. */
export function compileSyncVisualAccent({ batch, revisionPins }) {
  assert(batch.id === 'sync-003', 'Unsupported visual accent batch')
  const pin = revisionPins.find(row => row.path === THIRD_VISUAL)
  assert(pin && /^[a-f0-9]{64}$/.test(pin.sha256), 'Visual accent needs its exact artwork revision')
  const move = batch.moves.find(row => row.id === 'thunderpunch')
  assert(move && !move.visualAccent && move.visual.markers.some(marker => marker.id === 'impact' && marker.timeSeconds === .52), 'Visual accent needs the original Thunder Punch contact')
  const visualAccent = { id: 'thunder-punch-impact-v1', revision: pin.sha256, impactSeconds: .52 }
  const moves = batch.moves.map(row => row.id === move.id ? { ...row, visualAccent, notes: [
    ...row.notes,
    'Your sound and impact timing are unchanged. The proposed version adds a bright white-yellow spark and branching lightning on the opponent at the same contact.',
    'The flash follows the opponent through the brief recoil and fades with the existing discharge. Previous proposal plays the version you reviewed without this added impact accent.',
  ] } : row)
  return { ...batch, revision: hash({ batchRevision: batch.revision, visualAccent, moves }), moves }
}

/** The second third-batch export heard the added artwork. Its complete capture
 * pins both playback and native measurements to precisely those six proposals. */
export function validateSyncReviewCapture({ batch, snapshot, feedbackBytes, playbackPins }) {
  shape(snapshot, ['schemaVersion', 'kind', 'source', 'manifest', 'playbackPins'], 'sync review capture')
  assert(snapshot.schemaVersion === 1 && snapshot.kind === 'battle-sfx-sync-review-capture' && batch.id === 'sync-003', 'Unsupported sync review capture')
  shape(snapshot.source, ['name', 'sha256'], 'sync review capture source')
  assert(snapshot.source.name === 'sync-003-feedback.json' && Buffer.isBuffer(feedbackBytes)
    && sha256(feedbackBytes) === snapshot.source.sha256, 'Sync captured feedback hash changed')
  const captured = snapshot.manifest, ids = SYNC_BATCH_CATALOG.find(row => row.id === batch.id).moveIds
  assert(captured?.schemaVersion === 1 && captured.id === batch.id && captured.status === 'unreviewed-comparison'
    && /^[a-f0-9]{64}$/.test(captured.revision), 'Invalid captured review manifest')
  assert(isDeepStrictEqual(captured.moves?.map(move => move.id), ids) && isDeepStrictEqual(batch.moves?.map(move => move.id), ids), 'Captured review must retain all six moves')
  for (const pins of [snapshot.playbackPins, playbackPins]) {
    assert(Array.isArray(pins) && isDeepStrictEqual(pins.map(pin => pin.path), THIRD_REVIEW_PLAYBACK_FILES), 'Captured review needs four exact playback pins')
    for (const pin of pins) {
      shape(pin, ['path', 'sha256'], 'captured playback pin')
      assert(/^[a-f0-9]{64}$/.test(pin.sha256), 'Invalid captured playback hash')
    }
  }
  assert(isDeepStrictEqual(snapshot.playbackPins, playbackPins), 'Captured playback or artwork has changed; re-review is required')
  const feedback = JSON.parse(feedbackBytes)
  const normalized = normalizeSyncFeedback(feedback, captured)
  assert(isDeepStrictEqual(normalized, feedback), 'Captured final feedback contains invalid tuning')
  for (const [index, move] of batch.moves.entries()) {
    const prior = captured.moves[index], record = normalized.records.find(row => row.moveId === move.id)
    for (const field of ['id', 'fxId', 'name', 'asset', 'visual', 'candidate', 'notes', 'visualAccent'])
      assert(isDeepStrictEqual(move[field], prior[field]), `Captured ${field} provenance changed: ${move.id}`)
    assert(record?.verdict === 'keep' && isDeepStrictEqual(record.plan, move.candidate) && record.native, `Captured final plan was not kept: ${move.id}`)
    const needsVisualAccent = move.id === 'thunderpunch'
    assert(Boolean(move.visualAccent) === needsVisualAccent, 'Only the reviewed Thunder Punch has a visual accent')
    if (needsVisualAccent) {
      assert(isDeepStrictEqual(move.visualAccent, { id: 'thunder-punch-impact-v1', revision: playbackPins.at(-1).sha256, impactSeconds: .52 })
        && move.visual.markers.some(marker => marker.id === 'impact' && marker.timeSeconds === .52)
        && move.candidate.segments.some(segment => segment.cueSeconds === .52), 'Captured Thunder Punch artwork or impact cue changed')
    }
    validateSyncComparison(move.candidate, { sourceDuration: move.asset.decoded.sampleFrames / move.asset.decoded.sampleRate, visualDuration: move.visual.durationSeconds })
    planSyncAudition(move.candidate, record.native, move.visual)
  }
  return normalized
}

export function validateFinalReviewEvidence({ final, batch, reviewEvidenceBytes, feedbackEvidenceBytes, playbackPins }) {
  shape(final.reviewEvidence, ['path', 'sha256', 'feedbackPath', 'feedbackSha256'], 'final review evidence')
  assert(final.reviewEvidence.path === THIRD_FINAL_REVIEW && Buffer.isBuffer(reviewEvidenceBytes)
    && sha256(reviewEvidenceBytes) === final.reviewEvidence.sha256, 'Final review evidence bytes changed')
  assert(final.reviewEvidence.feedbackPath === THIRD_FINAL_FEEDBACK && Buffer.isBuffer(feedbackEvidenceBytes)
    && sha256(feedbackEvidenceBytes) === final.reviewEvidence.feedbackSha256, 'Final feedback evidence bytes changed')
  const snapshot = JSON.parse(reviewEvidenceBytes)
  assert(final.reviewedRevision === snapshot.manifest?.revision, 'Final approved review revision changed')
  return validateSyncReviewCapture({ batch, snapshot, feedbackBytes: feedbackEvidenceBytes, playbackPins })
}

/** The accepted page serves only the exact plans approved in the user's message.
 * Archived comparison/review inputs remain provenance, never playback options. */
export function compileFinalSyncBatch({ final, batch, revisionPins = [], nativeEvidenceBytes, reviewEvidenceBytes, feedbackEvidenceBytes }) {
  const second = batch.id === 'sync-002', third = batch.id === 'sync-003', catalog = SYNC_BATCH_CATALOG.find(row => row.id === batch.id)
  shape(final, ['schemaVersion', 'kind', 'batchId', 'reviewedRevision', 'approval', 'moves', ...(second ? ['nativeEvidence'] : []), ...(third ? ['reviewEvidence'] : [])], 'final sync batch')
  assert(final.schemaVersion === 1 && final.kind === 'battle-sfx-final-batch' && final.batchId === batch.id && catalog?.status === 'accepted', 'Unsupported final sync batch')
  assert(/^[a-f0-9]{64}$/.test(final.reviewedRevision), 'Invalid approved review revision')
  shape(final.approval, ['source', 'text', 'date'], 'final approval')
  assert(final.approval.source === 'user-message' && /^\d{4}-\d{2}-\d{2}$/.test(final.approval.date), 'Final batch needs explicit user approval')
  text(final.approval.text, 2000, 'approval text')
  assert(Array.isArray(final.moves) && equal(final.moves.map(move => move.id), catalog.moveIds), 'Final batch must retain the six approved moves')
  let measured
  if (second) {
    shape(final.nativeEvidence, ['path', 'sha256'], 'final native evidence')
    assert(final.nativeEvidence.path === SECOND_NATIVE && Buffer.isBuffer(nativeEvidenceBytes)
      && sha256(nativeEvidenceBytes) === final.nativeEvidence.sha256, 'Final native evidence bytes changed')
    measured = normalizeSyncFeedback(JSON.parse(nativeEvidenceBytes), { ...batch, revision: final.reviewedRevision })
    assert(isDeepStrictEqual(measured, JSON.parse(nativeEvidenceBytes)), 'Final native evidence contains invalid tuning')
  }
  if (third) measured = validateFinalReviewEvidence({ final, batch, reviewEvidenceBytes, feedbackEvidenceBytes,
    playbackPins: THIRD_REVIEW_PLAYBACK_FILES.map(path => revisionPins.find(pin => pin.path === path)) })
  const moves = final.moves.map((move, index) => {
    const current = batch.moves[index], feedback = (measured?.records ?? batch.feedbackRecords).find(record => record.moveId === move.id)
    shape(move, ['id', 'fxId', 'name', 'asset', 'visual', 'plan', 'native', 'notes', ...(current.accent ? ['accent'] : []), ...(current.visualAccent ? ['visualAccent'] : [])], 'final move')
    for (const field of ['id', 'fxId', 'name', 'asset', 'visual', 'notes']) assert(isDeepStrictEqual(move[field], current[field]), `Final ${field} provenance is stale: ${move.id}`)
    assert(isDeepStrictEqual(move.plan, current.candidate), `Final approved plan has changed: ${move.id}`)
    assert(feedback && isDeepStrictEqual(move.native, feedback.native), `Final native measurement has changed: ${move.id}`)
    validateSyncComparison(move.plan, { sourceDuration: move.asset.decoded.sampleFrames / move.asset.decoded.sampleRate, visualDuration: move.visual.durationSeconds })
    planSyncAudition(move.plan, move.native, move.visual)
    if (current.visualAccent) assert(isDeepStrictEqual(move.visualAccent, current.visualAccent), `Final visual accent changed: ${move.id}`)
    if (measured) {
      const record = measured.records.find(row => row.moveId === move.id)
      assert(isDeepStrictEqual(record.plan, move.plan) && isDeepStrictEqual(record.native, move.native), `Final measured base plan changed: ${move.id}`)
      if (current.accent) {
        shape(move.accent, ['asset', 'segment', 'native'], 'final accent')
        assert(isDeepStrictEqual(move.accent.asset, current.accent.asset) && isDeepStrictEqual(move.accent.segment, current.accent.segment), 'Final accent provenance changed')
        assert(record.accent && isDeepStrictEqual(record.accent.native, move.accent.native), 'Final accent native measurement changed')
        planSyncAudition({ visualRate: move.plan.visualRate, segments: [move.accent.segment] }, move.accent.native, move.visual)
      }
    }
    return structuredClone(move)
  })
  return { schemaVersion: 1, id: batch.id, title: `Batch ${Number(batch.id.slice(-3))} · Accepted final versions`, status: 'accepted',
    revision: hash({ final, revisionPins }), reviewedRevision: final.reviewedRevision, approval: structuredClone(final.approval), moves }
}

/** Carries a user's exact review into this local study only. Neither a carried
 * verdict nor the archived browser measurement is a production approval. */
export function compileSyncFeedback({ batch, snapshot, feedbackBytes, playbackPins }) {
  shape(snapshot, ['schemaVersion', 'source', 'feedback', 'playbackPins', 'moves'], 'sync review snapshot')
  assert(snapshot.schemaVersion === 1, 'Unsupported sync review snapshot')
  shape(snapshot.source, ['name', 'sha256'], 'sync review source')
  const catalog = SYNC_BATCH_CATALOG.find(item => item.id === batch.id)
  assert(catalog && snapshot.source.name === `${batch.id}-feedback.json` && /^[a-f0-9]{64}$/.test(snapshot.source.sha256), 'Invalid sync review source identity')
  assert(Buffer.isBuffer(feedbackBytes) && feedbackBytes.length > 0 && feedbackBytes.length <= 100_000, 'Invalid archived sync feedback bytes')
  assert(sha256(feedbackBytes) === snapshot.source.sha256, 'Archived sync feedback hash differs from the captured review')
  assert(isDeepStrictEqual(JSON.parse(feedbackBytes.toString('utf8')), snapshot.feedback), 'Archived sync feedback differs from the captured review')
  assert(/^[a-f0-9]{64}$/.test(snapshot.feedback?.revision), 'Invalid captured sync review revision')
  assert(equal(batch.moves.map(move => move.id), catalog.moveIds), 'Sync feedback needs the six explicit review moves')
  assert(Array.isArray(snapshot.moves) && equal(snapshot.moves.map(move => move.id), catalog.moveIds), 'Sync review snapshot must retain all six moves in order')
  for (const pins of [snapshot.playbackPins, playbackPins]) {
    assert(Array.isArray(pins) && equal(pins.map(pin => pin.path), SYNC_REVIEW_PLAYBACK_FILES), 'Sync review needs the three exact playback pins')
    for (const pin of pins) {
      shape(pin, ['path', 'sha256'], 'sync review playback pin')
      assert(/^[a-f0-9]{64}$/.test(pin.sha256), 'Invalid sync review playback hash')
    }
  }
  assert(isDeepStrictEqual(snapshot.playbackPins, playbackPins), 'Sync review playback transport has changed; re-review is required')
  const capturedMoves = batch.moves.map((move, index) => {
    const captured = snapshot.moves[index]
    shape(captured, ['id', 'sourceSha256', 'sourcePcmSha256', 'visualRevision', 'plan'], 'captured sync move')
    assert(captured.sourceSha256 === move.asset.sha256 && captured.sourcePcmSha256 === move.asset.decoded.pcmSha256, `Sync review source provenance has changed: ${move.id}`)
    assert(captured.visualRevision === move.visual.visualRevision, `Sync review visual revision has changed: ${move.id}`)
    validateSyncComparison(captured.plan, { sourceDuration: move.asset.decoded.sampleFrames / move.asset.decoded.sampleRate, visualDuration: move.visual.durationSeconds })
    // These archived reviews predate the optional accent. Normalize against
    // precisely that earlier proposal, never pretend the new layer was heard.
    const { accent, visualAccent, ...priorMove } = move
    return { ...priorMove, candidate: captured.plan }
  })
  const normalized = normalizeSyncFeedback(snapshot.feedback, { id: batch.id, revision: snapshot.feedback.revision, moves: capturedMoves })
  // Normalization can invalidate unfinished tuning. Archived carried decisions
  // must already be valid; never silently turn damaged evidence into new data.
  assert(isDeepStrictEqual(normalized, snapshot.feedback), 'Captured sync feedback contains invalid review tuning')
  const records = new Map(normalized.records.map(record => [record.moveId, record]))
  const moves = batch.moves.map((move, index) => {
    const record = records.get(move.id)
    assert(isDeepStrictEqual(record.plan, snapshot.moves[index].plan), `Captured sync plan differs from its review: ${move.id}`)
    const changed = Boolean(move.accent || move.visualAccent) || !isDeepStrictEqual(move.candidate, record.plan)
    return { ...move, previousReview: { verdict: record.verdict, notes: record.notes, plan: record.plan, changed, revision: normalized.revision } }
  })
  const feedbackRecords = moves.map(move => {
    const record = records.get(move.id)
    return { moveId: move.id, plan: move.candidate, verdict: record.verdict === 'keep' && !move.previousReview.changed ? 'keep' : 'unreviewed', notes: record.notes, native: record.native,
      ...(move.accent ? { accent: { assetId: move.accent.asset.id, sha256: move.accent.asset.sha256, segment: move.accent.segment, native: null } } : {}),
      ...(move.visualAccent ? { visualAccent: { id: move.visualAccent.id, revision: move.visualAccent.revision } } : {}) }
  })
  const defaultMoveId = moves.find(move => move.previousReview.changed)?.id ?? feedbackRecords.find(record => record.verdict !== 'keep')?.moveId ?? moves[0].id
  const revision = hash({ batchRevision: batch.revision, snapshot, moves, feedbackRecords, defaultMoveId })
  return { ...batch, revision, moves, feedbackRecords, defaultMoveId }
}

export async function createSyncBatchManifest({ root = BENCH_ROOT, batch = 'sync-001' } = {}) {
  if (!isSyncBatchId(batch)) throw new BenchError('Unknown sync review batch', 404)
  const catalog = SYNC_BATCH_CATALOG.find(item => item.id === batch), ids = catalog.moveIds
  const definitionPath = `tools/audio-import/review/sync-batch-${batch.slice(-3)}.json`
  const manifest = await createCollectionManifest({ root }), analysis = await readRemainingAnalysis({ root, manifest })
  const authoringFiles = SYNC_BATCH_AUTHORING_FILES.filter(path => ![DEFINITION, FEEDBACK, REVIEW].includes(path))
  const batchFiles = batch === 'sync-001' ? [definitionPath, FEEDBACK, REVIEW, FINAL]
    : batch === 'sync-002' ? [definitionPath, SECOND_FEEDBACK, SECOND_REVIEW, SECOND_ACCENT, SECOND_FINAL, SECOND_NATIVE, ...SECOND_PLAYBACK_FILES]
      : batch === 'sync-003' ? [definitionPath, THIRD_FEEDBACK, THIRD_REVIEW, THIRD_VISUAL, THIRD_FINAL_FEEDBACK, THIRD_FINAL_REVIEW, THIRD_FINAL]
        : batch === 'sync-004' ? [definitionPath, FOURTH_FEEDBACK, FOURTH_REVIEW]
          : batch === 'sync-005' ? [definitionPath, ...FIFTH_FILES, ...FIFTH_SECOND_FILES, ...FIFTH_THIRD_FILES, ...FIFTH_FOURTH_FILES]
            : batch === 'sync-006' ? [definitionPath, ...SIXTH_FILES, ...SIXTH_SECOND_FILES, ...SIXTH_FINAL_FILES]
              : batch === 'sync-007' ? [definitionPath, ...SEVENTH_FILES]
        : [definitionPath]
  const revisionPins = await Promise.all([...new Set([...authoringFiles, ...batchFiles, ...SYNC_REVIEW_PLAYBACK_FILES, ...RUNTIME_FILES, ANALYSIS])].map(async path => ({ path, sha256: sha256(await readLocal(root, path)) })))
  const definition = JSON.parse(await readLocal(root, definitionPath)), plans = {}
  for (const path of RUNTIME_FILES) {
    const pin = revisionPins.find(row => row.path === path)
    const { default: runtime } = await import(`${pathToFileURL(resolve(root, path)).href}?sync=${pin.sha256}`)
    for (const id of ids) if (runtime.moves[id]) { assert(!plans[id], 'Duplicate sync runtime move'); plans[id] = runtime.moves[id] }
  }
  const recipeTexts = Object.fromEntries(await Promise.all(ids.map(async id => {
    const subject = manifest.subjects.find(s => s.kind === 'move' && s.id === id && s.phase === 'attack')
    return [id, (await readLocal(root, `packages/battle-fx/src/moves/restored/${subject.fxId}.js`)).toString('utf8')]
  })))
  const compiled = compileSyncBatch({ definition, manifest, analysis, plans, recipeTexts, revisionPins })
  const comparison = batch === 'sync-002' ? compileSyncAccent({
    batch: compiled, overlay: JSON.parse(await readLocal(root, SECOND_ACCENT)), manifest, analysis, recipeTexts,
    revisionPins: revisionPins.filter(pin => [SECOND_ACCENT, ...SECOND_PLAYBACK_FILES].includes(pin.path)),
  }) : batch === 'sync-003' ? compileSyncVisualAccent({ batch: compiled, revisionPins }) : compiled
  const reviewed = ['sync-001', 'sync-002', 'sync-004', 'sync-005'].includes(batch) ? compileSyncFeedback({
    batch: comparison, snapshot: JSON.parse(await readLocal(root, batch === 'sync-001' ? REVIEW : batch === 'sync-002' ? SECOND_REVIEW : batch === 'sync-004' ? FOURTH_REVIEW : FIFTH_FILES[1])), feedbackBytes: await readLocal(root, batch === 'sync-001' ? FEEDBACK : batch === 'sync-002' ? SECOND_FEEDBACK : batch === 'sync-004' ? FOURTH_FEEDBACK : FIFTH_FILES[0]),
    playbackPins: SYNC_REVIEW_PLAYBACK_FILES.map(path => revisionPins.find(pin => pin.path === path)),
  }) : comparison
  const result = catalog.status === 'accepted' && batch !== 'sync-006' ? compileFinalSyncBatch({
    final: JSON.parse(await readLocal(root, batch === 'sync-001' ? FINAL : batch === 'sync-002' ? SECOND_FINAL : THIRD_FINAL)), batch: reviewed, revisionPins,
    ...(batch === 'sync-002' ? { nativeEvidenceBytes: await readLocal(root, SECOND_NATIVE) } : {}),
    ...(batch === 'sync-003' ? { reviewEvidenceBytes: await readLocal(root, THIRD_FINAL_REVIEW), feedbackEvidenceBytes: await readLocal(root, THIRD_FINAL_FEEDBACK) } : {}),
  }) : batch === 'sync-005' ? await reviseFifthBatchAgain({ root, batch: await reviseFifthBatch({ root, batch: reviewed, revisionPins }), revisionPins }) : reviewed
  const current = batch === 'sync-005' ? await reviseFifthBatchFourth({ root, batch: await reviseFifthBatchThird({ root, batch: result, revisionPins }), revisionPins }) : batch === 'sync-006' ? await reviseSixthBatchAgain({ root, batch: await reviseSixthBatch({ root, batch: result, revisionPins }), revisionPins }) : result
  const accepted = batch === 'sync-006' ? compileSixthFinalBatch({
    final: JSON.parse(await readLocal(root, SIXTH_FINAL_FILES[0])), batch: current, revisionPins,
    feedbackBytes: await readLocal(root, SIXTH_FINAL_FILES[1]), manifestBytes: await readLocal(root, SIXTH_FINAL_FILES[2]),
  }) : batch === 'sync-007' ? await reviseSeventhBatch({ root, batch: current, revisionPins }) : current
  return { ...accepted, batches: SYNC_BATCH_CATALOG.map(({ id, label, status }) => ({ id, label, status })) }
}
