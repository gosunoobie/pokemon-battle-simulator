import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function strength(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, floor, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const r=Math.min(63,Math.max(34,context.source.metrics.height/unit*.29)),pose=solveContact('tackle',.08)
  const brace=new Container();brace.label='strength-brace';brace.alpha=0;temporary.addChild(brace)
  for(const side of [-1,1])brace.addChild(new Graphics().moveTo(side*r*.52,-r*.42).quadraticCurveTo(side*r*.8,0,side*r*.52,r*.42)
    .stroke({color:0xd8b883,width:3,alpha:.7,cap:'round'})
    .moveTo(side*r*.66,-r*.27).quadraticCurveTo(side*r*.82,0,side*r*.66,r*.27).stroke({color:0xffe7b6,width:1.5,alpha:.8,cap:'round'}))
  const pressure=new Graphics();pressure.label='strength-pressure';pressure.alpha=0;temporary.addChild(pressure)
  pressure.moveTo(-r*.1,-r*.65).quadraticCurveTo(r*.38,0,-r*.1,r*.65).stroke({color:0xf1d3a0,width:6,alpha:.8,cap:'round'})
    .moveTo(r*.17,-r*.55).quadraticCurveTo(r*.56,0,r*.17,r*.55).stroke({color:0xfff1d1,width:2.2,cap:'round'})
  const flecks=Array.from({length:12},(_,i)=>{
    const g=new Graphics().poly([-2,-1,5,0,-2,2]).fill(i%2?0xe1c395:0xf6e3bb);g.alpha=0;temporary.addChild(g)
    return{g,at:.72+i*.014,dx:(random()-.5)*r*2,dy:10+random()*17,life:.3+random()*.16}
  })
  const follow=time=>{brace.position.copyFrom(socket('center',true));brace.rotation=attacker.rotation;brace.scale.set(1+Math.sin(time*15)*.025);pressure.position.copyFrom(targetSocket('center',true))}
  onFrame(time=>{
    follow(time)
    for(const p of flecks){const u=(time-p.at)/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.75:0;if(u>=0){p.g.position.set(floor.x+p.dx*u,floor.y-p.dy*Math.sin(Math.PI*u));p.g.rotation=u*1.5}}
  })
  tl.to(attacker,{x:home.x-r*.14,y:home.y+3,rotation:-.04,duration:.3},0)
    .to(attacker,{...pose,duration:.42,ease:'power2.in'},.3)
    // Both cosmetic poses move by the same distance, keeping contact throughout the shove.
    .to(attacker,{x:pose.x+13,duration:.24,ease:'power2.out'},.72)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.48,ease:'power2.inOut'},1.12)
    .to(brace,{alpha:.85,duration:.18},.1).to(brace,{alpha:0,duration:.3},1)
    .to(pressure,{alpha:1,duration:.035},.72).to(pressure,{alpha:0,duration:.28},.97)
    .call(()=>{follow(.72);onCue({type:'impact'});defender.tint=0xe8cea5},[],.72)
    .to(defender,{x:defenderHome.x+13,duration:.24,ease:'power2.out'},.72)
    .to(defender,{x:defenderHome.x,duration:.34},1.01)
    .call(()=>{defender.tint=0xffffff},[],1.08)
}
