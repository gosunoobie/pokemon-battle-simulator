import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function slam(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('tail')?'tail':'hand'
  const r=Math.min(61,Math.max(33,context.source.metrics.height/unit*.28))
  const point={x:focus.x,y:focus.y+5},pose=solveContact(attachment,.13,point)
  const sweep=new Graphics();sweep.label='slam-sweep';sweep.alpha=0;temporary.addChild(sweep)
  sweep.moveTo(-r*.9,-r*.75).bezierCurveTo(-r*.1,-r*1.04,r*.28,-r*.43,0,0)
    .stroke({color:0xd8c3a1,width:12,alpha:.38,cap:'round'})
    .moveTo(-r*.86,-r*.7).bezierCurveTo(-r*.12,-r*.95,r*.2,-r*.38,0,0)
    .stroke({color:0xffebc3,width:3.7,cap:'round'})
  const press=new Graphics();press.label='slam-impact';press.position.copyFrom(point);press.alpha=0
  press.poly([-r*.67,0,-r*.3,-r*.13,-r*.24,-r*.4,0,-r*.16,r*.29,-r*.38,r*.27,-r*.1,r*.68,r*.05,r*.21,r*.13,0,r*.36,-r*.16,r*.13]).fill(0xf7e5bf)
    .moveTo(-r*.44,r*.15).quadraticCurveTo(0,r*.35,r*.44,r*.15).stroke({color:0xfff6df,width:2.4,cap:'round'})
  temporary.addChild(press)
  const grit=Array.from({length:16},()=>{
    const g=new Graphics().ellipse(0,0,2.5+random()*3,1.7+random()).fill(0xc7b391);g.alpha=0;temporary.addChild(g)
    return{g,dx:(random()-.5)*r*2.2,dy:10+random()*22,life:.32+random()*.18}
  })
  const follow=()=>{sweep.position.copyFrom(socket(attachment,true));sweep.rotation=attacker.rotation-.13}
  onFrame(time=>{
    follow()
    for(const p of grit){const u=(time-.74)/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.65:0;if(u>=0)p.g.position.set(floor.x+p.dx*u,floor.y-p.dy*Math.sin(Math.PI*u))}
  })
  tl.to(attacker,{x:home.x-9,rotation:-.08,duration:.24},0)
    .to(attacker,{x:pose.x-r*.12,y:pose.y-r*.66,rotation:-.13,duration:.28,ease:'power2.out'},.24)
    .to(attacker,{...pose,duration:.22,ease:'power3.in'},.52)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.58,ease:'power2.inOut'},.96)
    .to(sweep,{alpha:1,duration:.1},.51).to(sweep,{alpha:0,duration:.22},.8)
    .to(press,{alpha:1,duration:.025},.74).to(press.scale,{x:1.23,y:.9,duration:.2},.74).to(press,{alpha:0,duration:.24},.82)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xebd5b2},[],.74)
    .to(defender,{y:defenderHome.y+7,x:defenderHome.x+4,duration:.09},.74)
    .to(defender,{y:defenderHome.y,x:defenderHome.x,duration:.3},.88)
    .call(()=>{defender.tint=0xffffff},[],1.02)
}
