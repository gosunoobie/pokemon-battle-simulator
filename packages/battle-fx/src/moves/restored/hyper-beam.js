import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function hyperBeam(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges)
  const top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const sourceHalf = context.source.metrics.width / (2 * unit), targetHalf = context.target.metrics.width / (2 * unit)
  const back = Math.max(0, Math.min(8, center.x - sourceHalf - left))
  const thrust = Math.max(0, Math.min(5, right - center.x - sourceHalf))
  const recoil = Math.max(0, Math.min(11, right - receiver.x - targetHalf))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const clamp = x => Math.max(0, Math.min(1, x))
  const show = (time, start, end, fade = .2) => time < start || time >= end ? 0 : Math.min(1, (time - start) / .06, (end - time) / fade)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / Math.max(1, extent))) }
  const charge = make('hyper-beam-charge'), beam = make('hyper-beam-stream')
  const tip = make('hyper-beam-tip'), crash = make('hyper-beam-impact')
  const r = Math.min(29, Math.max(22, context.source.metrics.height / unit * .14))
  const sparks = Array.from({ length: 28 }, (_, i) => ({
    g: make(`hyper-beam-spark-${i}`), angle: i * Math.PI / 14,
    reach: 35 + random() * 44, life: .45 + random() * .23,
  }))
  let impact

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true)
    const dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx)
    const nx = -Math.sin(angle), ny = Math.cos(angle)
    const at = p => ({ x: a.x + dx * p, y: a.y + dy * p })
    const energy = clamp((time - .08) / .73)
    // Amber rays collapse into a tight, hot core before the rigid column releases.
    charge.clear(); fit(charge, a, r * 2.8); charge.rotation = angle
    charge.alpha = show(time, .08, 2.02, .26)
    charge.circle(0, 0, r * (.34 + energy * .49)).fill({ color: 0xc45921, alpha: .15 })
      .circle(0, 0, r * (.19 + energy * .38)).fill(0xed922b)
      .circle(0, 0, r * (.1 + energy * .26)).fill(0xffdf83)
      .circle(0, 0, r * (.06 + energy * .15)).fill(0xffffec)
    for (let j = 0; j < 14; j++) {
      const phase = (time * 1.8 + j / 14) % 1, theta = j * Math.PI / 7 + time * .34
      const outer = r * (2.45 - phase * 1.87), inner = outer - r * (.12 + phase * .31), width = .016 + phase * .026
      charge.poly([
        Math.cos(theta - width) * outer, Math.sin(theta - width) * outer,
        Math.cos(theta) * inner, Math.sin(theta) * inner,
        Math.cos(theta + width) * outer, Math.sin(theta + width) * outer,
      ]).fill({ color: j % 3 ? 0xffdc86 : 0xf49a35, alpha: .42 + phase * .55 })
    }
    for (const side of [-1, 1]) {
      const compression = r * (1.4 - energy * .47)
      charge.moveTo(-r * .35, side * compression).lineTo(-r * .6, side * compression * .7)
        .lineTo(-r * .72, 0).lineTo(-r * .6, -side * compression * .7)
        .stroke({ color: 0xffedb7, width: 1.4, alpha: .65 })
    }
    const reach = clamp((time - .9) / .2) ** 1.4, tail = clamp((time - 1.76) / .22), head = at(reach)
    beam.clear(); beam.alpha = show(time, .9, 2.04, .12)
    if (reach > tail) {
      // Straight parallel faces distinguish the beam from flowing water or wind.
      for (const [width, color, alpha] of [[1.18, 0xb34d20, .24], [1, 0xd87124, 1], [.78, 0xffb744, 1], [.49, 0xffe796, 1], [.2, 0xffffed, 1]]) {
        const upper = [], lower = []
        for (let j = 0; j <= 40; j++) {
          const p = tail + (reach - tail) * j / 40, q = at(p)
          const w = Math.min(r * width * (.92 + .035 * Math.sin(time * 57)), room(q) * .83)
          upper.push(q.x + nx * w, q.y + ny * w); lower.unshift(q.x - nx * w, q.y - ny * w)
        }
        beam.poly([...upper, ...lower]).fill({ color, alpha })
      }
      // Hard-edged packets run down the outer rails; the white core remains solid.
      for (let j = 0; j < 20; j++) {
        const p = (j / 20 + time * 3.3) % 1, end = Math.min(reach, p + .034)
        if (p < tail || p >= reach) continue
        const q = at(p), z = at(end), side = j % 2 ? -1 : 1
        const w = Math.min(r * .75, room(q) * .65, room(z) * .65)
        beam.poly([
          q.x + nx * w * side, q.y + ny * w * side, z.x + nx * w * side, z.y + ny * w * side,
          z.x + nx * w * .74 * side, z.y + ny * w * .74 * side, q.x + nx * w * .9 * side, q.y + ny * w * .9 * side,
        ]).fill({ color: 0xfff4c1, alpha: .8 })
      }
    }
    tip.clear(); fit(tip, head, r * 1.35); tip.rotation = angle; tip.alpha = beam.alpha
    tip.poly([0, 0, -r * .13, -r, -r * .34, -r * .82, -r * .34, r * .82, -r * .13, r]).fill(0xffe08b)
      .poly([0, 0, -r * .12, -r * .64, -r * .21, 0, -r * .12, r * .64]).fill(0xffffed)
    const age = time - 1.1
    crash.clear(); fit(crash, b, r * 2.95); crash.rotation = angle; crash.alpha = show(time, 1.1, 2.21, .27)
    if (age >= 0) {
      const pulse = .92 + Math.sin(time * 43) * .1
      // An angular sustained crown sheds expanding broken facets at the receiver.
      crash.poly([
        r * 1.43 * pulse, 0, r * .35, r * .29, r * .53, r * 1.48 * pulse, -r * .03, r * .51,
        -r * .59, r * .93, -r * .36, r * .2, -r * .96, 0, -r * .36, -r * .2,
        -r * .59, -r * .93, -r * .03, -r * .51, r * .53, -r * 1.48 * pulse, r * .35, -r * .29,
      ]).fill({ color: 0xffbd55, alpha: .66 })
      crash.poly([r, 0, r * .13, r * .2, 0, r * .95, -r * .18, r * .17, -r * .5, 0,
        -r * .18, -r * .17, 0, -r * .95, r * .13, -r * .2]).fill(0xffffdc)
      for (let j = 0; j < 8; j++) {
        const theta = j * Math.PI / 4 + .16, phase = (age * 2.4 + j % 3 * .22) % 1, radius = r * (.8 + phase * 1.5)
        crash.moveTo(Math.cos(theta - .13) * radius * .87, Math.sin(theta - .13) * radius * .87)
          .lineTo(Math.cos(theta) * radius, Math.sin(theta) * radius)
          .lineTo(Math.cos(theta + .14) * radius * .83, Math.sin(theta + .14) * radius * .83)
          .stroke({ color: j % 2 ? 0xffdb7b : 0xf59b3c, width: 2, alpha: (1 - phase) * .9 })
      }
    }
    for (const spark of sparks) {
      const u = clamp(age / spark.life)
      spark.g.clear(); spark.g.alpha = impact && age >= 0 && age < spark.life ? 1 - u : 0
      if (!impact) continue
      const distance = Math.min(spark.reach, room(impact) / 1.5)
      const q = { x: impact.x + Math.cos(spark.angle) * distance * u, y: impact.y + Math.sin(spark.angle) * distance * u + distance * .3 * u * u }
      fit(spark.g, q, 8); spark.g.rotation = spark.angle + u * .2
      spark.g.poly([-6, 0, 0, -1.7, 7, 0, 0, 1.7]).fill(0xffe6a1)
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .42 }, 0)
    .to(attacker, { x: home.x + thrust, duration: .14, ease: 'power3.in' }, .73)
    .call(() => { update(.9) }, [], .9)
    .call(() => { impact = targetSocket('center', true); update(1.1); onCue({ type: 'impact' }); defender.tint = 0xffe6b7 }, [], 1.1)
    .to(defender, { x: defenderHome.x + recoil, duration: .065, repeat: 7, yoyo: true }, 1.1)
    .call(() => { defender.tint = 0xffffff }, [], 1.51)
    .to(attacker, { x: home.x, duration: .37, ease: 'power2.inOut' }, 2.06)
}
