import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { MOVES } from '../apps/game/src/moveCatalog.js'
import { createPreviewState, createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
const ids = ['follow-me','helping-hand','teeter-dance','splash','false-swipe','dizzy-punch','beat-up','secret-power','psywave','extrasensory','psycho-boost','flail','reversal','revenge','superpower']
const rule = id => MOVE_RULES.find(move => move.id === id)
const tick = () => new Promise(resolve => setImmediate(resolve))
function state(sourceId = 'source', source = {}, target = {}) {
  const targetId = sourceId === 'source' ? 'target' : 'source'
  return createBattleState([
    { id: sourceId, name: 'User', hp: 100, maxHp: 160, condition: 'burn', heldItem: 'Oran Berry', specialDefenseStage: 3, ...source },
    { id: targetId, name: 'Opponent', hp: 160, maxHp: 160, condition: 'poison', reflect: true, attackStage: 2, specialAttackStage: 3, ...target },
    { id: 'observer', name: 'Observer', hp: 60, maxHp: 80, condition: 'sleep', nightmare: true },
  ])
}
function resolve(before, moveId, sourceId = 'source', extra = {}) {
  return resolveMove(before, { moveId, sourceId, targetId: sourceId === 'source' ? 'target' : 'source', ...extra })
}

test('all fifteen moves have unique rules, honest host descriptions, and independent targeting', () => {
  for (const id of ids) {
    assert.equal(MOVE_RULES.filter(move => move.id === id).length, 1)
    const move = MOVES.find(move => move.id === id)
    assert.ok(move.showcase && move.description && move.mechanicNote)
    assert.equal(rule(id).target, ['follow-me','helping-hand','splash'].includes(id) ? 'self' : undefined)
    assert.equal(rule(id).conditionOnHit, undefined)
  }
  for (const id of ['dizzy-punch','secret-power','extrasensory']) assert.match(MOVES.find(move => move.id === id).mechanicNote, /not simulated/)
  assert.match(MOVES.find(move => move.id === 'helping-hand').mechanicNote, /no ally.*no damage boost/)
})

test('False Swipe never knocks out or heals even a fractional-HP target; 1 HP is a successful zero-damage hit', () => {
  for (const side of ['source','target']) for (const hp of [.5,1,2,18,28,29,160]) {
    const before = state(side, {}, { hp }), tx = resolve(before, 'false-swipe', side), targetId = tx.event.targetIds[0]
    assert.equal(tx.after.actors[targetId].hp, Math.max(Math.min(hp,1), hp-28))
    assert.equal(tx.event.outcome, 'hit'); assert.ok(tx.after.actors[targetId].hp > 0)
    assert.deepEqual(tx.after.actors[side], before.actors[side])
    assert.deepEqual(tx.after.actors.observer, before.actors.observer)
    assert.equal(before.actors[targetId].hp, hp)
    assert.ok(Object.isFrozen(tx.after.actors[targetId]))
  }
})

test('Flail and Reversal use exact six HP power bands, including boundaries, without consuming user HP', () => {
  const cases = [[1,200],[19,200],[20,150],[49,150],[50,100],[99,100],[100,80],[169,80],[170,40],[329,40],[330,20],[480,20]]
  for (const id of ['flail','reversal']) for (const side of ['source','target']) for (const [hp,power] of cases) {
    const before = state(side, { hp, maxHp:480 }), tx = resolve(before,id,side), targetId = tx.event.targetIds[0]
    assert.equal(tx.event.powerUsed,power); assert.equal(tx.after.actors[targetId].hp,160-Math.round(power*.7))
    assert.deepEqual(tx.after.actors[side],before.actors[side]); assert.equal(tx.event.outcome,'hit')
    assert.match(tx.event.resultMessage,new RegExp(`Remaining-HP power: ${power}`))
  }
})

test('Revenge doubles only for an eligible current-turn hit supplied by the opposing target, with base damage otherwise', () => {
  for (const side of ['source','target']) {
    const targetId = side === 'source' ? 'target' : 'source'
    const hit = { sourceId:targetId,targetId:side,category:'physical',damage:32,thisTurn:true }
    const cases = [[hit,true],[{...hit,category:'special'},true],[undefined,false], [{...hit,thisTurn:false},false],
      [{...hit,thisTurn:undefined},false],[{...hit,sourceId:'observer'},false],[{...hit,targetId:'observer'},false],
      [{...hit,category:'status'},false],...[-1,0,1.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1,'32'].map(damage=>[{...hit,damage},false])]
    for (const [previousHit,boosted] of cases) {
      const before=state(side), tx=resolve(before,'revenge',side,{previousHit})
      assert.equal(tx.event.revengeBoosted,boosted);assert.equal(tx.after.actors[targetId].hp,boosted?76:118)
      assert.deepEqual(tx.after.actors[side],before.actors[side]);assert.equal(tx.event.outcome,'hit')
      assert.equal(tx.after.previousHit,undefined)
    }
  }
})

test('Psycho Boost and Superpower lower only source stats, respect partial floors and still damage at all floors or target knockout', () => {
  for (const side of ['source','target']) for (const stage of [-6,-5,0,6]) for (const hp of [1,160]) for (const id of ['psycho-boost','superpower']) {
    const before=state(side,{attackStage:stage,defenseStage:stage,specialAttackStage:stage},{hp}),tx=resolve(before,id,side),targetId=tx.event.targetIds[0]
    const changes=id==='psycho-boost'?{specialAttackStage:Math.max(-6,stage-2)}:{attackStage:Math.max(-6,stage-1),defenseStage:Math.max(-6,stage-1)}
    assert.deepEqual(tx.after.actors[side],{...before.actors[side],...changes})
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:Math.max(0,hp-(id==='psycho-boost'?98:84))})
    assert.equal(tx.event.outcome,'hit');assert.equal(tx.event.healing,undefined)
    assert.match(tx.event.resultMessage,stage===-6?/cannot fall further/:/fell/)
    assert.doesNotMatch(tx.event.resultMessage,/rose|cannot rise/)
  }
  for (const stage of [0,6]) {
    const before=state('source',{defenseStage:stage}), tx=resolve(before,'skull-bash')
    assert.equal(tx.after.actors.source.defenseStage,Math.min(6,stage+1))
    assert.match(tx.event.resultMessage,stage===6?/cannot rise further/:/rose/)
  }
})

