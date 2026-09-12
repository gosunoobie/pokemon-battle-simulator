import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function takeDown(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, solveContact, unit } = bindEffectSpace(context)
  const r=Math.min(59,Math.max(32,context.source.metrics.height/unit*.27)),pose=solveContact('tackle',.11)
  const wake=new Graphics();wake.label='take-down-wake';wake.alpha=0;temporary.addChild(wake)
  for(let i=0;i<4;i++){const y=(i-1.5)*r*.18;wake.moveTo(-r*(1.05-Math.abs(i-1.5)*.13),y+r*.06).quadraticCurveTo(-r*.4,y,-r*.1,y).stroke({color:i%2?0xe2d7ba:0xffeed1,width:i%2?1.5:3,alpha:.8,cap:'round'})}
  const impact=new Graphics();impact.label='take-down-impact';impact.position.copyFrom(focus);impact.alpha=0
  impact.poly([-r*.72,-r*.23,-r*.16,-r*.18,-r*.17,-r*.78,r*.1,-r*.24,r*.62,-r*.57,r*.32,-r*.03,r*.8,r*.24,r*.21,r*.21,r*.13,r*.76,-r*.13,r*.31,-r*.6,r*.56,-r*.32,r*.04]).fill(0xf3e4bd)
    .ellipse(0,0,r*.14,r*.2).fill(0xfffae8);temporary.addChild(impact)
  const recoil=new Graphics().moveTo(-r*.35,-r*.25).lineTo(-r*.5,-r*.36).moveTo(0,-r*.37).lineTo(0,-r*.54).moveTo(r*.32,-r*.24).lineTo(r*.45,-r*.35)
    .stroke({color:0xd9a887,width:2.5,cap:'round'});recoil.label='take-down-recoil';recoil.alpha=0;temporary.addChild(recoil)
  const dust=Array.from({length:17},()=>{
    const g=new Graphics().ellipse(0,0,3+random()*3,2+random()).fill(0xc6b392);g.alpha=0;temporary.addChild(g)
    return{g,dx:(random()-.5)*r*2.5,dy:12+random()*22,life:.35+random()*.16}
  })
  const follow=()=>{wake.position.copyFrom(socket('trail',true));wake.rotation=attacker.rotation;recoil.position.copyFrom(socket('center',true))}
  onFrame(time=>{
    follow()
    for(const p of dust){const u=(time-.66)/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.65:0;if(u>=0){p.g.position.set(floor.x+p.dx*u,floor.y-p.dy*Math.sin(Math.PI*u));p.g.scale.set(1+u*.4)}}
  })
  tl.to(attacker,{x:home.x-r*.24,y:home.y+4,rotation:-.06,duration:.3},0)
    .to(attacker,{...pose,duration:.36,ease:'power3.in'},.3)
    .to(attacker,{x:pose.x-r*.65,y:pose.y-r*.14,rotation:-.12,duration:.2,ease:'power2.out'},.74)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.55,ease:'power2.inOut'},1.02)
    .to(wake,{alpha:1,duration:.08},.32).to(wake,{alpha:0,duration:.2},.69)
    .to(impact,{alpha:1,duration:.025},.66).to(impact.scale,{x:1.15,y:1.15,duration:.17},.66).to(impact,{alpha:0,duration:.22},.73)
    .to(recoil,{alpha:.85,duration:.04},.83).to(recoil,{alpha:0,duration:.2},.91)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xe7d3ad},[],.66)
    .to(defender,{x:defenderHome.x+12,duration:.09},.66).to(defender,{x:defenderHome.x,duration:.27},.84)
    .call(()=>{defender.tint=0xffffff;attacker.tint=0xe8c7ab},[],.86)
    .call(()=>{attacker.tint=0xffffff},[],1.08)
}
