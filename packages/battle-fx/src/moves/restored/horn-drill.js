import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function hornDrill(context) {
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
  const attachment = context.source.hasAnchor?.('horn') ? 'horn' : 'emission', base = socket(attachment)
  const aim = Math.atan2(focus.y - base.y, focus.x - base.x), authoredLength = Math.min(134, Math.max(91, h * .48))
  const pose = fitPose(solveContact(attachment, .065, { x: focus.x - Math.cos(aim) * authoredLength, y: focus.y - Math.sin(aim) * authoredLength }))
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation)
  const strikeRoot = { x: pose.x + base.x * c - base.y * s, y: pose.y + base.x * s + base.y * c }
  const length = Math.hypot(focus.x - strikeRoot.x, focus.y - strikeRoot.y)
  const direction = Math.atan2(focus.y - strikeRoot.y, focus.x - strikeRoot.x) - pose.rotation
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const recoil = Math.max(0, Math.min(12, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const root = new Container(); root.label = 'horn-drill-root'; root.alpha = 0; temporary.addChild(root)
  const horn = new Graphics(); horn.label = 'horn-drill-tip'; horn.attachmentSocket = attachment; root.addChild(horn)
  const wake = new Graphics(); wake.label = 'horn-drill-wake'; temporary.addChild(wake)
  const impact = new Graphics(); impact.label = 'horn-drill-impact'; impact.alpha = 0; temporary.addChild(impact)
  const chips = Array.from({ length: 26 }, (_, i) => {
    const g = new Graphics(); g.label = `horn-drill-chip-${i}`; g.alpha = 0; temporary.addChild(g)
    return { g, angle: i * Math.PI / 13 + random() * .13, reach: 35 + random() * 45, life: .38 + random() * .28, spin: (random() - .5) * 5 }
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
    const cosine = Math.cos(angle), sine = Math.sin(angle), charge = clamp((time - .12) / .42)
    const reach = Math.min(length * (.66 + charge * .34), rayRoom(from, angle))
    root.position.copyFrom(from); root.alpha = time >= .12 && time < 1.83 ? Math.min(1, (time - .12) / .18, (1.83 - time) / .28) : 0
    horn.position.set(cosine * reach, sine * reach); horn.clear()
    // The root stays fixed. Field-aligned vertices fit the entire tapered cone and its stroke.
    const point = (u, v) => {
      const axis = { x: from.x + cosine * reach * u, y: from.y + sine * reach * u }
      const across = Math.sign(v) * Math.min(Math.abs(v * reach), room(axis) * .84)
      return [cosine * reach * (u - 1) - sine * across, sine * reach * (u - 1) + cosine * across]
    }
    horn.moveTo(...point(0, -.235)).quadraticCurveTo(...point(.42, -.22), ...point(1, 0))
      .quadraticCurveTo(...point(.46, .16), ...point(0, .235)).closePath().fill(0xb69764)
      .moveTo(...point(0, -.235)).quadraticCurveTo(...point(.42, -.22), ...point(1, 0))
      .quadraticCurveTo(...point(.48, -.025), ...point(0, .025)).closePath().fill(0xeadfbc)
      .moveTo(...point(.04, -.168)).quadraticCurveTo(...point(.45, -.15), ...point(.94, -.006))
      .stroke({ color: 0xfffce6, width: 3, alpha: .94, cap: 'round' })
    // Spiral ridges revolve around the horn itself; the full actor remains upright.
    for (let strand = 0; strand < 3; strand++) {
      for (let j = 0; j <= 56; j++) {
        const u = j / 56, phase = u * Math.PI * 6 - time * (24 + charge * 23) + strand * Math.PI * 2 / 3
        const radius = .232 * (1 - u) ** .76, p = point(u, Math.sin(phase) * radius)
        j ? horn.lineTo(...p) : horn.moveTo(...p)
      }
      horn.stroke({ color: strand === 0 ? 0x8d6e45 : strand === 1 ? 0xcbb27e : 0xfff5d3, width: strand === 0 ? 3.5 : 1.8, alpha: strand === 0 ? .78 : .9, cap: 'round' })
    }
    // A broad bronze collar seats the drill visibly into the supplied horn/emission socket.
    for (let band = 0; band < 2; band++) {
      for (let j = 0; j <= 36; j++) {
        const theta = j * Math.PI / 18, p = point(.027 + band * .045 + Math.cos(theta) * .018, Math.sin(theta) * (.24 - band * .015))
        j ? horn.lineTo(...p) : horn.moveTo(...p)
      }
      horn.stroke({ color: band ? 0xf4e2ad : 0x9b7a45, width: band ? 2.1 : 3.4, alpha: .95 })
    }
    wake.clear(); wake.alpha = root.alpha * (time >= .58 && time < 1.37 ? Math.min(1, (time - .58) / .16, (1.37 - time) / .18) * .62 : 0)
    if (wake.alpha > 0) for (let lane = 0; lane < 3; lane++) {
      const points = []
      for (let j = 0; j <= 24; j++) {
        const u = j / 24, backwards = Math.min(66 * u, rayRoom(from, angle + Math.PI))
        const axis = { x: from.x - cosine * backwards, y: from.y - sine * backwards }
        const offset = Math.sin(time * 34 - u * 10 + lane * Math.PI * 2 / 3) * Math.min(reach * .15 * (1 - u * .7), room(axis) * .7)
        points.push([axis.x - sine * offset, axis.y + cosine * offset])
      }
      points.forEach((p, j) => j ? wake.lineTo(...p) : wake.moveTo(...p))
      wake.stroke({ color: lane === 1 ? 0xf7eac2 : 0xc5aa78, width: lane === 1 ? 2 : 1.2, alpha: .72, cap: 'round' })
    }
    const age = time - 1.04, u = clamp(age / .73)
    impact.clear(); impact.alpha = contact && age >= 0 && age < .73 ? 1 - u : 0
    if (contact) {
      impact.position.copyFrom(contact)
      const size = Math.min(74, room(contact) / 1.12)
      for (let band = 0; band < 3; band++) {
        const r = size * (.23 + u * .73) * (1 - band * .19)
        for (let j = 0; j <= 48; j++) {
          const theta = j * Math.PI / 24, x = Math.cos(theta) * r * .65, y = Math.sin(theta) * r
          const p = [Math.cos(angle) * x - Math.sin(angle) * y, Math.sin(angle) * x + Math.cos(angle) * y]
          j ? impact.lineTo(...p) : impact.moveTo(...p)
        }
        impact.stroke({ color: band === 1 ? 0xfaf1d3 : 0xbda16e, width: band ? 2 : 3.2, alpha: .85 })
      }
      const r = size * (.25 + .2 * Math.sin(u * Math.PI)) * (1 - u)
      impact.poly([-r, 0, -r * .16, -r * .18, 0, -r, r * .18, -r * .18, r, 0,
        r * .18, r * .18, 0, r, -r * .16, r * .18]).fill(0xfff8df)
    }
    for (const chip of chips) {
      const u = clamp(age / chip.life)
      chip.g.clear(); chip.g.alpha = contact && age >= 0 && age < chip.life ? 1 - u : 0
      if (!contact) continue
      const distance = Math.min(chip.reach, room(contact) * .65)
      const p = { x: contact.x + Math.cos(chip.angle) * distance * u, y: contact.y + Math.sin(chip.angle) * distance * u + distance * .29 * u * u }
      chip.g.position.copyFrom(p); chip.g.rotation = chip.angle + chip.spin * u; chip.g.scale.set(Math.min(1, room(p) / 9))
      chip.g.poly([-5, -2, 4, -3, 7, 1, -2, 3]).fill(chip.angle < Math.PI ? 0xf4e7bc : 0xb29360)
    }
  }
  onFrame(update)
  tl.to(attacker, { ...fitPose({ x: home.x - 15, y: home.y + 2, rotation: -.06 }), duration: .37, ease: 'power2.out' }, 0)
    .to(attacker, { ...pose, duration: .39, ease: 'power3.in' }, .65)
    .call(() => { contact = targetSocket('center', true); update(1.04); onCue({ type: 'impact' }); defender.tint = 0xf1e2ba }, [], 1.04)
    .to(defender, { x: defenderHome.x + recoil, duration: .062, repeat: 5, yoyo: true }, 1.04)
    .call(() => { defender.tint = 0xffffff }, [], 1.44)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .57, ease: 'power2.inOut' }, 1.47)
}
