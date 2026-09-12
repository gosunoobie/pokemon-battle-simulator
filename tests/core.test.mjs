import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { FX_CATALOG } from '@battle/battle-fx/catalog'
import { readFileSync, readdirSync } from 'node:fs'

export const EXPECTED_HP = [120,96,108,78,124,82,128,100,68,102,64,56,88,106,160,132,98,76,74,110,106,92,88,102,136,116,88,94,104,128,132,102,98,160,160,160,118,100,102,124,138,160,160,160,160,160,160,160,126,128,124,112,124,106,90,130,132,114,102,76,124,130,98,118,132,120,160,102,132,130,132,160,142,126,104,106,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,136,82,78,124,160,160,160,160,132,126,102,132,88,96,76,104,114,102,104,96,90,60,106,116,118,126,160,160,36,60,112,104,100,110,160,160,160,160,110,110,116,76,118,116,116,100,90,70,110,116,116,110,142,128,118,132,120,90,118,104,96,102,104,104,118,88,114,108,160,160,158,156,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,130,118,118,120,112,90,124,112,88,112,118,118,74,124,94,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,160,132,138,160,160,160,140,96,96,160,160,160,160,160,160,160,160,132,60,90,60,90,94]
test('all 251 move results survive without renderer, window, FX playback or async work', () => {
  assert.equal(typeof globalThis.window, 'undefined')
  assert.equal(MOVE_RULES.length,251); assert.equal(new Set(MOVE_RULES.map(m=>m.id)).size,251)
  assert.deepEqual(MOVE_RULES.map(m=>m.id), FX_CATALOG.map(m=>m.id))
  MOVE_RULES.forEach((move,i)=>{
    const before=createBattleState(), result=resolveMove(before,{moveId:move.id,sourceId:'source',targetId:'target'})
    assert.equal(result.after.actors.target.hp, EXPECTED_HP[i],move.id)
    assert.equal(result.after.actors.target.condition,({'zap-cannon':'paralysis','sing':'sleep','grass-whistle':'sleep','lovely-kiss':'sleep','hypnosis':'sleep','glare':'paralysis','thunder-wave':'paralysis','poison-powder':'poison','sleep-powder':'sleep','stun-spore':'paralysis','poison-gas':'poison','toxic':'bad-poison','will-o-wisp':'burn'})[move.id]??null)
    if(move.condition)assert.match(result.event.resultMessage,new RegExp(({paralysis:'paralyzed',poison:'poisoned',sleep:'asleep','bad-poison':'badly poisoned',burn:'burned'})[move.condition]))
    assert.equal(result.after.actors.target.accuracyStage,move.id==='smokescreen'?-1:0)
    assert.equal(before.actors.target.hp,160)
    assert.ok(Object.isFrozen(result.after.actors.target))
    if(move.target==='field'){
      assert.deepEqual(result.event.targetIds,[]);assert.equal(result.after.weather,move.weather ?? before.weather)
      if(move.perishSong)for(const actor of Object.values(result.after.actors))assert.equal(actor.perishSong,true)
      else assert.deepEqual(result.after.actors,before.actors)
    }else{
      assert.equal(result.event.afterHp,move.target==='self'?(move.bellyDrum?78:move.substitute?117:156):EXPECTED_HP[i]);assert.equal(result.event.beforeHp,move.target==='self'?156:160)
      assert.deepEqual(result.event.targetIds,[move.target==='self'?'source':'target'])
    }
  })
})
test('Explosion and Self-Destruct faint the user atomically regardless of current HP or target overkill',()=>{
  for(const [moveId,damage] of [['explosion',124],['self-destruct',100]])for(const sourceHp of [1,64,156])for(const targetHp of [1,100,160]){
    const before=createBattleState([{id:'a',name:'User',hp:sourceHp,maxHp:156,condition:'burn',attackStage:2,confused:true,reflect:true},{id:'b',name:'Opponent',hp:targetHp,maxHp:160,condition:'poison',defenseStage:-1,trapped:true}])
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,{...before.actors.a,hp:0});assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:Math.max(0,targetHp-damage)})
    assert.equal(tx.event.selfDestruct,true);assert.equal(tx.event.sourceBeforeHp,sourceHp);assert.equal(tx.event.sourceAfterHp,0)
    assert.equal(tx.event.recoil,undefined);assert.equal(tx.event.healing,undefined);assert.equal(tx.event.outcome,'hit')
    assert.deepEqual(tx.event.targetIds,['b']);assert.equal(tx.after.revision,1);assert.match(tx.event.resultMessage,/User fainted/)
    assert.equal(before.actors.a.hp,sourceHp);assert.equal(before.actors.b.hp,targetHp);assert.ok(Object.isFrozen(tx.after.actors.a))
    assert.throws(()=>resolveMove(tx.after,{moveId:'tackle',sourceId:'a',targetId:'b'}),/fainted/)
  }
})
test('Confusion previews capped damage without inventing a guaranteed confusion secondary',()=>{
  for(const hp of [1,160])for(const confused of [false,true]){
    const before=createBattleState([{id:'a',name:'User',hp:80,maxHp:100,attackStage:2},{id:'b',name:'Opponent',hp,maxHp:160,condition:'poison',confused,speedStage:-1,reflect:true}])
    const tx=resolveMove(before,{moveId:'confusion',sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:Math.max(0,hp-34)})
    assert.equal(tx.event.outcome,'hit');assert.equal(tx.after.revision,1);assert.equal(before.actors.b.hp,hp)
  }
})
test('Hypnosis sleeps only a target with no major condition, preserving HP and independent confusion',()=>{
  for(const condition of [null,'sleep','poison','bad-poison','burn','paralysis','freeze'])for(const confused of [false,true]){
    const before=createBattleState([{id:'a',name:'User',hp:80,maxHp:100},{id:'b',name:'Opponent',hp:60,maxHp:160,condition,confused,defenseStage:2,trapped:true}])
    const tx=resolveMove(before,{moveId:'hypnosis',sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,condition:condition??'sleep'})
    assert.equal(tx.event.outcome,condition?'failed':'hit');assert.equal(tx.event.beforeHp,60);assert.equal(tx.event.afterHp,60)
    assert.match(tx.event.resultMessage,condition?/already has a status condition/:/asleep/)
    assert.equal(before.actors.b.condition,condition);assert.equal(tx.event.healing,undefined)
  }
})
test('Confuse Ray coexists with major conditions, deals no damage and cannot reapply confusion',()=>{
  for(const condition of [null,'sleep','poison','burn','paralysis'])for(const confused of [false,true]){
    const before=createBattleState([{id:'a',name:'User',hp:80,maxHp:100},{id:'b',name:'Opponent',hp:60,maxHp:160,condition,confused,reflect:true,trapped:true}])
    const tx=resolveMove(before,{moveId:'confuse-ray',sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,confused:true})
    assert.equal(tx.event.outcome,confused?'failed':'hit');assert.equal(tx.event.beforeHp,60);assert.equal(tx.event.afterHp,60)
    assert.match(tx.event.resultMessage,confused?/already confused/:/became confused/);assert.doesNotMatch(tx.event.resultMessage,/took 0 damage/)
    assert.equal(before.actors.b.confused,confused)
  }
})
test('Rock Tomb damages at the Speed floor and lowers only a surviving target without trapping it',()=>{
  for(const speedStage of [-6,-5,0,6])for(const hp of [1,42,160]){
    const before=createBattleState([{id:'a',name:'User',hp:80,maxHp:100,attackStage:2},{id:'b',name:'Opponent',hp,maxHp:160,speedStage,condition:'poison',confused:true,reflect:true}])
    const tx=resolveMove(before,{moveId:'rock-tomb',sourceId:'a',targetId:'b'}),afterHp=Math.max(0,hp-42),speed=afterHp>0?Math.max(-6,speedStage-1):speedStage
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:afterHp,speedStage:speed})
    assert.equal(tx.event.outcome,'hit');assert.equal(tx.after.actors.b.trapped,false)
    assert.match(tx.event.resultMessage,new RegExp(`took ${Math.min(hp,42)} damage`))
    if(afterHp===0)assert.doesNotMatch(tx.event.resultMessage,/Speed/)
    else assert.match(tx.event.resultMessage,speedStage===-6?/Speed cannot fall further/:/Speed fell/)
    assert.equal(before.actors.b.hp,hp);assert.equal(before.actors.b.speedStage,speedStage)
  }
})
test('Rock Blast and Ancient Power apply one fixed result without per-hit or random stat changes',()=>{
  for(const [moveId,damage] of [['rock-blast',54],['ancient-power',44]])for(const hp of [1,160]){
    const before=createBattleState([{id:'a',name:'User',hp:80,maxHp:100,condition:'burn',attackStage:2},{id:'b',name:'Opponent',hp,maxHp:160,condition:'poison',defenseStage:-1,trapped:true}])
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:Math.max(0,hp-damage)})
    assert.equal(tx.after.revision,1);assert.equal(tx.event.outcome,'hit');assert.equal(tx.event.healing,undefined)
  }
})
test('Dynamic Punch adds separate confusion only to surviving targets and preserves existing conditions',()=>{
  for(const condition of [null,'burn','poison','paralysis','sleep'])for(const hp of [1,70,160])for(const confused of [false,true]){
    const before=createBattleState([{id:'a',name:'User',hp:80,maxHp:100,condition:'burn',attackStage:2},{id:'b',name:'Opponent',hp,maxHp:160,condition,confused,defenseStage:-2,reflect:true,trapped:true}])
    const tx=resolveMove(before,{moveId:'dynamic-punch',sourceId:'a',targetId:'b'}),afterHp=Math.max(0,hp-70)
    assert.deepEqual(tx.after.actors.a,before.actors.a)
    assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:afterHp,confused:confused||afterHp>0})
    assert.equal(tx.event.outcome,'hit');assert.equal(tx.event.healing,undefined);assert.equal(tx.event.recoil,undefined)
    assert.equal(tx.event.resultMessage.includes('became confused'),!confused&&afterHp>0)
    assert.equal(before.actors.b.hp,hp);assert.equal(before.actors.b.confused,confused)
  }
  assert.equal(createBattleState().actors.target.confused,false)
  for(const confused of [1,'true',{},[]])assert.throws(()=>createBattleState([{id:'a',name:'A',hp:1,maxHp:1,confused}]),/confusion/)
})
test('single-hit punches preserve source stats and target fields beyond damage',()=>{
  for(const [moveId,damage] of [['mega-punch',56],['meteor-mash',64],['focus-punch',100],['fire-punch',50],['thunder-punch',50],['shadow-punch',44]])for(const hp of [1,160]){
    const before=createBattleState([{id:'a',name:'User',hp:80,maxHp:100,condition:'burn',attackStage:2},{id:'b',name:'Opponent',hp,maxHp:160,condition:'poison',confused:true,evasionStage:2,trapped:true,reflect:true}])
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:Math.max(0,hp-damage)})
    assert.equal(tx.event.recoil,undefined);assert.equal(tx.after.revision,1);assert.equal(before.actors.b.hp,hp)
  }
})
test('heavy strikes preserve battle fields and Stomp does not simulate Minimize or flinching',()=>{
  for(const [moveId,damage] of [['slam',56],['stomp',46],['strength',58]])for(const hp of [1,160]){
    const before=createBattleState([{id:'a',name:'User',hp:80,maxHp:100,condition:'burn',attackStage:2},{id:'b',name:'Opponent',hp,maxHp:160,condition:'poison',evasionStage:2,trapped:true,reflect:true}])
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:Math.max(0,hp-damage)})
    assert.equal(tx.event.recoil,undefined);assert.equal(tx.after.revision,1);assert.equal(before.actors.b.hp,hp)
  }
})
test('Take Down, Double-Edge and Submission recoil uses actual removed HP, rounds, and can faint both actors',()=>{
  for(const [moveId,damage,ratio] of [['take-down',64,.25],['double-edge',84,.33],['submission',56,.25]])for(const targetHp of [1,2,6,56,160])for(const sourceHp of [1,80]){
    const before=createBattleState([{id:'a',name:'User',hp:sourceHp,maxHp:100,condition:'burn',attackStage:2,reflect:true},{id:'b',name:'Opponent',hp:targetHp,maxHp:160,condition:'poison',defenseStage:-1,trapped:true}])
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'}),removed=Math.min(targetHp,damage),recoil=Math.min(sourceHp,Math.max(1,Math.round(removed*ratio)))
    assert.deepEqual(tx.after.actors.a,{...before.actors.a,hp:sourceHp-recoil});assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:targetHp-removed})
    assert.equal(tx.event.recoil,recoil);assert.equal(tx.event.sourceBeforeHp,sourceHp);assert.equal(tx.event.sourceAfterHp,sourceHp-recoil);assert.equal(tx.event.healing,undefined)
    assert.equal(before.actors.a.hp,sourceHp);assert.equal(before.actors.b.hp,targetHp);assert.ok(Object.isFrozen(tx.after.actors.a))
    if(targetHp===1&&sourceHp===1){assert.equal(tx.after.actors.a.hp,0);assert.equal(tx.after.actors.b.hp,0)}
    if(moveId==='take-down'&&targetHp===6&&sourceHp===80)assert.equal(tx.event.recoil,2)
    if(moveId==='double-edge'&&targetHp===56&&sourceHp===80)assert.equal(tx.event.recoil,18)
  }
})
test('Tackle and maximum-friendship Return remain fixed single-hit previews without source damage',()=>{
  for(const [moveId,damage] of [['tackle',28],['return',72]]){
    const before=createBattleState(),tx=resolveMove(before,{moveId,sourceId:'source',targetId:'target'})
    assert.deepEqual(tx.after.actors.source,before.actors.source);assert.deepEqual(tx.after.actors.target,{...before.actors.target,hp:160-damage})
    assert.equal(tx.event.recoil,undefined);assert.equal(tx.after.revision,1)
  }
  assert.equal(MOVE_RULES.find(m=>m.id==='return').power,102)
})
test('claw previews apply one capped damage result and preserve stats, statuses, guards and trapping',()=>{
  for(const [moveId,damage] of [['scratch',28],['metal-claw',34],['dragon-claw',58]])for(const targetHp of [1,160]){
    const before=createBattleState([{id:'a',name:'User',hp:80,maxHp:100,attackStage:2,condition:'burn',reflect:true},{id:'b',name:'Opponent',hp:targetHp,maxHp:160,defenseStage:-2,condition:'poison',trapped:true,lightScreen:true}])
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:Math.max(0,targetHp-damage)})
    assert.equal(tx.after.revision,1);assert.equal(tx.event.outcome,'hit');assert.equal(before.actors.b.hp,targetHp)
    assert.equal(MOVE_RULES.find(m=>m.id===moveId).attackChange,undefined)
  }
})
test('Leer and Scary Face lower opposing stats, respect the floor and report the actual change',()=>{
  for(const [moveId,key,amount,label] of [['leer','defenseStage',1,'Defense'],['scary-face','speedStage',2,'Speed']])for(const stage of [-6,-5,0,6]){
    const before=createBattleState([{id:'a',name:'User',hp:60,maxHp:100,attackStage:2,reflect:true},{id:'b',name:'Opponent',hp:80,maxHp:160,condition:'burn',trapped:true,accuracyStage:-2,[key]:stage}])
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'}),next=Math.max(-6,stage-amount)
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,[key]:next})
    assert.equal(tx.event.outcome,stage===-6?'failed':'hit');assert.deepEqual(tx.event.targetIds,['b']);assert.equal(tx.event.afterHp,80)
    assert.match(tx.event.resultMessage,new RegExp(`${label} ${stage===-6?'cannot fall further':stage-next===2?'fell harshly':'fell'}`))
    assert.doesNotMatch(tx.event.resultMessage,/rose|rise/);assert.equal(before.actors.b[key],stage)
  }
})
test('Glare applies paralysis and Mean Look stores only a persistent, resettable trapping preview',()=>{
  const before=createBattleState(),glare=resolveMove(before,{moveId:'glare',sourceId:'source',targetId:'target'})
  assert.deepEqual(glare.after.actors.source,before.actors.source);assert.deepEqual(glare.after.actors.target,{...before.actors.target,condition:'paralysis'})
  const tx=resolveMove(glare.after,{moveId:'mean-look',sourceId:'source',targetId:'target'})
  assert.deepEqual(tx.after.actors.source,glare.after.actors.source);assert.deepEqual(tx.after.actors.target,{...glare.after.actors.target,trapped:true})
  assert.equal(tx.event.outcome,'hit');assert.match(tx.event.resultMessage,/Trapping preview only/)
  const repeated=resolveMove(tx.after,{moveId:'mean-look',sourceId:'source',targetId:'target'})
  assert.equal(repeated.event.outcome,'failed');assert.deepEqual(repeated.after.actors,tx.after.actors);assert.match(repeated.event.resultMessage,/already marked as trapped/)
  for(const moveId of ['slash','scary-face','leer'])assert.equal(resolveMove(tx.after,{moveId,sourceId:'source',targetId:'target'}).after.actors.target.trapped,true)
  assert.equal(createBattleState().actors.target.trapped,false);assert.equal(createBattleState().actors.target.condition,null)
  for(const trapped of [1,'true',{},[]])assert.throws(()=>createBattleState([{id:'a',name:'A',hp:1,maxHp:1,trapped}]),/trapping/)
})
test('Struggle commits capped maximum-HP recoil with target damage and preserves unrelated fields',()=>{
  for(const [maxHp,expected] of [[1,1],[5,1],[6,2],[7,2],[100,25],[156,39]])for(const targetHp of [1,160])for(const low of [false,true]){
    const hp=low?1:maxHp
    const before=createBattleState([{id:'a',name:'User',hp,maxHp,condition:'poison',attackStage:2,reflect:true},{id:'b',name:'Opponent',hp:targetHp,maxHp:160,condition:'burn',evasionStage:2}])
    const tx=resolveMove(before,{moveId:'struggle',sourceId:'a',targetId:'b'}),recoil=Math.min(hp,expected)
    assert.deepEqual(tx.after.actors.a,{...before.actors.a,hp:hp-recoil})
    assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:Math.max(0,targetHp-36)})
    assert.equal(tx.event.recoil,recoil);assert.equal(tx.event.sourceBeforeHp,hp);assert.equal(tx.event.sourceAfterHp,hp-recoil)
    assert.equal(tx.event.healing,undefined);assert.equal(before.actors.a.hp,hp);assert.equal(before.actors.b.hp,targetHp)
    assert.match(tx.event.resultMessage,new RegExp(`took ${recoil} recoil damage`));assert.ok(Object.isFrozen(tx.after.actors.a))
  }
})
test('Rage, Thrash and Outrage preview one damage event without invented subsequent-turn effects',()=>{
  for(const [moveId,damage] of [['rage',24],['thrash',78],['outrage',82]]){
    const before=createBattleState([{id:'a',name:'User',hp:80,maxHp:100,attackStage:2,condition:'poison'},{id:'b',name:'Opponent',hp:160,maxHp:160,condition:'burn',reflect:true}])
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:160-damage})
    assert.equal(tx.after.revision,1);assert.equal(tx.event.outcome,'hit');assert.equal(tx.event.recoil,undefined)
  }
})
test('evasion, speed and Acid Armor boosts clamp, preserve other fields and require no opponent',()=>{
  for(const [moveId,key,amount] of [['agility','speedStage',2],['double-team','evasionStage',1],['minimize','evasionStage',2],['acid-armor','defenseStage',2]])for(const stage of [-6,0,5,6]){
    const before=createBattleState([{id:'a',name:'User',hp:42,maxHp:100,condition:'poison',accuracyStage:-2,attackStage:3,specialAttackStage:4,specialDefenseStage:2,focusEnergy:true,reflect:true,[key]:stage},{id:'b',name:'Opponent',hp:0,maxHp:80,condition:'burn'}])
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'}),afterStage=Math.min(6,stage+amount)
    assert.deepEqual(tx.after.actors.a,{...before.actors.a,[key]:afterStage});assert.deepEqual(tx.after.actors.b,before.actors.b)
    assert.equal(tx.event.outcome,stage===6?'failed':'hit');assert.deepEqual(tx.event.targetIds,['a']);assert.equal(tx.event.afterHp,42)
    assert.equal(before.actors.a[key],stage);assert.ok(Object.isFrozen(tx.after.actors.a))
    assert.deepEqual(resolveMove(createBattleState([before.actors.a]),{moveId,sourceId:'a'}).after.actors.a,tx.after.actors.a)
    assert.match(tx.event.resultMessage,stage===6?/cannot rise further/:afterStage-stage===2?/rose sharply/:/rose/)
  }
})
test('physical boosts include Defense and Speed in partial caps without changing Barrier or other actors',()=>{
  for(const [moveId,changes,labels] of [['bulk-up',{attackStage:1,defenseStage:1},['Attack','Defense']],['howl',{attackStage:1},['Attack']],['swords-dance',{attackStage:2},['Attack']],['dragon-dance',{attackStage:1,speedStage:1},['Attack','Speed']]]){
    for(const attackStage of [-6,0,5,6])for(const defenseStage of [-6,0,5,6])for(const speedStage of [-6,0,5,6]){
      const before=createBattleState([{id:'a',name:'User',hp:42,maxHp:100,condition:'poison',accuracyStage:-2,reflect:true,focusEnergy:true,specialAttackStage:3,specialDefenseStage:4,attackStage,defenseStage,speedStage},{id:'b',name:'Opponent',hp:0,maxHp:80,condition:'burn'}])
      const expected={...before.actors.a};let changed=false
      for(const [key,amount] of Object.entries(changes)){expected[key]=Math.min(6,expected[key]+amount);changed ||= expected[key]!==before.actors.a[key]}
      const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
      assert.deepEqual(tx.after.actors.a,expected);assert.deepEqual(tx.after.actors.b,before.actors.b)
      assert.equal(tx.event.outcome,changed?'hit':'failed',moveId+' independent caps');assert.deepEqual(tx.event.targetIds,['a'])
      for(const label of labels)assert.ok(tx.event.resultMessage.includes(label),moveId+' describes '+label)
      assert.equal(tx.event.afterHp,42);assert.ok(Object.isFrozen(tx.after.actors.a))
      assert.deepEqual(resolveMove(createBattleState([before.actors.a]),{moveId,sourceId:'a'}).after.actors.a,expected)
      assert.equal(before.actors.a.attackStage,attackStage);assert.equal(before.actors.a.defenseStage,defenseStage);assert.equal(before.actors.a.speedStage,speedStage)
    }
  }
  const state=createBattleState([{id:'a',name:'User',hp:42,maxHp:100,defenseStage:6}])
  const barrier=resolveMove(state,{moveId:'barrier',sourceId:'a'})
  assert.equal(barrier.event.outcome,'hit','existing capped Barrier preview preserved');assert.match(barrier.event.resultMessage,/Defense cannot rise further/)
})
test('mental stat boosts clamp individually, preserve actors, and fail only when all requested stats are capped',()=>{
  for(const [moveId,changes] of [['meditate',{attackStage:1}],['calm-mind',{specialAttackStage:1,specialDefenseStage:1}],['amnesia',{specialDefenseStage:2}]]){
    for(const [attackStage,specialAttackStage,specialDefenseStage] of [[0,0,0],[-6,-6,-6],[5,5,5],[6,6,5],[6,5,6],[6,6,6]]){
      const before=createBattleState([{id:'a',name:'User',hp:42,maxHp:100,condition:'poison',accuracyStage:-2,defenseStage:2,reflect:true,focusEnergy:true,attackStage,specialAttackStage,specialDefenseStage},{id:'b',name:'Opponent',hp:0,maxHp:80,condition:'burn'}])
      const expected={...before.actors.a};let changed=false
      for(const [key,amount] of Object.entries(changes)){expected[key]=Math.min(6,expected[key]+amount);changed ||= expected[key]!==before.actors.a[key]}
      const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
      assert.deepEqual(tx.after.actors.a,expected);assert.deepEqual(tx.after.actors.b,before.actors.b)
      assert.equal(tx.event.outcome,changed?'hit':'failed');assert.deepEqual(tx.event.targetIds,['a'])
      assert.equal(tx.event.afterHp,42);assert.ok(Object.isFrozen(tx.after.actors.a))
      assert.deepEqual(resolveMove(createBattleState([before.actors.a]),{moveId,sourceId:'a'}).after.actors.a,expected)
      assert.equal(before.actors.a.attackStage,attackStage);assert.equal(before.actors.a.specialAttackStage,specialAttackStage);assert.equal(before.actors.a.specialDefenseStage,specialDefenseStage)
    }
  }
})
test('Focus Energy cannot stack and stat fields survive cures, Rest and damage; fresh state clears them',()=>{
  const before=createBattleState([{id:'a',name:'User',hp:42,maxHp:100,condition:'poison',attackStage:2,specialAttackStage:3,specialDefenseStage:4,speedStage:2,evasionStage:3},{id:'b',name:'Opponent',hp:160,maxHp:160}])
  const tx=resolveMove(before,{moveId:'focus-energy',sourceId:'a'})
  assert.deepEqual(tx.after.actors.a,{...before.actors.a,focusEnergy:true});assert.equal(tx.event.outcome,'hit')
  const repeated=resolveMove(tx.after,{moveId:'focus-energy',sourceId:'a'})
  assert.equal(repeated.event.outcome,'failed');assert.deepEqual(repeated.after.actors,tx.after.actors);assert.match(repeated.event.resultMessage,/already focused/)
  for(const moveId of ['refresh','heal-bell','rest','slash']){
    const next=resolveMove(tx.after,{moveId,sourceId:'a',targetId:'b'})
    for(const key of ['attackStage','specialAttackStage','specialDefenseStage','speedStage','evasionStage','focusEnergy'])assert.equal(next.after.actors.a[key],tx.after.actors.a[key],moveId+' preserves '+key)
  }
  const damaged=resolveMove(tx.after,{moveId:'ember',sourceId:'b',targetId:'a'})
  for(const key of ['attackStage','specialAttackStage','specialDefenseStage','speedStage','evasionStage','focusEnergy'])assert.equal(damaged.after.actors.a[key],tx.after.actors.a[key])
  for(const key of ['attackStage','specialAttackStage','specialDefenseStage','speedStage','evasionStage']){
    assert.equal(createBattleState().actors.source[key],0)
    for(const value of [-7,7,.5,NaN,Infinity,'1'])assert.throws(()=>createBattleState([{id:'a',name:'A',hp:1,maxHp:1,[key]:value}]),/Invalid/)
  }
  assert.equal(createBattleState().actors.source.focusEnergy,false)
  assert.throws(()=>createBattleState([{id:'a',name:'A',hp:1,maxHp:1,focusEnergy:2}]),/Focus Energy/)
})
test('status cures preserve HP and unrelated fields, exclude Refresh sleep/freeze, and need no opponent',()=>{
  for(const moveId of ['refresh','heal-bell','aromatherapy'])for(const condition of [null,'burn','poison','bad-poison','paralysis','sleep','freeze']){
    const before=createBattleState([{id:'a',name:'User',hp:42,maxHp:100,condition,accuracyStage:-2,defenseStage:2,reflect:true},{id:'b',name:'Opponent',hp:0,maxHp:80,condition:'poison'}])
    const cured=condition!==null&&(moveId!=='refresh'||!['sleep','freeze'].includes(condition))
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,{...before.actors.a,condition:cured?null:condition})
    assert.deepEqual(tx.after.actors.b,before.actors.b);assert.equal(tx.event.outcome,cured?'hit':'failed')
    assert.deepEqual(tx.event.targetIds,['a']);assert.equal(before.actors.a.condition,condition)
    assert.ok(Object.isFrozen(tx.after.actors.a));assert.equal(tx.event.afterHp,42)
    const solo=createBattleState([before.actors.a]);assert.deepEqual(resolveMove(solo,{moveId,sourceId:'a'}).after.actors.a,tx.after.actors.a)
  }
})
test('Rest fully heals and replaces status with sleep but preserves full-HP and already-asleep actors',()=>{
  for(const hp of [1,42,100])for(const condition of [null,'poison','bad-poison','burn','paralysis','sleep','freeze']){
    const before=createBattleState([{id:'a',name:'User',hp,maxHp:100,condition,accuracyStage:-2,defenseStage:4,protected:true},{id:'b',name:'Opponent',hp:80,maxHp:80,condition:'burn'}])
    const success=hp<100&&condition!=='sleep',tx=resolveMove(before,{moveId:'rest',sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,{...before.actors.a,hp:success?100:hp,condition:success?'sleep':condition})
    assert.deepEqual(tx.after.actors.b,before.actors.b);assert.equal(tx.event.outcome,success?'hit':'failed')
    assert.equal(tx.event.beforeHp,hp);assert.equal(tx.event.afterHp,success?100:hp)
    assert.equal(tx.event.healing,undefined,'Rest resolves at activation, without the drain-only display phase')
    assert.equal(before.actors.a.hp,hp);assert.equal(before.actors.a.condition,condition)
    assert.match(tx.event.resultMessage,success?/fell asleep/:/could not use Rest/)
    assert.deepEqual(resolveMove(createBattleState([before.actors.a]),{moveId:'rest',sourceId:'a'}).after.actors.a,tx.after.actors.a)
  }
})
test('drain healing rounds actual removed HP, caps at missing HP and commits both actors immutably',()=>{
  for(const [moveId,damage,normalHeal] of [['absorb',18,9],['mega-drain',34,17],['giga-drain',56,28],['leech-life',54,27]]){
    for(const [targetHp,sourceHp,heal] of [[200,10,normalHeal],[5,10,3],[1,10,1],[200,99,1],[200,100,0],[.2,10,0]]){
      const before=createBattleState([{id:'a',name:'User',hp:sourceHp,maxHp:100,condition:'burn',reflect:true},{id:'b',name:'Target',hp:targetHp,maxHp:200,condition:'poison',accuracyStage:-2}])
      const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
      assert.deepEqual(tx.after.actors.a,{...before.actors.a,hp:sourceHp+heal})
      assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:Math.max(0,targetHp-damage)})
      assert.equal(tx.event.healing,heal);assert.equal(tx.event.sourceBeforeHp,sourceHp);assert.equal(tx.event.sourceAfterHp,sourceHp+heal)
      assert.match(tx.event.resultMessage,new RegExp(`User restored ${heal} HP`));assert.doesNotMatch(tx.event.impactMessage,/restored/)
      assert.equal(before.actors.a.hp,sourceHp);assert.equal(before.actors.b.hp,targetHp)
      assert.ok(Object.isFrozen(tx.after.actors.a));assert.ok(Object.isFrozen(tx.after.actors.b))
    }
  }
})
test('vortex previews preserve conditions and Whirlwind leaves all actors unchanged',()=>{
  const before=createBattleState([{id:'a',name:'User',hp:100,maxHp:100},{id:'b',name:'Target',hp:123,maxHp:160,condition:'burn',accuracyStage:-2,defenseStage:2,reflect:true}])
  for(const [moveId,damage] of [['whirlpool',28],['fire-spin',30],['sand-tomb',28],['whirlwind',0]]){
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a)
    assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:123-damage})
    assert.deepEqual(tx.event.targetIds,['b'])
    if(moveId==='whirlwind')assert.match(tx.event.resultMessage,/No HP damage; switching is not simulated/)
  }
})
test('Dragon Rage deals fixed 40 damage; Will-O-Wisp burns without HP loss; secondary statuses remain unchanged',()=>{
  for(const hp of [21,40,160,500]){
    const before=createBattleState([{id:'a',name:'User',hp:100,maxHp:100},{id:'b',name:'Target',hp,maxHp:500,accuracyStage:-2}])
    const rage=resolveMove(before,{moveId:'dragon-rage',sourceId:'a',targetId:'b'})
    assert.equal(rage.after.actors.b.hp,Math.max(0,hp-40));assert.equal(rage.after.actors.b.condition,null)
    const burn=resolveMove(before,{moveId:'will-o-wisp',sourceId:'a',targetId:'b'})
    assert.deepEqual(burn.after.actors.b,{...before.actors.b,condition:'burn'})
    assert.match(burn.event.resultMessage,/Target is burned/);assert.equal(before.actors.b.condition,null)
    for(const moveId of ['ember','tri-attack']){
      const result=resolveMove(burn.after,{moveId,sourceId:'a',targetId:'b'})
      assert.equal(result.after.actors.b.condition,'burn');assert.equal(result.after.actors.b.accuracyStage,-2)
    }
  }
  assert.equal(createBattleState().actors.target.condition,null,'fresh preview clears burn')
})
test('Brick Break removes only opposing screens while preserving other state and original snapshots',()=>{
  for(const lightScreen of [false,true])for(const reflect of [false,true]){
    const before=createBattleState([
      {id:'a',name:'User',hp:120,maxHp:120,lightScreen:true,reflect:true},
      {id:'b',name:'Target',hp:160,maxHp:160,lightScreen,reflect,protected:true,defenseStage:2,accuracyStage:-2,condition:'poison'},
    ])
    const tx=resolveMove(before,{moveId:'brick-break',sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a)
    assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:106,lightScreen:false,reflect:false})
    assert.equal(before.actors.b.lightScreen,lightScreen);assert.equal(before.actors.b.reflect,reflect)
    assert.equal(before.actors.b.hp,160);assert.ok(Object.isFrozen(tx.after.actors.b))
    assert.equal(tx.event.resultMessage.includes('screens were broken'),lightScreen||reflect)
  }
})
test('self moves affect only their user, need no opponent, and preserve combined protection previews',()=>{
  let state=createBattleState([{id:'a',name:'Solo actor',hp:42,maxHp:100,condition:'poison',accuracyStage:-2}])
  for(let i=1;i<=4;i++){
    const tx=resolveMove(state,{moveId:'barrier',sourceId:'a'})
    assert.equal(tx.after.actors.a.defenseStage,Math.min(i*2,6))
    assert.equal(tx.after.actors.a.hp,42);assert.equal(tx.after.actors.a.condition,'poison')
    assert.equal(tx.after.actors.a.accuracyStage,-2);assert.deepEqual(tx.event.targetIds,['a'])
    assert.match(tx.event.resultMessage,i<4?/rose sharply/:/cannot rise further/)
    state=tx.after
  }
  for(const moveId of ['protect','light-screen','reflect'])state=resolveMove(state,{moveId,sourceId:'a',targetId:'missing'}).after
  assert.equal(state.actors.a.protected,true);assert.equal(state.actors.a.lightScreen,true);assert.equal(state.actors.a.reflect,true)
  assert.equal(state.actors.a.defenseStage,6)
  const before=createBattleState([{id:'a',name:'User',hp:42,maxHp:100},{id:'b',name:'Opponent',hp:0,maxHp:80}])
  for(const moveId of ['barrier','protect','light-screen','reflect']){
    const tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.b,before.actors.b)
    assert.equal(tx.after.actors.a.hp,42)
    assert.throws(()=>resolveMove(before,{moveId,sourceId:'b'}),/fainted/)
  }
  assert.equal(createBattleState().actors.source.defenseStage,0)
  assert.equal(createBattleState().actors.source.protected,false)
  for(const defenseStage of [-7,7,.5,NaN])assert.throws(()=>createBattleState([{id:'a',name:'A',hp:1,maxHp:1,defenseStage}]),/defense/)
})
test('Smokescreen preserves HP and poison, bounds accuracy stages, and reset clears both',()=>{
  const start=createBattleState()
  let state=resolveMove(start,{moveId:'toxic',sourceId:'source',targetId:'target'}).after
  for(let i=1;i<=8;i++){
    const result=resolveMove(state,{moveId:'smokescreen',sourceId:'source',targetId:'target'})
    assert.equal(result.after.actors.target.hp,160)
    assert.equal(result.after.actors.target.condition,'bad-poison')
    assert.equal(result.after.actors.target.accuracyStage,-Math.min(i,6))
    assert.match(result.event.resultMessage,i<=6?/accuracy fell/:/cannot fall further/)
    state=result.after
  }
  const damaged=resolveMove(state,{moveId:'smog',sourceId:'source',targetId:'target'}).after
  assert.equal(damaged.actors.target.accuracyStage,-6);assert.equal(damaged.actors.target.condition,'bad-poison')
  assert.equal(start.actors.target.condition,null);assert.equal(start.actors.target.accuracyStage,0)
  assert.deepEqual(createBattleState(),start)
  for(const accuracyStage of [-7,7,.5,NaN])assert.throws(()=>createBattleState([{id:'a',name:'A',hp:1,maxHp:1,accuracyStage}]),/accuracy/)
})
test('core validates actors and moves, clamps HP, and accepts arbitrary names and maximum HP',()=>{
  const state=createBattleState([{id:'a',name:'Small actor',hp:20,maxHp:20},{id:'b',name:'Large actor',hp:5,maxHp:50}])
  const result=resolveMove(state,{moveId:'slash',sourceId:'a',targetId:'b'})
  assert.equal(result.after.actors.b.hp,0);assert.match(result.event.resultMessage,/Large actor took 5 damage/)
  assert.throws(()=>resolveMove(state,{moveId:'unknown',sourceId:'a',targetId:'b'}))
  assert.throws(()=>resolveMove(state,{moveId:'slash',sourceId:'a',targetId:'a'}))
  assert.throws(()=>resolveMove(result.after,{moveId:'slash',sourceId:'a',targetId:'b'}))
  assert.throws(()=>resolveMove(state,{moveId:'slash',sourceId:'a',targetId:'constructor'}))
  assert.throws(()=>createBattleState([{id:1,name:'A',hp:1,maxHp:1},{id:'1',name:'B',hp:1,maxHp:1}]))
})
test('package import boundaries exclude battle authority from FX and rendering from core',()=>{
  for (const file of readdirSync('packages/battle-core/src')) {
    const code=readFileSync('packages/battle-core/src/'+file,'utf8')
    assert.doesNotMatch(code,/from ['"].*(pixi|gsap|vue|battle-fx)|\bwindow\b|\bdocument\b/)
  }
  for (const file of readdirSync('packages/battle-fx/src',{recursive:true}).filter(n=>n.endsWith('.js'))) {
    const code=readFileSync('packages/battle-fx/src/'+file,'utf8')
    assert.doesNotMatch(code,/from ['"].*(battle-core|apps\/)|\b(onHealth|MAX_HP|attackerScale|innerWidth|innerHeight)\b|\b730\b/)
  }
})

test('Seismic Toss resolves from validated user level with no dependency on FX or stat stages',()=>{
  assert.equal(createBattleState().actors.source.level,50)
  for(const level of [1,50,100])for(const hp of [1,80,160]){
    const before=createBattleState([{id:'a',name:'User',hp:75,maxHp:100,level,attackStage:6,condition:'burn'},{id:'b',name:'Opponent',hp,maxHp:160,level:15,defenseStage:6,condition:'poison',confused:true}])
    const tx=resolveMove(before,{moveId:'seismic-toss',sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:Math.max(0,hp-level)})
    assert.match(tx.event.resultMessage,new RegExp(`took ${Math.min(hp,level)} damage`));assert.equal(tx.event.outcome,'hit')
    assert.equal(tx.event.recoil,undefined);assert.equal(tx.event.healing,undefined);assert.equal(before.actors.b.hp,hp)
  }
  for(const level of [0,101,1.5,'50',NaN,Infinity])assert.throws(()=>createBattleState([{id:'a',name:'User',hp:1,maxHp:10,level}]),/Invalid actor level/)
})
