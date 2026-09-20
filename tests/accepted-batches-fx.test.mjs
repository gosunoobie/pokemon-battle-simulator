import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture, TextureSource } from 'pixi.js'
import { gsap } from 'gsap'
import { createAcceptedBattleFx, ACCEPTED_MOVE_EFFECTS, ACCEPTED_EFFECT_TIMINGS } from '@battle/battle-fx/accepted-effects'
import { createClockedBattleFx } from '@battle/battle-fx/presentation-clock'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createBatchFiveV4Fx, BATCH_FIVE_V4_EFFECTS } from '../apps/sfx-bench/src/batchFiveVisualV4.js'
import { createBatchSixV2Fx, BATCH_SIX_V2_EFFECTS } from '../apps/sfx-bench/src/batchSixVisualV2.js'
import { createBatchSevenFx, BATCH_SEVEN_EFFECTS } from '../apps/sfx-bench/src/batchSevenVisual.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => { resolve=yes;reject=no }); return { promise,resolve,reject } }
const batches = [
  { ids: ['fire-blast','solar-beam','razor-leaf','sludge-bomb','overheat','eruption','earthquake','thunder','blizzard','bubble-beam'], effects: BATCH_FIVE_V4_EFFECTS, factory: createBatchFiveV4Fx },
  { ids: ['leaf-blade','tri-attack','meteor-mash','ancient-power','sacred-fire'], effects: BATCH_SIX_V2_EFFECTS, factory: createBatchSixV2Fx },
  { ids: ['sing','grass-whistle','attract','morning-sun','moonlight','confuse-ray'], effects: BATCH_SEVEN_EFFECTS, factory: createBatchSevenFx },
]
const request = (id = 'ancient-power', sourceId = 'source') => ({ moveId: id, sourceId, targetIds: [sourceId === 'source' ? 'target' : 'source'], visualSeed: 42 })
function display(node) {
  return { label:node.label,x:node.x,y:node.y,rotation:node.rotation,alpha:node.alpha,visible:node.visible,
    sx:node.scale.x,sy:node.scale.y,tint:node.tint,anchor:node.anchor ? [node.anchor.x,node.anchor.y] : null,
    graphics:node.context?.instructions.map(({action,data}) => {
      const {texture,...style}=data.style;return {action,style,path:data.path.instructions}
    }), children:node.children?.map(display) }
}
function clean(scene) {
  assert.equal(scene.effects.children.length,0);assert.equal(scene.camera.x,0);assert.equal(scene.camera.y,0)
  for(const actor of scene.actors.values()) {
    assert.equal(actor.pose.x,0);assert.equal(actor.pose.y,0);assert.equal(actor.pose.rotation,0)
    assert.equal(actor.pose.scale.x,1);assert.equal(actor.pose.scale.y,1);assert.equal(actor.pose.alpha,1);assert.equal(actor.pose.tint,0xffffff)
  }
}
function harness(factory = createAcceptedBattleFx, options = {}) {
  const scene=createSceneGraph(),timelines=[],events=[]
  const rock=new Texture({source:new TextureSource({width:16,height:16})})
  const fx=factory({glowTexture:Texture.WHITE,assetLoader:(key,url)=>{events.push(`load:${key}`);return Promise.resolve(rock)},
    timelineEngine:{timeline(vars){events.push('timeline');const tl=gsap.timeline({...vars,paused:true});tl.play=()=>{events.push('play');return tl};timelines.push(tl);return tl}},...options})
  return {scene,fx,rock,timelines,events,get tl(){return timelines.at(-1)},
    sample:()=>JSON.parse(JSON.stringify({effects:display(scene.effects),actors:[...scene.actors.values()].map(actor=>display(actor.pose)),terrain:display(scene.terrain),camera:[scene.camera.x,scene.camera.y]})),
    dispose(){fx.dispose();scene.dispose();gsap.ticker.sleep();assert.equal(rock.destroyed,false);rock.destroy(true)} }
}

