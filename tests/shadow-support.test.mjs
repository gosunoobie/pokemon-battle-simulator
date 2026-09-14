import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS, FX_CATALOG } from '@battle/battle-fx'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { MOVES } from '../apps/game/src/moveCatalog.js'
import { createPreviewState, createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const cases = [
  ['nightmare',.46,1.02,2.5],['spite',.32,.86,2.15],['grudge',null,.9,2.35],
  ['memento',.54,1.12,2.55],['sharpen',null,.7,1.8],['tail-glow',null,.92,2.3],
  ['flash',.3,.62,1.8],['detect',null,.54,1.65],
]
const selfMoves = ['grudge','sharpen','tail-glow','detect']
const targetPoint = (h,id) => id==='tail-glow' ? h.scene.actor('source').anchor(h.scene.actor('source').hasAnchor('tail')?'tail':h.scene.actor('source').hasAnchor('body')?'body':'center')
  : h.scene.actor(selfMoves.includes(id)?'source':'target').anchor('center')
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
function harness(reverse = false, edge = 0, custom = false, solo = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const actors = [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32], ...(custom ? { tail: [.21,.65], eyes: [.61,.23], emission: [.61,.23] } : {}) } },
    { id: 'target', profile: 'tall', x: reverse ? (edge === 2 ? .055 : .26) : (edge === 2 ? .945 : .74),
      y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: reverse ? 1 : -1,
      anchors: { center: edge === 3 ? [.5, .04] : [.48, .44] } },
  ]
  const scene = createSceneGraph({ width, height, actors: solo ? actors.slice(0, 1) : actors })
  const fx = createBattleFx({ glowTexture: Texture.WHITE, timelineEngine: {
    timeline(options) { return timeline = gsap.timeline({ ...options, paused: true }) },
  } })
  return { scene, fx, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true),
    point: n => scene.effects.toLocal({ x: 0, y: 0 }, n), dispose() { fx.dispose(); scene.dispose() } }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
  for (const a of h.scene.actors.values()) {
    for (const key of ['x', 'y', 'rotation']) assert.equal(a.pose[key], 0)
    assert.equal(a.pose.alpha, 1); assert.equal(a.pose.scale.x, 1); assert.equal(a.pose.scale.y, 1)
    assert.equal(a.pose.tint, 0xffffff)
  }
}
function assertBounds(h, label) {
  const { width, height } = h.scene
  for (const a of h.scene.actors.values()) {
    const p = a.anchor('visualCenter'), c = Math.abs(Math.cos(a.pose.rotation)), s = Math.abs(Math.sin(a.pose.rotation)),
      rx = (a.metrics.width*c + a.metrics.height*s)/2, ry = (a.metrics.height*c + a.metrics.width*s)/2
    assert.ok(p.x-rx >= -.05 && p.x+rx <= width+.05 && p.y-ry >= -.05 && p.y+ry <= height+.05, label+' actor bounds')
    assert.equal(a.pose.alpha, 1); assert.equal(a.pose.scale.x, 1); assert.equal(a.pose.scale.y, 1)
  }
  let seen = 0
  function walk(n, alpha = 1) {
    const visible = alpha * n.alpha
    assert.ok(n.alpha >= 0 && n.alpha <= 1, label+' valid alpha')
    if (visible > .03 && ['Graphics', 'Sprite'].includes(n.constructor.name)) {
      const b = n.getBounds(); seen++
      assert.ok(b.x >= -.05 && b.y >= -.05 && b.x+b.width <= width+.05 && b.y+b.height <= height+.05,
        `${label} ${n.label}: ${JSON.stringify(b)}`)
    }
    for (const child of n.children ?? []) walk(child, visible)
  }
  walk(h.scene.effects)
  return seen
}

