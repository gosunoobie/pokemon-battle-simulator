import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function guillotine(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
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
  const attachment = context.source.hasAnchor?.('claw') ? 'claw' : 'hand', base = socket(attachment)
  const aim = Math.atan2(focus.y - base.y, focus.x - base.x), authoredLength = Math.min(136, Math.max(96, h * .5))
  const pose = fitPose(solveContact(attachment, .08, { x: focus.x - Math.cos(aim) * authoredLength, y: focus.y - Math.sin(aim) * authoredLength }))
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation)
  const strikeRoot = { x: pose.x + base.x * c - base.y * s, y: pose.y + base.x * s + base.y * c }
  const length = Math.hypot(focus.x - strikeRoot.x, focus.y - strikeRoot.y)
  const direction = Math.atan2(focus.y - strikeRoot.y, focus.x - strikeRoot.x) - pose.rotation
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const recoil = Math.max(0, Math.min(9, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const jaws = { opening: .14 }
  const root = new Container(); root.label = 'guillotine-root'; root.alpha = 0; temporary.addChild(root)
  const hinge = new Graphics(); hinge.label = 'guillotine-hinge'; root.addChild(hinge)
  const pincers = [-1, 1].map((side, i) => {
    const g = new Graphics(); g.label = i ? 'guillotine-tip-lower' : 'guillotine-tip'; g.attachmentSocket = attachment; root.addChild(g)
    return { g, side }
  })
  const sweeps = new Graphics(); sweeps.label = 'guillotine-sweep'; temporary.addChild(sweeps)
  const impact = new Graphics(); impact.label = 'guillotine-impact'; impact.alpha = 0; temporary.addChild(impact)
  const sparks = Array.from({ length: 22 }, (_, i) => {
    const g = new Graphics(); g.label = `guillotine-spark-${i}`; g.alpha = 0; temporary.addChild(g)
    return { g, angle: i * Math.PI / 11 + random() * .13, reach: 30 + random() * 42, life: .32 + random() * .26 }
  })
  let contact
  function rayRoom(p, angle) {
    const x = Math.cos(angle), y = Math.sin(angle), limits = []
    if (x > 1e-6) limits.push((right - p.x - 5) / x)
    if (x < -1e-6) limits.push((left - p.x + 5) / x)
    if (y > 1e-6) limits.push((bottom - p.y - 5) / y)
    if (y < -1e-6) limits.push((top - p.y + 5) / y)
    return Math.max(0, Math.min(...limits))
  }
  function update(time) {
    const fitted = fitPose(attacker); attacker.position.copyFrom(fitted); attacker.rotation = fitted.rotation
    const from = socket(attachment, true), angle = direction + attacker.rotation
    const cosine = Math.cos(angle), sine = Math.sin(angle), growth = clamp((time - .12) / .28)
    const reach = Math.min(length * (.73 + growth * .27), rayRoom(from, angle)), opening = jaws.opening
    root.position.copyFrom(from); root.alpha = time >= .12 && time < 1.69 ? Math.min(1, (time - .12) / .16, (1.69 - time) / .29) : 0
    // This mapping keeps complete jaw contours inside the field while their bases remain attached.
    const local = (u, v) => {
      const axis = { x: from.x + cosine * reach * u, y: from.y + sine * reach * u }
      const across = Math.sign(v) * Math.min(Math.abs(v * reach), room(axis) * .83)
      return [cosine * reach * u - sine * across, sine * reach * u + cosine * across]
    }
    hinge.clear()
    const hingeRadius = Math.min(reach * .125, room(from) * .78)
    hinge.circle(0, 0, hingeRadius).fill(0x516a60).circle(0, 0, hingeRadius * .72).fill(0xaebca2)
      .circle(0, 0, hingeRadius * .3).fill(0xeaf0ce)
    for (const { g, side } of pincers) {
      const tip = local(1, opening * side)
      g.position.set(...tip); g.clear()
      const point = (u, v) => { const p = local(u, v * side); return [p[0] - tip[0], p[1] - tip[1]] }
      const outer = .33 + opening * .5
      // Deep curved mandibles have a dark shell, broad hard face, and a bright inner cutting edge.
      g.moveTo(...point(0, 0)).quadraticCurveTo(...point(.18, outer * .78), ...point(.47, outer))
        .quadraticCurveTo(...point(.83, outer * 1.06), ...point(1, opening))
        .quadraticCurveTo(...point(.75, opening + .11), ...point(.51, outer * .48))
        .quadraticCurveTo(...point(.25, outer * .32), ...point(0, 0)).closePath().fill(0x405a50)
      g.moveTo(...point(.055, .016)).quadraticCurveTo(...point(.21, outer * .63), ...point(.49, outer * .84))
        .quadraticCurveTo(...point(.80, outer * .92), ...point(1, opening))
        .quadraticCurveTo(...point(.75, opening + .11), ...point(.51, outer * .48))
        .quadraticCurveTo(...point(.25, outer * .32), ...point(.055, .016)).closePath().fill(side < 0 ? 0xc6d4bc : 0x9eb6a0)
      g.moveTo(...point(.085, .038)).quadraticCurveTo(...point(.28, outer * .5), ...point(.52, outer * .62))
        .quadraticCurveTo(...point(.79, outer * .66), ...point(1, opening))
        .stroke({ color: 0xf6ffe5, width: 2.4, alpha: .98, cap: 'round' })
      for (let j = 0; j < 3; j++) {
        const u = .43 + j * .135, v = outer * (.44 + j * .025)
        g.poly([...point(u, v), ...point(u + .105, v - .055), ...point(u + .065, v + .036)]).fill(0xe7efd1)
      }
      const glint = (time * 1.6 + (side > 0 ? .32 : 0)) % 1, u = .15 + glint * .72
      const v = Math.sin(glint * Math.PI) * outer * .66 + .025
      g.moveTo(...point(u - .035, v - .037)).lineTo(...point(u + .035, v + .062))
        .stroke({ color: 0xffffff, width: 2.5, alpha: Math.sin(glint * Math.PI) * .92 })
    }
    sweeps.clear(); sweeps.alpha = root.alpha * (time >= .78 && time < 1.08 ? Math.min(1, (time - .78) / .09, (1.08 - time) / .14) * .58 : 0)
    if (sweeps.alpha > 0) for (const side of [-1, 1]) {
      const upper = [], lower = []
      for (let j = 0; j <= 20; j++) {
        const u = j / 20, x = .48 + u * .52, y = side * (opening + .24 * Math.sin(u * Math.PI))
        const p = local(x, y), q = local(x, y + side * .035 * Math.sin(u * Math.PI))
        upper.push(from.x + p[0], from.y + p[1]); lower.unshift(from.x + q[0], from.y + q[1])
      }
      sweeps.poly([...upper, ...lower]).fill(0xe8f7df)
    }
    const age = time - .94, u = clamp(age / .56)
    impact.clear(); impact.alpha = contact && age >= 0 && age < .56 ? 1 - u : 0
    if (contact) {
      impact.position.copyFrom(contact)
      const radius = Math.min(66, room(contact) / 1.12) * (.7 + u * .25)
      const points = [-radius, 0, -radius * .1, -radius * .06, 0, -radius * .53, radius * .1, -radius * .06,
        radius, 0, radius * .1, radius * .06, 0, radius * .53, -radius * .1, radius * .06]
      impact.poly(points).fill(0xf9ffe6)
      for (const side of [-1, 1]) {
        impact.moveTo(-radius * .57, side * radius * (.21 + u * .14))
          .lineTo(radius * .57, side * radius * (.21 + u * .14))
          .stroke({ color: 0x9eb9a5, width: 1.5, alpha: .84 })
      }
    }
    for (const spark of sparks) {
      const u = clamp(age / spark.life)
      spark.g.clear(); spark.g.alpha = contact && age >= 0 && age < spark.life ? 1 - u : 0
      if (!contact) continue
      const distance = Math.min(spark.reach, room(contact) * .67)
      const p = { x: contact.x + Math.cos(spark.angle) * distance * u, y: contact.y + Math.sin(spark.angle) * distance * u + distance * .22 * u * u }
      spark.g.position.copyFrom(p); spark.g.rotation = spark.angle; spark.g.scale.set(Math.min(1, room(p) / 9))
      spark.g.poly([-6, 0, 0, -1.2, 7, 0, 0, 1.2]).fill(spark.angle < Math.PI ? 0xf5ffdb : 0xb6cdb9)
    }
  }
  onFrame(update)
  tl.to(attacker, { ...fitPose({ x: home.x - 11, y: home.y + 2, rotation: -.07 }), duration: .29, ease: 'power2.out' }, 0)
    .to(jaws, { opening: .36, duration: .34, ease: 'power2.out' }, .16)
    .to(attacker, { ...pose, duration: .44, ease: 'power3.in' }, .48)
    .to(jaws, { opening: 0, duration: .13, ease: 'power4.in' }, .81)
    .call(() => { contact = targetSocket('center', true); update(.94); onCue({ type: 'impact' }); defender.tint = 0xe3ebd5 }, [], .94)
    .to(defender, { x: defenderHome.x + recoil, duration: .063, repeat: 3, yoyo: true }, .94)
    .call(() => { defender.tint = 0xffffff }, [], 1.22)
    .to(jaws, { opening: .2, duration: .26, ease: 'power2.out' }, 1.13)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .57, ease: 'power2.inOut' }, 1.33)
}
