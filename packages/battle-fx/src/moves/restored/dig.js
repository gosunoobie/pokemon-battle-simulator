import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function dig(context) {
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
  const motion={x:landing.x,y:exit.y-center.y+height*.65},radius=Math.min(86,Math.max(42,context.target.metrics.width/unit*.33))
  const mound=new Graphics();mound.label='dig-emergence-mound';mound.alpha=0;temporary.addChild(mound)
  const copy=captureActor(),hasCopy=copy.children.length>0;copy.label='dig-emergence-copy';temporary.addChild(copy)
  const clip=new Graphics().rect(left-50,top-50,right-left+100,Math.max(1,exit.y-top+50)).fill(0xffffff);clip.label='dig-emergence-clip';temporary.addChild(clip);copy.mask=clip
  const cracks=new Graphics();cracks.alpha=0;temporary.addChild(cracks)
  const hit=new Graphics().ellipse(0,0,radius*.5,radius*.22).stroke({color:0xd7c49a,width:3});hit.label='dig-impact';hit.alpha=0;temporary.addChild(hit)
  const grit=[]
  for(let i=0;i<30;i++){const s=2+random()*5,g=new Graphics().poly([-s,0,0,-s*.9,s,s*.2,-s*.2,s*.7]).fill(i%2?0xb09a70:0x796347);g.alpha=0;temporary.addChild(g);grit.push({g,a:-Math.PI+random()*Math.PI,v:65+random()*135,delay:.55+random()*.23,life:.45+random()*.33})}
  let impact
  function update(t){
    attacker.position.copyFrom(motion)
    const concealed=t<1.1
    attacker.alpha=hasCopy&&concealed?0:t<.3?0:hasCopy?1:Math.min(1,(t-.3)/.45)
    copy.position.copyFrom(motion);copy.alpha=hasCopy&&concealed?1:0;clip.alpha=concealed?1:0
    mound.clear();mound.alpha=t>.06&&t<1.27?Math.min(1,(t-.06)*5)*Math.min(1,(1.27-t)*4):0
    const swell=Math.sin(Math.min(1,t/.66)*Math.PI*.5)*10*(t<.66?1:Math.max(0,1-(t-.66)*4))
    mound.ellipse(exit.x,exit.y,radius,radius*.2).fill(0x463a28).moveTo(exit.x-radius,exit.y).quadraticCurveTo(exit.x-radius*.5,exit.y-swell,exit.x,exit.y-swell*1.3).quadraticCurveTo(exit.x+radius*.5,exit.y-swell,exit.x+radius,exit.y).stroke({color:0xa38b62,width:5})
    cracks.clear();cracks.alpha=t>.33&&t<1.27?Math.min(1,(t-.33)*6)*Math.min(1,(1.27-t)*4)*.75:0
    for(const sign of [-1,1])cracks.moveTo(exit.x,exit.y).lineTo(exit.x+sign*radius*.36,exit.y+3).lineTo(exit.x+sign*radius*.61,exit.y-4).lineTo(exit.x+sign*radius*.96,exit.y+2).stroke({color:0xc3ac83,width:2})
    for(const p of grit){const age=t-p.delay,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.95:0;p.g.position.set(exit.x+Math.cos(p.a)*p.v*Math.max(0,age),exit.y+Math.sin(p.a)*p.v*Math.max(0,age)+140*Math.max(0,age)**2);p.g.rotation=age*7}
    if(impact)hit.position.copyFrom(impact)
  }
  update(0);onFrame(update)
  const targetCenter=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center'),lift=Math.max(0,Math.min(15,targetCenter.y-context.target.metrics.height/(2*unit)-top))
  const headroom=Math.max(0,center.y+landing.y-height/2-top),emerge=Math.min(headroom,Math.max(25,ground.y+landing.y-exit.y+12))
  tl.to(motion,{y:landing.y,duration:.5,ease:'power2.out'},.32)
    .call(()=>{update(.82);impact=socket('body',true);hit.position.copyFrom(impact);onCue({type:'impact'});defender.tint=0xd5be92},[],.82)
    .to(hit,{alpha:.9,duration:.025},.82).to(hit.scale,{x:1.6,y:1.5,duration:.24},.82).to(hit,{alpha:0,duration:.24},.87)
    .to(defender,{y:defenderHome.y-lift,duration:.13,ease:'power1.out'},.82).to(defender,{y:defenderHome.y,duration:.23},.95).call(()=>{defender.tint=0xffffff},[],1.18)
    .to(motion,{y:landing.y-emerge,duration:.22,ease:'power1.out'},.83)
    .to(motion,{x:home.x,y:home.y,duration:.66,ease:'power2.inOut'},1.12)

}