test('all eight status moves have one rule, catalog entry, description and explicit targeting',()=>{
  for(const [id,,contact,duration]of cases){
    const rule=MOVE_RULES.find(m=>m.id===id),move=MOVES.find(m=>m.id===id)
    assert.equal(MOVE_RULES.filter(m=>m.id===id).length,1);assert.equal(FX_CATALOG.filter(m=>m.id===id).length,1)
    assert.equal(rule.damage,0);assert.equal(rule.power,null);assert.equal(rule.target,selfMoves.includes(id)?'self':undefined)
    assert.deepEqual(EFFECT_TIMINGS[id],{contact,duration});assert.ok(move.description&&move.mechanicNote&&move.showcase)
    if(selfMoves.includes(id))assert.equal(move.accuracyText,'Always')
  }
})

test('all eight outcomes preserve unrelated state from either side and apply only their declared effect',()=>{
  for(const [moveId]of cases)for(const sourceId of ['source','target']){
    const targetId=sourceId==='source'?'target':'source'
    const before=createBattleState([{id:sourceId,name:'User',hp:42,maxHp:100,condition:'burn',defenseStage:2,heldItem:'Oran Berry',seeded:true},
      {id:targetId,name:'Target',hp:77,maxHp:100,condition:'sleep',confused:true,consumedItem:'Lum Berry',lightScreen:true}])
    const tx=resolveMove(before,{moveId,sourceId,targetId}),source={...before.actors[sourceId]},target={...before.actors[targetId]}
    if(moveId==='nightmare')target.nightmare=true
    if(moveId==='grudge')source.grudge=true
    if(moveId==='memento'){source.hp=0;target.attackStage=-2;target.specialAttackStage=-2}
    if(moveId==='sharpen')source.attackStage=1
    if(moveId==='tail-glow')source.specialAttackStage=3
    if(moveId==='flash')target.accuracyStage=-1
    if(moveId==='detect')source.protected=true
    assert.deepEqual(tx.after.actors[sourceId],source,moveId);assert.deepEqual(tx.after.actors[targetId],target,moveId)
    assert.equal(tx.event.outcome,'hit');assert.deepEqual(tx.event.targetIds,[selfMoves.includes(moveId)?sourceId:targetId])
    assert.equal(tx.event.healing,undefined);assert.equal(tx.event.recoil,undefined);assert.equal(before.actors[sourceId].hp,42)
    assert.ok(Object.isFrozen(tx.after.actors[sourceId]));assert.ok(Object.isFrozen(tx.event))
  }
})

test('Nightmare requires a sleeping target, rejects repeats, preserves sleep through damage and clears when cured',()=>{
  for(const sourceId of ['source','target'])for(const condition of [null,'sleep','burn','poison','bad-poison','paralysis'])for(const nightmare of [false,true]){
    const targetId=sourceId==='source'?'target':'source',before=createBattleState([{id:sourceId,name:'User',hp:60,maxHp:100,condition:'poison'},
      {id:targetId,name:'Target',hp:77,maxHp:100,condition,nightmare,grudge:true,heldItem:'Sitrus Berry'}])
    const tx=resolveMove(before,{moveId:'nightmare',sourceId,targetId}),success=condition==='sleep'&&!nightmare
    assert.equal(tx.event.outcome,success?'hit':'failed');assert.deepEqual(tx.after.actors[sourceId],before.actors[sourceId])
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],nightmare:nightmare||success})
    if(condition!=='sleep')assert.match(tx.event.resultMessage,/must be asleep/)
    if(!success)assert.deepEqual(tx.after.actors,before.actors)
    if(success){
      const hit=resolveMove(tx.after,{moveId:'pound',sourceId,targetId});assert.equal(hit.after.actors[targetId].nightmare,true);assert.equal(hit.after.actors[targetId].condition,'sleep')
      const cure=resolveMove(tx.after,{moveId:'heal-bell',sourceId:targetId});assert.equal(cure.after.actors[targetId].nightmare,false);assert.equal(cure.after.actors[targetId].condition,null)
      assert.equal(cure.after.actors[targetId].grudge,true);assert.equal(cure.after.actors[targetId].hp,77)
    }
  }
  assert.throws(()=>createBattleState([{id:'x',name:'X',hp:1,maxHp:1,nightmare:'yes'}]),/Invalid support preview flag/)
  assert.equal(createBattleState().actors.source.nightmare,false)
})

