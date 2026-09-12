import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function doubleEdge(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const r=Math.min(66,Math.max(36,context.source.metrics.height/unit*.3)),pose=solveContact('tackle',.14)
  const rush=new Graphics();rush.label='double-edge-rush';rush.alpha=0;temporary.addChild(rush)
  for(const side of [-1,1])rush.moveTo(-r*1.4,side*r*.25).quadraticCurveTo(-r*.42,side*r*.52,r*.22,side*r*.12)
    .stroke({color:side<0?0xf9d8ae:0xf2bcb2,width:4,alpha:.7,cap:'round'})
    .moveTo(-r*1.05,side*r*.12).lineTo(r*.1,side*r*.04).stroke({color:0xfff5df,width:1.8,alpha:.8,cap:'round'})
  const crash=new Container();crash.label='double-edge-impact';crash.position.copyFrom(focus);crash.alpha=0;temporary.addChild(crash)
  for(const side of [-1,1]){
    const arc=new Graphics().moveTo(-r*.58,-r*.54).quadraticCurveTo(r*.43,-r*.12,r*.48,r*.59)
      .stroke({color:side<0?0xf6c7b5:0xffecc5,width:6,cap:'round'})
    arc.scale.x=side;crash.addChild(arc)
  }
  crash.addChild(new Graphics().poly([-r*.2,0,-r*.055,-r*.07,0,-r*.42,r*.055,-r*.07,r*.2,0,r*.055,r*.07,0,r*.42,-r*.055,r*.07]).fill(0xfff9e7))
  const shock=new Graphics().ellipse(0,0,r*.21,r*.52).stroke({color:0xfce9c6,width:2.7})
  shock.position.copyFrom(focus);shock.alpha=0;temporary.addChild(shock)
  const rebound=new Graphics().ellipse(0,0,r*.31,r*.26).stroke({color:0xe4ab99,width:2.2})
  rebound.label='double-edge-recoil';rebound.alpha=0;temporary.addChild(rebound)
  const chips=Array.from({length:24},(_,i)=>{
    const g=new Graphics().poly([-2,-1,6,0,-2,2]).fill(i%3?0xf9e1b5:0xeab3a4);g.alpha=0;temporary.addChild(g)
    return{g,a:random()*Math.PI*2,v:r*(1.1+random()*1.9),life:.33+random()*.22}
  })
  const follow=()=>{rush.position.copyFrom(socket('trail',true));rush.rotation=attacker.rotation;rebound.position.copyFrom(socket('center',true))}
  onFrame(time=>{
    follow()
    for(const p of chips){const age=time-.74,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.95:0;if(age>=0){p.g.position.set(focus.x+Math.cos(p.a)*p.v*age,focus.y+Math.sin(p.a)*p.v*age+55*age*age);p.g.rotation=p.a+age*2}}
  })
  tl.to(attacker,{x:home.x-r*.3,y:home.y+4,rotation:-.09,duration:.38},0)
    .to(attacker,{...pose,duration:.36,ease:'power4.in'},.38)
    .to(attacker,{x:pose.x-r*.9,y:pose.y-r*.2,rotation:-.19,duration:.24,ease:'power2.out'},.82)
    .to(attacker,{x:home.x,y:home.y,rotation:.03,duration:.55,ease:'power2.inOut'},1.12)
    .to(attacker,{rotation:0,duration:.13},1.67)
    .to(rush,{alpha:1,duration:.09},.39).to(rush,{alpha:0,duration:.18},.78)
    .to(crash,{alpha:1,duration:.025},.74).to(crash.scale,{x:1.22,y:1.12,duration:.2},.74).to(crash,{alpha:0,duration:.23},.84)
    .to(shock,{alpha:.9,duration:.035},.75).to(shock.scale,{x:1.85,y:1.18,duration:.28},.75).to(shock,{alpha:0,duration:.24},.84)
    .to(rebound,{alpha:.9,duration:.045},.88).to(rebound.scale,{x:1.35,y:1.3,duration:.2},.88).to(rebound,{alpha:0,duration:.22},.96)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xf1d1b9},[],.74)
    .to(defender,{x:defenderHome.x+16,duration:.1},.74).to(defender,{x:defenderHome.x+10,duration:.06,repeat:3,yoyo:true},.84)
    .to(defender,{x:defenderHome.x,duration:.22},1.08)
    .call(()=>{defender.tint=0xffffff;attacker.tint=0xeec3ae},[],.96)
    .call(()=>{attacker.tint=0xffffff},[],1.19)
}
