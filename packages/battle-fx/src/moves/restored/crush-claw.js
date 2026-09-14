import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function crushClaw(context) {
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
  const attachment = context.source.hasAnchor?.('claw') ? 'claw' : 'hand', base = socket(attachment), aim = Math.atan2(focus.y - base.y, focus.x - base.x), authoredLength = Math.min(106, Math.max(70, h * .38))
  const pose = fit(solveContact(attachment, .045, { x: focus.x - Math.cos(aim) * authoredLength, y: focus.y - Math.sin(aim) * authoredLength }))
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation), strikeRoot = { x: pose.x + base.x * c - base.y * s, y: pose.y + base.x * s + base.y * c }
  const length = Math.hypot(focus.x - strikeRoot.x, focus.y - strikeRoot.y), direction = Math.atan2(focus.y - strikeRoot.y, focus.x - strikeRoot.x) - pose.rotation
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const root = new Container(); root.label = 'crush-claw-root'; root.alpha = 0; root.attachmentSocket = attachment; temporary.addChild(root)
  const tip = new Graphics(); tip.label = 'crush-claw-tip'; tip.attachmentSocket = attachment; root.addChild(tip)
  const impact = new Graphics(); impact.label = 'crush-claw-impact'; impact.alpha = 0; temporary.addChild(impact)
  function rayRoom(p, angle) {
    const x = Math.cos(angle), y = Math.sin(angle), limits = []
    if (x > 1e-6) limits.push((right - p.x - 3) / x); if (x < -1e-6) limits.push((left - p.x + 3) / x)
    if (y > 1e-6) limits.push((bottom - p.y - 3) / y); if (y < -1e-6) limits.push((top - p.y + 3) / y)
    return Math.max(0, Math.min(...limits))
  }
  let contact
  const grip = { spread: .32, sweep: -.38 }
  const outer = [-1, 1].map(side => { const g = new Graphics(); g.label = 'crush-claw-hook-' + side; root.addChild(g); return { g, side } })
  const brace = new Graphics(); brace.label = 'crush-claw-brace'; root.addChild(brace)
  const chips = Array.from({ length: 15 }, (_, i) => { const g = new Graphics().poly([-3, 0, 0, -2, 4, 0, 0, 2]).fill(i % 2 ? 0xe9ddbd : 0xbbaa89); g.label = 'crush-claw-chip-' + i; g.alpha = 0; temporary.addChild(g); return { g, phase: random() * 6.28, distance: 25 + random() * 31, life: .43 + random() * .2 } })
  function update(time) {
    const fitted = fit(attacker); attacker.position.copyFrom(fitted); attacker.rotation = fitted.rotation
    const from = socket(attachment, true), angle = direction + attacker.rotation + grip.sweep, cs = Math.cos(angle), sn = Math.sin(angle), reach = Math.min(length, rayRoom(from, angle))
    root.position.copyFrom(from); root.alpha = time >= .12 && time < 1.53 ? Math.min(1, (time - .12) / .16, (1.53 - time) / .25) : 0
    const local = (u, v) => { const a = { x: from.x + cs * reach * u, y: from.y + sn * reach * u }, across = Math.sign(v) * Math.min(Math.abs(v * reach), room(a) * .81); return [cs * reach * u - sn * across, sn * reach * u + cs * across] }
    brace.clear(); const r = Math.min(16, room(from) * .7); brace.ellipse(0, 0, r, r * .73).fill(0x887857).stroke({ color: 0xc4b797, width: 1.6 })
    for (const { g, side } of [{ g: tip, side: 0 }, ...outer]) {
      const end = local(side ? .88 : 1, side * grip.spread), point = (u, v) => { const p = local(u, v); return [p[0] - end[0], p[1] - end[1]] }
      g.position.set(...end); g.clear(); const lane = side * grip.spread, arch = -.23 + side * .09
      // Broad bone claws hook downward as the outer talons close around the leading claw.
      g.moveTo(...point(.015, side * .07)).bezierCurveTo(...point(.19, lane + arch), ...point(.7, lane + arch * 1.15), ...point(side ? .88 : 1, lane))
        .quadraticCurveTo(...point(.66, lane - .015), ...point(.3, side * .06 + .085)).lineTo(...point(.015, side * .07)).fill(side ? 0xcfc5a6 : 0xf0e8cf)
      g.moveTo(...point(.07, side * .06)).quadraticCurveTo(...point(.48, lane + arch * .84), ...point(side ? .88 : 1, lane)).stroke({ color: 0xfff8df, width: side ? 2 : 2.8, cap: 'round' })
      g.moveTo(...point(.12, side * .075 + .025)).lineTo(...point(.32, lane + .055)).stroke({ color: 0x8d805f, width: 1.5, alpha: .7 })
    }
    const age = time - .86, u = clamp(age / .61); impact.clear(); impact.alpha = contact && age >= 0 && age < .61 ? 1 - u : 0
    if (contact) { impact.position.copyFrom(contact); impact.scale.set(Math.min(1, room(contact) / 64));
      for (let j = -1; j <= 1; j++) { const offset = j * (16 - u * 8), slide = u * 15; impact.moveTo(-19 + offset, -32 + slide).quadraticCurveTo(10 + offset, -3 + slide, -5 + offset, 28 + slide).stroke({ color: j ? 0xb8ab88 : 0xffedc4, width: j ? 4 : 6, alpha: .75, cap: 'round' }) }
      impact.ellipse(0, 0, 12 + u * 34, 8 + u * 25).stroke({ color: 0xdaceaa, width: 1.8, alpha: .6 }) }
    chips.forEach(p => { const u = clamp(age / p.life), distance = contact ? Math.min(p.distance, room(contact) * .65) : 0; p.g.alpha = contact && age >= 0 && age < p.life ? 1 - u : 0; if (contact) { const q = { x: contact.x + Math.cos(p.phase) * distance * u, y: contact.y + Math.sin(p.phase) * distance * u + distance * .2 * u * u }; p.g.position.copyFrom(q); p.g.rotation = p.phase + time * 3; p.g.scale.set(Math.min(1, room(q) / 6)) } })
  }
  onFrame(update)
  tl.to(attacker, { ...fit({ x: home.x - 10, y: home.y + 3, rotation: -.045 }), duration: .3 }, 0)
    .to(attacker, { ...pose, duration: .44, ease: 'power3.in' }, .4)
    .to(grip, { spread: .095, sweep: 0, duration: .23, ease: 'power3.in' }, .63)
    .call(() => { contact = targetSocket('center', true); update(.86); onCue({ type: 'impact' }); defender.tint = 0xe6d9ba }, [], .86)
    .to(defender, { x: defenderHome.x + recoil, duration: .075, repeat: 3, yoyo: true }, .86)
    .call(() => { defender.tint = 0xffffff }, [], 1.18)
    .to(grip, { spread: .22, sweep: .16, duration: .27 }, 1.12)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .53, ease: 'power2.inOut' }, 1.28)
    .to({}, { duration: 2.1 }, 0)
}
