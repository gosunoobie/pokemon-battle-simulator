import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function selfDestruct(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const r=Math.min(80,Math.max(46,context.source.metrics.height/unit*.31)),center=socket('center')
  const charge=new Graphics().circle(0,0,r*.61).stroke({color:0xeed5b1,width:2}).circle(0,0,r*.48).stroke({color:0xf7e7cb,width:1.2})
  charge.label='self-destruct-charge';charge.alpha=0;temporary.addChild(charge)
  const burst=new Container();burst.label='self-destruct-burst';burst.alpha=0;temporary.addChild(burst)
  const outline=[];for(let i=0;i<24;i++){const a=i*Math.PI/12,d=r*(i%2?.6:1);outline.push(Math.cos(a)*d,Math.sin(a)*d)}
  burst.addChild(new Graphics().poly(outline).fill({color:0xe6a269,alpha:.8}).circle(0,0,r*.6).fill({color:0xf5cf92,alpha:.85}).circle(0,0,r*.32).fill(0xfff0c7))
  const ring=new Graphics().circle(0,0,r*.7).stroke({color:0xf7dfb5,width:2.3});ring.alpha=0;temporary.addChild(ring)
  const front=new Graphics().moveTo(-r*.17,-r*.58).quadraticCurveTo(r*.17,0,-r*.17,r*.58).stroke({color:0xf4d5a3,width:3.4,cap:'round'})
    .moveTo(-r*.29,-r*.43).quadraticCurveTo(-r*.03,0,-r*.29,r*.43).stroke({color:0xe6c89d,width:1.5,alpha:.65,cap:'round'})
  front.label='self-destruct-front';front.alpha=0;temporary.addChild(front)
  const hit=new Graphics().ellipse(0,0,r*.22,r*.47).stroke({color:0xf8dfb6,width:2.2});hit.label='self-destruct-impact';hit.alpha=0;temporary.addChild(hit)
  const draw={progress:0},pieces=Array.from({length:18},(_,i)=>{const g=new Graphics().poly([-2,-1,6,0,-2,2]).fill(i%3?0xe7b982:0xffe3ad);g.alpha=0;temporary.addChild(g);return{g,a:i*Math.PI/9,v:65+random()*100,life:.35+random()*.22}})
  const dust=Array.from({length:8},(_,i)=>{const g=new Graphics().ellipse(0,0,r*.2,r*.12).fill(i%2?0xa89b87:0xc4b49a);g.alpha=0;temporary.addChild(g);return{g,a:i*Math.PI/4,v:25+random()*35,life:.58+random()*.18,start:.64+i*.025}})
  const update=time=>{
    const from=socket('center',true),to=targetSocket('center',true)
    charge.position.copyFrom(from);burst.position.copyFrom(center);ring.position.copyFrom(center);hit.position.copyFrom(to)
    front.position.set(center.x+(to.x-center.x)*draw.progress,center.y+(to.y-center.y)*draw.progress)
    front.rotation=Math.atan2(to.y-center.y,to.x-center.x)
    for(const p of pieces){const age=time-.5,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.85:0;if(age>=0){p.g.position.set(center.x+Math.cos(p.a)*p.v*age,center.y+Math.sin(p.a)*p.v*age+45*age*age);p.g.rotation=p.a}}
    for(const p of dust){const age=time-p.start,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.3:0;if(age>=0){p.g.position.set(center.x+Math.cos(p.a)*(r*.42+p.v*age),center.y+Math.sin(p.a)*r*.4-age*25);p.g.scale.set(1+age*.8)}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x+2,duration:.05,repeat:5,yoyo:true},.14).set(attacker,{x:home.x},.46)
    .to(charge,{alpha:.8,duration:.14},.08).to(charge.scale,{x:.55,y:.55,duration:.22,ease:'power2.in'},.25).to(charge,{alpha:0,duration:.07},.47)
    .to(burst,{alpha:1,duration:.025},.5).fromTo(burst.scale,{x:.4,y:.4},{x:1.03,y:1.03,duration:.16,ease:'power3.out'},.5).to(burst,{alpha:0,duration:.23},.61)
    .to(ring,{alpha:.8,duration:.03},.5).to(ring.scale,{x:1.55,y:1.55,duration:.36},.5).to(ring,{alpha:0,duration:.29},.58)
    .to(front,{alpha:.9,duration:.04},.5).to(draw,{progress:1,duration:.34,ease:'none'},.5).to(front,{alpha:0,duration:.17},.86)
    .to(hit,{alpha:.9,duration:.03},.84).to(hit.scale,{x:1.35,y:1.2,duration:.22},.84).to(hit,{alpha:0,duration:.2},.9)
    .call(()=>{update(.84);onCue({type:'impact'});defender.tint=0xecc5a0},[],.84)
    .to(defender,{x:defenderHome.x+10,duration:.065,repeat:3,yoyo:true},.84).call(()=>{defender.tint=0xffffff},[],1.12)
}
