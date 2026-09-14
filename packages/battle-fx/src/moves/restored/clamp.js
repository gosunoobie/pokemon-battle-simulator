import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function clamp(context) {
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

  const attachment=context.source.hasAnchor?.('mouth')?'mouth':'emission',base=socket(attachment),aim=Math.atan2(focus.y-base.y,focus.x-base.x),authored=Math.min(102,Math.max(102*.65,h*.34))
  const pose=fit(solveContact(attachment,0.015,{x:focus.x-Math.cos(aim)*authored,y:focus.y-Math.sin(aim)*authored}))
  const c0=Math.cos(pose.rotation),s0=Math.sin(pose.rotation),strike={x:pose.x+base.x*c0-base.y*s0,y:pose.y+base.x*s0+base.y*c0},length=Math.hypot(focus.x-strike.x,focus.y-strike.y),direction=Math.atan2(focus.y-strike.y,focus.x-strike.x)-pose.rotation

  const shell={gap:.32,swing:.15},root=new Container();root.label='clamp-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='clamp-tip';root.addChild(tip)
  const impact=make('clamp-impact'),pearls=Array.from({length:14},(_,i)=>({g:make(`clamp-pearl-${i}`),phase:i/14,size:1.5+random()*2}))
  let contact
  function update(time){
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),b=targetSocket('center',true),exact=Math.abs(time-.9)<.00001,angle=exact?Math.atan2(b.y-a.y,b.x-a.x):direction+attacker.rotation+shell.swing,c=Math.cos(angle),s=Math.sin(angle),reach=exact?Math.hypot(b.x-a.x,b.y-a.y):Math.min(length,rayRoom(a,angle))
    root.position.copyFrom(a);root.alpha=time>=.16&&time<1.53?Math.min(1,(time-.16)/.18,(1.53-time)/.27):0
    const local=(u,v)=>{const q={x:a.x+c*reach*u,y:a.y+s*reach*u},d=Math.sign(v)*Math.min(Math.abs(v*reach),room(q)*.78);return[c*reach*u-s*d,s*reach*u+c*d]}
    const front=local(1,0),p=(u,v)=>{const q=local(u,v);return[q[0]-front[0],q[1]-front[1]]};tip.position.set(...front);tip.clear()
    // Two ribbed fan shells close along a pale soft lip, rather than curved pincer fingers.
    for(const side of[-1,1]){
      const gap=side*shell.gap
      tip.moveTo(...p(.015,0)).quadraticCurveTo(...p(.3,side*.51+gap*.4),...p(.65,side*.43+gap)).quadraticCurveTo(...p(.96,side*.29+gap),...p(1,gap))
        .quadraticCurveTo(...p(.51,gap+side*.015),...p(.015,0)).fill(side<0?0xaca0c6:0x857eaa)
        .moveTo(...p(.07,side*.01)).quadraticCurveTo(...p(.62,gap+side*.025),...p(.99,gap)).stroke({color:0xe3d6ed,width:3.2,alpha:.86,cap:'round'})
      for(let j=0;j<5;j++){const u=.35+j*.125;tip.moveTo(...p(.07,side*.018)).quadraticCurveTo(...p(u*.63,side*(.17+j*.04)+gap*.55),...p(u,side*(.43-j*.045)+gap)).stroke({color:side<0?0xd2c4df:0xbbb0cf,width:1.5,alpha:.7,cap:'round'})}
    }
    const age=time-.9,u=clamp(age/.72);impact.clear();fitArt(impact,contact??b,69);impact.alpha=contact&&age>=0&&age<.72?1-u:0
    impact.ellipse(0,0,17+u*31,8+u*19).stroke({color:0xdacee9,width:3-u,alpha:.7})
    for(const side of[-1,1])impact.moveTo(-25,side*12).quadraticCurveTo(0,side*(28+u*17),25,side*12).stroke({color:0xb5a8ce,width:1.8,alpha:.55,cap:'round'})
    pearls.forEach(f=>{const v=clamp(age/1.03),span=contact?Math.min(63,room(contact)*.48):0,q={x:(contact?.x??b.x)+Math.cos(f.phase*6.28)*span*v*.78,y:(contact?.y??b.y)+Math.sin(f.phase*6.28)*span*.2+span*(v*.12+v*v*.67)},g=f.g;g.clear();fitArt(g,q,7);g.alpha=contact&&age>=0&&age<1.03?(1-v)*.78:0;g.circle(0,0,f.size).fill({color:0xd7cde6,alpha:.7}).circle(-f.size*.22,-f.size*.28,f.size*.3).fill(0xf4eaf7)})
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-6,y:home.y+3,rotation:-.02}),duration:.3},0)
    .to(attacker,{...pose,duration:.43,ease:'power2.inOut'},.43).to(shell,{gap:0,swing:0,duration:.16,ease:'power3.in'},.74)
    .call(()=>{contact=targetSocket('center',true);update(.9);onCue({type:'impact'})},[],.9)
    .to(shell,{gap:.14,swing:-.08,duration:.23},1.17).to(attacker,{x:home.x,y:home.y,rotation:0,duration:.54,ease:'power2.inOut'},1.3).to({}, {duration:2.1},0)
}
