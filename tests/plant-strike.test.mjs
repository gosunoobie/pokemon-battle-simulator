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
  ['feint-attack', null, .66, 1.85, 42], ['aerial-ace', null, .62, 1.8, 42],
  ['skull-bash', null, 1.16, 2.55, 91], ['sky-attack', null, 1.28, 2.75, 98],
  ['leech-seed', .36, .94, 2.3, 0], ['ingrain', null, 1.04, 2.35, 0],
  ['frenzy-plant', .48, 1.2, 2.8, 100], ['crush-claw', null, .86, 2.1, 52],
  ['knock-off', null, .72, 1.95, 46], ['needle-arm', null, .82, 2.05, 42],
  ['pound', null, .5, 1.45, 28],
]
const attachments = {
  'feint-attack': ['palm', 'hand'], 'aerial-ace': ['wing', 'hand'], 'skull-bash': ['head', 'emission'],
  'sky-attack': ['wing', 'hand'], 'crush-claw': ['claw', 'hand'], 'knock-off': ['hand', 'hand'],
  'needle-arm': ['claw', 'hand'], 'pound': ['palm', 'hand'],
}
const targetPoint = (h, id) => id === 'ingrain' ? h.scene.actor('source').base('floor')
  : id === 'frenzy-plant' ? h.scene.actor('target').base('floor') : h.scene.actor('target').anchor('center')
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
function harness(reverse = false, edge = 0, custom = false, solo = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const actors = [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32], ...(custom ? { palm: [.39, .4], wing: [.3, .26], head: [.56, .15], claw: [.28, .4], ground: [.56, .96] } : {}) } },
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

test('eleven moves are registered once with independent host metadata, timings and correct targeting', () => {
  for (const [id,,contact,duration] of cases) {
    assert.equal(MOVE_RULES.filter(m => m.id === id).length, 1); assert.equal(FX_CATALOG.filter(m => m.id === id).length, 1)
    const move = MOVES.find(m => m.id === id); assert.ok(move.showcase); assert.ok(move.description && move.mechanicNote)
    assert.deepEqual(EFFECT_TIMINGS[id], { contact, duration })
    assert.equal(move.target, id === 'ingrain' ? 'self' : undefined)
    if (['feint-attack','aerial-ace','ingrain'].includes(id)) assert.equal(move.accuracyText, 'Always')
  }
})

test('new move outcomes preserve immutable actors, conditions, badges and unrelated items from either side', () => {
  for (const [moveId,,,,damage] of cases) for (const sourceId of ['source','target']) for (const hp of [1,160]) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const before = createBattleState([
      { id: sourceId, name: 'User', hp: 70, maxHp: 156, condition: 'burn', defenseStage: 2, heldItem: 'Sitrus Berry', consumedItem: 'Lum Berry' },
      { id: targetId, name: 'Target', hp, maxHp: 160, condition: 'poison', confused: true, speedStage: -2, heldItem: 'Oran Berry', consumedItem: 'Cheri Berry' },
    ])
    const tx = resolveMove(before, { moveId, sourceId, targetId })
    const source = { ...before.actors[sourceId], ...(moveId === 'skull-bash' ? { defenseStage: 3 } : {}), ...(moveId === 'ingrain' ? { ingrained: true } : {}) }
    const target = { ...before.actors[targetId], hp: Math.max(0,hp-(moveId === 'knock-off' ? 69 : damage)),
      ...(moveId === 'leech-seed' ? { seeded: true } : {}), ...(moveId === 'knock-off' ? { heldItem: null } : {}) }
    assert.deepEqual(tx.after.actors[sourceId],source); assert.deepEqual(tx.after.actors[targetId],target)
    assert.deepEqual(tx.event.targetIds,[moveId === 'ingrain' ? sourceId : targetId]); assert.equal(tx.event.outcome,'hit')
    assert.equal(tx.event.healing,undefined); assert.equal(tx.event.recoil,undefined); assert.equal(before.actors[targetId].hp,hp)
    assert.ok(Object.isFrozen(tx.after.actors[targetId])); assert.ok(Object.isFrozen(tx.event))
  }
})

