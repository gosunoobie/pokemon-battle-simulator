import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const ids=['hidden-power','zap-cannon','weather-ball','mist-ball']
const rule=id=>MOVE_RULES.find(m=>m.id===id)

test('Zap Cannon commits damage and eligible paralysis together without replacing a condition or failing a hit',()=>{
  for(const reverse of [false,true])for(const condition of [null,'burn','poison','bad-poison','paralysis','sleep','freeze'])for(const hp of [200,87,86,20]){
    const sourceId=reverse?'b':'a',targetId=reverse?'a':'b',actors=[{id:sourceId,name:'User',hp:150,maxHp:200,condition:'poison'},{id:targetId,name:'Opponent',hp,maxHp:200,condition,confused:true,specialAttackStage:3}]
    const before=createBattleState(actors),tx=resolveMove(before,{moveId:'zap-cannon',sourceId,targetId}),remaining=Math.max(0,hp-86),paralyzed=!condition&&remaining>0
    assert.equal(tx.event.outcome,'hit');assert.deepEqual(tx.after.actors[sourceId],before.actors[sourceId])
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:remaining,condition:paralyzed?'paralysis':condition})
    assert.match(tx.event.resultMessage,new RegExp(`took ${hp-remaining} damage`));assert.equal(tx.event.resultMessage.includes('is paralyzed'),paralyzed)
    assert.deepEqual(before,createBattleState(actors));assert.ok(Object.isFrozen(tx.after.actors[targetId]))
  }
  for(const moveId of ['hidden-power','weather-ball','mist-ball'])for(const weather of [null,'rain','sun','sandstorm','hail']){
    const base=createBattleState([{id:'a',name:'User',hp:180,maxHp:200,condition:'burn'},{id:'b',name:'Opponent',hp:180,maxHp:200,condition:'poison',specialAttackStage:2}]),before=Object.freeze({...base,weather}),tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:180-rule(moveId).damage});assert.equal(tx.after.weather,weather)
  }
  assert.equal(MOVE_RULES.filter(m=>m.id==='shadow-ball').length,1)
  assert.equal(rule('mist-ball').power,95)
})

test('Zap Cannon reveals HP and paralysis once and reconciles with no FX, skipped FX, errors and reset',async()=>{
  for(const sourceId of ['source','target'])for(const mode of ['off','impact','skip','failure']){
    const targetId=sourceId==='source'?'target':'source',tx=createPreviewTransaction(rule('zap-cannon'),{sourceId,targetId}),views=[]
    let options,imports=0
    const p=createPresenter({getScene:()=>({}),onDisplay:v=>views.push(v),loadFx:()=>{imports++;if(mode==='failure')throw Error('unavailable');return{play(request,opts){assert.equal(request.condition,undefined);assert.equal(request.actors,undefined);options=opts;return{finished:new Promise(()=>{}),cancel(){}}}}}})
    const run=p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
    if(mode==='impact'){assert.equal(views.at(-1).state,tx.before);options.onCue({type:'impact'});options.onCue({type:'impact'});assert.equal(views.at(-1).state,tx.after);assert.equal(views.filter(v=>v.animate).length,1);p.skip()}
    if(mode==='skip')p.skip()
    await run;assert.equal(views.at(-1).state,tx.after);assert.equal(views.at(-1).state.actors[targetId].condition,'paralysis');if(mode==='off')assert.equal(imports,0)
    const fresh=createBattleState();p.reset(fresh);options?.onCue({type:'impact'});assert.equal(views.at(-1).state,fresh);p.destroy()
  }
})

