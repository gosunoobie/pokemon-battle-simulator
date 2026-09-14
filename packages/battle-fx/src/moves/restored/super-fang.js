import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function superFang(context) {
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

  const attachment=context.source.hasAnchor?.('mouth')?'mouth':'emission',base=socket(attachment),aim=Math.atan2(focus.y-base.y,focus.x-base.x),authored=Math.min(97,Math.max(97*.65,h*.34))
  const pose=fit(solveContact(attachment,0.03,{x:focus.x-Math.cos(aim)*authored,y:focus.y-Math.sin(aim)*authored}))
  const c0=Math.cos(pose.rotation),s0=Math.sin(pose.rotation),strike={x:pose.x+base.x*c0-base.y*s0,y:pose.y+base.x*s0+base.y*c0},length=Math.hypot(focus.x-strike.x,focus.y-strike.y),direction=Math.atan2(focus.y-strike.y,focus.x-strike.x)-pose.rotation

  const jaw={gap:.36,swing:-.17},root=new Container();root.label='super-fang-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='super-fang-tip';root.addChild(tip)
  const impact=make('super-fang-impact'),glints=Array.from({length:13},(_,i)=>({g:make(`super-fang-glint-${i}`),side:i%2?1:-1,reach:.3+random()*.6}))
  let contact
  function update(time){
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),b=targetSocket('center',true),exact=Math.abs(time-.72)<.00001,angle=exact?Math.atan2(b.y-a.y,b.x-a.x):direction+attacker.rotation+jaw.swing,c=Math.cos(angle),s=Math.sin(angle),reach=exact?Math.hypot(b.x-a.x,b.y-a.y):Math.min(length,rayRoom(a,angle))
    root.position.copyFrom(a);root.alpha=time>=.15&&time<1.22?Math.min(1,(time-.15)/.15,(1.22-time)/.25):0
    const local=(u,v)=>{const q={x:a.x+c*reach*u,y:a.y+s*reach*u},d=Math.sign(v)*Math.min(Math.abs(v*reach),room(q)*.78);return[c*reach*u-s*d,s*reach*u+c*d]}
    const front=local(1,0),p=(u,v)=>{const q=local(u,v);return[q[0]-front[0],q[1]-front[1]]};tip.position.set(...front);tip.clear()
    for(const side of[-1,1]){
      const gap=side*jaw.gap
      tip.moveTo(...p(.01,side*.05)).quadraticCurveTo(...p(.4,side*.37+gap*.6),...p(.81,side*.35+gap)).stroke({color:0x807081,width:6,alpha:.86,cap:'round'})
      tip.moveTo(...p(.52,side*.27+gap)).lineTo(...p(.85,side*.33+gap)).quadraticCurveTo(...p(.96,side*.11+gap),...p(1,gap))
        .quadraticCurveTo(...p(.72,side*.08+gap),...p(.52,side*.27+gap)).fill(side<0?0xfff0cc:0xe2ccad)
        .moveTo(...p(.64,side*.25+gap)).quadraticCurveTo(...p(.84,side*.14+gap),...p(.96,gap+side*.02)).stroke({color:0xfff8e3,width:2.3,alpha:.88,cap:'round'})
      tip.moveTo(...p(.23,side*.15+gap*.45)).lineTo(...p(.43,side*.21+gap*.64)).lineTo(...p(.5,side*.035+gap*.55)).closePath().fill(0xe9d9bb)
    }
    const age=time-.72,u=clamp(age/.58);impact.clear();fitArt(impact,contact??b,73);impact.alpha=contact&&age>=0&&age<.58?1-u:0
    for(const side of[-1,1])impact.moveTo(side*13,-31-u*12).lineTo(side*6,-7).lineTo(side*15,28+u*10).stroke({color:side<0?0xffeeca:0xd9c5a7,width:5-u*2.7,alpha:.84,cap:'round'})
    impact.ellipse(0,0,9+u*33,6+u*19).stroke({color:0xd5c2a9,width:1.8,alpha:.55})
    glints.forEach((f,i)=>{const v=clamp(age/.96),span=contact?Math.min(61,room(contact)*.49):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)-span*.15*v+span*v*v},g=f.g;g.clear();fitArt(g,q,9);g.rotation=time*2+i;g.alpha=contact&&age>=0&&age<.96?(1-v)*.76:0;g.poly([0,-4,1,-1,4,0,1,1,0,4,-1,1,-4,0,-1,-1]).fill(i%2?0xe5d2af:0xffeac8)})
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-11,y:home.y+1,rotation:-.035}),duration:.23},0)
    .to(attacker,{...pose,duration:.42,ease:'power3.in'},.28).to(jaw,{gap:0,swing:0,duration:.12,ease:'power4.in'},.6)
    .call(()=>{contact=targetSocket('center',true);update(.72);onCue({type:'impact'})},[],.72)
    .to(jaw,{gap:.19,swing:.14,duration:.2},.85).to(attacker,{x:home.x,y:home.y,rotation:0,duration:.52,ease:'power2.inOut'},1.05).to({}, {duration:1.85},0)
}
