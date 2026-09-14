import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function feintAttack(context) {
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
  const attachment = context.source.hasAnchor?.('palm') ? 'palm' : 'hand', base = socket(attachment)
  const aim = Math.atan2(focus.y - base.y, focus.x - base.x), authoredLength = Math.min(66, Math.max(46, h * .25))
  const pose = fitPose(solveContact(attachment, .075, { x: focus.x - Math.cos(aim) * authoredLength, y: focus.y - Math.sin(aim) * authoredLength }))
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation)
  const strikeRoot = { x: pose.x + base.x * c - base.y * s, y: pose.y + base.x * s + base.y * c }
  const length = Math.hypot(focus.x - strikeRoot.x, focus.y - strikeRoot.y)
  const direction = Math.atan2(focus.y - strikeRoot.y, focus.x - strikeRoot.x) - pose.rotation
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const recoil = Math.max(0, Math.min(11, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const root = new Container(); root.label = 'feint-attack-root'; root.alpha = 0; temporary.addChild(root)
  const tip = new Graphics(); tip.label = 'feint-attack-tip'; tip.attachmentSocket = attachment; root.addChild(tip)
  const impact = make('feint-attack-impact')
  let contact
  function rayRoom(p, angle) {
    const x = Math.cos(angle), y = Math.sin(angle), limits = []
    if (x > 1e-6) limits.push((right - p.x - 5) / x)
    if (x < -1e-6) limits.push((left - p.x + 5) / x)
    if (y > 1e-6) limits.push((bottom - p.y - 5) / y)
    if (y < -1e-6) limits.push((top - p.y + 5) / y)
    return Math.max(0, Math.min(...limits))
  }

  const echoes = Array.from({ length: 7 }, (_, i) => ({ g: make(`feint-attack-echo-${i}`), offset: i / 7, twist: (random() - .5) * .6 }))
  const splinters = Array.from({ length: 15 }, (_, i) => ({ g: make(`feint-attack-fragment-${i}`), angle: i * Math.PI * 2 / 15, reach: 23 + random() * 35 }))
  function update(time) {
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

    root.alpha = show(time, .16, 1.13, .25)
    // A broad dark palm turns its fingers into the strike; it never leaves the real hand.
    tip.poly(poly([[0,-.11],[.45,-.21],[.73,-.29],[.93,-.19],[1,0],[.92,.11],[.8,.11],[.73,.23],[.54,.19],[.25,.12],[0,.11]]))
      .fill(0x363447).stroke({color:0xa496b4,width:1.5,alpha:.82,join:'round'})
    tip.poly(poly([[.42,-.15],[.72,-.23],[.88,-.12],[.95,0],[.71,.1],[.54,.11]]))
      .fill(0x615974)
    for(let j=0;j<3;j++) tip.moveTo(...point(.64+j*.1,-.16+j*.035)).lineTo(...point(.7+j*.08,.025+j*.013))
      .stroke({color:0xc2b3cf,width:1.2,alpha:.78})
    const body=socket(context.source.hasAnchor?.('visualCenter')?'visualCenter':'center',true)
    for(const echo of echoes){
      const g=echo.g, phase=(time*2.2+echo.offset)%1, distance=Math.min(39,room(body)*.65)
      const p={x:body.x-distance*(.2+phase),y:body.y+(echo.offset-.5)*distance*.9}
      g.clear();fitArt(g,p,24);g.rotation=-.28+echo.twist;g.alpha=show(time,.08,.91,.2)*(1-phase)*.44
      g.poly([-18,0,-5,-6,15,-2,20,0,4,6,-12,4]).fill(echo.offset>.5?0x4b415d:0x292738)
        .moveTo(-16,0).lineTo(10,-1).stroke({color:0xb69fc6,width:1,alpha:.55})
    }
    const age=time-.66,u=clamp(age/.44)
    impact.clear();impact.alpha=contact&&age>=0&&age<.44?1-u:0
    if(contact){fitArt(impact,contact,66);const r=38*(.65+u*.6)
      impact.poly([-r,0,-r*.23,-r*.12,0,-r*.68,r*.15,-r*.13,r,0,r*.13,r*.15,0,r*.68,-r*.21,r*.14]).fill(0x4f415d)
        .moveTo(-r*.74,r*.24).lineTo(r*.65,-r*.24).stroke({color:0xe5d4ef,width:2.8,alpha:.95})
      for(let j=0;j<3;j++){const y=(j-1)*r*.23;impact.moveTo(-r*.5,y).lineTo(r*.42,y-r*.17).stroke({color:0xb99acb,width:1.4,alpha:.8})}
    }
    for(const fragment of splinters){const u=clamp(age/.49),g=fragment.g;g.clear();g.alpha=contact&&age>=0&&age<.49?1-u:0;if(!contact)continue
      const d=Math.min(fragment.reach,room(contact)*.65),p={x:contact.x+Math.cos(fragment.angle)*d*u,y:contact.y+Math.sin(fragment.angle)*d*u+d*.18*u*u}
      fitArt(g,p,9);g.rotation=fragment.angle+u;g.poly([-5,0,0,-2,6,0,0,2]).fill(0xad92bb)
    }
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:home.x-12,y:home.y-17,rotation:-.06}),duration:.19,ease:'power2.out'},0)
    .to(attacker,{...fitPose({x:home.x+7,y:home.y+7,rotation:.025}),duration:.12,ease:'power2.inOut'},.24)
    .to(attacker,{...pose,duration:.23,ease:'power4.in'},.43)
    .call(()=>{contact=targetSocket('center',true);update(.66);onCue({type:'impact'});defender.tint=0xd4c1e0},[],.66)
    .to(defender,{x:defenderHome.x+recoil*.7,duration:.065,repeat:3,yoyo:true},.66)
    .call(()=>{defender.tint=0xffffff},[],.95)
    .to(attacker,{...fitPose({x:pose.x-24,y:pose.y+8,rotation:-.035}),duration:.2,ease:'power2.out'},.86)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.43,ease:'power2.inOut'},1.15)
}
