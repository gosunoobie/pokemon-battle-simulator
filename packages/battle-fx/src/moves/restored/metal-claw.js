import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function metalClaw(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('claw')?'claw':'hand'
  const length=Math.min(65,Math.max(34,context.source.metrics.height/unit*.26))
  const point={x:focus.x,y:focus.y+4},angle=.12,rotation=.055
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(angle+rotation)*length,y:point.y-Math.sin(angle+rotation)*length})
  const swing={angle:-1.05},claw=new Container();claw.label='metal-claw-steel';claw.alpha=0;temporary.addChild(claw)
  const fan=new Graphics();claw.addChild(fan)
  claw.addChild(new Graphics().poly([-length*.14,-length*.27,length*.16,-length*.3,length*.32,0,length*.16,length*.3,-length*.14,length*.27])
    .fill(0x758c9c).stroke({color:0xc5d6df,width:1.3,join:'round'}))
  for(let i=-1;i<=1;i++){
    const y=i*length*.2,reach=length*(1-Math.abs(i)*.1)
    claw.addChild(new Graphics().poly([length*.12,y-4,length*.58,y-length*.13,reach,y,length*.51,y+2,length*.14,y+4])
      .fill(0xb7cbd6).stroke({color:0xeaf7fb,width:1.3,join:'round'})
      .poly([length*.17,y,length*.58,y-length*.05,reach,y,length*.51,y+2]).fill(0x7798ad)
      .moveTo(length*.24,y-3).lineTo(length*.58,y-length*.105).lineTo(reach,y).stroke({color:0xffffff,width:1.7,cap:'round'}))
  }
  const shine=new Graphics().poly([-8,0,-1.5,-1.5,0,-11,1.5,-1.5,8,0,1.5,1.5,0,11,-1.5,1.5]).fill(0xffffff)
  shine.alpha=0;claw.addChild(shine)
  const sparks=Array.from({length:20},(_,i)=>{
    const g=new Graphics().poly([0,-1,6+random()*7,0,0,1]).fill(i%3?0xffe3a2:0xe3f5ff);g.alpha=0;temporary.addChild(g)
    return{g,a:(random()-.5)*2.3,v:90+random()*135,life:.27+random()*.2}
  })
  const cut=new Graphics().poly([-length*.62,-2,-length*.06,-5,0,-13,length*.07,-3,length*.65,1,length*.07,4,0,13,-length*.06,3]).fill(0xf5fcff)
  cut.label='metal-claw-impact';cut.position.copyFrom(point);cut.rotation=.18;cut.alpha=0;temporary.addChild(cut)
  const follow=()=>{claw.position.copyFrom(socket(attachment,true));claw.rotation=swing.angle+attacker.rotation}
  onFrame(time=>{
    follow();shine.position.set(length*(.2+Math.min(1,Math.max(0,(time-.13)/.26))*.6),-length*.075)
    fan.clear()
    if(time>=.38&&time<.91){
      const fade=Math.min(1,(time-.38)/.12)*Math.max(0,1-(time-.64)/.27)
      for(let i=0;i<=20;i++){const a=-.85+i*.85/20,x=Math.cos(a)*length,y=Math.sin(a)*length;i?fan.lineTo(x,y):fan.moveTo(x,y)}
      fan.stroke({color:0xb6d9ed,width:9,alpha:fade*.32,cap:'round'})
    }
    for(const p of sparks){const age=time-.64,t=age/p.life;p.g.alpha=t>=0&&t<1?Math.sin(t*Math.PI)*.95:0;if(age>=0){p.g.position.set(point.x+Math.cos(p.a)*p.v*age,point.y+Math.sin(p.a)*p.v*age+90*age*age);p.g.rotation=p.a+age*.6}}
  })
  tl.to(attacker,{x:home.x-10,rotation:-.055,duration:.24},0)
    .to(attacker,{...pose,duration:.4,ease:'power3.in'},.24)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.52,ease:'power2.inOut'},.86)
    .to(swing,{angle,duration:.3,ease:'power2.in'},.34)
    .to(claw,{alpha:1,duration:.14},.12).to(claw,{alpha:0,duration:.24},.88)
    .to(shine,{alpha:1,duration:.045},.18).to(shine,{alpha:0,duration:.15},.34)
    .to(cut,{alpha:1,duration:.025},.64).to(cut,{alpha:0,duration:.2},.7)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xcbdde5},[],.64)
    .to(defender,{x:defenderHome.x+9,duration:.065,repeat:3,yoyo:true},.64)
    .call(()=>{defender.tint=0xffffff},[],.91)
}
