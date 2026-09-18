import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { planSyncAudition } from '../apps/sfx-bench/src/sync.js'
import { normalizeSyncFeedback } from '../apps/sfx-bench/src/syncFeedback.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'

// Retain the reviewed comparison as the historical pacing/geometry fixture.
const batch = JSON.parse(await readFile(new URL('../tools/audio-import/review/sync-batch-003.review-02.json', import.meta.url))).manifest
const definition = JSON.parse(await readFile(new URL('../tools/audio-import/review/sync-batch-003.json', import.meta.url)))
const analysis = JSON.parse(await readFile(new URL('../tools/audio-import/reports/sfx-remaining-analysis.json', import.meta.url)))
const cases = [
  ['surf', 1, 29547, 1, 1],
  ['watergun', .8, 3969, .1, .48],
  ['crunch', 1, 11466, .64, .64],
  ['thunderpunch', .9, 14994, .52, .52],
  ['swift', 1, 24255, .94, 1.28],
  ['calmmind', .75, 50715, .9, .9],
]
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} vs ${expected}`)
const closePoint = (actual, expected, label) => assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < .04, `${label}: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`)
const tick = () => new Promise(resolve => setImmediate(resolve))

test('the archived third batch preserves its original review comparisons without Psychic sound layers', () => {
  assert.equal(batch.id, 'sync-003')
  assert.equal(batch.status, 'unreviewed-comparison')
  assert.deepEqual(batch.moves.map(move => move.id), cases.map(([id]) => id))
  assert.deepEqual(batch.batches.map(({ id, status }) => [id, status]), [
    ['sync-001', 'accepted'], ['sync-002', 'accepted'], ['sync-003', 'unreviewed-comparison'],
  ])
  for (const field of ['acceptedAt', 'acceptance']) assert.equal(batch[field], undefined)
  for (const move of batch.moves) {
    for (const field of ['native', 'accent', 'plan', 'approvalFingerprint', 'nativeCompatibility']) assert.equal(move[field], undefined, `${move.id}/${field}`)
    assert.deepEqual(move.baseline, { visualRate: 1, segments: [{ startSeconds: 0, endSeconds: null, soundAnchorSeconds: 0, cueSeconds: 0, gainDb: 0 }] })
  }
  const fresh = { schemaVersion: 1, kind: 'battle-sfx-sync-feedback', batchId: batch.id, revision: batch.revision,
    records: batch.moves.map(move => ({ moveId: move.id, plan: structuredClone(move.candidate), verdict: 'unreviewed', notes: '', native: null, ...(move.visualAccent ? { visualAccent: { id: move.visualAccent.id, revision: move.visualAccent.revision } } : {}) })) }
  assert.deepEqual(normalizeSyncFeedback(fresh, batch), fresh)
  assert.throws(() => normalizeSyncFeedback({ ...fresh, batchId: 'sync-002' }, batch), /different batch revision/)
  assert.throws(() => normalizeSyncFeedback({ ...fresh, revision: '0'.repeat(64) }, batch), /different batch revision/)
})

test('all six proposals align measured anchors at native speed and retain the complete browser buffer and original gain', () => {
  for (const [id, visualRate, anchorFrame, cueSeconds, impactSeconds] of cases) {
    const move = batch.moves.find(row => row.id === id), authored = definition.moves.find(row => row.id === id)
    const measurement = analysis.measurements.find(row => row.assetId === move.asset.id)
    const evidence = authored.anchorEvidence[0]
    const measuredWindows = evidence.kind === 'strongest-energy-window' ? [measurement.strongestEnergyWindow] : measurement.positiveEnergyRises
    assert.equal(evidence.startFrame, anchorFrame)
    assert.ok(measuredWindows.some(window => window.startFrame === anchorFrame), `${id} has measured evidence`)
    assert.equal(move.asset.sha256, measurement.sha256)
    assert.equal(move.asset.decoded.pcmSha256, measurement.pcmSha256)
    assert.equal(move.candidate.visualRate, visualRate)
    assert.deepEqual(move.candidate.segments, [{ startSeconds: 0, endSeconds: null, soundAnchorSeconds: anchorFrame / measurement.sampleRate, cueSeconds, gainDb: 0 }])
    assert.equal(move.visual.markers.find(marker => marker.id === 'impact').timeSeconds, impactSeconds)
    const reference = move.asset.decoded
    // Representative native buffers include a 48 kHz browser decode with a
    // slightly different tail length. These are fixtures, not listening evidence.
    for (const [sampleRate, sampleFrames] of [
      [reference.sampleRate, reference.sampleFrames],
      [48000, Math.round(reference.sampleFrames / reference.sampleRate * 48000)],
      [48000, Math.round(reference.sampleFrames / reference.sampleRate * 48000) - 123],
    ]) {
      const native = { sampleRate, sampleFrames, durationSeconds: sampleFrames / sampleRate }
      const [region] = planSyncAudition(move.candidate, native, move.visual)
      const [baseline] = planSyncAudition(move.baseline, native, move.visual)
      close(region.delaySeconds + anchorFrame / measurement.sampleRate, cueSeconds / visualRate, `${id} measured anchor aligns`)
      assert.ok(region.delaySeconds >= 0)
      assert.equal(region.startSeconds, 0)
      assert.equal(region.endSeconds, native.durationSeconds, `${id} keeps actual native tail`)
      assert.equal(region.gainDb, baseline.gainDb)
      assert.equal(region.playbackRate, undefined, `${id} visual pacing cannot pitch shift audio`)
      assert.ok(region.delaySeconds + region.endSeconds <= move.visual.durationSeconds / visualRate, `${id} full sound fits paced animation`)
      assert.equal(baseline.delaySeconds, 0)
      assert.equal(baseline.endSeconds, native.durationSeconds)
    }
  }
})

function harness() {
  const scene = createSceneGraph({ textures: { charizard: Texture.WHITE, venusaur: Texture.WHITE } }), timelines = []
  const auditioner = createSyncVisualAuditioner({ now: () => 1000,
    createFx: options => createBattleFx({ ...options, glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE }),
    timelineEngine: { timeline(options) {
      const timeline = gsap.timeline({ ...options, paused: true })
      timeline.play = () => timeline
      timelines.push(timeline)
      return timeline
    } },
  })
  const node = label => scene.effects.getChildByLabel(label, true)
  const world = (display, point = { x: 0, y: 0 }) => scene.effects.toLocal(point, display)
  function clean() {
    assert.equal(scene.effects.children.length, 0)
    assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
    for (const actor of scene.actors.values()) {
      assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
      assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.tint, 0xffffff)
    }
  }
  function sample() {
    const display = item => ({ label: item.label, x: item.x, y: item.y, rotation: item.rotation, alpha: item.alpha,
      scaleX: item.scale.x, scaleY: item.scale.y, children: item.children?.map(display) })
    return { effects: display(scene.effects), camera: { x: scene.camera.x, y: scene.camera.y },
      actors: [...scene.actors.values()].map(actor => display(actor.pose)) }
  }
  return { scene, timelines, auditioner, node, world, clean, sample,
    dispose() { auditioner.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}

test('proposed pacing preserves each recipe geometry, result contact and cleanup from both actor positions', async () => {
  for (const sourceId of ['source', 'target']) for (const [id, proposedRate, , , contact] of cases) {
    const move = batch.moves.find(row => row.id === id)
    let baseline
    for (const visualRate of [...new Set([1, proposedRate])]) {
      const h = harness(), starts = [], markers = [], samples = [], contacts = []
      try {
        const handle = h.auditioner.play(move, { scene: h.scene, sourceId, visualRate,
          onStart: value => starts.push(value), onMarker: marker => {
            markers.push(marker)
            if (marker.origin !== 'observed-result-cue') return
            const target = h.scene.actor(sourceId === 'source' ? 'target' : 'source')
            if (id === 'watergun') contacts.push([h.world(h.node('water-gun-tip')), target.anchor('center'), 'paced Water Gun reaches the target before its cue'])
            if (id === 'thunderpunch') {
              const r = Math.min(30, Math.max(18, h.scene.actor(sourceId).metrics.height / h.node('move-artwork').scale.y * .115))
              contacts.push([h.world(h.node('thunder-punch-fist'), { x: r, y: 0 }), h.world(h.node('thunder-punch-impact')), 'paced Thunder Punch contacts on its front knuckle'])
            }
            if (id === 'calmmind') contacts.push([h.world(h.node('calm-mind-aura')), h.scene.actor(sourceId).anchor('center'), 'Calm Mind follows the selected source'])
          } })
        await tick()
        const timeline = h.timelines[0]
        assert.ok(timeline, `${id} prepared its original recipe`)
        assert.equal(timeline.timeScale(), visualRate)
        close(starts[0].durationSeconds, move.visual.durationSeconds / visualRate, `${id} paced duration`)
        for (const time of [...new Set(move.visual.markers.map(marker => marker.timeSeconds))].sort((a, b) => a - b)) {
          timeline.time(time, false)
          samples.push(h.sample())
        }
        if (!baseline) baseline = samples
        else assert.deepEqual(samples, baseline, `${id}/${sourceId}: pacing preserves all authored poses and effect transforms`)
        for (const evidence of contacts) closePoint(...evidence)
        const results = markers.filter(marker => marker.origin === 'observed-result-cue')
        assert.deepEqual(results.map(marker => marker.id), ['impact'], `${id} retains one result`)
        close(results[0].authoredTimelineSeconds, contact, `${id} authored contact`)
        close(results[0].elapsedSeconds, contact / visualRate, `${id} paced contact`)
        assert.deepEqual(markers.filter(marker => marker.origin === 'authored-guide').map(marker => marker.id), move.visual.markers.map(marker => marker.id))
        timeline.time(move.visual.durationSeconds, false)
        assert.equal((await handle.finished).status, 'completed')
        h.clean()
        const cancelled = h.auditioner.play(move, { scene: h.scene, sourceId, visualRate })
        await tick(); h.timelines.at(-1).time(contact + .03, false)
        cancelled.cancel(); assert.equal((await cancelled.finished).status, 'cancelled'); h.clean()
      } finally { h.dispose() }
    }
  }
})

test('Swift sound follows the first cosmetic arrival while all five stars retain one final result cue', async () => {
  const move = batch.moves.find(row => row.id === 'swift')
  assert.equal(move.candidate.segments[0].cueSeconds, .94)
  assert.equal(move.visual.markers.find(marker => marker.id === 'first-contact').timeSeconds, .94)
  assert.equal(move.visual.markers.find(marker => marker.id === 'impact').timeSeconds, 1.28)
  for (const sourceId of ['source', 'target']) {
    const h = harness(), results = []
    try {
      const handle = h.auditioner.play(move, { scene: h.scene, sourceId, visualRate: move.candidate.visualRate,
        onMarker: marker => { if (marker.origin === 'observed-result-cue') results.push(marker) } })
      await tick()
      const timeline = h.timelines[0], target = h.scene.actor(sourceId === 'source' ? 'target' : 'source')
      for (let i = 0; i < 5; i++) {
        const contact = .32 + i * .085 + .62
        timeline.time(contact - .0001, false)
        assert.equal(results.length, 0, `star ${i + 1} cannot reveal the result early`)
        timeline.time(contact, false)
        const point = h.world(h.node(`swift-shot-${i}`)), center = target.anchor('visualCenter')
        closePoint(point, h.world(h.node(`swift-impact-${i}`)), `star ${i + 1} meets its own flash`)
        assert.ok(Math.abs(point.x - center.x) <= target.metrics.width / 2 + .04)
        assert.ok(Math.abs(point.y - center.y) <= target.metrics.height / 2 + .04)
        assert.equal(results.length, i === 4 ? 1 : 0)
      }
      close(results[0].elapsedSeconds, 1.28, 'Swift result stays on final arrival')
      timeline.time(move.visual.durationSeconds, false); assert.equal((await handle.finished).status, 'completed'); h.clean()
    } finally { h.dispose() }
  }
})
