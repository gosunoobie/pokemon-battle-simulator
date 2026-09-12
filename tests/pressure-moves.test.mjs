import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const cases=[['water-gun',.24,.48,1.45,28],['hydro-pump',.5,.72,2.8,72],['hydro-cannon',.82,1.16,2.5,100],['spit-up',.54,.9,1.8,70],['hyper-beam',.9,1.1,2.6,100],['aeroblast',.54,.83,2.25,70],['luster-purge',.74,1.05,2.15,66]]
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.04,label)
function harness(reverse=false,edge=0,width=720,height=600){
  let timeline
  const scene=createSceneGraph({width,height,actors:[
    {id:'source',profile:edge===1?'tall':'wide',x:reverse?.72:.28,y:edge===1?.32:.82,height:width===560?.2:.3,facing:reverse?-1:1,anchors:{emission:edge===1?[.6,.05]:[.72,.32]}},
    {id:'target',profile:'tall',x:reverse?(edge>=2?.055:.26):(edge>=2?.945:.74),y:edge===3?.3:.62,height:edge===3?.3:.18,facing:reverse?1:-1,anchors:{center:edge===3?[.5,.04]:[.48,.44]}},
  ]})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},node:label=>scene.effects.getChildByLabel(label,true),point:n=>scene.effects.toLocal({x:0,y:0},n),dispose(){fx.dispose();scene.dispose()}}
}
function clean(h){assert.equal(h.scene.effects.children.length,0);assert.equal(h.scene.camera.x,0);assert.equal(h.scene.camera.y,0);for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.tint,0xffffff)}}

test('pressure moves use fixed samples without stockpile, recharge or random secondary rules',()=>{
  for(const [moveId,,contact,duration,damage]of cases){
    assert.deepEqual(EFFECT_TIMINGS[moveId],{contact,duration});assert.equal(MOVE_RULES.filter(m=>m.id===moveId).length,1)
    for(const reverse of [false,true])for(const hp of [1,160]){
      const sourceId=reverse?'b':'a',targetId=reverse?'a':'b',before=createBattleState([{id:sourceId,name:'User',hp:80,maxHp:100,condition:'burn',defenseStage:2,heldItem:'Oran Berry'},{id:targetId,name:'Target',hp,maxHp:160,condition:'poison',specialDefenseStage:-2,confused:true}])
      const tx=resolveMove(before,{moveId,sourceId,targetId});assert.deepEqual(tx.after.actors[sourceId],before.actors[sourceId]);assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:Math.max(0,hp-damage)});assert.equal(before.actors[targetId].hp,hp);assert.equal(tx.event.outcome,'hit');assert.equal(tx.event.healing,undefined);assert.equal(tx.after.stockpile,undefined);assert.equal(tx.after.recharge,undefined)
    }
  }
})

test('all seven fronts launch at live emission, reach the posed target before their single cue and cancel cleanly',async()=>{
  for(const reverse of [false,true]){
    const h=harness(reverse),source=h.scene.actor('source'),target=h.scene.actor('target')
    try{for(const [moveId,start,contact,duration]of cases){
      const cues=[],run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{cues.push(c.type);close(h.point(h.node(moveId+'-tip')),target.anchor('center'),moveId+' contact before cue')}})
      await tick();h.tl.time(start,false);close(h.point(h.node(moveId+'-tip')),source.anchor('emission'),moveId+' release')
      const firing=source.anchor('emission');h.tl.time(contact-.001,false);assert.equal(cues.length,0);h.tl.time(contact,false);assert.deepEqual(cues,['impact']);assert.ok(h.node(moveId+'-tip').alpha>.6,moveId+' visible contact')
      if(['water-gun','hydro-pump','hyper-beam','aeroblast','luster-purge'].includes(moveId)){
        h.tl.time(contact+.06,false);close(h.point(h.node(moveId+'-tip')),target.anchor('center'),moveId+' tracks recoil')
        const label=moveId==='hydro-pump'?'hydro-impact':moveId+'-impact';close(h.point(h.node(label)),target.anchor('center'),moveId+' impact stays on live receiver');close(source.anchor('emission'),firing,moveId+' holds firing pose')
      }
      const p=h.point(h.node(moveId+'-tip'));h.scene.fit(360,480);close(h.point(h.node(moveId+'-tip')),p,'window resize keeps logical contact');h.scene.fit(720,600)
      h.tl.time(duration,false);assert.equal((await run.finished).status,'completed');clean(h)
      for(const t of [start*.5,contact+.09]){const cancelled=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.tl.time(t,false);cancelled.cancel();assert.equal((await cancelled.finished).status,'cancelled');clean(h)}
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('full water and energy artwork stays in portrait, upper-edge and side-edge fields with readable actors',async()=>{
  for(const reverse of [false,true])for(const edge of [0,1,2,3,4]){
    const width=edge===4?560:720,height=edge===4?700:600,h=harness(reverse,edge===4?0:edge,width,height)
    try{for(const [moveId,,,duration]of cases){
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick();let seen=0
      for(let t=.04;t<duration-.02;t+=.035){h.tl.time(t,false)
        for(const a of h.scene.actors.values()){const p=a.anchor('visualCenter'),rx=a.metrics.width/2,ry=a.metrics.height/2;assert.ok(p.x-rx>=-.05&&p.x+rx<=width+.05&&p.y-ry>=-.05&&p.y+ry<=height+.05,moveId+' actor bounds');assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)}
        const walk=(n,parent=1)=>{const alpha=parent*n.alpha;assert.ok(n.alpha>=0&&n.alpha<=1,moveId+' alpha');if(alpha>.03&&['Graphics','Sprite'].includes(n.constructor.name)){seen++;const b=n.getBounds();assert.ok(b.x>=-.05&&b.y>=-.05&&b.x+b.width<=width+.05&&b.y+b.height<=height+.05,`${moveId} ${n.label} edge ${edge} reverse ${reverse} time ${t}: ${JSON.stringify(b)}`)}for(const c of n.children??[])walk(c,alpha)};walk(h.scene.effects)
      }
      assert.ok(seen>0);h.tl.time(duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('Hydro Pump sustains fresh moving spray and ends its stream before the source relaxes',async()=>{
  for(const reverse of [false,true]){
    const h=harness(reverse)
    try{
      const run=h.fx.play({moveId:'hydro-pump',sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
      h.tl.time(.8,false);const source=h.scene.actor('source'),firing=source.anchor('emission'),drop=h.node('hydro-pump-spray-0'),p=h.point(drop)
      h.tl.time(.92,false);assert.ok(Math.hypot(h.point(drop).x-p.x,h.point(drop).y-p.y)>1,'early spray travels')
      h.tl.time(1.65,false);close(source.anchor('emission'),firing,'holds nozzle through sustain');assert.ok(h.node('hydro-pump-spray-42').alpha>0,'fresh late spray');assert.ok(h.node('hydro-jet').alpha>.9)
      const crown=h.node('hydro-impact'),bounds=crown.getBounds();assert.ok(bounds.width<140&&bounds.height<140,'contained crown')
      h.tl.time(1.85,false);assert.ok(h.node('hydro-pump-spray-49').alpha>0,'last spray keeps flowing during cutoff')
      h.tl.time(2,false);assert.equal(h.node('hydro-jet').alpha,0);close(source.anchor('emission'),firing,'holds until remaining water clears')
      h.tl.time(2.8,false);await run.finished;clean(h)
    }finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
