import test from 'node:test'
import assert from 'node:assert/strict'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createPreviewState } from '../apps/game/src/previewState.js'
const transaction=moveId=>resolveMove(createBattleState(),{moveId,sourceId:'source',targetId:'target'})
const tick=()=>new Promise(resolve=>setImmediate(resolve))
function harness(loadFx,deadlineMs=1000) {
  const displays=[],busy=[]
  return {displays,busy,p:createPresenter({loadFx,getScene:()=>({}),onDisplay:v=>displays.push(v),onBusy:v=>busy.push(v),deadlineMs})}
}
test('effects disabled never imports FX and preserves every committed outcome',async()=>{
  let imports=0;const h=harness(()=>{imports++;throw Error('must not load')})
  for(const move of MOVE_RULES){const tx=transaction(move.id);assert.equal((await h.p.enqueue(tx,{effectsEnabled:false})).status,'skipped');assert.deepEqual(h.displays.at(-1).state,tx.after)}
  assert.equal(imports,0);assert.equal(h.busy.at(-1),false);h.p.destroy()
})
test('detonations reveal user fainting with target damage and survive skip, missing FX and replay reset',async()=>{
  for(const [moveId,targetHp] of [['explosion',36],['self-destruct',60]])for(const mode of ['off','impact','skip','failure']){
    const tx=transaction(moveId);let options,imports=0
    const h=harness(()=>{imports++;if(mode==='failure')throw Error('FX failed');return {play(_request,opts){options=opts;return {finished:new Promise(()=>{}),cancel(){}}}}})
    const run=h.p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    assert.equal(tx.after.actors.source.hp,0)
    if(mode==='impact'){
      assert.equal(h.displays.at(-1).state,tx.before);options.onCue({type:'recovery'});assert.equal(h.displays.at(-1).state,tx.before)
      options.onCue({type:'impact'});options.onCue({type:'impact'})
      assert.equal(h.displays.at(-1).state,tx.after);assert.equal(h.displays.filter(d=>d.animate).length,1);h.p.skip()
    }else if(mode==='skip')h.p.skip()
    await run;assert.equal(h.displays.at(-1).state,tx.after);assert.equal(h.displays.at(-1).state.actors.target.hp,targetHp)
    if(mode==='off')assert.equal(imports,0)
    const fresh=createPreviewState(MOVE_RULES.find(m=>m.id===moveId));h.p.reset(fresh);options?.onCue({type:'impact'})
    assert.equal(h.displays.at(-1).state,fresh);assert.equal(fresh.actors.source.hp,156);assert.equal(fresh.actors.target.hp,160);h.p.destroy()
  }
})
test('Hypnosis and Confuse Ray reveal independent statuses once and survive effects off, skip, failure and reset',async()=>{
  for(const moveId of ['hypnosis','confuse-ray'])for(const mode of ['off','impact','skip','failure']){
    const before=createBattleState([{id:'source',name:'User',hp:156,maxHp:156},{id:'target',name:'Opponent',hp:160,maxHp:160,condition:moveId==='confuse-ray'?'poison':null,confused:moveId==='hypnosis'}])
    const tx=resolveMove(before,{moveId,sourceId:'source',targetId:'target'});let options,imports=0
    const h=harness(()=>{imports++;if(mode==='failure')throw Error('FX failed');return {play(_request,opts){options=opts;return {finished:new Promise(()=>{}),cancel(){}}}}})
    const run=h.p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='impact'){
      assert.equal(h.displays.at(-1).state,before);options.onCue({type:'impact'});options.onCue({type:'impact'})
      assert.equal(h.displays.at(-1).state,tx.after);assert.equal(h.displays.filter(d=>d.animate).length,1);h.p.skip()
    }else if(mode==='skip')h.p.skip()
    await run;assert.equal(h.displays.at(-1).state,tx.after);assert.equal(tx.after.actors.target.hp,160)
    assert.equal(tx.after.actors.target.condition,moveId==='hypnosis'?'sleep':'poison');assert.equal(tx.after.actors.target.confused,true)
    if(mode==='off')assert.equal(imports,0)
    const fresh=createBattleState();h.p.reset(fresh);options?.onCue({type:'impact'});assert.equal(h.displays.at(-1).state,fresh);h.p.destroy()
  }
})
test('Rock Tomb reveals damage and Speed together even at the cap, without FX or stale reset cues',async()=>{
  for(const speedStage of [0,-6])for(const mode of ['off','impact','skip','failure']){
    const before=createBattleState([{id:'source',name:'User',hp:156,maxHp:156},{id:'target',name:'Opponent',hp:160,maxHp:160,speedStage,condition:'poison'}])
    const tx=resolveMove(before,{moveId:'rock-tomb',sourceId:'source',targetId:'target'});let options
    const h=harness(()=>{if(mode==='off'||mode==='failure')throw Error('FX unavailable');return {play(_request,opts){options=opts;assert.equal(_request.outcome,'hit');return {finished:new Promise(()=>{}),cancel(){}}}}})
    const run=h.p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='impact'){
      assert.equal(h.displays.at(-1).state,before);options.onCue({type:'impact'});options.onCue({type:'impact'})
      assert.equal(h.displays.at(-1).state,tx.after);assert.equal(h.displays.filter(d=>d.animate).length,1);h.p.skip()
    }else if(mode==='skip')h.p.skip()
    await run;assert.equal(h.displays.at(-1).state,tx.after);assert.equal(tx.after.actors.target.hp,118);assert.equal(tx.after.actors.target.speedStage,Math.max(-6,speedStage-1))
    const fresh=createBattleState();h.p.reset(fresh);options?.onCue({type:'impact'});assert.equal(h.displays.at(-1).state,fresh);h.p.destroy()
  }
})
test('Dynamic Punch reveals damage and confusion together without replacing major status and clears stale previews',async()=>{
  for(const mode of ['off','impact','skip','failure']){
    const before=createBattleState([{id:'source',name:'User',hp:156,maxHp:156},{id:'target',name:'Opponent',hp:160,maxHp:160,condition:'poison'}])
    const tx=resolveMove(before,{moveId:'dynamic-punch',sourceId:'source',targetId:'target'});let options,imports=0
    const h=harness(()=>{imports++;if(mode==='failure')throw Error('FX failed');return {play(_request,opts){options=opts;return {finished:new Promise(()=>{}),cancel(){}}}}})
    const run=h.p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='impact'){
      assert.equal(h.displays.at(-1).state,before);options.onCue({type:'impact'});options.onCue({type:'impact'})
      assert.equal(h.displays.at(-1).state,tx.after);assert.equal(h.displays.filter(d=>d.animate).length,1);h.p.skip()
    }else if(mode==='skip')h.p.skip()
    await run;assert.equal(h.displays.at(-1).state,tx.after)
    assert.equal(tx.after.actors.target.hp,90);assert.equal(tx.after.actors.target.confused,true);assert.equal(tx.after.actors.target.condition,'poison')
    if(mode==='off')assert.equal(imports,0)
    const fresh=createBattleState();h.p.reset(fresh);options?.onCue({type:'impact'});assert.equal(h.displays.at(-1).state,fresh)
    assert.equal(fresh.actors.target.confused,false);h.p.destroy()
  }
})
test('gaze results reveal once, preserve both HP bars and survive effects off, skip, failure and reset',async()=>{
  for(const moveId of ['leer','scary-face','glare','mean-look'])for(const mode of ['off','impact','skip','failure']){
    const tx=transaction(moveId);let options,imports=0
    const h=harness(()=>{imports++;if(mode==='failure')throw Error('FX failed');return {play(_request,opts){options=opts;return {finished:new Promise(()=>{}),cancel(){}}}}})
    const run=h.p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='impact'){
      assert.equal(h.displays.at(-1).state,tx.before);options.onCue({type:'impact'});options.onCue({type:'impact'})
      assert.equal(h.displays.at(-1).state,tx.after);assert.equal(h.displays.filter(d=>d.animate).length,1);h.p.skip()
    }else if(mode==='skip')h.p.skip()
    await run;assert.equal(h.displays.at(-1).state,tx.after);assert.equal(tx.after.actors.source.hp,156);assert.equal(tx.after.actors.target.hp,160)
    if(mode==='off')assert.equal(imports,0)
    const fresh=createBattleState();h.p.reset(fresh);options?.onCue({type:'impact'});assert.equal(h.displays.at(-1).state,fresh)
    assert.equal(fresh.actors.target.defenseStage,0);assert.equal(fresh.actors.target.speedStage,0);assert.equal(fresh.actors.target.trapped,false);assert.equal(fresh.actors.target.condition,null);h.p.destroy()
  }
})
test('recoil moves reveal both committed HP losses once and reconciles without effects or with stale cues',async()=>{
  for(const [moveId,sourceHp,targetHp] of [['struggle',117,124],['take-down',140,96],['double-edge',128,76],['submission',142,104]])for(const mode of ['off','impact','skip','failure']){
    const tx=transaction(moveId);let options,imports=0
    assert.equal(tx.after.actors.source.hp,sourceHp);assert.equal(tx.after.actors.target.hp,targetHp)
    const h=harness(()=>{imports++;if(mode==='failure')throw Error('FX failed');return {play(_request,opts){options=opts;return {finished:new Promise(()=>{}),cancel(){}}}}})
    const run=h.p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='impact'){
      assert.equal(h.displays.at(-1).state,tx.before);options.onCue({type:'recovery'});assert.equal(h.displays.at(-1).state,tx.before)
      options.onCue({type:'impact'});options.onCue({type:'impact'});options.onCue({type:'recovery'})
      assert.equal(h.displays.at(-1).state,tx.after);assert.equal(h.displays.filter(d=>d.animate).length,1);h.p.skip()
    }else if(mode==='skip')h.p.skip()
    await run;assert.equal(h.displays.at(-1).state,tx.after);if(mode==='off')assert.equal(imports,0)
    const fresh=createBattleState();h.p.reset(fresh);options?.onCue({type:'impact'});assert.equal(h.displays.at(-1).state,fresh);h.p.destroy()
  }
})
test('mental boosts display once at activation, survive skipped or broken FX, and reset without stale badges',async()=>{
  for(const moveId of ['meditate','calm-mind','amnesia','focus-energy','bulk-up','howl','swords-dance','dragon-dance','agility','double-team','minimize','acid-armor'])for(const mode of ['off','impact','skip','failure']){
    const tx=transaction(moveId);let options,imports=0
    const h=harness(()=>{imports++;if(mode==='failure')throw Error('FX failed');return {play(_request,opts){options=opts;return {finished:new Promise(()=>{}),cancel(){}}}}})
    const run=h.p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='impact'){
      assert.equal(h.displays.at(-1).state,tx.before);options.onCue({type:'impact'});options.onCue({type:'impact'})
      assert.equal(h.displays.at(-1).state,tx.after);assert.equal(h.displays.filter(d=>d.animate).length,1);h.p.skip()
    }else if(mode==='skip')h.p.skip()
    await run;assert.equal(h.displays.at(-1).state,tx.after);if(mode==='off')assert.equal(imports,0)
    const fresh=createBattleState();h.p.reset(fresh);options?.onCue({type:'impact'});assert.equal(h.displays.at(-1).state,fresh)
    for(const key of ['attackStage','defenseStage','specialAttackStage','specialDefenseStage','speedStage','evasionStage'])assert.equal(fresh.actors.source[key],0)
    assert.equal(fresh.actors.source.focusEnergy,false);h.p.destroy()
  }
})
test('recovery fixtures reveal cures or full healing at activation and reconcile without effects',async()=>{
  for(const move of MOVE_RULES.filter(m=>m.cure||m.rest))for(const mode of ['off','impact','skip','failure']){
    const before=createPreviewState(move),tx=resolveMove(before,{moveId:move.id,sourceId:'source',targetId:'target'})
    assert.ok(before.actors.source.condition);assert.equal(before.actors.source.hp,move.rest?70:156)
    assert.equal(tx.event.outcome,'hit');assert.equal(tx.after.actors.source.hp,156)
    assert.equal(tx.after.actors.source.condition,move.rest?'sleep':null)
    assert.deepEqual(tx.after.actors.target,before.actors.target)
    let options,imports=0
    const h=harness(()=>{imports++;if(mode==='failure')throw Error('FX failed');return {play(_request,opts){options=opts;return {finished:new Promise(()=>{}),cancel(){}}}}})
    const run=h.p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='impact'){
      assert.equal(h.displays.at(-1).state,before);options.onCue({type:'impact'});options.onCue({type:'impact'})
      assert.equal(h.displays.at(-1).state,tx.after);assert.equal(h.displays.filter(d=>d.animate).length,1)
      h.p.skip()
    }else if(mode==='skip')h.p.skip()
    await run;assert.equal(h.displays.at(-1).state,tx.after);if(mode==='off')assert.equal(imports,0)
    const fresh=createPreviewState(move);h.p.reset(fresh);options?.onCue({type:'impact'})
    assert.equal(h.displays.at(-1).state,fresh);assert.ok(fresh.actors.source.condition);h.p.destroy()
  }
})
test('drain previews defer displayed healing and ignore early, repeated and stale recovery cues',async()=>{
  for(const move of MOVE_RULES.filter(m=>m.drain)){
    const before=createPreviewState(move),tx=resolveMove(before,{moveId:move.id,sourceId:'source',targetId:'target'})
    assert.equal(before.actors.source.hp,101);assert.ok(tx.after.actors.source.hp>101)
    let options
    const h=harness(()=>({play(_request,opts){options=opts;return {finished:new Promise(()=>{}),cancel(){}}}}))
    const run=h.p.enqueue(tx);await tick();options.onCue({type:'recovery'})
    assert.equal(h.displays.at(-1).state,before)
    options.onCue({type:'impact'});options.onCue({type:'impact'})
    assert.equal(h.displays.at(-1).state.actors.target.hp,tx.after.actors.target.hp)
    assert.equal(h.displays.at(-1).state.actors.source.hp,101)
    assert.equal(h.displays.at(-1).message,tx.event.impactMessage)
    assert.equal(h.displays.filter(d=>d.animate).length,1)
    options.onCue({type:'recovery'});options.onCue({type:'recovery'})
    assert.equal(h.displays.at(-1).state,tx.after);assert.equal(h.displays.filter(d=>d.animate).length,2)
    h.p.skip();assert.equal((await run).status,'skipped');assert.equal(h.displays.at(-1).state,tx.after)
    const next=h.p.enqueue(tx);await tick();const stale=options
    const reset=createPreviewState(move);h.p.reset(reset);assert.equal((await next).status,'cancelled')
    stale.onCue({type:'impact'});stale.onCue({type:'recovery'});assert.equal(h.displays.at(-1).state,reset)
    h.p.destroy()
  }
  for(const move of MOVE_RULES.filter(m=>!m.drain&&!m.rest&&!m.healFraction&&!m.weatherHeal&&!m.retaliates&&!m.splitsHp&&!m.endeavor&&!m.lowHpPower&&!m.revengeBoost))assert.equal(createPreviewState(move).actors.source.hp,156)
})
test('drain healing survives effects off, failure, missing recovery and skipping between phases',async()=>{
  for(const move of MOVE_RULES.filter(m=>m.drain))for(const mode of ['off','failure','missing','skip']){
    const tx=resolveMove(createPreviewState(move),{moveId:move.id,sourceId:'source',targetId:'target'})
    const h=harness(()=>{
      if(mode==='off'||mode==='failure')throw Error('FX unavailable')
      return {play(_request,opts){opts.onCue({type:'impact'});return {finished:mode==='skip'?new Promise(()=>{}):Promise.resolve({status:'completed'}),cancel(){}}}}
    })
    const run=h.p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='skip'){assert.equal(h.displays.at(-1).state.actors.source.hp,101);h.p.skip()}
    await run;assert.equal(h.displays.at(-1).state,tx.after);assert.ok(h.displays.at(-1).state.actors.source.hp>101);h.p.destroy()
  }
})
test('Brick Break reconciles opposing screen removal with effects disabled',async()=>{
  const before=createBattleState([{id:'source',name:'User',hp:156,maxHp:156,reflect:true},{id:'target',name:'Target',hp:160,maxHp:160,lightScreen:true,reflect:true}])
  const tx=resolveMove(before,{moveId:'brick-break',sourceId:'source',targetId:'target'})
  const h=harness(()=>{throw Error('FX should not load')})
  assert.equal((await h.p.enqueue(tx,{effectsEnabled:false})).status,'skipped')
  assert.deepEqual(h.displays.at(-1).state,tx.after)
  assert.equal(h.displays.at(-1).state.actors.target.reflect,false)
  assert.equal(h.displays.at(-1).state.actors.target.lightScreen,false)
  assert.equal(h.displays.at(-1).state.actors.source.reflect,true);h.p.destroy()
})
test('failed imports, failed playback, missing effects and stalled loading all reconcile the committed result',async()=>{
  const tx=transaction('hydro-pump')
  for(const loader of [()=>Promise.reject(Error('import failed')),()=>({play(){throw Error('builder failed')}}),()=>({play:()=>({finished:Promise.resolve({status:'skipped'}),cancel(){}})}),()=>new Promise(()=>{})]){
    const h=harness(loader,20);const result=await h.p.enqueue(tx)
    assert.ok(['failed','skipped'].includes(result.status));assert.deepEqual(h.displays.at(-1).state,tx.after);assert.equal(h.busy.at(-1),false);h.p.destroy()
  }
})
test('impact is cosmetic, repeated cues cannot apply damage, skip settles once, stale cues cannot overwrite reset',async()=>{
  let options,cancelCount=0
  const h=harness(()=>({play(_request,opts){options=opts;return{finished:new Promise(()=>{}),cancel(){cancelCount++}}}}))
  const tx=transaction('blast-burn'),play=h.p.enqueue(tx);await tick()
  assert.equal(tx.after.actors.target.hp,56);assert.equal(h.displays.at(-1).state.actors.target.hp,160)
  options.onCue({type:'impact'});options.onCue({type:'impact'})
  assert.equal(h.displays.filter(d=>d.animate).length,1)
  h.p.skip();assert.equal((await play).status,'skipped');assert.equal(h.displays.at(-1).state.actors.target.hp,56)
  const play2=h.p.enqueue(transaction('thunder-wave'));await tick();const stale=options
  const fresh=createBattleState();h.p.reset(fresh,'New preview')
  assert.equal((await play2).status,'cancelled');stale.onCue({type:'impact'})
  assert.equal(h.displays.at(-1).state,fresh);assert.equal(h.displays.at(-1).message,'New preview');assert.ok(cancelCount>0)
  h.p.destroy()
})
test('presentation queue processes events in order and destroy ignores late async work',async()=>{
  let end,disposed=0;const loader=()=>({dispose(){disposed++},play(){return{finished:new Promise(r=>{end=r}),cancel(){}}}})
  const h=harness(loader),first=h.p.enqueue(transaction('bubble')),second=h.p.enqueue(transaction('surf'))
  await tick();end({status:'completed'});await first;await tick();end({status:'completed'});await second
  assert.equal(h.displays.at(-1).state.actors.target.hp,94)
  h.p.destroy();await tick();assert.equal(disposed,1)
  let late;const lateFx={dispose(){disposed++}}
  const d=harness(()=>new Promise(r=>{late=r}));const pending=d.p.enqueue(transaction('slash'));await tick();d.p.destroy();const count=d.displays.length;late(lateFx);await pending;await tick();assert.equal(d.displays.length,count);assert.equal(disposed,2)
})

