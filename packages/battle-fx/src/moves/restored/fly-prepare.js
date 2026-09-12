import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function flyPrepare(context) {
  const { tl, random, onFrame, onCue } = context
  const space = bindEffectSpace(context)
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, solveContact, captureActor, unit } = space
  const visual = context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'
  const center = socket(visual), ground = socket('ground')
  const width = context.source.metrics.width / unit, height = context.source.metrics.height / unit
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit

  const lift = Math.max(20, ground.y - top + 18)
  const radius = Math.min(65, Math.max(35, width * .28)), motion = { rise: 0 }
  const wake = new Graphics(); wake.label = 'fly-takeoff-wake'; wake.alpha = 0; temporary.addChild(wake)
  const ring = new Graphics().ellipse(0,0,radius,radius*.25).stroke({color:0xd9eaf0,width:2.5})
  ring.position.copyFrom(ground); ring.alpha=0; temporary.addChild(ring)
  const wisps=[]
  for(let i=0;i<12;i++){
    const g=new Graphics().moveTo(0,0).quadraticCurveTo(-5,-9,1,-23).stroke({color:i%2?0xd7e8ee:0xa9cad7,width:1.6,cap:'round'})
    g.alpha=0;temporary.addChild(g);wisps.push({g,x:(random()-.5)*radius*1.7,delay:.28+random()*.16,life:.42+random()*.24})
  }
  function update(t){
    attacker.y=home.y-lift*motion.rise
    attacker.alpha=t<.23?1:Math.max(0,1-Math.max(0,motion.rise-.66)/.23)
    const p=socket('body',true);wake.clear();wake.alpha=t>.15&&t<.97?Math.min(1,(t-.15)*6)*Math.min(1,Math.max(0,(.97-t)*5))*.7:0
    for(const s of [-1,1])wake.moveTo(p.x+s*radius*.16,p.y+radius*.1).quadraticCurveTo(p.x+s*radius*.94,p.y+radius*.5,p.x+s*radius*.7,p.y+radius*.87).stroke({color:0xd6e7ec,width:2,cap:'round'})
    for(const p of wisps){const age=t-p.delay,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.65:0;p.g.position.set(ground.x+p.x*(1+Math.max(0,u)*.4),ground.y-Math.max(0,u)*radius*1.25);p.g.rotation=p.x/radius*.35}
  }
  onFrame(update)
  const back=Math.max(0,Math.min(4,center.x-width/2-left))
  tl.to(attacker,{x:home.x-back,duration:.14},0).to(attacker,{x:home.x,duration:.14},.14)
    .to(motion,{rise:1,duration:.68,ease:'power2.in'},.23)
    .to(ring,{alpha:.65,duration:.06},.25).to(ring.scale,{x:1.65,y:1.5,duration:.5},.25).to(ring,{alpha:0,duration:.37},.36)
    .call(()=>{update(.94);onCue({type:'prepared'})},[],.94)

}
