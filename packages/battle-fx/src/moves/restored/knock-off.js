import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function knockOff(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  const clamp = n => Math.max(0, Math.min(1, n)), room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  function fit(p) {
    let rotation = p.rotation ?? 0, c, s, rx, ry
    for (let j = 0; j < 14; j++) { c = Math.cos(rotation); s = Math.sin(rotation); rx = (w * Math.abs(c) + h * Math.abs(s)) / 2; ry = (h * Math.abs(c) + w * Math.abs(s)) / 2; if (rx * 2 <= right - left && ry * 2 <= bottom - top) break; rotation *= .5 }
    const x = p.x + center.x * c - center.y * s, y = p.y + center.x * s + center.y * c
    return { x: p.x + Math.max(left + rx, Math.min(right - rx, x)) - x, y: p.y + Math.max(top + ry, Math.min(bottom - ry, y)) - y, rotation }
  }
  const attachment = 'hand', base = socket(attachment), aim = Math.atan2(focus.y - base.y, focus.x - base.x), authoredLength = Math.min(82, Math.max(54, h * .29))
  const pose = fit(solveContact(attachment, .035, { x: focus.x - Math.cos(aim) * authoredLength, y: focus.y - Math.sin(aim) * authoredLength }))
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation), strikeRoot = { x: pose.x + base.x * c - base.y * s, y: pose.y + base.x * s + base.y * c }
  const length = Math.hypot(focus.x - strikeRoot.x, focus.y - strikeRoot.y), direction = Math.atan2(focus.y - strikeRoot.y, focus.x - strikeRoot.x) - pose.rotation
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const root = new Container(); root.label = 'knock-off-root'; root.alpha = 0; root.attachmentSocket = attachment; temporary.addChild(root)
  const tip = new Graphics(); tip.label = 'knock-off-tip'; tip.attachmentSocket = attachment; root.addChild(tip)
  const impact = new Graphics(); impact.label = 'knock-off-impact'; impact.alpha = 0; temporary.addChild(impact)
  function rayRoom(p, angle) {
    const x = Math.cos(angle), y = Math.sin(angle), limits = []
    if (x > 1e-6) limits.push((right - p.x - 3) / x); if (x < -1e-6) limits.push((left - p.x + 3) / x)
    if (y > 1e-6) limits.push((bottom - p.y - 3) / y); if (y < -1e-6) limits.push((top - p.y + 3) / y)
    return Math.max(0, Math.min(...limits))
  }
  let contact
  const swing = { angle: -.58 }
  const sleeve = new Graphics(); sleeve.label = 'knock-off-sleeve'; root.addChild(sleeve)
  const item = new Graphics(); item.label = 'knock-off-token'; item.alpha = 0; temporary.addChild(item)
  item.poly([0, -9, 8, -4, 8, 5, 0, 10, -8, 5, -8, -4]).fill(0xd5aa4f).stroke({ color: 0xffdf8c, width: 1.6 }).circle(0, 0, 3).fill(0xf4df9b)
  const flecks = Array.from({ length: 12 }, (_, i) => { const g = new Graphics().ellipse(0, 0, 2.3, 1.2).fill(i % 2 ? 0xc2aacb : 0xe3c47d); g.label = 'knock-off-fleck-' + i; g.alpha = 0; temporary.addChild(g); return { g, angle: random() * 6.28, reach: 21 + random() * 22, life: .36 + random() * .2 } })
  function update(time) {
    const fitted = fit(attacker); attacker.position.copyFrom(fitted); attacker.rotation = fitted.rotation
    const from = socket(attachment, true), angle = direction + attacker.rotation + swing.angle, cs = Math.cos(angle), sn = Math.sin(angle), reach = Math.min(length, rayRoom(from, angle))
    root.position.copyFrom(from); root.alpha = time >= .08 && time < 1.25 ? Math.min(1, (time - .08) / .14, (1.25 - time) / .25) : 0
    const local = (u, v) => { const p = { x: from.x + cs * reach * u, y: from.y + sn * reach * u }, across = Math.sign(v) * Math.min(Math.abs(v * reach), room(p) * .82); return [cs * reach * u - sn * across, sn * reach * u + cs * across] }
    const front = local(1, 0), point = (u, v) => { const p = local(u, v); return [p[0] - front[0], p[1] - front[1]] }; tip.position.set(...front); tip.clear()
    // A flat dark palm sweeps sideways; its longest fingertip is the exact contact point.
    tip.moveTo(...point(.07, -.1)).quadraticCurveTo(...point(.28, -.28), ...point(.58, -.23)).lineTo(...point(.91, -.17))
      .quadraticCurveTo(...point(1, -.12), ...point(1, 0)).lineTo(...point(.74, .2)).quadraticCurveTo(...point(.55, .34), ...point(.38, .2))
      .quadraticCurveTo(...point(.11, .17), ...point(.07, -.1)).fill(0x645575).stroke({ color: 0xbda5c9, width: 1.8, join: 'round' })
    for (let j = 0; j < 3; j++) tip.moveTo(...point(.66, -.13 + j * .072)).lineTo(...point(.89, -.09 + j * .06)).stroke({ color: 0xd0bfd8, width: 1.1, alpha: .8 })
    tip.moveTo(...point(.38, .18)).quadraticCurveTo(...point(.48, .03), ...point(.69, .07)).stroke({ color: 0x30253c, width: 1.7 })
    sleeve.clear(); const a = local(.04, -.13), b = local(.22, -.19), c = local(.22, .18), d = local(.04, .11); sleeve.poly([...a, ...b, ...c, ...d]).fill(0x352c44)
    const age = time - .72, u = clamp(age / .45); impact.clear(); impact.alpha = contact && age >= 0 && age < .45 ? 1 - u : 0
    if (contact) { impact.position.copyFrom(contact); impact.scale.set(Math.min(1, room(contact) / 52)); for (let j = 0; j < 3; j++) { const y = (j - 1) * 11, x = u * 12; impact.moveTo(-24 + x, y - 7).lineTo(8 + x, y + 2).lineTo(-3 + x, y + 5).stroke({ color: j === 1 ? 0xf4d99b : 0xbda6c8, width: j === 1 ? 3 : 1.5, alpha: .8, cap: 'round' }) } }
    const travel = clamp(age / .84); item.alpha = contact && age >= .025 && age < .92 ? clamp((age - .025) / .08) * (1 - clamp((age - .66) / .26)) : 0
    if (contact) { const rightward = Math.min(84, Math.max(0, right - contact.x - 15)), drop = Math.min(69, Math.max(0, bottom - contact.y - 15)), lift = Math.min(22, room(contact) * .5), p = { x: contact.x + rightward * travel, y: contact.y - lift * Math.sin(Math.PI * travel) + drop * travel * travel }; item.position.copyFrom(p); item.rotation = time * 8; item.scale.set(Math.min(1, room(p) / 13)) }
    flecks.forEach(p => { const u = clamp(age / p.life), d = contact ? Math.min(p.reach, room(contact) * .66) : 0; p.g.alpha = contact && age >= 0 && age < p.life ? 1 - u : 0; if (contact) { const q = { x: contact.x + Math.cos(p.angle) * d * u, y: contact.y + Math.sin(p.angle) * d * u + d * .18 * u * u }; p.g.position.copyFrom(q); p.g.rotation = p.angle + time * 2; p.g.scale.set(Math.min(1, room(q) / 4)) } })
  }
  onFrame(update)
  tl.to(attacker, { ...fit({ x: home.x - 8, y: home.y + 2, rotation: -.055 }), duration: .25 }, 0)
    .to(attacker, { ...pose, duration: .34, ease: 'power3.in' }, .36)
    .to(swing, { angle: 0, duration: .23, ease: 'power3.in' }, .49)
    .call(() => { contact = targetSocket('center', true); update(.72); onCue({ type: 'impact' }); defender.tint = 0xd0bbd5 }, [], .72)
    .to(defender, { x: defenderHome.x + recoil, duration: .075, repeat: 1, yoyo: true }, .72)
    .call(() => { defender.tint = 0xffffff }, [], .94)
    .to(swing, { angle: .37, duration: .2, ease: 'power2.out' }, .75)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .48, ease: 'power2.inOut' }, 1.09)
    .to({}, { duration: 1.95 }, 0)
}
