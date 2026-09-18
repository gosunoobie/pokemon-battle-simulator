import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Texture, TextureSource } from 'pixi.js'
import { gsap } from 'gsap'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'
import { createBatchSixFx } from '../apps/sfx-bench/src/batchSixVisual.js'
import { createBatchSixV2Fx } from '../apps/sfx-bench/src/batchSixVisualV2.js'
import { planSyncAudition } from '../apps/sfx-bench/src/sync.js'
import { createSyncBatchManifest } from '../tools/audio-import/sync-batch.mjs'
import { compileSixthFinalBatch } from '../tools/audio-import/sync-sixth-final.mjs'

const read = path => readFile(new URL(`../${path}`, import.meta.url))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const tick = () => new Promise(resolve => setImmediate(resolve))
const final = JSON.parse(await read('tools/audio-import/review/sync-batch-006.final.json'))
const manifestBytes = await read(final.reviewEvidence.manifestPath), feedbackBytes = await read(final.reviewEvidence.feedbackPath)
const reviewed = JSON.parse(manifestBytes), feedback = JSON.parse(feedbackBytes)
const revisionPins = await Promise.all(final.playbackPins.map(async pin => ({ path: pin.path, sha256: hash(await read(pin.path)) })))
const inputs = () => ({ final: structuredClone(final), batch: structuredClone(reviewed), manifestBytes: Buffer.from(manifestBytes), feedbackBytes: Buffer.from(feedbackBytes), revisionPins: structuredClone(revisionPins) })
const moveIds = ['leafblade', 'triattack', 'meteormash', 'ancientpower', 'sacredfire']
const variants = ['batch-six-leafblade-v2', 'batch-six-triattack-v1', 'batch-six-meteormash-v1', 'batch-six-ancientpower-v2', 'batch-six-sacredfire-v2']

test('accepted Batch 6 freezes exactly the five approved custom versions and complete native sound plans', async () => {
  const compiled = compileSixthFinalBatch(inputs()), served = await createSyncBatchManifest({ batch: 'sync-006' })
  assert.equal(compiled.status, 'accepted'); assert.equal(served.status, 'accepted')
  assert.equal(compiled.reviewedRevision, '6e8c0107147cef09802a73458c80e20832dbf05eefbc3403794234257c513ba4')
  assert.equal(compiled.reviewedRevision, reviewed.revision); assert.equal(compiled.reviewedRevision, feedback.revision)
  assert.deepEqual(compiled.approval, final.approval); assert.deepEqual(served.approval, final.approval)
  assert.deepEqual(served.moves, compiled.moves); assert.deepEqual(compiled.moves.map(move => move.id), moveIds)
  assert.deepEqual(compiled.moves.map(move => move.visualAccent.id), variants)
  assert.deepEqual(final.playbackPins, revisionPins)
  for (const path of ['apps/sfx-bench/src/batchSixVisual.js', 'apps/sfx-bench/src/batchSixVisualV2.js', 'packages/battle-fx/src/assets.js', 'packages/battle-fx/assets/rock.svg']) {
    assert.ok(final.playbackPins.some(pin => pin.path === path), `the final keeps its actual playback dependency: ${path}`)
  }
  assert.equal(served.batches.find(batch => batch.id === 'sync-006').status, 'accepted')
  for (const key of ['feedbackRecords', 'defaultMoveId', 'reviewPlayback']) assert.equal(Object.hasOwn(compiled, key), false)
  for (const [i, move] of compiled.moves.entries()) {
    const source = reviewed.moves[i], record = feedback.records[i]
    assert.equal(record.verdict, 'keep')
    for (const key of ['id', 'fxId', 'name', 'asset', 'visual', 'notes', 'visualAccent']) assert.deepEqual(move[key], source[key], `${move.id}/${key}`)
    assert.deepEqual(move.plan, source.candidate); assert.deepEqual(move.native, record.native)
    for (const key of ['baseline', 'candidate', 'originalVisual', 'previousReview', 'previousVisual', 'previousVisualAccent', 'previousPlayback']) assert.equal(Object.hasOwn(move, key), false, `${move.id}/${key}`)
    assert.equal(move.plan.visualRate, 1); assert.equal(move.plan.segments.length, 1)
    assert.equal(move.plan.segments[0].startSeconds, 0); assert.equal(move.plan.segments[0].endSeconds, null)
    assert.equal(move.plan.segments[0].gainDb, i === 4 ? -.46 : 0)
    const [region] = planSyncAudition(move.plan, move.native, move.visual)
    assert.ok(Math.abs(region.delaySeconds - [.4, 0, .1, .1, .06][i]) < 1e-9)
    assert.equal(Math.round(region.endSeconds * move.native.sampleRate), move.native.sampleFrames)
    assert.ok(region.delaySeconds + region.endSeconds - region.startSeconds <= move.visual.durationSeconds)
  }
})

