import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual as equal } from 'node:util'
import { assert, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { planSyncAudition } from '../../apps/sfx-bench/src/sync.js'
import { normalizeSyncFeedback } from '../../apps/sfx-bench/src/syncFeedback.js'

const CHANGED = ['fireblast', 'earthquake', 'thunder', 'blizzard']
export const FIFTH_THIRD_FILES = Object.freeze([
  'tools/audio-import/review/sync-batch-005.feedback-03.json',
  'tools/audio-import/review/sync-batch-005.review-03.json',
  'tools/audio-import/review/sync-batch-005.manifest-03.json',
  'tools/audio-import/review/sync-batch-005.revision-03.json',
  'tools/audio-import/sync-fifth-third-revision.mjs',
  'apps/sfx-bench/src/batchFiveVisualV3.js',
  ...['fire-blast', 'earthquake', 'thunder', 'blizzard'].map(id => `packages/battle-fx/src/review-batch-five-v3/${id}.js`),
  'tools/audio-import/review/sync-batch-005.style-notes-03.md',
])
const hash = value => sha256(Buffer.from(JSON.stringify(value)))

export async function reviseFifthBatchThird({ root, batch, revisionPins }) {
  const [feedbackBytes, captureBytes, manifestBytes, configBytes] = await Promise.all(FIFTH_THIRD_FILES.slice(0, 4).map(path => readLocal(root, path)))
  const feedback = JSON.parse(feedbackBytes), capture = JSON.parse(captureBytes), prior = JSON.parse(manifestBytes), config = JSON.parse(configBytes)
  assert(batch.id === 'sync-005' && capture.kind === 'battle-sfx-sync-review-capture' && capture.schemaVersion === 1, 'Invalid third fifth-batch capture')
  assert(capture.source.name === 'sync-005-feedback.json' && capture.source.sha256 === sha256(feedbackBytes), 'Third fifth-batch feedback bytes changed')
  assert(capture.manifestPath === FIFTH_THIRD_FILES[2] && capture.manifestSha256 === sha256(manifestBytes), 'Third captured proposal changed')
  assert(feedback.revision === prior.revision && config.reviewedRevision === prior.revision && config.batchId === batch.id && config.schemaVersion === 1, 'Third fifth-batch identity changed')
  assert(equal(config.moves.map(move => move.id), batch.moves.map(move => move.id)) && equal(prior.moves.map(move => move.id), batch.moves.map(move => move.id)), 'Third fifth-batch review must retain all ten moves')
  assert(equal(normalizeSyncFeedback(feedback, prior), feedback), 'Third fifth-batch feedback contains invalid tuning')
  for (const pin of capture.playbackPins)
    assert(equal(revisionPins.find(current => current.path === pin.path), pin), `Previously reviewed playback changed: ${pin.path}`)
  const pins = FIFTH_THIRD_FILES.map(path => {
    const pin = revisionPins.find(pin => pin.path === path)
    assert(pin && /^[a-f0-9]{64}$/.test(pin.sha256), `Missing third fifth-batch provenance: ${path}`)
    return pin
  })
  const moves = await Promise.all(batch.moves.map(async (move, index) => {
    const previous = prior.moves[index], record = feedback.records[index], change = config.moves[index]
    for (const field of ['id', 'fxId', 'asset', 'visual', 'visualAccent', 'candidate', 'originalVisual', 'baseline'])
      assert(equal(move[field], previous[field]), `Previously reviewed move changed: ${move.id}/${field}`)
    assert(record.moveId === move.id && record.native && change.notes?.length && change.notes.every(note => typeof note === 'string' && note.length <= 1200), 'Invalid third fifth-batch record')
    const candidate = structuredClone(change.plan)
    assert(equal(candidate, record.plan), `Third revision must preserve reviewed sound: ${move.id}`)
    let visual = previous.visual, visualAccent = previous.visualAccent
    const changed = CHANGED.includes(move.id)
    assert(record.verdict === (changed ? 'adjust-animation' : 'keep'), 'Third review verdict differs from its scoped changes')
    if (changed) {
      const path = `packages/battle-fx/src/review-batch-five-v3/${move.fxId}.js`, pin = pins.find(pin => pin.path === path)
      assert(pin, `Missing third revised recipe: ${move.id}`)
      const { timing } = await import(`${pathToFileURL(resolve(root, path)).href}?revision=${pin.sha256}`)
      const impact = previous.visual.markers.find(marker => marker.id === 'impact').timeSeconds
      assert(timing.contact === impact && timing.duration === previous.visual.durationSeconds, 'Third revision must preserve the reviewed contact and duration')
      const markers = [{ id: 'impact', label: 'Result impact cue', timeSeconds: timing.contact }, ...(timing.markers ?? [])]
      assert(new Set(markers.map(marker => marker.id)).size === markers.length && markers.every(marker => typeof marker.label === 'string' && Number.isFinite(marker.timeSeconds) && marker.timeSeconds >= 0 && marker.timeSeconds <= timing.duration), 'Invalid third revised markers')
      const revision = hash({ previous: previous.visual.visualRevision, pin, factory: pins.find(pin => pin.path.endsWith('batchFiveVisualV3.js')), playback: capture.playbackPins })
      visual = { durationSeconds: timing.duration, visualRevision: revision, markers }
      visualAccent = { id: `batch-five-${move.id}-v3`, revision }
    }
    for (const native of [record.native, move.asset.decoded]) {
      const regions = planSyncAudition(candidate, native, visual)
      assert(regions.every(region => region.delaySeconds + region.endSeconds - region.startSeconds <= visual.durationSeconds / candidate.visualRate + 1e-9), 'Third revised sound outlasts visual')
    }
    return { ...move, candidate, visual, ...(visualAccent ? { visualAccent } : {}), notes: change.notes,
      previousVisual: previous.visual, previousVisualAccent: previous.visualAccent ?? null, previousPlayback: prior.reviewPlayback,
      previousReview: { verdict: record.verdict, notes: record.notes, plan: record.plan, changed, revision: feedback.revision } }
  }))
  const feedbackRecords = moves.map((move, index) => ({ moveId: move.id, plan: move.candidate,
    verdict: move.previousReview.changed ? 'unreviewed' : 'keep', notes: feedback.records[index].notes, native: feedback.records[index].native,
    ...(move.visualAccent ? { visualAccent: move.visualAccent } : {}) }))
  return { ...batch, moves, feedbackRecords, defaultMoveId: 'fireblast', reviewPlayback: 'batch-five-feedback-v3',
    revision: hash({ reviewed: prior.revision, config, pins, moves }) }
}
