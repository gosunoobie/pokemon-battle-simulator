import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual as equal } from 'node:util'
import { assert, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { planSyncAudition } from '../../apps/sfx-bench/src/sync.js'

export const FIFTH_FOURTH_FILES = Object.freeze([
  'tools/audio-import/review/sync-batch-005.chat-review-04.json',
  'tools/audio-import/review/sync-batch-005.manifest-04.json',
  'tools/audio-import/sync-fifth-fourth-revision.mjs',
  'apps/sfx-bench/src/batchFiveVisualV4.js',
  'packages/battle-fx/src/review-batch-five-v4/eruption.js',
  'packages/battle-fx/src/review-batch-five-v4/blizzard.js',
])
const hash = value => sha256(Buffer.from(JSON.stringify(value)))
const CHANGED = ['eruption', 'blizzard']
const requestNotes = {
  eruption: 'the sizes of the spree balls should be double the size',
  blizzard: 'the large crystal should be half the size and should not appear immediately they should be positioned vertically and should be 20% the final size and  first grow in size and disappear.',
  keep: 'Every move on batch 5 looks good now',
}
const proposalNotes = {
  eruption: ['The continuous volley keeps its reviewed rhythm, with every lava ball twice as wide and tall. The larger contours have enough clearance to stay inside the battlefield.'],
  blizzard: ['The seven large crystals are half their previous final size. At each contact point, an upright crystal appears at 20% of that new size, grows gradually, then fades away on the existing beat.'],
}

/** Direct chat approval is kept as chat evidence, never disguised as a browser export. */
export async function reviseFifthBatchFourth({ root, batch, revisionPins }) {
  const [chatBytes, manifestBytes] = await Promise.all(FIFTH_FOURTH_FILES.slice(0, 2).map(path => readLocal(root, path)))
  const chat = JSON.parse(chatBytes), prior = JSON.parse(manifestBytes)
  assert(chat.schemaVersion === 1 && chat.kind === 'battle-sfx-chat-review' && chat.batchId === batch.id && batch.id === 'sync-005', 'Invalid fourth fifth-batch chat review')
  assert(chat.manifestPath === FIFTH_FOURTH_FILES[1] && chat.manifestSha256 === sha256(manifestBytes) && chat.reviewedRevision === prior.revision, 'Fourth reviewed proposal changed')
  assert(equal(prior.moves.map(move => move.id), batch.moves.map(move => move.id)), 'Fourth review must retain the ten reviewed moves')
  assert(equal(chat.changedMoveIds, CHANGED) && equal(chat.keptMoveIds, batch.moves.filter(move => !CHANGED.includes(move.id)).map(move => move.id)), 'Fourth review must preserve the eight chat approvals')
  assert(Object.values(requestNotes).every(note => chat.message.includes(note)), 'Fourth review no longer matches the exact chat request')
  for (const pin of chat.playbackPins)
    assert(equal(revisionPins.find(current => current.path === pin.path), pin), `Previously reviewed playback changed: ${pin.path}`)
  const pins = FIFTH_FOURTH_FILES.map(path => {
    const pin = revisionPins.find(pin => pin.path === path)
    assert(pin && /^[a-f0-9]{64}$/.test(pin.sha256), `Missing fourth fifth-batch provenance: ${path}`)
    return pin
  })
  const moves = await Promise.all(batch.moves.map(async (move, index) => {
    const previous = prior.moves[index], changed = CHANGED.includes(move.id)
    for (const field of ['id', 'fxId', 'asset', 'visual', 'visualAccent', 'candidate', 'originalVisual', 'baseline'])
      assert(equal(move[field], previous[field]), `Previously reviewed move changed: ${move.id}/${field}`)
    let visual = previous.visual, visualAccent = previous.visualAccent
    if (changed) {
      const path = `packages/battle-fx/src/review-batch-five-v4/${move.fxId}.js`, pin = pins.find(pin => pin.path === path)
      const { timing } = await import(`${pathToFileURL(resolve(root, path)).href}?revision=${pin.sha256}`)
      assert(timing.contact === previous.visual.markers.find(marker => marker.id === 'impact').timeSeconds && timing.duration === previous.visual.durationSeconds, 'Fourth revision must retain reviewed impact and duration')
      const markers = [{ id: 'impact', label: 'Result impact cue', timeSeconds: timing.contact }, ...(timing.markers ?? [])]
      assert(new Set(markers.map(marker => marker.id)).size === markers.length && markers.every(marker => typeof marker.label === 'string' && Number.isFinite(marker.timeSeconds) && marker.timeSeconds >= 0 && marker.timeSeconds <= timing.duration), 'Invalid fourth revised markers')
      const revision = hash({ previous: previous.visual.visualRevision, pin, factory: pins.find(pin => pin.path.endsWith('batchFiveVisualV4.js')), playback: chat.playbackPins })
      visual = { durationSeconds: timing.duration, visualRevision: revision, markers }
      visualAccent = { id: `batch-five-${move.id}-v4`, revision }
    }
    const native = prior.feedbackRecords[index].native
    assert(native, 'Fourth review requires the existing native sound bounds')
    for (const reference of [native, move.asset.decoded]) {
      const regions = planSyncAudition(move.candidate, reference, visual)
      assert(regions.every(region => region.delaySeconds + region.endSeconds - region.startSeconds <= visual.durationSeconds / move.candidate.visualRate + 1e-9), 'Fourth revised sound outlasts visual')
    }
    return { ...move, visual, ...(visualAccent ? { visualAccent } : {}), notes: proposalNotes[move.id] ?? previous.notes,
      previousVisual: previous.visual, previousVisualAccent: previous.visualAccent ?? null, previousPlayback: prior.reviewPlayback,
      previousReview: { verdict: changed ? 'adjust-animation' : 'keep', notes: requestNotes[move.id] ?? requestNotes.keep,
        plan: previous.candidate, changed, revision: prior.revision, source: 'chat' } }
  }))
  const feedbackRecords = moves.map((move, index) => ({ moveId: move.id, plan: move.candidate, verdict: move.previousReview.changed ? 'unreviewed' : 'keep',
    notes: move.previousReview.notes, native: prior.feedbackRecords[index].native, ...(move.visualAccent ? { visualAccent: move.visualAccent } : {}) }))
  return { ...batch, moves, feedbackRecords, defaultMoveId: 'eruption', reviewPlayback: 'batch-five-feedback-v4',
    revision: hash({ reviewed: prior.revision, chat, pins, moves }) }
}
