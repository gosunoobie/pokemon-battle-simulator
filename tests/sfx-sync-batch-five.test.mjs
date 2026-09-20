import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createAuditionAudio } from '../apps/sfx-bench/src/audio.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'
import { planSyncAudition } from '../apps/sfx-bench/src/sync.js'
import { createSyncBatchManifest } from '../tools/audio-import/sync-batch.mjs'
import accepted from '../packages/battle-sfx/src/accepted-runtime.generated.js'

const ids = ['fireblast', 'solarbeam', 'razorleaf', 'sludgebomb', 'overheat', 'eruption', 'earthquake', 'thunder', 'blizzard', 'bubblebeam']
const impacts = [1.07, 1.26, .75, 1.02, .98, 1.11, .66, .84, .82, .78]
const acceptedUrl = new URL('../packages/battle-sfx/src/accepted-runtime.generated.js', import.meta.url)
const acceptedBefore = await readFile(acceptedUrl)
// Preserve the original whole-recording study as historical evidence.
const batch = JSON.parse(await readFile(new URL('../tools/audio-import/review/sync-batch-005.manifest-01.json', import.meta.url)))
const definition = JSON.parse(await readFile(new URL('../tools/audio-import/review/sync-batch-005.json', import.meta.url)))
const analysis = JSON.parse(await readFile(new URL('../tools/audio-import/reports/sfx-remaining-analysis.json', import.meta.url)))
const tick = () => new Promise(resolve => setImmediate(resolve))
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} vs ${expected}`)

test('historical batch five comparisons remain archived after final playback promotion', async () => {
  assert.deepEqual(batch.moves.map(move => move.id), ids)
  assert.equal(batch.status, 'unreviewed-comparison')
  assert.equal(batch.feedbackRecords, undefined)
  assert.deepEqual(await readFile(acceptedUrl), acceptedBefore)
  for (const move of batch.moves) {
    assert.equal(accepted.moves[move.id].reviewStatus, 'accepted-sync')
    for (const field of ['previousReview', 'accent', 'visualAccent', 'plan', 'native']) assert.equal(move[field], undefined)
    assert.equal(move.visual.markers.find(marker => marker.id === 'impact').timeSeconds, impacts[ids.indexOf(move.id)])
  }
})

test('all ten preserve original gain, measured anchors and whole native tails even beyond visual completion', () => {
  const overruns = []
  for (const move of batch.moves) {
    const row = definition.moves.find(row => row.id === move.id)
    const measure = analysis.measurements.find(row => row.assetId === move.asset.id)
    assert.equal(move.asset.sha256, measure.sha256)
    assert.equal(move.asset.decoded.pcmSha256, measure.pcmSha256)
    assert.equal(move.candidate.segments.length, 1)
    const segment = move.candidate.segments[0], evidence = row.anchorEvidence[0]
    const windows = evidence.kind === 'strongest-energy-window' ? [measure.strongestEnergyWindow] : measure.positiveEnergyRises
    assert.ok(windows.some(window => window.startFrame === evidence.startFrame), `${move.id} uses a measured window`)
    assert.equal(segment.soundAnchorSeconds, evidence.startFrame / measure.sampleRate)
    assert.equal(segment.startSeconds, 0); assert.equal(segment.endSeconds, null)
    assert.equal(segment.gainDb, move.baseline.segments[0].gainDb)
    const reference = move.asset.decoded
    // Sample-count variants represent native decoder fixtures, not listening evidence.
    for (const [sampleRate, sampleFrames] of [
      [reference.sampleRate, reference.sampleFrames],
      [48000, Math.round(reference.sampleFrames / reference.sampleRate * 48000)],
      [48000, Math.round(reference.sampleFrames / reference.sampleRate * 48000) + 123],
    ]) {
      const native = { sampleRate, sampleFrames, durationSeconds: sampleFrames / sampleRate }
      const [region] = planSyncAudition(move.candidate, native, move.visual)
      const [baseline] = planSyncAudition(move.baseline, native, move.visual)
      close(region.delaySeconds + segment.soundAnchorSeconds, segment.cueSeconds / move.candidate.visualRate, `${move.id} anchor alignment`)
      assert.equal(region.startSeconds, 0)
      assert.equal(region.endSeconds, native.durationSeconds, `${move.id} retains actual native tail`)
      assert.equal(region.gainDb, baseline.gainDb)
      assert.equal(region.playbackRate, undefined)
      assert.ok(region.delaySeconds >= 0)
      assert.equal(baseline.delaySeconds, 0)
      assert.equal(baseline.endSeconds, native.durationSeconds)
    }
    const soundEnd = segment.cueSeconds / move.candidate.visualRate - segment.soundAnchorSeconds + reference.sampleFrames / reference.sampleRate
    if (soundEnd > move.visual.durationSeconds / move.candidate.visualRate) {
      overruns.push(move.id)
      assert.match(move.notes.join(' '), /after|beyond|overrun|outlast|exceed/i, `${move.id} documents sound beyond visual cleanup`)
    }
  }
  assert.ok(overruns.includes('solarbeam'), 'Solar Beam retains its unavoidable whole-recording tail')
  assert.ok(overruns.includes('sludgebomb'), 'Sludge Bomb retains its small full-recording overrun')
})

function visualHarness() {
  const scene = createSceneGraph(), timelines = []
  const visual = createSyncVisualAuditioner({
    createFx: options => createBattleFx({ ...options, assetLoader: async () => Texture.WHITE, glowTexture: Texture.WHITE }),
    timelineEngine: { timeline(options) {
      const timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline
      timelines.push(timeline); return timeline
    } },
  })
  const clean = () => {
    assert.equal(scene.effects.children.length, 0)
    assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
    for (const actor of scene.actors.values()) {
      assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
      assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
      assert.equal(actor.pose.tint, 0xffffff)
    }
  }
  return { scene, timelines, visual, clean, dispose() { visual.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}

test('all ten keep their original impact cue and clean actors and camera from either perspective', async () => {
  for (const move of batch.moves) for (const sourceId of ['source', 'target']) for (const cancelled of [false, true]) {
    const h = visualHarness(), cues = []
    try {
      const impact = impacts[ids.indexOf(move.id)]
      const handle = h.visual.play(move, { scene: h.scene, sourceId, visualRate: move.candidate.visualRate,
        onMarker(marker) { if (marker.origin === 'observed-result-cue') cues.push([marker.id, marker.authoredTimelineSeconds, marker.elapsedSeconds]) } })
      await tick()
      const timeline = h.timelines[0]
      assert.equal(timeline.timeScale(), move.candidate.visualRate)
      assert.equal(timeline.duration(), move.visual.durationSeconds)
      timeline.time(impact - .0001, false)
      assert.deepEqual(cues, [], `${move.id}/${sourceId} cannot reveal its result early`)
      timeline.time(impact, false)
      assert.deepEqual(cues, [['impact', impact, impact / move.candidate.visualRate]])
      if (cancelled) { timeline.time(impact + .03, false); handle.cancel() }
      else timeline.time(move.visual.durationSeconds, false)
      assert.equal((await handle.finished).status, cancelled ? 'cancelled' : 'completed')
      h.clean()
    } finally { h.dispose() }
  }
})

// Exercise the unchanged native transport with longer decoder fixtures. The
// encoded bytes are synthetic because this verifies scheduling, not decoding quality.
function audioHarness(move) {
  const encoded = new Uint8Array([1, 2, 3, 4]), sources = []
  const asset = { id: move.asset.id, url: '/fixture.mp3', bytes: encoded.length, sha256: createHash('sha256').update(encoded).digest('hex') }
  const sampleRate = 48000, sampleFrames = Math.round(move.asset.decoded.sampleFrames / move.asset.decoded.sampleRate * sampleRate) + 123
  const samples = new Float32Array(sampleFrames).fill(.1)
  const context = {
    state: 'running', currentTime: 1, sampleRate, destination: {},
    resume() { return Promise.resolve() },
    decodeAudioData() { return Promise.resolve({ sampleRate, length: sampleFrames, numberOfChannels: 1, duration: sampleFrames / sampleRate, getChannelData: () => samples }) },
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} } },
    createBufferSource() {
      const source = { playbackRate: { value: 0 }, stopCalls: 0, connect() {}, disconnect() { this.disconnected = true },
        start(...args) { this.startArgs = args }, stop() { this.stopCalls++ } }
      sources.push(source); return source
    },
    close() { this.state = 'closed'; return Promise.resolve() },
  }
  const player = createAuditionAudio({ createContext: () => context, fetcher: async () => new Response(encoded) })
  return { player, context, sources, asset }
}

test('native sound remains scheduled after visual cleanup and explicit stop still cancels its complete tail', async () => {
  for (const move of batch.moves) {
    const h = audioHarness(move), v = visualHarness()
    try {
      await h.player.unlock()
      const native = await h.player.load(h.asset)
      const [region] = planSyncAudition(move.candidate, native, move.visual)
      const visualEnd = move.visual.durationSeconds / move.candidate.visualRate
      if (region.delaySeconds + region.endSeconds <= visualEnd) continue
      let ended = false
      const sound = h.player.play({ ...region, when: h.context.currentTime + region.delaySeconds })
      sound.finished.then(() => { ended = true })
      const visual = v.visual.play(move, { scene: v.scene, visualRate: move.candidate.visualRate })
      await tick(); v.timelines[0].time(move.visual.durationSeconds, false)
      assert.equal((await visual.finished).status, 'completed')
      v.clean()
      assert.equal(ended, false, `${move.id} visual completion leaves the scheduled native tail alive`)
      const source = h.sources[0]
      assert.deepEqual(source.startArgs, [1 + region.delaySeconds, 0, native.durationSeconds])
      assert.equal(source.playbackRate.value, 1)
      assert.equal(source.loop, false)
      assert.equal(source.stopCalls, 0)
      source.onended()
      assert.deepEqual(await sound.finished, { reason: 'ended' })
      assert.equal(source.buffer, null); assert.equal(source.disconnected, true)
      const cancelled = h.player.play({ ...region, when: h.context.currentTime + region.delaySeconds })
      h.player.stop()
      assert.deepEqual(await cancelled.finished, { reason: 'cancelled' })
      assert.equal(h.sources[1].stopCalls, 1)
      assert.equal(h.sources[1].buffer, null); assert.equal(h.sources[1].disconnected, true)
    } finally { h.player.dispose(); v.dispose() }
  }
})
