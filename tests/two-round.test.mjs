import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS, PHASE_TIMINGS, FX_CATALOG } from '@battle/battle-fx'
import { MOVE_RULES } from '@battle/battle-core'
import { MOVES } from '../apps/game/src/moveCatalog.js'
import { createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { previewSceneActors } from '../apps/game/src/scene/previewActors.js'
import { STARTER_SPRITES } from '../apps/game/src/scene/spriteViews.js'

const ids=['fly','bounce','dig','dive'],damages=[64,58,56,56]
const tick=()=>new Promise(resolve=>setImmediate(resolve))
function harness(options){
  let timeline
  const scene=createSceneGraph(options)
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(opts){return timeline=gsap.timeline({...opts,paused:true})}}})
  return{scene,fx,get tl(){return timeline},node(label){return scene.effects.getChildByLabel(label,true)},world(node){return scene.effects.toLocal({x:0,y:0},node)},dispose(){fx.dispose();scene.dispose()}}
}
function clean(h){
  assert.equal(h.scene.effects.children.length,0)
  for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.tint,0xffffff)}
}
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.035,`${label}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`)

test('round one is an immutable no-op and round two independently commits damage once without turn state',()=>{
  for(const [i,id]of ids.entries())for(const sourceId of ['a','b']){
    const targetId=sourceId==='a'?'b':'a',move=MOVES.find(m=>m.id===id)
    const actors=[{id:sourceId,name:'User',hp:50,maxHp:160,condition:'burn',attackStage:2},{id:targetId,name:'Opponent',hp:1,maxHp:160,condition:'poison',confused:true}]
    const options={sourceId,targetId,actors},prepare=createPreviewTransaction(move,{...options,phase:'prepare'})
    assert.equal(prepare.before,prepare.after);assert.equal(prepare.after.revision,0);assert.ok(Object.isFrozen(prepare)&&Object.isFrozen(prepare.event))
    assert.equal(prepare.event.phase,'prepare');assert.deepEqual(prepare.event.targetIds,[]);assert.equal(prepare.event.afterHp,undefined)
    assert.deepEqual(FX_CATALOG.find(m=>m.id===id).phases,['prepare','attack']);assert.deepEqual(PHASE_TIMINGS[id].attack,EFFECT_TIMINGS[id])
    assert.doesNotThrow(()=>createPreviewTransaction(move,{sourceId,actors:[actors[0]],phase:'prepare'}))
    const attack=createPreviewTransaction(move,{...options,phase:'attack'}),implicit=createPreviewTransaction(move,options)
    assert.deepEqual(attack,implicit);assert.equal(attack.after.actors[targetId].hp,0);assert.deepEqual(attack.after.actors[sourceId],attack.before.actors[sourceId])
    assert.equal(attack.after.actors[targetId].condition,'poison');assert.equal(attack.after.actors[targetId].confused,true)
    assert.equal(move.damage,damages[i]);assert.equal(attack.after.revision,1)
    assert.throws(()=>createPreviewTransaction(move,{...options,phase:'invalid'}),/Unsupported/)
    assert.throws(()=>createPreviewTransaction(move,{...options,phase:'prepare',allowedMoveIds:[]}),/not available/)
    assert.throws(()=>createPreviewTransaction(MOVE_RULES.find(m=>m.id===id),{...options,phase:'prepare'}),/Unsupported/)
  }
  assert.throws(()=>createPreviewTransaction(MOVES[0],{phase:'prepare'}),/Unsupported/)
})

test('preparation routing survives FX off, skip, failure and stale cues without animating HP',async()=>{
  for(const id of ids)for(const mode of ['off','prepare','skip','failure','reset']){
    const tx=createPreviewTransaction(MOVES.find(m=>m.id===id),{phase:'prepare'}),displays=[]
    let callback,request,imports=0
    const presenter=createPresenter({getScene:()=>({}),onDisplay:v=>displays.push(v),loadFx:()=>{
      imports++;if(mode==='failure')throw Error('Unavailable')
      return{play(req,opts){request=req;callback=opts.onCue;return{finished:new Promise(()=>{}),cancel(){}}}}
    }})
    const done=presenter.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(callback){
      assert.equal(request.phase,'prepare');assert.deepEqual(request.targetIds,[])
      const n=displays.length;callback({type:'impact'});callback({type:'recovery'});assert.equal(displays.length,n)
      callback({type:'prepared'});callback({type:'prepared'});assert.equal(displays.length,n+1);assert.equal(displays.at(-1).animate,false)
      if(mode==='reset'){presenter.reset(tx.before,'Fresh preview');callback({type:'prepared'});assert.equal(displays.at(-1).message,'Fresh preview')}
      else presenter.skip()
    }
    await done
    assert.equal(displays.at(-1).state,tx.after);assert.ok(displays.every(v=>v.animate===false));if(mode==='off')assert.equal(imports,0)
    presenter.destroy()
  }
})

