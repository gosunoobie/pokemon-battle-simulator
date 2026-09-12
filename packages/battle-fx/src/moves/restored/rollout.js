import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function rollout(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, defenderHome, focus, floor, socket, unit } = bindEffectSpace(context)
  const center=socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'),ground=socket('floor'),r=Math.min(62,Math.max(27,context.source.metrics.height/unit*.27))
  const tuck=Math.min(.7,r*1.48/(Math.max(context.source.metrics.width,context.source.metrics.height)/unit))
  const start={x:center.x,y:ground.y-r},end={x:focus.x-r*.84,y:floor.y-r*.95}
  const clamp=u=>Math.max(0,Math.min(1,u)),smooth=u=>u*u*(3-2*u)
  const travel=p=>({x:start.x+(end.x-start.x)*p*p,y:start.y+(end.y-start.y)*p*p-Math.sin(p*Math.PI*3)**2*r*.065})
  const turns=Math.hypot(end.x-start.x,end.y-start.y)/r
  const shell=new Container();shell.label='rollout-shell';shell.alpha=0;temporary.addChild(shell)
  const rim=new Graphics()
  const outline=[];for(let i=0;i<12;i++){const a=i*Math.PI/6,rr=r*(i%2?.98:1);outline.push(Math.cos(a)*rr,Math.sin(a)*rr)}
  rim.poly(outline).fill({color:0x9e8057,alpha:.08}).stroke({color:0xc8ae82,width:3,alpha:.8})
    .moveTo(Math.cos(-2.7)*r*.88,Math.sin(-2.7)*r*.88).arc(0,0,r*.88,-2.7,-.7).stroke({color:0xefe0bb,width:2,alpha:.7})
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rim.moveTo(Math.cos(a)*r*.98,Math.sin(a)*r*.98).lineTo(Math.cos(a+.12)*r*.78,Math.sin(a+.12)*r*.78).lineTo(Math.cos(a-.1)*r*.68,Math.sin(a-.1)*r*.68)}
  rim.stroke({color:0x8f7858,width:1.8,alpha:.7});shell.addChild(rim)
  const dust=[]
  for(let i=0;i<28;i++){
    const impact=i>=10,at=impact?.88+(i-10)*.008:.25+i*.052
    const origin=impact?{x:focus.x,y:floor.y-3}:travel(clamp((at-.22)/.66))
    const dot=new Graphics().ellipse(0,0,impact?3+random()*3:4+random()*4,2+random()*2).fill(i%3?0xc1af89:0x8e805e)
    dot.alpha=0;temporary.addChild(dot)
    dust.push({dot,at,life:impact?.48+random()*.15:.44,x:origin.x,y:impact?origin.y:origin.y+r,vx:impact?(random()-.5)*120:-25-random()*35,vy:-16-random()*42})
  }
  function update(time) {
    let p,scale,angle
    if(time<.22){const u=smooth(clamp(time/.22));p={x:center.x,y:center.y+(start.y-center.y)*u};scale=1+(tuck-1)*u;angle=u*Math.PI*.5}
    else if(time<.88){const u=clamp((time-.22)/.66);p=travel(u);scale=tuck;angle=Math.PI*.5+turns*u*u}
    else if(time<1.1){const u=clamp((time-.88)/.22);p={x:end.x-r*.55*u,y:end.y-Math.sin(Math.PI*u)*r*.32};scale=tuck;angle=Math.PI*.5+turns+u*.5}
    else {const u=smooth(clamp((time-1.1)/.7)),grow=smooth(clamp((u-.4)/.6));p={x:end.x-r*.55+(center.x-end.x+r*.55)*u,y:end.y+(center.y-end.y)*u-Math.sin(Math.PI*u)*r*.28};scale=tuck+(1-tuck)*grow;angle=(Math.PI*.5+turns+.5)*(1-u)}
    const c=Math.cos(angle),s=Math.sin(angle);attacker.scale.set(scale);attacker.rotation=angle
    attacker.x=p.x-center.x*scale*c+center.y*scale*s;attacker.y=p.y-center.x*scale*s-center.y*scale*c
    shell.position.copyFrom(p);rim.rotation=angle;shell.alpha=clamp(time/.2)*(1-clamp((time-.91)/.27))
    for(const q of dust){const age=time-q.at;if(age<0||age>q.life){q.dot.alpha=0;continue}q.dot.position.set(q.x+q.vx*age,q.y+q.vy*age+70*age*age);q.dot.scale.set(1+age*.7);q.dot.alpha=Math.sin(Math.PI*age/q.life)*.65}
  }
  onFrame(update)
  const ring=new Graphics().ellipse(0,0,r*.9,r*.19).stroke({color:0xe2cfa3,width:2.5,alpha:.8})
  ring.position.set(focus.x,floor.y);ring.alpha=0;temporary.addChild(ring)
  tl.to(ring,{alpha:.8,duration:.04},.88).to(ring.scale,{x:1.5,y:1.4,duration:.36},.88).to(ring,{alpha:0,duration:.28},.98)
    .call(()=>{update(.88);onCue({type:'impact'});defender.tint=0xe7d8b6},[],.88)
    .to(defender,{x:defenderHome.x+11,duration:.065,repeat:5,yoyo:true},.88)
    .call(()=>{defender.tint=0xffffff},[],1.14)
}