test('cleanup and host callback exceptions cannot leave a committed transaction pending or busy',async()=>{
  const h=harness(()=>({play:()=>({finished:Promise.resolve({status:'failed'}),cancel(){throw Error('cleanup failed')}})}))
  const tx=transaction('hydro-pump')
  assert.equal((await h.p.enqueue(tx)).status,'failed');assert.deepEqual(h.displays.at(-1).state,tx.after);assert.equal(h.busy.at(-1),false);h.p.destroy()
  const p=createPresenter({loadFx:()=>{},getScene:()=>null,onDisplay(){throw Error('host callback')},onBusy(){throw Error('host busy')},onError(){throw Error('logging failed')}})
  assert.equal((await p.enqueue(tx,{effectsEnabled:false})).status,'skipped');p.destroy()
})
test('a stalled import disables subsequent effects immediately and explicit retry disposes the late instance',async()=>{
  let loads=0,late,disposed=0
  const h=harness(()=>{loads++;return loads===1?new Promise(r=>{late=r}):{play:()=>({finished:Promise.resolve({status:'completed'}),cancel(){}})}},20)
  assert.equal((await h.p.enqueue(transaction('slash'))).status,'failed')
  assert.equal((await h.p.enqueue(transaction('surf'))).status,'skipped');assert.equal(loads,1)
  h.p.retryEffects();assert.equal((await h.p.enqueue(transaction('bubble'))).status,'completed');assert.equal(loads,2)
  late({dispose(){disposed++}});await tick();assert.equal(disposed,1);h.p.destroy()
})

test('a late rejected import cannot clear the successful runtime loaded by retry',async()=>{
  let loads=0,rejectOld
  const runtime={play:()=>({finished:Promise.resolve({status:'completed'}),cancel(){}})}
  const h=harness(()=>{loads++;return loads===1?new Promise((_resolve,reject)=>{rejectOld=reject}):runtime},20)
  assert.equal((await h.p.enqueue(transaction('slash'))).status,'failed')
  h.p.retryEffects()
  assert.equal((await h.p.enqueue(transaction('surf'))).status,'completed')
  rejectOld(Error('old import failed late'));await tick()
  assert.equal((await h.p.enqueue(transaction('bubble'))).status,'completed')
  assert.equal(loads,2);h.p.destroy()
})
