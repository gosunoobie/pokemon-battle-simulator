import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick=()=>new Promise(resolve=>setImmediate(resolve))
const moves=[['vice-grip',.80,1.95,'claw','hand'],['clamp',.90,2.10,'mouth','emission'],['super-fang',.72,1.85,'mouth','emission'],['crabhammer',1.02,2.35,'claw','hand'],['lick',.66,1.85,'tongue','emission'],['bone-club',.78,1.95,'bone','hand'],['bone-rush',1.16,2.25,'bone','hand'],['bonemerang',1.35,2.25,'bone','hand'],['fury-swipes',.92,1.90,'claw','hand']]
function harness(reverse=false,edge=0,custom=false){
 let timeline
 const width=edge===4?560:720,height=edge===4?700:600
 const scene=createSceneGraph({width,height,actors:[
  {id:'source',profile:edge===1?'tall':'wide',x:reverse?.72:.28,y:edge===1?.32:.82,height:edge===4?.2:.3,facing:reverse?-1:1,
   anchors:{emission:edge===1?[.6,.05]:[.72,.32],...(custom?{claw:[.36,.37],mouth:[.61,.24],tongue:[.64,.29],bone:[.33,.41],hand:[.41,.43]}:{})}},
  {id:'target',profile:'tall',x:reverse?(edge===2?.055:.26):(edge===2?.945:.74),y:edge===3?.3:.62,height:edge===3?.3:.18,facing:reverse?1:-1,anchors:{center:edge===3?[.5,.04]:[.48,.44]}},
 ]})
 const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
 return{scene,fx,get tl(){return timeline},node:label=>scene.effects.getChildByLabel(label,true),point:n=>scene.effects.toLocal({x:0,y:0},n),dispose(){fx.dispose();scene.dispose()}}
}
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.05,label)
function clean(h){
 assert.equal(h.scene.effects.children.length,0)
 assert.equal(h.scene.camera.x,0);assert.equal(h.scene.camera.y,0)
 for(const a of h.scene.actors.values()){
  for(const key of ['x','y','rotation'])assert.equal(a.pose[key],0)
  assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.alpha,1);assert.equal(a.pose.tint,0xffffff)
 }
}
function bounds(h,label){
 const{width,height}=h.scene
 for(const a of h.scene.actors.values()){
  const p=a.anchor('visualCenter'),c=Math.abs(Math.cos(a.pose.rotation)),s=Math.abs(Math.sin(a.pose.rotation)),rx=(a.metrics.width*c+a.metrics.height*s)/2,ry=(a.metrics.height*c+a.metrics.width*s)/2
  assert.ok(p.x-rx>=-.05&&p.y-ry>=-.05&&p.x+rx<=width+.05&&p.y+ry<=height+.05,label+' full actor')
  assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.alpha,1)
 }
 let seen=0
 function walk(n,alpha=1){const visible=alpha*n.alpha;assert.ok(n.alpha>=0&&n.alpha<=1,label+' alpha '+n.label)
  if(visible>.03&&n.constructor.name==='Graphics'){const b=n.getBounds();seen++;assert.ok(b.x>=-.05&&b.y>=-.05&&b.x+b.width<=width+.05&&b.y+b.height<=height+.05,`${label} ${n.label}: ${JSON.stringify(b)}`)}
  for(const child of n.children??[])walk(child,visible)
 }walk(h.scene.effects);return seen
}

test('nine new physical moves attach their visible artwork and contact once before cleanup',async()=>{
 for(const reverse of[false,true])for(const custom of[false,true]){
  const h=harness(reverse,0,custom)
  try{for(const[id,contact,duration,explicit,fallback]of moves){
   assert.deepEqual(EFFECT_TIMINGS[id],{contact,duration});const cues=[],source=h.scene.actor('source'),target=h.scene.actor('target'),anchor=custom?explicit:fallback
   const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:cue=>{
    close(h.point(h.node(id+'-root')),source.anchor(anchor),id+' live root at cue')
    close(h.point(h.node(id+'-tip')),target.anchor('center'),id+' visible leading contact')
    close(h.point(h.node(id+'-impact')),target.anchor('center'),id+' impact position')
    assert.ok(h.node(id+'-root').alpha>.05,id+' visible root');cues.push(cue.type)
   }})
   await tick();for(const t of[contact*.56,contact-.001]){h.tl.time(t,false);close(h.point(h.node(id+'-root')),source.anchor(anchor),id+' root during approach')}
   assert.deepEqual(cues,[]);h.tl.time(contact,false);assert.deepEqual(cues,['impact']);h.tl.time(duration,false);assert.equal((await run.finished).status,'completed');clean(h)
  }}finally{h.dispose()}
 }gsap.ticker.sleep()
})

