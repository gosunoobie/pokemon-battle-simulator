import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createPreviewState, createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
const ids=['teleport','baton-pass','substitute','recycle','growl','roar','screech','metal-sound','metronome','assist','sleep-talk','nature-power','mud-sport','water-sport','spikes','sweet-scent','fake-out','astonish','tail-whip','tickle','supersonic','sonic-boom','hyper-voice','uproar','lock-on','mind-reader','foresight','odor-sleuth','mimic','psych-up','role-play','skill-swap']
const rule=id=>MOVE_RULES.find(m=>m.id===id),tick=()=>new Promise(resolve=>setImmediate(resolve))
const state=(a={},b={})=>createBattleState([{id:'a',name:'User',hp:100,maxHp:100,condition:'poison',reflect:true,...a},{id:'b',name:'Opponent',hp:160,maxHp:160,condition:'burn',confused:true,...b}])

test('Substitute pays a quarter only with sufficient HP and no existing decoy; Recycle restores eligible item labels',()=>{
  for(const reverse of [false,true]){
    const sourceId=reverse?'b':'a',targetId=reverse?'a':'b'
    for(const [hp,maxHp,substituteHp,expectedHp,expectedSub]of [[100,100,0,75,25],[26,101,0,1,25],[25,101,0,25,0],[100,100,25,100,25],[1,1,0,1,0]]){
      const base=state(),before=createBattleState(Object.values(base.actors).map(a=>a.id===sourceId?{...a,hp,maxHp,substituteHp}:a)),tx=resolveMove(before,{moveId:'substitute',sourceId})
      assert.deepEqual(tx.after.actors[sourceId],{...before.actors[sourceId],hp:expectedHp,substituteHp:expectedSub});assert.deepEqual(tx.after.actors[targetId],before.actors[targetId]);assert.equal(tx.event.outcome,expectedHp<hp?'hit':'failed');assert.equal(tx.event.healing,undefined)
      assert.equal(tx.event.beforeHp,hp);assert.equal(tx.event.afterHp,expectedHp);assert.equal(before.actors[sourceId].hp,hp)
    }
    for(const [heldItem,consumedItem,success]of [[null,'Oran Berry',true],['Sitrus Berry','Oran Berry',false],[null,null,false]]){
      const base=state(),before=createBattleState(Object.values(base.actors).map(a=>a.id===sourceId?{...a,heldItem,consumedItem}:a)),tx=resolveMove(before,{moveId:'recycle',sourceId})
      assert.deepEqual(tx.after.actors[sourceId],{...before.actors[sourceId],heldItem:success?consumedItem:heldItem,consumedItem:success?null:consumedItem});assert.deepEqual(tx.after.actors[targetId],before.actors[targetId]);assert.equal(tx.event.outcome,success?'hit':'failed')
    }
  }
  for(const bad of [-1,1.5,101,'25'])assert.throws(()=>state({substituteHp:bad}),/substitute/)
  for(const bad of ['',1,{},[]])assert.throws(()=>state({consumedItem:bad}),/consumed/)
})

test('Psych Up copies all seven stages and focus to the user without copying HP, conditions, items or guards',()=>{
  const stages={attackStage:3,defenseStage:-2,specialAttackStage:6,specialDefenseStage:-4,speedStage:1,evasionStage:-1,accuracyStage:2}
  for(const reverse of [false,true])for(const focusEnergy of [true,false]){
    const sourceId=reverse?'b':'a',targetId=reverse?'a':'b',base=state({focusEnergy:!focusEnergy,heldItem:'Oran Berry'}),before=createBattleState(Object.values(base.actors).map(a=>a.id===targetId?{...a,...stages,focusEnergy}:a))
    const tx=resolveMove(before,{moveId:'psych-up',sourceId,targetId})
    assert.deepEqual(tx.after.actors[sourceId],{...before.actors[sourceId],...stages,focusEnergy});assert.deepEqual(tx.after.actors[targetId],before.actors[targetId]);assert.equal(tx.event.outcome,'hit');assert.equal(tx.event.healing,undefined);assert.ok(Object.isFrozen(tx.after.actors[sourceId]))
    const actors=[{id:sourceId,name:'User',hp:80,maxHp:100},{id:'extra',name:'Other',hp:70,maxHp:100,attackStage:-3},{id:targetId,name:'Target',hp:90,maxHp:100}]
    const fixture=createPreviewState(rule('psych-up'),{sourceId,targetId,actors});assert.equal(fixture.actors.extra.attackStage,-3);assert.equal(fixture.actors[targetId].attackStage,2);assert.equal(fixture.actors[sourceId].attackStage,0)
  }
})

