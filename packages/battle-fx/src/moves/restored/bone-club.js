import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function boneClub(context) {
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

  const attachment=context.source.hasAnchor?.('bone')?'bone':'hand',base=socket(attachment),aim=Math.atan2(focus.y-base.y,focus.x-base.x),authored=Math.min(105,Math.max(105*.65,h*.34))
  const pose=fit(solveContact(attachment,0.055,{x:focus.x-Math.cos(aim)*authored,y:focus.y-Math.sin(aim)*authored}))
  const c0=Math.cos(pose.rotation),s0=Math.sin(pose.rotation),strike={x:pose.x+base.x*c0-base.y*s0,y:pose.y+base.x*s0+base.y*c0},length=Math.hypot(focus.x-strike.x,focus.y-strike.y),direction=Math.atan2(focus.y-strike.y,focus.x-strike.x)-pose.rotation

  const club={swing:-.78},root=new Container();root.label='bone-club-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='bone-club-tip';root.addChild(tip)
  const impact=make('bone-club-impact'),arc=make('bone-club-swing'),grit=Array.from({length:15},(_,i)=>({g:make(`bone-club-grit-${i}`),side:i%2?1:-1,reach:.25+random()*.7}))
  let contact
  function update(time){
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),b=targetSocket('center',true),exact=Math.abs(time-.78)<.00001,angle=exact?Math.atan2(b.y-a.y,b.x-a.x):direction+attacker.rotation+club.swing,c=Math.cos(angle),s=Math.sin(angle),reach=exact?Math.hypot(b.x-a.x,b.y-a.y):Math.min(length,rayRoom(a,angle))
    root.position.copyFrom(a);root.alpha=time>=.12&&time<1.39?Math.min(1,(time-.12)/.15,(1.39-time)/.25):0
    const local=(u,v)=>{const q={x:a.x+c*reach*u,y:a.y+s*reach*u},d=Math.sign(v)*Math.min(Math.abs(v*reach),room(q)*.78);return[c*reach*u-s*d,s*reach*u+c*d]}
    const front=local(1,0),p=(u,v)=>{const q=local(u,v);return[q[0]-front[0],q[1]-front[1]]};tip.position.set(...front);tip.clear()
    // A thick ivory femur has two rounded lobes and a narrowed, shaded shaft.
    tip.moveTo(...p(.01,-.07)).quadraticCurveTo(...p(.02,-.2),...p(.17,-.12)).lineTo(...p(.7,-.075)).quadraticCurveTo(...p(.76,-.26),...p(.92,-.18))
      .quadraticCurveTo(...p(1,-.12),...p(1,0)).quadraticCurveTo(...p(.98,.2),...p(.84,.17)).quadraticCurveTo(...p(.74,.18),...p(.7,.075))
      .lineTo(...p(.17,.07)).quadraticCurveTo(...p(.02,.2),...p(.01,.07)).closePath().fill(0xddc8a2)
      .moveTo(...p(.08,-.08)).lineTo(...p(.7,-.034)).quadraticCurveTo(...p(.83,-.19),...p(.93,-.08)).stroke({color:0xffedc9,width:2.8,alpha:.9,cap:'round'})
      .moveTo(...p(.19,.043)).lineTo(...p(.7,.052)).stroke({color:0xab9676,width:1.8,alpha:.73,cap:'round'})
    arc.clear();fitArt(arc,a,100);arc.alpha=time>=.44&&time<1.03?Math.sin(clamp((time-.44)/.59)*Math.PI)*.57:0
    arc.moveTo(-31,-62).quadraticCurveTo(66,-56,56,49).stroke({color:0xe3d2b4,width:3.3,alpha:.56,cap:'round'})
      .moveTo(-25,-51).quadraticCurveTo(52,-44,44,39).stroke({color:0xbdaa88,width:1.4,alpha:.6,cap:'round'})
    const age=time-.78,u=clamp(age/.61);impact.clear();fitArt(impact,contact??b,72);impact.alpha=contact&&age>=0&&age<.61?1-u:0
    for(let j=0;j<6;j++){const q=j*Math.PI/3+.2,r=14+u*32;impact.moveTo(Math.cos(q)*r*.35,Math.sin(q)*r*.35).lineTo(Math.cos(q+.12)*r,Math.sin(q+.12)*r).stroke({color:j%2?0xd4bc94:0xf1dfb9,width:4-u*2.5,alpha:.79,cap:'round'})}
    grit.forEach((f,i)=>{const v=clamp(age/.99),span=contact?Math.min(66,room(contact)*.48):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)-span*.24*v+span*1.23*v*v},g=f.g;g.clear();fitArt(g,q,8);g.rotation=time*2.5+i;g.alpha=contact&&age>=0&&age<.99?(1-v)*.76:0;g.poly([-3,-1,1,-2,4,1,-1,2]).fill(i%2?0xc8ad88:0xebd3ab)})
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-10,y:home.y+2,rotation:-.035}),duration:.24},0)
    .to(attacker,{...fit({x:pose.x-16,y:pose.y-8,rotation:-.02}),duration:.28},.26)
    .to(attacker,{...pose,duration:.24,ease:'power3.in'},.54).to(club,{swing:0,duration:.24,ease:'power3.in'},.54)
    .call(()=>{contact=targetSocket('center',true);update(.78);onCue({type:'impact'})},[],.78)
    .to(club,{swing:.39,duration:.19},.79).to(attacker,{x:home.x,y:home.y,rotation:0,duration:.58,ease:'power2.inOut'},1.07).to({}, {duration:1.95},0)
}
