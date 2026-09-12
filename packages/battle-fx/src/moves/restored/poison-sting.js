import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function poisonSting(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('stinger') ? 'stinger' : 'emission'
  const r = Math.min(11, Math.max(7, context.target.metrics.height / unit * .049))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const sting=new Graphics().poly([0,0,-r*2,-r*.17,-r*1.55,-r*.54,-r*2.65,0,-r*1.55,r*.54,-r*2,r*.17]).fill(0xb981cc)
    .moveTo(-r*2.15,0).lineTo(-r*.23,0).stroke({color:0xf0c4f7,width:1.4})
  sting.label='poison-sting-shot-0';sting.alpha=0;temporary.addChild(sting)
  const wake=new Graphics();wake.alpha=0;temporary.addChildAt(wake,0)
  const puncture=new Graphics().poly([-r*.45,0,-r*.06,-r*.11,0,-r*.67,r*.09,-r*.12,r*.45,0,r*.08,r*.13,0,r*.67,-r*.06,r*.1]).fill(0xe7b1ee)
  puncture.label='poison-sting-impact-0';puncture.alpha=0;temporary.addChild(puncture)
  const beads=Array.from({length:9},()=>{const g=new Graphics().circle(0,0,1.5+random()*1.8).fill(random()<.5?0xc596d4:0x8f66ab);g.alpha=0;temporary.addChild(g);return{g,a:random()*Math.PI*2,v:25+random()*42,life:.28+random()*.22}})
  let from,impact
  function update(time){const age=time-.28,u=Math.max(0,Math.min(1,age/.44)),a=from??socket(attachment,true),b=impact??targetSocket('center',true),bow=Math.min(r*.75,Math.max(0,Math.min(a.y,b.y)-top-r*3))
    sting.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u-Math.sin(Math.PI*u)*bow);sting.rotation=Math.atan2(b.y-a.y-Math.PI*Math.cos(Math.PI*u)*bow,b.x-a.x)
    sting.alpha=age>=0&&age<=.53?Math.min(1,age/.025)*Math.max(0,1-Math.max(0,age-.44)/.09):0
    wake.clear();wake.alpha=age>0&&age<.44?.48:0
    const previous=Math.max(0,u-.17),x=a.x+(b.x-a.x)*previous,y=a.y+(b.y-a.y)*previous-Math.sin(Math.PI*previous)*bow
    wake.moveTo(x,y).quadraticCurveTo((x+sting.x)/2,(y+sting.y)/2+r*.18,sting.x,sting.y).stroke({color:0x9e73b8,width:2.3,cap:'round'})
    puncture.position.copyFrom(b)
    for(const p of beads){const age=time-.72,t=age/p.life;p.g.alpha=impact&&t>=0&&t<1?Math.sin(t*Math.PI)*.75:0;if(impact&&age>=0){p.g.position.set(impact.x+Math.cos(p.a)*p.v*age,impact.y+Math.sin(p.a)*p.v*age+24*age*age);p.g.scale.set(1-t*.35)}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.14},0).to(attacker,{x:home.x+thrust,duration:.1},.14)
    .call(()=>{from=socket(attachment,true);update(.28)},[],.28).to(attacker,{x:home.x,duration:.32},.38)
    .to(puncture,{alpha:1,duration:.025},.72).to(puncture,{alpha:0,duration:.24},.79)
    .call(()=>{impact=targetSocket('center',true);update(.72);onCue({type:'impact'});defender.tint=0xd7a7e0},[],.72)
    .to(defender,{x:defenderHome.x+Math.min(5,recoil),duration:.05,repeat:3,yoyo:true},.72)
    .call(()=>{defender.tint=0xffffff},[],.98)

}
