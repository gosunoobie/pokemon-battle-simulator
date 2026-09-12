import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function explosion(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const r=Math.min(102,Math.max(62,context.source.metrics.height/unit*.4)),center=socket('center')
  const charge=new Graphics();charge.label='explosion-charge';charge.alpha=0;temporary.addChild(charge)
  const draw={compression:0,progress:0}
  const burst=new Container();burst.label='explosion-burst';burst.alpha=0;temporary.addChild(burst)
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9,g=new Graphics().circle(0,0,r*(i%2?.28:.33)).fill({color:i%2?0xe9ae70:0xd68b59,alpha:.78});g.position.set(Math.cos(a)*r*.53,Math.sin(a)*r*.46);burst.addChild(g)}
  burst.addChild(new Graphics().ellipse(0,0,r*.59,r*.55).fill(0xf3c687).ellipse(0,0,r*.36,r*.34).fill(0xffe8b6)
    .poly([-r*.41,0,-r*.09,-r*.09,0,-r*.48,r*.09,-r*.09,r*.41,0,r*.09,r*.09,0,r*.48,-r*.09,r*.09]).fill(0xfff5d7))
  const rings=Array.from({length:3},(_,i)=>{const g=new Graphics().ellipse(0,0,r*(.68+i*.08),r*(.61+i*.075)).stroke({color:i%2?0xeac392:0xf6dfb6,width:2.5-i*.35});g.alpha=0;temporary.addChild(g);return g})
  const front=new Graphics().moveTo(-r*.28,-r*.77).quadraticCurveTo(r*.28,0,-r*.28,r*.77).stroke({color:0xf9d7a2,width:5,alpha:.8,cap:'round'})
    .moveTo(-r*.44,-r*.61).quadraticCurveTo(-r*.02,0,-r*.44,r*.61).stroke({color:0xe8b77f,width:2,alpha:.7,cap:'round'})
  front.label='explosion-front';front.alpha=0;temporary.addChild(front)
  const strike=new Container();strike.label='explosion-impact';strike.alpha=0;temporary.addChild(strike)
  strike.addChild(new Graphics().ellipse(0,0,r*.27,r*.58).stroke({color:0xffe4b6,width:3})
    .moveTo(-r*.1,-r*.39).lineTo(r*.11,-r*.1).moveTo(-r*.1,r*.39).lineTo(r*.11,r*.1).stroke({color:0xf4c487,width:3,cap:'round'}))
  const chips=Array.from({length:28},(_,i)=>{const g=new Graphics().poly([-3,-2,7,0,-3,2]).fill(i%3?0xe8b47d:0xffdeb0);g.alpha=0;temporary.addChild(g);return{g,a:i*Math.PI/14,v:90+random()*105,life:.45+random()*.28}})
  const smoke=Array.from({length:10},(_,i)=>{const g=new Graphics().circle(0,0,r*.16).circle(r*.11,r*.03,r*.13).fill(i%2?0xa79883:0xc4b399);g.alpha=0;temporary.addChild(g);return{g,a:i*Math.PI/5,v:30+random()*40,life:.7+random()*.25,start:.87+i*.028}})
  const update=time=>{
    const from=socket('center',true),to=targetSocket('center',true);charge.position.copyFrom(from);charge.clear()
    for(let i=0;i<10;i++){const a=i*Math.PI/5+time*.3,d=r*(.83-draw.compression*.52);charge.moveTo(Math.cos(a)*d,Math.sin(a)*d).lineTo(Math.cos(a)*(d+r*.13),Math.sin(a)*(d+r*.13)).stroke({color:i%2?0xe6c393:0xffe8bb,width:2,cap:'round'})}
    burst.position.copyFrom(center);rings.forEach(g=>g.position.copyFrom(center));strike.position.copyFrom(to)
    front.position.set(center.x+(to.x-center.x)*draw.progress,center.y+(to.y-center.y)*draw.progress);front.rotation=Math.atan2(to.y-center.y,to.x-center.x)
    for(const p of chips){const age=time-.72,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.9:0;if(age>=0){p.g.position.set(center.x+Math.cos(p.a)*p.v*age,center.y+Math.sin(p.a)*p.v*age+50*age*age);p.g.rotation=p.a+age}}
    for(const p of smoke){const age=time-p.start,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.3:0;if(age>=0){p.g.position.set(center.x+Math.cos(p.a)*(r*.5+p.v*age),center.y+Math.sin(p.a)*r*.43-age*32);p.g.scale.set(1+age*.9);p.g.rotation=Math.sin(age*2+p.a)*.1}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x+2.5,duration:.06,repeat:7,yoyo:true},.18).set(attacker,{x:home.x},.68)
    .to(charge,{alpha:.9,duration:.2},.08).to(draw,{compression:1,duration:.44,ease:'power2.in'},.22).to(charge,{alpha:0,duration:.08},.68)
    .to(burst,{alpha:1,duration:.025},.72).fromTo(burst.scale,{x:.27,y:.27},{x:1.08,y:1.08,duration:.24,ease:'power3.out'},.72).to(burst,{alpha:0,duration:.38},.87)
    .to(front,{alpha:.9,duration:.045},.72).to(draw,{progress:1,duration:.38,ease:'none'},.72).to(front,{alpha:0,duration:.24},1.13)
    .to(strike,{alpha:.95,duration:.04},1.1).to(strike.scale,{x:1.3,y:1.15,duration:.3},1.1).to(strike,{alpha:0,duration:.27},1.21)
    .call(()=>{update(1.1);onCue({type:'impact'});defender.tint=0xf6d0a1},[],1.1)
    .to(defender,{x:defenderHome.x+17,duration:.1,ease:'power2.out'},1.1).to(defender,{x:defenderHome.x,duration:.4,ease:'power2.out'},1.2)
    .call(()=>{defender.tint=0xffffff},[],1.45)
  rings.forEach((g,i)=>{const at=.72+i*.1;tl.to(g,{alpha:.75-i*.1,duration:.05},at).fromTo(g.scale,{x:.45,y:.45},{x:1.36,y:1.36,duration:.5},at).to(g,{alpha:0,duration:.38},at+.13)})
}
