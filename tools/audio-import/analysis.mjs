import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { analyzePcm, DECODE_LIMITS } from './decode.mjs'
import { inspectMp3, sha256 } from './mp3.mjs'
import { assert, atomicWrite, readLocal } from './audit-io.mjs'
import { BENCH_ROOT, createBenchManifest } from './bench.mjs'
import { compileRuntime } from './runtime.mjs'
import { createReviewRecord, exportReviewBundle, importReviewBundle, REVIEW_LIMITS } from '../../packages/battle-sfx/src/review.js'

const POLICY_PATH = 'tools/audio-import/analysis-policy.json'
const SELECTION_PATH = 'tools/audio-import/runtime-selection.json'
const REVIEW_PATH = 'tools/audio-import/review/pilot-reviews.json'
const REPORT_PATH = 'tools/audio-import/reports/sfx-remaining-analysis.json'
const MARKDOWN_PATH = 'tools/audio-import/reports/sfx-remaining-analysis.md'
const BATCH_DIRECTORY = 'tools/audio-import/review/remaining'
const round = value => Number(value.toFixed(8))
const db = value => value > 0 ? round(20 * Math.log10(value)) : null
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
export const subjectKey = subject => `${subject.kind}:${subject.id}:${subject.phase}`
export const candidateKey = (subject, assetId) => `${subjectKey(subject)}:${assetId}`
export const reviewContext = manifest => ({ catalog: manifest, visualRevisions: manifest.visualRevisions, visualDurations: Object.fromEntries(manifest.subjects.filter(s => s.kind === 'move' && Number.isFinite(s.durationSeconds)).map(s => [subjectKey(s), s.durationSeconds])) })

function validatePolicy(policy) {
  assert(policy?.schemaVersion === 1 && policy.kind === 'battle-sfx-technical-draft-policy', 'Unsupported analysis policy')
  assert(policy.windowMilliseconds === 10 && policy.envelopeBinLimit === 64 && policy.transientLimit === 5 && policy.transientSpacingMilliseconds === 50, 'Unexpected analysis window policy')
  assert(policy.quietThresholdDbfs === -60 && policy.quietTrimPrePaddingMilliseconds === 20 && policy.quietTrimPostPaddingMilliseconds === 50, 'Unexpected quiet-edge proposal policy')
  assert(policy.samplePeakCeilingDbfs === -3 && policy.gainStepDb === 0.01 && policy.rmsLowOutlierDbfs === -35 && policy.rmsHighOutlierDbfs === -12, 'Unexpected technical gain policy')
  assert(policy.defaultRegion === 'whole-original-at-visual-zero' && policy.defaultGain === 'attenuate-only-to-approved-pilot-peak-and-whole-rms-ceilings' && policy.gainReference === 'validated-runtime-selection-whole-recordings' && policy.accentAlternative === 'strongest-10ms-energy-window-start-to-declared-result-cue-if-whole-recording-start-is-nonnegative' && policy.playbackRate === 1 && policy.promotion === 'never', 'Analysis must remain non-promoting, native-rate draft preparation')
}

function technicalGain(peak, rms, policy, reference) {
  return peak > 0 ? round(Math.min(0, Math.floor(Math.min(policy.samplePeakCeilingDbfs - 20 * Math.log10(peak), reference.peakDbfs - 20 * Math.log10(peak), reference.rmsDbfs - 20 * Math.log10(rms)) / policy.gainStepDb) * policy.gainStepDb)) : 0
}

