import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function crabhammer(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  const clamp = n => Math.max(0, Math.min(1, n)), room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
  function fit(p) {
    let rotation = p.rotation ?? 0, c, s, rx, ry
    for (let j = 0; j < 14; j++) { c = Math.cos(rotation); s = Math.sin(rotation); rx = (w * Math.abs(c) + h * Math.abs(s)) / 2; ry = (h * Math.abs(c) + w * Math.abs(s)) / 2; if (rx * 2 <= right - left && ry * 2 <= bottom - top) break; rotation *= .5 }
    const x = p.x + center.x * c - center.y * s, y = p.y + center.x * s + center.y * c
    return { x: p.x + Math.max(left + rx, Math.min(right - rx, x)) - x, y: p.y + Math.max(top + ry, Math.min(bottom - ry, y)) - y, rotation }
  }
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fitArt = (g,p,r) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/r)) }
  function rayRoom(p, angle) {
    const x = Math.cos(angle), y = Math.sin(angle), limits = []
    if (x > 1e-6) limits.push((right - p.x - 3) / x); if (x < -1e-6) limits.push((left - p.x + 3) / x)
    if (y > 1e-6) limits.push((bottom - p.y - 3) / y); if (y < -1e-6) limits.push((top - p.y + 3) / y)
    return Math.max(0,Math.min(...limits))
  }

  const attachment=context.source.hasAnchor?.('claw')?'claw':'hand',base=socket(attachment),aim=Math.atan2(focus.y-base.y,focus.x-base.x),authored=Math.min(99,Math.max(99*.65,h*.34))
  const pose=fit(solveContact(attachment,0.07,{x:focus.x-Math.cos(aim)*authored,y:focus.y-Math.sin(aim)*authored}))
  const c0=Math.cos(pose.rotation),s0=Math.sin(pose.rotation),strike={x:pose.x+base.x*c0-base.y*s0,y:pose.y+base.x*s0+base.y*c0},length=Math.hypot(focus.x-strike.x,focus.y-strike.y),direction=Math.atan2(focus.y-strike.y,focus.x-strike.x)-pose.rotation

  const hammer={swing:-.86},root=new Container();root.label='crabhammer-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='crabhammer-tip';root.addChild(tip)
  const impact=make('crabhammer-impact'),wake=make('crabhammer-water-arc'),drops=Array.from({length:22},(_,i)=>({g:make(`crabhammer-drop-${i}`),side:i%2?1:-1,reach:.24+random()*.72,size:1.8+random()*2.1}))
  let contact
  function update(time){
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),b=targetSocket('center',true),exact=Math.abs(time-1.02)<.00001,angle=exact?Math.atan2(b.y-a.y,b.x-a.x):direction+attacker.rotation+hammer.swing,c=Math.cos(angle),s=Math.sin(angle),reach=exact?Math.hypot(b.x-a.x,b.y-a.y):Math.min(length,rayRoom(a,angle))
    root.position.copyFrom(a);root.alpha=time>=.17&&time<1.73?Math.min(1,(time-.17)/.2,(1.73-time)/.3):0
    const local=(u,v)=>{const q={x:a.x+c*reach*u,y:a.y+s*reach*u},d=Math.sign(v)*Math.min(Math.abs(v*reach),room(q)*.76);return[c*reach*u-s*d,s*reach*u+c*d]}
    const front=local(1,0),p=(u,v)=>{const q=local(u,v);return[q[0]-front[0],q[1]-front[1]]};tip.position.set(...front);tip.clear()
    tip.moveTo(...p(.01,-.07)).lineTo(...p(.38,-.1)).quadraticCurveTo(...p(.4,-.39),...p(.74,-.4)).quadraticCurveTo(...p(.97,-.34),...p(1,0))
      .quadraticCurveTo(...p(.96,.3),...p(.76,.27)).lineTo(...p(.64,.13)).lineTo(...p(.53,.29)).quadraticCurveTo(...p(.33,.21),...p(.35,.09)).lineTo(...p(.01,.07)).closePath().fill(0xcf9771)
      .moveTo(...p(.45,-.29)).quadraticCurveTo(...p(.86,-.40),...p(.965,-.045)).stroke({color:0xf1c698,width:3,alpha:.9,cap:'round'})
      .moveTo(...p(.64,.13)).lineTo(...p(.8,-.05)).stroke({color:0x875e50,width:2,alpha:.86})
    for(let j=0;j<3;j++){const ripple=Math.sin(time*12+j)*.026;tip.moveTo(...p(.21,-.12-j*.025)).quadraticCurveTo(...p(.53,-.45-ripple),...p(.92,-.17+j*.11)).stroke({color:j%2?0x6bbfdc:0xc7f0f2,width:j===1?3:1.5,alpha:.76,cap:'round'})}
    wake.clear();fitArt(wake,a,102);wake.alpha=time>=.62&&time<1.29?Math.sin(clamp((time-.62)/.67)*Math.PI)*.68:0
    const fall=clamp((time-.62)/.4);wake.moveTo(-36,-63).quadraticCurveTo(58,-70,51,17+fall*47).stroke({color:0x8bd8e9,width:4.2,alpha:.61,cap:'round'})
      .moveTo(-47,-54).quadraticCurveTo(44,-57,39,24+fall*35).stroke({color:0xd2f2f4,width:1.6,alpha:.8,cap:'round'})
    const age=time-1.02,u=clamp(age/.75);impact.clear();fitArt(impact,contact??b,89);impact.alpha=contact&&age>=0&&age<.75?1-u:0
    const r=15+u*43;impact.ellipse(0,7,r,r*.34).stroke({color:0xb4edf0,width:3-u,alpha:.78})
    for(let j=0;j<7;j++){const x=(j-3)*12;impact.moveTo(x*.4,5).quadraticCurveTo(x,-31-u*17,x*1.4,2+u*22).stroke({color:j%2?0x65b9d4:0xd9f5f2,width:3.2-u,alpha:.75,cap:'round'})}
    drops.forEach((f,i)=>{const v=clamp(age/1.16),span=contact?Math.min(82,room(contact)*.43):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)-span*.44*v+span*1.47*v*v},g=f.g;g.clear();fitArt(g,q,11);g.alpha=contact&&age>=0&&age<1.16?(1-v)*.86:0;g.ellipse(0,0,f.size*.64,f.size*(1+v*.55)).fill(i%2?0x6bbbd5:0xb9e6eb).ellipse(-f.size*.1,-f.size*.35,f.size*.22,f.size*.45).fill(0xe3f8f5)})
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-13,y:home.y+3,rotation:-.04}),duration:.32},0)
    .to(attacker,{...fit({x:pose.x-16,y:pose.y-12,rotation:-.035}),duration:.43,ease:'power2.inOut'},.32)
    .to(attacker,{...pose,duration:.27,ease:'power4.in'},.75).to(hammer,{swing:0,duration:.27,ease:'power4.in'},.75)
    .call(()=>{contact=targetSocket('center',true);update(1.02);onCue({type:'impact'})},[],1.02)
    .to(hammer,{swing:.24,duration:.18},1.03).to(attacker,{x:home.x,y:home.y,rotation:0,duration:.71,ease:'power2.inOut'},1.35).to({}, {duration:2.35},0)
}
