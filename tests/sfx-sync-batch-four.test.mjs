import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'
import { planSyncAudition } from '../apps/sfx-bench/src/sync.js'
import { createSyncBatchManifest } from '../tools/audio-import/sync-batch.mjs'
import accepted from '../packages/battle-sfx/src/accepted-runtime.generated.js'

const batch = await createSyncBatchManifest({ batch: 'sync-004' })
const definition = JSON.parse(await readFile(new URL('../tools/audio-import/review/sync-batch-004.json', import.meta.url)))
const analysis = JSON.parse(await readFile(new URL('../tools/audio-import/reports/sfx-remaining-analysis.json', import.meta.url)))
const tick = () => new Promise(resolve => setImmediate(resolve))

test('batch four contains six distinct whole-recording comparisons with preserved user feedback with measured timing and preserved gain', () => {
  assert.deepEqual(batch.moves.map(move => move.id), ['ember', 'waterfall', 'dragonclaw', 'ancientpower', 'shadowpunch', 'swordsdance'])
  assert.equal(batch.status, 'unreviewed-comparison')
  assert.equal(batch.feedbackRecords.length, 6)
  assert.ok(batch.feedbackRecords.every(record => record.verdict === 'keep'))
  for (const move of batch.moves) {
    assert.equal(accepted.moves[move.id], undefined)
    for (const field of ['accent', 'visualAccent', 'plan', 'native']) assert.equal(move[field], undefined)
    assert.equal(move.previousReview.changed, false)
    assert.equal(move.previousReview.verdict, 'keep')
    const row = definition.moves.find(row => row.id === move.id)
    const measure = analysis.measurements.find(row => row.assetId === move.asset.id)
    const segment = move.candidate.segments[0], evidence = row.anchorEvidence[0]
    const windows = evidence.kind === 'strongest-energy-window' ? [measure.strongestEnergyWindow] : measure.positiveEnergyRises
    assert.ok(windows.some(window => window.startFrame === evidence.startFrame))
    assert.equal(segment.soundAnchorSeconds, evidence.startFrame / measure.sampleRate)
    assert.equal(segment.startSeconds, 0); assert.equal(segment.endSeconds, null)
    assert.equal(segment.gainDb, move.baseline.segments[0].gainDb)
    for (const sampleRate of [44100, 48000]) {
      const sampleFrames = Math.round(move.asset.decoded.durationSeconds * sampleRate)
      const native = { sampleRate, sampleFrames, durationSeconds: sampleFrames / sampleRate }
      const [region] = planSyncAudition(move.candidate, native, move.visual)
      assert.ok(Math.abs(region.delaySeconds + segment.soundAnchorSeconds - segment.cueSeconds / move.candidate.visualRate) < 1e-9)
      assert.equal(region.endSeconds, native.durationSeconds)
      assert.equal(region.playbackRate, undefined)
      assert.ok(region.delaySeconds >= 0)
      assert.ok(region.delaySeconds + region.endSeconds <= move.visual.durationSeconds / move.candidate.visualRate)
    }
  }
})

test('each new comparison keeps one original impact and restores poses at both proposed perspectives', async () => {
  for (const move of batch.moves) for (const sourceId of ['source', 'target']) for (const cancelled of [false, true]) {
    const scene = createSceneGraph(), timelines = [], cues = []
    const visual = createSyncVisualAuditioner({
      createFx: options => createBattleFx({ ...options, assetLoader: async () => Texture.WHITE, glowTexture: Texture.WHITE }),
      timelineEngine: { timeline(options) {
        const timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline
        timelines.push(timeline); return timeline
      } },
    })
    try {
      const impact = move.visual.markers.find(marker => marker.id === 'impact').timeSeconds
      const handle = visual.play(move, { scene, sourceId, visualRate: move.candidate.visualRate,
        onMarker(marker) { if (marker.origin === 'observed-result-cue') cues.push([marker.id, marker.authoredTimelineSeconds, marker.elapsedSeconds]) } })
      await tick()
      const timeline = timelines[0]
      assert.equal(timeline.timeScale(), move.candidate.visualRate)
      assert.equal(timeline.duration(), move.visual.durationSeconds)
      timeline.time(impact, false)
      assert.deepEqual(cues, [['impact', impact, impact / move.candidate.visualRate]])
      if (cancelled) handle.cancel()
      else timeline.time(move.visual.durationSeconds, false)
      assert.equal((await handle.finished).status, cancelled ? 'cancelled' : 'completed')
      assert.equal(scene.effects.children.length, 0)
      for (const actor of scene.actors.values()) {
        assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
        assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
      }
    } finally { visual.dispose(); scene.dispose(); gsap.ticker.sleep() }
  }
})
