import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createPreviewState, createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const ids=['double-slap','comet-punch','arm-thrust','fury-attack','steel-wing','iron-tail','poison-tail','headbutt','frustration','facade','smelling-salts']
const rule=id=>MOVE_RULES.find(m=>m.id===id)

test('Facade doubles only for the user’s burn, poison or paralysis and retains all conditions',()=>{
  for(const reverse of [false,true])for(const condition of [null,'burn','poison','bad-poison','paralysis','sleep','freeze'])for(const hp of [200,40]){
    const sourceId=reverse?'b':'a',targetId=reverse?'a':'b',actors=[{id:sourceId,name:'User',hp:120,maxHp:200,condition,confused:true,attackStage:3},{id:targetId,name:'Opponent',hp,maxHp:200,condition:'paralysis',reflect:true}]
    const before=createBattleState(actors),tx=resolveMove(before,{moveId:'facade',sourceId,targetId}),boost=['burn','poison','bad-poison','paralysis'].includes(condition)
    assert.equal(tx.event.outcome,'hit');assert.deepEqual(tx.after.actors[sourceId],before.actors[sourceId])
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:Math.max(0,hp-(boost?96:48))})
    assert.equal(tx.event.healing,undefined);assert.deepEqual(before,createBattleState(actors));assert.ok(Object.isFrozen(tx.after.actors[targetId]))
  }
})

test('Smelling Salts boosts against paralysis and cures only a survivor after damage',()=>{
  for(const reverse of [false,true])for(const condition of [null,'burn','poison','bad-poison','paralysis','sleep','freeze'])for(const hp of [200,85,84,20]){
    const sourceId=reverse?'b':'a',targetId=reverse?'a':'b',actors=[{id:sourceId,name:'User',hp:120,maxHp:200,condition:'burn'},{id:targetId,name:'Opponent',hp,maxHp:200,condition,confused:true,protected:true,speedStage:-2}]
    const before=createBattleState(actors),tx=resolveMove(before,{moveId:'smelling-salts',sourceId,targetId}),remaining=Math.max(0,hp-(condition==='paralysis'?84:42)),cured=condition==='paralysis'&&remaining>0
    assert.equal(tx.event.outcome,'hit');assert.deepEqual(tx.after.actors[sourceId],before.actors[sourceId])
    assert.deepEqual(tx.after.actors[targetId],{...before.actors[targetId],hp:remaining,condition:cured?null:condition})
    assert.equal(tx.event.resultMessage.includes('cured of paralysis'),cured);assert.equal(tx.event.healing,undefined)
    assert.deepEqual(before,createBattleState(actors));assert.ok(Object.isFrozen(tx.after.actors[targetId]))
  }
  for(const moveId of ids.slice(0,9)){
    const before=createBattleState([{id:'a',name:'User',hp:150,maxHp:200,condition:'burn',defenseStage:2},{id:'b',name:'Opponent',hp:180,maxHp:200,condition:'poison',confused:true,defenseStage:3}]),tx=resolveMove(before,{moveId,sourceId:'a',targetId:'b'})
    assert.deepEqual(tx.after.actors.a,before.actors.a);assert.deepEqual(tx.after.actors.b,{...before.actors.b,hp:180-rule(moveId).damage})
  }
})

test('conditional fixtures route to the explicit recipient and reconcile damage and cure through optional FX',async()=>{
  for(const moveId of ['facade','smelling-salts'])for(const sourceId of ['source','target']){
    const targetId=sourceId==='source'?'target':'source',move=rule(moveId),tx=createPreviewTransaction(move,{sourceId,targetId})
    assert.equal(tx.before.actors[sourceId].condition,moveId==='facade'?'burn':null)
    assert.equal(tx.before.actors[targetId].condition,moveId==='smelling-salts'?'paralysis':null)
    assert.equal(tx.after.actors[targetId].hp,tx.before.actors[targetId].hp-move.damage*2)
    for(const mode of ['off','impact','skip','failure']){
      let options,imports=0;const views=[]
      const p=createPresenter({getScene:()=>({}),onDisplay:v=>views.push(v),loadFx:()=>{imports++;if(mode==='failure')throw Error('unavailable');return{play(request,opts){assert.equal(request.condition,undefined);assert.equal(request.actors,undefined);options=opts;return{finished:new Promise(()=>{}),cancel(){}}}}}})
      const run=p.enqueue(tx,{effectsEnabled:mode!=='off'});await tick()
      if(mode==='impact'){options.onCue({type:'impact'});options.onCue({type:'impact'});assert.equal(views.at(-1).state,tx.after);assert.equal(views.filter(v=>v.animate).length,1);p.skip()}
      if(mode==='skip')p.skip()
      await run;assert.equal(views.at(-1).state,tx.after);if(mode==='off')assert.equal(imports,0)
      const fresh=createPreviewState(rule('tackle'),{sourceId});p.reset(fresh);options?.onCue({type:'impact'});assert.equal(views.at(-1).state,fresh);assert.equal(fresh.actors[sourceId].condition,null);p.destroy()
    }
    const actors=[{id:sourceId,name:'User',hp:100,maxHp:100},{id:'extra',name:'Bystander',hp:100,maxHp:100,condition:'poison'},{id:targetId,name:'Recipient',hp:100,maxHp:100}]
    const fixture=createPreviewState(move,{sourceId,targetId,actors})
    assert.equal(fixture.actors.extra.condition,'poison');assert.equal(fixture.actors[targetId].condition,moveId==='smelling-salts'?'paralysis':null)
    actors[0].hp=0;const fainted=createPreviewState(move,{sourceId,targetId,actors});assert.equal(fainted.actors[sourceId].hp,0);assert.equal(fainted.actors[sourceId].condition,null)
    assert.throws(()=>createPreviewTransaction(move,{sourceId,targetId,actors}),/fainted/)
  }
})

