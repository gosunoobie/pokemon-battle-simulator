import test from 'node:test'
import assert from 'node:assert/strict'
import { Container, Texture, TextureSource } from 'pixi.js'
import { gsap } from 'gsap'
import { MOVE_RULES, createBattleState } from '@battle/battle-core'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createActor } from '../apps/game/src/scene/actor.js'
import { SPRITE_PROFILES } from '../apps/game/src/scene/profiles.js'
import { PREVIEW_POKEMON, previewSceneActors, previewBattleActors } from '../apps/game/src/scene/previewActors.js'
import { createPreviewTransaction, createPreviewState } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
const tick=()=>new Promise(r=>setImmediate(r))
const close=(a,b,message)=>assert.ok(Math.abs(a-b)<.03,`${message}: ${a} vs ${b}`)
const pointClose=(a,b,message)=>{close(a.x,b.x,message+' x');close(a.y,b.y,message+' y')}
const texture=(w=96,h=96)=>new Texture({source:new TextureSource({width:w,height:h})})
function harness(near='charizard',far='venusaur',custom){
  let timeline
  const tex=texture(),assets={leaf:texture(256,256),rock:texture(256,256),surf:texture(1774,887),waterfall:texture(1024,1536)}
  const scene=createSceneGraph(custom??{actors:previewSceneActors(near,far),textures:Object.fromEntries(Object.keys(SPRITE_PROFILES).map(id=>[id,tex]))})
  const fx=createBattleFx({glowTexture:Texture.WHITE,assetLoader:key=>assets[key],timelineEngine:{timeline(opts){return timeline=gsap.timeline({...opts,paused:true})}}})
  return{scene,fx,get tl(){return timeline},dispose(){fx.dispose();scene.dispose();tex.destroy(true);for(const t of Object.values(assets))t.destroy(true)}}
}
function clean(h){
  assert.equal(h.scene.effects.children.length,0);assert.equal(h.scene.camera.x,0);assert.equal(h.scene.camera.y,0)
  for(const a of h.scene.actors.values()){
    assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)
    close(a.root.zIndex,a.base('ground').y,'depth restored')
  }
}

test('all 251 previews route results, self effects, healing and recoil to either actor even with effects off',async()=>{
  for(const sourceId of ['source','target'])for(const move of MOVE_RULES){
    const targetId=sourceId==='source'?'target':'source',actors=previewBattleActors('bulbasaur','blastoise')
    const tx=createPreviewTransaction(move,{sourceId,targetId,actors}),affected=move.target==='self'?sourceId:targetId
    assert.equal(tx.event.sourceId,sourceId);assert.deepEqual(tx.event.targetIds,move.target==='field'?[]:[affected]);assert.equal(tx.event.outcome,'hit',move.id)
    assert.equal(tx.before.actors[sourceId].name,sourceId==='source'?'Bulbasaur':'Blastoise')
    if(move.target==='self')assert.deepEqual(tx.after.actors[targetId],tx.before.actors[targetId],move.id+' unaffected opponent')
    if(move.drain){assert.ok(tx.before.actors[sourceId].hp<tx.before.actors[sourceId].maxHp);assert.ok(tx.after.actors[sourceId].hp>tx.before.actors[sourceId].hp)}
    if(move.cure||move.rest)assert.equal(tx.before.actors[targetId].condition,null)
    if(move.selfDestruct)assert.equal(tx.after.actors[sourceId].hp,0)
    if(move.recoilDamage||move.recoilMaxHp)assert.ok(tx.after.actors[sourceId].hp<tx.before.actors[sourceId].hp)
    let display
    const p=createPresenter({loadFx:()=>{throw Error('must not load FX')},getScene:()=>null,onDisplay:v=>{display=v}})
    await p.enqueue(tx,{effectsEnabled:false});assert.equal(display.state,tx.after);p.destroy()
  }
  assert.throws(()=>createPreviewTransaction(MOVE_RULES[0],{allowedMoveIds:[]}),/not available/)
  assert.doesNotThrow(()=>createPreviewTransaction(MOVE_RULES[0],{sourceId:'target',targetId:'source',allowedMoveIds:['slash']}))
  assert.throws(()=>createPreviewState(MOVE_RULES[0],{sourceId:'missing'}),/Unknown preview attacker/)
})