test('nine physical moves keep complete rotated actors and artwork inside edge and portrait layouts',async()=>{
 for(const reverse of[false,true])for(const edge of[0,1,2,3,4])for(const custom of[false,true]){
  const h=harness(reverse,edge,custom)
  try{for(const[id,contact,duration,explicit,fallback]of moves){
   const source=h.scene.actor('source'),target=h.scene.actor('target'),anchor=custom?explicit:fallback,cues=[]
   const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{
    close(h.point(h.node(id+'-tip')),target.anchor('center'),id+' edge contact');close(h.point(h.node(id+'-root')),source.anchor(anchor),id+' edge root');cues.push(c.type)
   }})
   await tick();let seen=0
   for(let t=.04;t<duration-.02;t+=.035){h.tl.time(t,false);seen+=bounds(h,`${id} reverse${reverse} edge${edge} custom${custom} t${t}`)}
   assert.ok(seen>0);assert.deepEqual(cues,['impact']);h.tl.time(duration,false);assert.equal((await run.finished).status,'completed');clean(h)
  }}finally{h.dispose()}
 }gsap.ticker.sleep()
})

test('every physical aftermath continues moving and falling during its fade from either side',async()=>{
 const flows=[['vice-grip','vice-grip-chip-0',1.30,1.58],['clamp','clamp-pearl-0',1.42,1.72],['super-fang','super-fang-glint-0',1.22,1.49],['crabhammer','crabhammer-drop-0',1.64,1.94],['lick','lick-bead-0',1.20,1.49],['bone-club','bone-club-grit-0',1.30,1.56],['bone-rush','bone-rush-grain-0',1.67,1.92],['bonemerang','bonemerang-grain-0',1.78,2.02],['fury-swipes','fury-swipes-fleck-0',1.34,1.60]]
 for(const reverse of[false,true]){
  const h=harness(reverse)
  try{for(const[id,label,t1,t2]of flows){
   const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
   h.tl.time(t1,false);const g=h.node(label),a=h.point(g);assert.ok(g.alpha>.025,id+' late visible')
   h.tl.time(t2,false);const b=h.point(g);assert.ok(g.alpha>.025,id+' fading visible');assert.ok(b.y>a.y+.25,id+' world-down motion');assert.ok(Math.hypot(b.x-a.x,b.y-a.y)>.5,id+' late flow')
   h.tl.time(EFFECT_TIMINGS[id].duration,false);assert.equal((await run.finished).status,'completed');clean(h)
  }}finally{h.dispose()}
 }gsap.ticker.sleep()
})

test('nine physical moves clean up when cancelled before/after contact and in reduced motion',async()=>{
 for(const reverse of[false,true]){
  const h=harness(reverse)
  try{for(const[id,contact]of moves){
   for(const time of[contact*.5,contact+.12]){const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.tl.time(time,false);run.cancel();assert.equal((await run.finished).status,'cancelled');clean(h)}
   const cues=[],run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target']},{scene:h.scene,reducedMotion:true,onCue:c=>cues.push(c.type)});await tick();h.tl.time(.8,false);assert.equal((await run.finished).status,'completed');assert.deepEqual(cues,['impact']);clean(h)
  }}finally{h.dispose()}
 }gsap.ticker.sleep()
})


