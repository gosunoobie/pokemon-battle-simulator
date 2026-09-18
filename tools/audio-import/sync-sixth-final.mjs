import { isDeepStrictEqual as equal } from 'node:util'
import { assert } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { SIXTH_FILES } from './sync-sixth-batch.mjs'
import { SIXTH_SECOND_FILES } from './sync-sixth-second-revision.mjs'
import { normalizeSyncFeedback } from '../../apps/sfx-bench/src/syncFeedback.js'
import { planSyncAudition } from '../../apps/sfx-bench/src/sync.js'

export const SIXTH_FINAL_FILES = Object.freeze([
  'tools/audio-import/review/sync-batch-006.final.json',
  'tools/audio-import/review/sync-batch-006.feedback-02.json',
  'tools/audio-import/review/sync-batch-006.manifest-02.json',
  'tools/audio-import/sync-sixth-final.mjs',
])
const playbackFiles = [...new Set([
  'apps/sfx-bench/src/audio.js', 'apps/sfx-bench/src/sync.js', 'apps/sfx-bench/src/syncVisual.js',
  ...SIXTH_FILES, ...SIXTH_SECOND_FILES, 'tools/audio-import/review/sync-batch-006.json',
])]
const ids = ['leafblade', 'triattack', 'meteormash', 'ancientpower', 'sacredfire']
const hash = value => sha256(Buffer.from(JSON.stringify(value)))
function shape(value, fields, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value)
    && equal(Object.keys(value).sort(), [...fields].sort()), `Invalid ${label} shape`)
}

/** Accept only the exact five reviewed versions after both visual revisions. */
export function compileSixthFinalBatch({ final, batch, feedbackBytes, manifestBytes, revisionPins }) {
  shape(final, ['schemaVersion', 'kind', 'batchId', 'reviewedRevision', 'approval', 'reviewEvidence', 'playbackPins'], 'sixth final')
  assert(final.schemaVersion === 1 && final.kind === 'battle-sfx-final-batch'
    && final.batchId === 'sync-006' && batch.id === final.batchId, 'Invalid sixth final identity')
  shape(final.approval, ['source', 'text', 'date'], 'sixth approval')
  assert(final.approval.source === 'user-message' && /^\d{4}-\d{2}-\d{2}$/.test(final.approval.date)
    && typeof final.approval.text === 'string' && final.approval.text.trim().length > 0
    && final.approval.text.length <= 2000, 'Sixth final requires explicit approval')
  shape(final.reviewEvidence, ['feedbackPath', 'feedbackSha256', 'manifestPath', 'manifestSha256'], 'sixth final evidence')
  const evidence = final.reviewEvidence
  assert(evidence.feedbackPath === SIXTH_FINAL_FILES[1] && Buffer.isBuffer(feedbackBytes)
    && evidence.feedbackSha256 === sha256(feedbackBytes), 'Sixth final feedback changed')
  assert(evidence.manifestPath === SIXTH_FINAL_FILES[2] && Buffer.isBuffer(manifestBytes)
    && evidence.manifestSha256 === sha256(manifestBytes), 'Sixth final manifest changed')
  const feedback = JSON.parse(feedbackBytes), reviewed = JSON.parse(manifestBytes)
  assert(/^[a-f0-9]{64}$/.test(final.reviewedRevision) && final.reviewedRevision === reviewed.revision
    && feedback.revision === reviewed.revision && batch.revision === reviewed.revision, 'Sixth approved revision changed')
  assert(equal(normalizeSyncFeedback(feedback, reviewed), feedback), 'Invalid sixth final feedback')
  assert(equal(reviewed.moves.map(move => move.id), ids) && equal(batch.moves.map(move => move.id), ids)
    && equal(feedback.records.map(record => record.moveId), ids), 'Sixth final must retain its five reviewed moves')
  assert(Array.isArray(final.playbackPins) && equal(final.playbackPins.map(pin => pin.path), playbackFiles), 'Sixth final playback pins are incomplete')
  for (const pin of final.playbackPins) {
    shape(pin, ['path', 'sha256'], 'sixth playback pin')
    assert(/^[a-f0-9]{64}$/.test(pin.sha256) && equal(revisionPins.find(current => current.path === pin.path), pin), `Sixth approved playback changed: ${pin.path}`)
  }
  const moves = batch.moves.map((move, index) => {
    const prior = reviewed.moves[index], record = feedback.records[index]
    assert(equal(move, prior), `Sixth approved move changed: ${move.id}`)
    assert(record.verdict === 'keep' && record.native && equal(record.plan, move.candidate)
      && equal(record.visualAccent, move.visualAccent), `Sixth move lacks its exact approval: ${move.id}`)
    assert(equal(record.native, batch.feedbackRecords[index].native), `Sixth native measurement changed: ${move.id}`)
    for (const native of [record.native, move.asset.decoded]) planSyncAudition(record.plan, native, move.visual)
    const { id, fxId, name, asset, visual, visualAccent, notes } = move
    return structuredClone({ id, fxId, name, asset, visual, visualAccent, notes, plan: record.plan, native: record.native })
  })
  return { schemaVersion: 1, id: batch.id, title: 'Batch 6 · Accepted final versions', status: 'accepted',
    revision: hash({ final, revisionPins }), reviewedRevision: final.reviewedRevision,
    approval: structuredClone(final.approval), moves }
}