/** Energy is a numeric measurement, not an audible onset or semantic sound role. */
export function analyzeEnvelope(channelData, sampleRate, policy, gainReference) {
  validatePolicy(policy)
  assert(Number.isFinite(gainReference?.peakDbfs) && gainReference.peakDbfs <= 0 && Number.isFinite(gainReference?.rmsDbfs) && gainReference.rmsDbfs <= 0, 'A measured approved-pilot gain reference is required')
  assert(Array.isArray(channelData) && [1, 2].includes(channelData.length) && channelData.every(channel => channel instanceof Float32Array && channel.length === channelData[0].length), 'Invalid analysis PCM channels')
  const frames = channelData[0].length, channels = channelData.length
  assert(Number.isSafeInteger(sampleRate) && sampleRate >= 8000 && sampleRate <= 192000 && frames > 0 && frames * channels * 4 <= DECODE_LIMITS.decodedBytes && frames / sampleRate <= DECODE_LIMITS.durationSeconds, 'Analysis PCM exceeds bounds')
  const windowFrames = Math.max(1, Math.round(sampleRate * policy.windowMilliseconds / 1000)), windows = []
  const threshold = 10 ** (policy.quietThresholdDbfs / 20)
  let peak = 0, sumSquares = 0, firstAbove = null, lastAbove = null, aboveFullScale = 0
  for (let start = 0; start < frames; start += windowFrames) {
    const end = Math.min(start + windowFrames, frames)
    let windowSquares = 0, windowPeak = 0
    for (let frame = start; frame < end; frame++) for (const channel of channelData) {
      const value = channel[frame]
      assert(Number.isFinite(value), 'Non-finite analysis sample')
      const magnitude = Math.abs(value)
      windowSquares += value * value; windowPeak = Math.max(windowPeak, magnitude)
      if (magnitude > threshold) { firstAbove ??= frame; lastAbove = frame }
      if (magnitude > 1) aboveFullScale++
    }
    sumSquares += windowSquares; peak = Math.max(peak, windowPeak)
    windows.push({ startFrame: start, endFrame: end, rms: Math.sqrt(windowSquares / ((end - start) * channels)), peak: windowPeak })
  }
  const strongest = windows.reduce((best, window) => window.rms > best.rms ? window : best, windows[0])
  const rises = windows.map((window, index) => ({ ...window, rise: window.rms - (windows[index - 1]?.rms ?? 0) })).filter(window => window.rise > 0)
    .sort((a, b) => b.rise - a.rise || a.startFrame - b.startFrame)
  const transients = [], spacing = Math.round(sampleRate * policy.transientSpacingMilliseconds / 1000)
  for (const rise of rises) {
    if (transients.every(previous => Math.abs(previous.startFrame - rise.startFrame) >= spacing)) transients.push({ startFrame: rise.startFrame, endFrame: rise.endFrame, rmsRise: round(rise.rise), rmsDbfs: db(rise.rms) })
    if (transients.length >= policy.transientLimit) break
  }
  const count = Math.min(windows.length, policy.envelopeBinLimit)
  const envelope = Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * windows.length / count), end = Math.floor((index + 1) * windows.length / count)
    const group = windows.slice(start, end)
    return [group[0].startFrame, group[group.length - 1].endFrame, db(Math.max(...group.map(window => window.rms))), db(Math.max(...group.map(window => window.peak)))]
  })
  const rms = Math.sqrt(sumSquares / (frames * channels))
  const gainDb = technicalGain(peak, rms, policy, gainReference)
  let thresholdRegion = null
  if (firstAbove !== null) {
    const startFrame = Math.max(0, firstAbove - Math.round(sampleRate * policy.quietTrimPrePaddingMilliseconds / 1000))
    const endFrame = Math.min(frames, lastAbove + 1 + Math.round(sampleRate * policy.quietTrimPostPaddingMilliseconds / 1000))
    let regionPeak = 0, regionSquares = 0
    for (let frame = startFrame; frame < endFrame; frame++) for (const channel of channelData) {
      regionPeak = Math.max(regionPeak, Math.abs(channel[frame])); regionSquares += channel[frame] * channel[frame]
    }
    const regionRms = Math.sqrt(regionSquares / ((endFrame - startFrame) * channels))
    thresholdRegion = { startFrame, endFrame, peak: round(regionPeak), peakDbfs: db(regionPeak), rmsDbfs: db(regionRms), suggestedGainDb: technicalGain(regionPeak, regionRms, policy, gainReference) }
  }
  return {
    sampleRate, sampleFrames: frames, channels, durationSeconds: round(frames / sampleRate),
    peak: round(peak), peakDbfs: db(peak), rmsDbfs: db(Math.sqrt(sumSquares / (frames * channels))), samplesAboveFullScale: aboveFullScale,
    quietThresholdDbfs: policy.quietThresholdDbfs, firstFrameAboveQuietThreshold: firstAbove, lastFrameAboveQuietThreshold: lastAbove,
    leadingQuietFrames: firstAbove ?? frames, trailingQuietFrames: lastAbove === null ? frames : frames - 1 - lastAbove,
    allBelowQuietThreshold: firstAbove === null, windowFrames, windowCount: windows.length,
    strongestEnergyWindow: { startFrame: strongest.startFrame, endFrame: strongest.endFrame, rmsDbfs: db(strongest.rms), peakDbfs: db(strongest.peak) },
    positiveEnergyRises: transients,
    envelope: { columns: ['startFrame', 'endFrameExclusive', 'maximumWindowRmsDbfs', 'samplePeakDbfs'], aggregation: 'Each bin combines whole 10 ms analysis windows; max window RMS and max sample peak are retained. Null dBFS means exact zero.', bins: envelope },
    thresholdRegion, suggestedGainDb: round(gainDb), gainBasis: 'Attenuation only: maximum decoded sample peak and whole-recording RMS of the validated runtime pilot selection are technical ceilings, plus a -3 dBFS hard peak ceiling. Not perceived-loudness normalization, true-peak measurement, or a combined-mix listening judgement.',
  }
}

