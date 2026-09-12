import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const cases=[['psybeam',.42,.68,2.3,46,'psybeam-pulse-'],['signal-beam',.36,.61,2.15,52,'signal-beam-packet-']]
function harness(reversed,profile,high=false,edge=false){
  let timeline
  const scene=createSceneGraph({width:720,height:600,actors:[
    {id:'source',profile,x:reversed?.74:.26,y:.82,height:.3,facing:reversed?-1:1,anchors:{origin:[.43,.94],emission:[.82,.39]}},
    {id:'target',profile:'tall',x:reversed?(edge?.06:.26):(edge?.94:.74),y:high?.3:.62,height:high?.3:.18,facing:reversed?1:-1,anchors:{center:high?[.5,.1]:[.47,.44]}},
  ]})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},node(label){return scene.effects.getChildByLabel(label,true)},world(n){return scene.effects.toLocal({x:0,y:0},n)},dispose(){fx.dispose();scene.dispose()}}
}
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.04,label)
function clean(h){assert.equal(h.scene.effects.children.length,0);for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.tint,0xffffff)}}

test('beam additions preserve one fixed result without random confusion and retain one Aurora Beam',()=>{
  assert.equal(MOVE_RULES.filter(m=>m.id==='aurora-beam').length,1)
  for(const [moveId,,contact,duration,damage]of cases){
    assert.deepEqual(EFFECT_TIMINGS[moveId],{contact,duration})
    for(const sourceId of ['a','b'])for(const hp of [1,160]){
      const targetId=sourceId==='a'?'b':'a',state=createBattleState([{id:sourceId,name:'User',hp:80,maxHp:160,condition:'burn'},{id:targetId,name:'Target',hp,maxHp:160,condition:'poison',confused:true}])
      const tx=resolveMove(state,{moveId,sourceId,targetId})
      assert.deepEqual(tx.after.actors[sourceId],state.actors[sourceId])
      assert.deepEqual(tx.after.actors[targetId],{...state.actors[targetId],hp:Math.max(0,hp-damage)})
      const clear=createBattleState([{id:sourceId,name:'User',hp:80,maxHp:160},{id:targetId,name:'Target',hp:160,maxHp:160}])
      assert.equal(resolveMove(clear,{moveId,sourceId,targetId}).after.actors[targetId].confused,false)
    }
  }
})

test('beam fronts reach supplied sockets before cues, hold their firing poses and keep pulses flowing',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness(reversed,profile),source=h.scene.actor('source'),target=h.scene.actor('target')
    try{for(const [moveId,start,contact,duration,,prefix]of cases){
      const cues=[],run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{cues.push(c.type);close(h.world(h.node(moveId+'-tip')),target.anchor('center'),moveId+' front at target before cue')}})
      await tick();h.tl.time(start,false);const firing=source.anchor('emission')
      close(h.world(h.node(moveId+'-tip')),firing,'launch at emission')
      h.tl.time(contact-.005,false);assert.equal(cues.length,0)
      h.tl.time(contact,false);assert.deepEqual(cues,['impact']);assert.ok(h.node(moveId+'-tip').alpha>.7)
      h.tl.time(.9,false);const first=Array.from({length:moveId==='psybeam'?10:16},(_,i)=>h.world(h.node(prefix+i)))
      h.tl.time(1.04,false);assert.ok(first.some((p,i)=>Math.hypot(h.world(h.node(prefix+i)).x-p.x,h.world(h.node(prefix+i)).y-p.y)>1),'pulses travel during sustained beam')
      h.tl.time(1.59,false);close(source.anchor('emission'),firing,'source holds through final emission');close(h.world(h.node(moveId+'-tip')),target.anchor('center'),'beam follows live target')
      const p=h.world(h.node(moveId+'-tip'));h.scene.fit(360,480);close(h.world(h.node(moveId+'-tip')),p,'viewport fit preserves scene placement')
      h.tl.time(duration,false);assert.equal((await run.finished).status,'completed');clean(h)
      const replay=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.tl.time(contact+.2,false);replay.cancel();await replay.finished;clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('all beam contours and impact particles stay inside upper and side edge layouts',async()=>{
  for(const reversed of [false,true])for(const high of [false,true]){
    const h=harness(reversed,'tall',high,!high)
    try{for(const [moveId,,,duration]of cases){
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
      let seen=0
      for(let t=.06;t<duration-.02;t+=.035){
        h.tl.time(t,false)
        const walk=(n,parentAlpha=1)=>{
          const alpha=parentAlpha*n.alpha;assert.ok(n.alpha>=0&&n.alpha<=1)
          if(alpha>.03&&['Graphics','Sprite'].includes(n.constructor.name)){
            const b=n.getBounds();seen++
            assert.ok(b.x>=-.04&&b.y>=-.04&&b.x+b.width<=720.04&&b.y+b.height<=600.04,`${moveId} ${n.label} at ${t}: ${JSON.stringify(b)}`)
          }
          for(const child of n.children??[])walk(child,alpha)
        };walk(h.scene.effects)
      }
      assert.ok(seen>0);h.tl.time(duration,false);await run.finished;clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
