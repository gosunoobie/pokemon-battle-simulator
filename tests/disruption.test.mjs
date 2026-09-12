import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createPreviewState, createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const ids=['disable','encore','torment','imprison','taunt','swagger','flatter','fake-tears']
const restrictions={disable:'disabled',encore:'encored',torment:'tormented',imprison:'imprisoning',taunt:'taunted'}
const state=(extra={})=>createBattleState([{id:'a',name:'User',hp:89,maxHp:156,condition:'burn',attackStage:1}, {id:'b',name:'Opponent',hp:121,maxHp:160,condition:'poison',defenseStage:2,...extra}])

test('restriction badges preserve HP, target the correct side and do not enforce a battle engine',()=>{
  for(const [moveId,key] of Object.entries(restrictions))for(const reversed of [false,true]){
    const before=state(),sourceId=reversed?'b':'a',targetId=reversed?'a':'b',affectedId=moveId==='imprison'?sourceId:targetId
    const tx=resolveMove(before,{moveId,sourceId,targetId})
    assert.equal(tx.event.outcome,'hit');assert.deepEqual(tx.event.targetIds,[affectedId])
    for(const id of ['a','b'])assert.deepEqual(tx.after.actors[id],{...before.actors[id],...(id===affectedId?{[key]:true}:{})})
    assert.match(tx.event.resultMessage,/preview/i);assert.equal(tx.event.healing,undefined)
    const repeated=resolveMove(tx.after,{moveId,sourceId,targetId})
    assert.equal(repeated.event.outcome,'failed');assert.deepEqual(repeated.after.actors,tx.after.actors)
    assert.equal(resolveMove(tx.after,{moveId:'tackle',sourceId:affectedId,targetId:affectedId==='a'?'b':'a'}).event.outcome,'hit')
    assert.deepEqual(before,state());assert.ok(Object.isFrozen(tx.after.actors[affectedId]))
    for(const value of [1,'true',{},[]])assert.throws(()=>state({[key]:value}),/restriction/)
  }
  const alone=createBattleState([{id:'a',name:'Alone',hp:50,maxHp:100}])
  assert.equal(resolveMove(alone,{moveId:'imprison',sourceId:'a'}).after.actors.a.imprisoning,true)
  assert.throws(()=>resolveMove(alone,{moveId:'disable',sourceId:'a',targetId:'a'}),/participants/)
})

test('Swagger and Flatter succeed if either component changes; Fake Tears respects the lower cap',()=>{
  for(const [moveId,key,change] of [['swagger','attackStage',2],['flatter','specialAttackStage',1]])for(const stage of [-6,0,5,6])for(const confused of [false,true])for(const reversed of [false,true]){
    const sourceId=reversed?'b':'a',targetId=reversed?'a':'b'
    const before=createBattleState([{id:sourceId,name:'User',hp:70,maxHp:100,condition:'burn'}, {id:targetId,name:'Target',hp:90,maxHp:110,condition:'poison',[key]:stage,confused,reflect:true}])
    const tx=resolveMove(before,{moveId,sourceId,targetId}),next=Math.min(6,stage+change)
    assert.deepEqual(tx.after.actors[sourceId],before.actors[sourceId]);assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],[key]:next,confused:true})
    assert.equal(tx.event.outcome,next===stage&&confused?'failed':'hit');assert.match(tx.event.resultMessage,/Attack/);assert.match(tx.event.resultMessage,/confused/)
    assert.equal(tx.event.healing,undefined)
  }
  for(const stage of [0,-5,-6]){
    const before=state({specialDefenseStage:stage}),tx=resolveMove(before,{moveId:'fake-tears',sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.b,{...before.actors.b,specialDefenseStage:Math.max(-6,stage-2)})
    assert.equal(tx.event.outcome,stage===-6?'failed':'hit');assert.match(tx.event.resultMessage,/Special Defense/)
  }
})

