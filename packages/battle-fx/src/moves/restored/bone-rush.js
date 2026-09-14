import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function boneRush(context) {
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

  const attachment=context.source.hasAnchor?.('bone')?'bone':'hand',base=socket(attachment),aim=Math.atan2(focus.y-base.y,focus.x-base.x),authored=Math.min(93,Math.max(93*.65,h*.34))
  const pose=fit(solveContact(attachment,0.025,{x:focus.x-Math.cos(aim)*authored,y:focus.y-Math.sin(aim)*authored}))
  const c0=Math.cos(pose.rotation),s0=Math.sin(pose.rotation),strike={x:pose.x+base.x*c0-base.y*s0,y:pose.y+base.x*s0+base.y*c0},length=Math.hypot(focus.x-strike.x,focus.y-strike.y),direction=Math.atan2(focus.y-strike.y,focus.x-strike.x)-pose.rotation

  const hits=[.54,.85,1.16],baton={swing:-.53},root=new Container();root.label='bone-rush-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='bone-rush-tip';root.addChild(tip)
  const impact=make('bone-rush-impact'),marks=hits.map((at,i)=>({g:make(`bone-rush-contact-${i}`),at,point:null})),grains=Array.from({length:18},(_,i)=>({g:make(`bone-rush-grain-${i}`),side:i%2?1:-1,reach:.2+random()*.74}))
  let contact
  function update(time){
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),b=targetSocket('center',true),exact=hits.some(t=>Math.abs(time-t)<.00001),angle=exact?Math.atan2(b.y-a.y,b.x-a.x):direction+attacker.rotation+baton.swing,c=Math.cos(angle),s=Math.sin(angle),reach=exact?Math.hypot(b.x-a.x,b.y-a.y):Math.min(length,rayRoom(a,angle))
    root.position.copyFrom(a);root.alpha=time>=.12&&time<1.75?Math.min(1,(time-.12)/.15,(1.75-time)/.29):0
    const local=(u,v)=>{const q={x:a.x+c*reach*u,y:a.y+s*reach*u},d=Math.sign(v)*Math.min(Math.abs(v*reach),room(q)*.77);return[c*reach*u-s*d,s*reach*u+c*d]}
    const front=local(1,0),p=(u,v)=>{const q=local(u,v);return[q[0]-front[0],q[1]-front[1]]};tip.position.set(...front);tip.clear()
    tip.moveTo(...p(.01,-.045)).quadraticCurveTo(...p(.06,-.14),...p(.16,-.065)).lineTo(...p(.77,-.045)).quadraticCurveTo(...p(.86,-.18),...p(.94,-.11))
      .quadraticCurveTo(...p(1,-.08),...p(1,0)).quadraticCurveTo(...p(.98,.14),...p(.86,.10)).lineTo(...p(.77,.045)).lineTo(...p(.16,.065)).quadraticCurveTo(...p(.06,.16),...p(.01,.045)).closePath().fill(0xd9c29c)
      .moveTo(...p(.13,-.035)).lineTo(...p(.81,-.017)).lineTo(...p(.95,-.05)).stroke({color:0xffebc7,width:2.3,alpha:.88,cap:'round'})
    for(let j=0;j<3;j++)tip.moveTo(...p(.25+j*.08,-.058)).lineTo(...p(.24+j*.08,.056)).stroke({color:0xab9676,width:1.4,alpha:.64})
    const age=time-1.16,u=clamp(age/.58);impact.clear();fitArt(impact,contact??b,68);impact.alpha=contact&&age>=0&&age<.58?1-u:0
    impact.ellipse(0,0,12+u*30,8+u*23).stroke({color:0xe9d5b1,width:2.8-u,alpha:.75})
    marks.forEach((m,i)=>{const v=clamp((time-m.at)/.35),g=m.g;g.clear();fitArt(g,m.point??b,57);g.alpha=m.point&&time>=m.at&&time<m.at+.35?(1-v)*.83:0;const side=i%2?1:-1;g.moveTo(-26,-side*23).lineTo(-8,-side*5).lineTo(2,-side*13).lineTo(26,side*20).stroke({color:i%2?0xb9a184:0xf1deba,width:3.6-v,alpha:.82,cap:'round',join:'round'})})
    grains.forEach((f,i)=>{const v=clamp(age/.93),span=contact?Math.min(66,room(contact)*.48):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)-span*.2*v+span*1.2*v*v},g=f.g;g.clear();fitArt(g,q,8);g.rotation=time*3+i;g.alpha=contact&&age>=0&&age<.93?(1-v)*.76:0;g.poly([-3,0,0,-2,4,0,1,2]).fill(i%2?0xd9c09b:0xb49c7b)})
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-7,y:home.y+2,rotation:-.025}),duration:.19},0).to(attacker,{...pose,duration:.34,ease:'power2.in'},.2)
    .to(baton,{swing:0,duration:.19,ease:'power3.in'},.35).to(baton,{swing:.48,duration:.13},.56).to(baton,{swing:0,duration:.15,ease:'power3.in'},.7)
    .to(baton,{swing:-.48,duration:.13},.87).to(baton,{swing:0,duration:.15,ease:'power3.in'},1.01)
  marks.forEach((m,i)=>tl.call(()=>{m.point=targetSocket('center',true);if(i===2)contact=m.point;update(m.at);if(i===2)onCue({type:'impact'})},[],m.at))
  tl.to(baton,{swing:.24,duration:.2},1.18).to(attacker,{x:home.x,y:home.y,rotation:0,duration:.6,ease:'power2.inOut'},1.42).to({}, {duration:2.25},0)
}
