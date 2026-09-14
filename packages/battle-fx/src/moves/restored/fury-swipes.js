import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function furySwipes(context) {
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

  const attachment=context.source.hasAnchor?.('claw')?'claw':'hand',base=socket(attachment),aim=Math.atan2(focus.y-base.y,focus.x-base.x),authored=Math.min(89,Math.max(89*.65,h*.34))
  const pose=fit(solveContact(attachment,0.025,{x:focus.x-Math.cos(aim)*authored,y:focus.y-Math.sin(aim)*authored}))
  const c0=Math.cos(pose.rotation),s0=Math.sin(pose.rotation),strike={x:pose.x+base.x*c0-base.y*s0,y:pose.y+base.x*s0+base.y*c0},length=Math.hypot(focus.x-strike.x,focus.y-strike.y),direction=Math.atan2(focus.y-strike.y,focus.x-strike.x)-pose.rotation

  const hits=[.42,.67,.92],swipe={swing:-.62},root=new Container();root.label='fury-swipes-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='fury-swipes-tip';root.addChild(tip)
  const impact=make('fury-swipes-impact'),marks=hits.map((at,i)=>({g:make(`fury-swipes-contact-${i}`),at,point:null})),flecks=Array.from({length:19},(_,i)=>({g:make(`fury-swipes-fleck-${i}`),side:i%2?1:-1,reach:.2+random()*.74}))
  let contact
  function update(time){
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),b=targetSocket('center',true),exact=hits.some(t=>Math.abs(time-t)<.00001),angle=exact?Math.atan2(b.y-a.y,b.x-a.x):direction+attacker.rotation+swipe.swing,c=Math.cos(angle),s=Math.sin(angle),reach=exact?Math.hypot(b.x-a.x,b.y-a.y):Math.min(length,rayRoom(a,angle))
    root.position.copyFrom(a);root.alpha=time>=.09&&time<1.42?Math.min(1,(time-.09)/.12,(1.42-time)/.24):0
    const local=(u,v)=>{const q={x:a.x+c*reach*u,y:a.y+s*reach*u},d=Math.sign(v)*Math.min(Math.abs(v*reach),room(q)*.79);return[c*reach*u-s*d,s*reach*u+c*d]}
    const front=local(1,0),p=(u,v)=>{const q=local(u,v);return[q[0]-front[0],q[1]-front[1]]};tip.position.set(...front);tip.clear()
    for(let j=-1;j<=1;j++){const end=j===0?1:.89,lane=j*.105;tip.moveTo(...p(.01,lane*.18)).quadraticCurveTo(...p(.4,lane-.13),...p(end,lane)).quadraticCurveTo(...p(.46,lane-.04),...p(.01,lane*.18)).fill(j===0?0xf0dec2:0xd4bd9c)
      .moveTo(...p(.1,lane*.25)).quadraticCurveTo(...p(.53,lane-.095),...p(end-.018,lane)).stroke({color:0xffedcf,width:1.5,alpha:.83,cap:'round'})}
    const age=time-.92,u=clamp(age/.61);impact.clear();fitArt(impact,contact??b,61);impact.alpha=contact&&age>=0&&age<.61?1-u:0
    impact.moveTo(-25,17).quadraticCurveTo(0,-20-u*13,26,-22).stroke({color:0xebd6b7,width:2.6-u,alpha:.7,cap:'round'})
    marks.forEach((m,i)=>{const v=clamp((time-m.at)/.33),g=m.g;g.clear();fitArt(g,m.point??b,62);g.alpha=m.point&&time>=m.at&&time<m.at+.33?(1-v)*.82:0;const side=i%2?1:-1;for(let j=-1;j<=1;j++)g.moveTo(-23+j*6,-side*24+v*7).quadraticCurveTo(j*8,side*3,23+j*6,side*26+v*7).stroke({color:j?0xcbb493:0xffe8c7,width:j?2.1:3.2,alpha:.82,cap:'round'})})
    flecks.forEach((f,i)=>{const v=clamp(age/.82),span=contact?Math.min(58,room(contact)*.49):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)-span*.18*v+span*1.12*v*v},g=f.g;g.clear();fitArt(g,q,8);g.rotation=time*3+i;g.alpha=contact&&age>=0&&age<.82?(1-v)*.75:0;g.moveTo(-4,0).lineTo(4,0).stroke({color:i%2?0xcbb596:0xf1ddbd,width:1.5,cap:'round'})})
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-7,y:home.y+2,rotation:-.03}),duration:.15},0).to(attacker,{...pose,duration:.26,ease:'power3.in'},.16)
    .to(swipe,{swing:0,duration:.16,ease:'power3.in'},.26).to(swipe,{swing:.59,duration:.10},.44).to(swipe,{swing:0,duration:.12,ease:'power3.in'},.55)
    .to(swipe,{swing:-.55,duration:.10},.69).to(swipe,{swing:0,duration:.12,ease:'power3.in'},.8)
  marks.forEach((m,i)=>tl.call(()=>{m.point=targetSocket('center',true);if(i===2)contact=m.point;update(m.at);if(i===2)onCue({type:'impact'})},[],m.at))
  tl.to(swipe,{swing:.27,duration:.15},.94).to(attacker,{x:home.x,y:home.y,rotation:0,duration:.56,ease:'power2.inOut'},1.14).to({}, {duration:1.9},0)
}
