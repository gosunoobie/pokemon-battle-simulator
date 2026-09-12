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
const ids=['sing','grass-whistle','snore','perish-song','belly-drum','trick','charm','attract','sweet-kiss','lovely-kiss','recover','soft-boiled','milk-drink','slack-off','morning-sun','synthesis','moonlight','wish','harden','iron-defense','defense-curl','withdraw','safeguard','magic-coat','cosmic-power','endure']
const rule=id=>MOVE_RULES.find(m=>m.id===id)
const state=(a={},b={})=>createBattleState([{id:'a',name:'User',hp:50,maxHp:101,condition:'poison',reflect:true,...a},{id:'b',name:'Opponent',hp:100,maxHp:160,condition:'burn',attackStage:1,...b}])

test('direct and weather healing round independently, cap HP and preserve conditions from either side',()=>{
  for(const moveId of ['recover','soft-boiled','milk-drink','slack-off','morning-sun','synthesis','moonlight'])for(const weather of [null,'sun','rain','sandstorm','hail'])for(const reverse of [false,true])for(const [hp,maxHp]of [[1,101],[90,101],[101,101],[10,102]]){
    const sourceId=reverse?'b':'a',targetId=reverse?'a':'b',actors=[{id:sourceId,name:'User',hp,maxHp,condition:'poison',confused:true},{id:targetId,name:'Other',hp:90,maxHp:110,condition:'burn'}]
    const original=createBattleState(actors),before=Object.freeze({...original,weather}),tx=resolveMove(before,{moveId,sourceId,targetId})
    const amounts=rule(moveId).weatherHeal?(maxHp===101?{none:50,sun:67,rain:25,sandstorm:25,hail:25}:{none:51,sun:68,rain:25,sandstorm:25,hail:25}):{none:51,sun:51,rain:51,sandstorm:51,hail:51}
    const expected=Math.min(maxHp,hp+amounts[weather??'none'])
    assert.deepEqual(tx.after.actors[sourceId],{...before.actors[sourceId],hp:expected});assert.deepEqual(tx.after.actors[targetId],before.actors[targetId]);assert.equal(tx.after.weather,weather)
    assert.equal(tx.event.outcome,hp===maxHp?'failed':'hit');assert.equal(tx.event.healing,undefined);assert.equal(tx.event.afterHp,expected);assert.ok(Object.isFrozen(tx.after.actors[sourceId]))
    assert.deepEqual(before.actors,createBattleState(actors).actors)
  }
})

test('Belly Drum pays only on success, Snore needs sleep and Trick swaps nullable item labels',()=>{
  for(const [hp,maxHp,attackStage,success,cost] of [[51,101,0,true,50],[50,101,0,false,50],[100,101,6,false,50],[1,1,0,false,1],[156,156,-6,true,78]]){
    const before=state({hp,maxHp,attackStage}),tx=resolveMove(before,{moveId:'belly-drum',sourceId:'a'})
    assert.equal(tx.event.outcome,success?'hit':'failed');assert.deepEqual(tx.after.actors.a,{...before.actors.a,...(success?{hp:hp-cost,attackStage:6}:{})});assert.deepEqual(tx.after.actors.b,before.actors.b);assert.equal(tx.event.healing,undefined)
  }
  for(const condition of [null,'sleep','poison','burn']){
    const before=state({condition}),tx=resolveMove(before,{moveId:'snore',sourceId:'a',targetId:'b'})
    assert.equal(tx.event.outcome,condition==='sleep'?'hit':'failed');assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:condition==='sleep'?64:100})
  }
  for(const [a,b]of [[null,null],['Oran Berry',null],[null,'Sitrus Berry'],['Oran Berry','Sitrus Berry'],['Leftovers','Leftovers']]){
    const before=state({heldItem:a},{heldItem:b}),tx=resolveMove(before,{moveId:'trick',sourceId:'a',targetId:'b'})
    assert.equal(tx.event.outcome,!a&&!b?'failed':'hit');assert.deepEqual(tx.after.actors.a,{...before.actors.a,heldItem:b});assert.deepEqual(tx.after.actors.b,{...before.actors.b,heldItem:a})
  }
  for(const heldItem of ['',1,{},[]])assert.throws(()=>state({heldItem}),/held item/)
})

