import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS, FX_CATALOG } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const cases = [
  ['bind', .32, .82, 2.10], ['wrap', .34, .90, 2.25], ['constrict', .28, .76, 1.95],
  ['string-shot', .26, .74, 1.95], ['cotton-spore', .38, 1.08, 2.55], ['feather-dance', .40, 1.10, 2.60],
  ['spider-web', .32, .94, 2.40], ['block', .38, .92, 2.15], ['kinesis', .50, 1.06, 2.30],
]
const emission = (id,actor) => actor.anchor(id === 'kinesis' && actor.hasAnchor('eyes') ? 'eyes' : 'emission')
const close = (a, b, message) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .05, message)
const visibleAlpha = node => { let alpha = 1; for (let n = node; n; n = n.parent) alpha *= n.alpha; return alpha }
function harness(reverse = false, edge = 0, custom = false) {
  let timeline
  const width = edge === 4 ? 560 : 720, height = edge === 4 ? 700 : 600
  const scene = createSceneGraph({ width, height, actors: [
    { id: 'source', profile: edge === 1 ? 'tall' : 'wide', x: reverse ? .72 : .28,
      y: edge === 1 ? .32 : .82, height: edge === 4 ? .2 : .3, facing: reverse ? -1 : 1,
      anchors: { emission: edge === 1 ? [.6, .05] : [.72, .32], ...(custom ? { origin: [.43, .93], emission: [.64, .23], eyes: [.44, .09] } : {}) } },
    { id: 'target', profile: 'tall', x: reverse ? (edge === 2 ? .055 : .26) : (edge === 2 ? .945 : .74),
      y: edge === 3 ? .3 : .62, height: edge === 3 ? .3 : .18, facing: reverse ? 1 : -1,
      anchors: { center: edge === 3 ? [.5, .04] : [.48, .44], ...(custom ? { origin: [.56, .89], center: [.37, .31] } : {}) } },
  ] })
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
  const tip = h.node(id + '-tip'), impact = h.node(id + '-impact'), target = h.scene.actor('target').anchor('center')
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


test('nine binding and support effects retain independent timings and exact live release and impact geometry in both directions',async()=>{
  for(const reverse of[false,true]){
    const h=harness(reverse)
    try{for(const[id,release,contact,duration]of cases){
      assert.equal(FX_CATALOG.filter(move=>move.id===id).length,1);assert.deepEqual(EFFECT_TIMINGS[id],{contact,duration})
      const cues=[],run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:cue=>{checkCue(h,id,cue);cues.push(cue.type)}})
      await tick();h.tl.time(release,false)
      close(h.point(h.node(id+'-root')),emission(id,h.scene.actor('source')),id+' live root')
      close(h.point(h.node(id+'-tip')),emission(id,h.scene.actor('source')),id+' visible release')
      h.tl.time(contact-.001,false);assert.deepEqual(cues,[])
      h.tl.time(contact,false);assert.deepEqual(cues,['impact'])
      await complete(h,run,duration);assert.deepEqual(cues,['impact'])
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('every new binding/support effect cleans up from mid-flight and post-contact cancellation and reduced motion',async()=>{
  for(const reverse of[false,true]){
    const h=harness(reverse)
    try{for(const[id,release,contact]of cases){
      for(const at of[release*.6,contact+.16]){
        const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target']},{scene:h.scene});await tick();h.tl.time(at,false)
        run.cancel();assert.equal((await run.finished).status,'cancelled');clean(h)
      }
      const cues=[],run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target']},{scene:h.scene,reducedMotion:true,onCue:cue=>cues.push(cue.type)})
      await tick();await complete(h,run,.8);assert.deepEqual(cues,['impact'])
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('all complete art and actor contours fit tall and wide source, top and side target edges, and portrait fields in both directions',async()=>{
  for(const reverse of[false,true])for(const edge of[0,1,2,3,4]){
    const h=harness(reverse,edge)
    try{for(const[id,,,duration]of cases){
      const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:cue=>checkCue(h,id,cue)})
      await tick();let seen=0
      for(let time=.04;time<duration-.02;time+=.031){h.tl.time(time,false);seen+=assertBounds(h,`${id} reverse${reverse} edge${edge} time${time}`)}
      assert.ok(seen>0,id+' visible art');await complete(h,run,duration)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('custom emission and eyes stay attached to posed anatomy and moving targets are already met inside the contact callback',async()=>{
  for(const reverse of[false,true])for(const custom of[false,true]){
    const h=harness(reverse,0,custom),source=h.scene.actor('source'),target=h.scene.actor('target')
    try{for(const[id,release,contact,duration]of cases){
      const cues=[],run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene,onCue:cue=>{checkCue(h,id,cue);cues.push(cue.type)}})
      await tick();h.tl.time(.1,false)
      source.pose.x=reverse?-7:7;source.pose.y=-10;source.pose.rotation=.023
      target.pose.x=reverse?7:-7;target.pose.y=-6;target.pose.rotation=-.018
      h.tl.time(release,false)
      close(h.point(h.node(id+'-root')),emission(id,source),id+' custom live root')
      close(h.point(h.node(id+'-tip')),emission(id,source),id+' custom posed release')
      h.tl.time(contact-.025,false);target.pose.x=reverse?4:-4;target.pose.y=-11;target.pose.rotation=.019
      h.tl.time(contact,false);assert.deepEqual(cues,['impact']);assertBounds(h,id+' custom posed contact')
      close(h.point(h.node(id+'-root')),emission(id,source),id+' root still follows source at cue')
      const p=h.point(h.node(id+'-tip'));h.scene.fit(360,480);close(h.point(h.node(id+'-tip')),p,id+' stable logical contact after fit');h.scene.fit(h.scene.width,h.scene.height)
      await complete(h,run,duration)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})

test('loose fibers, cloth tails, cotton, feathers, dew, stone and psychic glints keep moving through their fades with world-down gravity',async()=>{
  const flows=[
    ['bind','bind-fiber-0',1.42,1.64,true], ['wrap','wrap-tail-0',1.64,1.88,true],
    ['constrict','constrict-fleck-0',1.35,1.58,true], ['string-shot','string-shot-bead-0',1.35,1.58,true],
    ['cotton-spore','cotton-spore-down-0',1.80,2.06,true], ['feather-dance','feather-dance-fallen-0',1.85,2.09,true],
    ['spider-web','spider-web-dew-0',1.68,1.93,true], ['block','block-chip-0',1.56,1.78,true],
    ['kinesis','kinesis-glint-0',1.69,1.94,false],
  ]
  for(const reverse of[false,true]){
    const h=harness(reverse)
    try{for(const[id,label,first,second,down]of flows){
      const run=h.fx.play({moveId:id,sourceId:'source',targetIds:['target'],visualSeed:42},{scene:h.scene});await tick()
      h.tl.time(first,false);const node=h.node(label);assert.ok(node,label+' exists');const p=h.point(node);assert.ok(visibleAlpha(node)>.02,label+' initially visible')
      h.tl.time(second,false);const q=h.point(node);assert.ok(visibleAlpha(node)>.02,label+' still visible during fade')
      assert.ok(Math.hypot(q.x-p.x,q.y-p.y)>.2,label+' keeps moving');if(down)assert.ok(q.y>p.y+.1,label+' falls in world coordinates')
      await complete(h,run,EFFECT_TIMINGS[id].duration)
    }}finally{h.dispose()}
  }
  gsap.ticker.sleep()
})