function harness(reverse,edge=0,profile='wide'){
  let timeline
  const scene=createSceneGraph({width:720,height:600,actors:[
    {id:'source',profile,x:reverse?.75:.25,y:edge===1?.33:.82,height:.3,facing:reverse?-1:1,anchors:{origin:[.43,.94],emission:edge===1?[.54,.12]:[.74,.36]}},
    {id:'target',profile:'tall',x:reverse?(edge>=2?.055:.25):(edge>=2?.945:.75),y:edge===3?.3:.62,height:edge===3?.3:.18,facing:reverse?1:-1,anchors:{center:edge===3?[.5,.04]:[.48,.44]}},
  ]})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},node:label=>scene.effects.getChildByLabel(label,true),point:n=>scene.effects.toLocal({x:0,y:0},n),dispose(){fx.dispose();scene.dispose()}}
}
function clean(h){assert.equal(h.scene.effects.children.length,0);for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.tint,0xffffff)}}
const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.04,label)
const labels={'zap-cannon':'zap-cannon-orb','weather-ball':'weather-ball-orb','mist-ball':'mist-ball-orb'}
test('all four orb effects leave live sockets, reach the opponent before the cue and keep mist and wakes moving',async()=>{
  for(const reverse of [false,true])for(const profile of ['tall','wide']){
    const h=harness(reverse,0,profile)
    try{for(const moveId of ids){
      const timing=EFFECT_TIMINGS[moveId],cues=[],run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{
        close(h.point(h.node(moveId==='hidden-power'?'hidden-power-orb-5':labels[moveId])),h.scene.actor('target').anchor('center'),moveId+' contact before cue');cues.push(c.type)
      }})
      await tick()
      const launches=moveId==='hidden-power'?Array.from({length:6},(_,i)=>({at:.48+i*.07,label:`hidden-power-orb-${i}`})):[{at:({'zap-cannon':.74,'weather-ball':.4,'mist-ball':.52})[moveId],label:labels[moveId]}]
      for(const shot of launches){h.tl.time(shot.at,false);close(h.point(h.node(shot.label)),h.scene.actor('source').anchor('emission'),moveId+' launch')}
      if(moveId==='hidden-power')for(let i=0;i<5;i++){h.tl.time(1+i*.07,false);assert.equal(cues.length,0);close(h.point(h.node(`hidden-power-orb-${i}`)),h.scene.actor('target').anchor('center'),'interior volley hit')}
      h.tl.time(timing.contact-.001,false);assert.equal(cues.length,0);h.tl.time(timing.contact,false);assert.deepEqual(cues,['impact'])
      if(moveId==='mist-ball'||moveId==='weather-ball'){
        const label=moveId==='mist-ball'?'mist-ball-wisp-9':'weather-ball-wake-6';h.tl.time(timing.contact+.05,false);const g=h.node(label),before={x:g.x,y:g.y,rotation:g.rotation};assert.ok(g.alpha>0)
        h.tl.time(timing.contact+.16,false);assert.ok(g.alpha>0);assert.notDeepEqual({x:g.x,y:g.y,rotation:g.rotation},before,'wake keeps moving after impact')
      }
      h.tl.time(timing.duration,false);assert.equal((await run.finished).status,'completed');clean(h)
      const again=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.tl.time(timing.contact+.1,false);again.cancel();await again.finished;clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('new orbs, charge fields, moving trails and impact particles fit the upper and side edges in either direction',async()=>{
  for(const reverse of [false,true])for(const edge of [0,1,2,3]){
    const h=harness(reverse,edge,'tall')
    try{for(const moveId of ids){
      const timing=EFFECT_TIMINGS[moveId],run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
      for(let t=.04;t<timing.duration-.02;t+=.035){h.tl.time(t,false)
        for(const a of h.scene.actors.values()){
          const p=a.anchor('visualCenter'),rx=a.metrics.width/2,ry=a.metrics.height/2
          assert.ok(p.x-rx>=-.04&&p.x+rx<=720.04&&p.y-ry>=-.04&&p.y+ry<=600.04,moveId+' full actor bounds')
          assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)
        }
        const walk=(n,parent=1)=>{const alpha=parent*n.alpha;assert.ok(n.alpha>=0&&n.alpha<=1,moveId+' alpha');if(alpha>.03&&['Graphics','Sprite'].includes(n.constructor.name)){const b=n.getBounds();assert.ok(b.x>=-.04&&b.y>=-.04&&b.x+b.width<=720.04&&b.y+b.height<=600.04,`${moveId} ${n.label} edge ${edge} at ${t}: ${JSON.stringify(b)}`)}for(const c of n.children??[])walk(c,alpha)};walk(h.scene.effects)
      }
      h.tl.time(timing.duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