test('Psywave uses the stated fixed level sample; ordinary hits preserve statuses without random secondaries', () => {
  for (const side of ['source','target']) for (const level of [1,50,100]) {
    const before=state(side,{level}),tx=resolve(before,'psywave',side)
    assert.equal(tx.event.afterHp,160-level);assert.deepEqual(tx.after.actors[side],before.actors[side])
  }
  for (const [id,damage] of [['dizzy-punch',50],['beat-up',56],['secret-power',50],['extrasensory',56]]) for (const hp of [1,160]) {
    const before=state('source',{}, {hp}),tx=resolve(before,id)
    assert.deepEqual(tx.after.actors.target,{...before.actors.target,hp:Math.max(0,hp-damage)})
    assert.deepEqual(tx.after.actors.source,before.actors.source);assert.equal(tx.after.revision,1)
  }
})

test('Follow Me marks its user; Helping Hand and Splash are harmless solo casts; Teeter Dance confuses only its opponent', () => {
  for (const id of ['follow-me','helping-hand','splash']) {
    const before=createBattleState([{id:'solo',name:'User',hp:1,maxHp:100,condition:'burn',attackStage:2}])
    const tx=resolveMove(before,{moveId:id,sourceId:'solo'})
    assert.deepEqual(tx.event.targetIds,['solo']);assert.equal(tx.event.outcome,'hit')
    assert.deepEqual(tx.after.actors.solo,{...before.actors.solo,...(id==='follow-me'?{attention:true}:{})})
    if(id==='follow-me')assert.equal(resolveMove(tx.after,{moveId:id,sourceId:'solo'}).event.outcome,'failed')
    else assert.match(tx.event.resultMessage,id==='splash'?/Nothing happened/:/no ally or damage boost/)
  }
  for(const attention of ['true',0,1,[],{}])assert.throws(()=>createBattleState([{id:'solo',name:'User',hp:1,maxHp:1,attention}]),/support preview flag/)
  for(const side of ['source','target'])for(const confused of [false,true]){
    const before=state(side,{}, {confused}),tx=resolve(before,'teeter-dance',side),targetId=tx.event.targetIds[0]
    assert.equal(tx.event.outcome,confused?'failed':'hit');assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],confused:true})
    assert.deepEqual(tx.after.actors[side],before.actors[side]);assert.deepEqual(tx.after.actors.observer,before.actors.observer)
  }
})

