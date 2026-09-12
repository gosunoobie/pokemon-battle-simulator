import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function meteorMash(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('fist')?'fist':'hand'
  const r=Math.min(37,Math.max(22,context.source.metrics.height/unit*.15)),point={x:focus.x,y:focus.y+4},rotation=.09
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(rotation)*r,y:point.y-Math.sin(rotation)*r})
  const fist=new Container();fist.label='meteor-mash-fist';fist.alpha=0;temporary.addChild(fist)
  const comet=new Graphics();fist.addChild(comet)
  fist.addChild(new Graphics().poly([-r*.68,-r*.32,-r*.4,-r*.66,r*.72,-r*.66,r,-r*.4,r,r*.25,r*.63,r*.58,-r*.22,r*.6,-r*.66,r*.27])
    .fill(0x9bb8c9).stroke({color:0xe8f7ff,width:1.8,join:'round'})
    .poly([-r*.66,r*.03,r*.73,r*.05,r*.63,r*.58,-r*.22,r*.6,-r*.66,r*.27]).fill(0x6f8fa4)
    .moveTo(-r*.24,-r*.55).lineTo(-r*.24,-r*.12).moveTo(r*.13,-r*.55).lineTo(r*.13,-r*.12).moveTo(r*.5,-r*.53).lineTo(r*.5,-r*.1)
    .stroke({color:0xcbe4ef,width:1.6,cap:'round'}))
  const starShape=size=>{const points=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,d=size*(i%2?.43:1);points.push(Math.cos(a)*d,Math.sin(a)*d)}return points}
  fist.addChild(new Graphics().poly(starShape(r*.21)).fill(0xf5edd0))
  const stars=Array.from({length:11},(_,i)=>{const g=new Graphics().poly(starShape(3+random()*3.5)).fill(i%3?0xe1f3ff:0xffe8b4);g.alpha=0;temporary.addChild(g);return{g,phase:i/11}})
  const fragments=Array.from({length:16},(_,i)=>{const g=new Graphics().poly(starShape(3+random()*4)).fill(i%3?0xcbeaff:0xffe1a4);g.alpha=0;temporary.addChild(g);return{g,a:i*Math.PI/8,v:70+random()*100,life:.33+random()*.23}})
  const flash=new Graphics().poly(starShape(r*1.25)).fill(0xeef8ff).poly(starShape(r*.66)).fill(0xfce5b4)
  flash.label='meteor-mash-impact';flash.position.copyFrom(point);flash.alpha=0;temporary.addChild(flash)
  const update=time=>{
    const hand=socket(attachment,true);fist.position.copyFrom(hand);fist.rotation=attacker.rotation
    comet.clear()
    for(let i=0;i<3;i++)comet.moveTo(-r*(2.4-i*.22),(i-1)*r*.24).quadraticCurveTo(-r*.95,(i-1)*r*.46,-r*.3,(i-1)*r*.12)
      .stroke({color:i%2?0xe6f5ff:0xa3d2e9,width:i===1?4:1.6,alpha:.55,cap:'round'})
    stars.forEach(p=>{const u=(p.phase+time*1.7)%1;p.g.position.set(hand.x-r*(.5+u*1.7),hand.y+Math.sin(u*Math.PI*2+p.phase)*r*.36);p.g.rotation=time*1.5+p.phase;p.g.alpha=time>.24&&time<.92?Math.sin(Math.PI*u)*Math.min(1,(time-.24)/.13,(.92-time)/.2)*.8:0})
    for(const p of fragments){const age=time-.78,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.9:0;if(age>=0){p.g.position.set(point.x+Math.cos(p.a)*p.v*age,point.y+Math.sin(p.a)*p.v*age+22*age*age);p.g.rotation=age*3}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-11,rotation:-.055,duration:.26},0)
    .to(attacker,{x:pose.x-r*.7,y:pose.y-r*.65,rotation:-.035,duration:.26,ease:'power2.out'},.26)
    .to(attacker,{...pose,duration:.26,ease:'power3.in'},.52)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.55,ease:'power2.inOut'},1.01)
    .to(fist,{alpha:1,duration:.15},.19).to(fist,{alpha:0,duration:.26},.91)
    .to(flash,{alpha:1,duration:.035},.78).to(flash.scale,{x:1.22,y:1.22,duration:.2},.78).to(flash,{alpha:0,rotation:.2,duration:.28},.85)
    .call(()=>{update(.78);onCue({type:'impact'});defender.tint=0xc6dfed},[],.78)
    .to(defender,{x:defenderHome.x+12,duration:.07,repeat:3,yoyo:true},.78).call(()=>{defender.tint=0xffffff},[],1.06)
}
