import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const moves=[['dragon-breath',42],['sacred-fire',72,'sacred-fire-comet',.4,0,1,.54],['overheat',92]]
function harness(reversed=false,profile='tall',edge=false,high=false){
  let timeline
  const scene=createSceneGraph({width:720,height:600,actors:[
    {id:'source',profile,x:reversed?.74:.26,y:.82,height:.3,facing:reversed?-1:1,anchors:{origin:[.43,.94],emission:[.82,.39],aura:[.5,.47]}},
    {id:'target',profile:'tall',x:reversed?(edge?.06:.26):(edge?.94:.74),y:high?.3:.62,height:high?.3:.18,facing:reversed?1:-1,anchors:{center:high?[.5,.1]:[.47,.44]}},
  ]})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},node(label){return scene.effects.getChildByLabel(label,true)},world(node){return scene.effects.toLocal({x:0,y:0},node)},dispose(){fx.dispose();scene.dispose()}}
}
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.035,`${label}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`)
function clean(h){assert.equal(h.scene.effects.children.length,0);for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.tint,0xffffff)}}

test('new breath and sacred flame use fixed damage; Overheat keeps its existing timing and result',()=>{
  assert.deepEqual(EFFECT_TIMINGS.overheat,{contact:.98,duration:2.5})
  assert.deepEqual(EFFECT_TIMINGS['sacred-fire'],{contact:.94,duration:2.2})
  assert.deepEqual(MOVE_RULES.find(m=>m.id==='overheat'),{id:'overheat',name:'Overheat',type:'Fire',power:130,accuracy:90,damage:92,effective:true})
  for(const [moveId,damage]of moves)for(const sourceId of ['a','b'])for(const hp of [1,160]){
    const targetId=sourceId==='a'?'b':'a',state=createBattleState([{id:sourceId,name:'User',hp:70,maxHp:160,condition:'burn',specialAttackStage:2},{id:targetId,name:'Target',hp,maxHp:160,condition:'poison',confused:true}])
    const tx=resolveMove(state,{moveId,sourceId,targetId})
    assert.deepEqual(tx.after.actors[sourceId],state.actors[sourceId]);assert.deepEqual(tx.after.actors[targetId],{...state.actors[targetId],hp:Math.max(0,hp-damage)})
    assert.equal(tx.event.healing,undefined);assert.equal(tx.event.recoil,undefined)
  }
})

