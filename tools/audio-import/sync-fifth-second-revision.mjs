import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual as equal } from 'node:util'
import { assert, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { planSyncAudition } from '../../apps/sfx-bench/src/sync.js'
import { normalizeSyncFeedback } from '../../apps/sfx-bench/src/syncFeedback.js'

export const FIFTH_SECOND_FILES = Object.freeze([
  'tools/audio-import/review/sync-batch-005.feedback-02.json',
  'tools/audio-import/review/sync-batch-005.review-02.json',
  'tools/audio-import/review/sync-batch-005.manifest-02.json',
  'tools/audio-import/review/sync-batch-005.revision-02.json',
  'tools/audio-import/sync-fifth-second-revision.mjs',
  'apps/sfx-bench/src/batchFiveVisualV2.js',
  ...['fire-blast', 'sludge-bomb', 'overheat', 'eruption', 'earthquake', 'thunder', 'blizzard', 'bubble-beam'].map(id => `packages/battle-fx/src/review-batch-five-v2/${id}.js`),
  'tools/audio-import/review/sync-batch-005.razor-leaf-measurements-02.json',
])
const hash = value => sha256(Buffer.from(JSON.stringify(value)))

export async function reviseFifthBatchAgain({ root, batch, revisionPins }) {
  const [feedbackBytes, captureBytes, manifestBytes, configBytes] = await Promise.all(FIFTH_SECOND_FILES.slice(0, 4).map(path => readLocal(root, path)))
  const feedback = JSON.parse(feedbackBytes), capture = JSON.parse(captureBytes), prior = JSON.parse(manifestBytes), config = JSON.parse(configBytes)
  const razorMeasurement = JSON.parse(await readLocal(root, FIFTH_SECOND_FILES.at(-1)))
  assert(batch.id === 'sync-005' && capture.kind === 'battle-sfx-sync-review-capture' && capture.schemaVersion === 1, 'Invalid second fifth-batch capture')
  assert(capture.source.name === 'sync-005-feedback.json' && capture.source.sha256 === sha256(feedbackBytes), 'Second fifth-batch feedback bytes changed')
  assert(capture.manifestPath === FIFTH_SECOND_FILES[2] && capture.manifestSha256 === sha256(manifestBytes), 'Captured fifth-batch proposal changed')
  assert(feedback.revision === prior.revision && config.reviewedRevision === prior.revision && config.batchId === batch.id && config.schemaVersion === 1, 'Second fifth-batch review identity changed')
  assert(equal(config.moves.map(move => move.id), batch.moves.map(move => move.id)) && equal(prior.moves.map(move => move.id), batch.moves.map(move => move.id)), 'Second fifth-batch review must retain all ten moves')
  assert(equal(normalizeSyncFeedback(feedback, prior), feedback), 'Second fifth-batch feedback contains invalid tuning')
  for (const captured of capture.playbackPins) {
    const current = revisionPins.find(pin => pin.path === captured.path)
    assert(equal(current, captured), `Previously reviewed playback changed: ${captured.path}`)
  }
  const pins = FIFTH_SECOND_FILES.map(path => {
    const pin = revisionPins.find(pin => pin.path === path)
    assert(pin && /^[a-f0-9]{64}$/.test(pin.sha256), `Missing second fifth-batch provenance: ${path}`)
    return pin
  })
  const moves = await Promise.all(batch.moves.map(async (move, index) => {
    const previous = prior.moves[index], record = feedback.records[index], change = config.moves[index]
    // The page revision also hashes surrounding authoring files. Check the exact
    // reviewed per-move content and frozen playback, not a recomputed page hash.
    for (const field of ['id', 'fxId', 'asset', 'visual', 'visualAccent', 'candidate', 'originalVisual', 'baseline'])
      assert(equal(move[field], previous[field]), `Previously reviewed move changed: ${move.id}/${field}`)
    assert(record.moveId === move.id && record.native && change.notes?.length && change.notes.every(note => typeof note === 'string' && note.length <= 1200), 'Invalid second fifth-batch record')
    const candidate = structuredClone(change.plan)
    assert(candidate.visualRate === record.plan.visualRate && candidate.segments.length === 1, 'Second fifth-batch review must preserve native sound pacing')
    if (move.id === 'razorleaf') {
      const expected = structuredClone(record.plan); expected.segments[0].endSeconds = 1.67
      assert(equal(candidate, expected), 'Razor Leaf must remove only the last impact sound')
      assert(razorMeasurement.sourceSha256 === move.asset.sha256 && razorMeasurement.pcmSha256 === move.asset.decoded.pcmSha256
        && razorMeasurement.cutSeconds === candidate.segments[0].endSeconds && razorMeasurement.finalImpactOnset.timeSeconds > razorMeasurement.cutSeconds,
      'Razor Leaf cut needs its measured quiet gap')
    } else assert(equal(candidate, record.plan), `Reviewed sound changed: ${move.id}`)
    let visual = previous.visual, visualAccent = previous.visualAccent
    const path = `packages/battle-fx/src/review-batch-five-v2/${move.fxId}.js`, pin = pins.find(pin => pin.path === path)
    if (pin) {
      const { timing } = await import(`${pathToFileURL(resolve(root, path)).href}?revision=${pin.sha256}`)
      assert(Number.isFinite(timing.contact) && timing.contact > 0 && timing.duration > timing.contact, 'Invalid second revised timing')
      const markers = [{ id: 'impact', label: 'Result impact cue', timeSeconds: timing.contact }, ...(timing.markers ?? [])]
      assert(new Set(markers.map(marker => marker.id)).size === markers.length && markers.every(marker => typeof marker.label === 'string' && Number.isFinite(marker.timeSeconds) && marker.timeSeconds >= 0 && marker.timeSeconds <= timing.duration), 'Invalid second revised markers')
      const revision = hash({ previous: previous.visual.visualRevision, pin, factory: pins.find(pin => pin.path.endsWith('batchFiveVisualV2.js')), playback: capture.playbackPins })
      visual = { durationSeconds: timing.duration, visualRevision: revision, markers }
      visualAccent = { id: `batch-five-${move.id}-v2`, revision }
    }
    for (const native of [record.native, move.asset.decoded]) {
      const regions = planSyncAudition(candidate, native, visual)
      assert(regions.every(region => region.delaySeconds + region.endSeconds - region.startSeconds <= visual.durationSeconds / candidate.visualRate + 1e-9), 'Second revised sound outlasts visual')
    }
    const changed = !equal(candidate, record.plan) || !equal(visual, previous.visual)
    assert(changed === (move.id !== 'solarbeam'), 'Solar Beam approval must remain unchanged')
    return { ...move, candidate, visual, ...(visualAccent ? { visualAccent } : {}), notes: change.notes,
      previousVisual: previous.visual, previousVisualAccent: previous.visualAccent ?? null, previousPlayback: 'batch-five-feedback-v1',
      previousReview: { verdict: record.verdict, notes: record.notes, plan: record.plan, changed, revision: feedback.revision } }
  }))
  const feedbackRecords = moves.map((move, index) => ({ moveId: move.id, plan: move.candidate,
    verdict: feedback.records[index].verdict === 'keep' && !move.previousReview.changed ? 'keep' : 'unreviewed',
    notes: feedback.records[index].notes, native: feedback.records[index].native,
    ...(move.visualAccent ? { visualAccent: move.visualAccent } : {}) }))
  return { ...batch, moves, feedbackRecords, defaultMoveId: 'fireblast', reviewPlayback: 'batch-five-feedback-v2',
    revision: hash({ reviewed: prior.revision, config, pins, moves }) }
}
