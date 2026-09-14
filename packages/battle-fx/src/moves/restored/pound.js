import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function pound(context) {
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
  const attachment = context.source.hasAnchor?.('palm') ? 'palm' : 'hand', base = socket(attachment), aim = Math.atan2(focus.y - base.y, focus.x - base.x), authoredLength = Math.min(50, Math.max(32, h * .18))
  const pose = fit(solveContact(attachment, .025, { x: focus.x - Math.cos(aim) * authoredLength, y: focus.y - Math.sin(aim) * authoredLength }))
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation), strikeRoot = { x: pose.x + base.x * c - base.y * s, y: pose.y + base.x * s + base.y * c }
  const length = Math.hypot(focus.x - strikeRoot.x, focus.y - strikeRoot.y), direction = Math.atan2(focus.y - strikeRoot.y, focus.x - strikeRoot.x) - pose.rotation
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const root = new Container(); root.label = 'pound-root'; root.alpha = 0; root.attachmentSocket = attachment; temporary.addChild(root)
  const tip = new Graphics(); tip.label = 'pound-tip'; tip.attachmentSocket = attachment; root.addChild(tip)
  const impact = new Graphics(); impact.label = 'pound-impact'; impact.alpha = 0; temporary.addChild(impact)
  function rayRoom(p, angle) {
    const x = Math.cos(angle), y = Math.sin(angle), limits = []
    if (x > 1e-6) limits.push((right - p.x - 3) / x); if (x < -1e-6) limits.push((left - p.x + 3) / x)
    if (y > 1e-6) limits.push((bottom - p.y - 3) / y); if (y < -1e-6) limits.push((top - p.y + 3) / y)
    return Math.max(0, Math.min(...limits))
  }
  let contact
  const palm = { lean: -.22 }
  const wisps = Array.from({ length: 7 }, (_, i) => { const g = new Graphics(); g.label = 'pound-wisp-' + i; g.alpha = 0; temporary.addChild(g); return { g, angle: i * Math.PI * 2 / 7, life: .28 + random() * .12 } })
  function update(time) {
    const fitted = fit(attacker); attacker.position.copyFrom(fitted); attacker.rotation = fitted.rotation
    const from = socket(attachment, true), angle = direction + attacker.rotation + palm.lean, cs = Math.cos(angle), sn = Math.sin(angle), reach = Math.min(length, rayRoom(from, angle))
    root.position.copyFrom(from); root.alpha = time >= .05 && time < .98 ? Math.min(1, (time - .05) / .12, (.98 - time) / .23) : 0
    const local = (u, v) => { const p = { x: from.x + cs * reach * u, y: from.y + sn * reach * u }, across = Math.sign(v) * Math.min(Math.abs(v * reach), room(p) * .82); return [cs * reach * u - sn * across, sn * reach * u + cs * across] }
    const front = local(1, 0), point = (u, v) => { const p = local(u, v); return [p[0] - front[0], p[1] - front[1]] }; tip.position.set(...front); tip.clear()
    // Rounded fingers and a soft palm give this short slap an uncomplicated, light silhouette.
    tip.moveTo(...point(.04, -.1)).quadraticCurveTo(...point(.1, -.34), ...point(.36, -.32)).quadraticCurveTo(...point(.6, -.39), ...point(.79, -.24))
      .quadraticCurveTo(...point(1, -.18), ...point(1, 0)).quadraticCurveTo(...point(.98, .19), ...point(.72, .26))
      .quadraticCurveTo(...point(.45, .42), ...point(.25, .27)).quadraticCurveTo(...point(.07, .22), ...point(.04, -.1)).fill(0xe8c9a4).stroke({ color: 0xffe6c6, width: 1.6, join: 'round' })
    for (let j = 0; j < 3; j++) tip.moveTo(...point(.44 + j * .14, -.22)).lineTo(...point(.47 + j * .14, -.035)).stroke({ color: 0xb79270, width: 1.1, cap: 'round' })
    tip.moveTo(...point(.28, .16)).quadraticCurveTo(...point(.44, .02), ...point(.64, .11)).stroke({ color: 0xb59070, width: 1.2, cap: 'round' })
    const age = time - .5, u = clamp(age / .42); impact.clear(); impact.alpha = contact && age >= 0 && age < .42 ? 1 - u : 0
    if (contact) { impact.position.copyFrom(contact); impact.scale.set(Math.min(1, room(contact) / 40)); impact.ellipse(0, 0, 8 + u * 18, 11 + u * 24).stroke({ color: 0xffe9c8, width: 2.3 - u, alpha: .82 }); impact.ellipse(0, 0, 5 + u * 11, 7 + u * 16).stroke({ color: 0xccb79a, width: 1.2, alpha: .5 }) }
    wisps.forEach(p => { const u = clamp(age / p.life), d = contact ? Math.min(32, room(contact) * .71) : 0; p.g.clear(); p.g.alpha = contact && age >= 0 && age < p.life ? Math.sin(Math.PI * u) * .72 : 0; if (contact) { const q = { x: contact.x + Math.cos(p.angle) * d * u, y: contact.y + Math.sin(p.angle) * d * u }; p.g.position.copyFrom(q); p.g.rotation = p.angle; p.g.scale.set(Math.min(1, room(q) / 8)); p.g.moveTo(-5, -1).quadraticCurveTo(0, -3, 4, 1).stroke({ color: 0xe4cfb0, width: 1.3, cap: 'round' }) } })
  }
  onFrame(update)
  tl.to(attacker, { ...fit({ x: home.x - 5, y: home.y + 1, rotation: -.025 }), duration: .15 }, 0)
    .to(attacker, { ...pose, duration: .28, ease: 'power2.in' }, .2)
    .to(palm, { lean: 0, duration: .16, ease: 'power2.in' }, .34)
    .call(() => { contact = targetSocket('center', true); update(.5); onCue({ type: 'impact' }); defender.tint = 0xf0ddc1 }, [], .5)
    .to(defender, { x: defenderHome.x + recoil * .7, duration: .055, repeat: 1, yoyo: true }, .5)
    .call(() => { defender.tint = 0xffffff }, [], .7)
    .to(palm, { lean: -.15, duration: .13 }, .6)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .38, ease: 'power2.inOut' }, .8)
    .to({}, { duration: 1.45 }, 0)
}
