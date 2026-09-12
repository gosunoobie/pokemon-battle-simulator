import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function rockThrow(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('rock') ? 'rock' : 'hand'
  const r = Math.min(30, Math.max(20, context.target.metrics.height / unit * .14))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const rock=new Graphics().poly([-r,-r*.35,-r*.6,-r*.92,r*.36,-r,r*.94,-r*.3,r*.85,r*.59,-r*.03,r*.91,-r*.85,r*.53]).fill(0x897862)
    .poly([-r,-r*.35,-r*.6,-r*.92,r*.36,-r,r*.22,-r*.1,-r*.38,r*.17]).fill(0xc2ad8c)
    .poly([r*.22,-r*.1,r*.94,-r*.3,r*.85,r*.59,-r*.03,r*.91]).fill(0x685d50)
    .moveTo(-r*.6,-r*.92).lineTo(-r*.38,r*.17).lineTo(-r*.85,r*.53).moveTo(-r*.38,r*.17).lineTo(r*.22,-r*.1).lineTo(r*.85,r*.59).stroke({color:0xa49176,width:1.5})
  rock.label='rock-throw-shot-0';rock.alpha=0;temporary.addChild(rock)
  const dust=new Container();dust.label='rock-throw-impact-0';temporary.addChild(dust)
  const debris=[]
  for(let i=0;i<19;i++){
    const cloud=i<6,s=cloud?7+random()*6:2+random()*4
    const g=cloud?new Graphics().ellipse(0,0,s,s*.65).fill(0xbaab8e):new Graphics().poly([-s,0,0,-s*.8,s,s*.15,0,s*.6]).fill(i%2?0x8d7b65:0xc7b597)
    g.alpha=0;dust.addChild(g);debris.push({g,cloud,a:Math.PI*2*random(),v:cloud?25+random()*40:70+random()*90,life:cloud?.54+random()*.14:.34+random()*.18})
  }
  const ring=new Graphics().ellipse(0,0,r*1.1,r*.65).stroke({color:0xd5c4a2,width:3});ring.alpha=0;dust.addChild(ring)
  let from,impact
  function update(time){const age=time-.4,u=Math.max(0,Math.min(1,age/.67)),a=from??socket(attachment,true),b=impact??targetSocket('center',true),rise=Math.min(r*3.5,Math.max(0,Math.min(a.y,b.y)-top-r*1.1))
    rock.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u-4*rise*u*(1-u));rock.rotation=age*5.5
    rock.alpha=age>=0&&age<=.7?Math.min(1,age/.025)*Math.max(0,1-Math.max(0,age-.67)/.03):0
    dust.position.copyFrom(b)
    for(const p of debris){const age=time-1.07,t=age/p.life;p.g.alpha=impact&&t>=0&&t<1?Math.sin(t*Math.PI)*(p.cloud?.32:.9):0;if(impact&&age>=0){p.g.position.set(Math.cos(p.a)*p.v*age,Math.sin(p.a)*p.v*age+(p.cloud?-10:115)*age*age);p.g.scale.set(p.cloud?1+t*1.8:1-t*.2);p.g.rotation=p.cloud?0:p.a+age*6}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.24},0).to(attacker,{x:home.x+thrust,duration:.13},.24)
    .call(()=>{from=socket(attachment,true);update(.4)},[],.4).to(attacker,{x:home.x,duration:.4},.48)
    .to(ring,{alpha:.7,duration:.02},1.07).to(ring.scale,{x:1.8,y:1.7,duration:.24},1.07).to(ring,{alpha:0,duration:.27},1.11)
    .call(()=>{impact=targetSocket('center',true);update(1.07);onCue({type:'impact'});defender.tint=0xd8c4a4},[],1.07)
    .to(defender,{x:defenderHome.x+recoil,duration:.065,repeat:3,yoyo:true},1.07).call(()=>{defender.tint=0xffffff},[],1.41)

}
