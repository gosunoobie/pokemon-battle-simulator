import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function spark(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const centerName = context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center', center = socket(centerName), w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  const fit = p => ({ x: Math.max(left + w / 2 - center.x, Math.min(right - w / 2 - center.x, p.x)), y: Math.max(top + h / 2 - center.y, Math.min(bottom - h / 2 - center.y, p.y)) })
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5), clamp = n => Math.max(0, Math.min(1, n))
  const pose = fit(solveContact('tackle', 0)), brace = fit({ x: home.x - 9, y: home.y + 3 }), body = socket('tackle')
  const point = { x: pose.x + body.x, y: pose.y + body.y }, receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  // Extremely wide users cannot reach a receiver parked against a field edge.
  // Bring only that receiver's nearest visible surface to the fitted tackle socket.
  const targetW = context.target.metrics.width / unit, targetH = context.target.metrics.height / unit, inset = Math.min(3, targetW / 4, targetH / 4)
  const catchX = Math.max(left + targetW / 2, Math.min(right - targetW / 2, Math.max(point.x - targetW / 2 + inset, Math.min(point.x + targetW / 2 - inset, receiver.x))))
  const catchY = Math.max(top + targetH / 2, Math.min(bottom - targetH / 2, Math.max(point.y - targetH / 2 + inset, Math.min(point.y + targetH / 2 - inset, receiver.y))))
  const targetShift = { x: catchX - receiver.x, y: catchY - receiver.y }, targetPose = { x: defenderHome.x + targetShift.x, y: defenderHome.y + targetShift.y }
  const recoil = Math.max(0, Math.min(8, right - catchX - targetW / 2))
  const crackle = new Graphics(); crackle.label = 'spark-mantle'; temporary.addChild(crackle)
  const wake = new Graphics(); wake.label = 'spark-wake'; temporary.addChild(wake)
  const tip = new Graphics(); tip.label = 'spark-tip'; tip.contactSocket = 'tackle'; tip.contactAdjusted = Math.hypot(point.x - focus.x, point.y - focus.y) > .001; tip.targetOffset = { x: point.x - focus.x - targetShift.x, y: point.y - focus.y - targetShift.y }; tip.targetShift = targetShift; temporary.addChild(tip)
  const hit = new Graphics(); hit.label = 'spark-impact'; temporary.addChild(hit)
  const sparks = Array.from({ length: 17 }, (_, i) => {
    const g = new Graphics().moveTo(-3, 1).lineTo(0, 0).lineTo(-1, -3).lineTo(3, -2).stroke({ color: i % 3 ? 0xffd74b : 0xfffdd4, width: 1.6, cap: 'round' })
    g.alpha = 0; g.label = 'spark-discharge'; temporary.addChild(g)
    return { g, angle: i * Math.PI * 2 / 17 + random() * .14, reach: 22 + random() * 28, life: .25 + random() * .18 }
  })
  let contact
  function update(time) {
    const fitted = fit(attacker); attacker.position.copyFrom(fitted)
    const c = socket(centerName, true), from = socket('tackle', true), fade = clamp((time - .03) / .13) * (1 - clamp((time - .68) / .24))
    const rx = Math.max(0, Math.min(w * .48, c.x - left - 5, right - c.x - 5)), ry = Math.max(0, Math.min(h * .48, c.y - top - 5, bottom - c.y - 5))
    crackle.position.copyFrom(c); crackle.clear(); crackle.alpha = fade
    for (let j = 0; j < 4; j++) {
      const start = time * 6 + j * Math.PI / 2
      for (let k = 0; k < 7; k++) { const a = start + k * .14, q = k % 2 ? .98 : .77, x = Math.cos(a) * rx * q, y = Math.sin(a) * ry * q; if (!k) crackle.moveTo(x, y); else crackle.lineTo(x, y) }
      crackle.stroke({ color: j % 2 ? 0xffffbd : 0xf5c437, width: j % 2 ? 2 : 1.5, cap: 'round', join: 'round' })
    }
    wake.clear(); wake.alpha = time >= .33 && time < .82 ? fade * .75 : 0
    const reach = Math.max(0, Math.min(65, c.x - left - rx * .25 - 5)), off = Math.max(0, Math.min(ry * .55, room(c)))
    for (let j = 0; j < 3; j++) { const y = c.y + (j - 1) * off; wake.moveTo(c.x - rx * .2, y).lineTo(c.x - reach * .65, y - Math.sin(time * 42 + j) * off * .15).lineTo(c.x - reach * .52, y + off * .11).lineTo(c.x - reach, y).stroke({ color: j === 1 ? 0xfff8ba : 0xf0c844, width: j === 1 ? 2 : 1.3, cap: 'round' }) }
    tip.position.copyFrom(from); tip.clear(); const r = Math.min(24, room(from)); tip.alpha = time >= .3 && time < .9 ? clamp((time - .3) / .12) * (1 - clamp((time - .69) / .21)) : 0
    tip.poly([0, 0, -r * .67, -r * .32, -r * .48, -.04 * r, -r, .15 * r, -r * .42, .23 * r]).fill(0xffffcd)
      .moveTo(-r * .45, -r * .69).lineTo(-r * .1, -r * .25).lineTo(0, 0).lineTo(-r * .24, r * .45).stroke({ color: 0xffde53, width: 2.2, cap: 'round' })
    const age = time - .64, u = clamp(age / .38); hit.clear(); hit.alpha = contact && age >= 0 && age < .38 ? 1 - u : 0
    if (contact) {
      hit.position.copyFrom(contact); const radius = Math.min(45, room(contact)) * (.4 + u * .6)
      hit.circle(0, 0, radius * .19).fill(0xffffd3)
      for (let j = 0; j < 7; j++) { const a = j * Math.PI * 2 / 7 + Math.sin(time * 29) * .09, x = Math.cos(a), y = Math.sin(a); hit.moveTo(x * radius * .15, y * radius * .15).lineTo(x * radius * .46 - y * radius * .15, y * radius * .46 + x * radius * .15).lineTo(x * radius * .54 + y * radius * .06, y * radius * .54 - x * radius * .06).lineTo(x * radius, y * radius).stroke({ color: j % 2 ? 0xfffbc1 : 0xf0c636, width: 2 - u * .7, cap: 'round', join: 'round' }) }
    }
    sparks.forEach(p => { const u = age / p.life, d = contact ? Math.max(0, Math.min(p.reach, room(contact) - 5)) : 0; p.g.alpha = contact && u >= 0 && u < 1 ? (1 - u) * .95 : 0; if (contact) { const step = clamp(u) ** .65; p.g.position.set(contact.x + Math.cos(p.angle) * d * step, contact.y + Math.sin(p.angle) * d * step); p.g.rotation = p.angle + time * 4 } })
  }
  onFrame(update)
  tl.to(attacker, { ...brace, duration: .18, ease: 'power2.out' }, 0)
    .to(attacker, { ...pose, duration: .32, ease: 'power3.in' }, .32)
    .to(defender, { ...targetPose, duration: .23, ease: 'power2.inOut' }, .41)
    .call(() => { contact = socket('tackle', true); update(.64); onCue({ type: 'impact' }); defender.tint = 0xffeba2 }, [], .64)
    .to(defender, { x: targetPose.x + recoil, duration: .055, repeat: 3, yoyo: true }, .64)
    .to(defender, { x: defenderHome.x, y: defenderHome.y, duration: .3, ease: 'power2.inOut' }, .9)
    .call(() => { defender.tint = 0xffffff }, [], .88)
    .to(attacker, { ...fit({ x: pose.x - 21, y: pose.y - 4 }), duration: .15, ease: 'power2.out' }, .72)
    .to(attacker, { x: home.x, y: home.y, duration: .43, ease: 'power2.inOut' }, .93)
    .to({}, { duration: 1.7 }, 0)
}
