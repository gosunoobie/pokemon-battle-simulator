import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function present(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('gift') ? 'gift' : 'hand'
  const r = Math.min(25, Math.max(17, context.target.metrics.height / unit * .11))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const gift=new Container();gift.label='present-shot-0';gift.alpha=0;temporary.addChild(gift)
  const box=new Graphics().rect(-r,-r*.65,r*2,r*1.5).fill(0xb65b60).rect(-r,-r*.65,r*.3,r*1.5).fill(0x864951)
    .rect(-r*.17,-r*.65,r*.34,r*1.5).fill(0xe6c776).rect(-r,r*.03,r*2,r*.24).fill(0xe6c776)
  const lid=new Container();lid.label='present-lid'
  lid.addChild(new Graphics().roundRect(-r*1.09,-r*.88,r*2.18,r*.36,r*.06).fill(0x7f9c77).rect(-r*.17,-r*.88,r*.34,r*.36).fill(0xf0d28a)
    .moveTo(0,-r*.86).bezierCurveTo(-r*1.02,-r*1.64,-r*.77,-r*1.81,0,-r*.86).bezierCurveTo(r*1.02,-r*1.64,r*.77,-r*1.81,0,-r*.86).stroke({color:0xf0d28a,width:3,cap:'round'}))
  gift.addChild(box,lid)
  const opening=new Container();opening.label='present-impact-0';temporary.addChild(opening)
  const flash=new Graphics().poly([0,-r*1.55,r*.3,-r*.38,r*1.4,-r*.65,r*.51,r*.2,r*1.08,r*1.21,0,r*.6,-r*1.3,r*1.1,-r*.5,0,-r*1.45,-r*.6,-r*.25,-r*.38]).fill(0xffdfa0);flash.alpha=0;opening.addChild(flash)
  const confetti=[]
  for(let i=0;i<26;i++){const g=new Graphics().rect(-2,-3,4,6).fill([0xdf8e92,0xb6d39c,0xf0d083,0xb9dce5][i%4]);g.alpha=0;opening.addChild(g);confetti.push({g,a:-Math.PI+random()*Math.PI,v:65+random()*110,spin:(random()-.5)*17,life:.48+random()*.28})}
  let from,arrival,impact
  function update(time){const age=time-.42,u=Math.max(0,Math.min(1,age/.72)),a=from??socket(attachment,true),b=arrival??targetSocket('center',true),rise=Math.min(r*3.2,Math.max(0,Math.min(a.y,b.y)-top-r*1.8)),opened=time-1.32
    gift.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u-4*rise*u*(1-u));gift.rotation=age<.72?Math.sin(u*Math.PI*2)*.22:0
    gift.alpha=age>=0&&time<2.06?Math.min(1,age/.03):0
    box.alpha=opened<0?1:Math.max(0,1-opened/.18);box.scale.set(1+Math.max(0,opened)*.3)
    lid.alpha=opened<0?1:Math.max(0,1-opened/.68);lid.position.set(Math.max(0,opened)*r*1.6,-Math.max(0,opened)*r*4+Math.max(0,opened)**2*r*3);lid.rotation=Math.max(0,opened)*2
    if(time>=1.14&&time<1.32)lid.y=-Math.abs(Math.sin((time-1.14)*40))*r*.08
    opening.position.copyFrom(impact??b)
    for(const p of confetti){const t=opened/p.life;p.g.alpha=impact&&t>=0&&t<1?Math.sin(t*Math.PI)*.95:0;if(impact&&opened>=0){p.g.position.set(Math.cos(p.a)*p.v*opened,Math.sin(p.a)*p.v*opened+120*opened*opened);p.g.rotation=opened*p.spin;p.g.scale.x=.25+.75*Math.abs(Math.cos(opened*12+p.a))}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.24},0).to(attacker,{x:home.x+thrust,duration:.14},.24)
    .call(()=>{from=socket(attachment,true);update(.42)},[],.42).to(attacker,{x:home.x,duration:.42},.52)
    .call(()=>{arrival=targetSocket('center',true);update(1.14)},[],1.14)
    .call(()=>{impact={...arrival};update(1.32);onCue({type:'impact'});defender.tint=0xf0d7a4},[],1.32)
    .to(flash,{alpha:1,duration:.035},1.32).to(flash.scale,{x:1.5,y:1.5,duration:.21},1.32).to(flash,{alpha:0,duration:.25},1.38)
    .to(defender,{x:defenderHome.x+recoil,duration:.06,repeat:3,yoyo:true},1.32).call(()=>{defender.tint=0xffffff},[],1.64)

}
