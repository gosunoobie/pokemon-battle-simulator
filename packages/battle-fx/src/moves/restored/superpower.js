import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function superpower(context) {
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


  const attachment=context.source.hasAnchor?.('fist')?'fist':'hand',base=socket(attachment),aim=Math.atan2(focus.y-base.y,focus.x-base.x),authored=Math.min(91,Math.max(60,h*.31))
  const pose=fit(solveContact(attachment,.045,{x:focus.x-Math.cos(aim)*authored,y:focus.y-Math.sin(aim)*authored}))
  const c=Math.cos(pose.rotation),s=Math.sin(pose.rotation),at={x:pose.x+base.x*c-base.y*s,y:pose.y+base.x*s+base.y*c},length=Math.hypot(focus.x-at.x,focus.y-at.y),direction=Math.atan2(focus.y-at.y,focus.x-at.x)-pose.rotation,drive={swing:-.19,spread:.32}
  const root=new Container();root.label='superpower-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='superpower-tip';root.addChild(tip)
  const rear=new Graphics();rear.label='superpower-second-fist';root.addChild(rear)
  const brace=make('superpower-brace'),impact=make('superpower-impact'),folds=make('superpower-force-folds')
  const embers=Array.from({length:22},(_,i)=>({g:make(`superpower-ember-${i}`),side:i%2?1:-1,reach:.2+random()*.75,life:1.35}))
  let contact
  function update(time){
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),b=targetSocket('center',true),center=socket('center',true),exact=Math.abs(time-1.1)<.00001,angle=exact?Math.atan2(b.y-a.y,b.x-a.x):direction+attacker.rotation+drive.swing,c=Math.cos(angle),s=Math.sin(angle),reach=exact?Math.hypot(b.x-a.x,b.y-a.y):Math.min(length,rayRoom(a,angle))
    root.position.copyFrom(a);root.alpha=time>=.24&&time<1.88?Math.min(1,(time-.24)/.22,(1.88-time)/.3):0
    const local=(u,v)=>{const q={x:a.x+c*reach*u,y:a.y+s*reach*u},d=Math.sign(v)*Math.min(Math.abs(v*reach),room(q)*.78);return[c*reach*u-s*d,s*reach*u+c*d]}
    for(const [g,lane,end]of[[tip,0,1],[rear,drive.spread,.79]]){const front=local(end,lane),p=(u,v)=>{const q=local(u,v);return[q[0]-front[0],q[1]-front[1]]};g.position.set(...front);g.clear()
      g.moveTo(...p(.02,lane-.07)).lineTo(...p(.36,lane-.11)).lineTo(...p(end-.35,lane-.25)).lineTo(...p(end-.10,lane-.25)).quadraticCurveTo(...p(end,lane-.20),...p(end,lane)).lineTo(...p(end-.08,lane+.22)).lineTo(...p(end-.35,lane+.22)).lineTo(...p(.31,lane+.1)).lineTo(...p(.02,lane+.07)).closePath().fill(lane?0xc18c5c:0xe4b575)
        .moveTo(...p(end-.3,lane-.19)).lineTo(...p(end-.09,lane-.19)).quadraticCurveTo(...p(end-.035,lane-.14),...p(end-.035,lane)).stroke({color:lane?0xecc490:0xffe4ac,width:3,alpha:.88,cap:'round'})
      for(let j=0;j<3;j++)g.moveTo(...p(end-.27+j*.07,lane-.18)).lineTo(...p(end-.27+j*.07,lane-.02)).stroke({color:0x9d6d49,width:1.7})
    }
    brace.clear();fitArt(brace,center,105);brace.alpha=time>=.07&&time<1.26?Math.min(1,(time-.07)/.28,(1.26-time)/.22)*.78:0
    const charge=clamp(time/.83),r=41+charge*31;for(const side of[-1,1])brace.moveTo(side*r,-30).lineTo(side*(r*.7),-49).lineTo(side*(r*.82),22).lineTo(side*r,40).stroke({color:side<0?0xbf7d4d:0xe9b678,width:3.1,alpha:.7,cap:'round',join:'round'})
    const age=time-1.1,u=clamp(age/.76);impact.clear();fitArt(impact,contact??b,94);impact.alpha=contact&&age>=0&&age<.76?1-u:0
    const size=15+u*56;for(const side of[-1,1])impact.moveTo(0,-size).lineTo(side*size*.75,-size*.3).lineTo(side*size*.55,size*.58).lineTo(0,size*.86).stroke({color:side<0?0xffd99a:0xdd9858,width:5-u*3,alpha:.79,cap:'round',join:'round'})
    folds.clear();fitArt(folds,contact??b,102);folds.alpha=contact&&age>=0&&age<1.12?(1-clamp(age/1.12))*.81:0
    for(let j=0;j<3;j++){const v=(clamp(age/1.12)+j*.24)%1,r=18+v*53;folds.moveTo(-r*.5,-r*.69).quadraticCurveTo(r*.7,0,-r*.5,r*.69).stroke({color:j%2?0xc78b55:0xe7b879,width:2.4-v,alpha:.66,cap:'round'})}
    embers.forEach((f,i)=>{const v=clamp(age/f.life),span=contact?Math.min(86,room(contact)*.45):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)-span*.3*v+span*1.26*v*v},g=f.g;g.clear();fitArt(g,q,10);g.rotation=i+time*2.9;g.alpha=contact&&age>=0&&age<f.life?(1-v)*.92:0;g.poly([-4,0,-1,-2,4,-1,1,2]).fill(i%2?0xe6ac69:0xbf8754)})
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-15,y:home.y+6,rotation:-.04}),duration:.39},0)
    .to(attacker,{...fit({x:home.x-19,y:home.y+9,rotation:-.055}),duration:.28},.39)
    .to(attacker,{...pose,duration:.43,ease:'power4.in'},.67).to(drive,{swing:0,spread:.22,duration:.32,ease:'power3.in'},.78)
    .call(()=>{contact=targetSocket('center',true);update(1.1);onCue({type:'impact'})},[],1.1)
    .to(drive,{swing:.12,spread:.35,duration:.2},1.11).to(attacker,{...fit({x:pose.x-12,y:pose.y+5,rotation:.015}),duration:.25},1.19)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.73,ease:'power2.inOut'},1.52).to({}, {duration:2.65},0)
}