function harness(reverse,profile='wide',edge=0){
  let timeline
  const specific=profile==='tall'?{palm:[.7,.4],fist:[.8,.35],horn:[.6,.12],wing:[.7,.5],tail:[.36,.65],head:[.58,.18]}:{}
  const scene=createSceneGraph({width:720,height:600,actors:[
    {id:'source',profile,x:reverse?.75:.25,y:.82,height:.3,facing:reverse?-1:1,anchors:{origin:[.43,.94],hand:[.76,.43],...specific}},
    {id:'target',profile:'tall',x:reverse?(edge===1?.055:.25):(edge===1?.945:.75),y:edge===2?.3:.62,height:edge===2?.3:.18,facing:reverse?1:-1,anchors:{center:edge===2?[.48,.1]:[.48,.44]}},
  ]})
  const fx=createBattleFx({glowTexture:Texture.WHITE,timelineEngine:{timeline(options){return timeline=gsap.timeline({...options,paused:true})}}})
  return{scene,fx,get tl(){return timeline},node:label=>scene.effects.getChildByLabel(label,true),point:n=>scene.effects.toLocal({x:0,y:0},n),dispose(){fx.dispose();scene.dispose()}}
}
function clean(h){assert.equal(h.scene.effects.children.length,0);for(const a of h.scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.tint,0xffffff)}}
const labels={'double-slap':'double-slap-palm','comet-punch':'comet-punch-fist','arm-thrust':'arm-thrust-palm','fury-attack':'fury-attack-tip','steel-wing':'steel-wing-tip','iron-tail':'iron-tail-tip','poison-tail':'poison-tail-tip','headbutt':'headbutt-contact','frustration':'frustration-contact','facade':'facade-contact','smelling-salts':'smelling-salts-palm-0'}
const beats={'double-slap':[.52,.88],'comet-punch':[.56,.86,1.16],'arm-thrust':[.62,.98,1.34],'fury-attack':[.44,.68,.92,1.16]}
function contact(h,moveId){
  const a=h.point(h.node(labels[moveId])),b=h.scene.actor('target').anchor('center')
  assert.ok(Math.abs(a.x-b.x)<.04,moveId+' horizontal contact')
  assert.ok(Math.abs(a.y-b.y)<(moveId==='fury-attack'?8:.04),moveId+' vertical contact')
  assert.ok(h.node(labels[moveId]).alpha>.7,moveId+' visible at contact')
  if(moveId==='smelling-salts'){const p=h.point(h.node('smelling-salts-palm-1'));assert.ok(Math.hypot(p.x-b.x,p.y-b.y)<.04,'second palm contact')}
}
test('every visible strike reaches the target before its cue; multi-hit previews reveal only after the last contact',async()=>{
  for(const reverse of [false,true])for(const profile of ['wide','tall']){
    const h=harness(reverse,profile)
    try{for(const moveId of ids){
      const timing=EFFECT_TIMINGS[moveId],cues=[]
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:c=>{contact(h,moveId);cues.push(c.type)}})
      await tick()
      for(const at of beats[moveId]??[timing.contact]){h.tl.time(at-.001,false);assert.equal(cues.length,0);h.tl.time(at,false);contact(h,moveId);assert.equal(cues.length,at===timing.contact?1:0)}
      assert.deepEqual(cues,['impact']);h.tl.time(timing.duration,false);assert.equal((await run.finished).status,'completed');clean(h)
      const again=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.tl.time(timing.contact+.1,false);again.cancel();await again.finished;clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('all new strikes fit full rotated actor and effect silhouettes at upper and side edges from either perspective',async()=>{
  for(const reverse of [false,true])for(const edge of [0,1,2]){
    const h=harness(reverse,'tall',edge)
    try{for(const moveId of ids){
      const timing=EFFECT_TIMINGS[moveId],run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:()=>contact(h,moveId)})
      await tick()
      for(let t=.04;t<timing.duration-.02;t+=.035){h.tl.time(t,false)
        for(const a of h.scene.actors.values()){
          const p=a.anchor('visualCenter'),c=Math.abs(Math.cos(a.pose.rotation)),s=Math.abs(Math.sin(a.pose.rotation)),rx=(a.metrics.width*c+a.metrics.height*s)/2,ry=(a.metrics.height*c+a.metrics.width*s)/2
          assert.ok(p.x-rx>=-.04&&p.x+rx<=720.04&&p.y-ry>=-.04&&p.y+ry<=600.04,`${moveId} ${a.id} actor fits at ${t}: ${JSON.stringify({p,rx,ry})}`)
          assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)
        }
        const walk=(n,parent=1)=>{const alpha=parent*n.alpha;assert.ok(n.alpha>=0&&n.alpha<=1,moveId+' alpha');if(alpha>.03&&['Graphics','Sprite'].includes(n.constructor.name)){const b=n.getBounds();assert.ok(b.x>=-.04&&b.y>=-.04&&b.x+b.width<=720.04&&b.y+b.height<=600.04,`${moveId} ${n.label} at ${t}: ${JSON.stringify(b)}`)}for(const c of n.children??[])walk(c,alpha)};walk(h.scene.effects)
      }
      h.tl.time(timing.duration,false);assert.equal((await run.finished).status,'completed');clean(h)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
