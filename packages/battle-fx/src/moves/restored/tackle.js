import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function tackle(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, solveContact, unit } = bindEffectSpace(context)
  const r=Math.min(43,Math.max(25,context.source.metrics.height/unit*.2)),pose=solveContact('tackle',.04)
  const bump=new Graphics();bump.label='tackle-impact';bump.position.copyFrom(focus);bump.alpha=0
  bump.moveTo(-r*.18,-r*.54).quadraticCurveTo(r*.45,0,-r*.18,r*.54).stroke({color:0xfff0ce,width:4,cap:'round'})
    .moveTo(r*.3,-r*.46).lineTo(r*.48,-r*.65).moveTo(r*.48,0).lineTo(r*.72,0).moveTo(r*.3,r*.46).lineTo(r*.48,r*.65)
    .stroke({color:0xe0d3af,width:2.2,cap:'round'})
  temporary.addChild(bump)
  const dust=Array.from({length:12},(_,i)=>{
    const g=new Graphics().ellipse(0,0,2.5+random()*2,1.7).fill(0xc9bca0);g.alpha=0;temporary.addChild(g)
    return{g,at:i<4?.14:.4,base:i<4?socket('floor'):floor,dx:(random()-.5)*r*1.5,dy:7+random()*12,life:.25+random()*.12}
  })
  onFrame(time=>{for(const p of dust){const u=(time-p.at)/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.55:0;if(u>=0)p.g.position.set(p.base.x+p.dx*u,p.base.y-p.dy*Math.sin(Math.PI*u))}})
  tl.to(attacker,{x:home.x-7,rotation:-.025,duration:.14},0)
    .to(attacker,{...pose,duration:.26,ease:'power2.in'},.14)
    .to(attacker,{x:pose.x-r*.35,y:pose.y+2,rotation:0,duration:.11},.47)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.34,ease:'power2.inOut'},.6)
    .to(bump,{alpha:1,duration:.025},.4).to(bump.scale,{x:1.2,y:1.12,duration:.15},.4).to(bump,{alpha:0,duration:.19},.46)
    .call(()=>{onCue({type:'impact'});defender.tint=0xe9dfc8},[],.4)
    .to(defender,{x:defenderHome.x+7,duration:.08},.4).to(defender,{x:defenderHome.x,duration:.21},.5)
    .call(()=>{defender.tint=0xffffff},[],.63)
}
