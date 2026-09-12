import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function dive(context) {
  const { tl, random, onFrame, onCue } = context
  const space = bindEffectSpace(context)
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, solveContact, captureActor, unit } = space
  const visual = context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'
  const center = socket(visual), ground = socket('ground')
  const width = context.source.metrics.width / unit, height = context.source.metrics.height / unit
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit

  const exit=targetSocket('ground'),desired=solveContact('body',0,targetSocket('center'))
  const landing={x:Math.max(left+width/2-center.x,Math.min(right-width/2-center.x,desired.x)),y:Math.max(top+height/2-center.y,Math.min(bottom-height/2-center.y,desired.y))}
  const motion={x:landing.x,y:exit.y-center.y+height*.65},radius=Math.min(88,Math.max(42,context.target.metrics.width/unit*.32))
  const pool=new Graphics().ellipse(0,0,radius,radius*.24).fill({color:0x246b8d,alpha:.75});pool.position.copyFrom(exit);pool.alpha=0;temporary.addChild(pool)
  const copy=captureActor(),hasCopy=copy.children.length>0;copy.label='dive-emergence-copy';temporary.addChild(copy)
  const clip=new Graphics().rect(left-50,top-50,right-left+100,Math.max(1,exit.y-top+50)).fill(0xffffff);clip.label='dive-emergence-clip';temporary.addChild(clip);copy.mask=clip
  const water=new Graphics();water.label='dive-rising-water';water.alpha=0;temporary.addChild(water)
  const hit=new Graphics().ellipse(0,0,radius*.42,radius*.58).stroke({color:0xc2eef4,width:3});hit.label='dive-impact';hit.alpha=0;temporary.addChild(hit)
  const spray=[]
  for(let i=0;i<32;i++){const bubble=i<10,s=2+random()*3,g=bubble?new Graphics().circle(0,0,s).stroke({color:0xbce8f0,width:1.2}):new Graphics().ellipse(0,0,s*.7,s*1.3).fill(i%2?0x82cce2:0xc2edf2);g.alpha=0;temporary.addChild(g);spray.push({g,bubble,a:-Math.PI+random()*Math.PI,v:45+random()*130,delay:bubble?.12+random()*.35:.64+random()*.38,life:.42+random()*.4})}
  let impact
  function update(t){
    attacker.position.copyFrom(motion);const concealed=t<1.3
    attacker.alpha=hasCopy&&concealed?0:t<.43?0:hasCopy?1:Math.min(1,(t-.43)/.45)
    copy.position.copyFrom(motion);copy.alpha=hasCopy&&concealed?1:0;clip.alpha=concealed?1:0
    water.clear();water.alpha=t>.43&&t<1.81?Math.min(1,(t-.43)*5)*Math.min(1,(1.81-t)*3):0
    const rise=Math.min(1,Math.max(0,(t-.43)/.55)),fall=Math.max(0,1-Math.max(0,t-.98)/.64),crest=Math.min(height*.63,exit.y-top-8)*rise*fall
    for(const sign of [-1,1]){
      water.moveTo(exit.x,exit.y).quadraticCurveTo(exit.x+sign*radius*.22,exit.y-crest*.85,exit.x+sign*radius*(.32+.08*Math.sin(t*12)),exit.y-crest).quadraticCurveTo(exit.x+sign*radius*.46,exit.y-crest*.27,exit.x+sign*radius*.78,exit.y).fill({color:sign<0?0x4aaccf:0x80d0e4,alpha:.62})
      water.moveTo(exit.x+sign*radius*.12,exit.y).quadraticCurveTo(exit.x+sign*radius*.29,exit.y-crest*.7,exit.x+sign*radius*.36,exit.y-crest*.8).stroke({color:0xc4eef2,width:2,alpha:.85})
    }
    for(let j=0;j<2;j++){const q=((t*.9+j*.5)%1+1)%1;water.ellipse(exit.x,exit.y,radius*(.5+q*.72),radius*(.12+q*.16)).stroke({color:0x9eddeb,width:1.8,alpha:1-q})}
    for(const p of spray){const age=t-p.delay,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.85:0;p.g.position.set(exit.x+Math.cos(p.a)*p.v*Math.max(0,age),exit.y+Math.sin(p.a)*p.v*Math.max(0,age)+(p.bubble?0:135)*Math.max(0,age)**2);p.g.rotation=p.bubble?0:p.a+Math.PI/2}
    if(impact)hit.position.copyFrom(impact)
  }
  update(0);onFrame(update)
  const targetCenter=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center'),lift=Math.max(0,Math.min(12,targetCenter.y-context.target.metrics.height/(2*unit)-top))
  const headroom=Math.max(0,center.y+landing.y-height/2-top),emerge=Math.min(headroom,Math.max(28,ground.y+landing.y-exit.y+12))
  tl.to(pool,{alpha:1,duration:.25},.03).to(pool,{alpha:0,duration:.46},1.24)
    .to(motion,{y:landing.y,duration:.53,ease:'power2.out'},.45)
    .call(()=>{update(.98);impact=socket('body',true);hit.position.copyFrom(impact);onCue({type:'impact'});defender.tint=0xbde8f2},[],.98)
    .to(hit,{alpha:.85,duration:.025},.98).to(hit.scale,{x:1.5,y:1.3,duration:.26},.98).to(hit,{alpha:0,duration:.25},1.03)
    .to(defender,{y:defenderHome.y-lift,duration:.13},.98).to(defender,{y:defenderHome.y,duration:.25},1.11).call(()=>{defender.tint=0xffffff},[],1.36)
    .to(motion,{y:landing.y-emerge,duration:.25,ease:'power1.out'},.99)
    .to(motion,{x:home.x,y:home.y,duration:.7,ease:'power2.inOut'},1.32)

}