export function buildCandidate({ subject, asset, measurement, manifest, policy }) {
  validatePolicy(policy)
  const animated = subject.kind === 'move' && !!subject.fxId && Number.isFinite(subject.durationSeconds)
  const importable = animated || subject.kind === 'event'
  const visualComparisonAllowed = animated && asset.variant?.type !== 'turn-effect' && !(subject.id === 'present' && asset.variant?.type === 'outcome' && asset.variant.outcome === 'heal')
  const defaultSegment = { startFrame: 0, endFrame: asset.decoded.sampleFrames, sourceAnchorFrame: 0, visualAnchorSeconds: 0, gainDb: measurement.suggestedGainDb, nativeOffsetSeconds: 0 }
  const flags = ['listening-unreviewed', 'native-decoder-unmeasured']
  if (animated && !visualComparisonAllowed) flags.push('audio-only-variant-no-compatible-visual')
  if (!animated) flags.push(subject.kind === 'event' ? 'event-role-unassigned' : 'no-registered-visual')
  if (asset.variant?.type !== 'whole') flags.push(`variant-role-unassigned:${asset.variant?.type ?? 'unknown'}`)
  if (subject.phase === 'prepare') flags.push('prepare-role-unassigned')
  if (asset.variant?.type === 'outcome' || asset.variant?.type === 'turn-effect') flags.push('outcome-visual-compatibility-unconfirmed')
  if (measurement.samplesAboveFullScale > 0) flags.push('source-sample-peak-exceeds-full-scale')
  if (measurement.allBelowQuietThreshold) flags.push('entire-recording-below-quiet-threshold')
  if (measurement.rmsDbfs !== null && measurement.rmsDbfs < policy.rmsLowOutlierDbfs) flags.push('low-rms-outlier-no-boost-proposed')
  if (measurement.rmsDbfs !== null && measurement.rmsDbfs > policy.rmsHighOutlierDbfs) flags.push('high-rms-outlier')
  if (animated && measurement.durationSeconds > subject.durationSeconds) flags.push('whole-recording-tail-exceeds-animation')
  const alternatives = [], reasoning = [
    'Whole original is the default comparison: no resampling, time stretch, fades, edits, or guessed sound roles.',
    `Suggested gain ${measurement.suggestedGainDb} dB uses attenuation-only peak and whole-recording RMS ceilings from the approved pilot; perceived balance remains unreviewed.`,
    'Energy windows and threshold crossings are measurements, not semantic impacts or evidence of an audible onset.',
    'Native offset 0 is an unmeasured placeholder. Browser sample alignment and both perspectives remain unchecked.',
  ]
  if (animated && measurement.strongestEnergyWindow.rmsDbfs !== null && asset.variant?.type === 'whole' && subject.phase === 'attack') {
    const marker = subject.markers.find(row => row.kind === 'result' && row.id === 'impact')
    if (marker) {
      const anchor = measurement.strongestEnergyWindow.startFrame
      const start = marker.timeSeconds - anchor / measurement.sampleRate
      if (start >= 0) alternatives.push({ id: 'energy-window-to-result', label: 'Compare energy window at result cue', description: 'Whole recording, delayed so the start of its strongest 10 ms RMS window coincides with the declared visual result cue. This numeric coincidence does not establish a semantic impact.', segments: [{ ...defaultSegment, sourceAnchorFrame: anchor, visualAnchorSeconds: marker.timeSeconds }] })
      else reasoning.push('The strongest energy window occurs too late in the source to align the complete recording at the result cue without starting before the animation. No lead-in was cut to force alignment.')
    }
  } else reasoning.push('No energy-to-result alignment proposed for an ambiguous variant, prepare phase, or audio-only subject; filenames do not assign timing roles.')
  if (measurement.thresholdRegion !== null) {
    const { startFrame: start, endFrame: end, suggestedGainDb } = measurement.thresholdRegion
    if (start > 0 || end < measurement.sampleFrames) alternatives.push({ id: 'threshold-edge-comparison', label: 'Compare padded threshold region', description: 'Optional numeric -60 dBFS threshold-edge region with 20 ms lead-in and 50 ms tail padding. Gain is recalculated from this region\'s sample peak and RMS. Below-threshold samples can still matter; no claim of silence, codec priming correction, or perceptual approval.', segments: [{ ...defaultSegment, startFrame: start, endFrame: end, sourceAnchorFrame: start, gainDb: suggestedGainDb }] })
  }
  let record = null
  if (importable) {
    record = createReviewRecord({ asset, subject, visualRevision: subject.visualRevision, decoderReference: { auditLockSha256: manifest.auditLockSha256 } })
    record.segments = [{ ...defaultSegment }]
    record.review.notes = `Automated technical DRAFT only. ${reasoning.join(' ')} Flags: ${flags.join(', ')}. Optional alternatives are in the remaining-analysis report; none is an approval.`
  }
  return { candidate: { key: candidateKey(subject, asset.id), subject: { kind: subject.kind, id: subject.id, phase: subject.phase }, assetId: asset.id, status: importable ? 'draft' : 'report-only', visualComparisonAllowed, defaultSegment, alternatives, flags, reasoning }, record }
}