test('sports coexist with weather, Spikes stacks only to three, and targeting markers do not add battle enforcement',()=>{
  for(const reverse of [false,true]){
    const sourceId=reverse?'b':'a',targetId=reverse?'a':'b',base=state(),before=Object.freeze({...base,weather:'rain'})
    const mud=resolveMove(before,{moveId:'mud-sport',sourceId}),water=resolveMove(mud.after,{moveId:'water-sport',sourceId})
    assert.equal(water.after.mudSport,true);assert.equal(water.after.waterSport,true);assert.equal(water.after.weather,'rain');assert.deepEqual(water.after.actors,before.actors);assert.deepEqual(water.event.targetIds,[])
    assert.equal(resolveMove(water.after,{moveId:'water-sport',sourceId}).event.outcome,'failed')
    const sun=resolveMove(water.after,{moveId:'sunny-day',sourceId});assert.equal(sun.after.mudSport,true);assert.equal(sun.after.waterSport,true);assert.equal(sun.after.weather,'sun')
    let current=before
    for(let i=1;i<=4;i++){const tx=resolveMove(current,{moveId:'spikes',sourceId,targetId});assert.deepEqual(tx.after.actors[targetId],{...current.actors[targetId],spikesLayers:Math.min(3,i)});assert.deepEqual(tx.after.actors[sourceId],current.actors[sourceId]);assert.equal(tx.event.outcome,i===4?'failed':'hit');current=tx.after}
    for(const moveId of ['lock-on','mind-reader','foresight','odor-sleuth']){const key=rule(moveId).supportPreview,tx=resolveMove(before,{moveId,sourceId,targetId});assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],[key]:true});assert.equal(resolveMove(tx.after,{moveId,sourceId,targetId}).event.outcome,'failed')}
  }
  for(const bad of [-1,4,1.5,'1'])assert.throws(()=>state({spikesLayers:bad}),/Spikes/)
})

