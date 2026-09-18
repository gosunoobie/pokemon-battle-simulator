import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'
import { createBatchFiveFx, BATCH_FIVE_EFFECTS } from '../apps/sfx-bench/src/batchFiveVisual.js'
import { createBatchFiveV2Fx, BATCH_FIVE_V2_EFFECTS } from '../apps/sfx-bench/src/batchFiveVisualV2.js'
import { createSyncBatchManifest } from '../tools/audio-import/sync-batch.mjs'
import { planSyncAudition } from '../apps/sfx-bench/src/sync.js'
import { createBatchFiveV3Fx, BATCH_FIVE_V3_EFFECTS } from '../apps/sfx-bench/src/batchFiveVisualV3.js'
import { createBatchFiveV4Fx, BATCH_FIVE_V4_EFFECTS } from '../apps/sfx-bench/src/batchFiveVisualV4.js'

const read = path => readFile(new URL(`../${path}`, import.meta.url))
const priorBytes = await read('tools/audio-import/review/sync-batch-005.manifest-04.json')
const prior = JSON.parse(priorBytes)
const chat = JSON.parse(await read('tools/audio-import/review/sync-batch-005.chat-review-04.json'))
const batch = await createSyncBatchManifest({ batch: 'sync-005' })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const tick = () => new Promise(resolve => setImmediate(resolve))

test('fourth review records chat approval of eight exact proposals and preserves every sound plan', async () => {
  assert.equal(chat.kind, 'battle-sfx-chat-review')
  assert.equal(chat.manifestSha256, hash(priorBytes))
  assert.equal(chat.reviewedRevision, prior.revision)
  assert.equal(batch.reviewPlayback, 'batch-five-feedback-v4')
  assert.equal(batch.defaultMoveId, 'eruption')
  assert.deepEqual(chat.changedMoveIds, ['eruption', 'blizzard'])
  assert.equal(chat.keptMoveIds.length, 8)
  for (const pin of chat.playbackPins) assert.equal(hash(await read(pin.path)), pin.sha256)
  for (const [index, move] of batch.moves.entries()) {
    const old = prior.moves[index], kept = chat.keptMoveIds.includes(move.id)
    assert.equal(batch.feedbackRecords[index].verdict, kept ? 'keep' : 'unreviewed')
    assert.equal(move.previousReview.changed, !kept)
    assert.equal(move.previousReview.verdict, kept ? 'keep' : 'adjust-animation')
    assert.equal(move.previousReview.source, 'chat')
    assert.ok(chat.message.includes(move.previousReview.notes))
    assert.deepEqual(move.candidate, old.candidate)
    assert.deepEqual(move.previousReview.plan, old.candidate)
    assert.deepEqual(move.previousVisual, old.visual)
    assert.deepEqual(move.previousVisualAccent, old.visualAccent ?? null)
    assert.equal(move.previousPlayback, 'batch-five-feedback-v3')
    assert.deepEqual(move.asset, old.asset)
    assert.deepEqual(move.baseline, old.baseline)
    assert.deepEqual(move.originalVisual, old.originalVisual)
    assert.deepEqual(batch.feedbackRecords[index].native, prior.feedbackRecords[index].native)
    if (kept) {
      assert.deepEqual(move.visual, old.visual)
      assert.deepEqual(move.visualAccent, old.visualAccent)
      assert.equal(BATCH_FIVE_V4_EFFECTS[move.fxId], BATCH_FIVE_V3_EFFECTS[move.fxId])
    } else assert.equal(move.visualAccent.id, `batch-five-${move.id}-v4`)
    for (const native of [prior.feedbackRecords[index].native, move.asset.decoded]) {
      const [region] = planSyncAudition(move.candidate, native, move.visual)
      assert.ok(region.delaySeconds + region.endSeconds - region.startSeconds <= move.visual.durationSeconds / move.candidate.visualRate + 1e-9)
      assert.deepEqual(planSyncAudition(move.previousReview.plan, native, move.previousVisual), planSyncAudition(old.candidate, native, old.visual))
    }
  }
})

function harness(createFx, sourceId = 'source', portrait = false) {
  const scene = createSceneGraph(portrait ? { width: 620, height: 650, actors: [
    { id: 'source', profile: 'wide', x: .29, y: .78, height: .2, facing: 1 },
    { id: 'target', profile: 'tall', x: .8, y: .44, height: .2, facing: -1 },
  ] } : {}), timelines = []
  const visual = createSyncVisualAuditioner({ createFx: options => createFx({ ...options, glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE }),
    timelineEngine: { timeline(options) { const tl = gsap.timeline({ ...options, paused: true }); tl.play = () => tl; timelines.push(tl); return tl } },
  })
  const clean = () => {
    assert.equal(scene.effects.children.length, 0)
    assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
    for (const actor of scene.actors.values()) {
      assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
      assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.tint, 0xffffff)
    }
  }
  return { scene, sourceId, visual, timelines, clean, node: label => scene.effects.getChildByLabel(label, true),
    dispose() { visual.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}

test('all ten new and previous proposals play their own durations and single result cues from either side', async () => {
  for (const move of batch.moves) for (const previous of [false, true]) for (const sourceId of ['source', 'target']) {
    const accent = previous ? move.previousVisualAccent : move.visualAccent
    const factory = !accent ? createBattleFx : accent.id.endsWith('-v4') ? createBatchFiveV4Fx : accent.id.endsWith('-v3') ? createBatchFiveV3Fx : accent.id.endsWith('-v2') ? createBatchFiveV2Fx : createBatchFiveFx
    const h = harness(factory, sourceId), cues = []
    const metadata = previous ? move.previousVisual : move.visual
    const plan = previous ? move.previousReview.plan : move.candidate
    try {
      const run = h.visual.play({ ...move, visual: metadata }, { scene: h.scene, sourceId, visualRate: plan.visualRate,
        onMarker(marker) { if (marker.origin === 'observed-result-cue') cues.push(marker) } })
      await tick(); const tl = h.timelines[0]
      assert.equal(tl.duration(), metadata.durationSeconds, `${move.id}/${previous}`)
      const contact = metadata.markers.find(m => m.id === 'impact').timeSeconds
      tl.time(contact - .0001, false); assert.equal(cues.length, 0)
      tl.time(contact, false); assert.equal(cues.length, 1)
      tl.time(metadata.durationSeconds, false)
      assert.equal((await run.finished).status, 'completed'); assert.equal(cues.length, 1); h.clean()
    } finally { h.dispose() }
  }
})

