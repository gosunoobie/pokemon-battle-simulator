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
import { ERUPTION_ARRIVALS, ERUPTION_VOLLEY_ARRIVALS, timing } from '../packages/battle-fx/src/review-batch-five-v2/eruption.js'

const read = path => readFile(new URL(`../${path}`, import.meta.url))
const feedbackBytes = await read('tools/audio-import/review/sync-batch-005.feedback-02.json')
const feedback = JSON.parse(feedbackBytes)
const priorBytes = await read('tools/audio-import/review/sync-batch-005.manifest-02.json')
const prior = JSON.parse(priorBytes)
const capture = JSON.parse(await read('tools/audio-import/review/sync-batch-005.review-02.json'))
const batch = JSON.parse(await read('tools/audio-import/review/sync-batch-005.manifest-03.json'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const tick = () => new Promise(resolve => setImmediate(resolve))

test('second review keeps Solar Beam approval and preserves the exact prior ten sound and visual proposals', async () => {
  assert.equal(capture.source.sha256, hash(feedbackBytes))
  assert.equal(capture.manifestSha256, hash(priorBytes))
  assert.equal(feedback.revision, prior.revision)
  assert.equal(batch.reviewPlayback, 'batch-five-feedback-v2')
  assert.notEqual(batch.revision, prior.revision)
  for (const pin of capture.playbackPins) assert.equal(hash(await read(pin.path)), pin.sha256)
  for (const [index, move] of batch.moves.entries()) {
    const record = feedback.records[index], old = prior.moves[index], kept = move.id === 'solarbeam'
    assert.equal(batch.feedbackRecords[index].verdict, kept ? 'keep' : 'unreviewed')
    assert.equal(batch.feedbackRecords[index].notes, record.notes)
    assert.deepEqual(batch.feedbackRecords[index].native, record.native)
    assert.deepEqual(move.previousReview, { verdict: record.verdict, notes: record.notes, plan: record.plan, changed: !kept, revision: feedback.revision })
    assert.deepEqual(move.previousVisual, old.visual)
    assert.deepEqual(move.previousVisualAccent, old.visualAccent ?? null)
    assert.equal(move.previousPlayback, 'batch-five-feedback-v1')
    assert.deepEqual(move.originalVisual, old.originalVisual)
    assert.deepEqual(move.asset, old.asset)
    assert.deepEqual(move.baseline, old.baseline)
    if (kept) {
      assert.deepEqual(move.visual, old.visual)
      assert.deepEqual(move.visualAccent, old.visualAccent)
      assert.equal(BATCH_FIVE_V2_EFFECTS[move.fxId], BATCH_FIVE_EFFECTS[move.fxId])
    } else if (move.id !== 'razorleaf') assert.equal(move.visualAccent.id, `batch-five-${move.id}-v2`)
    const expected = structuredClone(record.plan)
    if (move.id === 'razorleaf') expected.segments[0].endSeconds = 1.67
    assert.deepEqual(move.candidate, expected)
    for (const native of [record.native, move.asset.decoded]) {
      const [region] = planSyncAudition(move.candidate, native, move.visual)
      assert.ok(region.delaySeconds + region.endSeconds - region.startSeconds <= move.visual.durationSeconds / move.candidate.visualRate + 1e-9)
      assert.ok(planSyncAudition(move.previousReview.plan, native, move.previousVisual).length)
    }
  }
  const cut = JSON.parse(await read('tools/audio-import/review/sync-batch-005.razor-leaf-measurements-02.json'))
  assert.ok(cut.quietGap.peak < .001)
  assert.ok(cut.cutSeconds < cut.finalImpactOnset.timeSeconds)
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
    const factory = !accent ? createBattleFx : accent.id.endsWith('-v2') ? createBatchFiveV2Fx : createBatchFiveFx
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

function bounds(h) {
  let seen = 0
  const walk = (node, parentAlpha = 1) => {
    const alpha = parentAlpha * node.alpha
    if (alpha > .02 && ['Sprite', 'Graphics'].includes(node.constructor.name)) {
      const b = node.getBounds()
      if (b.width && b.height) {
        assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
          `${node.label}: ${JSON.stringify(b)}`)
        seen++
      }
    }
    for (const child of node.children ?? []) walk(child, alpha)
  }
  walk(h.scene.effects)
  return seen
}

test('Eruption maintains several moving balls between sound crests, with denser clusters and bounded gravity', async () => {
  const move = batch.moves.find(m => m.id === 'eruption')
  assert.ok(ERUPTION_VOLLEY_ARRIVALS.length >= 35)
  for (const crest of ERUPTION_ARRIVALS) assert.ok(ERUPTION_VOLLEY_ARRIVALS.filter(t => t >= crest - 1e-6 && t <= crest + .091).length >= 3)
  for (const portrait of [false, true]) for (const sourceId of ['source', 'target']) {
    const h = harness(createBatchFiveV2Fx, sourceId, portrait)
    try {
      const run = h.visual.play(move, { scene: h.scene, sourceId, visualRate: 1 }); await tick()
      const tl = h.timelines[0]
      let seen = 0
      for (let t = .02; t < timing.duration - .01; t += .027) {
        tl.time(t, false); seen += bounds(h)
        if (t > .65 && t < 3.5) {
          const visible = ERUPTION_VOLLEY_ARRIVALS.filter((_, i) => h.node(`eruption-review-lava-${i + 1}`).alpha > .1)
          assert.ok(visible.length >= 3, `continuous volley at ${t}: ${visible.length}`)
        }
      }
      assert.ok(seen > 1000)
      run.cancel(); assert.equal((await run.finished).status, 'cancelled'); h.clean()
      const restart = h.visual.play(move, { scene: h.scene, sourceId, visualRate: 1 }); await tick()
      h.timelines.at(-1).time(2.2, false); restart.cancel(); await restart.finished; h.clean()
    } finally { h.dispose() }
  }
})