async function decodeMeasurement(asset, root, policy, gainReference) {
  const bytes = await readLocal(root, `public/sound_effects/${asset.file}`)
  assert(bytes.length === asset.bytes && sha256(bytes) === asset.sha256, `Analysis source differs from audit: ${asset.id}`)
  const format = inspectMp3(bytes), upperFrames = format.frameCount * 1152
  assert(bytes.length <= DECODE_LIMITS.inputBytes && format.channels === 2 && upperFrames * format.channels * 4 <= DECODE_LIMITS.decodedBytes && upperFrames / format.sampleRate <= DECODE_LIMITS.durationSeconds, 'Analysis decode exceeds pinned bounds')
  const { MPEGDecoder } = await import('mpg123-decoder')
  const decoder = new MPEGDecoder({ enableGapless: true })
  let ready = false
  try {
    await decoder.ready; ready = true
    const result = decoder.decode(bytes), decoded = analyzePcm(result)
    assert(JSON.stringify(decoded) === JSON.stringify(asset.decoded), `Analysis PCM differs from pinned Stage A decode: ${asset.id}`)
    const measurement = analyzeEnvelope(result.channelData, result.sampleRate, policy, gainReference)
    return { assetId: asset.id, file: asset.file, sha256: asset.sha256, pcmSha256: decoded.pcmSha256, ...measurement }
  } finally { if (ready) decoder.free() }
}

