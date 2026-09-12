import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function eggBomb(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('egg') ? 'egg' : 'hand'
  const r = Math.min(27, Math.max(18, context.target.metrics.height / unit * .12))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const egg=new Container();egg.label='egg-bomb-shot-0';egg.alpha=0;temporary.addChild(egg)
  egg.addChild(new Graphics().ellipse(0,0,r*.8,r*1.12).fill(0xf1e4c4).stroke({color:0xc4b590,width:1.5})
    .ellipse(-r*.29,-r*.4,r*.13,r*.18).fill(0xba9e79).ellipse(r*.28,r*.24,r*.18,r*.13).fill(0xc2a983)
    .circle(-r*.23,r*.53,r*.1).fill(0xb49b79).ellipse(r*.2,-r*.62,r*.09,r*.13).fill(0xc1a580))
  const crack=new Graphics().moveTo(-r*.68,-r*.42).lineTo(-r*.15,-r*.18).lineTo(-r*.3,r*.15).lineTo(r*.14,r*.09).lineTo(r*.25,r*.5).lineTo(r*.69,r*.62).stroke({color:0x796a51,width:2});crack.alpha=0;egg.addChild(crack)
  const burst=new Container();burst.label='egg-bomb-impact-0';temporary.addChild(burst)
  const glow=new Graphics().circle(0,0,r*1.5).fill({color:0xe99f53,alpha:.4}).circle(0,0,r*.7).fill(0xffdf9a);glow.alpha=0;burst.addChild(glow)
  const fragments=[]
  for(let i=0;i<22;i++){const shell=i<10,s=shell?4+random()*5:5+random()*5
    const g=shell?new Graphics().poly([-s,-s*.3,0,-s*.75,s,0,s*.4,s*.5,-s*.6,s*.4]).fill(i%2?0xf2e5c6:0xc9b797):new Graphics().circle(0,0,s).fill(i%2?0xbaac95:0xd0bea0)
    g.alpha=0;burst.addChild(g);fragments.push({g,shell,a:random()*Math.PI*2,v:shell?90+random()*100:20+random()*55,life:shell?.38+random()*.22:.48+random()*.22})
  }
  let from,impact
  function update(time){const age=time-.38,u=Math.max(0,Math.min(1,age/.75)),a=from??socket(attachment,true),b=impact??targetSocket('center',true),rise=Math.min(r*3.9,Math.max(0,Math.min(a.y,b.y)-top-r*1.2))
    egg.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u-4*rise*u*(1-u));egg.rotation=Math.sin(u*Math.PI)*.65+u*.35
    egg.alpha=age>=0&&age<=.81?Math.min(1,age/.025)*Math.max(0,1-Math.max(0,age-.75)/.06):0;crack.alpha=impact?1:0;burst.position.copyFrom(b)
    for(const p of fragments){const age=time-1.13-(p.shell?0:.055),t=age/p.life;p.g.alpha=impact&&t>=0&&t<1?Math.sin(t*Math.PI)*(p.shell?1:.3):0;if(impact&&age>=0){p.g.position.set(Math.cos(p.a)*p.v*age,Math.sin(p.a)*p.v*age+(p.shell?105:-20)*age*age);p.g.rotation=p.shell?p.a+age*5:0;p.g.scale.set(p.shell?1-t*.2:1+t*1.8)}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.2},0).to(attacker,{x:home.x+thrust,duration:.15},.2)
    .call(()=>{from=socket(attachment,true);update(.38)},[],.38).to(attacker,{x:home.x,duration:.39},.46)
    .call(()=>{impact=targetSocket('center',true);update(1.13);onCue({type:'impact'});defender.tint=0xf4d4a4},[],1.13)
    .to(glow,{alpha:1,duration:.035},1.15).to(glow.scale,{x:1.65,y:1.4,duration:.25},1.15).to(glow,{alpha:0,duration:.28},1.2)
    .to(defender,{x:defenderHome.x+recoil,duration:.07,repeat:3,yoyo:true},1.13).call(()=>{defender.tint=0xffffff},[],1.49)

}