test('Memento faints only its user even at both stat floors and commits partial drops with unchanged target HP',()=>{
  for(const sourceId of ['source','target'])for(const hp of [1,42,156])for(const attackStage of [-6,-5,0,6])for(const specialAttackStage of [-6,-5,0,6]){
    const targetId=sourceId==='source'?'target':'source',before=createBattleState([{id:sourceId,name:'User',hp,maxHp:156,condition:'burn',grudge:true},
      {id:targetId,name:'Target',hp:1,maxHp:160,attackStage,specialAttackStage,protected:true,nightmare:true,condition:'sleep'}])
    const tx=resolveMove(before,{moveId:'memento',sourceId,targetId})
    assert.deepEqual(tx.after.actors[sourceId],{...before.actors[sourceId],hp:0})
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],attackStage:Math.max(-6,attackStage-2),specialAttackStage:Math.max(-6,specialAttackStage-2)})
    assert.equal(tx.event.outcome,'hit');assert.equal(tx.event.selfDestruct,true);assert.equal(tx.event.sourceBeforeHp,hp);assert.equal(tx.event.sourceAfterHp,0)
    assert.match(tx.event.resultMessage,/User fainted/);assert.match(tx.event.resultMessage,/Attack/);assert.match(tx.event.resultMessage,/Special Attack/)
    assert.doesNotMatch(tx.event.resultMessage,/took 0 damage/);assert.throws(()=>resolveMove(tx.after,{moveId:'memento',sourceId,targetId}),/fainted/)
  }
})

test('Sharpen and Tail Glow clamp boosts, Flash stops at the accuracy floor, and Grudge and Detect work solo',()=>{
  for(const [moveId,field,delta]of [['sharpen','attackStage',1],['tail-glow','specialAttackStage',3],['flash','accuracyStage',-1]])for(const stage of [-6,-5,0,4,5,6]){
    const self=moveId!=='flash',before=createBattleState([{id:'a',name:'User',hp:50,maxHp:100,[field]:stage},
      {id:'b',name:'Target',hp:60,maxHp:100,[field]:stage}]),tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'}),id=self?'a':'b'
    const expected=Math.max(-6,Math.min(6,stage+delta));assert.equal(tx.after.actors[id][field],expected)
    assert.equal(tx.event.outcome,expected===stage?'failed':'hit');assert.deepEqual(tx.after.actors[self?'b':'a'],before.actors[self?'b':'a'])
    if(moveId==='tail-glow'&&stage===0)assert.match(tx.event.resultMessage,/rose drastically/)
  }
  for(const moveId of ['grudge','detect']){
    const before=createBattleState([{id:'solo',name:'Solo',hp:37,maxHp:100,condition:'poison',lightScreen:true}]),flag=moveId==='grudge'?'grudge':'protected'
    const first=resolveMove(before,{moveId,sourceId:'solo'}),again=resolveMove(first.after,{moveId,sourceId:'solo'})
    assert.deepEqual(first.after.actors.solo,{...before.actors.solo,[flag]:true});assert.deepEqual(again.after.actors,first.after.actors)
    assert.equal(first.event.outcome,'hit');assert.equal(again.event.outcome,moveId==='grudge'?'failed':'hit')
  }
  assert.throws(()=>createBattleState([{id:'x',name:'X',hp:1,maxHp:1,grudge:1}]),/Invalid support preview flag/)
  assert.equal(createBattleState().actors.source.grudge,false)
  const protect=resolveMove(createBattleState(),{moveId:'protect',sourceId:'source'}),detect=resolveMove(protect.after,{moveId:'detect',sourceId:'source'})
  assert.deepEqual(detect.after.actors,protect.after.actors)
})

