import { isDeepStrictEqual as equal } from 'node:util'
import { BENCH_ROOT } from './bench.mjs'
import { assert, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { normalizeSyncFeedback } from '../../apps/sfx-bench/src/syncFeedback.js'
import { planSyncAudition } from '../../apps/sfx-bench/src/sync.js'

export const ROLLOUT_APPROVAL = 'tools/audio-import/review/sync-rollout-001.approval.json'
export const ROLLOUT_IDS = Object.freeze({
  'sync-004': ['ember', 'waterfall', 'dragonclaw', 'ancientpower', 'shadowpunch', 'swordsdance'],
  'sync-005': ['fireblast', 'solarbeam', 'razorleaf', 'sludgebomb', 'overheat', 'eruption', 'earthquake', 'thunder', 'blizzard', 'bubblebeam'],
  'sync-006': ['leafblade', 'triattack', 'meteormash', 'ancientpower', 'sacredfire'],
  'sync-007': ['sing', 'grasswhistle', 'attract', 'morningsun', 'moonlight', 'confuseray'],
})

const PLAYBACK_FILES = Object.freeze([
  "apps/sfx-bench/src/audio.js",
  "apps/sfx-bench/src/batchFiveAudio.js",
  "apps/sfx-bench/src/batchFiveVisual.js",
  "apps/sfx-bench/src/batchFiveVisualV2.js",
  "apps/sfx-bench/src/batchFiveVisualV3.js",
  "apps/sfx-bench/src/batchFiveVisualV4.js",
  "apps/sfx-bench/src/batchSevenVisual.js",
  "apps/sfx-bench/src/batchSixVisual.js",
  "apps/sfx-bench/src/batchSixVisualV2.js",
  "apps/sfx-bench/src/sync.js",
  "apps/sfx-bench/src/syncFeedback.js",
  "apps/sfx-bench/src/syncVisual.js",
  "packages/battle-fx/assets/rock.svg",
  "packages/battle-fx/src/assets.js",
  "packages/battle-fx/src/moves/restored/ancient-power.js",
  "packages/battle-fx/src/moves/restored/attract.js",
  "packages/battle-fx/src/moves/restored/blizzard.js",
  "packages/battle-fx/src/moves/restored/bubble-beam.js",
  "packages/battle-fx/src/moves/restored/confuse-ray.js",
  "packages/battle-fx/src/moves/restored/dragon-claw.js",
  "packages/battle-fx/src/moves/restored/earthquake.js",
  "packages/battle-fx/src/moves/restored/ember.js",
  "packages/battle-fx/src/moves/restored/eruption.js",
  "packages/battle-fx/src/moves/restored/fire-blast.js",
  "packages/battle-fx/src/moves/restored/grass-whistle.js",
  "packages/battle-fx/src/moves/restored/leaf-blade.js",
  "packages/battle-fx/src/moves/restored/meteor-mash.js",
  "packages/battle-fx/src/moves/restored/moonlight.js",
  "packages/battle-fx/src/moves/restored/morning-sun.js",
  "packages/battle-fx/src/moves/restored/overheat.js",
  "packages/battle-fx/src/moves/restored/razor-leaf.js",
  "packages/battle-fx/src/moves/restored/sacred-fire.js",
  "packages/battle-fx/src/moves/restored/shadow-punch.js",
  "packages/battle-fx/src/moves/restored/sing.js",
  "packages/battle-fx/src/moves/restored/sludge-bomb.js",
  "packages/battle-fx/src/moves/restored/solar-beam.js",
  "packages/battle-fx/src/moves/restored/swords-dance.js",
  "packages/battle-fx/src/moves/restored/thunder.js",
  "packages/battle-fx/src/moves/restored/tri-attack.js",
  "packages/battle-fx/src/moves/restored/waterfall.js",
  "packages/battle-fx/src/review-batch-five-v2/blizzard.js",
  "packages/battle-fx/src/review-batch-five-v2/bubble-beam.js",
  "packages/battle-fx/src/review-batch-five-v2/earthquake.js",
  "packages/battle-fx/src/review-batch-five-v2/eruption.js",
  "packages/battle-fx/src/review-batch-five-v2/fire-blast.js",
  "packages/battle-fx/src/review-batch-five-v2/overheat.js",
  "packages/battle-fx/src/review-batch-five-v2/sludge-bomb.js",
  "packages/battle-fx/src/review-batch-five-v2/thunder.js",
  "packages/battle-fx/src/review-batch-five-v3/blizzard.js",
  "packages/battle-fx/src/review-batch-five-v3/earthquake.js",
  "packages/battle-fx/src/review-batch-five-v3/fire-blast.js",
  "packages/battle-fx/src/review-batch-five-v3/thunder.js",
  "packages/battle-fx/src/review-batch-five-v4/blizzard.js",
  "packages/battle-fx/src/review-batch-five-v4/eruption.js",
  "packages/battle-fx/src/review-batch-five/blizzard.js",
  "packages/battle-fx/src/review-batch-five/eruption.js",
  "packages/battle-fx/src/review-batch-five/fire-blast.js",
  "packages/battle-fx/src/review-batch-five/solar-beam.js",
  "packages/battle-fx/src/review-batch-five/thunder.js",
  "packages/battle-fx/src/review-batch-seven/attract.js",
  "packages/battle-fx/src/review-batch-seven/confuse-ray.js",
  "packages/battle-fx/src/review-batch-seven/grass-whistle.js",
  "packages/battle-fx/src/review-batch-seven/moonlight.js",
  "packages/battle-fx/src/review-batch-seven/morning-sun.js",
  "packages/battle-fx/src/review-batch-seven/sing.js",
  "packages/battle-fx/src/review-batch-six-v2/ancient-power.js",
  "packages/battle-fx/src/review-batch-six-v2/leaf-blade.js",
  "packages/battle-fx/src/review-batch-six-v2/sacred-fire.js",
  "packages/battle-fx/src/review-batch-six/ancient-power.js",
  "packages/battle-fx/src/review-batch-six/leaf-blade.js",
  "packages/battle-fx/src/review-batch-six/meteor-mash.js",
  "packages/battle-fx/src/review-batch-six/sacred-fire.js",
  "packages/battle-fx/src/review-batch-six/tri-attack.js"
])

/** The rollout approves the latest snapshots, including the two final Batch 5
 * corrections. Historical browser verdicts remain unchanged in those snapshots. */
export async function readApprovedRollout({ root = BENCH_ROOT } = {}) {
  const approvalBytes = await readLocal(root, ROLLOUT_APPROVAL), final = JSON.parse(approvalBytes)
  assert(final.schemaVersion === 1 && final.kind === 'battle-sfx-approved-rollout'
    && final.approval?.source === 'user-message' && final.approval.text?.trim()
    && /^\d{4}-\d{2}-\d{2}$/.test(final.approval.date), 'Rollout requires explicit user approval')
  assert(equal(final.batches.map(batch => batch.id), Object.keys(ROLLOUT_IDS)), 'Rollout batch selection changed')
  assert(equal(final.supersedes, [{ moveId: 'ancientpower', previousBatch: 'sync-004', selectedBatch: 'sync-006' }]), 'Unexpected rollout supersession')
  assert(Array.isArray(final.playbackPins) && equal(final.playbackPins.map(pin => pin.path), PLAYBACK_FILES), 'Incomplete rollout playback evidence')
  for (const pin of final.playbackPins) assert(sha256(await readLocal(root, pin.path)) === pin.sha256, `Approved playback changed: ${pin.path}`)
  const feedbackBytes = await readLocal(root, final.feedback.path)
  assert(sha256(feedbackBytes) === final.feedback.sha256, 'Batch 7 captured feedback changed')
  const feedback = JSON.parse(feedbackBytes), batches = []
  for (const entry of final.batches) {
    const bytes = await readLocal(root, entry.manifest.path)
    assert(sha256(bytes) === entry.manifest.sha256, `Approved manifest changed: ${entry.id}`)
    const snapshot = JSON.parse(bytes)
    assert(snapshot.id === entry.id && snapshot.revision === entry.reviewedRevision
      && equal(snapshot.moves.map(move => move.id), ROLLOUT_IDS[entry.id]), 'Approved batch identity changed')
    if (entry.id === 'sync-007') {
      assert(feedback.revision === snapshot.revision && equal(normalizeSyncFeedback(feedback, snapshot), feedback)
        && feedback.records.every(record => record.verdict === 'keep'), 'Batch 7 requires its exact captured keep decisions')
    }
    const moves = snapshot.moves.map(move => {
      const record = entry.id === 'sync-007' ? feedback.records.find(record => record.moveId === move.id)
        : snapshot.feedbackRecords?.find(record => record.moveId === move.id)
      const plan = move.plan ?? move.candidate, native = move.native ?? record?.native
      assert(native && (!record || equal(record.plan, plan)), `Missing reviewed native plan: ${move.id}`)
      if (record && entry.id === 'sync-007') assert(equal(record.visualAccent, move.visualAccent), 'Batch 7 visual feedback mismatch')
      for (const measurement of [native, move.asset.decoded]) planSyncAudition(plan, measurement, move.visual)
      const { id, fxId, name, asset, visual, visualAccent, notes } = move
      return structuredClone({ id, fxId, name, asset, visual, ...(visualAccent ? { visualAccent } : {}), notes, plan, native })
    })
    batches.push({ schemaVersion: 1, id: entry.id, title: `Batch ${Number(entry.id.slice(-3))} · Accepted final versions`,
      status: 'accepted', revision: sha256(Buffer.concat([approvalBytes, bytes])), reviewedRevision: snapshot.revision,
      approval: structuredClone(final.approval), ...(snapshot.reviewPlayback ? { reviewPlayback: snapshot.reviewPlayback } : {}), moves })
  }
  return { final, approvalBytes, batches }
}

export function compileRolloutRuntime({ rollout, manifest }) {
  return rollout.batches.map(batch => {
    const moves = {}, fxMoves = {}, assets = {}
    for (const move of batch.moves) {
      const asset = manifest.assets[move.asset.id]
      const subject = manifest.subjects.find(row => row.kind === 'move' && row.phase === 'attack' && row.id === move.id)
      assert(subject?.fxId === move.fxId && subject.assetIds.includes(move.asset.id), `Unknown rollout mapping: ${move.id}`)
      assert(asset && asset.sha256 === move.asset.sha256 && asset.bytes === move.asset.bytes
        && equal(asset.decoded, move.asset.decoded), `Rollout source/PCM changed: ${move.id}`)
      const native = move.native, chrome = /\bChrome\/(\d+\.\d+\.\d+\.\d+)/.exec(native.userAgent)
      assert(chrome && !/Edg\/|OPR\//.test(native.userAgent), 'Rollout requires its measured Chrome decoder')
      assert(Math.abs(native.durationSeconds - asset.decoded.sampleFrames / asset.decoded.sampleRate) <= .1, 'Rollout native duration differs from source')
      const regions = planSyncAudition(move.plan, native, move.visual)
      assert(regions.every(region => region.gainDb <= 0 && region.delaySeconds + region.endSeconds - region.startSeconds <= 120), 'Accepted sounds must remain bounded and attenuation-only')
      const { sampleRate, sampleFrames, channels, peak } = asset.decoded
      assets[asset.id] = { id: asset.id, file: `${asset.sha256}.mp3`, bytes: asset.bytes, sha256: asset.sha256,
        mime: 'audio/mpeg', reference: { sampleRate, sampleFrames, channels, peak } }
      moves[move.id] = { moveId: move.id, fxId: move.fxId, phase: 'attack', assetId: asset.id,
        reviewStatus: 'accepted-sync', visualRevision: move.visual.visualRevision,
        visualRate: move.plan.visualRate, segments: structuredClone(move.plan.segments), playbackRate: 1,
        visualDurationSeconds: move.visual.durationSeconds,
        nativeCompatibility: { browser: 'Chrome', version: chrome[1], sampleRate: native.sampleRate, sampleFrames: native.sampleFrames },
        ...(move.visualAccent ? { visualAccent: structuredClone(move.visualAccent) } : {}),
        ...(batch.id === 'sync-005' ? { taperEdits: true } : {}) }
      fxMoves[move.fxId] = move.id
    }
    return { provenance: { batchId: batch.id, rolloutApprovalSha256: sha256(rollout.approvalBytes),
      reviewedRevision: batch.reviewedRevision, approvalSource: batch.approval.source, finalizedOn: batch.approval.date }, assets, moves, fxMoves }
  })
}
