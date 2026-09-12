import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Texture, TextureSource } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
const fixture=JSON.parse(readFileSync(new URL('./fixtures/original-effects.json',import.meta.url)))
const texture=(width,height)=>new Texture({source:new TextureSource({width,height})})
const tick=()=>new Promise(r=>setImmediate(r))
function shapes(root){
  const out=[]
  function walk(n,alpha=1){
    alpha*=n.alpha;if(alpha<.002)return
    if(['Sprite','TilingSprite','Graphics'].includes(n.constructor.name)){
      const b=n.getBounds()
      if(b.width>0&&b.height>0)out.push({kind:n.constructor.name==='Graphics'?'g':'s',b:[b.x,b.y,b.width,b.height],alpha,tint:n.getGlobalTint()})
    }
    for(const c of n.children??[])walk(c,alpha)
  }walk(root);return out
}
test('31 unchanged restored effects match 93 sampled original visual geometry frames',async()=>{
  assert.equal(fixture.referenceCommit,'ab6d3c42af93b8114a4c3a8d7c205e9ba0cc1fca')
  const art=texture(96,96),glow=texture(64,64),assets={leaf:texture(256,256),rock:texture(256,256),surf:texture(1774,887),waterfall:texture(1024,1536)}
  const scene=createSceneGraph({textures:{charizard:art,venusaur:art}});let tl
  const fx=createBattleFx({glowTexture:glow,assetLoader:key=>assets[key],timelineEngine:{timeline(opts){return tl=gsap.timeline({...opts,paused:true})}}})
  try{
    // Waterfall now crops the image before rendering; its visible coverage and
    // texture sampling are checked separately in waterfall.test.mjs.
    // Hydro Pump was explicitly redesigned; its new geometry is checked in pressure-moves.test.mjs.
    for(const moveId of new Set(fixture.frames.filter(frame=>!['waterfall','hydro-pump'].includes(frame.moveId)).map(frame=>frame.moveId))){
      const run=fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene});await tick();let previous=0
      for(const frame of fixture.frames.filter(f=>f.moveId===moveId)){
        for(let t=previous+1/120;t<=frame.time+1e-8;t+=1/120){tl.time(t,false);previous=t}
        if(previous<frame.time){tl.time(frame.time,false);previous=frame.time}
        const actual=shapes(scene.effects)
        assert.equal(actual.length,frame.shapes.length,`${moveId} object count at ${frame.time}`)
        for(const expected of frame.shapes){
          const i=actual.findIndex(a=>a.kind===expected.kind&&a.tint===expected.tint&&Math.abs(a.alpha-expected.alpha)<.002&&a.b.every((n,j)=>Math.abs(n-expected.b[j])<.03))
          assert.ok(i>=0,`${moveId} geometry/opacity/tint at ${frame.time}: ${JSON.stringify(expected)}`)
          actual.splice(i,1)
        }
      }
      run.cancel();await run.finished
    }
  }finally{fx.dispose();scene.dispose();gsap.ticker.sleep()}
})
test('all effects handle alternate source/target proportions and reversed portrait layouts',async()=>{
  const assets={leaf:texture(256,256),rock:texture(256,256),surf:texture(1774,887),waterfall:texture(1024,1536)}
  for(const reversed of [false,true]){
    const scene=createSceneGraph({width:560,height:700,actors:[{id:'source',profile:'tall',x:reversed?.75:.25,y:.8,height:.2,facing:reversed?-1:1},{id:'target',profile:'wide',x:reversed?.25:.75,y:.58,height:.3,facing:reversed?1:-1}]});let tl
    const fx=createBattleFx({glowTexture:Texture.WHITE,assetLoader:key=>assets[key],timelineEngine:{timeline(opts){return tl=gsap.timeline({...opts,paused:true})}}})
    try{for(const [moveId,timing] of Object.entries(EFFECT_TIMINGS)){
      const run=fx.play({moveId,sourceId:'source',targetIds:['target'],visualSeed:42},{scene});await tick()
      for(let t=.025;t<timing.duration;t+=.025){tl.time(t,false);for(const shape of shapes(scene.effects))assert.ok(shape.b.every(Number.isFinite),moveId+' finite geometry')}
      tl.time(timing.duration,false);assert.equal((await run.finished).status,'completed',moveId);assert.equal(scene.effects.children.length,0)
    }}finally{fx.dispose();scene.dispose();gsap.ticker.sleep()}
  }
})
