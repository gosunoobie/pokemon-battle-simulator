import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Container, Graphics, Texture, TextureSource } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createActor } from '../apps/game/src/scene/actor.js'
const texture=(width=96,height=96)=>new Texture({source:new TextureSource({width,height})})
const tick=()=>new Promise(resolve=>setImmediate(resolve))
function harness(options={}) {
  let timeline
  const tex=texture(),assets={leaf:tex,rock:tex,surf:texture(1774,887),waterfall:texture(1024,1536)}
  const scene=createSceneGraph({textures:{charizard:tex,venusaur:tex},...options.scene})
  const fx=createBattleFx({glowTexture:Texture.WHITE,assetLoader:key=>Promise.resolve(assets[key]),timelineEngine:{timeline(opts){timeline=gsap.timeline({...opts,paused:true});return timeline}},...options.fx})
  const clean=()=>{
    assert.equal(scene.effects.children.length,0)
    assert.equal(scene.camera.x,0);assert.equal(scene.camera.y,0)
    for(const actor of scene.actors.values()){assert.equal(actor.pose.x,0);assert.equal(actor.pose.y,0);assert.equal(actor.pose.alpha,1);assert.equal(actor.pose.rotation,0);assert.equal(actor.pose.scale.x,1);assert.equal(actor.pose.scale.y,1);assert.equal(actor.pose.tint,0xffffff)}
    assert.equal(tex.destroyed,false)
  }
  return{scene,fx,clean,get timeline(){return timeline},dispose(){fx.dispose();scene.dispose()}}
}
test('335 recipes complete in normal/reduced modes with ordered cosmetic cues and clean up all temporary state',async()=>{
  const h=harness()
  for(const reducedMotion of [false,true])for(const [moveId,timing]of Object.entries(EFFECT_TIMINGS)){
    const cues=[];const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,reducedMotion,onCue:e=>cues.push(e)})
    await tick();assert.ok(h.timeline,moveId)
    const duration=reducedMotion?.8:timing.duration
    assert.equal(h.timeline.duration(),duration,moveId+' duration')
    for(let t=.02;t<duration;t+=.02){h.timeline.time(t,false);for(const actor of h.scene.actors.values()){assert.ok(Number.isFinite(actor.pose.x));assert.ok(Number.isFinite(actor.pose.y))}}
    h.timeline.time(duration,false)
    assert.equal((await run.finished).status,'completed',moveId)
    assert.deepEqual(cues.map(c=>c.type),timing.recovery!=null?['impact','recovery']:['impact'],moveId+' ordered cues');h.clean()
  }
  h.dispose();gsap.ticker.sleep()
})
test('each recipe supports cancellation and replay without destroying shared actor/effect textures',async()=>{
  const h=harness()
  for(const [moveId,timing]of Object.entries(EFFECT_TIMINGS)){
    for(const time of [timing.contact/2,timing.contact+.08]){
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.timeline.time(time,false);run.cancel();assert.equal((await run.finished).status,'cancelled');h.clean()
    }
    const replay=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.timeline.time(timing.duration,false);assert.equal((await replay.finished).status,'completed');h.clean()
  }
  h.dispose();gsap.ticker.sleep()
})
test('new move cues follow activation and effects dissipate before playback finishes',async()=>{
  const h=harness()
  // Continuous emitters need real frame progression to age their existing particles.
  const advance=time=>{for(let t=h.timeline.time()+1/120;t<time;t+=1/120)h.timeline.time(t,false);h.timeline.time(time,false)}
  for(const moveId of ['poison-powder','sleep-powder','stun-spore','bite','crunch','hyper-fang','poison-fang','smog','poison-gas','smokescreen','toxic','barrier','protect','light-screen','reflect','rapid-spin','rollout','ice-ball','flame-wheel','karate-chop','brick-break','cross-chop','rock-smash','peck','horn-attack','drill-peck','megahorn','cut','fury-cutter','leaf-blade','air-cutter','ember','dragon-rage','will-o-wisp','tri-attack','whirlpool','fire-spin','sand-tomb','whirlwind','absorb','mega-drain','giga-drain','leech-life','refresh','heal-bell','aromatherapy','rest','meditate','calm-mind','amnesia','focus-energy','bulk-up','howl','swords-dance','dragon-dance','agility','double-team','minimize','acid-armor','rage','thrash','outrage','struggle','leer','scary-face','glare','mean-look','scratch','metal-claw','dragon-claw','tackle','return','take-down','double-edge','slam','stomp','strength','mega-punch','meteor-mash','dynamic-punch','focus-punch','rock-blast','ancient-power','rock-tomb','confusion','hypnosis','confuse-ray','explosion','self-destruct','vital-throw','submission','sky-uppercut','seismic-toss','fire-punch','thunder-punch','shadow-punch','mega-kick','low-kick','rolling-kick','double-kick','triple-kick','jump-kick','high-jump-kick','bullet-seed','pin-missile','spike-cannon','icicle-spear','poison-sting','twineedle','swift','pay-day','rock-throw','egg-bomb','barrage','present','fly','bounce','dig','dive','dragon-breath','sacred-fire','overheat','psybeam','signal-beam','counter','mirror-coat','pain-split','endeavor','disable','encore','torment','imprison','taunt','swagger','flatter','fake-tears','sing','grass-whistle','snore','perish-song','belly-drum','trick','charm','attract','sweet-kiss','lovely-kiss','recover','soft-boiled','milk-drink','slack-off','morning-sun','synthesis','moonlight','wish','harden','iron-defense','defense-curl','withdraw','safeguard','magic-coat','cosmic-power','endure','double-slap','comet-punch','arm-thrust','fury-attack','steel-wing','iron-tail','poison-tail','headbutt','frustration','facade','smelling-salts','hidden-power','zap-cannon','weather-ball','mist-ball','teleport','baton-pass','substitute','recycle','growl','roar','screech','metal-sound','metronome','assist','sleep-talk','nature-power','mud-sport','water-sport','spikes','sweet-scent','fake-out','astonish','tail-whip','tickle','supersonic','sonic-boom','hyper-voice','uproar','lock-on','mind-reader','foresight','odor-sleuth','mimic','psych-up','role-play','skill-swap','hydro-pump','water-gun','hydro-cannon','spit-up','hyper-beam','aeroblast','luster-purge']){
    const cues=[],timing=EFFECT_TIMINGS[moveId]
    const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:e=>cues.push(e)})
    await tick()
    advance(timing.contact-.01);assert.equal(cues.length,0,moveId+' no early cue')
    advance(timing.contact+.001);assert.equal(cues.length,1,moveId+' arrival cue')
    const artwork=h.scene.effects.getChildByLabel('move-artwork',true)
    const visible=n=>n.alpha>.002&&(n instanceof Graphics||n.constructor.name==='Sprite'||n.children?.some(visible))
    assert.ok(artwork.children.some(visible),moveId+' visible at contact')
    advance(timing.duration-.02)
    assert.equal(artwork.children.some(visible),false,moveId+' faded before teardown')
    h.timeline.time(timing.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
  }
  h.dispose();gsap.ticker.sleep()
})
test('detonations stay at supplied source centers and their pressure fronts reach the opponent before cues',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness({scene:{width:720,height:600,actors:[
      {id:'source',profile,x:reversed?.77:.23,y:.8,height:.32,facing:reversed?-1:1,anchors:{center:[.56,.38]}},
      {id:'target',profile:'venusaur',x:reversed?.25:.75,y:.62,height:.24,facing:reversed?1:-1,anchors:{center:[.47,.41]}},
    ]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target')
    for(const [moveId,detonate] of [['explosion',.72],['self-destruct',.5]]){
      let arrival
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:()=>{
        const front=h.scene.effects.getChildByLabel(moveId+'-front',true)
        arrival={point:h.scene.effects.toLocal({x:0,y:0},front),target:target.anchor('center')}
      }})
      await tick();h.timeline.time(.3,false)
      const charge=h.scene.effects.getChildByLabel(moveId+'-charge',true),charged=h.scene.effects.toLocal({x:0,y:0},charge),posed=source.anchor('center')
      assert.ok(Math.hypot(charged.x-posed.x,charged.y-posed.y)<.02,'charge follows vibrating source')
      h.timeline.time(detonate+.05,false)
      const burst=h.scene.effects.getChildByLabel(moveId+'-burst',true),center=h.scene.effects.toLocal({x:0,y:0},burst),base=source.base('center')
      assert.ok(Math.hypot(center.x-base.x,center.y-base.y)<.02,'burst stays at original source center')
      assert.equal(source.pose.x,0);assert.ok(burst.alpha>0);assert.equal(arrival,undefined)
      h.timeline.time(EFFECT_TIMINGS[moveId].contact,false)
      assert.ok(arrival);assert.ok(Math.hypot(arrival.point.x-arrival.target.x,arrival.point.y-arrival.target.y)<.02,'pressure reaches target before cue')
      h.scene.fit(320,480);const fitted=h.scene.effects.toLocal({x:0,y:0},burst);assert.ok(Math.hypot(fitted.x-center.x,fitted.y-center.y)<.02)
      for(const actor of [source,target]){assert.equal(actor.pose.alpha,1);assert.equal(actor.pose.scale.x,1);assert.equal(actor.pose.scale.y,1)}
      h.timeline.time(EFFECT_TIMINGS[moveId].duration-.02,false);assert.ok(Math.abs(source.pose.x)<.001);assert.ok(Math.abs(target.pose.x)<.001)
      h.timeline.time(EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('psychic pulses, sleep rings and confusing rays use supplied eyes and posed target centers',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall'])for(const custom of [false,true]){
    const h=harness({scene:{width:720,height:600,actors:[
      {id:'source',profile,x:reversed?.78:.22,y:.82,height:.32,facing:reversed?-1:1,...(custom?{anchors:{eyes:[.87,.22]}}:{})},
      {id:'target',profile:'venusaur',x:reversed?.25:.75,y:.64,height:.24,facing:reversed?1:-1,anchors:{center:[.48,.44]}},
    ]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target')
    for(const [moveId,label] of [['confusion','confusion-field'],['hypnosis','hypnosis-ring-0'],['confuse-ray','confuse-ray-head']]){
      let arrival
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:()=>{
        const art=h.scene.effects.getChildByLabel(label,true),glint=h.scene.effects.getChildByLabel(moveId+'-source',true)
        arrival={point:h.scene.effects.toLocal({x:0,y:0},art),center:target.anchor('center'),source:h.scene.effects.toLocal({x:0,y:0},glint),eyes:source.anchor(custom?'eyes':'emission')}
      }})
      await tick();h.timeline.time(EFFECT_TIMINGS[moveId].contact,false)
      assert.ok(arrival);assert.ok(Math.hypot(arrival.point.x-arrival.center.x,arrival.point.y-arrival.center.y)<.02,moveId+' arrives before cue')
      assert.ok(Math.hypot(arrival.source.x-arrival.eyes.x,arrival.source.y-arrival.eyes.y)<.02,moveId+' source attachment')
      h.timeline.time(EFFECT_TIMINGS[moveId].contact+.11,false)
      const art=h.scene.effects.getChildByLabel(moveId==='confuse-ray'?'confuse-ray-halo':label,true),posed=h.scene.effects.toLocal({x:0,y:0},art),center=target.anchor('center')
      assert.ok(Math.hypot(posed.x-center.x,posed.y-center.y)<.02,moveId+' follows posed target')
      h.scene.fit(320,480);const fitted=h.scene.effects.toLocal({x:0,y:0},art);assert.ok(Math.hypot(fitted.x-posed.x,fitted.y-posed.y)<.02)
      if(moveId==='hypnosis'){
        const sleep=h.scene.effects.getChildByLabel('hypnosis-sleep',true),glyph=sleep.children[0],a=h.scene.effects.toLocal({x:-1,y:0},glyph),b=h.scene.effects.toLocal({x:1,y:0},glyph)
        assert.ok(b.x>a.x,'sleep glyph remains readable when mirrored')
      }
      assert.equal(source.pose.alpha,1);assert.equal(target.pose.alpha,1)
      h.timeline.time(EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('new rock effects follow supplied sockets, hit posed targets and close around the supplied floor',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness({scene:{width:720,height:600,actors:[
      {id:'source',profile,x:reversed?.78:.22,y:.82,height:.32,facing:reversed?-1:1,anchors:{emission:[.9,.26],aura:[.52,.44]}},
      {id:'target',profile:'venusaur',x:reversed?.25:.75,y:.64,height:.24,facing:reversed?1:-1,anchors:{center:[.47,.48],floor:[.52,.96]}},
    ]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target'),sign=reversed?-1:1
    const unit=Math.min(h.scene.unit*1.25,Math.max(h.scene.unit*.6,target.metrics.height/168.90625))
    for(const [moveId,count,first,step] of [['rock-blast',3,.72,.2],['ancient-power',5,1.34,.055]]){
      const cues=[],run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:c=>cues.push(c)})
      await tick()
      if(moveId==='rock-blast'){
        h.timeline.time(.32,false)
        const art=h.scene.effects.getChildByLabel('rock-blast-stone-0',true),actual=h.scene.effects.toLocal({x:0,y:0},art),emission=source.anchor('emission')
        assert.ok(Math.hypot(actual.x-emission.x,actual.y-emission.y)<.02,'held emission launch')
      }
      for(let i=0;i<count;i++){
        h.timeline.time(first+i*step,false)
        const art=h.scene.effects.getChildByLabel(moveId+'-stone-'+i,true),actual=h.scene.effects.toLocal({x:0,y:0},art),center=target.anchor('center')
        const r=moveId==='rock-blast'?Math.min(22,Math.max(14,target.metrics.height/unit*.1)):Math.min(22,Math.max(12,source.metrics.height/unit*.085))
        const x=moveId==='rock-blast'?0:[0,-.4,.4,-.2,.2][i]*r*sign*unit,y=(moveId==='rock-blast'?[0,-.3,.3][i]:[0,.2,-.2,-.5,.5][i])*r*unit
        assert.ok(Math.hypot(actual.x-center.x-x,actual.y-center.y-y)<.03,moveId+' stone '+i+' arrives at posed target')
        assert.ok(art.alpha>.99);assert.equal(source.pose.alpha,1);assert.equal(target.pose.alpha,1)
      }
      assert.equal(cues.length,1,'volley has one cosmetic result cue')
      h.timeline.time(EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    const run=h.fx.play({moveId:'rock-tomb',sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.timeline.time(.7,false)
    const stone=h.scene.effects.getChildByLabel('rock-tomb-stone-0',true),actual=h.scene.effects.toLocal({x:0,y:0},stone),floor=target.base('floor')
    const r=Math.min(36,Math.max(20,target.metrics.height/unit*.15)),span=Math.min(92,Math.max(r*1.5,target.metrics.width/unit*.3))
    assert.ok(Math.hypot(actual.x-(floor.x-span*.82*sign*unit),actual.y-(floor.y-r*unit))<.02,'first boulder lands at supplied floor')
    h.timeline.time(.92,false);const closed=h.scene.effects.toLocal({x:0,y:0},stone)
    assert.ok(Math.abs(closed.x-floor.x)<Math.abs(actual.x-floor.x),'boulder closes inward after landing')
    h.scene.fit(320,480);const fitted=h.scene.effects.toLocal({x:0,y:0},stone);assert.ok(Math.hypot(fitted.x-closed.x,fitted.y-closed.y)<.02)
    assert.equal(target.pose.alpha,1);assert.equal(source.pose.alpha,1)
    h.timeline.time(EFFECT_TIMINGS['rock-tomb'].duration,false);assert.equal((await run.finished).status,'completed');h.clean();h.dispose()
  }
  gsap.ticker.sleep()
})
test('gazes use supplied eye sockets and reach the opponent before activation across actor shapes and facing',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall'])for(const custom of [false,true]){
    const h=harness({scene:{width:720,height:600,actors:[
      {id:'source',profile,x:reversed?.77:.23,y:.79,height:.3,facing:reversed?-1:1,...(custom?{anchors:{eyes:[.84,.2]}}:{})},
      {id:'target',profile:'venusaur',x:reversed?.24:.76,y:.61,height:.26,facing:reversed?1:-1},
    ]}})
    for(const [moveId,sourceLabel,targetLabel] of [['leer','leer-stare','leer-pressure-0'],['scary-face',null,'scary-face-mask'],['glare','glare-eyes','glare-tip'],['mean-look','mean-look-source','mean-look-eye']]){
      const source=h.scene.actor('source'),target=h.scene.actor('target'),timing=EFFECT_TIMINGS[moveId];let observed
      const point=label=>h.scene.effects.toLocal({x:0,y:0},h.scene.effects.getChildByLabel(label,true))
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:()=>{observed={art:point(targetLabel),target:target.anchor('center'),source:sourceLabel?point(sourceLabel):null,eye:source.anchor(custom?'eyes':'emission')}}})
      await tick();h.timeline.time(timing.contact,false)
      assert.ok(observed);assert.ok(Math.hypot(observed.art.x-observed.target.x,observed.art.y-observed.target.y)<.02,moveId+' arrives before cue')
      if(sourceLabel)assert.ok(Math.hypot(observed.source.x-observed.eye.x,observed.source.y-observed.eye.y)<.02,moveId+' eye attachment')
      h.scene.fit(320,480)
      for(let t=timing.contact;t<timing.duration;t+=.03){h.timeline.time(t,false);for(const actor of [source,target]){assert.equal(actor.pose.alpha,1);assert.equal(actor.pose.scale.x,1);assert.equal(actor.pose.scale.y,1)}}
      h.timeline.time(timing.duration-.01,false);assert.ok(Math.hypot(source.pose.x,source.pose.y)<.001);assert.ok(Math.hypot(target.pose.x,target.pose.y)<.001)
      h.timeline.time(timing.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('Slam, Stomp and Strength use the correct sockets and preserve contact during the Strength shove',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall'])for(const custom of [false,true]){
    const h=harness({scene:{width:720,height:600,actors:[
      {id:'source',profile,x:reversed?.76:.24,y:.8,height:.3,facing:reversed?-1:1,...(custom?{anchors:{tail:[.17,.68],hand:[.84,.5],foot:[.65,.92],tackle:[.91,.46]}}:{})},
      {id:'target',profile:'venusaur',x:reversed?.25:.75,y:.6,height:.24,facing:reversed?1:-1},
    ]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target'),unit=Math.min(h.scene.unit*1.25,Math.max(h.scene.unit*.6,target.metrics.height/168.90625))
    for(const [moveId,label,socket] of [['slam','slam-sweep',custom?'tail':'hand'],['stomp','stomp-foot','foot'],['strength','strength-pressure','tackle']]){
      const timing=EFFECT_TIMINGS[moveId];let observed
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:()=>{observed={actor:source.anchor(socket),art:h.scene.effects.toLocal({x:0,y:0},h.scene.effects.getChildByLabel(label,true))}}})
      await tick();h.timeline.time(timing.contact,false)
      const center=target.base('center'),floor=target.base('floor'),point={x:center.x,y:center.y+(moveId==='slam'?5*unit:moveId==='stomp'?(floor.y-center.y)*.45:0)}
      assert.ok(observed);assert.ok(Math.hypot(observed.actor.x-point.x,observed.actor.y-point.y)<.02,moveId+' actor contact before cue')
      assert.ok(Math.hypot(observed.art.x-point.x,observed.art.y-point.y)<.02,moveId+' artwork contact before cue')
      if(moveId==='strength'){
        h.timeline.time(.84,false);const a=source.anchor('tackle'),b=target.anchor('center')
        assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.02,'body stays in contact throughout the shove')
        const art=h.scene.effects.toLocal({x:0,y:0},h.scene.effects.getChildByLabel(label,true));assert.ok(Math.hypot(art.x-b.x,art.y-b.y)<.02,'pressure follows pushed target')
      }
      h.scene.fit(320,480)
      for(let t=h.timeline.time();t<timing.duration;t+=.03){h.timeline.time(t,false);for(const actor of [source,target]){assert.equal(actor.pose.alpha,1);assert.equal(actor.pose.scale.x,1);assert.equal(actor.pose.scale.y,1)}}
      h.timeline.time(timing.duration-.01,false);assert.ok(Math.hypot(source.pose.x,source.pose.y)<.001);assert.ok(Math.hypot(target.pose.x,target.pose.y)<.001)
      h.timeline.time(timing.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('physical body strikes meet custom targets before the cue and preserve visibility through recoil and recovery',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness({scene:{width:720,height:600,actors:[
      {id:'source',profile,x:reversed?.76:.24,y:.8,height:.3,facing:reversed?-1:1,anchors:{tackle:[.91,.46]}},
      {id:'target',profile:'venusaur',x:reversed?.25:.75,y:.6,height:.24,facing:reversed?1:-1},
    ]}})
    for(const moveId of ['rage','thrash','outrage','struggle','tackle','return','take-down','double-edge']){
      const source=h.scene.actor('source'),target=h.scene.actor('target'),timing=EFFECT_TIMINGS[moveId];let atContact
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:()=>{atContact={source:source.anchor('tackle'),target:target.anchor('center')}}})
      await tick();h.timeline.time(timing.contact,false)
      assert.ok(atContact,moveId+' cue');assert.ok(Math.hypot(atContact.source.x-atContact.target.x,atContact.source.y-atContact.target.y)<.02,moveId+' correct contact before recoil')
      if(moveId==='thrash')for(const t of [.96,1.42]){h.timeline.time(t,false);const a=source.anchor('tackle'),b=target.anchor('center');assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.02,'later cosmetic contacts align')}
      h.scene.fit(320,480)
      for(let t=h.timeline.time();t<timing.duration;t+=.02){h.timeline.time(t,false);assert.equal(source.pose.alpha,1);assert.equal(target.pose.alpha,1);assert.equal(source.pose.scale.x,1);assert.equal(source.pose.scale.y,1)}
      h.timeline.time(timing.duration-.01,false);assert.ok(Math.hypot(source.pose.x,source.pose.y)<.001);assert.equal(source.pose.rotation,0)
      h.timeline.time(timing.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('beak, horn, blade, claw and fist tips meet the target before cues across sizes, facing and optional sockets',async()=>{
  for(const reversed of [false,true])for(const profile of ['charizard','wide','tall'])for(const mode of ['fallback','custom','legacy']){
    const h=harness({scene:{width:720,height:600,actors:[
      {id:'source',profile,x:reversed?.75:.25,y:.8,height:profile==='wide'?.22:.34,facing:reversed?-1:1,...(mode==='custom'?{anchors:{beak:[.93,.21],horn:[.74,.03],blade:[.95,.46],hand:[.83,.57],claw:[.92,.48],fist:[.88,.56]}}:{})},
      {id:'target',profile:'venusaur',x:reversed?.25:.75,y:.6,height:.23,facing:reversed?1:-1},
    ]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target')
    if(mode==='legacy')delete source.hasAnchor
    else {assert.equal(source.hasAnchor('beak'),mode==='custom');assert.equal(source.hasAnchor('horn'),mode==='custom');assert.equal(source.hasAnchor('emission'),true)}
    const unit=Math.min(h.scene.unit*1.25,Math.max(h.scene.unit*.6,target.metrics.height/168.90625))
    for(const [moveId,label,socket,min,max,factor,dy,fallback='emission'] of [
      ['peck','peck-beak','beak',18,36,.13,4],
      ['horn-attack','horn-attack-horn','horn',32,64,.24,6],
      ['drill-peck','drill-peck-beak','beak',34,70,.25,4],
      ['megahorn','megahorn-horn','horn',52,96,.38,8],
      ['cut','cut-blade','hand',26,50,.22,6,'hand'],
      ['fury-cutter','fury-cutter-blade','hand',32,68,.26,4,'hand'],
      ['leaf-blade','leaf-blade-leaf','blade',40,86,.34,6,'hand'],
      ['scratch','scratch-claws','claw',24,42,.18,4,'hand'],
      ['metal-claw','metal-claw-steel','claw',34,65,.26,4,'hand'],
      ['dragon-claw','dragon-claw-talons','claw',40,76,.3,6,'hand'],
      ['mega-punch','mega-punch-fist','fist',20,35,.13,4,'hand'],
      ['meteor-mash','meteor-mash-fist','fist',22,37,.15,4,'hand'],
      ['dynamic-punch','dynamic-punch-fist','fist',25,41,.17,6,'hand'],
      ['focus-punch','focus-punch-fist','fist',26,43,.17,5,'hand'],
      ['fire-punch','fire-punch-fist','fist',19,32,.12,0,'hand'],
      ['thunder-punch','thunder-punch-fist','fist',18,30,.115,0,'hand'],
    ]){
      let observed
      const length=Math.min(max,Math.max(min,source.metrics.height/unit*factor)),timing=EFFECT_TIMINGS[moveId]
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:()=>{
        const art=h.scene.effects.getChildByLabel(label,true)
        observed={socket:source.anchor(mode==='custom'?socket:fallback),base:h.scene.effects.toLocal({x:0,y:0},art),tip:h.scene.effects.toLocal({x:length,y:0},art)}
        if(moveId==='peck')for(const jaw of art.children)assert.equal(jaw.rotation,0,'jaws closed at contact')
      }})
      await tick();h.timeline.time(timing.contact,false)
      assert.ok(observed,moveId+' contact cue delivered')
      const focus=target.base('center')
      assert.ok(Math.hypot(observed.tip.x-focus.x,observed.tip.y-focus.y-dy*unit)<.02,moveId+' tip contacts target before cue')
      assert.ok(Math.hypot(observed.base.x-observed.socket.x,observed.base.y-observed.socket.y)<.02,moveId+' art attached to chosen socket')
      assert.equal(source.pose.alpha,1);assert.equal(target.pose.alpha,1)
      h.scene.fit(320,480)
      const art=h.scene.effects.getChildByLabel(label,true),resized=h.scene.effects.toLocal({x:length,y:0},art)
      assert.ok(Math.hypot(resized.x-observed.tip.x,resized.y-observed.tip.y)<.02,moveId+' contact preserved after fit')
      h.timeline.time(timing.duration-.02,false)
      assert.ok(Math.hypot(source.pose.x,source.pose.y)<.001);assert.equal(source.pose.rotation,0)
      assert.equal(source.pose.scale.x,1);assert.equal(source.pose.scale.y,1)
      h.timeline.time(timing.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('Shadow Punch leaves the user visible and sends its spectral knuckle from supplied sockets to the posed target',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall'])for(const custom of [false,true]){
    const h=harness({scene:{width:720,height:600,actors:[
      {id:'source',profile,x:reversed?.76:.24,y:.82,height:.33,facing:reversed?-1:1,...(custom?{anchors:{fist:[.79,.39],origin:[.46,.93]}}:{})},
      {id:'target',profile:'venusaur',x:reversed?.26:.74,y:.64,height:.24,facing:reversed?1:-1,anchors:{center:[.48,.43]}},
    ]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target'),unit=Math.min(h.scene.unit*1.25,Math.max(h.scene.unit*.6,target.metrics.height/168.90625))
    const r=Math.min(33,Math.max(20,source.metrics.height/unit*.125)),socket=custom?'fist':'hand';let arrival
    const run=h.fx.play({moveId:'shadow-punch',sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:()=>{
      const fist=h.scene.effects.getChildByLabel('shadow-punch-fist',true)
      arrival={tip:h.scene.effects.toLocal({x:r,y:0},fist),target:target.anchor('center')}
    }})
    await tick();h.timeline.time(.32,false)
    const fist=h.scene.effects.getChildByLabel('shadow-punch-fist',true),start=h.scene.effects.toLocal({x:0,y:0},fist),hand=source.anchor(socket)
    assert.ok(Math.hypot(start.x-hand.x,start.y-hand.y)<.02,'spectral fist launches from live socket')
    h.timeline.time(.58,false)
    const ghosts=h.scene.effects.getChildrenByLabel('shadow-punch-afterimage',true)
    assert.equal(ghosts.filter(g=>g.alpha>0).length,3,'three distinct delayed fists during approach')
    h.timeline.time(.74,false);assert.ok(arrival)
    assert.ok(Math.hypot(arrival.tip.x-arrival.target.x,arrival.tip.y-arrival.target.y)<.02,'front knuckle arrives before cue')
    h.timeline.time(.85,false)
    const posed=h.scene.effects.toLocal({x:r,y:0},fist),center=target.anchor('center')
    assert.ok(Math.hypot(posed.x-center.x,posed.y-center.y)<.02,'spectral fist follows recoil while fading')
    assert.equal(source.pose.x,0);assert.equal(source.pose.y,0);assert.equal(source.pose.alpha,1);assert.equal(source.pose.scale.x,1)
    h.timeline.time(EFFECT_TIMINGS['shadow-punch'].duration,false);assert.equal((await run.finished).status,'completed');h.clean();h.dispose()
  }
  gsap.ticker.sleep()
})
test('elemental and shadow punches bound recoil and actor silhouettes in custom edge layouts',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness({scene:{width:720,height:600,actors:[
      {id:'source',profile,x:reversed?.68:.32,y:.8,height:.3,facing:reversed?-1:1,anchors:{origin:[.46,.93],fist:[.84,.48]}},
      {id:'target',profile:'wide',x:reversed?(144*150/70/2+1)/720:1-(144*150/70/2+1)/720,y:.68,height:.24,facing:reversed?1:-1},
    ]}})
    for(const moveId of ['fire-punch','thunder-punch','shadow-punch']){
      const timing=EFFECT_TIMINGS[moveId],run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick()
      for(let t=.02;t<timing.duration;t+=.02){
        h.timeline.time(t,false)
        for(const a of h.scene.actors.values()){
          const center=a.anchor('visualCenter'),c=Math.abs(Math.cos(a.pose.rotation)),s=Math.abs(Math.sin(a.pose.rotation))
          const rx=(a.metrics.width*c+a.metrics.height*s)/2,ry=(a.metrics.height*c+a.metrics.width*s)/2
          assert.ok(center.x-rx>=-.03&&center.x+rx<=720.03&&center.y-ry>=-.03&&center.y+ry<=600.03,`${moveId} ${a.id} at ${t}: ${center.x-rx},${center.x+rx},${center.y-ry},${center.y+ry}`)
          assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1)
        }
      }
      h.timeline.time(timing.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('drain energy travels from opponent to source aura and arrives before recovery cues',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness({scene:{width:720,height:600,actors:[
      {id:'source',profile,x:reversed?.77:.23,y:.8,height:.3,facing:reversed?-1:1,anchors:{aura:[.44,.35],emission:[.94,.27]}},
      {id:'target',profile:'venusaur',x:reversed?.25:.75,y:.62,height:.25,facing:reversed?1:-1},
    ]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target')
    for(const [moveId,label,launch] of [['absorb','absorb-mote-0',.4],['mega-drain','mega-drain-bead-0',.52],['giga-drain','giga-drain-leaf-0',.68],['leech-life','leech-life-mote-0',.7]]){
      const timing=EFFECT_TIMINGS[moveId],cues=[];let arrival
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:c=>{
        cues.push(c.type)
        if(c.type==='recovery')arrival=h.scene.effects.toLocal({x:0,y:0},h.scene.effects.getChildByLabel(label,true))
      }})
      await tick();h.timeline.time(launch,false)
      const particle=h.scene.effects.getChildByLabel(label,true),start=h.scene.effects.toLocal({x:0,y:0},particle),from=target.anchor('center')
      assert.ok(Math.hypot(start.x-from.x,start.y-from.y)<.02,moveId+' starts at target')
      h.timeline.time(timing.recovery-.01,false);assert.deepEqual(cues,['impact'])
      h.timeline.time(timing.recovery,false);assert.deepEqual(cues,['impact','recovery'])
      const to=source.anchor('aura');assert.ok(Math.hypot(arrival.x-to.x,arrival.y-to.y)<.02,moveId+' arrives at posed aura before cue')
      assert.equal(source.pose.alpha,1);assert.equal(target.pose.alpha,1)
      h.timeline.time(timing.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('vortices stay anchored, keep flowing and preserve sprite visibility through recovery',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness({scene:{width:720,height:600,actors:[
      {id:'source',profile:'tall',x:reversed?.77:.23,y:.8,height:.3,facing:reversed?-1:1},
      {id:'target',profile,x:reversed?.25:.75,y:.67,height:profile==='wide'?.22:.36,facing:reversed?1:-1},
    ]}})
    const target=h.scene.actor('target')
    for(const [moveId,label,anchor] of [['whirlpool','whirlpool-vortex','floor'],['fire-spin','fire-spin-coil','floor'],['sand-tomb','sand-tomb-pit','floor'],['whirlwind','whirlwind-funnel','center']]){
      const timing=EFFECT_TIMINGS[moveId];let arrival
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:()=>{arrival=h.scene.effects.toLocal({x:0,y:0},h.scene.effects.getChildByLabel(label,true))}})
      await tick();h.timeline.time(timing.contact,false)
      const expected=target.base(anchor)
      assert.ok(Math.hypot(arrival.x-expected.x,arrival.y-expected.y)<.02,moveId+' anchor set before cue')
      const art=h.scene.effects.getChildByLabel(label,true),particle=art.children[1]
      h.timeline.time(1.15,false);const first={x:particle.x,y:particle.y}
      h.timeline.time(1.28,false);assert.ok(Math.hypot(particle.x-first.x,particle.y-first.y)>1,moveId+' continuously moving particles')
      if(moveId==='whirlwind'){
        const p=h.scene.effects.toLocal({x:0,y:0},art),c=target.anchor('center')
        assert.ok(Math.hypot(p.x-c.x,p.y-c.y)<.02,'wind follows displaced target')
      }
      for(const actor of h.scene.actors.values()){assert.equal(actor.pose.alpha,1);assert.equal(actor.pose.scale.x,1);assert.equal(actor.pose.scale.y,1)}
      h.timeline.time(timing.duration-.02,false)
      for(const actor of h.scene.actors.values()){assert.ok(Math.hypot(actor.pose.x,actor.pose.y)<.001);assert.equal(actor.pose.rotation,0)}
      h.timeline.time(timing.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('Whirlwind caps lift and lean for tall actors near the upper viewport corners',async()=>{
  for(const reversed of [false,true]){
    const h=harness({scene:{width:660,height:700,actors:[
      {id:'source',profile:'wide',x:reversed?.77:.23,y:.8,height:.2,facing:reversed?-1:1},
      {id:'target',profile:'tall',x:reversed?.09:.91,y:.37,height:.36,facing:reversed?1:-1},
    ]}})
    const target=h.scene.actor('target'),run=h.fx.play({moveId:'whirlwind',sourceId:'source',targetIds:['target']},{scene:h.scene})
    await tick()
    for(let time=.02;time<2.25;time+=.02){
      h.timeline.time(time,false);const b=target.root.getBounds()
      assert.ok(b.x>=-.02&&b.x+b.width<=660.02&&b.y>=-.02&&b.y+b.height<=700.02,'visible actor stays inside viewport')
    }
    h.timeline.time(2.25,false);assert.equal((await run.finished).status,'completed');h.clean();h.dispose()
  }
  gsap.ticker.sleep()
})
test('flame and elemental projectiles launch at supplied sockets and converge before impact cues',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness({scene:{width:660,height:700,actors:[
      {id:'source',profile,x:reversed?.77:.23,y:.78,height:profile==='wide'?.2:.36,facing:reversed?-1:1,anchors:{emission:[.93,.27],origin:[.42,.9]}},
      {id:'target',profile:'venusaur',x:reversed?.25:.75,y:.59,height:.23,facing:reversed?1:-1},
    ]}})
    for(const [moveId,labels,launch] of [
      ['ember',['ember-flame-0'],.26],['dragon-rage',['dragon-rage-flare'],.46],
      ['will-o-wisp',['will-o-wisp-flame-0'],.28],['tri-attack',['tri-attack-orb-0','tri-attack-orb-1','tri-attack-orb-2'],.48],
    ]){
      const positions=()=>labels.map(label=>h.scene.effects.toLocal({x:0,y:0},h.scene.effects.getChildByLabel(label,true)))
      const contacts=[],timing=EFFECT_TIMINGS[moveId],run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:()=>contacts.push(positions())})
      await tick()
      if(moveId==='tri-attack'){
        h.timeline.time(.4799,false);const before=positions()
        h.timeline.time(.4801,false);const after=positions()
        assert.ok(before.every((p,i)=>Math.hypot(p.x-after[i].x,p.y-after[i].y)<1),'Tri Attack charge joins flight without a jump')
      }
      h.timeline.time(launch,false)
      const launched=positions(),center=launched.reduce((p,q)=>({x:p.x+q.x/launched.length,y:p.y+q.y/launched.length}),{x:0,y:0}),socket=h.scene.actor('source').anchor('emission')
      assert.ok(Math.hypot(center.x-socket.x,center.y-socket.y)<.02,moveId+' launch uses posed emission')
      h.timeline.time(timing.contact-.01,false);assert.equal(contacts.length,0)
      h.timeline.time(timing.contact,false);assert.equal(contacts.length,1)
      const target=h.scene.actor('target').base('center')
      for(const point of contacts[0])assert.ok(Math.hypot(point.x-target.x,point.y-target.y)<.02,moveId+' arrival before cue')
      h.timeline.time(timing.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('Air Cutter releases at the posed socket and its leading edge reaches the target before its cue',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall'])for(const custom of [false,true]){
    const h=harness({scene:{width:660,height:700,actors:[
      {id:'source',profile,x:reversed?.77:.23,y:.78,height:profile==='wide'?.2:.36,facing:reversed?-1:1,...(custom?{anchors:{wing:[.92,.27]}}:{})},
      {id:'target',profile:'venusaur',x:reversed?.25:.75,y:.59,height:.23,facing:reversed?1:-1},
    ]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target'),cues=[]
    const run=h.fx.play({moveId:'air-cutter',sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:()=>{
      const art=h.scene.effects.getChildByLabel('air-cutter-crescent-0',true)
      cues.push(h.scene.effects.toLocal({x:0,y:0},art))
    }})
    await tick()
    for(const [index,time] of [[0,.32],[1,.4]]){
      h.timeline.time(time,false)
      const art=h.scene.effects.getChildByLabel('air-cutter-crescent-'+index,true),p=h.scene.effects.toLocal({x:0,y:0},art),socket=source.anchor(custom?'wing':'emission')
      assert.ok(Math.hypot(p.x-socket.x,p.y-socket.y)<.02,'launch from posed socket')
    }
    h.timeline.time(.81,false);assert.equal(cues.length,0)
    h.timeline.time(.82,false);assert.equal(cues.length,1)
    const center=target.base('center')
    assert.ok(Math.hypot(cues[0].x-center.x,cues[0].y-center.y)<.02,'leading edge contacts before cue')
    assert.ok(Math.abs(source.pose.x)<10*h.scene.unit,'ranged source stays near home')
    h.timeline.time(1.68,false);assert.equal(source.pose.x,0);assert.equal(source.pose.rotation,0)
    h.timeline.time(1.7,false);assert.equal((await run.finished).status,'completed');h.clean();h.dispose()
  }
  gsap.ticker.sleep()
})
test('chops and smashes attach hand artwork before contact cues and recover before completion',async()=>{
  for(const reversed of [false,true])for(const profile of ['charizard','wide','tall']){
    const h=harness({scene:{width:720,height:600,actors:[{id:'source',profile,x:reversed?.75:.25,y:.8,height:.34,facing:reversed?-1:1},{id:'target',profile:'venusaur',x:reversed?.25:.75,y:.6,height:.23,facing:reversed?1:-1}]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target')
    const unit=Math.min(h.scene.unit*1.25,Math.max(h.scene.unit*.6,target.metrics.height/168.90625))
    for(const [moveId,label,dy] of [['karate-chop','karate-chop-hand',6],['brick-break','brick-break-hand',6],['cross-chop','cross-chop-hands',6],['rock-smash','rock-smash-hand',12]]){
      let observed
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene,onCue:()=>{
        const mark=h.scene.effects.getChildByLabel(label,true)
        observed={hand:source.anchor('hand'),art:h.scene.effects.toLocal({x:0,y:0},mark)}
      }})
      await tick();h.timeline.time(EFFECT_TIMINGS[moveId].contact,false)
      const focus=target.base('center')
      assert.ok(Math.hypot(observed.hand.x-focus.x,observed.hand.y-focus.y-dy*unit)<.02,moveId+' contact before cue')
      assert.ok(Math.hypot(observed.art.x-observed.hand.x,observed.art.y-observed.hand.y)<.02,moveId+' attached art before cue')
      assert.equal(source.pose.alpha,1);assert.equal(target.pose.alpha,1)
      h.timeline.time(EFFECT_TIMINGS[moveId].duration-.02,false)
      assert.ok(Math.hypot(source.pose.x,source.pose.y)<.001);assert.equal(source.pose.rotation,0)
      h.timeline.time(EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('spinning moves keep effects centered on tucked actors, reach contact before cues, and fully recover',async()=>{
  for(const reversed of [false,true])for(const profile of ['charizard','tall','wide']){
    const h=harness({scene:{width:720,height:600,actors:[{id:'source',profile,x:reversed?.75:.25,y:.82,height:profile==='wide'?.24:.38,facing:reversed?-1:1},{id:'target',profile:'venusaur',x:reversed?.25:.75,y:.61,height:.26,facing:reversed?1:-1}]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target'),sign=reversed?-1:1
    const unit=Math.min(h.scene.unit*1.25,Math.max(h.scene.unit*.6,target.metrics.height/168.90625))
    for(const [moveId,label,min,max,factor,reach] of [['rapid-spin','rapid-spin-wind',0,0,0,0],['rollout','rollout-shell',27,62,.27,.84],['ice-ball','ice-ball-shell',28,63,.28,.86],['flame-wheel','flame-wheel-ring',29,65,.3,.8]]){
      let contact
      const timing=EFFECT_TIMINGS[moveId],run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:()=>{contact=source.anchor(moveId==='rapid-spin'?'tackle':'visualCenter')}})
      await tick();h.timeline.time(timing.contact*.7,false)
      const shell=h.scene.effects.getChildByLabel(label,true),p=h.scene.effects.toLocal({x:0,y:0},shell),c=source.anchor('visualCenter')
      assert.ok(Math.hypot(p.x-c.x,p.y-c.y)<.01,moveId+' rotates about visible center')
      assert.equal(source.pose.alpha,1,moveId+' source remains visible')
      assert.equal(contact,undefined,moveId+' no premature cue')
      h.timeline.time(timing.contact,false)
      assert.ok(contact,moveId+' cue received')
      const r=Math.min(max,Math.max(min,source.metrics.height/unit*factor)),focus=target.base('center'),floor=target.base('floor')
      const expectedY=moveId==='rollout'?floor.y-r*.95*unit:moveId==='ice-ball'?floor.y-r*unit:focus.y+8*unit
      assert.ok(Math.abs(contact.x+r*reach*unit*sign-focus.x)<.02,moveId+' front reaches opponent at cue')
      assert.ok(Math.abs(contact.y-expectedY)<.02,moveId+' contact height at cue')
      h.timeline.time(timing.duration-.02,false)
      assert.ok(Math.hypot(source.pose.x,source.pose.y)<.001,moveId+' home before teardown')
      assert.equal(source.pose.scale.x,1);assert.equal(source.pose.scale.y,1);assert.equal(source.pose.rotation,0)
      h.timeline.time(timing.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('self recovery and focus effects follow posed users, preserve opponents and run without any opponent',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall'])for(const reducedMotion of [false,true]){
    const h=harness({scene:{width:560,height:700,actors:[{id:'source',profile,x:reversed?.75:.25,y:.8,height:.3,facing:reversed?-1:1},{id:'target',profile:'venusaur',x:reversed?.25:.75,y:.5,height:.23,facing:reversed?1:-1}]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target')
    for(const moveId of ['refresh','heal-bell','aromatherapy','rest','meditate','calm-mind','amnesia','focus-energy','bulk-up','howl','swords-dance','dragon-dance','agility','double-team','minimize','acid-armor'])for(const targetIds of [undefined,['source'],['target']]){
      target.pose.x=9;target.pose.alpha=.8;let atCue
      const run=h.fx.play({moveId,sourceId:'source',targetIds},{scene:h.scene,reducedMotion,onCue:()=>{
        const art=reducedMotion?h.scene.effects.children[0].children[0]:h.scene.effects.getChildByLabel(moveId+'-aura',true)
        atCue={point:h.scene.effects.toLocal({x:0,y:0},art),anchor:source.anchor('center')}
      }})
      await tick();h.timeline.time(reducedMotion?.2:EFFECT_TIMINGS[moveId].contact,false)
      assert.ok(atCue);assert.ok(Math.hypot(atCue.point.x-atCue.anchor.x,atCue.point.y-atCue.anchor.y)<.02,moveId+' follows user before activation')
      assert.equal(source.pose.alpha,1);assert.equal(target.pose.x,9);assert.equal(target.pose.alpha,.8)
      h.timeline.time(reducedMotion?.8:EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed')
      assert.equal(target.pose.x,9);assert.equal(target.pose.alpha,.8);target.resetPose();h.clean()
    }
    h.dispose()
  }
  const h=harness({scene:{actors:[{id:'source',profile:'wide',x:.5,y:.8,height:.3,facing:1}]}})
  for(const moveId of ['refresh','heal-bell','aromatherapy','rest','meditate','calm-mind','amnesia','focus-energy','bulk-up','howl','swords-dance','dragon-dance','agility','double-team','minimize','acid-armor']){
    const run=h.fx.play({moveId,sourceId:'source'},{scene:h.scene});await tick();h.timeline.time(EFFECT_TIMINGS[moveId].duration,false)
    assert.equal((await run.finished).status,'completed');h.clean()
    const failed=h.fx.play({moveId,sourceId:'source',outcome:'failed'},{scene:h.scene});assert.equal((await failed.finished).status,'skipped');h.clean()
  }
  h.dispose();gsap.ticker.sleep()
})
test('Minimize and Acid Armor retain the supplied floor while scaling and restore the full visible actor',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness({scene:{width:560,height:700,actors:[{id:'source',profile,x:.5,y:.8,height:.3,facing:reversed?-1:1,anchors:{origin:[.27,.62],floor:[.58,.95]}}]}})
    const actor=h.scene.actor('source'),floor=actor.base('floor')
    for(const moveId of ['minimize','acid-armor']){
      const run=h.fx.play({moveId,sourceId:'source'},{scene:h.scene});await tick();h.timeline.time(EFFECT_TIMINGS[moveId].contact,false)
      const at=actor.anchor('floor');assert.ok(Math.hypot(at.x-floor.x,at.y-floor.y)<.02,moveId+' floor preserved with custom pivot')
      assert.equal(actor.pose.alpha,1);assert.ok(actor.pose.scale.x>=.42);assert.ok(actor.pose.scale.y>=.42)
      assert.ok(Math.abs(actor.pose.scale.y-(moveId==='minimize'?.42:.83))<.001,moveId+' visible intended scale')
      h.timeline.time(EFFECT_TIMINGS[moveId].duration-.02,false)
      assert.equal(actor.pose.scale.x,1);assert.equal(actor.pose.scale.y,1);assert.equal(actor.pose.x,0);assert.equal(actor.pose.y,0)
      h.timeline.time(EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('Double Team separates four actor copies with matching dimensions and supports missing snapshot providers',async()=>{
  for(const reversed of [false,true])for(const snapshot of [true,false]){
    const h=harness({scene:{width:560,height:700,actors:[{id:'source',profile:'wide',x:.5,y:.8,height:.2,facing:reversed?-1:1,anchors:{origin:[.27,.62]}}]}})
    const actor=h.scene.actor('source');if(!snapshot)delete actor.snapshot
    const run=h.fx.play({moveId:'double-team',sourceId:'source'},{scene:h.scene});await tick();h.timeline.time(.85,false)
    const positions=[]
    for(let i=0;i<4;i++){
      const echo=h.scene.effects.getChildByLabel('double-team-echo-'+i,true);assert.ok(echo.children.length);assert.ok(echo.alpha>0&&echo.alpha<.3)
      const bounds=echo.getBounds();positions.push(bounds.x+bounds.width/2)
      if(snapshot){assert.ok(Math.abs(bounds.width-actor.metrics.width)<.02);assert.ok(Math.abs(bounds.height-actor.metrics.height)<.02)}
    }
    assert.equal(new Set(positions.map(x=>x.toFixed(2))).size,4,'four separated copies');assert.equal(actor.pose.alpha,1)
    h.timeline.time(2,false);assert.equal((await run.finished).status,'completed');h.clean();h.dispose()
  }
  gsap.ticker.sleep()
})
test('Howl originates at the posed mouth and Dragon Dance rotates around visible centers across proportions',async()=>{
  for(const reversed of [false,true])for(const profile of ['wide','tall']){
    const h=harness({scene:{width:560,height:700,actors:[{id:'source',profile,x:.5,y:.8,height:.3,facing:reversed?-1:1,anchors:{emission:[.96,.21]} }]}})
    const source=h.scene.actor('source'),base=source.base('center')
    const unit=Math.min(h.scene.unit*1.25,Math.max(h.scene.unit*.6,source.metrics.height/168.90625))
    for(const moveId of ['howl','dragon-dance']){
      const run=h.fx.play({moveId,sourceId:'source'},{scene:h.scene});await tick()
      for(const time of [.5,.92,1.5]){
        h.timeline.time(time,false)
        if(moveId==='howl'){
          const art=h.scene.effects.getChildByLabel('howl-emission',true),from=h.scene.effects.toLocal({x:0,y:0},art),mouth=source.anchor('emission')
          assert.ok(Math.hypot(from.x-mouth.x,from.y-mouth.y)<.02,'sound follows custom mouth socket')
        }else{
          const center=source.anchor('center')
          assert.ok(Math.abs(center.x-base.x)<=10*unit+.01,'dance center has bounded horizontal steps')
          assert.ok(Math.abs(center.y-base.y)<=5*unit+.01,'dance center has bounded vertical steps')
        }
        assert.equal(source.pose.alpha,1);assert.equal(source.pose.scale.x,1);assert.equal(source.pose.scale.y,1)
      }
      h.timeline.time(EFFECT_TIMINGS[moveId].duration-.02,false)
      assert.equal(source.pose.x,0);assert.equal(source.pose.y,0);assert.equal(source.pose.rotation,0)
      h.timeline.time(EFFECT_TIMINGS[moveId].duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('self shields use their source in both motion modes regardless of requested opponent, facing or size',async()=>{
  for(const reversed of [false,true])for(const profile of ['tall','wide']){
    const h=harness({scene:{width:560,height:700,actors:[{id:'source',profile,x:reversed?.75:.25,y:.8,height:profile==='tall'?.32:.2,facing:reversed?-1:1},{id:'target',profile:'venusaur',x:reversed?.25:.75,y:.58,height:.3,facing:reversed?1:-1}]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target'),reset=source.resetPose
    for(const reducedMotion of [false,true])for(const moveId of ['barrier','protect','light-screen','reflect'])for(const targetIds of [undefined,['target'],['source']]){
      let resets=0;source.resetPose=()=>{resets++;reset()}
      target.pose.x=7;target.pose.alpha=.83
      const cues=[],run=h.fx.play({moveId,sourceId:'source',targetIds,visualSeed:42},{scene:h.scene,reducedMotion,onCue:c=>cues.push(c)})
      await tick();h.timeline.time(reducedMotion?.2:EFFECT_TIMINGS[moveId].contact,false)
      assert.equal(cues.length,1,moveId+' activation')
      const visual=reducedMotion?h.scene.effects.children[0].children[0]:h.scene.effects.getChildByLabel(moveId+'-shield',true)
      assert.ok(visual,moveId+' shield rendered')
      const center=h.scene.effects.toLocal({x:0,y:0},visual),anchor=source.anchor('center')
      assert.ok(Math.abs(center.x-anchor.x)<source.metrics.width*.35,moveId+' near source')
      assert.ok(Math.abs(center.y-anchor.y)<.01,moveId+' source height')
      if(!reducedMotion){
        assert.ok((center.x-anchor.x)*(reversed?-1:1)>=-.01,moveId+' faces forward')
        const bounds=visual.getBounds()
        assert.ok(bounds.width<source.metrics.width*1.55+32*h.scene.unit,moveId+' bounded width')
        assert.ok(bounds.height<source.metrics.height*1.35+32*h.scene.unit,moveId+' bounded height')
      }
      run.cancel();assert.equal((await run.finished).status,'cancelled');assert.equal(resets,1)
      assert.equal(target.pose.x,7);assert.equal(target.pose.alpha,.83)
      target.resetPose();h.clean()
    }
    source.resetPose=reset
    const invalid=h.fx.play({moveId:'slash',sourceId:'source',targetIds:['source']},{scene:h.scene})
    assert.equal((await invalid.finished).status,'skipped')
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('sprite-independent contact, reversed direction, scale and camera resize preserve anchors',async()=>{
  for(const reversed of [false,true])for(const [sourceProfile,targetProfile] of [['tall','wide'],['venusaur','charizard']]){
    const h=harness({scene:{width:720,height:600,actors:[{id:'source',profile:sourceProfile,x:reversed?.75:.25,y:.8,height:.35,facing:reversed?-1:1},{id:'target',profile:targetProfile,x:reversed?.25:.75,y:.62,height:.2,facing:reversed?1:-1}]}})
    for(const [moveId,socket,dx,dy] of [['bite','emission',0,6],['crunch','emission',0,6],['hyper-fang','emission',0,6],['poison-fang','emission',0,6],['quick-attack','tackle',0,8],['mach-punch','hand',0,8],['body-slam','slam',0,8],['ice-punch','hand',-3.80586277568716,5.163820637595279],['blaze-kick','foot',-7.7301705491141774,24.335918897456907]]){
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick()
      h.timeline.time(EFFECT_TIMINGS[moveId].contact,false)
      const from=h.scene.actor('source').anchor(socket),to=h.scene.actor('target').anchor('center')
      const u=Math.min(h.scene.unit*1.25,Math.max(h.scene.unit*.6,h.scene.actor('target').metrics.height/168.90625)),sign=reversed?-1:1
      assert.ok(Math.hypot(from.x-to.x-dx*u*sign,from.y-to.y-dy*u)<.02,moveId+' authored contact offset')
      h.scene.fit(320,480);const resized=h.scene.actor('source').anchor(socket)
      assert.ok(Math.hypot(from.x-resized.x,from.y-resized.y)<.001,'resize only changes camera')
      run.cancel();await run.finished;h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
test('missing assets, unsupported moves, builder errors and update errors settle and restore the scene',async()=>{
  for(const config of [{assetLoader:()=>Promise.reject(Error('asset missing'))},{effects:{surf:{duration:1,build(){throw Error('builder')}}}},{effects:{surf:{duration:1,build(c){c.tl.to({x:0},{x:1,duration:.2,onUpdate(){throw Error('update')}})}}}}]){
    const h=harness({fx:config});const run=h.fx.play({moveId:'surf',sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.timeline?.time(.2,false)
    assert.equal((await run.finished).status,'failed');h.clean();h.dispose()
  }
  const h=harness();const missing=h.fx.play({moveId:'future-move',sourceId:'source',targetIds:['target']},{scene:h.scene});assert.equal((await missing.finished).status,'skipped');h.dispose();gsap.ticker.sleep()
})
test('actor sockets honor padding, mirroring and nested transforms',()=>{
  const layer=new Container(),effects=new Container(),parent=new Container();parent.addChild(layer,effects);parent.scale.set(.7);parent.rotation=.3
  const actor=createActor({id:'fixture',texture:texture(200,200),bounds:{x:40,y:20,width:80,height:100},anchors:{hand:[1,.5]},height:100,position:{x:100,y:200},facing:-1,layer,effectSpace:effects})
  const initial=actor.anchor('hand');assert.ok(Math.hypot(initial.x-60,initial.y-150)<.001)
  actor.pose.rotation=Math.PI/2
  const p=actor.anchor('hand');assert.ok(Math.hypot(p.x-150,p.y-160)<.001)
  actor.destroy();parent.destroy({children:true})
})

test('attachments update after motion on the contact frame, and charge rings move and contract',async()=>{
  const h=harness()
  const run=h.fx.play({moveId:'mach-punch',sourceId:'source',targetIds:['target']},{scene:h.scene});await tick()
  for(let t=1/60;t<.38;t+=1/60)h.timeline.time(t,false)
  h.timeline.time(.38,false)
  const cuff=h.scene.effects.getChildByLabel('mach-punch-cuff',true),hand=h.scene.actor('source').anchor('hand')
  assert.ok(Math.hypot(h.scene.effects.toLocal({x:0,y:0},cuff).x-hand.x,h.scene.effects.toLocal({x:0,y:0},cuff).y-hand.y)<.01)
  run.cancel();await run.finished
  const solar=h.fx.play({moveId:'solar-beam',sourceId:'source',targetIds:['target']},{scene:h.scene});await tick()
  h.timeline.time(.6,false)
  const ring=h.scene.effects.getChildByLabel('solar-charge-ring',true),mouth=h.scene.actor('source').anchor('emission')
  assert.ok(ring.scale.x>.5&&ring.scale.x<1.45);assert.ok(Math.hypot(h.scene.effects.toLocal({x:0,y:0},ring).x-mouth.x,h.scene.effects.toLocal({x:0,y:0},ring).y-mouth.y)<.01)
  solar.cancel();await solar.finished;h.dispose();gsap.ticker.sleep()
})
test('abort during asset loading and cleanup exceptions both settle; late assets create no objects',async()=>{
  let late
  const h=harness({fx:{assetLoader:()=>new Promise(r=>{late=r})}})
  const controller=new AbortController(),run=h.fx.play({moveId:'surf',sourceId:'source',targetIds:['target']},{scene:h.scene,signal:controller.signal})
  await tick();controller.abort();assert.equal((await run.finished).status,'cancelled');late(texture(1774,887));await tick();h.clean();h.dispose()
  const broken=harness();const actor=broken.scene.actor('source'),reset=actor.resetPose;actor.resetPose=()=>{throw Error('adapter cleanup')}
  const attempt=broken.fx.play({moveId:'slash',sourceId:'source',targetIds:['target']},{scene:broken.scene});await tick();attempt.cancel()
  assert.equal((await attempt.finished).status,'failed');assert.equal(broken.scene.effects.children.length,0)
  actor.resetPose=reset;actor.resetPose();broken.dispose();gsap.ticker.sleep()
})

test('throws keep actor silhouettes in view, use supplied sockets and land before their impact cues',async()=>{
  for(const reversed of [false,true])for(const edge of [false,true])for(const profile of ['wide','tall']){
    const h=harness({scene:{width:900,height:700,actors:[
      {id:'source',profile,x:reversed?.71:.29,y:.8,height:edge?.3:.27,facing:reversed?-1:1,anchors:{origin:[.42,.91],hand:[.82,.62],fist:[.84,.58]}},
      {id:'target',profile:edge?'tall':profile,x:reversed?.29:.71,y:edge?.32:.59,height:.3,facing:reversed?1:-1,anchors:{origin:[.45,.94],center:[.57,.59]}},
    ]}})
    const source=h.scene.actor('source'),target=h.scene.actor('target'),unit=Math.min(h.scene.unit*1.25,Math.max(h.scene.unit*.6,target.metrics.height/168.90625))
    const assertBounds=actor=>{
      const c=actor.anchor('visualCenter'),a=actor.pose.rotation,w=actor.metrics.width,v=actor.metrics.height
      const rx=(w*Math.abs(Math.cos(a))+v*Math.abs(Math.sin(a)))/2,ry=(v*Math.abs(Math.cos(a))+w*Math.abs(Math.sin(a)))/2
      assert.ok(c.x-rx>=-.02&&c.x+rx<=h.scene.width+.02&&c.y-ry>=-.02&&c.y+ry<=h.scene.height+.02,`${actor.id} visible bounds at ${h.timeline.time()}: ${c.x-rx},${c.y-ry},${c.x+rx},${c.y+ry}`)
      assert.equal(actor.pose.alpha,1);assert.equal(actor.pose.scale.x,1);assert.equal(actor.pose.scale.y,1)
    }
    for(const [moveId,grab] of [['vital-throw',.42],['submission',.48],['sky-uppercut',null],['seismic-toss',.46]]){
      const timing=EFFECT_TIMINGS[moveId];let observed
      const run=h.fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:()=>{
        observed={center:target.anchor('visualCenter'),rotation:target.pose.rotation}
        if(moveId==='sky-uppercut'){
          const fist=h.scene.effects.getChildByLabel('sky-uppercut-fist',true),r=Math.min(31,Math.max(18,source.metrics.height/unit*.12)),impact=h.scene.effects.getChildByLabel('sky-uppercut-impact',true)
          const tip=h.scene.effects.toLocal({x:0,y:-r},fist),point=h.scene.effects.toLocal({x:0,y:0},impact)
          assert.ok(Math.hypot(tip.x-point.x,tip.y-point.y)<.02,'front knuckle meets impact before cue')
        }
      }})
      await tick()
      if(grab){
        h.timeline.time(grab,false)
        if(!edge){const a=source.anchor('hand'),b=target.anchor('center');assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.02,moveId+' initial grab')}
        if(moveId==='submission'&&!edge){h.timeline.time(.8,false);const a=source.anchor('hand'),b=target.anchor('center');assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.02,'grapple follows posed center')}
      }
      for(let t=h.timeline.time();t<timing.contact;t+=.02){h.timeline.time(t,false);assertBounds(source);assertBounds(target)}
      h.timeline.time(timing.contact,false);assert.ok(observed,moveId+' impact cue')
      if(moveId!=='sky-uppercut'){const base=target.base('visualCenter');assert.ok(Math.hypot(observed.center.x-base.x,observed.center.y-base.y)<.02,moveId+' lands before cue');assert.ok(Math.abs(observed.rotation)<.001)}
      h.scene.fit(320,480)
      for(let t=timing.contact;t<timing.duration;t+=.02){h.timeline.time(t,false);assertBounds(source);assertBounds(target)}
      h.timeline.time(timing.duration-.01,false)
      for(const actor of [source,target]){assert.ok(Math.hypot(actor.pose.x,actor.pose.y)<.01,moveId+' recovery before completion');assert.ok(Math.abs(actor.pose.rotation)<.001)}
      h.timeline.time(timing.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }
    h.dispose()
  }
  gsap.ticker.sleep()
})
