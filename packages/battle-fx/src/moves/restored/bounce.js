import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function bounce(context) {
  const { tl, random, onFrame, onCue } = context
  const space = bindEffectSpace(context)
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, solveContact, captureActor, unit } = space
  const visual = context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'
  const center = socket(visual), ground = socket('ground')
  const width = context.source.metrics.width / unit, height = context.source.metrics.height / unit
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit

  const desired=solveContact('slam',0,targetSocket('center'))
  const landing={x:Math.max(left+width/2-center.x,Math.min(right-width/2-center.x,desired.x)),y:Math.max(top+height/2-center.y,Math.min(bottom-height/2-center.y,desired.y))}
  const motion={x:landing.x,y:top-center.y-height*.65},radius=Math.min(73,Math.max(38,context.target.metrics.width/unit*.28))
  const envelope=new Graphics();envelope.label='bounce-fall-envelope';envelope.alpha=0;temporary.addChild(envelope)
  const stamp=new Graphics().ellipse(0,0,radius,radius*.24).stroke({color:0xf0e7d3,width:4}).ellipse(0,0,radius*.62,radius*.14).stroke({color:0xcbbfa7,width:1.6})
  stamp.label='bounce-impact';stamp.alpha=0;temporary.addChild(stamp)
  const dust=[]
  for(let i=0;i<20;i++){const g=new Graphics().ellipse(0,0,4+random()*5,2+random()*3).fill(i%2?0xc5b99f:0xe4d9c1);g.alpha=0;temporary.addChild(g);dust.push({g,a:random()*Math.PI*2,v:55+random()*95,life:.36+random()*.3})}
  let impact
  function update(t){
    attacker.position.copyFrom(motion);attacker.alpha=t<.12?0:Math.min(1,(t-.12)*10)
    const p=socket('slam',true);envelope.clear();envelope.alpha=t>.2&&t<.94?Math.min(1,(t-.2)*7)*Math.min(1,(.94-t)*9)*.6:0
    envelope.moveTo(p.x-radius*.58,p.y-height*.44).quadraticCurveTo(p.x-radius*.82,p.y+height*.18,p.x,p.y+height*.29).quadraticCurveTo(p.x+radius*.82,p.y+height*.18,p.x+radius*.58,p.y-height*.44).stroke({color:0xe7e9e2,width:2.4,cap:'round'})
    for(const sign of [-1,1])envelope.moveTo(p.x+sign*radius*.9,p.y-20).lineTo(p.x+sign*radius*.9,p.y-58).stroke({color:0xc8d5d6,width:1.8})
    if(impact)stamp.position.copyFrom(impact)
    for(const p of dust){const age=t-.84,u=age/p.life;p.g.alpha=impact&&u>=0&&u<1?Math.sin(u*Math.PI)*.5:0;if(impact){p.g.position.set(impact.x+Math.cos(p.a)*p.v*Math.max(0,age),impact.y+Math.sin(p.a)*p.v*Math.max(0,age)*.35+25*Math.max(0,age)**2);p.g.scale.set(1+Math.max(0,u)*.8)}}
  }
  update(0);onFrame(update)
  const targetCenter=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center'),recoil=Math.max(0,Math.min(7,right-targetCenter.x-context.target.metrics.width/(2*unit)))
  const rebound=Math.min(height*.3,Math.max(0,center.y+landing.y-height/2-top))
  tl.to(motion,{y:landing.y,duration:.68,ease:'power2.in'},.16)
    .call(()=>{update(.84);impact=socket('slam',true);stamp.position.copyFrom(impact);onCue({type:'impact'});defender.tint=0xe9dfc9},[],.84)
    .to(stamp,{alpha:.95,duration:.025},.84).to(stamp.scale,{x:1.65,y:1.2,duration:.27},.84).to(stamp,{alpha:0,duration:.26},.9)
    .to(defender,{x:defenderHome.x+recoil,duration:.07,repeat:3,yoyo:true},.84).call(()=>{defender.tint=0xffffff},[],1.17)
    .to(motion,{y:landing.y-rebound,duration:.22,ease:'power2.out'},.87)
    .to(motion,{x:home.x,y:home.y,duration:.65,ease:'power2.inOut'},1.1)

}
