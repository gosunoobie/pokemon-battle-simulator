import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { assert, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { planSyncAudition } from '../../apps/sfx-bench/src/sync.js'

export const FIFTH_FILES = Object.freeze([
  'tools/audio-import/review/sync-batch-005.feedback-01.json',
  'tools/audio-import/review/sync-batch-005.review-01.json',
  'tools/audio-import/review/sync-batch-005.revision-01.json',
  'tools/audio-import/review/sync-batch-005.eruption-measurements.json',
  'tools/audio-import/sync-fifth-revision.mjs',
  'apps/sfx-bench/src/batchFiveAudio.js', 'apps/sfx-bench/src/batchFiveVisual.js',
  ...['fire-blast', 'solar-beam', 'eruption', 'thunder', 'blizzard'].map(id => `packages/battle-fx/src/review-batch-five/${id}.js`),
])
const hash = value => sha256(Buffer.from(JSON.stringify(value)))
export async function reviseFifthBatch({ root, batch, revisionPins }) {
  assert(batch.id === 'sync-005' && batch.feedbackRecords?.length === 10, 'Fifth revision needs the ten archived user reviews')
  const config = JSON.parse(await readLocal(root, FIFTH_FILES[2]))
  assert(config.schemaVersion === 1 && config.batchId === batch.id && config.reviewedRevision === batch.moves[0].previousReview.revision, 'Fifth revision feedback identity changed')
  assert(isDeepStrictEqual(config.moves.map(row => row.id), batch.moves.map(row => row.id)), 'Fifth revision must retain all ten moves in order')
  const pins = FIFTH_FILES.map(path => {
    const pin = revisionPins.find(pin => pin.path === path)
    assert(pin && /^[a-f0-9]{64}$/.test(pin.sha256), `Missing fifth revision provenance: ${path}`)
    return pin
  })
  const measurements = JSON.parse(await readLocal(root, FIFTH_FILES[3]))
  const eruption = batch.moves.find(move => move.id === 'eruption')
  assert(measurements.sourceSha256 === eruption.asset.sha256 && measurements.pcmSha256 === eruption.asset.decoded.pcmSha256, 'Eruption timing measurements have stale source provenance')
  const moves = await Promise.all(batch.moves.map(async (move, index) => {
    const change = config.moves[index], originalVisual = move.visual
    assert(change.plan && Array.isArray(change.notes) && change.notes.length > 0 && change.notes.every(note => typeof note === 'string' && note.length <= 1200), 'Invalid fifth revision plan or notes')
    let visual = originalVisual, visualAccent
    const path = `packages/battle-fx/src/review-batch-five/${move.fxId}.js`, pin = pins.find(pin => pin.path === path)
    if (pin) {
      const { timing } = await import(`${pathToFileURL(resolve(root, path)).href}?revision=${pin.sha256}`)
      assert(Number.isFinite(timing.contact) && timing.contact > 0 && Number.isFinite(timing.duration) && timing.duration > timing.contact, 'Invalid revised move timing')
      const markers = [{ id: 'impact', label: 'Result impact cue', timeSeconds: timing.contact }, ...(timing.markers ?? [])]
      assert(new Set(markers.map(marker => marker.id)).size === markers.length && markers.every(marker => typeof marker.label === 'string' && Number.isFinite(marker.timeSeconds) && marker.timeSeconds >= 0 && marker.timeSeconds <= timing.duration), 'Invalid revised move markers')
      const revision = hash({ original: originalVisual.visualRevision, pin, transport: pins.filter(pin => /batchFive(Visual|Audio)\.js$/.test(pin.path)) })
      visual = { durationSeconds: timing.duration, visualRevision: revision, markers }
      visualAccent = { id: `batch-five-${move.id}-v1`, revision }
    }
    const candidate = structuredClone(change.plan)
    assert(candidate.segments.length === 1 && candidate.segments[0].gainDb === move.candidate.segments[0].gainDb, 'Fifth revision must retain native recording gain and one region')
    const native = batch.feedbackRecords[index].native
    assert(native, 'Fifth revision requires captured native bounds')
    for (const reference of [native, move.asset.decoded]) {
      const regions = planSyncAudition(candidate, reference, visual)
      assert(regions.every(region => region.delaySeconds + region.endSeconds - region.startSeconds <= visual.durationSeconds / candidate.visualRate + 1e-9), 'Revised sound must finish by visual completion')
    }
    if (move.id === 'eruption') {
      const segment = candidate.segments[0]
      assert(segment.startSeconds === measurements.sourceRegion.startSeconds && segment.endSeconds === measurements.sourceRegion.endSeconds && measurements.measurements.some(row => row.time === segment.soundAnchorSeconds), 'Eruption edit differs from measured later section')
    }
    return { ...move, candidate, visual, ...(visualAccent ? { visualAccent } : {}), originalVisual,
      notes: change.notes, previousReview: { ...move.previousReview, changed: true } }
  }))
  const feedbackRecords = moves.map((move, index) => ({ moveId: move.id, plan: move.candidate, verdict: 'unreviewed', notes: batch.feedbackRecords[index].notes,
    native: batch.feedbackRecords[index].native, ...(move.visualAccent ? { visualAccent: { id: move.visualAccent.id, revision: move.visualAccent.revision } } : {}) }))
  return { ...batch, moves, feedbackRecords, defaultMoveId: 'fireblast',
    revision: hash({ reviewed: batch.revision, config, pins, moves }), reviewPlayback: 'batch-five-feedback-v1' }
}