test('Nightmare fixture seeds sleep only on the selected living recipient and preserves existing conditions',()=>{
  const move=MOVES.find(m=>m.id==='nightmare')
  for(const sourceId of ['a','b'])for(const condition of [null,'sleep','poison']){
    const targetId=sourceId==='a'?'b':'a',actors=[{id:sourceId,name:'User',hp:60,maxHp:100,condition:'burn'},
      {id:'spectator',name:'Spectator',hp:50,maxHp:100},{id:targetId,name:'Target',hp:77,maxHp:100,condition}]
    const before=createBattleState(actors),state=createPreviewState(move,{sourceId,targetId,actors})
    assert.deepEqual(state.actors[sourceId],before.actors[sourceId]);assert.deepEqual(state.actors.spectator,before.actors.spectator)
    assert.deepEqual(state.actors[targetId],{...before.actors[targetId],condition:condition??'sleep'})
    const dead=createPreviewState(move,{sourceId,targetId,actors:actors.map(a=>a.id===targetId?{...a,hp:0}:a)})
    assert.equal(dead.actors[targetId].hp,0);assert.equal(dead.actors[targetId].condition,condition)
    const tx=createPreviewTransaction(move,{sourceId,targetId,actors});assert.equal(tx.event.outcome,condition==='poison'?'failed':'hit')
  }
})

test('all eight committed results reconcile with effects off, cues, failure, missing cues and skip', async () => {
  for (const [id] of cases) for (const sourceId of ['source','target']) for (const mode of ['off','cue','failure','missing','skip']) {
    const targetId=sourceId==='source'?'target':'source',tx=createPreviewTransaction(MOVES.find(m=>m.id===id),{sourceId,targetId})
    let display,finish,cueState
    const presenter=createPresenter({getScene:()=>({}),onDisplay:next=>{display=next;if(next.animate)cueState=next.state},loadFx:async()=>({play(request,options){
      assert.equal(request.sourceId,sourceId);assert.deepEqual(request.targetIds,[selfMoves.includes(id)?sourceId:targetId])
      for(const key of ['hp','damage','heldItem','nightmare','grudge','condition','attackChange','specialAttackChange','selfDestruct','requiresTargetSleep'])assert.equal(request[key],undefined,key+' stays out of FX')
      if(mode==='failure')throw new Error('Simulated renderer failure')
      if(mode==='cue')options.onCue({type:'impact'})
      return{finished:new Promise(resolve=>{finish=resolve}),cancel(){finish?.({status:'cancelled'})}}
    }})})
    const pending=presenter.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='skip')presenter.skip();else finish?.({status:'completed'})
    await pending;assert.deepEqual(display.state,tx.after,id+' '+mode);if(mode==='cue')assert.deepEqual(cueState,tx.after);presenter.destroy()
  }
})

