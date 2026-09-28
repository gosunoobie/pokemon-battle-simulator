import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { FX_CATALOG } from '@battle/battle-fx/catalog'
import { MOVES } from '../apps/game/src/moveCatalog.js'
import { createPreviewState, createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
const ids=['spore','growth','haze','mist','conversion','conversion-2','stockpile','swallow','snatch','camouflage']
const casting=['mist','conversion','conversion-2','stockpile','snatch','camouflage']
const rule=id=>MOVE_RULES.find(move=>move.id===id),tick=()=>new Promise(resolve=>setImmediate(resolve))
const actors=[{id:'a',name:'Near',hp:35,maxHp:101,condition:'burn',specialAttackStage:2,accuracyStage:-2,focusEnergy:true,reflect:true},{id:'b',name:'Far',hp:100,maxHp:100,attackStage:-3,defenseStage:4}]

test('all ten missing Gen 3 status moves have unique rules, descriptions and effects',()=>{
  for(const id of ids){assert.equal(MOVE_RULES.filter(move=>move.id===id).length,1);assert.equal(FX_CATALOG.filter(move=>move.id===id).length,1);assert.ok(EFFECT_TIMINGS[id]);const move=MOVES.find(move=>move.id===id);assert.ok(move.description);assert.ok(move.mechanicNote);assert.ok(move.previewCaption)}
})

test('Spore respects occupied conditions and Growth previews the Gen 3 Special Attack boost',()=>{
  for(const sourceId of ['a','b']){
    const targetId=sourceId==='a'?'b':'a'
    for(const condition of [null,'burn','poison','sleep','paralysis']){
      const before=createBattleState(actors.map(a=>a.id===targetId?{...a,condition}:a)),tx=resolveMove(before,{moveId:'spore',sourceId,targetId})
      assert.equal(tx.event.outcome,condition?'failed':'hit');assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],condition:condition??'sleep'});assert.deepEqual(tx.after.actors[sourceId],before.actors[sourceId])
    }
    for(const stage of [0,5,6]){
      const before=createBattleState(actors.map(a=>a.id===sourceId?{...a,specialAttackStage:stage}:a)),tx=resolveMove(before,{moveId:'growth',sourceId})
      assert.deepEqual(tx.after.actors[sourceId],{...before.actors[sourceId],specialAttackStage:Math.min(6,stage+1)});assert.deepEqual(tx.after.actors[targetId],before.actors[targetId]);assert.equal(tx.event.outcome,stage===6?'failed':'hit');assert.deepEqual(tx.event.targetIds,[sourceId])
    }
  }
})

test('Haze clears seven living-actor stages, retaining unrelated state and already resolved weather',()=>{
  const stages=['attackStage','defenseStage','specialAttackStage','specialDefenseStage','speedStage','evasionStage','accuracyStage']
  for(const sourceId of ['a','b']){
    const base=createBattleState([...actors,{id:'c',name:'Fainted',hp:0,maxHp:100,attackStage:3}]),before=Object.freeze({...base,weather:'sun',mudSport:true})
    const tx=resolveMove(before,{moveId:'haze',sourceId})
    for(const id of ['a','b'])assert.deepEqual(tx.after.actors[id],{...before.actors[id],...Object.fromEntries(stages.map(key=>[key,0]))})
    assert.deepEqual(tx.after.actors.c,before.actors.c);assert.deepEqual(tx.event.targetIds,[]);assert.equal(tx.after.weather,'sun');assert.equal(tx.after.mudSport,true);assert.equal(tx.event.outcome,'hit');assert.ok(Object.isFrozen(tx.after.actors.a));assert.equal(before.actors.a.specialAttackStage,2)
    assert.equal(resolveMove(tx.after,{moveId:'haze',sourceId}).event.outcome,'hit')
  }
})

test('history-dependent moves are explicit casting samples; Swallow uses one charge without storing counters',()=>{
  for(const sourceId of ['a','b']){
    const before=createBattleState(actors)
    for(const moveId of casting){const tx=resolveMove(before,{moveId,sourceId});assert.deepEqual(tx.after.actors,before.actors);assert.deepEqual(tx.event.targetIds,[sourceId]);assert.equal(tx.event.outcome,'hit');assert.match(tx.event.resultMessage,/preview|sample/i)}
    const tx=resolveMove(before,{moveId:'swallow',sourceId});assert.equal(tx.after.actors[sourceId].hp,Math.min(before.actors[sourceId].maxHp,before.actors[sourceId].hp+Math.round(before.actors[sourceId].maxHp/4)));assert.equal(tx.event.healing,undefined)
    for(const hp of [0,1,20,100]){const fixture=createPreviewState(rule('swallow'),{sourceId,actors:actors.map(a=>a.id===sourceId?{...a,hp,maxHp:100}:a)});assert.equal(fixture.actors[sourceId].hp,Math.min(hp,40));if(!hp)assert.throws(()=>createPreviewTransaction(rule('swallow'),{sourceId,actors:Object.values(fixture.actors)}),/fainted/)}
  }
})