test('all 251 effects play from both field positions for all nine starters and their front/back artwork',async()=>{
  const ids=Object.keys(PREVIEW_POKEMON),pairs=ids.map((id,i)=>[id,ids[(i+1)%ids.length]])
  for(const [near,far] of pairs){
    const h=harness(near,far)
    try{for(const sourceId of ['source','target'])for(const [moveId,timing] of Object.entries(EFFECT_TIMINGS)){
      const targetId=sourceId==='source'?'target':'source',cues=[]
      const bases=[...h.scene.actors.values()].map(a=>a.base('origin'))
      const run=h.fx.play({moveId,sourceId,targetIds:[targetId],visualSeed:42},{scene:h.scene,onCue:c=>cues.push(c.type)})
      await tick();assert.ok(h.tl,moveId)
      for(let t=.025;t<timing.duration;t+=.05){
        h.tl.time(t,false)
        for(const a of h.scene.actors.values()){
          const p=a.anchor('visualCenter');assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),`${near}/${far} ${sourceId} ${moveId} finite pose`)
          assert.ok(a.root.visible,moveId+' actor display remains mounted');if(!['extreme-speed','fly','bounce','dig','dive'].includes(moveId)||a.id!==sourceId)assert.ok(a.pose.alpha>.01,moveId+' actor remains visible');assert.ok(a.pose.scale.x>0&&a.pose.scale.y>0,moveId+' nonzero actor scale')
        }
      }
      h.tl.time(timing.duration,false);const result=await run.finished
      assert.equal(result.status,'completed',`${near}/${far} ${sourceId} ${moveId}: ${result.reason}`)
      assert.deepEqual(cues,timing.recovery!=null?['impact','recovery']:['impact'],moveId);clean(h)
      assert.deepEqual([...h.scene.actors.values()].map(a=>a.base('origin')),bases,'attacker selection never swaps field positions')
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('every opponent recipe supports reduced motion, mid-move cancellation, viewport fit and immediate side reversal',async()=>{
  const h=harness()
  try{for(const [moveId,timing] of Object.entries(EFFECT_TIMINGS)){
    for(const reducedMotion of [false,true]){
      const run=h.fx.play({moveId,sourceId:'target',targetIds:['source'],visualSeed:42},{scene:h.scene,reducedMotion})
      await tick();h.tl.time(reducedMotion?.3:timing.contact+.08,false)
      const a=h.scene.actor('target'),before=a.anchor('center');h.scene.fit(320,480);pointClose(a.anchor('center'),before,'camera fit preserves logical sockets')
      if(reducedMotion){h.tl.time(.8,false);assert.equal((await run.finished).status,'completed')}
      else {run.cancel();assert.equal((await run.finished).status,'cancelled')}
      clean(h)
    }
    const old=h.fx.play({moveId,sourceId:'target',targetIds:['source']},{scene:h.scene});await tick();h.tl.time(timing.contact/2,false)
    const next=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick()
    assert.equal((await old.finished).status,'cancelled');h.tl.time(timing.duration,false);assert.equal((await next.finished).status,'completed');clean(h)
  }}finally{h.dispose();gsap.ticker.sleep()}
})

test('native-left defaults face forward and partial custom metadata retains measured anatomy',()=>{
  for(const facing of [-1,1]){
    const layer=new Container(),effects=new Container(),parent=new Container();parent.addChild(layer,effects)
    const a=createActor({id:'custom',position:{x:200,y:200},height:100,nativeFacing:-1,facing,bounds:{x:20,y:10,width:80,height:100},anchors:{eyes:[.2,.2]},layer,effectSpace:effects})
    assert.ok((a.base('emission').x-a.base('visualCenter').x)*facing>0,'fallback mouth faces forward')
    assert.ok((a.base('tackle').x-a.base('visualCenter').x)*facing>0,'fallback body contact faces forward')
    close(a.base('eyes').x,200+(.2-.5)*80*facing/-1,'explicit socket is not mirrored twice')
    a.destroy();parent.destroy({children:true})
  }
  const h=harness('charizard','venusaur',{actors:[{id:'one',profile:'venusaur',x:.7,y:.7,height:.3,facing:-1,anchors:{fist:[.1,.6]}}]})
  const a=h.scene.actor('one'),profile=SPRITE_PROFILES.venusaur
  close(a.base('emission').x,.7*h.scene.width+(profile.anchors.emission[0]-.5)*a.metrics.width,'measured emission survives fist override')
  close(a.base('origin').y,.7*h.scene.height+(profile.anchors.origin[1]-1)*a.metrics.height,'registration survives fist override');h.dispose()
})

test('opponent ground travel, spin centering, compact hops and contact depth adapt without changing move timing',async()=>{
  const h=harness('blastoise','bulbasaur'),source=h.scene.actor('target'),target=h.scene.actor('source')
  try{
    for(const [moveId,time,socket,expected] of [['body-slam',.58,'slam',-51.336567460885],['wing-attack',.3,'tackle',-48.046767312904],['blaze-kick',.36,'foot',-7.98912491561]]){
      const run=h.fx.play({moveId,sourceId:'target',targetIds:['source']},{scene:h.scene});await tick();h.tl.time(time,false)
      const unit=Math.min(h.scene.unit*1.25,Math.max(h.scene.unit*.6,target.metrics.height/168.90625))
      close((source.anchor(socket).y-target.base('center').y)/unit,expected,moveId+' raised contact socket');run.cancel();await run.finished;clean(h)
    }
    const surf=h.fx.play({moveId:'surf',sourceId:'target',targetIds:['source']},{scene:h.scene});await tick();h.tl.time(.4,false)
    const wave=h.scene.effects.getChildByLabel('surf-leading',true),y=wave.y;h.tl.time(1.12,false)
    assert.ok(wave.y>y,'opponent tide descends toward foreground');surf.cancel();await surf.finished;clean(h)
    for(const [moveId,label] of [['rapid-spin','rapid-spin-wind'],['rollout','rollout-shell'],['ice-ball','ice-ball-shell'],['flame-wheel','flame-wheel-ring']]){
      const run=h.fx.play({moveId,sourceId:'target',targetIds:['source']},{scene:h.scene});await tick();h.tl.time(EFFECT_TIMINGS[moveId].contact*.7,false)
      pointClose(h.scene.effects.toLocal({x:0,y:0},h.scene.effects.getChildByLabel(label,true)),source.anchor('visualCenter'),moveId+' shell centered on art')
      run.cancel();await run.finished;clean(h)
    }
    const run=h.fx.play({moveId:'tackle',sourceId:'target',targetIds:['source']},{scene:h.scene});await tick();h.tl.time(.4,false)
    pointClose(source.anchor('tackle'),target.base('center'),'opponent body meets receiver');assert.ok(source.root.zIndex>target.root.zIndex,'rear attacker draws in front at contact')
    run.cancel();await run.finished;clean(h)
  }finally{h.dispose();gsap.ticker.sleep()}
})

test('changing attack side ignores late cues and reconciles opponent drain, self effects and fainting',async()=>{
  for(const moveId of ['giga-drain','rest','swords-dance','smokescreen','submission','explosion','hypnosis']){
    const move=MOVE_RULES.find(m=>m.id===moveId),tx=createPreviewTransaction(move,{sourceId:'target',targetId:'source'})
    let opts,display
    const p=createPresenter({loadFx:async()=>({play(_r,o){opts=o;return{finished:new Promise(()=>{}),cancel(){}}}}),getScene:()=>({}),onDisplay:v=>{display=v}})
    const pending=p.enqueue(tx);await tick();opts.onCue({type:'impact'})
    if(move.drain){assert.equal(display.state.actors.target.hp,tx.before.actors.target.hp);assert.equal(display.state.actors.source.hp,tx.after.actors.source.hp);opts.onCue({type:'recovery'})}
    assert.deepEqual(display.state,tx.after)
    const fresh=createPreviewState(move,{sourceId:'source'});p.reset(fresh,'Your side is ready.');opts.onCue({type:'impact'});opts.onCue({type:'recovery'});await pending
    assert.equal(display.state,fresh);p.destroy()
  }
})

test('all opponent effects preserve pose timing, gravity, colors and effect dimensions under horizontal reflection',async()=>{
  const specs=previewSceneActors(),textures=Object.fromEntries(Object.keys(SPRITE_PROFILES).map(id=>[id,texture()]))
  const left=harness(),right=harness(null,null,{actors:specs.map(a=>({...a,x:1-a.x,facing:-a.facing})),textures})
  const shapes=root=>{
    const out=[]
    const walk=(n,alpha=1)=>{
      alpha*=n.alpha
      if(alpha<.01||!n.visible)return
      if(['Sprite','TilingSprite','Graphics'].includes(n.constructor.name)){
        const b=n.getBounds();assert.ok([b.x,b.y,b.width,b.height].every(Number.isFinite),'finite effect geometry')
        if(b.width>0&&b.height>0)out.push({kind:n.constructor.name,tint:n.getGlobalTint(),alpha,w:b.width,h:b.height})
      }
      for(const c of n.children??[])walk(c,alpha)
    };walk(root);return out
  }
  try{for(const [moveId,timing] of Object.entries(EFFECT_TIMINGS)){
    const request={moveId,sourceId:'target',targetIds:['source'],visualSeed:42}
    const a=left.fx.play(request,{scene:left.scene}),b=right.fx.play(request,{scene:right.scene});await tick()
    const samples=[.25,timing.contact+.04,Math.min(timing.duration-.05,timing.contact+.5)].sort((a,b)=>a-b)
    let prior=0
    for(const end of samples){
      for(let t=prior+.01;t<end;t+=.01){left.tl.time(t,false);right.tl.time(t,false)}
      left.tl.time(end,false);right.tl.time(end,false);prior=end
      for(const id of ['source','target']){
        const x=left.scene.actor(id).pose,y=right.scene.actor(id).pose
        close(x.x,-y.x,moveId+' reflected displacement');close(x.y,y.y,moveId+' unchanged gravity');close(x.rotation,-y.rotation,moveId+' reflected rotation')
        close(x.alpha,y.alpha,moveId+' same opacity');close(x.scale.x,y.scale.x,moveId+' same horizontal size');close(x.scale.y,y.scale.y,moveId+' same vertical size')
      }
      const original=shapes(left.scene.effects),mirrored=shapes(right.scene.effects)
      assert.equal(original.length,mirrored.length,moveId+' retained effect objects')
      for(const x of original){
        // Pixel-snapped foam may round differently on opposite sides of a 1000-unit stage.
        const i=mirrored.findIndex(y=>x.kind===y.kind&&x.tint===y.tint&&Math.abs(x.alpha-y.alpha)<.003&&Math.abs(x.w-y.w)<4&&Math.abs(x.h-y.h)<4)
        assert.ok(i>=0,moveId+' retained colors, opacity and dimensions');mirrored.splice(i,1)
      }
    }
    a.cancel();b.cancel();await Promise.all([a.finished,b.finished]);clean(left);clean(right)
  }}finally{left.dispose();right.dispose();for(const t of Object.values(textures))t.destroy(true);gsap.ticker.sleep()}
})