test('source-only preparation conceals then cleans up for either side, nine starters, reduced motion and cancellation',async()=>{
  const roster=Object.keys(STARTER_SPRITES)
  for(const [i,near]of roster.entries())for(const sourceId of ['source','target']){
    const h=harness({actors:previewSceneActors(near,roster[(i+1)%roster.length])}),source=h.scene.actor(sourceId),other=h.scene.actor(sourceId==='source'?'target':'source')
    try{for(const id of ids)for(const reducedMotion of [false,true]){
      const cues=[],time=reducedMotion?.8:PHASE_TIMINGS[id].prepare.duration
      const otherPose={x:other.pose.x,y:other.pose.y,alpha:other.pose.alpha},base=source.base('ground')
      const run=h.fx.play({moveId:id,phase:'prepare',sourceId,targetIds:['nonexistent'],visualSeed:42},{scene:h.scene,reducedMotion,onCue:c=>cues.push(c.type)})
      await tick();assert.equal(h.tl.duration(),time)
      for(let t=.025;t<time;t+=.035){
        h.tl.time(t,false)
        assert.deepEqual({x:other.pose.x,y:other.pose.y,alpha:other.pose.alpha},otherPose)
        const walk=node=>{assert.ok(node.alpha>=0&&node.alpha<=1,id+' opacity');for(const child of node.children??[])walk(child)};walk(h.scene.effects)
        assert.deepEqual(source.base('ground'),base)
      }
      if(!reducedMotion)assert.equal(source.pose.alpha,0,id+' finishes concealed before preview cleanup')
      assert.deepEqual(cues,['prepared'])
      h.tl.time(time,false);assert.equal((await run.finished).status,'completed');clean(h)
      const cancelled=h.fx.play({moveId:id,phase:'prepare',sourceId},{scene:h.scene,reducedMotion});await tick();h.tl.time(time*.6,false);cancelled.cancel()
      assert.equal((await cancelled.finished).status,'cancelled');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('phase attacks land on supplied body sockets, masked copies align, and every actor returns from concealment',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall'])for(const snapshot of [false,true]){
    const h=harness({width:720,height:600,actors:[
      {id:'source',profile,x:reversed?.73:.27,y:.82,height:.3,facing:reversed?-1:1,anchors:{origin:[.43,.94],tackle:[.72,.58],slam:[.51,.55],body:[.66,.53]}},
      {id:'target',profile:'wide',x:reversed?.26:.74,y:.63,height:.21,facing:reversed?1:-1,anchors:{center:[.46,.43]}},
    ]}),source=h.scene.actor('source'),target=h.scene.actor('target')
    if(!snapshot)delete source.snapshot
    try{for(const id of ids){
      const timing=EFFECT_TIMINGS[id],socket=id==='fly'?'tackle':id==='bounce'?'slam':'body',cues=[]
      const run=h.fx.play({moveId:id,phase:'attack',sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{
        cues.push(c.type);close(h.world(h.node(id+'-impact')),source.anchor(socket),id+' geometry updated before cue')
      }})
      await tick();assert.equal(source.pose.alpha,0,id+' independent attack starts concealed')
      h.tl.time(timing.contact-.001,false);assert.deepEqual(cues,[])
      h.tl.time(timing.contact,false);assert.deepEqual(cues,['impact'])
      const contact=source.anchor(socket),center=target.anchor('visualCenter')
      assert.ok(Math.abs(contact.x-center.x)<=target.metrics.width/2+.04&&Math.abs(contact.y-center.y)<=target.metrics.height/2+.04,id+' intersects recipient')
      assert.equal(target.pose.alpha,1)
      if(snapshot&&['dig','dive'].includes(id)){
        const copy=h.node(id+'-emergence-copy'),mask=h.node(id+'-emergence-clip')
        close(h.world(copy),source.anchor('origin'),id+' copy registration matches live actor')
        assert.equal(copy.mask,mask);assert.ok(contact.y<=target.base('ground').y,'contact emerges above mask plane')
      }else assert.ok(source.pose.alpha>.99,id+' visible at contact')
      const before=source.anchor(socket);h.scene.fit(320,480);close(source.anchor(socket),before,'uniform viewport fit')
      h.tl.time(timing.duration-.02,false);assert.ok(Math.abs(source.pose.x)<.001&&Math.abs(source.pose.y)<.001);assert.equal(source.pose.alpha,1)
      h.tl.time(timing.duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('invalid phases skip safely and preparation never touches an unrequested opponent pose',async()=>{
  const h=harness(),other=h.scene.actor('target');other.pose.x=7;other.pose.alpha=.6
  try{
    for(const request of [{moveId:'fly',phase:'typo'},{moveId:'slash',phase:'prepare'}]){
      const run=h.fx.play({...request,sourceId:'source',targetIds:['target']},{scene:h.scene});assert.equal((await run.finished).status,'skipped');assert.equal(h.scene.effects.children.length,0)
    }
    const run=h.fx.play({moveId:'dig',phase:'prepare',sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.tl.time(PHASE_TIMINGS.dig.prepare.duration,false);await run.finished
    assert.equal(other.pose.x,7);assert.equal(other.pose.alpha,.6)
  }finally{h.dispose();gsap.ticker.sleep()}
})
