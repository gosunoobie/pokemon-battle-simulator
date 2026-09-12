import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createBattleState, resolveMove } from '@battle/battle-core'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick=()=>new Promise(resolve=>setImmediate(resolve))
const moves=[
  ['bullet-seed','emission','emission',.25,.105,5,.36,50],
  ['pin-missile','spike','emission',.3,.12,4,.46,44],
  ['spike-cannon','spike','emission',.28,.19,3,.31,44],
  ['icicle-spear','emission','emission',.34,.2,3,.5,50],
  ['poison-sting','stinger','emission',.28,0,1,.44,18],
  ['twineedle','stinger','emission',.28,.2,2,.43,32],
  ['swift','emission','emission',.32,.085,5,.62,42],
  ['pay-day','coin','emission',.32,.15,3,.58,28],
  ['rock-throw','rock','hand',.4,0,1,.67,40],
  ['egg-bomb','egg','hand',.38,0,1,.75,70],
  ['barrage','emission','emission',.27,.13,5,.42,42],
  ['present','gift','hand',.42,0,1,.72,56],
]
function harness(reversed,profile,custom=false,low=false){
  let timeline
  const sourceAnchors=custom?{origin:[.43,.94],emission:[.79,.35],hand:[.84,.61],spike:[.72,.18],stinger:[.89,.66],coin:[.74,.38],rock:[.81,.52],egg:[.83,.55],gift:[.85,.58]}:{}
  const targetAnchors=custom?{origin:[.52,.98],center:[.46,.43]}:{}
  if(low){sourceAnchors.emission=[.8,.99];sourceAnchors.spike=[.8,.99];targetAnchors.center=[.5,.99]}
  const scene=createSceneGraph({width:720,height:600,actors:[
    {id:'source',profile,x:reversed?.74:.26,y:low?.995:.82,height:low?.25:.32,facing:reversed?-1:1,anchors:sourceAnchors},
    {id:'target',profile:low?'tall':'wide',x:reversed?.26:.74,y:low?.995:.65,height:low?.25:.2,facing:reversed?1:-1,anchors:targetAnchors},
  ]})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},node(label){return scene.effects.getChildByLabel(label,true)},world(node){return scene.effects.toLocal({x:0,y:0},node)},dispose(){fx.dispose();scene.dispose()}}
}
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.035,`${label}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`)
function clean(h){
  assert.equal(h.scene.effects.children.length,0)
  for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.tint,0xffffff)}
}

test('projectile previews commit one fixed damage result with no random hit, poison, money or Present healing rules',()=>{
  for(const [moveId,,,,,,,damage]of moves)for(const sourceId of ['a','b'])for(const hp of [1,160]){
    const targetId=sourceId==='a'?'b':'a'
    const state=createBattleState([{id:sourceId,name:'User',hp:70,maxHp:160,condition:'burn',attackStage:2},{id:targetId,name:'Recipient',hp,maxHp:160,condition:'poison',defenseStage:1,confused:true}])
    const before=resolveMove(state,{moveId:'rain-dance',sourceId}).after,tx=resolveMove(before,{moveId,sourceId,targetId})
    assert.deepEqual(tx.after.actors[sourceId],before.actors[sourceId]);assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:Math.max(0,hp-damage)})
    assert.equal(tx.after.weather,'rain');assert.equal(tx.event.outcome,'hit');assert.equal(tx.event.recoil,undefined);assert.equal(tx.event.healing,undefined)
    assert.deepEqual(tx.event.targetIds,[targetId]);assert.equal(tx.after.revision,before.revision+1)
  }
})

