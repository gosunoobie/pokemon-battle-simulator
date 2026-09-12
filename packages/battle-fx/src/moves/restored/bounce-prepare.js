import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function bouncePrepare(context) {
  const { tl, random, onFrame, onCue } = context
  const space = bindEffectSpace(context)
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, solveContact, captureActor, unit } = space
  const visual = context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'
  const center = socket(visual), ground = socket('ground')
  const width = context.source.metrics.width / unit, height = context.source.metrics.height / unit
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit

  const radius=Math.min(66,Math.max(34,width*.3)),lift=Math.max(20,ground.y-top+20),motion={rise:0,crouch:0}
  const rings=[]
  for(let i=0;i<2;i++){const g=new Graphics().ellipse(0,0,radius,radius*.22).stroke({color:i?0xd4c9ba:0xece5d6,width:i?1.6:2.8});g.alpha=0;g.position.copyFrom(ground);temporary.addChild(g);rings.push(g)}
  const speed=new Graphics();speed.label='bounce-spring-lines';speed.alpha=0;temporary.addChild(speed)
  const dust=[]
  for(let i=0;i<12;i++){const g=new Graphics().ellipse(0,0,4+random()*3,2+random()*2).fill(0xc8bda5);g.alpha=0;temporary.addChild(g);dust.push({g,sign:i%2?1:-1,v:35+random()*80,life:.35+random()*.25})}
  function update(t){
    // Compress around the supplied ground socket, preserving the planted feet.
    const sy=1-motion.crouch*.12,sx=1+motion.crouch*Math.max(0,Math.min(.07,(right-left)/width-1))
    const pivotX=ground.x*(1-sx),scaledCenter=center.x*sx+pivotX
    attacker.scale.set(sx,sy);attacker.x=pivotX+Math.max(left+width*sx/2,Math.min(right-width*sx/2,scaledCenter))-scaledCenter;attacker.y=ground.y*(1-sy)-lift*motion.rise
    attacker.alpha=Math.max(0,1-Math.max(0,motion.rise-.62)/.27)
    speed.clear();speed.alpha=t>.31&&t<.92?Math.sin(Math.min(1,(t-.31)/.61)*Math.PI)*.65:0
    const p=socket('body',true)
    for(const sign of [-1,1])for(let i=0;i<2;i++)speed.moveTo(p.x+sign*radius*(.7+i*.2),p.y+height*.2).lineTo(p.x+sign*radius*(.7+i*.2),p.y+height*.2+30+i*10).stroke({color:0xe5e7df,width:2,cap:'round'})
    for(const p of dust){const age=t-.34,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.4:0;p.g.position.set(ground.x+p.sign*(radius*.4+Math.max(0,age)*p.v),ground.y-12*Math.sin(Math.max(0,u)*Math.PI));p.g.scale.set(1+Math.max(0,u))}
  }
  onFrame(update)
  tl.to(motion,{crouch:1,duration:.26,ease:'power2.in'},0).to(motion,{crouch:0,duration:.12},.29)
    .to(motion,{rise:1,duration:.57,ease:'power2.out'},.33)
    .call(()=>{update(.94);onCue({type:'prepared'})},[],.94)
  rings.forEach((g,i)=>{tl.to(g,{alpha:.65,duration:.025},.33+i*.08).to(g.scale,{x:1.8,y:1.45,duration:.4},.33+i*.08).to(g,{alpha:0,duration:.35},.4+i*.08)})

}
