import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function focusPunch(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('fist')?'fist':'hand'
  const r=Math.min(43,Math.max(26,context.source.metrics.height/unit*.17)),point={x:focus.x,y:focus.y+5},rotation=.09
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(rotation)*r,y:point.y-Math.sin(rotation)*r})
  const fist=new Container();fist.label='focus-punch-fist';fist.alpha=0;temporary.addChild(fist)
  const aura=new Graphics();fist.addChild(aura)
  fist.addChild(new Graphics().poly([-r*.66,-r*.3,-r*.31,-r*.62,r*.73,-r*.62,r,-r*.32,r,r*.21,r*.67,r*.53,r*.08,r*.63,-r*.59,r*.32])
    .fill(0xf4d4a0).stroke({color:0xfff2cf,width:2.3,join:'round'})
    .moveTo(-r*.14,-r*.5).lineTo(-r*.14,-r*.15).moveTo(r*.24,-r*.5).lineTo(r*.24,-r*.15).moveTo(r*.59,-r*.46).lineTo(r*.59,-r*.12)
    .moveTo(-r*.42,0).quadraticCurveTo(r*.03,-r*.09,r*.33,r*.25).stroke({color:0xb99360,width:1.5,cap:'round'}))
  const draw={charge:0},converge=new Graphics();converge.label='focus-punch-charge';temporary.addChild(converge)
  const flash=new Graphics().poly([-r*.36,0,-r*.06,-r*.07,0,-r*.5,r*.06,-r*.07,r*.36,0,r*.06,r*.07,0,r*.5,-r*.06,r*.07]).fill(0xfff7df)
  flash.alpha=0;fist.addChild(flash)
  const strike=new Graphics();strike.label='focus-punch-impact';strike.position.copyFrom(point);strike.alpha=0
  strike.poly([-r*.7,0,-r*.14,-r*.1,0,-r*1.43,r*.14,-r*.1,r*.7,0,r*.14,r*.1,0,r*1.43,-r*.14,r*.1]).fill(0xfff0c9)
    .ellipse(0,0,r*.35,r*.83).stroke({color:0xf3d6a4,width:2.2});temporary.addChild(strike)
  const rays=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5,g=new Graphics().moveTo(Math.cos(a)*r*.7,Math.sin(a)*r*.7).lineTo(Math.cos(a)*r*1.18,Math.sin(a)*r*1.18).stroke({color:i%2?0xe4c291:0xffedbb,width:1.8,cap:'round'});g.position.copyFrom(point);g.alpha=0;temporary.addChild(g);return g})
  const update=time=>{
    const hand=socket(attachment,true);fist.position.copyFrom(hand);fist.rotation=attacker.rotation;converge.position.copyFrom(hand);converge.clear();aura.clear()
    converge.alpha=time>=.2&&time<.2+11*.028+.65?1:0
    for(let i=0;i<12;i++){
      const age=time-.2-i*.028,u=age/.65,a=i*Math.PI/6
      if(u>=0&&u<1){const reach=r*(1.8-u*1.05);converge.moveTo(Math.cos(a)*reach,Math.sin(a)*reach).lineTo(Math.cos(a)*(reach+r*.22),Math.sin(a)*(reach+r*.22)).stroke({color:i%2?0xffe5b0:0xdab481,width:1.5,alpha:Math.sin(u*Math.PI)*.85,cap:'round'})}
    }
    for(let i=0;i<2;i++){const radius=r*(1.08-i*.15)*(1-draw.charge*.24);aura.ellipse(0,0,radius,radius*.82).stroke({color:i?0xffedbf:0xdbb782,width:i?1.5:2,alpha:draw.charge*.7})}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-15,rotation:-.065,duration:.28},0)
    .to(attacker,{...pose,duration:.34,ease:'power4.in'},1)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.62,ease:'power2.inOut'},1.58)
    .to(fist,{alpha:1,duration:.24},.16).to(fist,{alpha:0,duration:.28},1.5)
    .to(draw,{charge:1,duration:.75},.18).to(draw,{charge:0,duration:.2},1.37)
    .to(flash,{alpha:1,duration:.055},.9).to(flash,{alpha:0,duration:.18},.96)
    .to(strike,{alpha:1,duration:.025},1.34).to(strike.scale,{x:1.25,y:1.16,duration:.2},1.34).to(strike,{alpha:0,duration:.28},1.42)
    .call(()=>{update(1.34);onCue({type:'impact'});defender.tint=0xf0d8b4},[],1.34)
    .to(defender,{x:defenderHome.x+18,duration:.085,repeat:3,yoyo:true},1.34).call(()=>{defender.tint=0xffffff},[],1.68)
  rays.forEach((g,i)=>{const at=1.34+i*.009;tl.to(g,{alpha:.9,duration:.035},at).to(g.scale,{x:1.22,y:1.22,duration:.25},at).to(g,{alpha:0,duration:.22},at+.07)})
}