test('eight effects contact their semantic target before one cue and clean up in normal, reduced and cancelled playback', async () => {
  for (const reverse of [false,true]) {
    const h=harness(reverse)
    try{for(const [id,release,contact,duration]of cases){
      const cues=[],run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:cue=>{
        const tip=h.node(id+'-tip'),p=h.point(tip);close(p,targetPoint(h,id),id+' contact before cue');close(h.point(h.node(id+'-impact')),p,id+' impact')
        assert.ok(tip.alpha>.01,id+' visible contact');cues.push(cue.type)
      }})
      await tick();if(release!=null){h.tl.time(release,false);close(h.point(h.node(id+'-tip')),h.scene.actor('source').anchor(id==='nightmare'&&h.scene.actor('source').hasAnchor('eyes')?'eyes':'emission'),id+' release')}
      h.tl.time(contact-.001,false);assert.equal(cues.length,0);h.tl.time(contact,false);assert.deepEqual(cues,['impact'])
      h.tl.time(duration,false);assert.equal((await run.finished).status,'completed');clean(h)
      for(const time of [contact*.5,contact+.1]){
        const cancelled=h.fx.play({moveId:id,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.tl.time(time,false);cancelled.cancel();assert.equal((await cancelled.finished).status,'cancelled');clean(h)
      }
      const reducedCues=[],reduced=h.fx.play({moveId:id,sourceId:'source',targetIds:['target']},{scene:h.scene,reducedMotion:true,onCue:c=>reducedCues.push(c.type)})
      await tick();h.tl.time(.8,false);assert.equal((await reduced.finished).status,'completed');assert.deepEqual(reducedCues,['impact']);clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('full new artwork and rotated actors stay inside normal, edge and portrait fields from both sides', async () => {
  for(const reverse of [false,true])for(const edge of [0,1,2,3,4]){
    const h=harness(reverse,edge)
    try{for(const [id,,contact,duration]of cases){
      const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:()=>close(h.point(h.node(id+'-tip')),targetPoint(h,id),id+' edge contact')})
      await tick();let seen=0
      for(let time=.04;time<duration-.02;time+=.035){h.tl.time(time,false);seen+=assertBounds(h,`${id} edge${edge} reverse${reverse} t${time}`)}
      assert.ok(seen>0,id+' visible art');h.tl.time(duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('Grudge, Sharpen, Tail Glow and Detect finish and cancel without an opponent from either side',async()=>{
  for(const reverse of [false,true])for(const reducedMotion of [false,true])for(const id of selfMoves)for(const targetIds of [undefined,['missing'],['source']]){
    const h=harness(reverse,0,false,true),cues=[]
    try{
      const run=h.fx.play({moveId:id,sourceId:'source',targetIds,visualSeed:42},{scene:h.scene,reducedMotion,onCue:c=>cues.push(c.type)})
      await tick();h.tl.time(reducedMotion?.8:EFFECT_TIMINGS[id].duration,false);assert.equal((await run.finished).status,'completed');assert.deepEqual(cues,['impact']);clean(h)
      const cancelled=h.fx.play({moveId:id,sourceId:'source'},{scene:h.scene,reducedMotion});await tick();h.tl.time(.3,false);cancelled.cancel();assert.equal((await cancelled.finished).status,'cancelled');clean(h)
    }finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('new auras and emissions honor custom live anatomy through their active frames',async()=>{
  for(const reverse of [false,true])for(const custom of [false,true]){
    const h=harness(reverse,0,custom),source=h.scene.actor('source')
    const tail=source.hasAnchor('tail')?'tail':source.hasAnchor('body')?'body':'center',eyes=source.hasAnchor('eyes')?'eyes':'emission'
    try{for(const [id,label,anchor,first,second]of [
      ['nightmare','nightmare-root',eyes,.2,.49],['spite','spite-root','emission',.12,.38],
      ['memento','memento-gather','emission',.2,.6],['flash','flash-source-glint','emission',.15,.53],
      ['tail-glow','tail-glow-root',tail,.3,1.2],['detect','detect-eye-glint',eyes,.15,.6],
    ]){
      const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
      h.tl.time(first,false);close(h.point(h.node(label)),source.anchor(anchor),id+' initial socket')
      source.pose.x=reverse?-8:8;source.pose.y=-12;source.pose.rotation=.025
      h.tl.time(second,false);close(h.point(h.node(label)),source.anchor(anchor),id+' follows posed socket');assertBounds(h,id+' live socket')
      h.tl.time(EFFECT_TIMINGS[id].duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('all eight aftermaths keep moving and Memento stat symbols descend in world coordinates',async()=>{
  const flows=[['nightmare','nightmare-mote-0',1.45,1.65],['spite','spite-mote-0',1.1,1.3],['grudge','grudge-ember-0',1.25,1.5],
    ['memento','memento-stat-attack',1.65,1.85,true],['sharpen','sharpen-glint-19',1.15,1.33],
    ['tail-glow','tail-glow-firefly-25',1.53,1.8],['flash','flash-afterimage-4',1.15,1.31],['detect','detect-streak-11',.84,1]]
  for(const reverse of [false,true]){
    const h=harness(reverse)
    try{for(const [id,label,first,second,down]of flows){
      const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
      h.tl.time(first,false);const node=h.node(label),p=h.point(node);assert.ok(node.alpha>.02,label+' visible')
      h.tl.time(second,false);const q=h.point(node);assert.ok(node.alpha>.02,label+' remains visible');assert.ok(Math.hypot(q.x-p.x,q.y-p.y)>.2,label+' moving')
      if(down)assert.ok(q.y>p.y+.1,label+' world-down')
      h.tl.time(EFFECT_TIMINGS[id].duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
