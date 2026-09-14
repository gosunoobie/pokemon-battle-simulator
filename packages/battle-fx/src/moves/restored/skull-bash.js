import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function skullBash(context) {
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
  const attachment = context.source.hasAnchor?.('head') ? 'head' : 'emission', base = socket(attachment)
  const aim = Math.atan2(focus.y - base.y, focus.x - base.x), authoredLength = Math.min(77, Math.max(54, h * .3))
  const pose = fitPose(solveContact(attachment, .08, { x: focus.x - Math.cos(aim) * authoredLength, y: focus.y - Math.sin(aim) * authoredLength }))
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation)
  const strikeRoot = { x: pose.x + base.x * c - base.y * s, y: pose.y + base.x * s + base.y * c }
  const length = Math.hypot(focus.x - strikeRoot.x, focus.y - strikeRoot.y)
  const direction = Math.atan2(focus.y - strikeRoot.y, focus.x - strikeRoot.x) - pose.rotation
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const recoil = Math.max(0, Math.min(11, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const root = new Container(); root.label = 'skull-bash-root'; root.alpha = 0; temporary.addChild(root)
  const tip = new Graphics(); tip.label = 'skull-bash-tip'; tip.attachmentSocket = attachment; root.addChild(tip)
  const impact = make('skull-bash-impact')
  let contact
  function rayRoom(p, angle) {
    const x = Math.cos(angle), y = Math.sin(angle), limits = []
    if (x > 1e-6) limits.push((right - p.x - 5) / x)
    if (x < -1e-6) limits.push((left - p.x + 5) / x)
    if (y > 1e-6) limits.push((bottom - p.y - 5) / y)
    if (y < -1e-6) limits.push((top - p.y + 5) / y)
    return Math.max(0, Math.min(...limits))
  }

  const brace=fitPose({x:home.x-17,y:home.y+9,rotation:-.11})
  const pressure=make('skull-bash-pressure')
  const chips=Array.from({length:22},(_,i)=>({g:make(`skull-bash-fragment-${i}`),angle:i*Math.PI/11,reach:34+random()*39,life:.38+random()*.24}))
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

    root.alpha=show(time,.14,1.97,.31)
    const charge=clamp((time-.14)/.67)
    // A rounded pressure shell hardens over the tucked head, with no sprite scaling.
    tip.moveTo(...point(0,-.35)).bezierCurveTo(...point(.55,-.5),...point(.99,-.36),...point(1,0))
      .bezierCurveTo(...point(.99,.36),...point(.55,.5),...point(0,.35)).closePath().fill({color:0xb48b36,alpha:.13+charge*.15})
    tip.moveTo(...point(.03,-.31)).bezierCurveTo(...point(.62,-.44),...point(1,-.28),...point(1,0))
      .bezierCurveTo(...point(1,.28),...point(.62,.44),...point(.03,.31))
      .stroke({color:0xffe3a1,width:2.4+charge,alpha:.94,cap:'round'})
    for(let band=0;band<3;band++){
      const phase=(time*1.85+band/3)%1,x=.08+phase*.72,spread=.28*(1-phase*.44)
      tip.moveTo(...point(x,-spread)).quadraticCurveTo(...point(x+.19,0),...point(x,spread))
        .stroke({color:band===1?0xfff5d3:0xd6b15d,width:band===1?2.1:1.2,alpha:.36+phase*.54})
    }
    pressure.clear();pressure.alpha=show(time,.19,1.5,.25)*.7
    const body=socket(context.source.hasAnchor?.('visualCenter')?'visualCenter':'center',true)
    for(let lane=0;lane<6;lane++){
      const phase=(time*2.8+lane/6)%1,distance=Math.min(62,room(body)*.6)*(1-phase),theta=lane*Math.PI/3
      const x=body.x+Math.cos(theta)*distance,y=body.y+Math.sin(theta)*distance
      pressure.moveTo(x,y).lineTo(body.x+Math.cos(theta)*distance*.74,body.y+Math.sin(theta)*distance*.74)
        .stroke({color:lane%2?0xdbc083:0xffe9b0,width:lane%2?1.2:2,alpha:charge*.78})
    }
    const age=time-1.16,u=clamp(age/.67)
    impact.clear();impact.alpha=contact&&age>=0&&age<.67?1-u:0
    if(contact){fitArt(impact,contact,92);const r=58*(.34+u*.93)
      impact.ellipse(0,0,r*.58,r).stroke({color:0xffe6ae,width:3.6*(1-u)+1,alpha:.94})
        .ellipse(-r*.1,0,r*.4,r*.7).stroke({color:0xb99145,width:1.5,alpha:.9})
      const k=31*(1-u);impact.poly([-k,0,-k*.18,-k*.16,0,-k,k*.16,-k*.16,k,0,k*.16,k*.16,0,k,-k*.18,k*.16]).fill(0xfff6d4)
    }
    for(const chip of chips){const u=clamp(age/chip.life),g=chip.g;g.clear();g.alpha=contact&&age>=0&&age<chip.life?1-u:0;if(!contact)continue
      const d=Math.min(chip.reach,room(contact)*.62),p={x:contact.x+Math.cos(chip.angle)*d*u,y:contact.y+Math.sin(chip.angle)*d*u+d*.32*u*u}
      fitArt(g,p,10);g.rotation=chip.angle+u*2;g.poly([-5,-2,4,-3,7,1,-2,3]).fill(chip.angle<Math.PI?0xffe4a3:0xbca16d)
    }
  }
  onFrame(update)
  tl.to(attacker,{...brace,duration:.35,ease:'power2.out'},0)
    .to(attacker,{...fitPose({x:brace.x-4,y:brace.y+3,rotation:-.12}),duration:.24,ease:'sine.inOut'},.47)
    .to(attacker,{...pose,duration:.39,ease:'power4.in'},.77)
    .call(()=>{contact=targetSocket('center',true);update(1.16);onCue({type:'impact'});defender.tint=0xf2dca9},[],1.16)
    .to(defender,{x:defenderHome.x+recoil,duration:.073,repeat:5,yoyo:true},1.16)
    .call(()=>{defender.tint=0xffffff},[],1.62)
    .to(attacker,{...fitPose({x:pose.x-26,y:pose.y+7,rotation:-.025}),duration:.23,ease:'power2.out'},1.41)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.51,ease:'power2.inOut'},1.76)
}
