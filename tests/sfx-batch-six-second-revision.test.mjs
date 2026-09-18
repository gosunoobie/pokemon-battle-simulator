import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'
import { createBatchSixFx, BATCH_SIX_EFFECTS } from '../apps/sfx-bench/src/batchSixVisual.js'
import { createBatchSixV2Fx, BATCH_SIX_V2_EFFECTS } from '../apps/sfx-bench/src/batchSixVisualV2.js'
import { planSyncAudition } from '../apps/sfx-bench/src/sync.js'
import { normalizeSyncFeedback } from '../apps/sfx-bench/src/syncFeedback.js'
const read=path=>readFile(new URL(`../${path}`,import.meta.url))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const priorBytes=await read('tools/audio-import/review/sync-batch-006.manifest-01.json')
const feedbackBytes=await read('tools/audio-import/review/sync-batch-006.feedback-01.json')
const prior=JSON.parse(priorBytes),feedback=JSON.parse(feedbackBytes)
const capture=JSON.parse(await read('tools/audio-import/review/sync-batch-006.review-01.json'))
const batch=JSON.parse(await read('tools/audio-import/review/sync-batch-006.manifest-02.json'))
const changed=['leafblade','ancientpower','sacredfire']

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



test('Batch 6 preserves the two exact keeps, every reviewed sound, and immutable previous proposals',async()=>{
  assert.equal(capture.source.sha256,hash(feedbackBytes));assert.equal(capture.manifestSha256,hash(priorBytes))
  assert.equal(feedback.revision,prior.revision);assert.deepEqual(normalizeSyncFeedback(feedback,prior),feedback)
  for(const pin of capture.playbackPins)assert.equal(hash(await read(pin.path)),pin.sha256,pin.path)
  assert.equal(batch.reviewPlayback,'batch-six-feedback-v2')
  assert.deepEqual(batch.moves.map(m=>m.id),prior.moves.map(m=>m.id))
  for(const [index,move]of batch.moves.entries()){
    const previous=prior.moves[index],record=feedback.records[index],keep=!changed.includes(move.id)
    assert.equal(batch.feedbackRecords[index].verdict,keep?'keep':'unreviewed')
    assert.equal(move.previousReview.changed,!keep);assert.equal(move.previousReview.notes,record.notes)
    for(const key of ['candidate','baseline','asset','originalVisual'])assert.deepEqual(move[key],previous[key],`${move.id}/${key}`)
    assert.deepEqual(move.previousVisual,previous.visual);assert.deepEqual(move.previousVisualAccent,previous.visualAccent)
    assert.deepEqual(move.previousReview.plan,record.plan);assert.equal(move.previousPlayback,'batch-six-v1')
    assert.equal(move.visual.durationSeconds,previous.visual.durationSeconds)
    assert.equal(move.visual.markers.find(m=>m.id==='impact').timeSeconds,previous.visual.markers.find(m=>m.id==='impact').timeSeconds)
    assert.deepEqual(batch.feedbackRecords[index].native,record.native)
    if(keep){assert.deepEqual(move.visual,previous.visual);assert.deepEqual(move.visualAccent,previous.visualAccent);assert.equal(BATCH_SIX_V2_EFFECTS[move.fxId],BATCH_SIX_EFFECTS[move.fxId])}
    else assert.equal(move.visualAccent.id,`batch-six-${move.id}-v2`)
    for(const native of [record.native,move.asset.decoded]){
      assert.deepEqual(planSyncAudition(move.candidate,native,move.visual),planSyncAudition(previous.candidate,native,previous.visual))
      const [region]=planSyncAudition(move.candidate,native,move.visual);assert.ok(region.delaySeconds+region.endSeconds-region.startSeconds<=move.visual.durationSeconds)
    }
  }
})

test('all new and previous versions play their own artwork and one cue on the retained clocks from either side',async()=>{
  for(const move of batch.moves)for(const previous of [false,true])for(const sourceId of ['source','target']){
    const accent=previous?move.previousVisualAccent:move.visualAccent,factory=accent.id.endsWith('-v2')?createBatchSixV2Fx:createBatchSixFx
    const h=harness(factory,sourceId),cues=[],metadata=previous?move.previousVisual:move.visual
    try{
      const run=h.visual.play({...move,visual:metadata},{scene:h.scene,sourceId,visualRate:1,onMarker(marker){if(marker.origin==='observed-result-cue')cues.push(marker)}})
      await tick();const tl=h.timelines[0];assert.ok(tl,move.id);assert.equal(tl.duration(),metadata.durationSeconds)
      const at=metadata.markers.find(m=>m.id==='impact').timeSeconds
      tl.time(at-.0001,false);assert.equal(cues.length,0);tl.time(at,false);assert.equal(cues.length,1)
      tl.time(metadata.durationSeconds,false);assert.equal((await run.finished).status,'completed');assert.equal(cues.length,1);h.clean()
    }finally{h.dispose()}
  }
})