test('new preview results reconcile at impact and on all optional-presentation exits',async()=>{
  for(const moveId of ids)for(const sourceId of ['source','target'])for(const mode of ['impact','skip','off','failure','no-cue']){
    const targetId=sourceId==='source'?'target':'source',tx=createPreviewTransaction(MOVES.find(m=>m.id===moveId),{sourceId,targetId});assert.equal(tx.event.outcome,'hit',moveId)
    let display,options
    const p=createPresenter({getScene:()=>({}),onDisplay:value=>{display=value},loadFx:()=>{if(mode==='failure')throw Error('missing');return{play(request,opts){options=opts;for(const key of ['actors','weather','condition','specialAttackStage','stockpile'])assert.equal(request[key],undefined);return{finished:mode==='no-cue'?Promise.resolve({status:'completed'}):new Promise(()=>{}),cancel(){}}}}}})
    const run=p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick();if(mode==='impact'){options.onCue({type:'impact'});assert.equal(display.state,tx.after);p.skip()}else if(mode==='skip')p.skip();await run;assert.equal(display.state,tx.after)
    const fresh=createBattleState();p.reset(fresh);options?.onCue({type:'impact'});assert.equal(display.state,fresh);p.destroy()
  }
})

function harness(reverse,edge=0,solo=false){let timeline
  const width=edge===3?420:720,height=600
  const actors=[{id:'source',profile:'wide',x:reverse?.74:.26,y:edge===1?.31:.78,height:.26,facing:reverse?-1:1},
    {id:'target',profile:'tall',x:reverse?(edge===2?.055:.26):(edge===2?.945:.74),y:edge===1?.3:.65,height:.2,facing:reverse?1:-1,anchors:{center:edge===1?[.5,.04]:[.5,.4]}}]
  const scene=createSceneGraph({width,height,actors:solo?actors.slice(0,1):actors})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},dispose(){fx.dispose();scene.dispose()}}
}
function clean(h){assert.equal(h.scene.effects.children.length,0);for(const actor of h.scene.actors.values()){assert.equal(actor.pose.x,0);assert.equal(actor.pose.y,0);assert.equal(actor.pose.rotation,0);assert.equal(actor.pose.alpha,1);assert.equal(actor.pose.scale.x,1);assert.equal(actor.pose.scale.y,1)}}
function frame(node){return[node.label,node.x,node.y,node.alpha,node.rotation,node.scale.x,node.scale.y,...node.children.map(frame)]}

test('ten independent effects remain within logical field bounds from both sides, flow until fade and restore actors',async()=>{
  for(const reverse of [false,true])for(const edge of [0,1,2,3]){
    const h=harness(reverse,edge)
    try{for(const moveId of ids){const cues=[],timing=EFFECT_TIMINGS[moveId],run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:43},{scene:h.scene,onCue:c=>{cues.push(c.type);if(moveId==='spore'){const cloud=h.scene.effects.getChildByLabel('spore-cloud',true),p=h.scene.effects.toLocal({x:0,y:0},cloud),expected=h.scene.actor('target').anchor('center');assert.ok(Math.hypot(p.x-expected.x,p.y-expected.y)<.01)}}});await tick();assert.ok(h.tl,moveId)
      h.tl.time(timing.contact-.001,false);assert.deepEqual(cues,[]);h.tl.time(timing.contact,false);assert.deepEqual(cues,['impact'])
      h.tl.time(1.25,false);const first=frame(h.scene.effects);h.tl.time(1.5,false);assert.notDeepEqual(frame(h.scene.effects),first,moveId+' continues moving')
      for(let time=.04;time<timing.duration-.02;time+=.05){h.tl.time(time,true);for(const actor of h.scene.actors.values()){assert.equal(actor.pose.alpha,1);assert.equal(actor.pose.scale.x,1);assert.equal(actor.pose.scale.y,1);assert.equal(actor.pose.x,0);assert.equal(actor.pose.y,0)}
        const walk=(node,parent=1)=>{const alpha=parent*node.alpha;assert.ok(node.alpha>=0&&node.alpha<=1);if(alpha>.03&&node.constructor.name==='Graphics'){const b=node.getBounds();assert.ok(b.x>=-.06&&b.y>=-.06&&b.x+b.width<=h.scene.width+.06&&b.y+b.height<=h.scene.height+.06,`${moveId} ${node.label} edge ${edge} ${time}: ${JSON.stringify(b)}`)}for(const child of node.children)walk(child,alpha)};walk(h.scene.effects)
      }
      h.tl.time(timing.duration,false);assert.equal((await run.finished).status,'completed',moveId);clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('self and field clips work solo, reduced motion sends one cue, cancellation and abort remove owned art',async()=>{
  for(const reverse of [false,true]){
    const h=harness(reverse,0,true)
    try{for(const moveId of ids.filter(id=>id!=='spore'))for(const reducedMotion of [false,true]){const cues=[],run=h.fx.play({moveId,sourceId:'source'},{scene:h.scene,reducedMotion,onCue:c=>cues.push(c.type)});await tick();h.tl.time(reducedMotion?.8:EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed');assert.deepEqual(cues,['impact']);clean(h)}}finally{h.dispose()}
    const h2=harness(reverse)
    try{for(const moveId of ids)for(const abort of [false,true]){const controller=new AbortController(),run=h2.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h2.scene,signal:controller.signal});await tick();h2.tl.time(.8,false);abort?controller.abort():run.cancel();assert.equal((await run.finished).status,'cancelled');clean(h2)}}finally{h2.dispose()}
  }
  gsap.ticker.sleep()
})