test('Sacred Fire launches at the live socket and reaches the target before its one impact cue',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness(reversed,profile),source=h.scene.actor('source'),target=h.scene.actor('target')
    try{for(const [moveId,,label,start,interval,count,flight]of moves.filter(m=>m[0]==='sacred-fire')){
      const cues=[],events=[],launches=[],shot=i=>h.node(label+(count===1?'':i))
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{cues.push(c.type);close(h.world(shot(0)),target.anchor('center'),moveId+' contact before cue')}})
      await tick()
      for(let i=0;i<count;i++){events.push({t:start+i*interval,i,launch:true});events.push({t:start+i*interval+flight,i,launch:false})}
      events.sort((a,b)=>a.t-b.t)
      for(const event of events){
        h.tl.time(event.t,false)
        if(event.launch){const p=h.world(shot(event.i));close(p,source.anchor('emission'),moveId+' launch '+event.i);launches.push(p)}
        else{assert.ok(shot(event.i).alpha>.8);assert.ok(cues.length===1);}
      }
      for(const p of launches)close(p,launches[0],moveId+' source holds through last launch')
      assert.deepEqual(cues,['impact']);assert.equal(source.pose.alpha,1);assert.equal(target.pose.alpha,1)
      const p=h.world(shot(0));h.scene.fit(340,480);close(h.world(shot(0)),p,'camera fit preserves logical placement')
      h.tl.time(EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('Sacred Fire glow, trails, plumes, rings and sparks fit the field and keep moving after impact',async()=>{
  for(const reversed of [false,true])for(const high of [false,true]){
    const h=harness(reversed,'tall',!high,high)
    try{for(const [moveId]of moves.filter(m=>m[0]==='sacred-fire')){
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
      let seen=0,firstPlumes
      for(let t=.05;t<2.19;t+=.035){
        h.tl.time(t,false)
        const walk=(n,inheritedAlpha=1)=>{
          const alpha=inheritedAlpha*n.alpha
          if(alpha>.03&&['Graphics','Sprite'].includes(n.constructor.name)){
            const b=n.getBounds();seen++
            assert.ok(b.x>=-.04&&b.y>=-.04&&b.x+b.width<=720.04&&b.y+b.height<=600.04,`${n.label} fits field at ${t} (reversed=${reversed}, high=${high}): ${JSON.stringify(b)}`)
          }
          for(const child of n.children??[])walk(child,alpha)
        };walk(h.scene.effects)
        const crown=h.node('sacred-fire-crown')
        if(t>1.08&&t<1.12)firstPlumes=crown.children.filter(n=>n.label?.startsWith('sacred-fire-plume-')).map(n=>[n.x,n.y,n.rotation])
        if(t>1.29&&t<1.33){
          const plumes=crown.children.filter(n=>n.label?.startsWith('sacred-fire-plume-'))
          assert.ok(plumes.some((n,i)=>Math.hypot(n.x-firstPlumes[i][0],n.y-firstPlumes[i][1])>.1),'flames keep moving during dissipation')
          for(const a of h.scene.actors.values()){assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)}
        }
      }
      assert.ok(seen>0);run.cancel();await run.finished;clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('Dragon Breath matches Flamethrower geometry, particles, poses and cue timing with only a palette change',async()=>{
  assert.deepEqual(EFFECT_TIMINGS['dragon-breath'],EFFECT_TIMINGS.flamethrower)
  const colors=new Map([[0xff6c1d,0xa252f0],[0xffedaa,0xead1ff],[0xffad25,0xbd7aff],[0xff4610,0x7d3de0],[0xff842e,0xc8b0ec]])
  const round=n=>Math.round(n*1e5)/1e5
  function snapshot(h,recolor=false){
    const effects=[]
    const walk=n=>{
      if(n!==h.scene.effects){
        const b=n.getBounds()
        effects.push({kind:n.constructor.name,bounds:[b.x,b.y,b.width,b.height].map(round),alpha:round(n.alpha),rotation:round(n.rotation),scale:[n.scale.x,n.scale.y].map(round),blend:n.blendMode,tint:recolor?(colors.get(n.tint)??n.tint):n.tint})
      }
      for(const child of n.children??[])walk(child)
    };walk(h.scene.effects)
    const actors=[...h.scene.actors.values()].map(a=>({x:round(a.pose.x),y:round(a.pose.y),rotation:round(a.pose.rotation),alpha:a.pose.alpha,scale:[a.pose.scale.x,a.pose.scale.y],tint:recolor?(colors.get(a.pose.tint)??a.pose.tint):a.pose.tint}))
    return{effects,actors}
  }
  for(const reversed of [false,true])for(const profile of ['tall','wide']){
    const fire=harness(reversed,profile),dragon=harness(reversed,profile),fireCues=[],dragonCues=[]
    try{
      const a=fire.fx.play({moveId:'flamethrower',sourceId:'source',targetIds:['target'],visualSeed:42},{scene:fire.scene,onCue:c=>fireCues.push([c.type,fire.tl.time()])})
      const b=dragon.fx.play({moveId:'dragon-breath',sourceId:'source',targetIds:['target'],visualSeed:42},{scene:dragon.scene,onCue:c=>dragonCues.push([c.type,dragon.tl.time()])})
      await tick()
      let sawViolet=false
      for(let frame=1;frame<=317;frame++){
        const t=frame/120;fire.tl.time(t,false);dragon.tl.time(t,false)
        if(frame%12===0||frame===317){
          const expected=snapshot(fire,true),actual=snapshot(dragon)
          assert.deepEqual(actual,expected,'color-only parity at '+t)
          sawViolet ||= actual.effects.some(n=>n.alpha>.1&&[0xa252f0,0xead1ff,0xbd7aff,0x7d3de0].includes(n.tint))
        }
      }
      assert.ok(sawViolet);assert.deepEqual(dragonCues,fireCues);assert.equal(dragonCues.length,1)
      fire.tl.time(2.65,false);dragon.tl.time(2.65,false)
      assert.equal((await a.finished).status,'completed');assert.equal((await b.finished).status,'completed');clean(fire);clean(dragon)
    }finally{fire.dispose();dragon.dispose()}
  }
  gsap.ticker.sleep()
})
