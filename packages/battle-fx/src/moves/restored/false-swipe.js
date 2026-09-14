import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function falseSwipe(context) {
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

  const attachment = context.source.hasAnchor?.('blade') ? 'blade' : 'hand', base = socket(attachment), aim = Math.atan2(focus.y-base.y,focus.x-base.x), authored = Math.min(91,Math.max(61,h*.32))
  const pose = fit(solveContact(attachment,.025,{x:focus.x-Math.cos(aim)*authored,y:focus.y-Math.sin(aim)*authored}))
  const cs = Math.cos(pose.rotation), sn = Math.sin(pose.rotation), at = {x:pose.x+base.x*cs-base.y*sn,y:pose.y+base.x*sn+base.y*cs}
  const length = Math.hypot(focus.x-at.x,focus.y-at.y), direction = Math.atan2(focus.y-at.y,focus.x-at.x)-pose.rotation, sweep={angle:-.48}
  const root = new Container(); root.label='false-swipe-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='false-swipe-tip';root.addChild(tip)
  const impact=make('false-swipe-impact'),peel=make('false-swipe-peel')
  const filaments=Array.from({length:10},(_,i)=>({g:make(`false-swipe-filament-${i}`),phase:i/10,life:.83+random()*.12}))
  let contact
  function update(time){
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),b=targetSocket('center',true),exact=Math.abs(time-.64)<.00001
    const angle=exact?Math.atan2(b.y-a.y,b.x-a.x):direction+attacker.rotation+sweep.angle,c=Math.cos(angle),s=Math.sin(angle),reach=exact?Math.hypot(b.x-a.x,b.y-a.y):Math.min(length,rayRoom(a,angle))
    root.position.copyFrom(a);root.alpha=time>=.06&&time<1.18?Math.min(1,(time-.06)/.13,(1.18-time)/.22):0
    const local=(u,v)=>{const p={x:a.x+c*reach*u,y:a.y+s*reach*u},across=Math.sign(v)*Math.min(Math.abs(v*reach),room(p)*.78);return[c*reach*u-s*across,s*reach*u+c*across]}
    const front=local(1,0),p=(u,v)=>{const q=local(u,v);return[q[0]-front[0],q[1]-front[1]]};tip.position.set(...front);tip.clear()
    // A broad blunt blade brushes with its flat and immediately draws away.
    tip.moveTo(...p(0,-.025)).lineTo(...p(.16,-.105)).quadraticCurveTo(...p(.73,-.14),...p(1,0)).quadraticCurveTo(...p(.65,.10),...p(.17,.075)).closePath().fill(0xc9d7aa)
      .moveTo(...p(.04,-.012)).quadraticCurveTo(...p(.61,-.075),...p(.97,0)).stroke({color:0xf4f0cf,width:2.2,alpha:.88,cap:'round'})
      .moveTo(...p(.19,.065)).lineTo(...p(.17,-.09)).stroke({color:0x71896b,width:3,alpha:.9})
    const age=time-.64,u=clamp(age/.62);impact.clear();fitArt(impact,contact??b,59);impact.alpha=contact&&age>=0&&age<.62?1-u:0
    impact.moveTo(-18,-26+u*14).quadraticCurveTo(25,-3,12,29+u*8).stroke({color:0xe5eac8,width:3.2-u,alpha:.72,cap:'round'})
      .moveTo(-10,-19+u*10).quadraticCurveTo(22,2,5,25+u*8).stroke({color:0xa8bea0,width:1.5,alpha:.55,cap:'round'})
    peel.clear();fitArt(peel,socket('center',true),79);peel.alpha=time>=.57&&time<1.12?Math.sin(clamp((time-.57)/.55)*Math.PI)*.54:0
    peel.moveTo(-46,14).quadraticCurveTo(15,35,60,4).stroke({color:0xc9d9b7,width:1.5,alpha:.56,cap:'round'})
    for(const f of filaments){const v=clamp(age/f.life),span=contact?Math.min(49,room(contact)*.54):0,q={x:(contact?.x??b.x)+(f.phase-.5)*span*v,y:(contact?.y??b.y)+span*(v*.15+v*v*.48)},g=f.g;g.clear();fitArt(g,q,13);g.rotation=Math.sin(time*3+f.phase*6)*.4;g.alpha=contact&&age>=0&&age<f.life?(1-v)*.63:0;g.moveTo(-7,-2).quadraticCurveTo(0,3+v*3,7,0).stroke({color:f.phase<.5?0xd9e5be:0xaac1a5,width:1.2,cap:'round'})}
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-6,y:home.y,rotation:-.025}),duration:.2},0)
    .to(attacker,{...pose,duration:.36,ease:'power2.inOut'},.27).to(sweep,{angle:0,duration:.25,ease:'power2.in'},.39)
    .call(()=>{contact=targetSocket('center',true);update(.64);onCue({type:'impact'})},[],.64)
    .to(sweep,{angle:.36,duration:.15,ease:'power2.out'},.65)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.5,ease:'power2.inOut'},.84).to({}, {duration:1.75},0)
}
