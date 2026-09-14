import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { FX_CATALOG } from '@battle/battle-fx/catalog'
import { MOVES } from '../apps/game/src/moveCatalog.js'
import { createPreviewState, createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
const ids=['bind','wrap','constrict','string-shot','sand-attack','mud-slap','cotton-spore','feather-dance','mud-shot','muddy-water','vice-grip','clamp','super-fang','crabhammer','magnitude','mirror-move','sketch','spider-web','block','kinesis','lick','bone-club','bone-rush','bonemerang','fury-swipes','transform']
const rule=id=>MOVE_RULES.find(move=>move.id===id)
const tick=()=>new Promise(resolve=>setImmediate(resolve))
function state(side='source', source={}, target={}) {
  return createBattleState([
    {id:side,name:'User',hp:47,maxHp:160,condition:'burn',heldItem:'Oran Berry',attackStage:3,...source},
    {id:side==='source'?'target':'source',name:'Opponent',hp:160,maxHp:200,condition:'poison',reflect:true,specialDefenseStage:2,...target},
    {id:'observer',name:'Observer',hp:18,maxHp:80,condition:'sleep',nightmare:true},
  ])
}
const resolve=(before,id,side='source')=>resolveMove(before,{moveId:id,sourceId:side,targetId:side==='source'?'target':'source'})

test('all 26 additions appear once in core, FX and host without adding battle fixtures or changing participant identity',()=>{
  assert.deepEqual(MOVE_RULES.slice(-26).map(move=>move.id),ids)
  for(const id of ids){
    const move=MOVES.find(move=>move.id===id)
    for(const list of [MOVE_RULES,FX_CATALOG,MOVES])assert.equal(list.filter(move=>move.id===id).length,1)
    assert.ok(move.description&&move.mechanicNote&&move.color&&move.showcase)
    assert.equal(rule(id).target,undefined)
    for(const side of ['source','target'])for(const hp of [0,.5,1,47]){
      const before=state(side,{hp},{hp}),preview=createPreviewState(move,{sourceId:side,targetId:side==='source'?'target':'source',actors:Object.values(before.actors)})
      assert.deepEqual(preview,before,id+' supplies no health/status fixture')
    }
  }
})

test('Super Fang halves current HP with floor rounding and minimum one damage, including knockout at 1 HP',()=>{
  for(const side of ['source','target'])for(const [hp,remaining]of [[.5,0],[1,0],[2,1],[3,2],[5,3],[99,50],[160,80],[199,100]]){
    const before=state(side,{}, {hp}),tx=resolve(before,'super-fang',side),targetId=tx.event.targetIds[0]
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:remaining})
    assert.deepEqual(tx.after.actors[side],before.actors[side]);assert.deepEqual(tx.after.actors.observer,before.actors.observer)
    assert.equal(tx.event.beforeHp,hp);assert.equal(tx.event.afterHp,remaining);assert.equal(tx.event.outcome,'hit')
    assert.equal(tx.event.healing,undefined);assert.equal(tx.event.recoil,undefined);assert.equal(tx.after.revision,1)
    assert.equal(before.actors[targetId].hp,hp);assert.ok(Object.isFrozen(tx.after.actors[targetId]))
  }
  let before=state()
  for(const remaining of [80,40,20,10,5,3,2,1,0]){const tx=resolve(before,'super-fang');assert.equal(tx.after.actors.target.hp,remaining);before=tx.after}
  assert.throws(()=>resolve(before,'super-fang'),/fainted/)
})

test('Mud-Slap commits damage with a surviving recipient accuracy drop and still hits at the stage floor',()=>{
  for(const side of ['source','target'])for(const accuracyStage of [-6,-5,0,6])for(const hp of [1,16,17,160]){
    const before=state(side,{}, {hp,accuracyStage}),tx=resolve(before,'mud-slap',side),targetId=tx.event.targetIds[0],remaining=Math.max(0,hp-16)
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:remaining,accuracyStage:remaining>0?Math.max(-6,accuracyStage-1):accuracyStage})
    assert.equal(tx.event.outcome,'hit');assert.deepEqual(tx.after.actors[side],before.actors[side])
    assert.match(tx.event.resultMessage,new RegExp(`took ${Math.min(hp,16)} damage`))
    if(remaining===0)assert.doesNotMatch(tx.event.resultMessage,/accuracy/)
    else assert.match(tx.event.resultMessage,accuracyStage===-6?/accuracy cannot fall further/:/accuracy fell/)
    assert.equal(tx.event.accuracyStage,tx.after.actors[targetId].accuracyStage)
  }
  for(const id of ['flash','smokescreen']){
    const before=state('source',{}, {accuracyStage:-6}),tx=resolve(before,id)
    assert.deepEqual(tx.after.actors,before.actors);assert.equal(tx.event.outcome,id==='flash'?'failed':'hit')
  }
})

test('String Shot, Cotton Spore, Feather Dance, Sand Attack and Kinesis drop only the requested opposing stage with partial floor handling',()=>{
  for(const [id,key,drop]of [['string-shot','speedStage',2],['cotton-spore','speedStage',2],['feather-dance','attackStage',2],['sand-attack','accuracyStage',1],['kinesis','accuracyStage',1]])
    for(const side of ['source','target'])for(const value of [-6,-5,0,6]){
      const before=state(side,{}, {[key]:value}),tx=resolve(before,id,side),targetId=tx.event.targetIds[0]
      assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],[key]:Math.max(-6,value-drop)})
      assert.deepEqual(tx.after.actors[side],before.actors[side]);assert.equal(tx.event.outcome,value===-6?'failed':'hit')
      assert.match(tx.event.resultMessage,value===-6?/cannot fall further/:/fell/)
      assert.equal(tx.event.beforeHp,tx.event.afterHp)
    }
})

