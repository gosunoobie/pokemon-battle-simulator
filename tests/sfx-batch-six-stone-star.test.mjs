import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture, buildContextBatches, BigPool } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import ancientPower, { timing as ancientTiming, ROCK_SLIDE_PATH } from '../packages/battle-fx/src/review-batch-six/ancient-power.js'
import meteorMash, { timing as meteorTiming } from '../packages/battle-fx/src/review-batch-six/meteor-mash.js'
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const recipes={'ancient-power':[ancientPower,ancientTiming],'meteor-mash':[meteorMash,meteorTiming]}
const layouts=[undefined,{width:620,height:650,actors:[{id:'source',profile:'wide',x:.29,y:.78,height:.2,facing:1},{id:'target',profile:'tall',x:.8,y:.44,height:.2,facing:-1}]},
  {width:720,height:600,actors:[{id:'source',profile:'wide',x:.22,y:.8,height:.22,facing:1},{id:'target',profile:'tall',x:.94,y:.42,height:.2,facing:-1,anchors:{center:[.9,.05]}}]},
  {width:560,height:700,actors:[{id:'source',profile:'wide',x:.27,y:.8,height:.2,facing:1},{id:'target',profile:'tall',x:.85,y:.24,height:.2,facing:-1,anchors:{center:[.5,.05]}}]}]
