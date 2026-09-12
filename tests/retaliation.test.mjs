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
const ids=['counter','mirror-coat','pain-split','endeavor']
const state=(a=70,b=150,maxA=156,maxB=160)=>createBattleState([{id:'a',name:'User',hp:a,maxHp:maxA,condition:'burn',attackStage:2},{id:'b',name:'Opponent',hp:b,maxHp:maxB,condition:'poison',confused:true}])

test('retaliation needs a matching received hit and returns double without changing the user',()=>{
  for(const [moveId,category]of [['counter','physical'],['mirror-coat','special']])for(const reversed of [false,true]){
    const sourceId=reversed?'b':'a',targetId=reversed?'a':'b',before=state(),hit={sourceId:targetId,targetId:sourceId,category,damage:32}
    const tx=resolveMove(before,{moveId,sourceId,targetId,previousHit:hit})
    assert.equal(tx.event.outcome,'hit');assert.deepEqual(tx.after.actors[sourceId],before.actors[sourceId])
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:before.actors[targetId].hp-64})
    for(const previousHit of [undefined,null,{}, {...hit,category:category==='physical'?'special':'physical'}, {...hit,damage:0}, {...hit,damage:-1}, {...hit,damage:NaN}, {...hit,damage:Infinity}, {...hit,damage:1.5}, {...hit,sourceId}, {...hit,targetId}]){
      const failed=resolveMove(before,{moveId,sourceId,targetId,previousHit})
      assert.equal(failed.event.outcome,'failed');assert.deepEqual(failed.after.actors,before.actors)
    }
    assert.equal(resolveMove(before,{moveId,sourceId,targetId,previousHit:{...hit,damage:1000}}).after.actors[targetId].hp,0)
    assert.deepEqual(before,state());assert.ok(Object.isFrozen(tx.after.actors[sourceId]))
  }
})

test('Pain Split averages and caps both HP values; Endeavor only lowers a healthier target',()=>{
  for(const [a,b,maxA,maxB]of [[61,160,156,160],[150,21,156,160],[20,200,40,200],[40,40,156,160],[1,1,156,160]])for(const reversed of [false,true]){
    const before=state(a,b,maxA,maxB),sourceId=reversed?'b':'a',targetId=reversed?'a':'b'
    const split=resolveMove(before,{moveId:'pain-split',sourceId,targetId}),average=Math.floor((a+b)/2)
    assert.equal(split.event.outcome,'hit');assert.deepEqual(split.after.actors.a,{...before.actors.a,hp:Math.min(maxA,average)})
    assert.deepEqual(split.after.actors.b,{...before.actors.b,hp:Math.min(maxB,average)})
    assert.equal(split.event.healing,undefined);assert.equal(split.event.hpSplit,true)
    const end=resolveMove(before,{moveId:'endeavor',sourceId,targetId}),source=before.actors[sourceId],target=before.actors[targetId]
    assert.equal(end.event.outcome,source.hp<target.hp?'hit':'failed')
    assert.deepEqual(end.after.actors[sourceId],source);assert.deepEqual(end.after.actors[targetId],{...target,hp:Math.min(target.hp,source.hp)})
    assert.deepEqual(before,state(a,b,maxA,maxB))
  }
})

test('fresh fixtures preserve fainting and both HP bars reconcile once with effects off, impact, skip or failure',async()=>{
  for(const sourceId of ['source','target'])for(const moveId of ids){
    const move=MOVE_RULES.find(m=>m.id===moveId),targetId=sourceId==='source'?'target':'source'
    const tx=createPreviewTransaction(move,{sourceId,targetId})
    assert.equal(tx.event.outcome,'hit');assert.ok(tx.before.actors[sourceId].hp<tx.before.actors[sourceId].maxHp)
    for(const mode of ['off','impact','skip','failure']){
      let options,imports=0;const displays=[]
      const p=createPresenter({getScene:()=>({}),onDisplay:v=>displays.push(v),loadFx:()=>{imports++;if(mode==='failure')throw Error('unavailable');return{play(request,opts){assert.equal(request.previousHit,undefined);options=opts;return{finished:new Promise(()=>{}),cancel(){}}}}}})
      const run=p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
      if(mode==='impact'){options.onCue({type:'recovery'});assert.equal(displays.at(-1).state,tx.before);options.onCue({type:'impact'});options.onCue({type:'impact'});assert.equal(displays.at(-1).state,tx.after);assert.equal(displays.filter(d=>d.animate).length,1);p.skip()}
      if(mode==='skip')p.skip()
      await run;assert.equal(displays.at(-1).state,tx.after);if(mode==='off')assert.equal(imports,0)
      const fresh=createPreviewState(move,{sourceId});p.reset(fresh);options?.onCue({type:'impact'});assert.equal(displays.at(-1).state,fresh);p.destroy()
    }
    const actors=[{id:sourceId,name:'Fainted',hp:0,maxHp:156},{id:targetId,name:'Alive',hp:160,maxHp:160}]
    assert.equal(createPreviewState(move,{sourceId,actors}).actors[sourceId].hp,0)
    assert.throws(()=>createPreviewTransaction(move,{sourceId,targetId,actors}),/fainted/)
  }
})