test('final compilation rejects changed approval, evidence, sound plans, visual routes, native captures and pinned playback', () => {
  const corruptFeedback = (value, mutate) => {
    const copy = JSON.parse(value.feedbackBytes); mutate(copy)
    value.feedbackBytes = Buffer.from(JSON.stringify(copy)); value.final.reviewEvidence.feedbackSha256 = hash(value.feedbackBytes)
  }
  const changes = [
    ['unapproved source', value => { value.final.approval.source = 'playback-completed' }],
    ['empty approval', value => { value.final.approval.text = '' }],
    ['invalid approval date', value => { value.final.approval.date = 'yesterday' }],
    ['different reviewed revision', value => { value.final.reviewedRevision = '0'.repeat(64) }],
    ['changed feedback bytes', value => { value.feedbackBytes = Buffer.concat([value.feedbackBytes, Buffer.from('\n')]) }],
    ['changed manifest bytes', value => { value.manifestBytes = Buffer.concat([value.manifestBytes, Buffer.from('\n')]) }],
    ['changed evidence location', value => { value.final.reviewEvidence.feedbackPath = 'tools/audio-import/review/sync-batch-006.feedback-01.json' }],
    ['altered source hash', value => { value.batch.moves[0].asset.sha256 = '0'.repeat(64) }],
    ['altered sound gain', value => { value.batch.moves[0].candidate.segments[0].gainDb = -.1 }],
    ['altered sound timing', value => { value.batch.moves[0].candidate.segments[0].cueSeconds += .01 }],
    ['altered visual timing', value => { value.batch.moves[0].visual.durationSeconds += .01 }],
    ['altered visual revision', value => { value.batch.moves[0].visual.visualRevision = '0'.repeat(64) }],
    ['reverted custom route', value => { value.batch.moves[3].visualAccent.id = 'batch-six-ancientpower-v1' }],
    ['missing custom route', value => { delete value.batch.moves[3].visualAccent }],
    ['changed move order', value => { value.batch.moves.reverse() }],
    ['changed playback dependency', value => { value.revisionPins.find(pin => pin.path.endsWith('batchSixVisualV2.js')).sha256 = '0'.repeat(64) }],
    ['changed rock render', value => { value.revisionPins.find(pin => pin.path.endsWith('rock.svg')).sha256 = '0'.repeat(64) }],
    ['forged playback pin', value => { value.final.playbackPins[0].sha256 = '0'.repeat(64) }],
    ['missing playback pin', value => { value.final.playbackPins.pop() }],
    ['unreviewed move', value => corruptFeedback(value, data => { data.records[0].verdict = 'unreviewed' })],
    ['retuned saved plan', value => corruptFeedback(value, data => { data.records[0].plan.segments[0].gainDb = -.1 })],
    ['different native capture', value => corruptFeedback(value, data => { data.records[0].native.sampleFrames++; data.records[0].native.durationSeconds = data.records[0].native.sampleFrames / data.records[0].native.sampleRate })],
    ['different approved visual route', value => corruptFeedback(value, data => { data.records[3].visualAccent.id = 'batch-six-ancientpower-v1' })],
  ]
  for (const [label, change] of changes) { const value = inputs(); change(value); assert.throws(() => compileSixthFinalBatch(value), undefined, label) }
})

