import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function revenge(context) {
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

  const attachment=context.source.hasAnchor?.('fist')?'fist':'hand',base=socket(attachment),aim=Math.atan2(focus.y-base.y,focus.x-base.x),authored=Math.min(63,Math.max(42,h*.22))
  const pose=fit(solveContact(attachment,.07,{x:focus.x-Math.cos(aim)*authored,y:focus.y-Math.sin(aim)*authored}))
  const c=Math.cos(pose.rotation),s=Math.sin(pose.rotation),at={x:pose.x+base.x*c-base.y*s,y:pose.y+base.x*s+base.y*c},length=Math.hypot(focus.x-at.x,focus.y-at.y),direction=Math.atan2(focus.y-at.y,focus.x-at.x)-pose.rotation,hammer={swing:-.62}
  const root=new Container();root.label='revenge-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='revenge-tip';root.addChild(tip)
  const guard=make('revenge-brace'),impact=make('revenge-impact'),crease=make('revenge-crease')
  const chips=Array.from({length:16},(_,i)=>({g:make(`revenge-chip-${i}`),side:i%2?1:-1,reach:.2+random()*.7,life:1.18}))
  let contact
  function update(time){
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),b=targetSocket('center',true),c0=socket('center',true),exact=Math.abs(time-1.04)<.00001,angle=exact?Math.atan2(b.y-a.y,b.x-a.x):direction+attacker.rotation+hammer.swing,c=Math.cos(angle),s=Math.sin(angle),reach=exact?Math.hypot(b.x-a.x,b.y-a.y):Math.min(length,rayRoom(a,angle))
    root.position.copyFrom(a);root.alpha=time>=.22&&time<1.67?Math.min(1,(time-.22)/.19,(1.67-time)/.28):0
    const local=(u,v)=>{const q={x:a.x+c*reach*u,y:a.y+s*reach*u},d=Math.sign(v)*Math.min(Math.abs(v*reach),room(q)*.8);return[c*reach*u-s*d,s*reach*u+c*d]}
    const front=local(1,0),p=(u,v)=>{const q=local(u,v);return[q[0]-front[0],q[1]-front[1]]};tip.position.set(...front);tip.clear()
    // The squared hammerfist carries a dark wrist wrap and four broad folded knuckles.
    tip.moveTo(...p(.02,-.15)).lineTo(...p(.34,-.18)).lineTo(...p(.44,-.33)).lineTo(...p(.83,-.32)).quadraticCurveTo(...p(1,-.23),...p(1,0)).lineTo(...p(.9,.29)).lineTo(...p(.43,.28)).lineTo(...p(.3,.11)).lineTo(...p(.02,.11)).closePath().fill(0xc99586)
      .moveTo(...p(.48,-.25)).lineTo(...p(.83,-.25)).quadraticCurveTo(...p(.96,-.18),...p(.96,0)).stroke({color:0xf6c7aa,width:2.4,alpha:.9,cap:'round'})
    tip.moveTo(...p(.27,-.17)).lineTo(...p(.31,.14)).moveTo(...p(.17,-.15)).lineTo(...p(.21,.12)).stroke({color:0x78565d,width:4.1,alpha:.95})
    for(let j=0;j<3;j++)tip.moveTo(...p(.54+j*.1,-.25)).lineTo(...p(.54+j*.1,-.07)).stroke({color:0x905d5d,width:1.6})
    guard.clear();fitArt(guard,c0,96);guard.alpha=time>=.1&&time<.91?Math.min(1,(time-.1)/.27,(.91-time)/.23)*.69:0
    const tension=clamp(time/.78);for(const side of[-1,1])guard.moveTo(side*49,-37).lineTo(side*(34-tension*6),-8).lineTo(side*39,31).stroke({color:side<0?0xb46c6b:0xdb9985,width:5,alpha:.64,cap:'round',join:'round'})
    const age=time-1.04,u=clamp(age/.72);impact.clear();fitArt(impact,contact??b,75);impact.alpha=contact&&age>=0&&age<.72?1-u:0
    for(let j=0;j<6;j++){const q=j*Math.PI/3+.15,r=14+u*38;impact.moveTo(Math.cos(q)*r*.28,Math.sin(q)*r*.28).lineTo(Math.cos(q+.06)*r,Math.sin(q+.06)*r).stroke({color:j%2?0xd98f79:0xf7d4b5,width:5-u*2.5,alpha:.74,cap:'round'})}
    crease.clear();fitArt(crease,contact??b,68);crease.alpha=contact&&age>=0&&age<.8?(1-clamp(age/.8))*.78:0
    const sink=clamp(age/.8)*19;crease.moveTo(-28,-20+sink).lineTo(-10,-5+sink).lineTo(-17,8+sink).lineTo(24,30+sink).stroke({color:0xb97167,width:2.3,alpha:.65,join:'round'})
    chips.forEach((f,i)=>{const v=clamp(age/f.life),span=contact?Math.min(78,room(contact)*.45):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)-span*.25*v+span*1.27*v*v},g=f.g;g.clear();fitArt(g,q,9);g.rotation=i+time*3;g.alpha=contact&&age>=0&&age<f.life?(1-v)*.87:0;g.poly([-4,-1,1,-3,4,1,-1,2]).fill(i%2?0xd4a58c:0x9b7066)})
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-13,y:home.y+5,rotation:-.04}),duration:.36},0)
    .to(attacker,{...fit({x:home.x-16,y:home.y+7,rotation:-.055}),duration:.26},.36)
    .to(attacker,{...pose,duration:.35,ease:'power4.in'},.69).to(hammer,{swing:0,duration:.25,ease:'power3.in'},.79)
    .call(()=>{contact=targetSocket('center',true);update(1.04);onCue({type:'impact'})},[],1.04)
    .to(hammer,{swing:.28,duration:.19},1.05).to(attacker,{x:home.x,y:home.y,rotation:0,duration:.7,ease:'power2.inOut'},1.38).to({}, {duration:2.4},0)
}
