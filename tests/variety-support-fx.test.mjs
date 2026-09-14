import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS, FX_CATALOG } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const cases = [
  ['follow-me', null, .72, 1.95, true],
  ['helping-hand', null, .66, 1.90, true],
  ['splash', null, .76, 1.85, true],
  ['teeter-dance', .44, 1.02, 2.40, false],
  ['secret-power', .38, .84, 2.10, false],
]
const sourceOnly = id => cases.find(entry => entry[0] === id)[4]
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
const visibleAlpha = node => { let alpha = 1; for (let n = node; n; n = n.parent) alpha *= n.alpha; return alpha }
function harness(reverse = false, edge = 0, custom = false, solo = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const actors = [
    { id: 'source', profile: edge === 1 || (solo && edge === 2) ? 'tall' : 'wide', x: solo && edge === 2 ? (reverse ? .935 : .065) : reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32], ...(custom ? { origin: [.43, .93], emission: [.64, .23], center: [.41, .36] } : {}) } },
    { id: 'target', profile: 'tall', x: reverse ? (edge === 2 ? .055 : .26) : (edge === 2 ? .945 : .74),
      y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: reverse ? 1 : -1,
      anchors: { center: edge === 3 ? [.5, .04] : [.48, .44], ...(custom ? { origin: [.56, .89], center: [.37, .31] } : {}) } },
  ]
  const scene = createSceneGraph({ width, height, actors: solo ? actors.slice(0,1) : actors })
  const fx = createBattleFx({ glowTexture: Texture.WHITE, timelineEngine: {
    timeline(options) { return timeline = gsap.timeline({ ...options, paused: true }) },
  } })
  return { scene, fx, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node), dispose() { fx.dispose(); scene.dispose() } }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
  for (const actor of h.scene.actors.values()) {
    for (const key of ['x', 'y', 'rotation']) assert.equal(actor.pose[key], 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    assert.equal(actor.pose.tint, 0xffffff)
  }
}
function assertBounds(h, label) {
  const { width, height } = h.scene
  for (const actor of h.scene.actors.values()) {
    const p = actor.anchor('visualCenter'), c = Math.abs(Math.cos(actor.pose.rotation)), s = Math.abs(Math.sin(actor.pose.rotation))
    const rx = (actor.metrics.width * c + actor.metrics.height * s) / 2, ry = (actor.metrics.height * c + actor.metrics.width * s) / 2
    assert.ok(p.x - rx >= -.05 && p.x + rx <= width + .05 && p.y - ry >= -.05 && p.y + ry <= height + .05, label + ' complete actor bounds')
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  }
  let seen = 0
  function walk(node, alpha = 1) {
    assert.ok(node.alpha >= 0 && node.alpha <= 1, label + ' valid alpha')
    const visible = alpha * node.alpha
    if (visible > .03 && ['Graphics', 'Sprite'].includes(node.constructor.name)) {
      const b = node.getBounds(); seen++
      assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= width + .05 && b.y + b.height <= height + .05,
        `${label} ${node.label}: ${JSON.stringify(b)}`)
    }
    for (const child of node.children ?? []) walk(child, visible)
  }
  walk(h.scene.effects)
  return seen
}
function checkCue(h, id, cue) {
  assert.equal(cue.type, 'impact')
  const tip = h.node(id + '-tip'), impact = h.node(id + '-impact'), target = h.scene.actor(sourceOnly(id) ? 'source' : 'target').anchor('center')
  assert.ok(tip && impact, id + ' exposes visible contact artwork')
  close(h.point(tip), target, id + ' front reaches the live target before the cue')
  close(h.point(impact), target, id + ' impact is positioned before the cue')
  assert.ok(visibleAlpha(tip) > .6, id + ' visible front at contact')
}
async function complete(h, run, duration) {
  h.tl.time(duration, false)
  const result = await run.finished
  assert.equal(result.status, 'completed', result.reason)
  clean(h)
}


test('Follow Me, Helping Hand and Splash play solo at the user center, including reduced motion and cancellation', async () => {
  for (const reverse of [false,true]) {
    const h=harness(reverse,0,false,true)
    try { for (const [id,,contact,duration] of cases.filter(entry=>entry[4])) {
      assert.equal(FX_CATALOG.filter(move=>move.id===id).length,1)
      assert.deepEqual(EFFECT_TIMINGS[id],{contact,duration})
      const cues=[],run=h.fx.play({moveId:id,sourceId:'source',targetIds:['missing-opponent'],visualSeed:42},{scene:h.scene,onCue:cue=>{checkCue(h,id,cue);cues.push(cue.type)}})
      await tick();h.tl.time(contact-.001,false);assert.deepEqual(cues,[])
      h.tl.time(contact,false);assert.deepEqual(cues,['impact'])
      close(h.point(h.node(id+'-root')),h.scene.actor('source').anchor('center'),id+' root follows user')
      await complete(h,run,duration);assert.deepEqual(cues,['impact'])
      for(const time of [contact*.4,contact+.18]){
        const run=h.fx.play({moveId:id,sourceId:'source',targetIds:[]},{scene:h.scene});await tick();h.tl.time(time,false)
        run.cancel();assert.equal((await run.finished).status,'cancelled');clean(h)
      }
      const reducedCues=[],reduced=h.fx.play({moveId:id,sourceId:'source'},{scene:h.scene,reducedMotion:true,onCue:cue=>reducedCues.push(cue.type)})
      await tick();await complete(h,reduced,.8);assert.deepEqual(reducedCues,['impact'])
    }} finally {h.dispose()}
  }
  gsap.ticker.sleep()
})

