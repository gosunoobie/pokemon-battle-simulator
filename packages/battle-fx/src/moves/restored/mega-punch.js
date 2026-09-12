import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function megaPunch(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('fist')?'fist':'hand'
  const r=Math.min(35,Math.max(20,context.source.metrics.height/unit*.13)),point={x:focus.x,y:focus.y+4},rotation=.07
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(rotation)*r,y:point.y-Math.sin(rotation)*r})
  const fist=new Container();fist.label='mega-punch-fist';fist.alpha=0;temporary.addChild(fist)
  fist.addChild(new Graphics().moveTo(-r*.65,-r*.25).lineTo(-r*.4,-r*.67).lineTo(r*.69,-r*.67)
    .quadraticCurveTo(r,-r*.67,r,-r*.36).lineTo(r,r*.24).quadraticCurveTo(r*.93,r*.49,r*.56,r*.5)
    .lineTo(r*.1,r*.66).lineTo(-r*.56,r*.44).closePath().fill(0xf1cd9e).stroke({color:0xb78860,width:1.8,join:'round'})
    .moveTo(-r*.27,-r*.54).lineTo(-r*.24,-r*.16).moveTo(r*.12,-r*.54).lineTo(r*.14,-r*.17).moveTo(r*.49,-r*.51).lineTo(r*.5,-r*.14)
    .moveTo(-r*.4,r*.03).quadraticCurveTo(r*.05,-r*.08,r*.39,r*.19).lineTo(r*.26,r*.45)
    .stroke({color:0xb38765,width:1.7,cap:'round'})
    .moveTo(r*.84,-r*.35).lineTo(r*.84,r*.13).stroke({color:0xffedd0,width:2.5,cap:'round'}))
  const wake=new Graphics().moveTo(-r*1.7,-r*.27).lineTo(-r*.76,-r*.27).moveTo(-r*2,0).lineTo(-r*.82,0)
    .moveTo(-r*1.6,r*.28).lineTo(-r*.78,r*.28).stroke({color:0xe4cfaa,width:2,alpha:.75,cap:'round'})
  fist.addChildAt(wake,0)
  const impact=new Graphics();impact.label='mega-punch-impact';impact.position.copyFrom(point);impact.alpha=0
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7,x=Math.cos(a),y=Math.sin(a),reach=r*(i%2?1.05:1.45);impact.poly([x*6-y*4,y*6+x*4,x*reach,y*reach,x*6+y*4,y*6-x*4]).fill(i%2?0xeac48f:0xffedc4)}
  temporary.addChild(impact)
  const ring=new Graphics().ellipse(0,0,r*.29,r*.72).stroke({color:0xffe7b7,width:3});ring.position.copyFrom(point);ring.alpha=0;temporary.addChild(ring)
  const chips=Array.from({length:13},()=>{const g=new Graphics().poly([-2,-1,6,0,-2,2]).fill(0xe7c89b);g.alpha=0;temporary.addChild(g);return{g,a:(random()-.5)*2.5,v:65+random()*90,life:.28+random()*.16}})
  const follow=()=>{fist.position.copyFrom(socket(attachment,true));fist.rotation=attacker.rotation}
  onFrame(time=>{follow();for(const p of chips){const age=time-.56,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.85:0;if(age>=0){p.g.position.set(point.x+Math.cos(p.a)*p.v*age,point.y+Math.sin(p.a)*p.v*age+40*age*age);p.g.rotation=p.a}}})
  tl.to(attacker,{x:home.x-12,rotation:-.07,duration:.22},0).to(attacker,{...pose,duration:.34,ease:'power3.in'},.22)
    .to(attacker,{x:pose.x-r*.45,y:pose.y,rotation:.02,duration:.12},.65)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.46,ease:'power2.inOut'},.84)
    .to(fist,{alpha:1,duration:.12},.16).to(fist,{alpha:0,duration:.22},.78)
    .to(impact,{alpha:1,duration:.025},.56).to(impact.scale,{x:1.2,y:1.1,duration:.17},.56).to(impact,{alpha:0,duration:.21},.63)
    .to(ring,{alpha:.9,duration:.035},.56).to(ring.scale,{x:1.6,y:1.25,duration:.25},.56).to(ring,{alpha:0,duration:.22},.63)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xedd6b3},[],.56)
    .to(defender,{x:defenderHome.x+12,duration:.065,repeat:3,yoyo:true},.56).call(()=>{defender.tint=0xffffff},[],.83)
}
