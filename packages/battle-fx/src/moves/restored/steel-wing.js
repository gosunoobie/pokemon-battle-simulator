import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function steelWing(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  function fitPose(p) {
    let rotation = p.rotation ?? 0, c, s, rx, ry
    for (let i = 0; i < 14; i++) {
      c = Math.cos(rotation); s = Math.sin(rotation)
      rx = (w * Math.abs(c) + h * Math.abs(s)) / 2; ry = (h * Math.abs(c) + w * Math.abs(s)) / 2
      if (rx * 2 <= right - left && ry * 2 <= bottom - top) break
      rotation *= .5
    }
    const cx = p.x + center.x * c - center.y * s, cy = p.y + center.x * s + center.y * c
    return { x: p.x + Math.max(left + rx, Math.min(right - rx, cx)) - cx, y: p.y + Math.max(top + ry, Math.min(bottom - ry, cy)) - cy, rotation }
  }
  const attachment = context.source.hasAnchor?.('wing') ? 'wing' : 'hand'
  const hand = socket(attachment), aim = Math.atan2(focus.y - hand.y, focus.x - hand.x)
  const authoredLength = Math.min(124, Math.max(84, h * .53))
  const pose = fitPose(solveContact(attachment, .075, {
    x: focus.x - Math.cos(aim + .1) * authoredLength,
    y: focus.y - Math.sin(aim + .1) * authoredLength,
  }))
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation)
  const strikeRoot = { x: pose.x + hand.x * c - hand.y * s, y: pose.y + hand.x * s + hand.y * c }
  const length = Math.hypot(focus.x - strikeRoot.x, focus.y - strikeRoot.y)
  const strikeAngle = Math.atan2(focus.y - strikeRoot.y, focus.x - strikeRoot.x) - pose.rotation
  const swing = { angle: strikeAngle - .95 }
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const recoil = Math.max(0, Math.min(10, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const trail = new Graphics(); trail.label = 'steel-wing-sweep'; temporary.addChild(trail)
  const root = new Container(); root.label = 'steel-wing-root'; root.alpha = 0; temporary.addChild(root)
  const wing = new Graphics(); wing.label = 'steel-wing-tip'; wing.attachmentSocket = attachment; root.addChild(wing)
  const cut = new Graphics(); cut.label = 'steel-wing-impact'; cut.alpha = 0; temporary.addChild(cut)
  const sparks = Array.from({ length: 20 }, (_, i) => {
    const g = new Graphics(); g.label = `steel-wing-spark-${i}`; g.alpha = 0; temporary.addChild(g)
    return { g, angle: i * Math.PI / 10 + random() * .16, reach: 31 + random() * 39, life: .34 + random() * .2 }
  })
  let contact

  // Limit a physical feather's radial reach, keeping the real shoulder socket fixed.
  function rayRoom(p, angle) {
    const x = Math.cos(angle), y = Math.sin(angle), limits = []
    if (x > 1e-6) limits.push((right - p.x - 4) / x)
    if (x < -1e-6) limits.push((left - p.x + 4) / x)
    if (y > 1e-6) limits.push((bottom - p.y - 4) / y)
    if (y < -1e-6) limits.push((top - p.y + 4) / y)
    return Math.max(0, Math.min(...limits))
  }
  function update(time) {
    const fitted = fitPose(attacker); attacker.position.copyFrom(fitted); attacker.rotation = fitted.rotation
    const from = socket(attachment, true), angle = swing.angle + attacker.rotation
    const harden = clamp((time - .1) / .32), fold = clamp((time - 1.02) / .31)
    const reach = Math.min(length * (.6 + harden * .4) * (1 - fold * .35), rayRoom(from, angle))
    const cosine = Math.cos(angle), sine = Math.sin(angle)
    root.position.copyFrom(from); root.rotation = 0; root.wingAngle = angle
    root.alpha = time >= .1 && time < 1.38 ? Math.min(1, (time - .1) / .13, (1.38 - time) / .24) : 0
    wing.position.set(cosine * reach, sine * reach); wing.clear()
    // Every plate is expressed relative to the shoulder. Only the foremost tip is at zero.
    const point = (u, v) => {
      const axis = { x: from.x + cosine * reach * u, y: from.y + sine * reach * u }
      const spread = Math.sign(v) * Math.min(Math.abs(v * reach) * (.4 + harden * .6) * (1 - fold * .5), room(axis) * .85)
      return [cosine * reach * (u - 1) - sine * spread, sine * reach * (u - 1) + cosine * spread]
    }
    const polygon = points => points.flatMap(([u, v]) => point(u, v))
    wing.poly(polygon([[0, 0], [.16, -.14], [.47, -.26], [.76, -.19], [1, 0], [.83, .14], [.61, .35], [.25, .41], [.06, .19]]))
      .fill({ color: 0x314e60, alpha: .9 })
    // Overlapping primaries open as an articulated fan, with a dark bevel and two metal faces.
    for (let j = 0; j < 8; j++) {
      const t = j / 7, base = .08 + t * .51, end = .23 + t * .77
      const baseY = -.015 - t * .12, endY = .43 * (1 - t) ** .72
      wing.poly(polygon([[base, baseY], [base + .1, baseY - .075], [end, endY], [end - .085, endY + .025], [base + .005, baseY + .12]]))
        .fill(j % 2 ? 0x7797a8 : 0x8eaaba)
      wing.poly(polygon([[base + .02, baseY], [base + .1, baseY - .055], [end, endY], [end - .082, endY - .025]]))
        .fill(j % 2 ? 0xc5d9e2 : 0xe0edf2)
      const p = point(base + .1, baseY - .055), q = point(end, endY)
      wing.moveTo(...p).lineTo(...q).stroke({ color: 0xf6fcff, width: 1.3, alpha: .85 })
      const glint = (time * 2.05 - j * .09 + 10) % 1
      const gx = base + (end - base) * glint, gy = baseY + (endY - baseY) * glint
      wing.moveTo(...point(gx - .025, gy - .028)).lineTo(...point(gx + .045, gy + .022))
        .stroke({ color: 0xffffff, width: 1.9, alpha: Math.sin(glint * Math.PI) * .9 })
    }
    // A bent leading spar visibly links the metal fan back to the actor's wing/hand.
    wing.poly(polygon([[0, 0], [.17, -.16], [.48, -.27], [.77, -.17], [1, 0], [.71, -.1], [.44, -.16], [.17, -.065]]))
      .fill(0xabbfcb)
    wing.moveTo(...point(0, 0)).lineTo(...point(.17, -.16)).lineTo(...point(.48, -.27)).lineTo(...point(.77, -.17)).lineTo(...point(1, 0))
      .stroke({ color: 0xf1fbff, width: 2, alpha: .93 })
    wing.poly(polygon([[.1, -.01], [.18, -.1], [.31, -.14], [.24, .025]])).fill(0xe7f0f4)

    trail.clear(); trail.alpha = root.alpha * (time >= .43 && time < 1.1 ? Math.min(1, (time - .43) / .16, (1.1 - time) / .23) * .57 : 0)
    if (trail.alpha > 0) {
      const outer = [], inner = [], span = .91 * clamp((time - .43) / .25)
      for (let j = 0; j <= 32; j++) {
        const fraction = j / 32, theta = angle - span * (1 - fraction)
        const radius = Math.min(reach * (.92 + fraction * .075), rayRoom(from, theta))
        outer.push(from.x + Math.cos(theta) * radius, from.y + Math.sin(theta) * radius)
        const inside = radius * (1 - Math.sin(fraction * Math.PI) * .17)
        inner.unshift(from.x + Math.cos(theta) * inside, from.y + Math.sin(theta) * inside)
      }
      trail.poly([...outer, ...inner]).fill({ color: 0xd4e9f2, alpha: .54 })
    }
    const age = time - .76, u = clamp(age / .43)
    cut.clear(); cut.alpha = contact && age >= 0 && age < .43 ? 1 - u : 0
    if (contact) {
      cut.position.copyFrom(contact); cut.rotation = -.68
      const r = Math.min(63, room(contact) / 1.2) * (.65 + u * .35)
      cut.poly([-r, 0, -r * .12, -r * .055, 0, -r * .25, r * .09, -r * .06, r, 0,
        r * .09, r * .06, 0, r * .25, -r * .12, r * .055]).fill(0xf6fdff)
      cut.moveTo(-r * .72, r * .16).lineTo(r * .72, r * .16).stroke({ color: 0x94bccd, width: 1.5, alpha: .78 })
    }
    for (const spark of sparks) {
      const u = clamp(age / spark.life)
      spark.g.clear(); spark.g.alpha = contact && age >= 0 && age < spark.life ? 1 - u : 0
      if (!contact) continue
      const distance = Math.min(spark.reach, room(contact) * .67)
      const p = { x: contact.x + Math.cos(spark.angle) * distance * u, y: contact.y + Math.sin(spark.angle) * distance * u + distance * .25 * u * u }
      spark.g.position.copyFrom(p); spark.g.rotation = spark.angle
      spark.g.scale.set(Math.min(1, room(p) / 8))
      spark.g.poly([-5, 0, 0, -1.3, 7, 0, 0, 1.3]).fill(spark.angle < Math.PI ? 0xf8ffff : 0xa7cbdc)
    }
  }
  onFrame(update)
  tl.to(attacker, { ...fitPose({ x: home.x - 11, y: home.y + 3, rotation: -.065 }), duration: .26 }, 0)
    .to(attacker, { ...pose, duration: .34, ease: 'power3.in' }, .39)
    .to(swing, { angle: strikeAngle, duration: .35, ease: 'power2.in' }, .41)
    .call(() => { contact = targetSocket('center', true); update(.76); onCue({ type: 'impact' }); defender.tint = 0xd3e7f0 }, [], .76)
    .to(defender, { x: defenderHome.x + recoil, duration: .075, repeat: 1, yoyo: true }, .76)
    .to(swing, { angle: strikeAngle + .75, duration: .24, ease: 'power2.out' }, .8)
    .call(() => { defender.tint = 0xffffff }, [], .98)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .52, ease: 'power2.inOut' }, 1.1)
}