test('Teeter Dance and Secret Power launch from live emission, reach exact target contact once and clean up all playback exits',async()=>{
  for(const reverse of[false,true]){
    const h=harness(reverse)
    try {for(const[id,release,contact,duration]of cases.filter(entry=>!entry[4])){
      const cues=[],run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:cue=>{checkCue(h,id,cue);cues.push(cue.type)}})
      await tick();h.tl.time(release,false)
      close(h.point(h.node(id+'-root')),h.scene.actor('source').anchor('emission'),id+' live emitter')
      close(h.point(h.node(id+'-tip')),h.scene.actor('source').anchor('emission'),id+' visible release')
      h.tl.time(contact-.001,false);assert.deepEqual(cues,[])
      h.tl.time(contact,false);assert.deepEqual(cues,['impact'])
      await complete(h,run,duration);assert.deepEqual(cues,['impact'])
      for(const time of[release*.5,contact+.12]){
        const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.tl.time(time,false)
        run.cancel();assert.equal((await run.finished).status,'cancelled');clean(h)
      }
      const reducedCues=[],reduced=h.fx.play({moveId:id,sourceId:'source',targetIds:['target']},{scene:h.scene,reducedMotion:true,onCue:cue=>reducedCues.push(cue.type)})
      await tick();await complete(h,reduced,.8);assert.deepEqual(reducedCues,['impact'])
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('all five full artworks and actor contours fit both directions, tall and wide actors, source edges and portrait fields',async()=>{
  for(const reverse of[false,true])for(const edge of[0,1,2,3,4])for(const solo of[false,true]){
    const h=harness(reverse,edge,false,solo)
    try{for(const[id,,,duration,local]of cases){
      if(solo&&!local)continue
      const run=h.fx.play({moveId:id,sourceId:'source',targetIds:solo?[]:['target'],visualSeed:42},{scene:h.scene,onCue:cue=>checkCue(h,id,cue)})
      await tick();let seen=0
      for(let time=.04;time<duration-.02;time+=.031){h.tl.time(time,false);seen+=assertBounds(h,`${id} reverse${reverse} edge${edge} solo${solo} t${time}`)}
      assert.ok(seen>0,id+' has visible artwork');await complete(h,run,duration)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('custom registration, emission and center sockets remain live through source poses and moving target contact',async()=>{
  for(const reverse of[false,true])for(const solo of[false,true]){
    const h=harness(reverse,0,true,solo),source=h.scene.actor('source')
    try{for(const[id,release,contact,duration,local]of cases){
      if(solo&&!local)continue
      const cues=[],run=h.fx.play({moveId:id,sourceId:'source',targetIds:solo?[]:['target'],visualSeed:42},{scene:h.scene,onCue:cue=>{checkCue(h,id,cue);cues.push(cue.type)}})
      await tick();h.tl.time(.1,false)
      source.pose.x=reverse?-7:7;source.pose.y=-10;source.pose.rotation=.023
      const target=local?source:h.scene.actor('target');if(!local){target.pose.x=reverse?7:-7;target.pose.y=-6;target.pose.rotation=-.018}
      if(release!=null){h.tl.time(release,false);close(h.point(h.node(id+'-tip')),source.anchor('emission'),id+' posed release')}
      h.tl.time(contact-.025,false);target.pose.x=reverse?4:-4;target.pose.y=-11;target.pose.rotation=.019
      h.tl.time(contact,false);assert.deepEqual(cues,['impact'])
      close(h.point(h.node(id+'-root')),source.anchor(local?'center':'emission'),id+' live attachment at cue')
      assertBounds(h,id+' custom posed contact')
      const point=h.point(h.node(id+'-tip'));h.scene.fit(360,480);close(h.point(h.node(id+'-tip')),point,id+' unchanged logical point after fit');h.scene.fit(h.scene.width,h.scene.height)
      await complete(h,run,duration)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('attention glints, applause, dance glyphs and falling particles keep moving during fades, while Splash hops fully recover',async()=>{
  const flows=[
    ['follow-me','follow-me-spark-0',1.37,1.57,false],
    ['helping-hand','helping-hand-applause-0',1.23,1.43,false],
    ['splash','splash-drop-0',1.29,1.51,true],
    ['teeter-dance','teeter-dance-mote-0',1.66,1.88,false],
    ['secret-power','secret-power-fragment-0',1.45,1.66,true],
  ]
  for(const reverse of[false,true]){
    const h=harness(reverse)
    try{for(const[id,label,first,second,down]of flows){
      const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
      if(id==='splash'){h.tl.time(.27,false);assert.ok(h.scene.actor('source').pose.y<-.1,'Splash has a visible harmless hop');h.tl.time(.76,false);assert.equal(h.scene.actor('source').pose.y,0,'Splash lands at the source cue')}
      h.tl.time(first,false);const node=h.node(label);assert.ok(node,label+' exists');const p=h.point(node);assert.ok(visibleAlpha(node)>.02,label+' initially visible')
      h.tl.time(second,false);const q=h.point(node);assert.ok(visibleAlpha(node)>.02,label+' visible while fading')
      assert.ok(Math.hypot(q.x-p.x,q.y-p.y)>.2,label+' continues moving');if(down)assert.ok(q.y>p.y+.1,label+' falls world-down')
      await complete(h,run,EFFECT_TIMINGS[id].duration)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
