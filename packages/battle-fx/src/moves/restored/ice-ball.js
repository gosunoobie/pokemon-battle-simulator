import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function iceBall(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, defenderHome, focus, floor, socket, unit } = bindEffectSpace(context)
  const center=socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'),ground=socket('floor'),r=Math.min(63,Math.max(28,context.source.metrics.height/unit*.28))
  const tuck=Math.min(.68,r*1.45/(Math.max(context.source.metrics.width,context.source.metrics.height)/unit))
  const start={x:center.x,y:ground.y-r},end={x:focus.x-r*.86,y:floor.y-r}
  const clamp=u=>Math.max(0,Math.min(1,u)),smooth=u=>u*u*(3-2*u)
  const path=u=>({x:start.x+(end.x-start.x)*u,y:start.y+(end.y-start.y)*u-Math.sin(Math.PI*u*2)**2*r*.34})
  const shell=new Container();shell.label='ice-ball-shell';shell.alpha=0;temporary.addChild(shell)
  const facets=new Graphics().circle(0,0,r).fill({color:0x8ddaf4,alpha:.12}).stroke({color:0xccf6ff,width:2.8,alpha:.9})
    .poly([-r*.75,-r*.3,-r*.26,-r*.82,r*.32,-r*.72,r*.09,-r*.12]).fill({color:0xf1fdff,alpha:.16})
    .poly([r*.09,-r*.12,r*.73,-r*.46,r*.78,r*.43,r*.21,r*.76]).fill({color:0x76bce7,alpha:.2})
    .moveTo(-r*.8,r*.2).lineTo(-r*.3,r*.1).lineTo(-r*.13,-r*.25).lineTo(r*.25,-r*.4)
    .moveTo(-r*.3,r*.1).lineTo(-r*.1,r*.52).lineTo(r*.22,r*.77)
    .stroke({color:0xe6fcff,width:1.4,alpha:.8})
    .moveTo(Math.cos(-2.6)*r*.87,Math.sin(-2.6)*r*.87).arc(0,0,r*.87,-2.6,-1).stroke({color:0xffffff,width:3,alpha:.8,cap:'round'})
  shell.addChild(facets)
  const crystals=[]
  for(let i=0;i<34;i++){
    const impact=i>=12,at=impact?1.04+(i-12)*.006:.36+i*.052
    const origin=impact?{x:focus.x,y:end.y}:path(clamp((at-.34)/.7))
    const size=impact?3+random()*5:1.8+random()*2
    const shard=new Graphics().poly([0,-size*1.7,size*.7,0,0,size*1.4,-size*.65,0]).fill(i%3?0xc8f4ff:0x8ecce7)
      .moveTo(0,-size*1.4).lineTo(0,size).stroke({color:0xffffff,width:1,alpha:.6})
    shard.alpha=0;temporary.addChild(shard)
    const a=random()*Math.PI*2,speed=30+random()*85
    crystals.push({shard,at,life:impact?.48+random()*.16:.36,x:origin.x,y:origin.y+(impact?0:r*.75),vx:impact?Math.cos(a)*speed:-15-random()*22,vy:impact?Math.sin(a)*speed-20:-10-random()*13,spin:(random()-.5)*9})
  }
  function update(time) {
    let p,scale,angle
    if(time<.34){const u=smooth(clamp(time/.34));p={x:center.x,y:center.y+(start.y-center.y)*u};scale=1+(tuck-1)*u;angle=u*.4}
    else if(time<1.04){const u=clamp((time-.34)/.7);p=path(u);scale=tuck;angle=.4+u*Math.PI*3.5}
    else {const u=smooth(clamp((time-1.04)/.92)),grow=smooth(clamp((u-.28)/.72));p={x:end.x+(center.x-end.x)*u,y:end.y+(center.y-end.y)*u-Math.sin(Math.PI*u)*r*.52};scale=tuck+(1-tuck)*grow;angle=(.4+Math.PI*3.5)*(1-u)}
    const c=Math.cos(angle),s=Math.sin(angle);attacker.scale.set(scale);attacker.rotation=angle
    attacker.x=p.x-center.x*scale*c+center.y*scale*s;attacker.y=p.y-center.x*scale*s-center.y*scale*c
    shell.position.copyFrom(p);facets.rotation=angle;shell.scale.set(1+Math.sin(time*11)*.015)
    shell.alpha=clamp((time-.08)/.24)*(1-clamp((time-1.04)/.18))
    for(const q of crystals){const age=time-q.at;if(age<0||age>q.life){q.shard.alpha=0;continue}q.shard.position.set(q.x+q.vx*age,q.y+q.vy*age+65*age*age);q.shard.rotation=age*q.spin;q.shard.alpha=Math.sin(Math.PI*age/q.life)*.92}
  }
  onFrame(update)
  const burst=new Graphics().circle(0,0,r*.4).stroke({color:0xecfdff,width:3})
  burst.position.set(focus.x,end.y);burst.alpha=0;temporary.addChild(burst)
  tl.to(burst,{alpha:.95,duration:.03},1.04).to(burst.scale,{x:2,y:1.5,duration:.24},1.04).to(burst,{alpha:0,duration:.22},1.09)
    .call(()=>{update(1.04);onCue({type:'impact'});defender.tint=0xc4eaff},[],1.04)
    .to(defender,{x:defenderHome.x+9,duration:.07,repeat:3,yoyo:true},1.04)
    .call(()=>{defender.tint=0xffffff},[],1.28)
}