test('Mud Shot lowers Speed only after a surviving hit; other new attacks never force random statuses, stages or trapping',()=>{
  for(const side of ['source','target'])for(const speedStage of [-6,-5,0,6])for(const hp of [1,38,39,160]){
    const before=state(side,{}, {hp,speedStage}),tx=resolve(before,'mud-shot',side),targetId=tx.event.targetIds[0],remaining=Math.max(0,hp-38)
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:remaining,speedStage:remaining>0?Math.max(-6,speedStage-1):speedStage})
    assert.equal(tx.event.outcome,'hit');assert.deepEqual(tx.after.actors[side],before.actors[side])
  }
  for(const [id,damage]of [['bind',12],['wrap',12],['constrict',10],['muddy-water',64],['vice-grip',38],['clamp',26],['crabhammer',70],['magnitude',50],['lick',22],['bone-club',46],['bone-rush',54],['bonemerang',70],['fury-swipes',42]])
    for(const side of ['source','target'])for(const hp of [1,160])for(const condition of [null,'sleep','paralysis','burn']){
      const before=state(side,{}, {hp,condition}),tx=resolve(before,id,side),targetId=tx.event.targetIds[0]
      assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:Math.max(0,hp-damage)})
      assert.deepEqual(tx.after.actors[side],before.actors[side]);assert.equal(tx.after.revision,1)
      assert.equal(tx.event.outcome,'hit');assert.equal(tx.after.actors[targetId].trapped,false)
    }
})

test('Spider Web and Block reuse trapping with accurate messages and unchanged failure across repeated trapping moves',()=>{
  for(const side of ['source','target'])for(const id of ['spider-web','block'])for(const trapped of [false,true]){
    const before=state(side,{}, {trapped}),tx=resolve(before,id,side),targetId=tx.event.targetIds[0]
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],trapped:true});assert.deepEqual(tx.after.actors[side],before.actors[side])
    assert.equal(tx.event.outcome,trapped?'failed':'hit');assert.doesNotMatch(tx.event.resultMessage,/Mean Look/)
    if(!trapped)assert.ok(tx.event.resultMessage.includes(rule(id).name))
    for(const nextId of ['mean-look','spider-web','block']){const next=resolve(tx.after,nextId,side);assert.equal(next.event.outcome,'failed');assert.deepEqual(next.after.actors,tx.after.actors)}
  }
  assert.match(resolve(state(),'mean-look').event.resultMessage,/was caught in Mean Look/)
})

test('Mirror Move, Sketch and Transform remain explicitly cosmetic casts with no copied moves, identity, stats or HP changes',()=>{
  for(const side of ['source','target'])for(const id of ['mirror-move','sketch','transform']){
    const before=state(side),tx=resolve(before,id,side)
    assert.deepEqual(tx.after.actors,before.actors);assert.equal(tx.event.outcome,'hit');assert.equal(tx.after.revision,1)
    assert.match(tx.event.resultMessage,id==='mirror-move'?/no previous move.*called/:id==='sketch'?/No move is learned or replaced/:/Species, stats, ability and moves remain unchanged/)
    const repeat=resolve(tx.after,id,side);assert.deepEqual(repeat.after.actors,before.actors)
  }
  for(const id of ids)for(const side of ['source','target']){
    assert.throws(()=>resolveMove(state(side),{moveId:id,sourceId:side,targetId:side}),/participants/)
    assert.throws(()=>resolve(state(side,{hp:0}),id,side),/fainted/)
    assert.throws(()=>resolve(state(side,{}, {hp:0}),id,side),/fainted/)
  }
})

test('all 26 immutable outcomes reveal once and reconcile across effects off, cue, absent cue, failure and skip without rule data entering FX',async()=>{
  for(const id of ids)for(const side of ['source','target'])for(const mode of ['off','cue','missing','failure','skip']){
    const targetId=side==='source'?'target':'source',tx=createPreviewTransaction(rule(id),{sourceId:side,targetId})
    let display,finish,cueState,played=false,options
    const presenter=createPresenter({getScene:()=>({}),onDisplay:next=>{display=next;if(next.animate)cueState=next.state},loadFx:async()=>({play(request,opts){
      played=true;options=opts;assert.deepEqual(Object.keys(request).sort(),['moveId','outcome','sourceId','targetIds','visualSeed'])
      assert.deepEqual(request.targetIds,[targetId]);assert.equal(request.sourceId,side)
      if(mode==='failure')throw new Error('Simulated renderer failure')
      if(mode==='cue'){opts.onCue({type:'impact'});opts.onCue({type:'impact'})}
      return {finished:new Promise(resolve=>{finish=resolve}),cancel(){finish?.({status:'cancelled'})}}
    }})})
    const result=presenter.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='cue')assert.deepEqual(cueState,tx.after)
    if(mode==='missing'||mode==='skip')assert.deepEqual(display.state,tx.before)
    if(mode==='skip')presenter.skip();else finish?.({status:'completed'})
    await result;assert.deepEqual(display.state,tx.after);assert.equal(played,mode!=='off')
    presenter.reset(tx.before);options?.onCue({type:'impact'});assert.deepEqual(display.state,tx.before);presenter.destroy()
  }
})