export function compileRemainingAnalysis({ manifest, measurements, approvedRecords, policy }) {
  const byAsset = new Map(measurements.map(row => [row.assetId, row]))
  assert(byAsset.size === Object.keys(manifest.assets).length && Object.keys(manifest.assets).every(id => byAsset.has(id)), 'Every audited asset needs exactly one technical measurement')
  const approved = new Map(approvedRecords.filter(row => row.status === 'approved').map(row => [candidateKey(row.subject, row.source.assetId), row]))
  const candidates = [], drafts = [], approvedKeysSeen = new Set(), coveredAssets = new Set()
  for (const subject of manifest.subjects) {
    if (!subject.assetIds.length) candidates.push({ key: `${subjectKey(subject)}:no-source`, subject: { kind: subject.kind, id: subject.id, phase: subject.phase }, assetId: null, status: 'missing-source', defaultSegment: null, alternatives: [], flags: ['no-source-candidate'], reasoning: [...subject.notes] })
    for (const assetId of subject.assetIds) {
      const asset = manifest.assets[assetId], measurement = byAsset.get(assetId), key = candidateKey(subject, assetId)
      assert(asset && measurement, `Candidate lacks measured source: ${key}`)
      coveredAssets.add(assetId)
      if (approved.has(key)) {
        const record = approved.get(key)
        assert(record.source.sha256 === asset.sha256 && record.source.pcmSha256 === asset.decoded.pcmSha256 && record.visualRevision === subject.visualRevision, `Approved pilot differs from collection: ${key}`)
        approvedKeysSeen.add(key)
        candidates.push({ key, subject: { ...record.subject }, assetId, status: 'approved-existing', defaultSegment: null, alternatives: [], flags: [], reasoning: ['Existing pilot approval retained exactly; no new draft or adjusted gain is generated for this subject/phase/asset.'], approvalFingerprintSha256: sha256(Buffer.from(record.approvalFingerprint)) })
      } else {
        const { candidate, record } = buildCandidate({ subject, asset, measurement, manifest, policy })
        candidates.push(candidate)
        if (record) drafts.push(record)
      }
    }
  }
  assert(approvedKeysSeen.size === approved.size, 'An existing approved pilot is absent from the collection')
  assert(coveredAssets.size === byAsset.size, 'An audited source is absent from all candidate subjects')
  const context = reviewContext(manifest), batches = [], outputs = []
  for (let offset = 0; offset < drafts.length; offset += REVIEW_LIMITS.records) {
    const records = drafts.slice(offset, offset + REVIEW_LIMITS.records), id = `batch-${String(batches.length + 1).padStart(3, '0')}`
    const path = `${BATCH_DIRECTORY}/${id}.json`, bytes = Buffer.from(exportReviewBundle(records, context))
    const batch = { id, label: `${id}: ${records[0].subject.id} – ${records[records.length - 1].subject.id}`, count: records.length, path, sha256: sha256(bytes), bytes: bytes.length }
    batches.push(batch); outputs.push({ path, bytes })
    for (const record of records) candidates.find(row => row.key === candidateKey(record.subject, record.source.assetId)).batchId = id
  }
  const summary = {
    assetCount: measurements.length, movePolicyCount: Object.keys(manifest.moves).length, subjectCount: manifest.subjects.length,
    animatedSubjectCount: manifest.subjects.filter(s => s.kind === 'move' && !!s.fxId).length,
    candidateCount: candidates.filter(row => row.assetId !== null).length, approvedCandidateCount: approvedKeysSeen.size,
    draftCount: drafts.length, reportOnlyCandidateCount: candidates.filter(row => row.status === 'report-only').length,
    missingSourceSubjectCount: candidates.filter(row => row.status === 'missing-source').length, batchCount: batches.length,
    attenuatedDraftCount: drafts.filter(record => record.segments[0].gainDb < 0).length,
    energyAlignmentAlternativeCount: candidates.filter(row => row.alternatives.some(a => a.id === 'energy-window-to-result')).length,
    thresholdRegionAlternativeCount: candidates.filter(row => row.alternatives.some(a => a.id === 'threshold-edge-comparison')).length,
    rmsOutlierAssetCount: measurements.filter(row => row.rmsDbfs !== null && (row.rmsDbfs < policy.rmsLowOutlierDbfs || row.rmsDbfs > policy.rmsHighOutlierDbfs)).length,
    nativeBrowserReviewsAdded: 0, listeningApprovalsAdded: 0, runtimeMappingsAdded: 0,
  }
  return { summary, batches, candidates, outputs }
}

