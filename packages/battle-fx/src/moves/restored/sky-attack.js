import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function skyAttack(context) {
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
  const aim = Math.atan2(focus.y - base.y, focus.x - base.x), authoredLength = Math.min(143, Math.max(98, h * .56))
  const pose = fitPose(solveContact(attachment, .17, { x: focus.x - Math.cos(aim) * authoredLength, y: focus.y - Math.sin(aim) * authoredLength }))
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation)
  const strikeRoot = { x: pose.x + base.x * c - base.y * s, y: pose.y + base.x * s + base.y * c }
  const length = Math.hypot(focus.x - strikeRoot.x, focus.y - strikeRoot.y)
  const direction = Math.atan2(focus.y - strikeRoot.y, focus.x - strikeRoot.x) - pose.rotation
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const recoil = Math.max(0, Math.min(11, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const root = new Container(); root.label = 'sky-attack-root'; root.alpha = 0; temporary.addChild(root)
  const tip = new Graphics(); tip.label = 'sky-attack-tip'; tip.attachmentSocket = attachment; root.addChild(tip)
  const impact = make('sky-attack-impact')
  let contact
  function rayRoom(p, angle) {
    const x = Math.cos(angle), y = Math.sin(angle), limits = []
    if (x > 1e-6) limits.push((right - p.x - 5) / x)
    if (x < -1e-6) limits.push((left - p.x + 5) / x)
    if (y > 1e-6) limits.push((bottom - p.y - 5) / y)
    if (y < -1e-6) limits.push((top - p.y + 5) / y)
    return Math.max(0, Math.min(...limits))
  }

  const high=fitPose({x:pose.x*.38,y:Math.min(home.y,pose.y)-92,rotation:-.12})
  const halo=make('sky-attack-aura'),flight=make('sky-attack-flight')
  const feathers=Array.from({length:24},(_,i)=>({g:make(`sky-attack-feather-${i}`),phase:i/24,angle:i*Math.PI/12,size:8+random()*6,reach:35+random()*48,spin:(random()-.5)*3}))
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

    const charge=clamp((time-.13)/.67)
    root.alpha=show(time,.18,2.1,.32)
    // A swept, feathered gold wing grows from the socket into a luminous leading edge.
    tip.moveTo(...point(0,0)).quadraticCurveTo(...point(.47,-.32),...point(1,0))
      .quadraticCurveTo(...point(.54,.14),...point(.14,.2)).closePath().fill({color:0xeebc56,alpha:.36+charge*.27})
    for(let j=0;j<7;j++){
      const u=.14+j*.095,end=.3+j*.115,spread=.34*(1-j/7)
      tip.poly(poly([[u,-.015],[u+.18,-.14],[end,spread],[u+.04,.09]]))
        .fill({color:j%2?0xffe8a5:0xf6d16f,alpha:.78})
      tip.moveTo(...point(u+.13,-.09)).lineTo(...point(end,spread)).stroke({color:0xfff7d6,width:1.6,alpha:.94})
    }
    tip.moveTo(...point(0,0)).quadraticCurveTo(...point(.46,-.22),...point(1,0))
      .stroke({color:0xffffe9,width:3.1,alpha:1,cap:'round'})
    const body=socket(context.source.hasAnchor?.('visualCenter')?'visualCenter':'center',true)
    const auraRadius=Math.min(Math.max(w,h)*.57,room(body)*.83)
    halo.clear();halo.position.copyFrom(body);halo.alpha=show(time,.08,1.57,.29)*.56
    for(let lane=0;lane<3;lane++){
      const radius=auraRadius*(.63+lane*.13),rotation=time*(lane%2?-1.7:1.4)+lane*2
      for(let j=0;j<=28;j++){
        const theta=rotation+j*.061,r=radius*(.97+.025*Math.sin(j*1.7+time*11)),p=[Math.cos(theta)*r*.82,Math.sin(theta)*r]
        j?halo.lineTo(...p):halo.moveTo(...p)
      }
      halo.stroke({color:lane===1?0xffe9ab:0xcda34e,width:lane===1?2.4:1.4,alpha:.56+charge*.35})
    }
    flight.clear();flight.alpha=show(time,.88,1.72,.27)*.72
    if(flight.alpha>0)for(let lane=0;lane<5;lane++){
      const back=Math.min(150-lane*17,rayRoom(body,angle+Math.PI)),side=(lane-2)*Math.min(11,room(body)*.12)
      const end={x:body.x-cosine*back,y:body.y-sine*back},across=Math.sign(side)*Math.min(Math.abs(side),room(end)*.7)
      flight.moveTo(end.x-sine*across,end.y+cosine*across)
        .quadraticCurveTo(body.x-cosine*back*.5-sine*across*.6,body.y-sine*back*.5+cosine*across*.6,body.x,body.y)
        .stroke({color:lane===2?0xfff8cf:0xe8c576,width:lane===2?3.5:1.7,alpha:lane===2?.92:.58,cap:'round'})
    }
    const age=time-1.28,u=clamp(age/.78)
    impact.clear();impact.alpha=contact&&age>=0&&age<.78?1-u:0
    if(contact){fitArt(impact,contact,105);const r=62*(.65+u*.7)
      impact.poly([-r,0,-r*.18,-r*.16,0,-r*.79,r*.16,-r*.16,r,0,r*.16,r*.16,0,r*.79,-r*.18,r*.16]).fill(0xfff4ca)
      for(const side of[-1,1])impact.moveTo(-r*.69,side*r*.37).quadraticCurveTo(0,side*r*.11,r*.69,side*r*.37)
        .stroke({color:0xe2b757,width:2,alpha:.88})
    }
    for(const feather of feathers){
      const g=feather.g;g.clear();let p
      if(age<0){
        const phase=(time*.8+feather.phase)%1,theta=feather.angle+time*.7,radius=auraRadius*(1.02-phase*.54)
        p={x:body.x+Math.cos(theta)*radius*.83,y:body.y+Math.sin(theta)*radius}
        g.rotation=theta+Math.PI*.5;g.alpha=show(time,.1,1.29,.15)*Math.sin(phase*Math.PI)*.83
      }else{
        const v=clamp(age/.86),distance=contact?Math.min(feather.reach,room(contact)*.6):0
        p=contact?{x:contact.x+Math.cos(feather.angle)*distance*v,y:contact.y+Math.sin(feather.angle)*distance*v+distance*.32*v*v}:body
        g.rotation=feather.angle+feather.spin*v;g.alpha=age<.86?(1-v)*.88:0
      }
      fitArt(g,p,feather.size*1.5);const r=feather.size
      g.moveTo(-r,0).quadraticCurveTo(-r*.15,-r*.43,r,0).quadraticCurveTo(-r*.13,r*.22,-r,0).fill(feather.phase>.5?0xffe8a6:0xe9c475)
        .moveTo(-r*.84,0).lineTo(r*.8,0).stroke({color:0xfffbe0,width:.8,alpha:.8})
    }
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:home.x-13,y:home.y+3,rotation:-.055}),duration:.38,ease:'power2.out'},0)
    .to(attacker,{...high,duration:.36,ease:'power2.out'},.58)
    .to(attacker,{...pose,duration:.34,ease:'power3.in'},.94)
    .call(()=>{contact=targetSocket('center',true);update(1.28);onCue({type:'impact'});defender.tint=0xfbe5ab},[],1.28)
    .to(defender,{x:defenderHome.x+recoil,duration:.076,repeat:5,yoyo:true},1.28)
    .call(()=>{defender.tint=0xffffff},[],1.76)
    .to(attacker,{...fitPose({x:pose.x-32,y:pose.y+14,rotation:.045}),duration:.22,ease:'power2.out'},1.52)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.53,ease:'power2.inOut'},1.9)
}
