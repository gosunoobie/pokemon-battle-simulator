import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function digPrepare(context) {
  const { tl, random, onFrame, onCue } = context
  const space = bindEffectSpace(context)
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, solveContact, captureActor, unit } = space
  const visual = context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'
  const center = socket(visual), ground = socket('ground')
  const width = context.source.metrics.width / unit, height = context.source.metrics.height / unit
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit

  const radius=Math.min(85,Math.max(42,width*.48)),motion={sink:0},depth=height+18
  const hole=new Graphics().ellipse(0,0,radius,radius*.23).fill(0x3a3125).ellipse(0,1,radius*.81,radius*.15).fill(0x211f19)
  hole.label='dig-opening';hole.position.copyFrom(ground);hole.alpha=0;temporary.addChild(hole)
  const copy=captureActor(),hasCopy=copy.children.length>0;copy.label='dig-preparation-copy';temporary.addChild(copy)
  const clip=new Graphics().rect(left-50,top-50,right-left+100,Math.max(1,ground.y-top+50)).fill(0xffffff)
  clip.label='dig-preparation-clip';temporary.addChild(clip);copy.mask=clip
  const lip=new Graphics().moveTo(-radius,0).lineTo(-radius*.7,-5).lineTo(-radius*.48,3).lineTo(-radius*.1,-3).lineTo(radius*.21,2).lineTo(radius*.65,-4).lineTo(radius,0).stroke({color:0x9b8461,width:6,join:'round'})
  lip.position.copyFrom(ground);lip.alpha=0;temporary.addChild(lip)
  const chips=[]
  for(let i=0;i<26;i++){const s=2+random()*4,g=new Graphics().poly([-s,0,0,-s,s,1,0,s*.6]).fill(i%2?0xbaa17b:0x816b4d);g.alpha=0;temporary.addChild(g);chips.push({g,delay:.14+random()*.54,life:.27+random()*.3,x:(random()-.5)*radius*1.6,v:(random()-.5)*100,up:30+random()*65})}
  if(hasCopy)attacker.alpha=0
  function update(t){
    const y=depth*motion.sink,x=Math.sin(t*45)*Math.max(0,1-motion.sink)*2
    if(hasCopy){copy.position.set(x,y);copy.alpha=t<1.14?1:0;attacker.alpha=0}
    else{attacker.position.set(x,y);attacker.alpha=Math.max(0,1-motion.sink*1.5)}
    clip.alpha=t<1.14?1:0
    for(const p of chips){const age=t-p.delay,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.9:0;p.g.position.set(ground.x+p.x+p.v*Math.max(0,age),ground.y-p.up*Math.max(0,age)+130*Math.max(0,age)**2);p.g.rotation=age*8}
  }
  onFrame(update)
  tl.to(hole,{alpha:1,duration:.18},.08).to(lip,{alpha:1,duration:.15},.08)
    .to(motion,{sink:1,duration:.67,ease:'power1.in'},.26)
    .call(()=>{update(.96);onCue({type:'prepared'})},[],.96)
    .to(hole.scale,{x:.08,y:.08,duration:.36},.95).to(hole,{alpha:0,duration:.3},1.01).to(lip,{alpha:0,duration:.32},.98)

}