function harness(id,side='source',layout=0,original=false){
  let timeline;const scene=createSceneGraph(layouts[layout]),[build,timing]=recipes[id]
  const fx=createBattleFx({effects:{[id]:original?MOVE_EFFECTS[id]:{...MOVE_EFFECTS[id],build,...timing}},glowTexture:Texture.WHITE,assetLoader:async()=>Texture.WHITE,
    timelineEngine:{timeline(options){timeline=gsap.timeline({...options,paused:true});timeline.play=()=>timeline;return timeline}}})
  return {scene,get tl(){return timeline},node:label=>scene.effects.getChildByLabel(label,true),run:options=>fx.play({moveId:id,sourceId:side,targetIds:[side==='source'?'target':'source'],visualSeed:42},{scene,...options}),
    clean(){assert.equal(scene.effects.children.length,0);assert.equal(scene.camera.x,0);assert.equal(scene.camera.y,0);for(const a of scene.actors.values()){assert.equal(a.pose.x,0);assert.equal(a.pose.y,0);assert.equal(a.pose.rotation,0);assert.equal(a.pose.alpha,1);assert.equal(a.pose.scale.x,1);assert.equal(a.pose.scale.y,1);assert.equal(a.pose.tint,0xffffff)}},
    dispose(){fx.dispose();scene.dispose();gsap.ticker.sleep()}}
}
function assertBounds(h,at){
  function walk(node,alpha=1){alpha*=node.alpha;if(alpha>.02&&['Graphics','Sprite'].includes(node.constructor.name)){const b=node.getBounds();assert.ok(b.x>=-.05&&b.y>=-.05&&b.maxX<=h.scene.width+.05&&b.maxY<=h.scene.height+.05,`${node.label||node.parent?.label} at ${at}: ${JSON.stringify(b)}`)}for(const c of node.children??[])walk(c,alpha)}
  walk(h.scene.effects)
  for(const a of h.scene.actors.values()){const p=a.anchor('visualCenter'),c=Math.cos(a.pose.rotation),s=Math.sin(a.pose.rotation),rx=(a.metrics.width*Math.abs(c)+a.metrics.height*Math.abs(s))/2,ry=(a.metrics.height*Math.abs(c)+a.metrics.width*Math.abs(s))/2;assert.ok(p.x-rx>=-.05&&p.x+rx<=h.scene.width+.05&&p.y-ry>=-.05&&p.y+ry<=h.scene.height+.05,`actor ${a.id} at ${at}`)}
}
function renderedFillContains(geometry,point){
  const {vertices,indices}=geometry
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
  for(let i=0;i<indices.length;i+=3){
    const [a,b,c]=indices.slice(i,i+3).map(index=>({x:vertices[index*2],y:vertices[index*2+1]}))
    const signs=[cross(a,b,point),cross(b,c,point),cross(c,a,point)]
    if(signs.every(value=>value>=-1e-7)||signs.every(value=>value<=1e-7))return true
  }
  return false
}
test('Rock Slide artwork keeps both transparent cuts and the detached shard in the rendered triangles',async()=>{
  const h=harness('ancient-power')
  try{const run=h.run();await tick()
    for(let i=0;i<5;i++){
      const gpu={geometryData:{vertices:[],indices:[],uvs:[]},batches:[]}
      try{buildContextBatches(h.node(`ancient-power-rock-slide-art-${i}`).context,gpu)
        for(const [x,y,filled] of [[140,100,false],[250,275,false],[200,100,true],[320,420,true],[180,440,true],[20,20,false]]){
          assert.equal(renderedFillContains(gpu.geometryData,{x,y}),filled,`rock ${i}, SVG point ${x},${y}`)
        }
      }finally{gpu.batches.forEach(batch=>BigPool.return(batch))}
    }
    run.cancel();await run.finished;h.clean()
  }finally{h.dispose()}
})
test('Meteor Mash visible knuckle and cosmic impact meet the live target before the one cue',async()=>{
  for(const side of ['source','target'])for(const layout of [0,1]){
    const h=harness('meteor-mash',side,layout),target=h.scene.actors.get(side==='source'?'target':'source'),cues=[]
    let contact
    const position=node=>h.scene.effects.toLocal({x:0,y:0},node)
    const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.02,`${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
    try{const run=h.run({onCue(cue){
      cues.push(cue.type)
      const fist=h.node('meteor-mash-fist'),points=fist.children[1].context.instructions[0].data.path.shapePath.shapePrimitives[0].shape.points
      const r=Math.max(...points.filter((_,i)=>i%2===0)),knuckle=h.scene.effects.toLocal({x:r,y:0},fist)
      const impact=position(h.node('meteor-mash-impact')),cloud=position(h.node('meteor-mash-cosmic-impact'))
      const center=target.anchor('center'),unit=h.node('move-artwork').scale.y
      contact={knuckle,impact,cloud,aim:{x:center.x,y:center.y+4*unit}}
    }});await tick();h.tl.time(1.10,false);target.pose.x+=10;target.pose.y+=8
      h.tl.time(1.34,false);assert.deepEqual(cues,['impact'])
      close(contact.knuckle,contact.impact,'visible knuckle meets the flash');close(contact.knuckle,contact.cloud,'cosmic cloud shares contact')
      close(contact.knuckle,contact.aim,'knuckle reaches the posed target')
      const center=target.anchor('center'),impact=position(h.node('meteor-mash-impact')),offset={x:impact.x-center.x,y:impact.y-center.y}
      h.tl.time(1.43,false);const live=target.anchor('center')
      close(position(h.node('meteor-mash-impact')),{x:live.x+offset.x,y:live.y+offset.y},'flash follows recoil contact')
      close(position(h.node('meteor-mash-cosmic-impact')),{x:live.x+offset.x,y:live.y+offset.y},'stars follow recoil contact')
      assertBounds(h,1.43);run.cancel();await run.finished;h.clean()
    }finally{h.dispose()}
  }
})
test('Meteor Mash retains the original fist approach geometry at its new sound pacing',async()=>{
  for(const side of ['source','target']){
    const h=harness('meteor-mash',side),old=harness('meteor-mash',side,0,true)
    const close=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.02,label)
    try{const run=h.run(),previous=old.run();await tick()
      for(const [at,before] of [[.21,.13],[.42,.26],[.65,.39],[.88,.52],[1.11,.65],[1.34,.78]]){
        h.tl.time(at,false);old.tl.time(before,false)
        const actor=h.scene.actors.get(side),original=old.scene.actors.get(side)
        close(actor.pose,original.pose,`source position ${side}/${at}`)
        assert.ok(Math.abs(actor.pose.rotation-original.pose.rotation)<2e-6,`source rotation ${side}/${at}: ${actor.pose.rotation}/${original.pose.rotation}`)
        const fist=h.node('meteor-mash-fist'),originalFist=old.node('meteor-mash-fist')
        close(h.scene.effects.toLocal({x:0,y:0},fist),old.scene.effects.toLocal({x:0,y:0},originalFist),`live fist attachment ${side}/${at}`)
      }
      run.cancel();previous.cancel();await Promise.all([run.finished,previous.finished]);h.clean();old.clean()
    }finally{h.dispose();old.dispose()}
  }
})
test('Meteor Mash fits the enlarged impact around its visible hit at top and side edges',async()=>{
  for(const side of ['source','target'])for(const layout of [2,3]){
    const h=harness('meteor-mash',side,layout)
    let hit
    try{const run=h.run({onCue(){
      const fist=h.node('meteor-mash-fist'),points=fist.children[1].context.instructions[0].data.path.shapePath.shapePrimitives[0].shape.points
      const r=Math.max(...points.filter((_,i)=>i%2===0))
      hit={knuckle:h.scene.effects.toLocal({x:r,y:0},fist),flash:h.scene.effects.toLocal({x:0,y:0},h.node('meteor-mash-impact')),cloud:h.scene.effects.toLocal({x:0,y:0},h.node('meteor-mash-cosmic-impact'))}
    }});await tick()
      for(let at=.08;at<meteorTiming.duration;at+=.04){h.tl.time(at,false);assertBounds(h,at)}
      for(const point of [hit.flash,hit.cloud])assert.ok(Math.hypot(hit.knuckle.x-point.x,hit.knuckle.y-point.y)<.02,'field fitting must preserve the visible hit center')
      h.tl.time(meteorTiming.duration,false);assert.equal((await run.finished).status,'completed');h.clean()
    }finally{h.dispose()}
  }
})
test('Ancient Power uses the exact Rock Slide silhouette and retains every choreography sample',async()=>{
  const svg=await readFile(new URL('../packages/battle-fx/assets/rock.svg',import.meta.url),'utf8');assert.ok(svg.includes(`d="${ROCK_SLIDE_PATH}"`))
  assert.deepEqual({contact:ancientTiming.contact,duration:ancientTiming.duration},{contact:1.34,duration:2.4})
  for(const side of ['source','target']){
    const h=harness('ancient-power',side),old=harness('ancient-power',side,0,true)
    try{const r=h.run(),o=old.run();await tick()
      for(const at of [.18,.43,.86,1.14,1.34,1.56,1.9,2.2]){h.tl.time(at,false);old.tl.time(at,false)
        const snapshot=x=>x.node('move-artwork').children.map(n=>[n.label,n.x,n.y,n.rotation,n.alpha,n.scale.x,n.scale.y])
        assert.deepEqual(snapshot(h),snapshot(old),`unchanged choreography ${side}/${at}`)
        for(let i=0;i<5;i++){const art=h.node(`ancient-power-rock-slide-art-${i}`);assert.equal(art.scale.x,art.scale.y);assert.equal(art.context.instructions[0].action,'fill')}
      }
      r.cancel();o.cancel();await r.finished;await o.finished;h.clean();old.clean()
    }finally{h.dispose();old.dispose()}
  }
})
test('Meteor Mash has a larger impact, nine stars and a dark space cloud at the audio accent',async()=>{
  const h=harness('meteor-mash'),old=harness('meteor-mash','source',0,true),cues=[]
  try{const run=h.run({onCue:c=>cues.push(c)}),previous=old.run();await tick();
    assert.ok(h.node('meteor-mash-impact').getLocalBounds().width>old.node('meteor-mash-impact').getLocalBounds().width*1.7)
    h.tl.time(1.339,false);assert.equal(cues.length,0);h.tl.time(1.34,false);assert.equal(cues.length,1)
    const fist=h.node('meteor-mash-fist');assert.ok(fist.alpha>.9)
    h.tl.time(1.49,false);const cloud=h.node('meteor-mash-cosmic-impact');assert.ok(cloud.alpha>.9);assert.equal(cloud.children[0].tint,0x100d35)
    const star=h.node('meteor-mash-impact-star-0'),p={x:star.x,y:star.y};assert.equal(cloud.children.filter(c=>c.label?.startsWith('meteor-mash-impact-star-')).length,9)
    h.tl.time(1.69,false);assert.ok(Math.hypot(star.x-p.x,star.y-p.y)>1)
    h.tl.time(2.5,false);assert.equal((await run.finished).status,'completed');h.clean();previous.cancel();await previous.finished
  }finally{h.dispose();old.dispose()}
})
test('stone and cosmic-star proposals stay in the field and restore both sides on completion and cancellation',async()=>{
  for(const id of Object.keys(recipes))for(const side of ['source','target'])for(const layout of [0,1]){
    const h=harness(id,side,layout)
    try{const run=h.run();await tick();for(let t=.08;t<recipes[id][1].duration;t+=.04){h.tl.time(t,false);assertBounds(h,t)}h.tl.time(recipes[id][1].duration,false);assert.equal((await run.finished).status,'completed');h.clean()
      const cancelled=h.run();await tick();h.tl.time(.7,false);cancelled.cancel();assert.equal((await cancelled.finished).status,'cancelled');h.clean()
      const reduced=h.run({reducedMotion:true});await tick();h.tl.time(h.tl.duration(),false);assert.equal((await reduced.finished).status,'completed');h.clean()
    }finally{h.dispose()}
  }
})