function playbackHarness(move, sourceId) {
  const scene = createSceneGraph(), timelines = [], events = [], starts = [], cues = []
  const rock = new Texture({ source: new TextureSource({ width: 16, height: 16 }) })
  let resolveRock
  const pendingRock = new Promise(resolve => { resolveRock = resolve })
  const createFx = move.visualAccent.id.endsWith('-v2') ? createBatchSixV2Fx : createBatchSixFx
  const visual = createSyncVisualAuditioner({ createFx: options => createFx({ ...options, glowTexture: Texture.WHITE, assetLoader(key, url) {
    events.push(`load:${key}`); assert.equal(key, 'rock'); assert.match(url, /\/assets\/rock\.svg$/); return pendingRock
  } }), timelineEngine: { timeline(options) {
    events.push('timeline'); const tl = gsap.timeline({ ...options, paused: true }); tl.play = () => { events.push('play'); return tl }; timelines.push(tl); return tl
  } } })
  return { scene, rock, timelines, events, starts, cues, resolveRock: () => resolveRock(rock), node: label => scene.effects.getChildByLabel(label, true),
    play() { return visual.play(move, { scene, sourceId, visualRate: move.plan.visualRate,
      onStart() { events.push('audio'); starts.push(planSyncAudition(move.plan, move.native, move.visual)) },
      onMarker(marker) { if (marker.origin === 'observed-result-cue') cues.push(marker) },
    }) },
    clean() {
      assert.equal(scene.effects.children.length, 0); assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
      for (const actor of scene.actors.values()) {
        assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
        assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.tint, 0xffffff)
      }
      assert.equal(rock.destroyed, false); assert.equal(rock.source.destroyed, false)
    },
    dispose() { visual.dispose(); scene.dispose(); rock.destroy(true); gsap.ticker.sleep() },
  }
}

test('accepted-only moves play the exact v1/v2 artwork from both sides and preload rendered rocks before the paired clock', async () => {
  const accepted = compileSixthFinalBatch(inputs())
  const labels = { leafblade: 'leaf-blade-review-curved-leaf', triattack: 'tri-attack-burning', meteormash: 'meteor-mash-cosmic-impact', ancientpower: 'ancient-power-rendered-rock-0', sacredfire: 'sacred-fire-review-stream-front' }
  for (const move of accepted.moves) for (const side of ['source', 'target']) {
    const h = playbackHarness(move, side)
    try {
      const run = h.play(); await tick()
      if (move.id === 'ancientpower') {
        assert.deepEqual(h.events, ['load:rock']); assert.equal(h.timelines.length, 0); assert.equal(h.starts.length, 0)
        h.resolveRock(); await tick(); assert.deepEqual(h.events, ['load:rock', 'timeline', 'audio', 'play'])
        assert.equal(h.node(labels[move.id]).texture, h.rock)
      } else assert.deepEqual(h.events, ['timeline', 'audio', 'play'])
      assert.ok(h.node(labels[move.id]), `${move.id} uses the approved custom artwork`)
      assert.equal(h.starts.length, 1); assert.deepEqual(h.starts[0], planSyncAudition(move.plan, move.native, move.visual))
      const tl = h.timelines[0], impact = move.visual.markers.find(marker => marker.id === 'impact').timeSeconds
      assert.equal(tl.duration(), move.visual.durationSeconds); assert.equal(tl.timeScale(), 1)
      tl.time(impact - .0001, false); assert.equal(h.cues.length, 0)
      tl.time(impact, false); assert.equal(h.cues.length, 1); assert.equal(h.cues[0].id, 'impact')
      assert.ok(Math.abs(h.cues[0].authoredTimelineSeconds - impact) < 1e-9)
      tl.time(move.visual.durationSeconds, false); assert.equal((await run.finished).status, 'completed'); assert.equal(h.cues.length, 1); h.clean()
    } finally { h.dispose() }
  }
})
