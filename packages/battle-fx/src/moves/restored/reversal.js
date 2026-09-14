import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function reversal(context) {
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

  const attachment='foot',base=socket(attachment),aim=Math.atan2(focus.y-base.y,focus.x-base.x),authored=Math.min(71,Math.max(44,h*.25))
  const pose=fit(solveContact(attachment,-.11,{x:focus.x-Math.cos(aim)*authored,y:focus.y-Math.sin(aim)*authored}))
  const c=Math.cos(pose.rotation),s=Math.sin(pose.rotation),at={x:pose.x+base.x*c-base.y*s,y:pose.y+base.x*s+base.y*c},length=Math.hypot(focus.x-at.x,focus.y-at.y),direction=Math.atan2(focus.y-at.y,focus.x-at.x)-pose.rotation,kick={swing:.7}
  const root=new Container();root.label='reversal-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='reversal-tip';root.addChild(tip)
  const impact=make('reversal-impact'),rise=make('reversal-rise')
  const flecks=Array.from({length:13},(_,i)=>({g:make(`reversal-fleck-${i}`),side:i%2?1:-1,reach:.25+random()*.6,life:1.03}))
  let contact
  function update(time){
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),b=targetSocket('center',true),exact=Math.abs(time-.92)<.00001,angle=exact?Math.atan2(b.y-a.y,b.x-a.x):direction+attacker.rotation+kick.swing,c=Math.cos(angle),s=Math.sin(angle),reach=exact?Math.hypot(b.x-a.x,b.y-a.y):Math.min(length,rayRoom(a,angle))
    root.position.copyFrom(a);root.alpha=time>=.32&&time<1.48?Math.min(1,(time-.32)/.17,(1.48-time)/.26):0
    const local=(u,v)=>{const q={x:a.x+c*reach*u,y:a.y+s*reach*u},d=Math.sign(v)*Math.min(Math.abs(v*reach),room(q)*.79);return[c*reach*u-s*d,s*reach*u+c*d]}
    const front=local(1,0),p=(u,v)=>{const q=local(u,v);return[q[0]-front[0],q[1]-front[1]]};tip.position.set(...front);tip.clear()
    // A bent ankle unfolds into a broad rising heel, with a distinct rounded sole.
    tip.moveTo(...p(.02,-.10)).lineTo(...p(.34,-.14)).lineTo(...p(.57,-.28)).quadraticCurveTo(...p(.94,-.22),...p(1,0)).quadraticCurveTo(...p(.97,.22),...p(.76,.22)).lineTo(...p(.39,.09)).lineTo(...p(.02,.07)).closePath().fill(0xc9a684)
      .moveTo(...p(.53,-.22)).quadraticCurveTo(...p(.92,-.20),...p(.97,0)).quadraticCurveTo(...p(.9,.15),...p(.76,.15)).stroke({color:0xffe4bd,width:3,alpha:.93,cap:'round'})
      .moveTo(...p(.38,-.1)).lineTo(...p(.42,.07)).stroke({color:0x8b7059,width:1.6})
    rise.clear();fitArt(rise,a,94);rise.alpha=time>=.5&&time<1.21?Math.sin(clamp((time-.5)/.71)*Math.PI)*.77:0
    const turn=clamp((time-.5)/.42);rise.moveTo(-40,49).quadraticCurveTo(-5,58,-9+turn*52,-50+turn*13).stroke({color:0xe9d2b0,width:3.7,alpha:.62,cap:'round'})
      .moveTo(-53,38).quadraticCurveTo(-17,48,-2+turn*38,-35).stroke({color:0xbda88e,width:1.8,alpha:.6,cap:'round'})
    const age=time-.92,u=clamp(age/.68);impact.clear();fitArt(impact,contact??b,77);impact.alpha=contact&&age>=0&&age<.68?1-u:0
    impact.moveTo(-29,34).quadraticCurveTo(-10,-18,24,-43-u*12).stroke({color:0xffe4b8,width:5-u*3,alpha:.8,cap:'round'})
      .moveTo(-18,28).quadraticCurveTo(5,-17,33,-35-u*11).stroke({color:0xc49e7d,width:2.4-u,alpha:.7,cap:'round'})
    flecks.forEach((f,i)=>{const v=clamp(age/f.life),span=contact?Math.min(72,room(contact)*.5):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)-span*.36*v+span*1.2*v*v},g=f.g;g.clear();fitArt(g,q,9);g.rotation=time*2+i;g.alpha=contact&&age>=0&&age<f.life?(1-v)*.83:0;g.poly([-4,0,0,-2,5,0,0,2]).fill(i%2?0xe8d1ad:0xbda68a)})
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-9,y:home.y+8,rotation:.085}),duration:.32},0)
    .to(attacker,{...fit({x:pose.x-19,y:pose.y+23,rotation:.03}),duration:.3,ease:'power2.in'},.36)
    .to(attacker,{...pose,duration:.26,ease:'power3.out'},.66).to(kick,{swing:0,duration:.29,ease:'power3.out'},.63)
    .call(()=>{contact=targetSocket('center',true);update(.92);onCue({type:'impact'})},[],.92)
    .to(kick,{swing:-.25,duration:.16},.93).to(attacker,{...fit({x:pose.x-17,y:pose.y-9,rotation:-.05}),duration:.18},.93)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.65,ease:'power2.inOut'},1.17).to({}, {duration:2.2},0)
}