test('Leech Seed and Ingrain set separate validated badges without immediate HP changes or repeated application', () => {
  for (const [moveId,field] of [['leech-seed','seeded'],['ingrain','ingrained']]) for (const sourceId of ['source','target']) {
    const targetId = sourceId === 'source' ? 'target' : 'source', affectedId = moveId === 'ingrain' ? sourceId : targetId
    const before = createBattleState([{ id: sourceId,name:'User',hp:40,maxHp:100,condition:'burn' },{ id:targetId,name:'Target',hp:60,maxHp:100,condition:'poison' }])
    const first = resolveMove(before,{moveId,sourceId,targetId}), second = resolveMove(first.after,{moveId,sourceId,targetId})
    assert.deepEqual(first.after.actors[affectedId],{...before.actors[affectedId],[field]:true})
    assert.deepEqual(second.after.actors,first.after.actors); assert.equal(second.event.outcome,'failed'); assert.match(second.event.resultMessage,/already has/)
    assert.equal(first.event.beforeHp,first.event.afterHp); assert.equal(first.event.healing,undefined)
    const damaged = resolveMove(first.after,{moveId:'pound',sourceId,targetId})
    assert.equal(damaged.after.actors[affectedId][field],true)
    assert.equal(createBattleState().actors.source[field],false)
    assert.throws(()=>createBattleState([{id:'a',name:'A',hp:1,maxHp:1,[field]:'yes'}]),/Invalid support preview flag/)
  }
  const solo = createBattleState([{id:'plant',name:'Plant',hp:42,maxHp:100,condition:'poison'}])
  const tx = resolveMove(solo,{moveId:'ingrain',sourceId:'plant'})
  assert.deepEqual(tx.event.targetIds,['plant']); assert.deepEqual(tx.after.actors.plant,{...solo.actors.plant,ingrained:true})
  const cured = resolveMove(tx.after,{moveId:'refresh',sourceId:'plant'})
  assert.equal(cured.after.actors.plant.ingrained,true); assert.equal(cured.after.actors.plant.condition,null)
})

test('Skull Bash boosts only the user Defense while still damaging at the cap and on a knockout', () => {
  for (const sourceId of ['source','target']) for (const defenseStage of [-6,5,6]) for (const hp of [1,160]) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const before = createBattleState([{id:sourceId,name:'User',hp:60,maxHp:100,defenseStage,condition:'burn'},
      {id:targetId,name:'Target',hp,maxHp:160,defenseStage:-2,condition:'poison'}])
    const tx = resolveMove(before,{moveId:'skull-bash',sourceId,targetId})
    assert.deepEqual(tx.after.actors[sourceId],{...before.actors[sourceId],defenseStage:Math.min(6,defenseStage+1)})
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:Math.max(0,hp-91)})
    assert.equal(tx.event.outcome,'hit'); assert.match(tx.event.resultMessage,new RegExp(`took ${Math.min(hp,91)} damage`))
    assert.match(tx.event.resultMessage,defenseStage===6?/User’s Defense cannot rise further/:/User’s Defense rose/)
  }
})

test('Knock Off boosts damage only for a held item, removes it even on knockout and never consumes or transfers it', () => {
  for (const sourceId of ['source','target']) for (const heldItem of [null,'Oran Berry','Custom item']) for (const hp of [1,46,69,160]) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const before = createBattleState([{id:sourceId,name:'User',hp:80,maxHp:100,heldItem:'Sitrus Berry',consumedItem:'Lum Berry'},
      {id:targetId,name:'Target',hp,maxHp:160,heldItem,consumedItem:'Cheri Berry',condition:'poison',seeded:true}])
    const damage = heldItem ? 69 : 46, tx=resolveMove(before,{moveId:'knock-off',sourceId,targetId})
    assert.deepEqual(tx.after.actors[sourceId],before.actors[sourceId])
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:Math.max(0,hp-damage),heldItem:null})
    assert.equal(tx.event.outcome,'hit'); assert.match(tx.event.resultMessage,new RegExp(`took ${Math.min(hp,damage)} damage`))
    if(heldItem) assert.ok(tx.event.resultMessage.includes('lost its '+heldItem)); else assert.doesNotMatch(tx.event.resultMessage,/lost its/)
    if(tx.after.actors[targetId].hp>0) {
      const next=resolveMove(tx.after,{moveId:'knock-off',sourceId,targetId})
      assert.equal(next.after.actors[targetId].hp,Math.max(0,tx.after.actors[targetId].hp-46))
    }
  }
})

test('Knock Off fixture uses the explicit living receiver and preserves supplied items and other participants', () => {
  const move=MOVES.find(m=>m.id==='knock-off')
  for(const sourceId of ['a','b']) for(const heldItem of [null,'Custom berry']) {
    const targetId=sourceId==='a'?'b':'a',actors=[{id:sourceId,name:'User',hp:60,maxHp:100,heldItem:'Sitrus Berry'},
      {id:'spectator',name:'Spectator',hp:20,maxHp:100},{id:targetId,name:'Target',hp:80,maxHp:100,heldItem}]
    const state=createPreviewState(move,{sourceId,targetId,actors})
    assert.equal(state.actors[targetId].heldItem,heldItem??'Oran Berry');assert.equal(state.actors[sourceId].heldItem,'Sitrus Berry');assert.equal(state.actors.spectator.heldItem,null)
    const tx=createPreviewTransaction(move,{sourceId,targetId,actors});assert.equal(tx.after.actors[targetId].hp,11);assert.equal(tx.after.actors[targetId].heldItem,null)
    const dead=createPreviewState(move,{sourceId,targetId,actors:actors.map(a=>a.id===targetId?{...a,hp:0}:a)})
    assert.equal(dead.actors[targetId].hp,0);assert.equal(dead.actors[targetId].heldItem,heldItem)
  }
})