test('new preview fixtures follow explicit actor IDs, never revive or raise HP, and demonstrate bounded damage in either direction', () => {
  for(const id of ids)for(const side of ['source','target'])for(const hp of [0,.5,1,7,100]){
    const before=state(side,{hp},{hp}),targetId=side==='source'?'target':'source',actors=Object.values(before.actors)
    const preview=createPreviewState(rule(id),{sourceId:side,targetId,actors})
    for(const actor of actors)assert.ok(preview.actors[actor.id].hp<=actor.hp,id+' never raises HP')
    assert.deepEqual(preview.actors.observer,before.actors.observer)
    if(hp===0)assert.throws(()=>createPreviewTransaction(rule(id),{sourceId:side,targetId,actors}),/fainted/)
  }
  for(const side of ['source','target']){
    const targetId=side==='source'?'target':'source'
    for(const id of ['false-swipe','flail','reversal','revenge']){
      const tx=createPreviewTransaction(rule(id),{sourceId:side,targetId})
      if(id==='false-swipe'){assert.equal(tx.before.actors[targetId].hp,18);assert.equal(tx.after.actors[targetId].hp,1)}
      if(['flail','reversal'].includes(id)){assert.equal(tx.event.powerUsed,150);assert.equal(tx.event.beforeHp-tx.event.afterHp,105)}
      if(id==='revenge'){assert.equal(tx.event.revengeBoosted,true);assert.equal(tx.event.beforeHp-tx.event.afterHp,84)}
    }
  }
})

test('all new outcomes reconcile atomically through optional effects, cue, missing cue, failure and skip without state entering FX', async () => {
  for(const id of ids)for(const side of ['source','target'])for(const mode of ['off','cue','missing','failure','skip']){
    const targetId=side==='source'?'target':'source',tx=createPreviewTransaction(rule(id),{sourceId:side,targetId})
    let display,finish,cueState,played=false
    const presenter=createPresenter({getScene:()=>({}),onDisplay:next=>{display=next;if(next.animate)cueState=next.state},loadFx:async()=>({play(request,options){
      played=true;assert.deepEqual(Object.keys(request).sort(),['moveId','outcome','sourceId','targetIds','visualSeed'])
      assert.deepEqual(request.targetIds,tx.event.targetIds)
      if(mode==='failure')throw new Error('Simulated renderer failure')
      if(mode==='cue')options.onCue({type:'impact'})
      return {finished:new Promise(resolve=>{finish=resolve}),cancel(){finish?.({status:'cancelled'})}}
    }})})
    const result=presenter.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='cue')assert.deepEqual(cueState,tx.after)
    if(mode==='missing'||mode==='skip')assert.deepEqual(display.state,tx.before)
    if(mode==='skip')presenter.skip();else finish?.({status:'completed'})
    await result;assert.deepEqual(display.state,tx.after);assert.equal(played,mode!=='off');presenter.destroy()
  }
})