test('sound and gesture rules keep fixed damage, confusion and capped stat decreases separate from casting-only moves',()=>{
  for(const moveId of ['growl','screech','metal-sound','sweet-scent','tail-whip','tickle'])for(const atFloor of [false,true]){
    const m=rule(moveId),fields={attackChange:'attackStage',defenseChange:'defenseStage',specialDefenseChange:'specialDefenseStage',evasionChange:'evasionStage'},b=Object.fromEntries(Object.values(fields).map(key=>[key,atFloor?-6:0])),before=state({},b),tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    const changed=Object.fromEntries(Object.entries(fields).filter(([key])=>m[key]).map(([key,field])=>[field,Math.max(-6,b[field]+m[key])]))
    assert.deepEqual(tx.after.actors.b,{...before.actors.b,...changed});assert.deepEqual(tx.after.actors.a,before.actors.a);assert.equal(tx.event.outcome,atFloor?'failed':'hit')
  }
  const partial=resolveMove(state({},{attackStage:-6,defenseStage:0}),{moveId:'tickle',sourceId:'a',targetId:'b'});assert.equal(partial.event.outcome,'hit');assert.equal(partial.after.actors.b.attackStage,-6);assert.equal(partial.after.actors.b.defenseStage,-1)
  for(const confused of [false,true]){const before=state({},{confused}),tx=resolveMove(before,{moveId:'supersonic',sourceId:'a',targetId:'b'});assert.deepEqual(tx.after.actors.b,{...before.actors.b,confused:true});assert.equal(tx.event.outcome,confused?'failed':'hit')}
  for(const [moveId,damage]of [['fake-out',28],['astonish',22],['sonic-boom',20],['hyper-voice',64],['uproar',64]])for(const hp of [160,9]){const before=state({},{hp}),tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'});assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:Math.max(0,hp-damage)});assert.deepEqual(tx.after.actors.a,before.actors.a)}
  for(const m of MOVE_RULES.filter(m=>ids.includes(m.id)&&m.previewOnly)){
    const before=state({condition:m.requiresSleep?'sleep':'poison'}),tx=resolveMove(before,{moveId:m.id,sourceId:'a',targetId:'b'});assert.deepEqual(tx.after.actors,before.actors);assert.equal(tx.event.outcome,'hit')
    if(m.requiresSleep){const awake=state({condition:null}),failed=resolveMove(awake,{moveId:m.id,sourceId:'a'});assert.equal(failed.event.outcome,'failed');assert.deepEqual(failed.after.actors,awake.actors)}
  }
  for(const id of ['taunt','swagger','flatter','fake-tears'])assert.equal(MOVE_RULES.filter(m=>m.id===id).length,1)
})

test('all new preview fixtures and results reconcile without FX, after skip/failure and despite stale reset cues',async()=>{
  for(const moveId of ids)for(const sourceId of ['source','target'])for(const mode of ['off','impact','skip','failure']){
    const targetId=sourceId==='source'?'target':'source',tx=createPreviewTransaction(rule(moveId),{sourceId,targetId}),views=[];assert.equal(tx.event.outcome,'hit',moveId)
    let options,imports=0
    const p=createPresenter({getScene:()=>({}),onDisplay:v=>views.push(v),loadFx:()=>{imports++;if(mode==='failure')throw Error('unavailable');return{play(request,opts){for(const key of ['actors','heldItem','consumedItem','substituteHp','spikesLayers','weather','mudSport','waterSport'])assert.equal(request[key],undefined);options=opts;return{finished:new Promise(()=>{}),cancel(){}}}}}})
    const run=p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='impact'){options.onCue({type:'impact'});options.onCue({type:'impact'});assert.equal(views.at(-1).state,tx.after);assert.equal(views.filter(v=>v.animate).length,1);p.skip()}
    if(mode==='skip')p.skip()
    await run;assert.equal(views.at(-1).state,tx.after);if(mode==='off')assert.equal(imports,0)
    const fresh=createBattleState();p.reset(fresh);options?.onCue({type:'impact'});assert.equal(views.at(-1).state,fresh);p.destroy()
  }
  for(const moveId of ['recycle','psych-up','sleep-talk']){const actors=[{id:'a',name:'Fainted',hp:0,maxHp:100},{id:'b',name:'Other',hp:100,maxHp:100}],fixture=createPreviewState(rule(moveId),{sourceId:'a',targetId:'b',actors});assert.equal(fixture.actors.a.hp,0);assert.throws(()=>createPreviewTransaction(rule(moveId),{sourceId:'a',targetId:'b',actors}),/fainted/)}
})