test('music and affection status previews preserve HP and respect occupied conditions and stat caps',()=>{
  for(const moveId of ['sing','grass-whistle','lovely-kiss'])for(const condition of [null,'sleep','burn','poison']){
    const before=state({}, {condition,confused:true}),tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.equal(tx.event.outcome,condition?'failed':'hit');assert.deepEqual(tx.after.actors.b,{...before.actors.b,condition:condition??'sleep'})
  }
  for(const confused of [false,true]){
    const before=state({}, {confused}),tx=resolveMove(before,{moveId:'sweet-kiss',sourceId:'a',targetId:'b'})
    assert.equal(tx.event.outcome,confused?'failed':'hit');assert.deepEqual(tx.after.actors.b,{...before.actors.b,confused:true})
  }
  for(const attackStage of [0,-5,-6]){
    const before=state({}, {attackStage}),tx=resolveMove(before,{moveId:'charm',sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.b,{...before.actors.b,attackStage:Math.max(-6,attackStage-2)})
    assert.equal(tx.event.outcome,attackStage===-6?'failed':'hit')
  }
  for(const moveId of ['harden','iron-defense','defense-curl','withdraw','cosmic-power'])for(const defenseStage of [0,5,6])for(const specialDefenseStage of [0,6]){
    const before=state({defenseStage,specialDefenseStage}),tx=resolveMove(before,{moveId,sourceId:'a'}),m=rule(moveId)
    assert.deepEqual(tx.after.actors.a,{...before.actors.a,defenseStage:Math.min(6,defenseStage+m.defenseChange),specialDefenseStage:Math.min(6,specialDefenseStage+(m.specialDefenseChange??0))})
    assert.equal(tx.event.outcome,defenseStage===6&&(!m.specialDefenseChange||specialDefenseStage===6)?'failed':'hit')
  }
})

test('Wish and defenses are markers; Perish Song marks all living participants without HP or weather changes',()=>{
  for(const [moveId,key]of [['attract','infatuated'],['wish','wishPending'],['safeguard','safeguard'],['magic-coat','magicCoat'],['endure','enduring']]){
    const before=state(),self=rule(moveId).target==='self',id=self?'a':'b',tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors[id],{...before.actors[id],[key]:true});assert.deepEqual(tx.after.actors[self?'b':'a'],before.actors[self?'b':'a']);assert.equal(tx.event.healing,undefined)
    const again=resolveMove(tx.after,{moveId,sourceId:'a',targetId:'b'});assert.equal(again.event.outcome,'failed');assert.deepEqual(again.after.actors,tx.after.actors)
    for(const value of [1,'true',{},[]])assert.throws(()=>state({[key]:value}),/support/)
  }
  const base=createBattleState([{id:'a',name:'A',hp:40,maxHp:100},{id:'b',name:'B',hp:90,maxHp:100,perishSong:true},{id:'c',name:'C',hp:0,maxHp:100}]),before=Object.freeze({...base,weather:'rain'})
  const tx=resolveMove(before,{moveId:'perish-song',sourceId:'a'})
  assert.deepEqual(tx.event.targetIds,[]);assert.equal(tx.after.weather,'rain');assert.equal(tx.event.outcome,'hit')
  assert.deepEqual(tx.after.actors.a,{...before.actors.a,perishSong:true});assert.deepEqual(tx.after.actors.b,before.actors.b);assert.deepEqual(tx.after.actors.c,before.actors.c)
  assert.equal(resolveMove(tx.after,{moveId:'perish-song',sourceId:'b'}).event.outcome,'failed')
})

test('support fixtures and presenter reconcile all outcomes without FX, with skipped FX or stale callbacks',async()=>{
  for(const moveId of ids)for(const sourceId of ['source','target'])for(const mode of ['off','impact','skip','failure']){
    const targetId=sourceId==='source'?'target':'source',m=rule(moveId),tx=createPreviewTransaction(m,{sourceId,targetId})
    assert.equal(tx.event.outcome,'hit',moveId)
    let options,imports=0;const views=[]
    const p=createPresenter({getScene:()=>({}),onDisplay:v=>views.push(v),loadFx:()=>{imports++;if(mode==='failure')throw Error('unavailable');return{play(request,opts){assert.equal(request.actors,undefined);assert.equal(request.heldItem,undefined);assert.equal(request.weather,undefined);options=opts;return{finished:new Promise(()=>{}),cancel(){}}}}}})
    const run=p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='impact'){options.onCue({type:'recovery'});assert.equal(views.at(-1).state,tx.before);options.onCue({type:'impact'});assert.equal(views.at(-1).state,tx.after);p.skip()}
    if(mode==='skip')p.skip()
    await run;assert.equal(views.at(-1).state,tx.after);if(mode==='off')assert.equal(imports,0)
    const fresh=createPreviewState(rule('tackle'),{sourceId});p.reset(fresh);options?.onCue({type:'impact'});assert.equal(views.at(-1).state,fresh);assert.equal(fresh.actors[sourceId].condition,null);assert.equal(fresh.actors[sourceId].heldItem,null);p.destroy()
    const actors=[{id:sourceId,name:'Fainted',hp:0,maxHp:100},{id:targetId,name:'Alive',hp:100,maxHp:100}]
    assert.equal(createPreviewState(m,{sourceId,actors}).actors[sourceId].hp,0);assert.throws(()=>createPreviewTransaction(m,{sourceId,targetId,actors}),/fainted/)
  }
})

