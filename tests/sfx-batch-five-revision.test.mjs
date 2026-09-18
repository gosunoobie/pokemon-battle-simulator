import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'
import { createBatchFiveAudio } from '../apps/sfx-bench/src/batchFiveAudio.js'
import { createBatchFiveFx, BATCH_FIVE_EFFECTS } from '../apps/sfx-bench/src/batchFiveVisual.js'
import { planSyncAudition } from '../apps/sfx-bench/src/sync.js'
import { createSyncBatchManifest, compileSyncBatch } from '../tools/audio-import/sync-batch.mjs'
import { createCollectionManifest } from '../tools/audio-import/collection.mjs'
import { readRemainingAnalysis } from '../tools/audio-import/analysis.mjs'
import runtime from '../packages/battle-sfx/src/runtime.generated.js'
import draft from '../packages/battle-sfx/src/draft-runtime.generated.js'
import { ERUPTION_ARRIVALS, timing as eruptionTiming } from '../packages/battle-fx/src/review-batch-five/eruption.js'

const read = path => readFile(new URL(`../${path}`, import.meta.url))
const feedbackBytes = await read('tools/audio-import/review/sync-batch-005.feedback-01.json')
const feedback = JSON.parse(feedbackBytes)
const capture = JSON.parse(await read('tools/audio-import/review/sync-batch-005.review-01.json'))
const acceptedBytes = await read('packages/battle-sfx/src/accepted-runtime.generated.js')
const batch = JSON.parse(await read('tools/audio-import/review/sync-batch-005.manifest-02.json'))
const definition = JSON.parse(await read('tools/audio-import/review/sync-batch-005.json'))
const manifest = await createCollectionManifest(), analysis = await readRemainingAnalysis({ manifest })
const original = compileSyncBatch({ definition, manifest, analysis,
  plans: { ...runtime.moves, ...draft.moves }, revisionPins: [],
  recipeTexts: Object.fromEntries(await Promise.all(batch.moves.map(async move => [move.id, (await read(`packages/battle-fx/src/moves/restored/${move.fxId}.js`)).toString('utf8')]))),
})
const variantIds = ['fireblast', 'solarbeam', 'eruption', 'thunder', 'blizzard']
const cuts = { razorleaf: 2.21, sludgebomb: 2.83, overheat: 2.86, earthquake: 2.70, bubblebeam: 3.063333333333333 }
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} vs ${b}`)
const closePoint = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, `${label}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`)
const tick = () => new Promise(resolve => setImmediate(resolve))

test('revised batch preserves all archived feedback and original comparisons, with only five independent visual variants', async () => {
  assert.equal(batch.reviewPlayback, 'batch-five-feedback-v1')
  assert.equal(batch.status, 'unreviewed-comparison')
  assert.equal(batch.moves.length, 10)
  assert.notEqual(batch.revision, feedback.revision)
  assert.deepEqual(capture.feedback, feedback)
  assert.equal(capture.source.sha256, createHash('sha256').update(feedbackBytes).digest('hex'))
  assert.deepEqual(await read('tools/audio-import/review/sync-batch-005.feedback-01.json'), feedbackBytes)
  assert.deepEqual(await read('packages/battle-sfx/src/accepted-runtime.generated.js'), acceptedBytes)
  assert.deepEqual(batch.moves.filter(move => move.visualAccent).map(move => move.id), variantIds)
  for (const move of batch.moves) {
    const prior = feedback.records.find(record => record.moveId === move.id), old = original.moves.find(row => row.id === move.id)
    const record = batch.feedbackRecords.find(row => row.moveId === move.id)
    assert.equal(record.verdict, 'unreviewed')
    assert.equal(record.notes, prior.notes)
    assert.deepEqual(record.native, prior.native)
    assert.deepEqual(record.plan, move.candidate)
    assert.deepEqual(move.previousReview, { verdict: prior.verdict, notes: prior.notes, plan: prior.plan, changed: true, revision: feedback.revision })
    assert.deepEqual(move.originalVisual, old.visual)
    assert.deepEqual(move.baseline, old.baseline)
    assert.equal(move.originalVisual.visualRevision, capture.moves.find(row => row.id === move.id).visualRevision)
    if (variantIds.includes(move.id)) {
      assert.equal(move.visualAccent.id, `batch-five-${move.id}-v1`)
      assert.equal(record.visualAccent.revision, move.visualAccent.revision)
      assert.notEqual(move.visual.visualRevision, old.visual.visualRevision)
    } else assert.deepEqual(move.visual, old.visual)
  }
  assert.deepEqual(Object.keys(BATCH_FIVE_EFFECTS), Object.keys(MOVE_EFFECTS))
  for (const [id, effect] of Object.entries(MOVE_EFFECTS)) {
    const changed = batch.moves.some(move => move.fxId === id && move.visualAccent)
    assert.equal(BATCH_FIVE_EFFECTS[id] === effect, !changed)
  }
})

test('all revised recordings finish by their visual ending while preserving source pitch, gain and exact requested edits', () => {
  for (const move of batch.moves) {
    const segment = move.candidate.segments[0], prior = feedback.records.find(row => row.moveId === move.id)
    assert.equal(move.candidate.segments.length, 1)
    assert.equal(segment.gainDb, prior.plan.segments[0].gainDb)
    if (Object.hasOwn(cuts, move.id)) {
      assert.equal(segment.startSeconds, 0)
      assert.equal(segment.endSeconds, cuts[move.id])
    } else if (move.id !== 'eruption') {
      assert.equal(segment.startSeconds, 0); assert.equal(segment.endSeconds, null)
    }
    for (const native of [prior.native, move.asset.decoded]) {
      const [region] = planSyncAudition(move.candidate, native, move.visual)
      close(region.delaySeconds + segment.soundAnchorSeconds - segment.startSeconds, segment.cueSeconds / move.candidate.visualRate, `${move.id} sound anchor`)
      assert.ok(region.delaySeconds >= 0)
      assert.ok(region.delaySeconds + region.endSeconds - region.startSeconds <= move.visual.durationSeconds / move.candidate.visualRate + 1e-9, `${move.id} completes within its revised visual`)
      assert.equal(region.playbackRate, undefined)
    }
  }
  const eruption = batch.moves.find(move => move.id === 'eruption'), segment = eruption.candidate.segments[0]
  assert.equal(eruption.candidate.visualRate, 1)
  assert.equal(segment.startSeconds, 2.86); assert.equal(segment.endSeconds, 6.67)
  assert.equal(segment.soundAnchorSeconds, 3.08); assert.equal(segment.cueSeconds, .94)
  const [region] = planSyncAudition(eruption.candidate, feedback.records.find(row => row.moveId === 'eruption').native, eruption.visual)
  close(region.delaySeconds, .72, 'Eruption starts after its visual windup')
  close(region.delaySeconds + region.endSeconds - region.startSeconds, 4.53, 'Eruption sound ending')
  assert.deepEqual(ERUPTION_ARRIVALS, [.94, 1.24, 1.78, 1.95, 2.35, 2.92, 3.23, 3.49, 4.06])
  assert.equal(eruptionTiming.contact, .94); assert.equal(eruptionTiming.duration, 4.75)
  const measurements = analysis.measurements.find(row => row.assetId === eruption.asset.id)
  assert.equal(measurements.pcmSha256, eruption.asset.decoded.pcmSha256)
})

function harness(createFx, sourceId = 'source', custom = false) {
  const scene = createSceneGraph(custom ? { width: 620, height: 650, actors: [
    { id: 'source', profile: 'wide', x: .29, y: .78, height: .2, facing: 1 },
    { id: 'target', profile: 'tall', x: .8, y: .44, height: .2, facing: -1 },
  ] } : {}), timelines = []
  const visual = createSyncVisualAuditioner({ createFx: options => createFx({ ...options, glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE }),
    timelineEngine: { timeline(options) { const tl = gsap.timeline({ ...options, paused: true }); tl.play = () => tl; timelines.push(tl); return tl } },
  })
  const clean = () => {
    assert.equal(scene.effects.children.length, 0); assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
    for (const actor of scene.actors.values()) {
      assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
      assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.tint, 0xffffff)
    }
  }
  return { scene, sourceId, visual, timelines, clean,
    node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node),
    dispose() { visual.dispose(); scene.dispose(); gsap.ticker.sleep() },
  }
}

test('all ten revised comparisons run the selected original or review builder from both sides and clean up', async () => {
  for (const move of batch.moves) for (const sourceId of ['source', 'target']) {
    const h = harness(move.visualAccent ? createBatchFiveFx : createBattleFx, sourceId), cues = []
    try {
      const impact = move.visual.markers.find(marker => marker.id === 'impact').timeSeconds
      const play = () => h.visual.play(move, { scene: h.scene, sourceId, visualRate: move.candidate.visualRate,
        onMarker(marker) { if (marker.origin === 'observed-result-cue') cues.push(marker) } })
      const run = play(); await tick(); const timeline = h.timelines[0]
      assert.equal(timeline.duration(), move.visual.durationSeconds, move.id)
      assert.equal(timeline.timeScale(), move.candidate.visualRate)
      timeline.time(impact - .0001, false); assert.equal(cues.length, 0)
      timeline.time(impact, false); assert.equal(cues.length, 1)
      assert.equal(cues[0].id, 'impact'); close(cues[0].authoredTimelineSeconds, impact, move.id)
      close(cues[0].elapsedSeconds, impact / move.candidate.visualRate, move.id)
      timeline.time(move.visual.durationSeconds, false)
      assert.equal((await run.finished).status, 'completed'); assert.equal(cues.length, 1); h.clean()
      for (const at of [impact / 2, Math.min(impact + .1, move.visual.durationSeconds - .1)]) {
        const cancelled = play(); await tick(); h.timelines.at(-1).time(at, false)
        cancelled.cancel(); assert.equal((await cancelled.finished).status, 'cancelled'); h.clean()
      }
    } finally { h.dispose() }
  }
})

function assertAllArtBounds(h) {
  let seen = 0
  function walk(node, alpha = 1) {
    const opacity = alpha * node.alpha
    if (opacity > .03 && ['Sprite', 'Graphics'].includes(node.constructor.name)) {
      const b = node.getBounds(); seen++
      assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
        `${node.label} / ${h.sourceId} bounds: ${JSON.stringify(b)}`)
    }
    for (const child of node.children ?? []) walk(child, opacity)
  }
  walk(h.scene.effects); return seen
}

test('Eruption lava follows all nine later pulses with matching sparks, downward gravity and complete art bounds', async () => {
  const move = batch.moves.find(move => move.id === 'eruption')
  for (const sourceId of ['source', 'target']) for (const custom of [false, true]) {
    const h = harness(createBatchFiveFx, sourceId, custom), cues = []
    try {
      const run = h.visual.play(move, { scene: h.scene, sourceId, visualRate: 1,
        onMarker(marker) { if (marker.origin === 'observed-result-cue') {
          cues.push(marker.id)
          closePoint(h.point(h.node('eruption-review-lava-1')), h.point(h.node('eruption-review-fleck-0-0')), 'first lava geometry exists before result cue')
        } } })
      await tick(); const timeline = h.timelines[0]
      for (const [index, impact] of ERUPTION_ARRIVALS.entries()) {
        timeline.time(impact - .001, false)
        assert.ok(h.node(`eruption-review-lava-${index + 1}`).alpha > .9)
        timeline.time(impact, false)
        const lava = h.node(`eruption-review-lava-${index + 1}`), spark = h.node(`eruption-review-fleck-${index}-0`)
        closePoint(h.point(lava), h.point(spark), `lava ${index + 1} lands at spark origin`)
        assert.equal(lava.alpha, 0); assert.ok(spark.alpha > .9)
        assert.deepEqual(cues, ['impact'])
      }
      const spark = h.node('eruption-review-fleck-8-0'), ys = []
      for (const age of [.28, .33, .38]) { timeline.time(4.06 + age, false); ys.push(h.point(spark).y) }
      assert.ok(ys[1] > ys[0] && ys[2] - ys[1] > ys[1] - ys[0], 'late lava spark falls with downward acceleration')
      timeline.time(eruptionTiming.duration, false); assert.equal((await run.finished).status, 'completed'); h.clean()
      const bounded = h.visual.play(move, { scene: h.scene, sourceId, visualRate: 1 }); await tick()
      let seen = 0
      for (let time = .01; time < 4.72; time += .031) { h.timelines.at(-1).time(time, false); seen += assertAllArtBounds(h) }
      assert.ok(seen > 100)
      bounded.cancel(); assert.equal((await bounded.finished).status, 'cancelled'); h.clean()
    } finally { h.dispose() }
  }
})

function audioFixture() {
  const encoded = new Uint8Array([1, 2, 3, 4]), sources = [], gains = []
  const asset = { url: '/fixture.mp3', bytes: encoded.length, sha256: createHash('sha256').update(encoded).digest('hex') }
  const samples = new Float32Array(7 * 48000).fill(.1)
  const context = {
    state: 'running', currentTime: 1, sampleRate: 48000, destination: {},
    resume() { return Promise.resolve() },
    decodeAudioData() { return Promise.resolve({ sampleRate: 48000, length: samples.length, numberOfChannels: 1, duration: 7, getChannelData: () => samples }) },
    createGain() {
      const node = { gain: { value: 1, events: [], setValueAtTime(value, at) { this.events.push(['set', value, at]); this.value = value }, linearRampToValueAtTime(value, at) { this.events.push(['ramp', value, at]); this.value = value }, cancelScheduledValues() {} }, connect() {}, disconnect() { this.disconnected = true } }
      gains.push(node); return node
    },
    createBufferSource() {
      const node = { playbackRate: { value: 0 }, stopCalls: 0, connect(to) { this.gainNode = to }, disconnect() { this.disconnected = true }, start(...args) { this.args = args }, stop() { this.stopCalls++ } }
      sources.push(node); return node
    },
    close() { this.state = 'closed'; return Promise.resolve() },
  }
  const player = createBatchFiveAudio({ createContext: () => context, fetcher: async () => new Response(encoded) })
  return { player, asset, sources, gains, context }
}

test('batch-five transport tapers only edited boundaries inside their exact scheduled region at native pitch', async () => {
  const h = audioFixture()
  try {
    await h.player.unlock(); await h.player.load(h.asset)
    for (const region of [{ startSeconds: 2.86, endSeconds: 6.67, gainDb: 0 }, { startSeconds: 0, endSeconds: 2.70, gainDb: -2.15 }]) {
      const run = h.player.play({ ...region, when: 10 }), source = h.sources.at(-1), events = source.gainNode.gain.events
      const gain = 10 ** (region.gainDb / 20), span = region.endSeconds - region.startSeconds
      assert.deepEqual(source.args, [10, region.startSeconds, span])
      assert.equal(source.playbackRate.value, 1); assert.equal(source.loop, false)
      const expected = [ ...(region.startSeconds > 0 ? [['set', 0, 10], ['ramp', gain, 10.012]] : []), ['set', gain, 10 + span - .012], ['ramp', 0, 10 + span] ]
      assert.equal(events.length, expected.length)
      events.forEach((event, index) => { assert.equal(event[0], expected[index][0]); close(event[1], expected[index][1], 'fade gain'); close(event[2], expected[index][2], 'fade time') })
      assert.ok(events.every(event => event[2] >= 10 && event[2] <= 10 + span))
      source.onended(); assert.deepEqual(await run.finished, { reason: 'ended' })
      assert.equal(source.buffer, null); assert.equal(source.disconnected, true)
    }
    for (const region of [{ startSeconds: 0, endSeconds: 7 }, { startSeconds: 2.86, endSeconds: 6.67, taperEdits: false }]) {
      const run = h.player.play({ ...region, when: 10 }), source = h.sources.at(-1)
      assert.deepEqual(source.gainNode.gain.events, [], 'whole or explicitly historical playback gains no new taper')
      assert.equal(source.playbackRate.value, 1)
      source.onended(); assert.deepEqual(await run.finished, { reason: 'ended' })
    }
    const cancelled = h.player.play({ startSeconds: 2.86, endSeconds: 6.67, when: 10 })
    const source = h.sources.at(-1)
    assert.ok(h.context.currentTime < source.args[0]); h.player.stop()
    assert.deepEqual(await cancelled.finished, { reason: 'cancelled' })
    assert.equal(source.stopCalls, 1); assert.equal(source.disconnected, true); assert.equal(source.gainNode.disconnected, true); assert.equal(source.buffer, null)
    assert.equal(h.player.diagnostics().voices, 0)
  } finally { h.player.dispose() }
})