test('Bone Rush and Fury Swipes make three exact cosmetic contacts before their sole result cue',async()=>{
 for(const reverse of[false,true])for(const[id,times]of[['bone-rush',[.54,.85,1.16]],['fury-swipes',[.42,.67,.92]]]){
  const h=harness(reverse,0,true),cues=[]
  try{
   const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>cues.push(c.type)})
   await tick()
   for(const[i,time]of times.entries()){
    h.tl.time(time,false);close(h.point(h.node(id+'-tip')),h.scene.actor('target').anchor('center'),id+' hit '+i)
    close(h.point(h.node(id+'-contact-'+i)),h.scene.actor('target').anchor('center'),id+' local impact '+i)
    assert.ok(h.node(id+'-contact-'+i).alpha>.05);assert.equal(cues.length,i===2?1:0);bounds(h,id+' hit '+i)
   }
   h.tl.time(EFFECT_TIMINGS[id].duration,false);assert.equal((await run.finished).status,'completed');clean(h)
  }finally{h.dispose()}
 }gsap.ticker.sleep()
})

test('Bonemerang launches from the live hand, contacts outward and returning, then catches at the source',async()=>{
 for(const reverse of[false,true]){
  const h=harness(reverse,0,true),cues=[]
  try{
   const run=h.fx.play({moveId:'bonemerang',sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>cues.push(c.type)})
   await tick();h.tl.time(.28,false);close(h.point(h.node('bonemerang-tip')),h.scene.actor('source').anchor('bone'),'actual release')
   h.tl.time(.70,false);close(h.point(h.node('bonemerang-tip')),h.scene.actor('target').anchor('center'),'outward leading point');assert.equal(cues.length,0)
   close(h.point(h.node('bonemerang-contact-0')),h.scene.actor('target').anchor('center'),'outward contact marker')
   h.tl.time(1.35,false);close(h.point(h.node('bonemerang-tip')),h.scene.actor('target').anchor('center'),'return leading point');assert.deepEqual(cues,['impact'])
   h.tl.time(1.93,false);close(h.point(h.node('bonemerang-tip')),h.scene.actor('source').anchor('bone'),'source catch');bounds(h,'Bonemerang caught')
   h.tl.time(2.25,false);assert.equal((await run.finished).status,'completed');clean(h)
  }finally{h.dispose()}
 }gsap.ticker.sleep()
})

test('all nine physical effects reflect horizontally with world-down aftermath',async()=>{
 for(const[id,contact,duration]of moves){
  const normal=harness(false,0,true),mirror=harness(true,0,true)
  try{
   const runs=[normal,mirror].map(h=>h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene}))
   await tick()
   for(const t of[contact*.58,contact,Math.min(duration-.2,contact+.6)]){
    normal.tl.time(t,false);mirror.tl.time(t,false)
    for(const label of[id+'-root',id+'-tip',id+'-impact']){
     const a=normal.point(normal.node(label)),b=mirror.point(mirror.node(label));assert.ok(Math.abs(a.x+b.x-normal.scene.width)<.05,id+' reflected x '+label);assert.ok(Math.abs(a.y-b.y)<.05,id+' reflected y '+label)
    }
   }
   normal.tl.time(duration,false);mirror.tl.time(duration,false);await Promise.all(runs.map(r=>r.finished));clean(normal);clean(mirror)
  }finally{normal.dispose();mirror.dispose()}
 }gsap.ticker.sleep()
})

test('physical contacts follow a posed live target and need no optional snapshots or anchor discovery',async()=>{
 for(const reverse of[false,true]){
  const h=harness(reverse)
  try{for(const[id,contact,duration,,fallback]of moves){
   const source=h.scene.actor('source'),target=h.scene.actor('target'),saved=source.hasAnchor,savedCapture=source.captureSnapshot
   source.hasAnchor=undefined;source.captureSnapshot=undefined
   const cues=[],run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{
    close(h.point(h.node(id+'-root')),source.anchor(fallback),id+' fallback root')
    close(h.point(h.node(id+'-tip')),target.anchor('center'),id+' moved target tip')
    close(h.point(h.node(id+'-impact')),target.anchor('center'),id+' moved target impact');cues.push(c.type)
   }})
   await tick();h.tl.time(contact*.6,false);target.pose.x=reverse?-9:9;target.pose.y=-6;target.pose.rotation=.04
   h.tl.time(contact,false);assert.deepEqual(cues,['impact']);bounds(h,id+' live posed target')
   h.tl.time(duration,false);assert.equal((await run.finished).status,'completed');clean(h);source.hasAnchor=saved;source.captureSnapshot=savedCapture
  }}finally{h.dispose()}
 }gsap.ticker.sleep()
})