function harness(reverse,edge=0,solo=false){
  let timeline
  // Keep the complete wide silhouette inside the field before applying any move.
  const actors=[{id:'source',profile:edge===1?'tall':'wide',x:reverse?.72:.28,y:edge===1?.32:.82,height:.3,facing:reverse?-1:1,anchors:{hand:[.7,.42],tail:[.4,.65],emission:edge===1?[.6,.05]:[.72,.32]}},
    {id:'target',profile:'tall',x:reverse?(edge>=2?.055:.26):(edge>=2?.945:.74),y:edge===3?.3:.62,height:edge===3?.3:.18,facing:reverse?1:-1,anchors:{center:edge===3?[.5,.04]:[.48,.44]}}]
  const scene=createSceneGraph({width:720,height:600,actors:solo?actors.slice(0,1):actors})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},node:label=>scene.effects.getChildByLabel(label,true),point:n=>scene.effects.toLocal({x:0,y:0},n),dispose(){fx.dispose();scene.dispose()}}
}
function clean(h){assert.equal(h.scene.effects.children.length,0);for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.tint,0xffffff)}}
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.04,label)
test('outward and inward effects reach supplied sockets before cues, and source-only casting works without an opponent',async()=>{
  const outbound={'growl':'growl-wave-0','screech':'screech-tip','metal-sound':'metal-sound-wave-0','sweet-scent':'sweet-scent-petal-0','fake-out':'fake-out-palm-0','astonish':'astonish-mask','supersonic':'supersonic-wave-0','sonic-boom':'sonic-boom-front','hyper-voice':'hyper-voice-wave-0','uproar':'uproar-wave-0','mind-reader':'mind-reader-target-eye'}
  for(const reverse of [false,true]){
    const h=harness(reverse)
    try{for(const moveId of ids){const timing=EFFECT_TIMINGS[moveId],cues=[],run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{
      cues.push(c.type)
      if(outbound[moveId])close(h.point(h.node(outbound[moveId])),h.scene.actor('target').anchor('center'),moveId+' outward contact')
      if(['mimic','psych-up','role-play'].includes(moveId))close(h.point(h.node(({'mimic':'mimic-copy','psych-up':'psych-up-transfer-2','role-play':'role-play-copy'})[moveId])),h.scene.actor('source').anchor('aura'),moveId+' source reception')
      if(moveId==='odor-sleuth')close(h.point(h.node('odor-sleuth-scent-2')),h.scene.actor('source').anchor('emission'),'scent reception')
      if(moveId==='skill-swap'){close(h.point(h.node('skill-swap-token-0')),h.scene.actor('target').anchor('aura'),'swap outward');close(h.point(h.node('skill-swap-token-1')),h.scene.actor('source').anchor('aura'),'swap inward')}
      if(moveId==='nature-power')for(let i=0;i<4;i++)close(h.point(h.node(`nature-power-motif-${i}`)),h.scene.actor('source').anchor('aura'),'nature motifs gather')
    }})
      await tick();h.tl.time(timing.contact-.001,false);assert.equal(cues.length,0);h.tl.time(timing.contact,false);assert.deepEqual(cues,['impact']);h.tl.time(timing.duration,false);assert.equal((await run.finished).status,'completed');clean(h)
      const replay=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.tl.time(timing.contact+.05,false);replay.cancel();await replay.finished;clean(h)
    }}finally{h.dispose()}
    const solo=harness(reverse,0,true)
    try{for(const moveId of ids.filter(id=>rule(id).target))for(const reducedMotion of [false,true]){const run=solo.fx.play({moveId,sourceId:'source'},{scene:solo.scene,reducedMotion});await tick();solo.tl.time(reducedMotion?.8:EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed',moveId);clean(solo)}}finally{solo.dispose()}
  }
  gsap.ticker.sleep()
})

test('new utility effects fit complete field bounds in both directions and restore Teleport opacity',async()=>{
  for(const reverse of [false,true])for(const edge of [0,1,2,3]){
    const h=harness(reverse,edge)
    try{for(const moveId of ids){const timing=EFFECT_TIMINGS[moveId],run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
      for(let t=.04;t<timing.duration-.02;t+=.05){h.tl.time(t,false)
        for(const a of h.scene.actors.values()){
          const p=a.anchor('visualCenter'),rx=a.metrics.width/2,ry=a.metrics.height/2
          assert.ok(p.x-rx>=-.05&&p.x+rx<=720.05&&p.y-ry>=-.05&&p.y+ry<=600.05,moveId+' actor bounds')
          assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.ok(a.pose.alpha>0&&a.pose.alpha<=1);if(moveId!=='teleport')assert.equal(a.pose.alpha,1)
        }
        const walk=(n,parent=1)=>{const alpha=parent*n.alpha;assert.ok(n.alpha>=0&&n.alpha<=1,moveId+' alpha');if(alpha>.03&&['Graphics','Sprite'].includes(n.constructor.name)){const b=n.getBounds();assert.ok(b.x>=-.05&&b.y>=-.05&&b.x+b.width<=720.05&&b.y+b.height<=600.05,`${moveId} ${n.label} edge ${edge} at ${t}: ${JSON.stringify(b)}`)}for(const c of n.children??[])walk(c,alpha)};walk(h.scene.effects)
      }
      h.tl.time(timing.duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
