import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function dynamicPunch(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('fist')?'fist':'hand'
  const r=Math.min(41,Math.max(25,context.source.metrics.height/unit*.17)),point={x:focus.x,y:focus.y+6},rotation=.1
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(rotation)*r,y:point.y-Math.sin(rotation)*r})
  const fist=new Container();fist.label='dynamic-punch-fist';fist.alpha=0;temporary.addChild(fist)
  fist.addChild(new Graphics().moveTo(-r*.65,-r*.28).lineTo(-r*.35,-r*.64).lineTo(r*.72,-r*.64).lineTo(r,-r*.37)
    .lineTo(r,r*.21).quadraticCurveTo(r*.79,r*.59,r*.3,r*.61).lineTo(-r*.3,r*.47).lineTo(-r*.67,r*.1).closePath()
    .fill(0xe9ae78).stroke({color:0xffe2b3,width:2.2,join:'round'})
    .moveTo(-r*.17,-r*.51).lineTo(-r*.16,-r*.18).moveTo(r*.23,-r*.51).lineTo(r*.23,-r*.17)
    .moveTo(-r*.46,0).quadraticCurveTo(0,-r*.03,r*.37,r*.28).stroke({color:0xa8704e,width:1.8,cap:'round'}))
  const bang=new Graphics();bang.label='dynamic-punch-impact';bang.position.copyFrom(point);bang.alpha=0
  const outline=[];for(let i=0;i<18;i++){const a=i*Math.PI/9,d=r*(i%2?.58:1.5);outline.push(Math.cos(a)*d,Math.sin(a)*d)}
  bang.poly(outline).fill(0xf0b676).circle(0,0,r*.52).fill(0xffedbd).circle(0,0,r*.2).fill(0xfff9e5);temporary.addChild(bang)
  const fragments=Array.from({length:21},()=>{const g=new Graphics().poly([-2,-2,7,0,-2,2]).fill(random()<.5?0xffe2ab:0xe7b382);g.alpha=0;temporary.addChild(g);return{g,a:random()*Math.PI*2,v:80+random()*105,life:.3+random()*.23}})
  const dizzy=new Container();dizzy.label='dynamic-punch-dizzy';dizzy.alpha=0;temporary.addChild(dizzy)
  const orbit=new Graphics();dizzy.addChild(orbit)
  const stars=Array.from({length:3},()=>{const g=new Graphics().poly([0,-5,1.6,-1.6,5,0,1.6,1.6,0,5,-1.6,1.6,-5,0,-1.6,-1.6]).fill(0xffdf97);dizzy.addChild(g);return g})
  const update=time=>{
    fist.position.copyFrom(socket(attachment,true));fist.rotation=attacker.rotation
    const center=targetSocket('center',true),height=Math.min(73,context.target.metrics.height/unit*.39)
    dizzy.position.set(center.x,center.y-height);orbit.clear()
    const a=time*4.5;for(let i=0;i<=24;i++){const t=a+i/24*Math.PI*1.4,x=Math.cos(t)*r*.78,y=Math.sin(t)*r*.18;i?orbit.lineTo(x,y):orbit.moveTo(x,y)}
    orbit.stroke({color:0xe4c797,width:1.3,alpha:.65})
    stars.forEach((g,i)=>{const t=a+i*Math.PI*2/3;g.position.set(Math.cos(t)*r*.78,Math.sin(t)*r*.18);g.rotation=-time*1.8})
    for(const p of fragments){const age=time-.7,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.85:0;if(age>=0){p.g.position.set(point.x+Math.cos(p.a)*p.v*age,point.y+Math.sin(p.a)*p.v*age+35*age*age);p.g.rotation=p.a+age*2}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-14,rotation:-.075,duration:.3},0).to(attacker,{...pose,duration:.4,ease:'power3.in'},.3)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.52,ease:'power2.inOut'},.98)
    .to(fist,{alpha:1,duration:.17},.2).to(fist,{alpha:0,duration:.24},.84)
    .to(bang,{alpha:1,duration:.02},.7).to(bang.scale,{x:1.17,y:1.17,duration:.17},.7).to(bang,{alpha:0,rotation:.08,duration:.23},.79)
    .to(dizzy,{alpha:1,duration:.2},.95).to(dizzy,{alpha:0,duration:.35},1.78)
    .call(()=>{update(.7);onCue({type:'impact'});defender.tint=0xefcaa5},[],.7)
    .to(defender,{x:defenderHome.x+11,duration:.065,repeat:5,yoyo:true},.7).call(()=>{defender.tint=0xffffff},[],1.1)
}