test('all eleven committed results reconcile with effects off, cues, failure, missing cues and skip', async () => {
  for (const [id] of cases) for (const sourceId of ['source','target']) for (const mode of ['off','cue','failure','missing','skip']) {
    const targetId=sourceId==='source'?'target':'source',tx=createPreviewTransaction(MOVES.find(m=>m.id===id),{sourceId,targetId})
    let display,finish,cueState
    const presenter=createPresenter({getScene:()=>({}),onDisplay:next=>{display=next;if(next.animate)cueState=next.state},loadFx:async()=>({play(request,options){
      assert.equal(request.sourceId,sourceId);assert.deepEqual(request.targetIds,[id==='ingrain'?sourceId:targetId])
      for(const key of ['hp','damage','heldItem','seeded','ingrained','sourceDefenseChange'])assert.equal(request[key],undefined,key+' stays out of FX')
      if(mode==='failure')throw new Error('Simulated renderer failure')
      if(mode==='cue')options.onCue({type:'impact'})
      return{finished:new Promise(resolve=>{finish=resolve}),cancel(){finish?.({status:'cancelled'})}}
    }})})
    const pending=presenter.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='skip')presenter.skip();else finish?.({status:'completed'})
    await pending;assert.deepEqual(display.state,tx.after,id+' '+mode);if(mode==='cue')assert.deepEqual(cueState,tx.after);presenter.destroy()
  }
})

test('eleven effects contact their semantic target before one cue and clean up in normal, reduced and cancelled playback', async () => {
  for (const reverse of [false,true]) {
    const h=harness(reverse)
    try{for(const [id,release,contact,duration]of cases){
      const cues=[],run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:cue=>{
        const tip=h.node(id+'-tip'),p=h.point(tip);close(p,targetPoint(h,id),id+' contact before cue');close(h.point(h.node(id+'-impact')),p,id+' impact')
        assert.ok(tip.alpha>.6,id+' visible contact');cues.push(cue.type)
      }})
      await tick();if(release!=null){h.tl.time(release,false);close(h.point(h.node(id+'-tip')),h.scene.actor('source').anchor(id==='frenzy-plant'?'ground':'emission'),id+' release')}
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

test('all eight strike attachments follow custom anatomy and their fallback sockets through approach and recovery', async () => {
  for(const reverse of [false,true])for(const custom of [false,true]){
    const h=harness(reverse,0,custom),source=h.scene.actor('source')
    try{for(const [id,[explicit,fallback]]of Object.entries(attachments)){
      const {contact,duration}=EFFECT_TIMINGS[id],run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target']},{scene:h.scene})
      await tick()
      for(const time of [.2,contact*.6,contact-.02,contact,contact+.18]){h.tl.time(time,false);close(h.point(h.node(id+'-root')),source.anchor(custom?explicit:fallback),id+' attachment at'+time);assertBounds(h,id+' attached')}
      h.tl.time(duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('Ingrain plays and cancels with no opponent in either direction and both motion modes', async () => {
  for(const reverse of [false,true])for(const reducedMotion of [false,true]){
    const h=harness(reverse,0,false,true),cues=[]
    try{
      const run=h.fx.play({moveId:'ingrain',sourceId:'source',visualSeed:42},{scene:h.scene,reducedMotion,onCue:c=>cues.push(c.type)})
      await tick();h.tl.time(reducedMotion?.8:2.35,false);assert.equal((await run.finished).status,'completed');assert.deepEqual(cues,['impact']);clean(h)
      const cancelled=h.fx.play({moveId:'ingrain',sourceId:'source'},{scene:h.scene,reducedMotion});await tick();h.tl.time(.3,false);cancelled.cancel();assert.equal((await cancelled.finished).status,'cancelled');clean(h)
    }finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('plant particles keep moving through their aftermath and Knock Off token and root chips fall downward', async () => {
  const flows=[['leech-seed','leech-seed-mote-17',1.5,1.72,false],['ingrain','ingrain-leaf-17',1.48,1.68,false],
    ['frenzy-plant','frenzy-plant-chip-29',1.98,2.07,true],['knock-off','knock-off-token',1.27,1.39,true]]
  for(const reverse of [false,true]){
    const h=harness(reverse)
    try{for(const [id,label,first,second,down]of flows){
      const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
      h.tl.time(first,false);const node=h.node(label),p=h.point(node);assert.ok(node.alpha>.02,label+' visible in aftermath')
      h.tl.time(second,false);const q=h.point(node);assert.ok(node.alpha>.02,label+' remains visible');assert.ok(Math.hypot(q.x-p.x,q.y-p.y)>.2,label+' continues moving')
      if(down)assert.ok(q.y>p.y+.1,label+' gravity remains world-down')
      h.tl.time(EFFECT_TIMINGS[id].duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