test('each projectile leaves its live socket and reaches the posed target before a single final cue from either side',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall'])for(const custom of [false,true]){
    const h=harness(reversed,profile,custom),source=h.scene.actor('source'),target=h.scene.actor('target')
    if(!custom)delete source.hasAnchor
    try{for(const [moveId,preferred,fallback,start,interval,count,flight]of moves){
      const cues=[],launches=[],events=[]
      const shot=i=>h.node(`${moveId}-shot-${i}`),mark=i=>h.node(`${moveId}-impact-${i}`)
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{cues.push(c.type);close(h.world(shot(count-1)),h.world(mark(count-1)),moveId+' geometry before cue')}})
      await tick()
      for(let i=0;i<count;i++){
        events.push({t:start+interval*i,launch:i})
        events.push({t:start+interval*i+flight+(moveId==='barrage'?(i%2)*.03:0),hit:i})
      }
      events.sort((a,b)=>a.t-b.t)
      for(const e of events){
        h.tl.time(e.t-.0001,false);assert.equal(cues.length,0,moveId+' result waits for final contact')
        if(e.launch!==undefined){
          h.tl.time(e.t,false)
          const anchor=custom?preferred:fallback
          close(h.world(shot(e.launch)),source.anchor(anchor),moveId+' live launch '+e.launch)
          launches.push(h.world(shot(e.launch)))
        }else{
          const posedCenter=target.anchor('visualCenter')
          h.tl.time(e.t,false)
          const p=h.world(shot(e.hit))
          if(moveId!=='present')close(p,h.world(mark(e.hit)),moveId+' hit '+e.hit)
          assert.ok(Math.abs(p.x-posedCenter.x)<=target.metrics.width/2+.04&&Math.abs(p.y-posedCenter.y)<=target.metrics.height/2+.04,moveId+' reaches visible target')
          assert.ok(shot(e.hit).alpha>.9)
        }
      }
      for(const launch of launches)close(launch,launches[0],moveId+' holds firing pose through final launch')
      if(moveId==='present'){
        assert.equal(cues.length,0,'gift arrival does not reveal damage');h.tl.time(1.31,false);assert.equal(cues.length,0)
        h.tl.time(1.32,false)
        const lid=h.node('present-lid'),first={x:lid.x,y:lid.y};h.tl.time(1.52,false)
        assert.ok(Math.hypot(lid.x-first.x,lid.y-first.y)>5,'gift lid visibly releases')
      }
      assert.deepEqual(cues,['impact'])
      const point=h.world(shot(count-1));h.scene.fit(320,480);close(h.world(shot(count-1)),point,'viewport fit keeps logical geometry')
      h.tl.time(EFFECT_TIMINGS[moveId].duration-.02,false)
      assert.ok(Math.abs(source.pose.x)<.001);assert.ok(Math.abs(target.pose.x)<.001)
      h.tl.time(EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('lower-edge projectile lanes stay on the target and downward fan curves remain in the scene',async()=>{
  for(const reversed of [false,true]){
    const h=harness(reversed,'tall',true,true),target=h.scene.actor('target')
    try{for(const [moveId,,,start,interval,count,flight]of moves){
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick()
      for(let t=.02;t<EFFECT_TIMINGS[moveId].duration;t+=.025){
        h.tl.time(t,false)
        for(let i=0;i<count;i++){
          const shot=h.node(`${moveId}-shot-${i}`),p=h.world(shot)
          const age=t-start-interval*i,travel=flight+(moveId==='barrage'?(i%2)*.03:0)
          if(age>=0&&age<=travel)assert.ok(p.y>=-.04&&p.y<=600.04,`${moveId} in-field path at ${t}: ${p.y}`)
        }
        const walk=n=>{assert.ok(n.alpha>=0&&n.alpha<=1,`${moveId} valid opacity`);for(const child of n.children??[])walk(child)};walk(h.scene.effects)
        for(const a of h.scene.actors.values()){assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)}
      }
      const center=target.anchor('visualCenter'),half=target.metrics.height/2
      for(let i=0;i<count;i++){const p=h.world(h.node(`${moveId}-impact-${i}`));assert.ok(p.y>=center.y-half-.04&&p.y<=center.y+half+.04,moveId+' bounded contact lane')}
      h.tl.time(EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
