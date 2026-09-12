import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function dragonRage(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, unit } = bindEffectSpace(context)
  const base=socket('emission'),origin={x:base.x+8,y:base.y}
  const radius=Math.min(32,Math.max(20,context.target.metrics.height/unit*.16))
  const bow=Math.min(20,Math.hypot(focus.x-origin.x,focus.y-origin.y)*.05)
  const flare=new Container();flare.label='dragon-rage-flare';flare.alpha=0;temporary.addChild(flare)
  const tail=new Graphics();flare.addChild(tail)
  flare.addChild(new Graphics().moveTo(radius*.75,0).quadraticCurveTo(radius*.24,-radius*.9,-radius*.65,-radius*.72)
    .lineTo(-radius*1.5,-radius).lineTo(-radius*1.15,-radius*.24).lineTo(-radius*2.3,-radius*.06)
    .lineTo(-radius*1.15,radius*.3).lineTo(-radius*1.55,radius*.87)
    .quadraticCurveTo(radius*.2,radius*.95,radius*.75,0).closePath().fill(0x7875d0)
    .ellipse(0,0,radius*.66,radius*.58).fill(0xb982cf)
    .moveTo(radius*.51,0).quadraticCurveTo(0,-radius*.6,-radius*.94,-radius*.16)
    .lineTo(-radius*.46,0).lineTo(-radius*.95,radius*.3).quadraticCurveTo(radius*.1,radius*.46,radius*.51,0).closePath().fill(0xee9c9a)
    .ellipse(radius*.07,0,radius*.28,radius*.3).fill(0xffe7bf))
  const charge=new Graphics();charge.label='dragon-rage-charge';temporary.addChild(charge)
  const sparks=[]
  for(let i=0;i<22;i++){
    const g=new Graphics().poly([-3,-2,8+random()*8,0,-3,2,0,0]).fill(i%3?0xc49bed:0xffd19f)
    g.alpha=0;temporary.addChild(g);sparks.push({g,angle:random()*Math.PI*2,speed:75+random()*85,life:.3+random()*.2})
  }
  const update=time=>{
    charge.clear();charge.position.copyFrom(socket('emission',true));charge.alpha=time>=.08&&time<.46?1:0
    if(time>=.08&&time<.46){
      const u=(time-.08)/.38,r=radius*(.3+.55*u)
      charge.ellipse(0,0,r,r*.72).fill({color:0xa58be7,alpha:.16+.16*u})
      for(let i=0;i<2;i++)charge.arc(0,0,r*(1+i*.22),time*12+i*Math.PI,time*12+i*Math.PI+2.1).stroke({color:i?0xf3c4bb:0xbdc8ff,width:2,alpha:u,cap:'round'})
    }
    tail.clear()
    if(time>=.46&&time<1.18){
      const u=Math.min(1,(time-.46)/.54),p=u**1.6
      flare.position.set(origin.x+(focus.x-origin.x)*p,origin.y+(focus.y-origin.y)*p-Math.sin(p*Math.PI)*bow)
      flare.rotation=Math.atan2(focus.y-origin.y-Math.cos(p*Math.PI)*Math.PI*bow,focus.x-origin.x)
      flare.scale.set(1,.92+Math.sin(time*37)*.08)
      flare.alpha=Math.min(1,(time-.46)/.055)*Math.max(0,1-Math.max(0,time-1)/.18)
      for(let i=0;i<3;i++){
        for(let j=0;j<=18;j++){
          const v=j/18,x=-radius*(.5+v*2.8),y=(Math.sin(v*8-time*31+i*1.5)*.22+(i-1)*.24)*radius*(1-v)
          if(j===0)tail.moveTo(x,y);else tail.lineTo(x,y)
        }
        tail.stroke({color:i===1?0xefb2a7:0xadb7fc,width:i===1?4:2,alpha:.65,cap:'round'})
      }
    }else flare.alpha=0
    for(const p of sparks){const age=time-1;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(focus.x+Math.cos(p.angle)*p.speed*age,focus.y+Math.sin(p.angle)*p.speed*age);p.g.rotation=p.angle;p.g.alpha=Math.sin(Math.PI*age/p.life)}
  }
  onFrame(update)
  const impact=new Graphics().poly([-radius*1.5,0,-7,-7,0,-radius*1.5,7,-7,radius*1.5,0,7,7,0,radius*1.5,-7,7]).fill(0xffe6c3)
  impact.position.copyFrom(focus);impact.alpha=0;temporary.addChild(impact)
  const ring=new Graphics().ellipse(0,0,radius*.7,radius*.9).stroke({color:0xc6abf0,width:3})
  ring.position.copyFrom(focus);ring.alpha=0;temporary.addChild(ring)
  tl.to(attacker,{x:home.x-10,duration:.25},0).to(attacker,{x:home.x+8,duration:.19,ease:'power2.out'},.25)
    .to(attacker,{x:home.x,duration:.45,ease:'power2.inOut'},1.2)
    .to(impact,{alpha:1,duration:.025},1).to(impact,{alpha:0,duration:.18},1.07)
    .to(ring,{alpha:1,duration:.03},1).to(ring.scale,{x:2,y:1.7,duration:.4},1).to(ring,{alpha:0,duration:.32},1.08)
    .call(()=>{update(1);onCue({type:'impact'});defender.tint=0xd6b6eb},[],1)
    .to(defender,{x:defenderHome.x+12,duration:.065,repeat:3,yoyo:true},1)
    .call(()=>{defender.tint=0xffffff},[],1.27)
}
