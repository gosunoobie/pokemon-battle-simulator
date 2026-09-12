import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function struggle(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, solveContact, unit } = bindEffectSpace(context)
  const r=Math.min(48,Math.max(27,context.source.metrics.height/unit*.23)),pose=solveContact('tackle',.08)
  const scuff=new Graphics();scuff.label='struggle-scuff';scuff.alpha=0;temporary.addChild(scuff)
  for(let i=0;i<3;i++)scuff.moveTo(-r*(.7+i*.15),(i-1)*r*.2).lineTo(-r*.2,(i-1)*r*.12).stroke({color:0xc9c3b2,width:2,cap:'round'})
  const contact=new Graphics();contact.label='struggle-impact';contact.position.copyFrom(focus);contact.alpha=0
  contact.poly([-r*.65,-r*.5,-r*.15,-r*.18,r*.12,-r*.73,r*.23,-r*.1,r*.75,-r*.05,r*.3,r*.22,r*.48,r*.62,0,r*.32,-r*.34,r*.67,-r*.27,r*.12,-r*.78,r*.2,-r*.35,-r*.05]).fill(0xf2e8cc)
  temporary.addChild(contact)
  const recoil=new Graphics();recoil.label='struggle-recoil';recoil.alpha=0
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=Math.cos(a),y=Math.sin(a);recoil.moveTo(x*r*.28,y*r*.28).lineTo(x*r*.5,y*r*.5).stroke({color:0xe8aa87,width:2.3,cap:'round'})}
  temporary.addChild(recoil)
  const dust=Array.from({length:10},()=>{
    const g=new Graphics().ellipse(0,0,2+random()*2,1.6).fill(0xbfb69d);g.alpha=0;temporary.addChild(g)
    return{g,dx:(random()-.5)*r*2,dy:10+random()*15,life:.3+random()*.16}
  })
  const follow=()=>{scuff.position.copyFrom(socket('trail',true));scuff.rotation=attacker.rotation;recoil.position.copyFrom(socket('center',true))}
  onFrame(time=>{
    follow()
    for(const p of dust){const t=(time-.7)/p.life;p.g.alpha=t>=0&&t<1?Math.sin(Math.PI*t)*.6:0;if(t>=0)p.g.position.set(floor.x+p.dx*t,floor.y-p.dy*Math.sin(Math.PI*t))}
  })
  tl.to(attacker,{x:home.x-7,rotation:-.075,duration:.18},0)
    .to(attacker,{x:home.x+4,rotation:.025,duration:.13},.18)
    .to(attacker,{x:home.x-10,y:home.y+3,rotation:-.055,duration:.15},.31)
    .to(attacker,{...pose,duration:.24,ease:'power2.in'},.46)
    .to(attacker,{x:pose.x-r*.66,y:pose.y-r*.12,rotation:-.17,duration:.18,ease:'power2.out'},.75)
    .to(attacker,{x:home.x,y:home.y,rotation:.045,duration:.47,ease:'power2.inOut'},.99)
    .to(attacker,{rotation:-.025,duration:.1},1.46).to(attacker,{rotation:0,duration:.15},1.56)
    .to(scuff,{alpha:.7,duration:.08},.48).to(scuff,{alpha:0,duration:.17},.73)
    .to(contact,{alpha:.95,duration:.025},.7).to(contact.scale,{x:1.17,y:1.17,duration:.16},.7).to(contact,{alpha:0,duration:.2},.75)
    .to(recoil,{alpha:.9,duration:.045},.83).to(recoil,{alpha:0,duration:.24},.9)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xe9dfc2},[],.7)
    .to(defender,{x:defenderHome.x+8,duration:.065,repeat:3,yoyo:true},.7)
    .call(()=>{defender.tint=0xffffff;attacker.tint=0xebbea4},[],.86)
    .call(()=>{attacker.tint=0xffffff},[],1.08)
}
