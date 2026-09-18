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
import { timing } from '../packages/battle-fx/src/review-batch-five-v3/earthquake.js'

const read = path => readFile(new URL(`../${path}`, import.meta.url))
const feedbackBytes = await read('tools/audio-import/review/sync-batch-005.feedback-03.json')
const feedback = JSON.parse(feedbackBytes)
const priorBytes = await read('tools/audio-import/review/sync-batch-005.manifest-03.json')
const prior = JSON.parse(priorBytes)
const capture = JSON.parse(await read('tools/audio-import/review/sync-batch-005.review-03.json'))
const batch = JSON.parse(await read('tools/audio-import/review/sync-batch-005.manifest-04.json'))
const changed = ['fireblast', 'earthquake', 'thunder', 'blizzard']
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const tick = () => new Promise(resolve => setImmediate(resolve))

test('third review carries six exact approvals and changes only the four requested animations', async () => {
  assert.equal(capture.source.sha256, hash(feedbackBytes))
  assert.equal(capture.manifestSha256, hash(priorBytes))
  assert.equal(feedback.revision, prior.revision)
  assert.equal(batch.reviewPlayback, 'batch-five-feedback-v3')
  assert.notEqual(batch.revision, prior.revision)
  for (const pin of capture.playbackPins) assert.equal(hash(await read(pin.path)), pin.sha256)
  for (const [index, move] of batch.moves.entries()) {
    const record = feedback.records[index], old = prior.moves[index], kept = !changed.includes(move.id)
    assert.equal(batch.feedbackRecords[index].verdict, kept ? 'keep' : 'unreviewed')
    assert.equal(batch.feedbackRecords[index].notes, record.notes)
    assert.deepEqual(batch.feedbackRecords[index].native, record.native)
    assert.deepEqual(move.previousReview, { verdict: record.verdict, notes: record.notes, plan: record.plan, changed: !kept, revision: feedback.revision })
    assert.deepEqual(move.previousVisual, old.visual)
    assert.deepEqual(move.previousVisualAccent, old.visualAccent ?? null)
    assert.equal(move.previousPlayback, 'batch-five-feedback-v2')
    assert.deepEqual(move.originalVisual, old.originalVisual)
    assert.deepEqual(move.asset, old.asset)
    assert.deepEqual(move.baseline, old.baseline)
    if (kept) {
      assert.deepEqual(move.visual, old.visual)
      assert.deepEqual(move.visualAccent, old.visualAccent)
      assert.equal(BATCH_FIVE_V3_EFFECTS[move.fxId], BATCH_FIVE_V2_EFFECTS[move.fxId])
    } else assert.equal(move.visualAccent.id, `batch-five-${move.id}-v3`)
    const expected = structuredClone(record.plan)
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
    const factory = !accent ? createBattleFx : accent.id.endsWith('-v3') ? createBatchFiveV3Fx : accent.id.endsWith('-v2') ? createBatchFiveV2Fx : createBatchFiveFx
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

test('Earthquake keeps horizontal ground ellipses and the original sloped fault and matte debris through its aftershocks', async () => {
  const move = batch.moves.find(m => m.id === 'earthquake')
  const drawing = node => node.context.instructions.map(instruction => instruction.data.path?.instructions)
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} differs from ${b}`)
  for (const portrait of [false, true]) for (const sourceId of ['source', 'target']) {
    const h = harness(createBatchFiveV3Fx, sourceId, portrait), old = harness(createBatchFiveV2Fx, sourceId, portrait)
    try {
      const run = h.visual.play(move, { scene: h.scene, sourceId, visualRate: .75 })
      const previous = old.visual.play({ ...move, visual: move.previousVisual }, { scene: old.scene, sourceId, visualRate: .75 })
      await tick()
      let seen = 0
      for (let t = .02; t < timing.duration - .01; t += .027) {
        h.timelines[0].time(t, false); old.timelines[0].time(t, false); seen += bounds(h)
        for (let i = 0; i < 10; i++) {
          const ring = h.node(`earthquake-v3-wave-${i}`)
          if (!ring.context.instructions.length) continue
          const points = drawing(ring)[0]
          close(points[0].data[1], points[32].data[1])
          close(points[16].data[0], points[48].data[0])
        }
        assert.deepEqual(drawing(h.node('earthquake-v3-fault')), drawing(old.node('earthquake-v2-fault')))
        for (const suffix of ['pebble-0-4', 'pebble-2-9', 'dust-1-4', 'dust-5-6']) {
          const a = h.node(`earthquake-v3-${suffix}`), b = old.node(`earthquake-v2-${suffix}`)
          for (const key of ['x', 'y', 'width', 'height', 'rotation', 'alpha', 'tint', 'blendMode']) assert.equal(a[key], b[key])
        }
      }
      assert.ok(seen > 100)
      run.cancel(); previous.cancel(); await Promise.all([run.finished, previous.finished]); h.clean(); old.clean()
      const final = h.visual.play(move, { scene: h.scene, sourceId, visualRate: .75 }); await tick()
      h.timelines.at(-1).time(timing.duration, false); assert.equal((await final.finished).status, 'completed'); h.clean()
    } finally { h.dispose(); old.dispose() }
  }
})