test('production promotes the exact latest recipe identities and authored timings, preserving original metadata and all other moves', async () => {
  const changed=new Set(['thunder-punch'])
  for(const batch of batches) for(const id of batch.ids) {
    const actual=ACCEPTED_MOVE_EFFECTS[id],review=batch.effects[id]
    assert.equal(actual.build,review.build,`${id} uses the exact latest reviewed builder`)
    assert.deepEqual(actual,review,`${id} retains every descriptor field`)
    assert.deepEqual(ACCEPTED_EFFECT_TIMINGS[id],{contact:review.contact,duration:review.duration})
    if(id!=='razor-leaf')changed.add(id)
  }
  assert.deepEqual(Object.keys(ACCEPTED_MOVE_EFFECTS),Object.keys(MOVE_EFFECTS))
  for(const [id,original] of Object.entries(MOVE_EFFECTS)) if(!changed.has(id))assert.equal(ACCEPTED_MOVE_EFFECTS[id],original)
  assert.equal(ACCEPTED_MOVE_EFFECTS['morning-sun'].subject,'source');assert.equal(ACCEPTED_MOVE_EFFECTS.moonlight.subject,'source')
  assert.ok(Object.isFrozen(ACCEPTED_MOVE_EFFECTS));assert.ok(Object.isFrozen(ACCEPTED_EFFECT_TIMINGS))
  for(const file of ['accepted-effects.js','accepted-recipes.js']) {
    const source=await readFile(new URL(`../packages/battle-fx/src/${file}`,import.meta.url),'utf8')
    assert.doesNotMatch(source,/from ['"][^'"]*(?:apps\/|battle-core|battle-sfx|vue|pokemon-sprites)/)
  }
})

test('all 21 promoted moves match the reviewed geometry, poses, cues and cleanup in both directions', async () => {
  for(const batch of batches) for(const id of batch.ids) for(const sourceId of ['source','target']) {
    const actual=harness(),review=harness(batch.factory),effect=batch.effects[id],frames=[]
    try {
      for(const h of [actual,review]) {
        const cues=[],samples=[],run=h.fx.play(request(id,sourceId),{scene:h.scene,onCue:cue=>cues.push([cue.type,h.tl.time()])})
        await tick();assert.ok(h.tl,`${id} created a timeline`)
        assert.ok(Math.abs(h.tl.duration()-effect.duration)<1e-6)
        for(const time of [.12,effect.contact-.0001,effect.contact,effect.contact+.04,(effect.contact+effect.duration)/2,effect.duration-.03]) {
          h.tl.time(time,false);samples.push(h.sample())
        }
        assert.deepEqual(cues,[['impact',effect.contact]],`${id} one exact result cue`)
        frames.push(samples);h.tl.time(effect.duration,false);assert.equal((await run.finished).status,'completed');clean(h.scene)
      }
      assert.deepEqual(frames[0],frames[1],`${id}, ${sourceId}: production display parity`)
    } finally {actual.dispose();review.dispose()}
  }
})

test('accepted healing descriptors work source-only and custom registries retain control without rock preload', async () => {
  for(const id of ['morning-sun','moonlight']) for(const sourceId of ['source','target']) {
    const h=harness()
    try {
      const run=h.fx.play({...request(id,sourceId),targetIds:[]},{scene:h.scene});await tick()
      assert.ok(h.scene.effects.getChildByLabel(`${id}-healing`,true));h.tl.time(ACCEPTED_EFFECT_TIMINGS[id].duration,false)
      assert.equal((await run.finished).status,'completed');clean(h.scene)
    } finally {h.dispose()}
  }
  let built=0,loaded=0
  const custom=harness(createAcceptedBattleFx,{effects:{'ancient-power':{subject:'source',contact:.2,duration:.4,build(context){built++;context.tl.call(()=>context.onCue({type:'impact'}),[],.2)}}},assetLoader:()=>{loaded++;throw new Error('custom should not load accepted rock')}})
  try {
    const run=custom.fx.play({...request(),targetIds:[]},{scene:custom.scene});await tick();assert.equal(built,1);assert.equal(loaded,0)
    custom.tl.time(.4,false);assert.equal((await run.finished).status,'completed');clean(custom.scene)
    assert.equal((await custom.fx.play(request('sing'),{scene:custom.scene}).finished).status,'skipped')
  } finally {custom.dispose()}
})

test('Ancient Power loads the shared rendered rock before timeline creation and presentation start', async () => {
  const pending=deferred(),loads=[],starts=[]
  const h=harness(options=>createClockedBattleFx({...options,createFx:createAcceptedBattleFx}),{assetLoader:(key,url)=>{loads.push([key,url]);return pending.promise}})
  try {
    const run=h.fx.play(request(),{scene:h.scene,onPresentation:event=>{if(event.type==='start')starts.push(event)}})
    await tick();assert.equal(loads.length,1);assert.equal(loads[0][0],'rock');assert.match(loads[0][1],/\/assets\/rock\.svg$/)
    assert.equal(h.timelines.length,0);assert.equal(starts.length,0);clean(h.scene)
    pending.resolve(h.rock);await tick();assert.equal(h.timelines.length,1);assert.equal(starts.length,1)
    assert.equal(h.scene.effects.getChildByLabel('ancient-power-rendered-rock-0',true).texture,h.rock)
    assert.equal(h.rock.source.scaleMode,'nearest')
    h.tl.time(2.4,false);assert.equal((await run.finished).status,'completed');clean(h.scene);assert.equal(h.rock.destroyed,false)
  } finally {h.dispose()}
})

test('pending accepted rock loads cancel, abort, dispose and replace without borrowing poses or restarting stale playback', async () => {
  for(const mode of ['cancel','abort','dispose','replace']) {
    const pending=deferred(),h=harness(createAcceptedBattleFx,{assetLoader:()=>pending.promise}),signal=new AbortController()
    try {
      const first=h.fx.play(request(),{scene:h.scene,signal:signal.signal});await tick();let replacement
      if(mode==='cancel')first.cancel()
      else if(mode==='abort')signal.abort()
      else if(mode==='dispose')h.fx.dispose()
      else replacement=h.fx.play(request('sing','target'),{scene:h.scene})
      assert.equal((await first.finished).status,'cancelled');await tick()
      const count=h.timelines.length;pending.resolve(h.rock);await tick();assert.equal(h.timelines.length,count)
      first.cancel()
      if(replacement){h.tl.time(4.19,false);assert.equal((await replacement.finished).status,'completed')}
      clean(h.scene)
    } finally {h.dispose()}
  }
  const pending=deferred(),h=harness(createAcceptedBattleFx,{assetLoader:()=>pending.promise})
  try {
    const first=h.fx.play(request('sing'),{scene:h.scene});await tick();h.tl.time(.3,false)
    const next=h.fx.play(request('ancient-power','target'),{scene:h.scene});assert.equal((await first.finished).status,'cancelled');clean(h.scene)
    pending.resolve(h.rock);await tick();h.tl.time(.5,false);const pose=h.sample();first.cancel();assert.deepEqual(h.sample(),pose)
    h.tl.time(2.4,false);assert.equal((await next.finished).status,'completed');clean(h.scene)
  } finally {h.dispose()}
})

test('rock loads are shared across scenes, retry after failure, and are unnecessary for skipped or reduced playback', async () => {
  let loads=0;const pending=deferred(),h=harness(createAcceptedBattleFx,{assetLoader:()=>{loads++;return pending.promise}}),other=createSceneGraph()
  try {
    const a=h.fx.play(request(),{scene:h.scene}),b=h.fx.play(request('ancient-power','target'),{scene:other})
    assert.equal(loads,1);a.cancel();pending.resolve(h.rock);await tick();assert.equal(h.timelines.length,1)
    h.tl.time(2.4,false);assert.equal((await b.finished).status,'completed');clean(h.scene);clean(other)
    const again=h.fx.play(request(),{scene:h.scene});await tick();assert.equal(loads,1);h.tl.time(2.4,false);assert.equal((await again.finished).status,'completed')
  } finally {other.dispose();h.dispose()}
  for(const error of [new Error('rock load failed'),null,'missing']) {
    let attempts=0;const h=harness(createAcceptedBattleFx,{assetLoader:()=>++attempts===1?Promise.reject(error):Promise.resolve(Texture.WHITE)})
    try {
      const failed=h.fx.play(request(),{scene:h.scene});assert.deepEqual(await failed.finished,{status:'failed',reason:error?.message??String(error)});clean(h.scene)
      const retry=h.fx.play(request(),{scene:h.scene});await tick();assert.equal(attempts,2);h.tl.time(2.4,false);assert.equal((await retry.finished).status,'completed');clean(h.scene)
    } finally {h.dispose()}
  }
  const skipped=harness(createAcceptedBattleFx,{assetLoader:()=>{throw new Error('must not preload')}})
  try {
    for(const patch of [{outcome:'miss'},{phase:'prepare'}])assert.equal((await skipped.fx.play({...request(),...patch},{scene:skipped.scene}).finished).status,'skipped')
    const reduced=skipped.fx.play(request(),{scene:skipped.scene,reducedMotion:true});await tick();skipped.tl.time(.8,false);assert.equal((await reduced.finished).status,'completed');clean(skipped.scene)
  } finally {skipped.dispose()}
})

test('accepted rock loading has an owned deadline and ignores late success after timeout', async t => {
  t.mock.timers.enable({apis:['setTimeout']})
  const pending=deferred(),h=harness(createAcceptedBattleFx,{assetLoader:()=>pending.promise,deadlineMs:100})
  try {
    const run=h.fx.play(request(),{scene:h.scene});t.mock.timers.tick(100);await tick()
    const result=await run.finished;assert.equal(result.status,'failed');assert.match(result.reason,/loading.*deadline/);clean(h.scene)
    pending.resolve(h.rock);await tick();assert.equal(h.timelines.length,0)
  } finally {h.dispose()}
})