function harness(reverse,edge=0,solo=false){
  let timeline
  const specs=[{id:'source',profile:edge===1?'tall':'wide',x:edge===1?(reverse?.9:.1):(reverse?.75:.25),y:edge===1?.32:.83,height:.3,facing:reverse?-1:1,anchors:{eyes:[.6,.15],hand:[.7,.44],aura:[.5,.35]}},
    {id:'target',profile:'tall',x:reverse?(edge===2?.055:.25):(edge===2?.945:.75),y:edge===2?.31:.62,height:edge===2?.3:.18,facing:reverse?1:-1,anchors:{center:[.48,.12],hand:[.62,.5]}}]
  const scene=createSceneGraph({width:720,height:600,actors:solo?specs.slice(0,1):specs})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},node:label=>scene.effects.getChildByLabel(label,true),point:n=>scene.effects.toLocal({x:0,y:0},n),dispose(){fx.dispose();scene.dispose()}}
}
function clean(h){assert.equal(h.scene.effects.children.length,0);for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)}}
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.04,label)
test('music, kisses and item exchanges reach live sockets before cues; every new effect fits both edge perspectives',async()=>{
  const targetLabels={sing:'sing-note-0','grass-whistle':'grass-whistle-pulse-0',snore:'snore-wave-0',charm:'charm-heart',attract:'attract-heart-0','sweet-kiss':'sweet-kiss-heart','lovely-kiss':'lovely-kiss-lips'}
  for(const reverse of [false,true])for(const edge of [0,1,2]){
    const h=harness(reverse,edge)
    try{for(const moveId of ids){
      const timing=EFFECT_TIMINGS[moveId],cues=[]
      const run=h.fx.play({moveId,sourceId:'source',targetIds:rule(moveId).target?[]:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{
        cues.push(c.type)
        if(targetLabels[moveId])close(h.point(h.node(targetLabels[moveId])),h.scene.actor('target').anchor('center'),moveId+' arrival')
        if(moveId==='sing'){const note=h.node('sing-note-0'),at=h.point(note),axis=h.scene.effects.toLocal({x:1,y:0},note);assert.ok(axis.x>at.x,'musical notation stays readable when the route reverses')}
        if(moveId==='trick'){close(h.point(h.node('trick-item-0')),h.scene.actor('target').anchor('hand'),'Trick outward');close(h.point(h.node('trick-item-1')),h.scene.actor('source').anchor('hand'),'Trick inward')}
        if(moveId==='soft-boiled')close(h.point(h.node('soft-boiled-pearl-0')),h.scene.actor('source').anchor('aura'),'egg energy received')
      }})
      await tick();h.tl.time(timing.contact-.001,false);assert.equal(cues.length,0);h.tl.time(timing.contact,false);assert.deepEqual(cues,['impact']);run.cancel();await run.finished;clean(h)
      const again=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick()
      for(let t=.04;t<timing.duration-.03;t+=.045){
        h.tl.time(t,false)
        const walk=(n,parent=1)=>{const alpha=parent*n.alpha;assert.ok(n.alpha>=0&&n.alpha<=1,moveId+' alpha');if(alpha>.03&&n.constructor.name==='Graphics'){const b=n.getBounds();assert.ok(b.x>=-.05&&b.y>=-.05&&b.x+b.width<=720.05&&b.y+b.height<=600.05,`${moveId} ${n.label} at ${t}: ${JSON.stringify(b)}`)}for(const c of n.children??[])walk(c,alpha)};walk(h.scene.effects)
        for(const a of h.scene.actors.values()){assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)}
      }
      h.tl.time(timing.duration,false);assert.equal((await again.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('all source and field additions run without an opponent in both motion modes and reset on cancellation',async()=>{
  for(const reverse of [false,true])for(const reducedMotion of [false,true]){
    const h=harness(reverse,0,true)
    try{for(const moveId of ids.filter(id=>rule(id).target)){
      const timing=EFFECT_TIMINGS[moveId],cues=[]
      const run=h.fx.play({moveId,sourceId:'source'},{scene:h.scene,reducedMotion,onCue:c=>cues.push(c.type)})
      await tick();h.tl.time(reducedMotion?.8:timing.duration,false);assert.equal((await run.finished).status,'completed',moveId);assert.deepEqual(cues,['impact']);clean(h)
      const again=h.fx.play({moveId,sourceId:'source'},{scene:h.scene,reducedMotion});await tick();h.tl.time(reducedMotion?.3:timing.contact,false);again.cancel();await again.finished;clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
