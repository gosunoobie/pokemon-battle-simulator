import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function flameWheel(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, defenderHome, focus, socket, unit } = bindEffectSpace(context)
  const center=socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'),ground=socket('floor'),r=Math.min(65,Math.max(29,context.source.metrics.height/unit*.3))
  const tuck=Math.min(.74,r*1.5/(Math.max(context.source.metrics.width,context.source.metrics.height)/unit))
  const start={x:center.x,y:ground.y-r},end={x:focus.x-r*.8,y:focus.y+8}
  const clamp=u=>Math.max(0,Math.min(1,u)),smooth=u=>u*u*(3-2*u)
  const route=u=>{const p=u*u;return{x:start.x+(end.x-start.x)*p,y:start.y+(end.y-start.y)*p-Math.sin(Math.PI*u)*r*.24}}
  const wheel=new Container();wheel.label='flame-wheel-ring';wheel.alpha=0;temporary.addChild(wheel)
  const fire=new Graphics();wheel.addChild(fire)
  const embers=[]
  for(let i=0;i<38;i++){
    const impact=i>=18,at=impact?.86+(i-18)*.006:.3+i*.027
    const p=impact?{x:focus.x,y:focus.y+8}:route(clamp((at-.28)/.58))
    const ember=new Graphics().poly([0,-4,2.5,0,0,6,-2.5,0]).fill(i%3?0xffb956:0xff7545)
    ember.alpha=0;temporary.addChild(ember)
    const a=(random()-.5)*Math.PI*1.4,speed=35+random()*70
    embers.push({ember,at,life:.3+random()*.2,x:p.x-(impact?0:r*.6),y:p.y+(random()-.5)*r*.7,vx:impact?Math.cos(a)*speed:-30-random()*65,vy:impact?Math.sin(a)*speed:-8-random()*25,scale:.5+random()*.8})
  }
  function update(time) {
    let p,scale,angle
    if(time<.28){const u=smooth(clamp(time/.28));p={x:center.x,y:center.y+(start.y-center.y)*u};scale=1+(tuck-1)*u;angle=u*.5}
    else if(time<.86){const u=clamp((time-.28)/.58);p=route(u);scale=tuck;angle=.5+u*u*Math.PI*4}
    else {const u=smooth(clamp((time-.86)/.88)),grow=smooth(clamp((u-.36)/.64));p={x:end.x+(center.x-end.x)*u,y:end.y+(center.y-end.y)*u-Math.sin(Math.PI*u)*r*.5};scale=tuck+(1-tuck)*grow;angle=(.5+Math.PI*4)*(1-u)}
    const c=Math.cos(angle),s=Math.sin(angle);attacker.scale.set(scale);attacker.rotation=angle
    attacker.x=p.x-center.x*scale*c+center.y*scale*s;attacker.y=p.y-center.x*scale*s-center.y*scale*c
    wheel.position.copyFrom(p);wheel.rotation=angle
    wheel.alpha=clamp((time-.06)/.2)*(1-clamp((time-.9)/.32))
    fire.clear().circle(0,0,r*.92).stroke({color:0xe96638,width:r*.17,alpha:.45})
      .circle(0,0,r*.84).stroke({color:0xffc266,width:2.2,alpha:.8})
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5,tip=r*(1.08+.12*Math.sin(time*27+i*1.9))
      const x=Math.cos(a),y=Math.sin(a),tx=-y,ty=x
      fire.moveTo(x*r*.82-tx*r*.12,y*r*.82-ty*r*.12)
        .quadraticCurveTo(x*tip-tx*r*.28,y*tip-ty*r*.28,x*tip+tx*r*.2,y*tip+ty*r*.2)
        .quadraticCurveTo(x*r*.9+tx*r*.05,y*r*.9+ty*r*.05,x*r*.74,y*r*.74).closePath()
        .fill(i%2?0xff8c3c:0xffb451)
      fire.moveTo(x*r*.82,y*r*.82).lineTo(x*r*1.04+tx*r*.1,y*r*1.04+ty*r*.1)
        .stroke({color:0xffedaa,width:2,alpha:.85,cap:'round'})
    }
    for(const q of embers){const age=time-q.at;if(age<0||age>q.life){q.ember.alpha=0;continue}q.ember.position.set(q.x+q.vx*age,q.y+q.vy*age-18*age*age);q.ember.rotation=Math.atan2(q.vy,q.vx)-Math.PI/2;q.ember.scale.set(q.scale*(1-age/q.life*.5));q.ember.alpha=Math.sin(Math.PI*age/q.life)*.9}
  }
  onFrame(update)
  const flash=new Graphics().poly([0,-26,7,-7,29,0,7,7,0,26,-7,7,-23,0,-7,-7]).fill(0xffdd8d)
  flash.position.set(focus.x,focus.y+8);flash.alpha=0;temporary.addChild(flash)
  tl.to(flash,{alpha:.9,duration:.025},.86).to(flash.scale,{x:1.25,y:1.25,duration:.16},.86).to(flash,{alpha:0,duration:.2},.91)
    .call(()=>{update(.86);onCue({type:'impact'});defender.tint=0xffd297},[],.86)
    .to(defender,{x:defenderHome.x+10,duration:.065,repeat:3,yoyo:true},.86)
    .call(()=>{defender.tint=0xffffff},[],1.09)
}
