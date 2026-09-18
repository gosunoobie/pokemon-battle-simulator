import './helpers/headless-pixi.mjs'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'
import { createBatchSixFx, BATCH_SIX_EFFECTS } from '../apps/sfx-bench/src/batchSixVisual.js'
import { createSyncBatchManifest } from '../tools/audio-import/sync-batch.mjs'
import { planSyncAudition } from '../apps/sfx-bench/src/sync.js'
const tick = () => new Promise(resolve => setImmediate(resolve))
const batch = JSON.parse(await readFile(new URL('../tools/audio-import/review/sync-batch-006.manifest-01.json', import.meta.url)))
const expected=['leafblade','triattack','meteormash','ancientpower','sacredfire']

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


test('Batch 6 contains only the five requested redesigns and complete native recordings with Ancient Power timing preserved',async()=>{
  assert.deepEqual(batch.moves.map(m=>m.id),expected);assert.equal(batch.defaultMoveId,'leafblade');assert.equal(batch.reviewPlayback,'batch-six-v1')
  assert.equal(batch.feedbackRecords,undefined)
  const fourth=await createSyncBatchManifest({batch:'sync-004'})
  assert.deepEqual(batch.moves.find(m=>m.id==='ancientpower').candidate,fourth.moves.find(m=>m.id==='ancientpower').candidate)
  const delays=[.4,0,.1,.1,.06]
  for(const [i,move] of batch.moves.entries()){
    assert.equal(move.visualAccent.id,`batch-six-${move.id}-v1`);assert.equal(move.candidate.visualRate,1)
    const [region]=planSyncAudition(move.candidate,move.asset.decoded,move.visual)
    assert.ok(Math.abs(region.delaySeconds-delays[i])<1e-8)
    assert.equal(region.startSeconds,0);assert.equal(move.candidate.segments[0].endSeconds,null)
    assert.ok(region.delaySeconds+region.endSeconds<=move.visual.durationSeconds)
    assert.equal(move.originalVisual.durationSeconds,MOVE_EFFECTS[move.fxId].duration)
    assert.equal(move.originalVisual.markers.find(m=>m.id==='impact').timeSeconds,MOVE_EFFECTS[move.fxId].contact)
    assert.notEqual(BATCH_SIX_EFFECTS[move.fxId].build,MOVE_EFFECTS[move.fxId].build)
    assert.equal(move.previousReview,undefined)
  }
  for(const [id,effect] of Object.entries(MOVE_EFFECTS))if(!batch.moves.some(m=>m.fxId===id))assert.equal(BATCH_SIX_EFFECTS[id],effect)
})

test('all five new and original versions play on their declared clocks with one cue and recover from either side',async()=>{
  for(const move of batch.moves)for(const original of [false,true])for(const sourceId of ['source','target']){
    const h=harness(original?createBattleFx:createBatchSixFx,sourceId),cues=[]
    const metadata=original?move.originalVisual:move.visual
    try{
      const run=h.visual.play({...move,visual:metadata},{scene:h.scene,sourceId,visualRate:1,onMarker(marker){if(marker.origin==='observed-result-cue')cues.push(marker)}})
      await tick();const tl=h.timelines[0];assert.equal(tl.duration(),metadata.durationSeconds)
      const at=metadata.markers.find(m=>m.id==='impact').timeSeconds
      tl.time(at-.0001,false);assert.equal(cues.length,0);tl.time(at,false);assert.equal(cues.length,1)
      tl.time(metadata.durationSeconds,false);assert.equal((await run.finished).status,'completed');assert.equal(cues.length,1);h.clean()
    }finally{h.dispose()}
  }
})