function markdownReport(report) {
  const { summary: s } = report
  const lines = [
    '# Remaining SFX technical preparation', '',
    `Measured all **${s.assetCount} audited recordings** and accounted for **${s.movePolicyCount} move policies**, **${s.animatedSubjectCount} animated phases**, and all event policies.`, '',
    `Preserved **${s.approvedCandidateCount} existing approvals**; generated **${s.draftCount} technical drafts** in ${s.batchCount} importable batches. ${s.reportOnlyCandidateCount} candidates have no registered animation and remain report-only; ${s.missingSourceSubjectCount} subjects have no source.`, '',
    '**No listening approval, native-browser alignment approval, or runtime mapping is added.** Each draft has false near/far checks, unmeasured native fields, and a null approval fingerprint. Whole original recordings remain unchanged.', '',
    '## Measurements and proposals', '',
    '- The pinned decoder rechecks every compressed hash and every reference PCM measurement against Stage A.',
    '- Exact 10 ms RMS windows identify numeric energy maxima and positive energy changes, never semantic impacts or audible onsets.',
    '- Defaults retain the whole recording at visual time zero. Only downward gain to the approved pilot maximum sample peak and whole-recording RMS is suggested, with an additional -3 dBFS hard peak ceiling. Quiet sounds are never boosted. This is not perceived loudness normalization or true-peak certification.',
    `- ${s.energyAlignmentAlternativeCount} explicit comparison alternatives can delay a whole, unambiguous recording to align its strongest energy-window start with the declared visual result cue. A negative start is rejected instead of cutting the lead-in.`,
    `- ${s.thresholdRegionAlternativeCount} optional threshold-edge comparisons retain 20 ms before and 50 ms after samples exceeding -60 dBFS. Below-threshold samples can remain perceptually relevant; these are suggestions, not automatic edits or priming corrections.`,
    '- Part numbers, hit counts, preparation sounds, outcomes and event roles remain unassigned. Their filename labels do not establish chronology or gameplay semantics.',
    '- RMS outliers and long tails are review flags only. The recordings are not reencoded, rate-shifted, normalized or shortened.', '',
    '## Reproduction', '',
    'Run `node tools/audio-import/analysis.mjs` to generate, or `node tools/audio-import/analysis.mjs --check` to recompute and verify without writing. Install the isolated pinned decoder first with the repository audio setup command. All output is developer authoring data.', '',
    `Policy SHA-256: \`${report.provenance.policy.sha256}\``, '',
    `Algorithm SHA-256: \`${report.provenance.algorithm.sha256}\``, '',
    '## Draft batches', '', '| Batch | Records | First/last subject |', '| --- | ---: | --- |',
    ...report.batches.map(batch => `| [${batch.id}](../review/remaining/${batch.id}.json) | ${batch.count} | ${batch.label.slice(batch.id.length + 2)} |`), '',
    '## Complete candidate matrix', '', '| Subject | Phase | Asset | Disposition | Review flags |', '| --- | --- | --- | --- | --- |',
    ...report.candidates.map(row => `| ${row.subject.kind}:${row.subject.id} | ${row.subject.phase} | ${row.assetId ?? '—'} | ${row.status} | ${row.flags.join('; ') || '—'} |`), '',
  ]
  return `${lines.join('\n')}\n`
}

/** Sequential decode bounds PCM residency to one recording. No generated value can promote playback. */
export async function generateRemainingAnalysis({ root = BENCH_ROOT, check = false, onProgress = () => {} } = {}) {
  const { createCollectionManifest } = await import('./collection.mjs')
  const manifest = await createCollectionManifest({ root }), pilotManifest = await createBenchManifest({ root })
  const [policyBytes, reviewBytes, selectionBytes] = await Promise.all([readLocal(root, POLICY_PATH), readLocal(root, REVIEW_PATH), readLocal(root, SELECTION_PATH)])
  const policy = JSON.parse(policyBytes); validatePolicy(policy)
  const approvedRecords = importReviewBundle(reviewBytes.toString(), reviewContext(pilotManifest)).records
  const runtime = compileRuntime({ manifest: pilotManifest, reviewText: reviewBytes.toString(), selectionText: selectionBytes.toString() })
  const selectedAssets = runtime.report.selected.map(row => manifest.assets[row.assetId])
  const gainReference = { source: 'validated-runtime-selection-whole-recordings', assetIds: selectedAssets.map(asset => asset.id), peakDbfs: Math.max(...selectedAssets.map(asset => asset.decoded.peakDbfs)), rmsDbfs: Math.max(...selectedAssets.map(asset => asset.decoded.rmsDbfs)) }
  const measurements = []
  for (const asset of Object.values(manifest.assets).sort((a, b) => compare(a.id, b.id))) {
    measurements.push(await decodeMeasurement(asset, root, policy, gainReference))
    if (measurements.length % 50 === 0) onProgress({ measured: measurements.length, total: Object.keys(manifest.assets).length })
  }
  const compiled = compileRemainingAnalysis({ manifest, measurements, approvedRecords, policy })
  const report = {
    schemaVersion: 1, kind: 'battle-sfx-remaining-technical-analysis', status: 'drafts-only',
    provenance: {
      auditLockSha256: manifest.auditLockSha256, collectionRevision: manifest.collectionRevision, decoderReference: manifest.decoderReference,
      manifestSha256: sha256(Buffer.from(JSON.stringify(manifest))),
      sourceSetSha256: sha256(Buffer.from(JSON.stringify(measurements.map(row => ({ assetId: row.assetId, sha256: row.sha256, pcmSha256: row.pcmSha256 }))))),
      approvedPilotReviews: { path: REVIEW_PATH, sha256: sha256(reviewBytes) },
      runtimeSelection: { path: SELECTION_PATH, sha256: sha256(selectionBytes) },
      policy: { path: POLICY_PATH, sha256: sha256(policyBytes) },
      algorithm: { path: 'tools/audio-import/analysis.mjs', sha256: sha256(await readFile(fileURLToPath(import.meta.url))) },
    },
    policy, gainReference, summary: compiled.summary, batches: compiled.batches, measurements, candidates: compiled.candidates,
  }
  const outputs = [...compiled.outputs, { path: REPORT_PATH, bytes: Buffer.from(`${JSON.stringify(report)}\n`) }, { path: MARKDOWN_PATH, bytes: Buffer.from(markdownReport(report)) }]
  if (check) for (const output of outputs) {
    const existing = await readLocal(root, output.path, true)
    assert(existing?.equals(output.bytes), `Remaining-analysis output differs or is missing: ${output.path}`)
  }
  else for (const output of outputs) await atomicWrite(root, output.path, output.bytes)
  return report
}

