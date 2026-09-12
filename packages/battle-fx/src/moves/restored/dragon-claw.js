import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function dragonClaw(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('claw')?'claw':'hand'
  const length=Math.min(76,Math.max(40,context.source.metrics.height/unit*.3))
  const point={x:focus.x,y:focus.y+6},angle=-.35,rotation=.07
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(angle+rotation)*length,y:point.y-Math.sin(angle+rotation)*length})
  const swing={angle:.95},talons=new Container();talons.label='dragon-claw-talons';talons.alpha=0;temporary.addChild(talons)
  const wake=new Graphics();talons.addChild(wake)
  for(let i=-1;i<=1;i++){
    const y=i*length*.24,reach=length*(1-Math.abs(i)*.13)
    talons.addChild(new Graphics().moveTo(-length*.08,y+5).bezierCurveTo(length*.12,y-length*.17,length*.65,y-length*.18,reach,y)
      .quadraticCurveTo(length*.52,y-length*.03,length*.13,y+length*.09).lineTo(-length*.08,y+5)
      .fill({color:i?0x9d86e1:0x86cbe9,alpha:.72})
      .moveTo(length*.03,y+1).quadraticCurveTo(length*.51,y-length*.18,reach,y).stroke({color:0xe7f7ff,width:2.4,cap:'round'}))
  }
  const charge=new Graphics();charge.label='dragon-claw-charge';charge.alpha=0;temporary.addChild(charge)
  const energy=Array.from({length:18},(_,i)=>{
    const g=new Graphics().poly([-3,0,0,-4,5,0,0,2]).fill(i%2?0xb8a0ed:0xb8eafb);g.alpha=0;temporary.addChild(g)
    return{g,a:random()*Math.PI*2,v:65+random()*110,life:.32+random()*.25,spin:(random()-.5)*8}
  })
  const rake=new Container();rake.label='dragon-claw-rake';rake.position.copyFrom(point);rake.alpha=0;temporary.addChild(rake)
  for(let i=-1;i<=1;i++){
    const g=new Graphics().moveTo(-length*.48,length*.42).quadraticCurveTo(-length*.02,length*.11,length*.55,-length*.47)
      .stroke({color:0x9979d5,width:8,alpha:.42,cap:'round'})
      .moveTo(-length*.48,length*.42).quadraticCurveTo(-length*.02,length*.11,length*.55,-length*.47).stroke({color:0xe2edff,width:2.8,cap:'round'})
    g.position.set(i*length*.17,i*length*.12);rake.addChild(g)
  }
  const update=time=>{
    const hand=socket(attachment,true);talons.position.copyFrom(hand);talons.rotation=swing.angle+attacker.rotation;charge.position.copyFrom(hand)
    charge.clear()
    for(let i=0;i<3;i++){
      const a=time*6+i*Math.PI*2/3,r=length*(.19+Math.max(0,.48-time)*.25)
      charge.arc(0,0,r,a,a+1.35).stroke({color:i%2?0xd1b7f1:0xb1e4f4,width:1.8,alpha:.8})
    }
    wake.clear()
    if(time>=.48&&time<1.15){
      const strength=Math.min(1,(time-.48)/.15)*Math.max(0,1-(time-.82)/.33)
      for(let i=0;i<3;i++)wake.moveTo(-length*.24,i*length*.1).quadraticCurveTo(length*.24,length*(.56+i*.06),length*.85,length*.14)
        .stroke({color:i%2?0xac91e1:0xa0dcec,width:3-i*.6,alpha:strength*.65,cap:'round'})
    }
    for(const p of energy){const age=time-.82,t=age/p.life;p.g.alpha=t>=0&&t<1?Math.sin(t*Math.PI)*.9:0;if(age>=0){p.g.position.set(point.x+Math.cos(p.a)*p.v*age,point.y+Math.sin(p.a)*p.v*age+30*age*age);p.g.rotation=p.a+p.spin*age}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-13,rotation:-.065,duration:.3},0)
    .to(attacker,{...pose,duration:.52,ease:'power3.in'},.3)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.56,ease:'power2.inOut'},1.07)
    .to(swing,{angle,duration:.34,ease:'power2.in'},.48)
    .to(talons,{alpha:.95,duration:.23},.2).to(talons,{alpha:0,duration:.28},1.04)
    .to(charge,{alpha:.85,duration:.18},.08).to(charge,{alpha:0,duration:.25},.65)
    .to(rake,{alpha:1,duration:.035},.82).to(rake,{alpha:0,duration:.3},.92)
    .call(()=>{update(.82);onCue({type:'impact'});defender.tint=0xc6c1ee},[],.82)
    .to(defender,{x:defenderHome.x+12,duration:.07,repeat:3,yoyo:true},.82)
    .call(()=>{defender.tint=0xffffff},[],1.11)
}
