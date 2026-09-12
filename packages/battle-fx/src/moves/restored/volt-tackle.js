import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function voltTackle(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const centerName = context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center', center = socket(centerName), w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  const fit = p => ({ x: Math.max(left + w / 2 - center.x, Math.min(right - w / 2 - center.x, p.x)), y: Math.max(top + h / 2 - center.y, Math.min(bottom - h / 2 - center.y, p.y)) })
  const clamp = n => Math.max(0, Math.min(1, n)), room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
  const pose = fit(solveContact('tackle', 0)), brace = fit({ x: home.x - 18, y: home.y + 5 }), tackle = socket('tackle'), point = { x: pose.x + tackle.x, y: pose.y + tackle.y }
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  // Preserve a complete source silhouette even when a wide user tackles a target at an edge.
  // Only receivers outside the fitted tackle's reach approach, by the minimum body-contact distance.
  const targetW = context.target.metrics.width / unit, targetH = context.target.metrics.height / unit, inset = Math.min(3, targetW / 4, targetH / 4)
  const catchX = Math.max(left + targetW / 2, Math.min(right - targetW / 2, Math.max(point.x - targetW / 2 + inset, Math.min(point.x + targetW / 2 - inset, receiver.x))))
  const catchY = Math.max(top + targetH / 2, Math.min(bottom - targetH / 2, Math.max(point.y - targetH / 2 + inset, Math.min(point.y + targetH / 2 - inset, receiver.y))))
  const targetShift = { x: catchX - receiver.x, y: catchY - receiver.y }, targetPose = { x: defenderHome.x + targetShift.x, y: defenderHome.y + targetShift.y }
  const recoil = Math.max(0, Math.min(17, right - catchX - targetW / 2))
  const shell = new Graphics(); shell.label = 'volt-tackle-mantle'; temporary.addChild(shell)
  const wake = new Graphics(); wake.label = 'volt-tackle-lightning-wake'; temporary.addChild(wake)
  const tip = new Graphics(); tip.label = 'volt-tackle-tip'; tip.contactSocket = 'tackle'; tip.contactAdjusted = Math.hypot(point.x - focus.x, point.y - focus.y) > .001; tip.targetOffset = { x: point.x - focus.x - targetShift.x, y: point.y - focus.y - targetShift.y }; tip.targetShift = targetShift; temporary.addChild(tip)
  const impact = new Graphics(); impact.label = 'volt-tackle-impact'; temporary.addChild(impact)
  const rebound = new Graphics(); rebound.label = 'volt-tackle-rebound'; temporary.addChild(rebound)
  const bolts = Array.from({ length: 12 }, (_, i) => ({ angle: i * Math.PI / 6 + random() * .12, size: .67 + random() * .3, phase: random() * 6.28 }))
  const motes = Array.from({ length: 24 }, (_, i) => {
    const g = new Graphics().poly([-3, -1, 0, -3, 1, 0, 4, 1, 0, 3, -1, 0]).fill(i % 3 ? 0xffd342 : 0xfff8c2)
    g.label = 'volt-tackle-mote'; g.alpha = 0; temporary.addChild(g)
    return { g, angle: i * Math.PI / 12, speed: .28 + random() * .17, at: random() * .22, reach: .65 + random() * .35 }
  })
  const sparks = Array.from({ length: 25 }, (_, i) => {
    const g = new Graphics().moveTo(-4, 1).lineTo(0, -2).lineTo(-1, 2).lineTo(4, -1).stroke({ color: i % 2 ? 0xffd234 : 0xffffc9, width: 2, cap: 'round' })
    g.label = 'volt-tackle-impact-spark'; g.alpha = 0; temporary.addChild(g)
    return { g, angle: i * Math.PI * 2 / 25 + random() * .1, reach: 42 + random() * 48, life: .36 + random() * .25 }
  })
  let contact
  function update(time) {
    const fitted = fit(attacker); attacker.position.copyFrom(fitted)
    const c = socket(centerName, true), front = socket('tackle', true), rx = Math.max(0, Math.min(w * .51, c.x - left - 6, right - c.x - 6)), ry = Math.max(0, Math.min(h * .51, c.y - top - 6, bottom - c.y - 6))
    const gather = clamp((time - .06) / .52), mantleFade = clamp((time - .06) / .19) * (1 - clamp((time - 1.12) / .37))
    shell.position.copyFrom(c); shell.clear(); shell.alpha = mantleFade
    shell.ellipse(0, 0, rx * .91, ry * .91).fill({ color: 0xffd629, alpha: .045 + gather * .025 })
    for (let j = 0; j < 3; j++) {
      const start = time * (j === 1 ? -3.1 : 3.8) + j * Math.PI * 2 / 3
      for (let k = 0; k <= 18; k++) { const a = start + k * .105, q = (k % 3 === 1 ? .98 : .83) * (.65 + gather * .35), x = Math.cos(a) * rx * q, y = Math.sin(a) * ry * q; if (!k) shell.moveTo(x, y); else shell.lineTo(x, y) }
      shell.stroke({ color: j === 1 ? 0xffffc4 : 0xf4c330, width: j === 1 ? 3 : 2.2, alpha: .8, cap: 'round', join: 'round' })
    }
    for (let j = 0; j < 3; j++) {
      const y = (j - 1) * ry * .38, flick = Math.sin(time * 39 + j * 2) * ry * .075
      shell.moveTo(-rx * .7, y).lineTo(-rx * .13, y - ry * .14 + flick).lineTo(-rx * .28, y + ry * .09).lineTo(rx * .7, y + flick).stroke({ color: 0xfff2a0, width: 1.5, alpha: gather * .7, cap: 'round' })
    }
    motes.forEach(p => { const u = (time - .08 - p.at) / p.speed, a = p.angle + clamp(u) * .6, d = (1 - clamp(u)) * p.reach; p.g.alpha = u >= 0 && u < 1 ? Math.sin(Math.PI * u) * .9 : 0; p.g.position.set(c.x + Math.cos(a) * rx * d, c.y + Math.sin(a) * ry * d); p.g.rotation = a })
    wake.clear(); wake.alpha = time >= .65 && time < 1.27 ? clamp((time - .65) / .11) * (1 - clamp((time - 1) / .27)) : 0
    const length = Math.max(0, Math.min(195, c.x - left - 6)), spread = Math.max(0, Math.min(ry * .68, room(c)))
    for (let j = 0; j < 5; j++) {
      const lane = (j - 2) / 2, y = c.y + lane * spread
      wake.moveTo(c.x - rx * .2, y)
      for (let k = 1; k <= 8; k++) { const u = k / 8, zig = (k % 2 ? 1 : -1) * spread * .12 * Math.sin(time * 38 + j * 1.6), x = c.x - length * u; wake.lineTo(x, c.y + lane * spread * (1 - u * .36) + zig * Math.sin(u * Math.PI)) }
      wake.stroke({ color: j % 2 ? 0xf0bd25 : 0xfff7b9, width: j === 2 ? 3.1 : 1.8, alpha: j === 2 ? .95 : .7, cap: 'round', join: 'round' })
    }
    tip.position.copyFrom(front); tip.clear(); tip.alpha = time >= .57 && time < 1.2 ? clamp((time - .57) / .16) * (1 - clamp((time - 1.01) / .19)) : 0
    const r = Math.min(36, room(front)); tip.poly([0, 0, -r * .5, -r * .62, -r * .45, -r * .22, -r, -r * .04, -r * .54, r * .11, -r * .65, r * .64]).fill({ color: 0xffffc4, alpha: .88 })
      .moveTo(-r * .8, -r * .75).lineTo(-r * .28, -r * .32).lineTo(0, 0).lineTo(-r * .26, r * .3).lineTo(-r * .79, r * .7).stroke({ color: 0xffd72f, width: 3, cap: 'round', join: 'round' })
    const age = time - .98, u = clamp(age / .61); impact.clear(); impact.alpha = contact && age >= 0 && age < .61 ? (1 - u) ** .7 : 0
    if (contact) {
      impact.position.copyFrom(contact); const radius = Math.min(83, room(contact)) * (.58 + u * .42)
      impact.circle(0, 0, radius * .18 * (1 - u * .5)).fill(0xffffd9)
      impact.ellipse(0, 0, radius * (.2 + u * .48), radius * (.35 + u * .52)).stroke({ color: 0xffe67c, width: 2.8 - u, alpha: .8 })
      bolts.forEach(p => {
        const x = Math.cos(p.angle), y = Math.sin(p.angle), d = radius * p.size, bend = Math.sin(time * 35 + p.phase) * d * .12
        impact.moveTo(0, 0).lineTo(x * d * .4 - y * bend, y * d * .4 + x * bend).lineTo(x * d * .37 + y * d * .13, y * d * .37 - x * d * .13).lineTo(x * d, y * d).stroke({ color: 0xffe85f, width: 2.8 - u, cap: 'round', join: 'round' })
          .moveTo(x * d * .4 - y * bend, y * d * .4 + x * bend).lineTo(x * d * .68 - y * d * .21, y * d * .68 + x * d * .21).stroke({ color: 0xffffd0, width: 1.2, cap: 'round' })
      })
    }
    sparks.forEach(p => { const u = age / p.life, d = contact ? Math.max(0, Math.min(p.reach, room(contact) - 6)) : 0; p.g.alpha = contact && u >= 0 && u < 1 ? (1 - u) ** .65 : 0; if (contact) { const s = clamp(u) ** .65; p.g.position.set(contact.x + Math.cos(p.angle) * d * s, contact.y + Math.sin(p.angle) * d * s); p.g.rotation = p.angle + time * 3 } })
    rebound.clear(); rebound.position.copyFrom(c); const bounce = (time - 1.1) / .49; rebound.alpha = bounce >= 0 && bounce < 1 ? Math.sin(bounce * Math.PI) * .75 : 0
    for (let j = 0; j < 3; j++) { const a = time * 8 + j * Math.PI * 2 / 3, x = Math.cos(a) * rx * .6, y = Math.sin(a) * ry * .6; rebound.moveTo(x - rx * .08, y).lineTo(x, y - ry * .1).lineTo(x - rx * .015, y + ry * .06).lineTo(x + rx * .095, y - ry * .025).stroke({ color: 0xecc14a, width: 1.7, cap: 'round' }) }
  }
  onFrame(update)
  tl.to(attacker, { ...brace, duration: .39, ease: 'power2.out' }, 0)
    .to(attacker, { ...pose, duration: .34, ease: 'power4.in' }, .64)
    .to(defender, { ...targetPose, duration: .28, ease: 'power2.inOut' }, .7)
    .call(() => { contact = socket('tackle', true); update(.98); onCue({ type: 'impact' }); defender.tint = 0xffe893 }, [], .98)
    .to(defender, { x: targetPose.x + recoil, duration: .07, ease: 'power2.out' }, .98)
    .to(defender, { x: targetPose.x, duration: .23, ease: 'power2.inOut' }, 1.13)
    .to(defender, { x: defenderHome.x, y: defenderHome.y, duration: .39, ease: 'power2.inOut' }, 1.4)
    .call(() => { defender.tint = 0xffffff }, [], 1.37)
    .to(attacker, { ...fit({ x: pose.x - Math.min(57, Math.abs(pose.x - home.x) * .24), y: pose.y - 19 }), duration: .25, ease: 'power2.out' }, 1.06)
    .to(attacker, { x: home.x, y: home.y, duration: .6, ease: 'power2.inOut' }, 1.43)
    .to({}, { duration: 2.45 }, 0)
}
