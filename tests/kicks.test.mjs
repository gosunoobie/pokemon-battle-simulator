import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const kicks=[
  ['mega-kick',26,43,.17,[.82],84],['low-kick',21,35,.14,[.56],42],
  ['rolling-kick',22,36,.145,[.86],44],['double-kick',21,34,.135,[.52,.94],44],
  ['triple-kick',18,29,.115,[.5,.84,1.2],60],['jump-kick',24,39,.155,[.84],70],
  ['high-jump-kick',25,41,.16,[1.08],90],
]
function harness(reversed,profile,custom=false,edge=false){
  let timeline
  const near=reversed?.71:.29,far=edge?(reversed?(120*150/70/2+1)/720:1-(120*150/70/2+1)/720):(reversed?.26:.74)
  const scene=createSceneGraph({width:720,height:600,actors:[
    {id:'source',profile,x:near,y:.82,height:profile==='wide'?.24:.32,facing:reversed?-1:1,...(custom?{anchors:{origin:[.43,.94],foot:[.87,.9]}}:{})},
    {id:'target',profile:'wide',x:far,y:.65,height:.2,facing:reversed?1:-1,...(custom?{anchors:{origin:[.52,.98],center:[.46,.43],floor:[.51,.98]}}:{})},
  ]})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},dispose(){fx.dispose();scene.dispose()}}
}
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.035,`${label}: ${a.x},${a.y} vs ${b.x},${b.y}`)
function clean(h){
  assert.equal(h.scene.effects.children.length,0)
  for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)}
}

test('new kicks commit only fixed total damage from either side, with no weight, hit-roll, flinch or crash engine',()=>{
  assert.equal(MOVE_RULES.filter(m=>m.id==='blaze-kick').length,1)
  assert.deepEqual(EFFECT_TIMINGS['blaze-kick'],{contact:.6,duration:1.8})
  for(const [moveId,,,,,damage]of kicks)for(const sourceId of ['a','b'])for(const hp of [1,160]){
    const targetId=sourceId==='a'?'b':'a'
    const state=createBattleState([{id:sourceId,name:'User',hp:70,maxHp:160,condition:'burn',attackStage:2},{id:targetId,name:'Recipient',hp,maxHp:160,condition:'poison',defenseStage:1,confused:true}])
    const before=resolveMove(state,{moveId:'rain-dance',sourceId}).after,tx=resolveMove(before,{moveId,sourceId,targetId})
    assert.deepEqual(tx.after.actors[sourceId],before.actors[sourceId]);assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:Math.max(0,hp-damage)})
    assert.equal(tx.after.weather,'rain');assert.equal(tx.event.outcome,'hit');assert.equal(tx.event.recoil,undefined);assert.equal(tx.event.healing,undefined)
    assert.deepEqual(tx.event.targetIds,[targetId]);assert.equal(tx.after.revision,before.revision+1)
  }
})

test('all kick contacts keep visible toes at impact and feet on supplied sockets across facing, shape and metadata',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall'])for(const custom of [false,true]){
    const h=harness(reversed,profile,custom),source=h.scene.actor('source'),target=h.scene.actor('target')
    if(!custom)delete source.hasAnchor
    try{for(const [moveId,min,max,factor,times]of kicks){
      const unit=Math.min(h.scene.unit*1.25,Math.max(h.scene.unit*.6,target.metrics.height/168.90625)),r=Math.min(max,Math.max(min,source.metrics.height/unit*factor)),cues=[]
      const foot=()=>h.scene.effects.getChildByLabel(moveId+'-foot',true)
      const point=i=>h.scene.effects.getChildByLabel(moveId+'-impact'+(times.length>1?'-'+i:''),true)
      const world=(node,x=0)=>h.scene.effects.toLocal({x,y:0},node)
      let atCue
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{cues.push(c.type);atCue={toe:world(foot(),r),impact:world(point(times.length-1))}}})
      await tick()
      for(let i=0;i<times.length;i++){
        h.tl.time(times[i]-.005,false);assert.equal(cues.length,0,moveId+' result waits for final contact')
        h.tl.time(times[i],false)
        close(world(foot()),source.anchor('foot'),moveId+' live foot attachment')
        close(world(foot(),r),world(point(i)),moveId+' visible toe at contact '+i)
        const toe=world(foot(),r),center=target.anchor('visualCenter')
        assert.ok(Math.abs(toe.x-center.x)<=target.metrics.width/2+.04&&Math.abs(toe.y-center.y)<=target.metrics.height/2+.04,moveId+' contact intersects recipient')
        assert.ok(foot().alpha>.8);assert.equal(source.pose.alpha,1);assert.equal(target.pose.alpha,1)
        if(i<times.length-1){const contact=world(foot(),r);h.tl.time(times[i]+.16,false);assert.ok(Math.hypot(world(foot(),r).x-contact.x,world(foot(),r).y-contact.y)>5*unit,moveId+' retracts between kicks')}
      }
      assert.deepEqual(cues,['impact']);close(atCue.toe,atCue.impact,moveId+' contact updated before cue')
      const before=world(foot(),r);h.scene.fit(320,480);close(world(foot(),r),before,'logical contact survives viewport fit')
      h.tl.time(EFFECT_TIMINGS[moveId].duration-.02,false)
      assert.ok(Math.hypot(source.pose.x,source.pose.y)<.001);assert.equal(source.pose.rotation,0)
      h.tl.time(EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('new kicks preserve full sprite size and keep moving silhouettes inside custom edge layouts',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness(reversed,profile,true,true)
    try{for(const [moveId]of kicks){
      const timing=EFFECT_TIMINGS[moveId],run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick()
      for(let t=.02;t<timing.duration;t+=.025){
        h.tl.time(t,false)
        for(const a of h.scene.actors.values()){
          const center=a.anchor('visualCenter'),c=Math.abs(Math.cos(a.pose.rotation)),s=Math.abs(Math.sin(a.pose.rotation))
          const rx=(a.metrics.width*c+a.metrics.height*s)/2,ry=(a.metrics.height*c+a.metrics.width*s)/2
          assert.ok(center.x-rx>=-.04&&center.x+rx<=720.04&&center.y-ry>=-.04&&center.y+ry<=600.04,`${moveId} ${a.id} stays inside field at ${t}`)
          assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)
        }
      }
      h.tl.time(timing.duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('jumping kicks descend from an apex above contact from both default field positions',async()=>{
  for(const sourceId of ['source','target'])for(const [moveId,apex,contact]of [['jump-kick',.51,.84],['high-jump-kick',.78,1.08]]){
    let timeline
    const scene=createSceneGraph(),source=scene.actor(sourceId)
    const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
    try{
      const run=fx.play({moveId,sourceId,targetIds:[sourceId==='source'?'target':'source']},{scene});await tick()
      timeline.time(apex,false);const peak=source.anchor('visualCenter').y
      timeline.time(contact,false);const landing=source.anchor('visualCenter').y
      assert.ok(landing-peak>10*scene.unit,`${moveId} ${sourceId} visibly descends: ${peak} to ${landing}`)
      timeline.time(EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed')
    }finally{fx.dispose();scene.dispose()}
  }
  gsap.ticker.sleep()
})