/** Validate stored authoring evidence without decoding or regenerating it during a browser request. */
export async function readRemainingAnalysis({ root = BENCH_ROOT, manifest } = {}) {
  assert(manifest?.collectionRevision, 'A verified full collection manifest is required')
  const report = JSON.parse(await readLocal(root, REPORT_PATH))
  assert(report.schemaVersion === 1 && report.kind === 'battle-sfx-remaining-technical-analysis' && report.status === 'drafts-only', 'Unsupported remaining-analysis report')
  assert(report.provenance?.collectionRevision === manifest.collectionRevision && report.provenance.auditLockSha256 === manifest.auditLockSha256, 'Remaining-analysis report is stale for this collection; regenerate analysis')
  for (const [field, path] of [['algorithm', 'tools/audio-import/analysis.mjs'], ['policy', POLICY_PATH], ['approvedPilotReviews', REVIEW_PATH], ['runtimeSelection', SELECTION_PATH]]) {
    const pin = report.provenance[field]
    assert(pin?.path === path && pin.sha256 === sha256(await readLocal(root, path)), `Remaining-analysis ${field} pin changed; regenerate analysis`)
  }
  assert(Array.isArray(report.batches) && report.batches.length === report.summary?.batchCount && Array.isArray(report.measurements) && report.measurements.length === Object.keys(manifest.assets).length && Array.isArray(report.candidates), 'Invalid remaining-analysis coverage')
  const seen = new Set()
  for (const measurement of report.measurements) {
    const asset = manifest.assets[measurement.assetId]
    assert(asset && !seen.has(asset.id) && measurement.sha256 === asset.sha256 && measurement.pcmSha256 === asset.decoded.pcmSha256, 'Remaining-analysis measurement provenance differs from the audited collection')
    seen.add(asset.id)
  }
  for (const batch of report.batches) assert(/^batch-\d{3}$/.test(batch.id) && batch.path === `${BATCH_DIRECTORY}/${batch.id}.json` && /^[a-f0-9]{64}$/.test(batch.sha256) && Number.isSafeInteger(batch.count) && batch.count > 0 && batch.count <= REVIEW_LIMITS.records, 'Invalid remaining-analysis batch metadata')
  return report
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2)
    assert(args.every(arg => arg === '--check') && args.length <= 1, 'Usage: node tools/audio-import/analysis.mjs [--check]')
    const report = await generateRemainingAnalysis({ check: args.includes('--check'), onProgress: ({ measured, total }) => console.log(`Measured ${measured}/${total} pinned recordings`) })
    console.log(`${args.includes('--check') ? 'Verified' : 'Generated'} ${report.summary.draftCount} technical drafts in ${report.summary.batchCount} batches; ${report.summary.approvedCandidateCount} existing approvals unchanged; no new playback enabled.`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