function harness(reversed,profile,edge=false,high=false){
  let timeline
  const scene=createSceneGraph({width:720,height:600,actors:[
    {id:'source',profile,x:reversed?.74:.26,y:.82,height:.3,facing:reversed?-1:1,anchors:{origin:[.43,.94],hand:[.76,.43],aura:[.5,.48]}},
    {id:'target',profile:'tall',x:reversed?(edge?.06:.26):(edge?.94:.74),y:high?.3:.62,height:high?.3:.18,facing:reversed?1:-1,anchors:{center:high?[.5,.1]:[.29,.44]}},
  ]})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},node(label){return scene.effects.getChildByLabel(label,true)},point(n){return scene.effects.toLocal({x:0,y:0},n)},dispose(){fx.dispose();scene.dispose()}}
}
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.04,label)
function clean(h){assert.equal(h.scene.effects.children.length,0);for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.rotation,0);assert.equal(a.pose.tint,0xffffff)}}
test('retaliation and HP exchanges contact before cues and recover in both directions',async()=>{
  for(const reversed of [false,true])for(const profile of ['tall','wide']){
    const h=harness(reversed,profile),target=h.scene.actor('target'),source=h.scene.actor('source')
    try{for(const moveId of ids){
      const timing=EFFECT_TIMINGS[moveId],cues=[]
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{
        cues.push(c.type)
        if(moveId==='pain-split'){close(h.point(h.node('pain-split-transfer-0-9')),target.anchor('aura'),'last outward transfer arrived');close(h.point(h.node('pain-split-transfer-1-9')),source.anchor('aura'),'last inward transfer arrived')}
        else close(h.point(h.node(({'counter':'counter-strike','mirror-coat':'mirror-coat-return-0','endeavor':'endeavor-front'})[moveId])),target.anchor('center'),moveId+' contact before cue')
      }})
      await tick();h.tl.time(timing.contact-.005,false);assert.equal(cues.length,0);h.tl.time(timing.contact,false);assert.deepEqual(cues,['impact'])
      h.tl.time(timing.duration,false);assert.equal((await run.finished).status,'completed');clean(h)
      const replay=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.tl.time(timing.contact+.1,false);replay.cancel();await replay.finished;clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
test('new strikes and exchanges fit complete actor/effect silhouettes near field edges',async()=>{
  for(const reversed of [false,true])for(const high of [false,true]){
    const h=harness(reversed,'tall',!high,high)
    try{for(const moveId of ids){
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
      for(let t=.06;t<EFFECT_TIMINGS[moveId].duration-.02;t+=.035){
        h.tl.time(t,false)
        for(const a of h.scene.actors.values()){
          const p=a.anchor('visualCenter'),rx=a.metrics.width/2,ry=a.metrics.height/2
          assert.ok(p.x-rx>=-.04&&p.x+rx<=720.04&&p.y-ry>=-.04&&p.y+ry<=600.04,moveId+' actor fits at '+t)
          assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)
        }
        const walk=(n,parent=1)=>{const alpha=parent*n.alpha;assert.ok(n.alpha>=0&&n.alpha<=1);if(alpha>.03&&['Graphics','Sprite'].includes(n.constructor.name)){const b=n.getBounds();assert.ok(b.x>=-.04&&b.y>=-.04&&b.x+b.width<=720.04&&b.y+b.height<=600.04,`${moveId} ${n.label} at ${t}: ${JSON.stringify(b)}`)}for(const c of n.children??[])walk(c,alpha)};walk(h.scene.effects)
      }
      h.tl.time(EFFECT_TIMINGS[moveId].duration,false);await run.finished;clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