test('all eight results reconcile with optional FX and reset rejects stale cues',async()=>{
  for(const moveId of ids)for(const sourceId of ['source','target'])for(const mode of ['off','impact','skip','failure']){
    const move=MOVE_RULES.find(m=>m.id===moveId),targetId=sourceId==='source'?'target':'source',tx=createPreviewTransaction(move,{sourceId,targetId})
    assert.equal(tx.event.outcome,'hit');assert.equal(tx.after.actors.source.hp,156);assert.equal(tx.after.actors.target.hp,160)
    let opts,imports=0;const views=[]
    const p=createPresenter({getScene:()=>({}),onDisplay:v=>views.push(v),loadFx:()=>{imports++;if(mode==='failure')throw Error('not loaded');return{play(request,options){opts=options;assert.equal(request.actors,undefined);assert.equal(request.confused,undefined);return{finished:new Promise(()=>{}),cancel(){}}}}}})
    const run=p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='impact'){assert.equal(views.at(-1).state,tx.before);opts.onCue({type:'impact'});assert.equal(views.at(-1).state,tx.after);p.skip()}
    if(mode==='skip')p.skip()
    await run;assert.equal(views.at(-1).state,tx.after);if(mode==='off')assert.equal(imports,0)
    const fresh=createPreviewState(move,{sourceId});p.reset(fresh);opts?.onCue({type:'impact'});assert.equal(views.at(-1).state,fresh)
    for(const actor of Object.values(fresh.actors))for(const key of [...Object.values(restrictions),'confused'])assert.equal(actor[key],false)
    p.destroy()
  }
})

function harness(reversed,profile,edge=false){
  let timeline
  const scene=createSceneGraph({width:720,height:600,actors:[
    {id:'source',profile,x:reversed?.75:.25,y:.8,height:.3,facing:reversed?-1:1,anchors:{origin:[.43,.94],eyes:[.62,.22],hand:[.72,.48],aura:[.5,.4]}},
    {id:'target',profile:'tall',x:reversed?(edge?.055:.25):(edge?.945:.75),y:edge?.31:.62,height:edge?.3:.18,facing:reversed?1:-1,anchors:{center:[.48,.12]}},
  ]})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},node:label=>scene.effects.getChildByLabel(label,true),point:n=>scene.effects.toLocal({x:0,y:0},n),dispose(){fx.dispose();scene.dispose()}}
}
function clean(h){assert.equal(h.scene.effects.children.length,0);for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.rotation,0);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)}}
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.04,label)
test('new effects attach before impact in both directions and keep their flowing art within field bounds',async()=>{
  for(const reversed of [false,true])for(const profile of ['tall','wide'])for(const edge of [false,true]){
    const h=harness(reversed,profile,edge)
    try{for(const moveId of ids){
      const timing=EFFECT_TIMINGS[moveId],cues=[]
      const run=h.fx.play({moveId,sourceId:'source',targetIds:moveId==='imprison'?[]:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{
        cues.push(c.type)
        const label=({'disable':'disable-pulse-0','encore':'encore-applause','torment':'torment-field','imprison':'imprison-seal','taunt':'taunt-wave-0','swagger':'swagger-star','flatter':'flatter-light-0','fake-tears':'fake-tears-plea-0'})[moveId]
        close(h.point(h.node(label)),h.scene.actor(moveId==='imprison'?'source':'target').anchor(moveId==='imprison'?'aura':'center'),moveId+' reached before cue')
      }})
      await tick();h.tl.time(timing.contact-.001,false);assert.equal(cues.length,0);h.tl.time(timing.contact,false);assert.deepEqual(cues,['impact'])
      const poseData=()=>{const rows=[];const walk=n=>{if(n.label!=='move-artwork')rows.push([n.x,n.y,n.rotation,n.scale.x,n.scale.y,n.alpha]);for(const c of n.children??[])walk(c)};walk(h.scene.effects);return rows}
      const first=poseData();h.tl.time(timing.contact+.15,false);assert.notDeepEqual(poseData(),first,moveId+' continuing motion')
      run.cancel();await run.finished;clean(h)
      const replay=h.fx.play({moveId,sourceId:'source',targetIds:moveId==='imprison'?[]:['target'],visualSeed:42},{scene:h.scene});await tick()
      for(let t=.04;t<timing.duration-.02;t+=.045){
        h.tl.time(t,false)
        const walk=(n,parent=1)=>{const alpha=parent*n.alpha;assert.ok(n.alpha>=0&&n.alpha<=1,moveId+' alpha');if(alpha>.03&&n.constructor.name==='Graphics'){const b=n.getBounds();assert.ok(b.x>=-.05&&b.y>=-.05&&b.x+b.width<=720.05&&b.y+b.height<=600.05,`${moveId} ${n.label} at ${t}: ${JSON.stringify(b)}`)}for(const c of n.children??[])walk(c,alpha)};walk(h.scene.effects)
        for(const actor of h.scene.actors.values()){assert.equal(actor.pose.alpha,1);assert.equal(actor.pose.scale.x,1);assert.equal(actor.pose.scale.y,1)}
      }
      h.tl.time(timing.duration,false);assert.equal((await replay.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
