import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function triAttack(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, unit } = bindEffectSpace(context)
  const radius=Math.min(16,Math.max(10,context.target.metrics.height/unit*.08)),formation=radius*2.4
  const base=socket('emission'),origin={x:base.x+8,y:base.y},palette=[0xffa55e,0xffe77b,0x9ce4ff]
  const link=new Graphics();temporary.addChild(link)
  const orbs=[],pieces=[]
  for(let i=0;i<3;i++){
    const trail=new Graphics();temporary.addChild(trail)
    const orb=new Container();orb.label='tri-attack-orb-'+i;orb.alpha=0;temporary.addChild(orb)
    orb.addChild(new Graphics().circle(0,0,radius*1.35).fill({color:palette[i],alpha:.13})
      .circle(0,0,radius).fill({color:palette[i],alpha:.74}).circle(0,0,radius*.65).stroke({color:0xfff9ee,width:1.3,alpha:.75}))
    const motif=new Graphics()
    if(i===0)motif.moveTo(0,radius*.5).quadraticCurveTo(-radius*.65,0,0,-radius*.7).lineTo(radius*.13,-radius*.13)
      .lineTo(radius*.42,-radius*.4).quadraticCurveTo(radius*.65,radius*.35,0,radius*.5).closePath().fill(0xfff2c2)
    else if(i===1)motif.poly([2,-radius*.7,-radius*.4,1,0,1,-2,radius*.65,radius*.4,-2,0,-2]).fill(0xffffda)
    else for(let j=0;j<3;j++){const a=j*Math.PI/3;motif.moveTo(-Math.cos(a)*radius*.6,-Math.sin(a)*radius*.6).lineTo(Math.cos(a)*radius*.6,Math.sin(a)*radius*.6).stroke({color:0xf0ffff,width:1.8,cap:'round'})}
    orb.addChild(motif);orbs.push({orb,trail,phase:-Math.PI/2+i*Math.PI*2/3,color:palette[i]})
    for(let j=0;j<6;j++){
      const g=new Graphics(),size=4+random()*4
      if(i===0)g.moveTo(0,-size).quadraticCurveTo(-size,size*.6,0,size).quadraticCurveTo(size,0,0,-size).closePath().fill(palette[i])
      else if(i===1)g.poly([-size,-3,0,0,-2,3,size,5]).stroke({color:palette[i],width:1.8})
      else g.poly([0,-size,size*.4,0,0,size,-size*.4,0]).fill(palette[i])
      g.alpha=0;temporary.addChild(g);pieces.push({g,angle:i*Math.PI*2/3+(random()-.5)*1.7,speed:60+random()*95,life:.3+random()*.2})
    }
  }
  const flightPoint=(p,u,time)=>{
    const a=p.phase+time*3+u*Math.PI*1.5,r=formation*(1-u)
    return {x:origin.x+(focus.x-origin.x)*u+Math.cos(a)*r,y:origin.y+(focus.y-origin.y)*u+Math.sin(a)*r}
  }
  const update=time=>{
    link.clear();link.alpha=time>=.12&&time<.56?1:0
    const u=Math.max(0,Math.min(1,(time-.48)/.58)),fade=Math.max(0,1-Math.max(0,time-1.06)/.17)
    for(const p of orbs){
      p.trail.clear();p.trail.alpha=time>=.48&&time<1.23?1:0
      if(time<.1||time>=1.23){p.orb.alpha=0;continue}
      const point=time<.48?socket('emission',true):flightPoint(p,u,time)
      if(time<.48){const grow=Math.min(1,(time-.1)/.23);point.x+=Math.cos(p.phase+time*3)*formation*grow;point.y+=Math.sin(p.phase+time*3)*formation*grow}
      p.orb.position.copyFrom(point);p.orb.alpha=Math.min(1,(time-.1)/.15)*fade;p.orb.scale.set(1-u*.4)
      if(time>=.48){
        for(let j=0;j<=14;j++){
          const v=Math.max(0,u-.18)+Math.min(u,.18)*j/14,q=flightPoint(p,v,time-(u-v)*.58)
          if(j===0)p.trail.moveTo(q.x,q.y);else p.trail.lineTo(q.x,q.y)
        }
        p.trail.stroke({color:p.color,width:2.6,alpha:.6*fade,cap:'round',join:'round'})
      }
    }
    if(time>=.12&&time<.56){
      orbs.forEach((p,i)=>i===0?link.moveTo(p.orb.x,p.orb.y):link.lineTo(p.orb.x,p.orb.y))
      link.closePath().stroke({color:0xe9ece4,width:1.2,alpha:Math.min(1,(time-.12)/.15)*Math.max(0,1-Math.max(0,time-.44)/.12)*.55})
    }
    for(const p of pieces){const age=time-1.06;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(focus.x+Math.cos(p.angle)*p.speed*age,focus.y+Math.sin(p.angle)*p.speed*age);p.g.rotation=p.angle+age*4;p.g.alpha=Math.sin(Math.PI*age/p.life)}
  }
  onFrame(update)
  const ring=new Graphics();for(let i=0;i<3;i++)ring.arc(0,0,23,i*Math.PI*2/3,i*Math.PI*2/3+1.8).stroke({color:palette[i],width:3.1,cap:'round'})
  ring.position.copyFrom(focus);ring.alpha=0;temporary.addChild(ring)
  const flash=new Graphics().poly([-25,0,-5,-5,0,-25,5,-5,25,0,5,5,0,25,-5,5]).fill(0xfffbe2)
  flash.position.copyFrom(focus);flash.alpha=0;temporary.addChild(flash)
  tl.to(attacker,{x:home.x-7,duration:.2},0).to(attacker,{x:home.x+8,duration:.22},.2)
    .to(attacker,{x:home.x,duration:.42,ease:'power2.inOut'},1.14)
    .to(flash,{alpha:1,duration:.025},1.06).to(flash,{alpha:0,duration:.19},1.12)
    .to(ring,{alpha:1,duration:.025},1.06).to(ring.scale,{x:2.1,y:2.1,duration:.4},1.06).to(ring,{alpha:0,duration:.32},1.14)
    .call(()=>{update(1.06);onCue({type:'impact'});defender.tint=0xffefd0},[],1.06)
    .to(defender,{x:defenderHome.x+10,duration:.065,repeat:3,yoyo:true},1.06)
    .call(()=>{defender.tint=0xffffff},[],1.32)
}
