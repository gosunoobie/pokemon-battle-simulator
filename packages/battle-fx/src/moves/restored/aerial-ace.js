import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function aerialAce(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
  const show = (t, start, end, fade = .22) => t >= start && t < end ? Math.min(1, (t - start) / .12, (end - t) / fade) : 0
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fitArt = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / Math.max(1, extent))) }
  function fitPose(p) {
    let rotation = p.rotation ?? 0, c, s, rx, ry
    for (let i = 0; i < 14; i++) {
      c = Math.cos(rotation); s = Math.sin(rotation)
      rx = (w * Math.abs(c) + h * Math.abs(s)) / 2; ry = (h * Math.abs(c) + w * Math.abs(s)) / 2
      if (rx * 2 <= right - left && ry * 2 <= bottom - top) break
      rotation *= .5
    }
    const x = p.x + center.x * c - center.y * s, y = p.y + center.x * s + center.y * c
    return { x: p.x + Math.max(left + rx, Math.min(right - rx, x)) - x, y: p.y + Math.max(top + ry, Math.min(bottom - ry, y)) - y, rotation }
  }
  const attachment = context.source.hasAnchor?.('wing') ? 'wing' : 'hand', base = socket(attachment)
  const aim = Math.atan2(focus.y - base.y, focus.x - base.x), authoredLength = Math.min(107, Math.max(76, h * .4))
  const pose = fitPose(solveContact(attachment, .15, { x: focus.x - Math.cos(aim) * authoredLength, y: focus.y - Math.sin(aim) * authoredLength }))
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation)
  const strikeRoot = { x: pose.x + base.x * c - base.y * s, y: pose.y + base.x * s + base.y * c }
  const length = Math.hypot(focus.x - strikeRoot.x, focus.y - strikeRoot.y)
  const direction = Math.atan2(focus.y - strikeRoot.y, focus.x - strikeRoot.x) - pose.rotation
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const recoil = Math.max(0, Math.min(11, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const root = new Container(); root.label = 'aerial-ace-root'; root.alpha = 0; temporary.addChild(root)
  const tip = new Graphics(); tip.label = 'aerial-ace-tip'; tip.attachmentSocket = attachment; root.addChild(tip)
  const impact = make('aerial-ace-impact')
  let contact
  function rayRoom(p, angle) {
    const x = Math.cos(angle), y = Math.sin(angle), limits = []
    if (x > 1e-6) limits.push((right - p.x - 5) / x)
    if (x < -1e-6) limits.push((left - p.x + 5) / x)
    if (y > 1e-6) limits.push((bottom - p.y - 5) / y)
    if (y < -1e-6) limits.push((top - p.y + 5) / y)
    return Math.max(0, Math.min(...limits))
  }

  const high=fitPose({x:pose.x*.31,y:Math.min(home.y,pose.y)-58,rotation:-.11})
  const sweep=make('aerial-ace-trail')
  const gusts=Array.from({length:16},(_,i)=>({g:make(`aerial-ace-fragment-${i}`),angle:i*Math.PI/8,reach:28+random()*38,spin:(random()-.5)*3}))
  function update(time){
    const fitted = fitPose(attacker); attacker.position.copyFrom(fitted); attacker.rotation = fitted.rotation
    const from = socket(attachment, true), angle = direction + attacker.rotation
    const cosine = Math.cos(angle), sine = Math.sin(angle), reach = Math.min(length, rayRoom(from, angle))
    root.position.copyFrom(from); tip.position.set(cosine * reach, sine * reach); tip.clear()
    // The physical root is fixed; field-aligned contours retain their actual front at local zero.
    const point = (u, v) => {
      const axis = { x: from.x + cosine * reach * u, y: from.y + sine * reach * u }
      const across = Math.sign(v) * Math.min(Math.abs(v * reach), room(axis) * .82)
      return [cosine * reach * (u - 1) - sine * across, sine * reach * (u - 1) + cosine * across]
    }
    const poly = points => points.flatMap(([u, v]) => point(u, v))

    root.alpha=show(time,.16,1.08,.25)
    // One sharply bent airfoil rides the wing socket through the diagonal crossing.
    tip.moveTo(...point(0,0)).quadraticCurveTo(...point(.35,-.36),...point(1,0))
      .quadraticCurveTo(...point(.48,-.11),...point(.1,.12)).closePath().fill({color:0xa4ddf3,alpha:.61})
      .moveTo(...point(0,0)).quadraticCurveTo(...point(.4,-.25),...point(1,0))
      .quadraticCurveTo(...point(.46,-.07),...point(0,0)).fill(0xf0fdff)
      .moveTo(...point(.11,-.027)).quadraticCurveTo(...point(.48,-.15),...point(1,0)).stroke({color:0xffffff,width:2.5,alpha:.98})
    sweep.clear();sweep.alpha=show(time,.27,.98,.2)*.82
    const body=socket(context.source.hasAnchor?.('visualCenter')?'visualCenter':'center',true)
    for(let lane=0;lane<5;lane++){
      const backwards=Math.min(135-lane*13,rayRoom(body,angle+Math.PI)),off=(lane-2)*Math.min(12,room(body)*.15)
      const start={x:body.x-cosine*backwards,y:body.y-sine*backwards}
      const offset=Math.sign(off)*Math.min(Math.abs(off),room(start)*.7,room(body)*.7)
      sweep.moveTo(start.x-sine*offset,start.y+cosine*offset)
        .quadraticCurveTo(body.x-cosine*backwards*.5-sine*offset*.6,body.y-sine*backwards*.5+cosine*offset*.6,body.x-sine*offset*.3,body.y+cosine*offset*.3)
        .stroke({color:lane===2?0xf4feff:0x9cd6ee,width:lane===2?3.2:1.25,alpha:lane===2?.9:.6,cap:'round'})
    }
    const age=time-.62,u=clamp(age/.46)
    impact.clear();impact.alpha=contact&&age>=0&&age<.46?1-u:0
    if(contact){fitArt(impact,contact,78);const r=48*(.7+u*.6)
      impact.poly([-r,-r*.62,-r*.07,-r*.09,r,r*.62,r*.07,r*.09]).fill(0xf4fdff)
        .poly([-r*.61,r*.48,-r*.06,r*.04,r*.61,-r*.48,r*.06,-r*.04]).fill(0xd0f1ff)
      impact.moveTo(-r*.73,-r*.25).quadraticCurveTo(0,-r*.13,r*.64,r*.52).stroke({color:0x90d7f5,width:1.3,alpha:.88})
    }
    for(const gust of gusts){const u=clamp(age/.55),g=gust.g;g.clear();g.alpha=contact&&age>=0&&age<.55?1-u:0;if(!contact)continue
      const d=Math.min(gust.reach,room(contact)*.7),p={x:contact.x+Math.cos(gust.angle)*d*u,y:contact.y+Math.sin(gust.angle)*d*u+d*.15*u*u}
      fitArt(g,p,12);g.rotation=gust.angle+gust.spin*u;g.moveTo(-8,2).quadraticCurveTo(0,-5,8,0).stroke({color:0xd9f6ff,width:1.5,alpha:.92})
    }
  }
  onFrame(update)
  tl.to(attacker,{...high,duration:.28,ease:'power2.out'},0)
    .to(attacker,{...pose,duration:.34,ease:'power3.in'},.28)
    .call(()=>{contact=targetSocket('center',true);update(.62);onCue({type:'impact'});defender.tint=0xd4f3ff},[],.62)
    .to(defender,{x:defenderHome.x+recoil*.8,duration:.06,repeat:3,yoyo:true},.62)
    .call(()=>{defender.tint=0xffffff},[],.91)
    .to(attacker,{...fitPose({x:pose.x-28,y:pose.y+12,rotation:.06}),duration:.2,ease:'power2.out'},.79)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.49,ease:'power2.inOut'},1.1)
}
