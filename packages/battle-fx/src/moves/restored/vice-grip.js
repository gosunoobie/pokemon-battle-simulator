import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function viceGrip(context) {
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
  const pose=fit(solveContact(attachment,0.035,{x:focus.x-Math.cos(aim)*authored,y:focus.y-Math.sin(aim)*authored}))
  const c0=Math.cos(pose.rotation),s0=Math.sin(pose.rotation),strike={x:pose.x+base.x*c0-base.y*s0,y:pose.y+base.x*s0+base.y*c0},length=Math.hypot(focus.x-strike.x,focus.y-strike.y),direction=Math.atan2(focus.y-strike.y,focus.x-strike.x)-pose.rotation

  const grip={opening:.36,swing:-.22},root=new Container();root.label='vice-grip-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='vice-grip-tip';root.addChild(tip)
  const impact=make('vice-grip-impact'),chips=Array.from({length:12},(_,i)=>({g:make(`vice-grip-chip-${i}`),side:i%2?1:-1,reach:.25+random()*.7}))
  let contact
  function update(time){
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),b=targetSocket('center',true),exact=Math.abs(time-.8)<.00001,angle=exact?Math.atan2(b.y-a.y,b.x-a.x):direction+attacker.rotation+grip.swing,c=Math.cos(angle),s=Math.sin(angle),reach=exact?Math.hypot(b.x-a.x,b.y-a.y):Math.min(length,rayRoom(a,angle))
    root.position.copyFrom(a);root.alpha=time>=.1&&time<1.39?Math.min(1,(time-.1)/.17,(1.39-time)/.27):0
    const local=(u,v)=>{const q={x:a.x+c*reach*u,y:a.y+s*reach*u},d=Math.sign(v)*Math.min(Math.abs(v*reach),room(q)*.78);return[c*reach*u-s*d,s*reach*u+c*d]}
    const front=local(1,0),p=(u,v)=>{const q=local(u,v);return[q[0]-front[0],q[1]-front[1]]};tip.position.set(...front);tip.clear()
    for(const side of[-1,1]){
      const gap=side*grip.opening
      tip.moveTo(...p(.01,side*.04)).quadraticCurveTo(...p(.28,side*.31),...p(.64,side*.26+gap)).quadraticCurveTo(...p(.93,side*.22+gap),...p(1,gap))
        .quadraticCurveTo(...p(.84,side*.025+gap),...p(.67,side*.06+gap)).lineTo(...p(.54,side*.045+gap)).lineTo(...p(.49,side*.10+gap)).lineTo(...p(.42,side*.06+gap)).quadraticCurveTo(...p(.14,side*.09),...p(.01,side*.04)).fill(side<0?0xd39a70:0xb8785b)
        .moveTo(...p(.09,side*.05)).quadraticCurveTo(...p(.48,side*.25+gap),...p(.88,side*.13+gap)).stroke({color:side<0?0xffd2a0:0xe7b182,width:2.7,alpha:.8,cap:'round'})
    }
    const age=time-.8,u=clamp(age/.64);impact.clear();fitArt(impact,contact??b,65);impact.alpha=contact&&age>=0&&age<.64?1-u:0
    for(const side of[-1,1])impact.moveTo(-22,side*(20+u*12)).quadraticCurveTo(16,side*5,27,side*(17+u*13)).stroke({color:side<0?0xffdcb0:0xc28e6c,width:3-u,alpha:.74,cap:'round'})
    chips.forEach((f,i)=>{const v=clamp(age/.96),span=contact?Math.min(56,room(contact)*.47):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)-span*.16*v+span*1.15*v*v},g=f.g;g.clear();fitArt(g,q,8);g.rotation=time*3+i;g.alpha=contact&&age>=0&&age<.96?(1-v)*.72:0;g.poly([-3,0,0,-2,4,1,0,2]).fill(i%2?0xddb68d:0xb78966)})
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-8,y:home.y+2,rotation:-.025}),duration:.24},0)
    .to(attacker,{...pose,duration:.44,ease:'power2.inOut'},.34).to(grip,{opening:0,swing:0,duration:.2,ease:'power3.in'},.6)
    .call(()=>{contact=targetSocket('center',true);update(.8);onCue({type:'impact'})},[],.8)
    .to(grip,{opening:.17,swing:.14,duration:.26},1.02).to(attacker,{x:home.x,y:home.y,rotation:0,duration:.52,ease:'power2.inOut'},1.19).to({}, {duration:1.95},0)
}
