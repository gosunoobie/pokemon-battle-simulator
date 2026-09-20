import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'
import { createBatchSevenFx, BATCH_SEVEN_EFFECTS } from '../apps/sfx-bench/src/batchSevenVisual.js'
import { createSyncBatchManifest } from '../tools/audio-import/sync-batch.mjs'
import { planSyncAudition } from '../apps/sfx-bench/src/sync.js'

const read = path => readFile(new URL(`../${path}`, import.meta.url))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const batch = await createSyncBatchManifest({ batch: 'sync-007', historical: true })
const expected = ['sing', 'grasswhistle', 'attract', 'morningsun', 'moonlight', 'confuseray']
const durations = [4.19, 3.44, 6.01, 4.57, 5.57, 3.18]
const tick = () => new Promise(resolve => setImmediate(resolve))

test('Batch 7 extends only the six requested visuals while retaining every complete original sound and all accepted Batch 6 versions', async () => {
  assert.equal(batch.status, 'unreviewed-comparison'); assert.equal(batch.defaultMoveId, 'sing')
  assert.equal(batch.reviewPlayback, 'batch-seven-v1'); assert.deepEqual(batch.moves.map(move => move.id), expected)
  assert.equal(batch.feedbackRecords, undefined); assert.equal(batch.approval, undefined)
  const originals = JSON.parse(await read('tools/audio-import/review/sync-batch-007.originals.json'))
  for (const pin of originals.playbackPins) assert.equal(hash(await read(pin.path)), pin.sha256)
  for (const [index, move] of batch.moves.entries()) {
    assert.equal(move.visualAccent.id, `batch-seven-${move.id}-v1`)
    assert.equal(move.visual.durationSeconds, durations[index])
    assert.equal(move.originalVisual.durationSeconds, MOVE_EFFECTS[move.fxId].duration)
    assert.equal(move.visual.markers.find(marker => marker.id === 'impact').timeSeconds, MOVE_EFFECTS[move.fxId].contact)
    assert.equal(move.candidate.visualRate, 1); assert.equal(move.candidate.segments.length, 1)
    assert.equal(move.candidate.segments[0].endSeconds, null)
    assert.equal(move.candidate.segments[0].gainDb, 0)
    const current = planSyncAudition(move.baseline, move.asset.decoded, move.originalVisual)
    const proposed = planSyncAudition(move.candidate, move.asset.decoded, move.visual)
    assert.deepEqual(proposed, current, `${move.id} keeps its complete original audio playback`)
    assert.equal(proposed[0].delaySeconds, 0)
    assert.ok(proposed[0].endSeconds <= move.visual.durationSeconds)
    assert.ok(move.visual.durationSeconds - proposed[0].endSeconds <= .011)
    assert.notEqual(BATCH_SEVEN_EFFECTS[move.fxId].build, MOVE_EFFECTS[move.fxId].build)
    assert.equal(BATCH_SEVEN_EFFECTS[move.fxId].subject, MOVE_EFFECTS[move.fxId].subject)
  }
  for (const [id, original] of Object.entries(MOVE_EFFECTS)) {
    if (!batch.moves.some(move => move.fxId === id)) assert.equal(BATCH_SEVEN_EFFECTS[id], original)
  }
  const accepted = await createSyncBatchManifest({ batch: 'sync-006' })
  const reviewed = JSON.parse(await read('tools/audio-import/review/sync-batch-006.manifest-02.json'))
  assert.equal(accepted.status, 'accepted')
  for (const [index, move] of accepted.moves.entries()) {
    assert.deepEqual(move.visual, reviewed.moves[index].visual)
    assert.deepEqual(move.visualAccent, reviewed.moves[index].visualAccent)
    assert.deepEqual(move.plan, reviewed.moves[index].candidate)
  }
})

test('original and extended comparisons play all six declared clocks from either side and clean up after completion or cancellation', async () => {
  for (const move of batch.moves) for (const original of [false, true]) for (const sourceId of ['source', 'target']) {
    const scene = createSceneGraph(), timelines = [], cues = []
    const factory = original ? createBattleFx : createBatchSevenFx
    const visual = createSyncVisualAuditioner({ createFx: options => factory({ ...options, glowTexture: Texture.WHITE }),
      timelineEngine: { timeline(options) { const tl = gsap.timeline({ ...options, paused: true }); tl.play = () => tl; timelines.push(tl); return tl } },
    })
    const metadata = original ? move.originalVisual : move.visual
    const play = () => visual.play({ ...move, visual: metadata }, { scene, sourceId, visualRate: 1,
      onMarker(marker) { if (marker.origin === 'observed-result-cue') cues.push(marker) },
    })
    const clean = () => {
      assert.equal(scene.effects.children.length, 0); assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
      for (const actor of scene.actors.values()) {
        assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
        assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.tint, 0xffffff)
      }
    }
    try {
      const run = play(); await tick(); const tl = timelines[0]
      assert.equal(tl.duration(), metadata.durationSeconds)
      const contact = metadata.markers.find(marker => marker.id === 'impact').timeSeconds
      tl.time(contact - .0001, false); assert.equal(cues.length, 0)
      tl.time(contact, false); assert.equal(cues.length, 1)
      tl.time(metadata.durationSeconds, false); assert.equal((await run.finished).status, 'completed'); clean()
      assert.equal(cues.length, 1)
      const cancelled = play(); await tick(); timelines[1].time(metadata.durationSeconds * .85, false)
      visual.stop(); assert.equal((await cancelled.finished).status, 'cancelled'); clean()
    } finally { visual.dispose(); scene.dispose(); gsap.ticker.sleep() }
  }
})
