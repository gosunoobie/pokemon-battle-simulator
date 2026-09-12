import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function aeroblast(context) {
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
  const lens = make('aeroblast-charge'), wind = make('aeroblast-stream')
  const tip = make('aeroblast-tip'), cut = make('aeroblast-impact')
  const r = Math.min(30, Math.max(22, context.source.metrics.height / unit * .14))
  const crescents = Array.from({ length: 12 }, (_, i) => ({ g: make(`aeroblast-crescent-${i}`), start: .54 + i * .081 }))
  const feathers = Array.from({ length: 22 }, (_, i) => ({
    g: make(`aeroblast-fragment-${i}`), angle: i * Math.PI / 11,
    reach: 31 + random() * 40, spin: (i % 2 ? 1 : -1) * (1.4 + random()), life: .5 + random() * .2,
  }))
  let impact

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true)
    const dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx)
    const nx = -Math.sin(angle), ny = Math.cos(angle)
    const at = p => ({ x: a.x + dx * p, y: a.y + dy * p })
    const reach = clamp((time - .54) / .29), head = at(reach)
    // A hollow intake turns around the firing axis, with no solid energy ball.
    lens.clear(); fit(lens, a, r * 2.15); lens.rotation = angle; lens.alpha = show(time, .12, 1.86, .24)
    for (let j = 0; j < 5; j++) {
      const phase = (time * 2.7 + j / 5) % 1, radius = r * (1.72 - phase * .88)
      for (let k = 0; k <= 22; k++) {
        const theta = time * 6 + j * Math.PI * .4 + k * .078
        const x = Math.cos(theta) * radius * .4 - phase * r * .18, y = Math.sin(theta) * radius
        k ? lens.lineTo(x, y) : lens.moveTo(x, y)
      }
      lens.stroke({ color: j % 2 ? 0xa6d8ca : 0xf1fff5, width: 1.5 + phase * 1.5, alpha: .5 + phase * .45 })
    }
    wind.clear(); wind.alpha = show(time, .54, 1.9, .28)
    // Winding tapered ribbons surround clear air. Front/back faces have different weights.
    if (reach > 0) for (let lane = 0; lane < 4; lane++) {
      const upper = [], lower = []
      for (let j = 0; j <= 72; j++) {
        const p = reach * j / 72, q = at(p), phase = p * 20 - time * 25 + lane * Math.PI / 2
        const available = room(q) * .82, radius = Math.min(r * (.4 + p * .76), available)
        const offset = Math.sin(phase) * radius
        const thickness = Math.min((lane % 2 ? 1.2 : 2.3) * (.25 + Math.sin(Math.PI * j / 72) * .75), Math.max(0, available - Math.abs(offset)))
        upper.push(q.x + nx * (offset + thickness), q.y + ny * (offset + thickness))
        lower.unshift(q.x + nx * (offset - thickness), q.y + ny * (offset - thickness))
      }
      wind.poly([...upper, ...lower]).fill({ color: lane % 2 ? 0x9ecdc4 : 0xedfff5, alpha: lane % 2 ? .43 : .9 })
    }
    // Thin slipstreams outline the widening air column without filling its center.
    if (reach > 0) for (const side of [-1, 1]) {
      const upper = [], lower = []
      for (let j = 0; j <= 36; j++) {
        const p = reach * j / 36, q = at(p), available = room(q) * .83
        const offset = Math.min(r * (.39 + p * .77), available * .94) * side, thickness = Math.min(1.1, available * .03)
        upper.push(q.x + nx * (offset + thickness), q.y + ny * (offset + thickness))
        lower.unshift(q.x + nx * (offset - thickness), q.y + ny * (offset - thickness))
      }
      wind.poly([...upper, ...lower]).fill({ color: 0xd8f7e9, alpha: .32 })
    }
    tip.clear(); fit(tip, head, r * 1.65); tip.rotation = angle; tip.alpha = wind.alpha
    const frontRadius = r * (.6 + reach * .64)
    tip.moveTo(-frontRadius * .33, -frontRadius).quadraticCurveTo(frontRadius * .33, 0, -frontRadius * .33, frontRadius)
      .quadraticCurveTo(-frontRadius * .04, 0, -frontRadius * .33, -frontRadius).fill({ color: 0xf2fff7, alpha: .94 })
    for (const crescent of crescents) {
      const age = time - crescent.start, u = clamp(age / .29), p = at(u), radius = r * (.42 + .82 * u)
      crescent.g.clear(); fit(crescent.g, p, r * 1.65); crescent.g.rotation = angle
      crescent.g.alpha = age >= 0 && age < .36 ? Math.min(1, age / .035, (.36 - age) / .1) : 0
      crescent.g.moveTo(-radius * .44, -radius).quadraticCurveTo(radius * .44, 0, -radius * .44, radius)
        .quadraticCurveTo(-radius * .06, 0, -radius * .44, -radius).fill({ color: 0xddfff0, alpha: .8 })
      crescent.g.moveTo(-radius * .54, -radius * .88).quadraticCurveTo(-radius * .25, 0, -radius * .54, radius * .88)
        .stroke({ color: 0xa8d8cb, width: 1.2, alpha: .63 })
    }
    const age = time - .83
    cut.clear(); fit(cut, b, r * 2.95); cut.rotation = angle; cut.alpha = show(time, .83, 1.99, .28)
    if (impact && age >= 0) {
      // Fresh pressure arcs keep peeling from the receiver throughout the stream.
      for (let j = 0; j < 6; j++) {
        const phase = (age * 2.4 + j / 6) % 1, radius = r * (.55 + phase * 1.84), theta = time * 3.8 + j * Math.PI / 3
        for (let k = 0; k <= 18; k++) {
          const t = theta + k * .071, x = Math.cos(t) * radius * .61, y = Math.sin(t) * radius
          k ? cut.lineTo(x, y) : cut.moveTo(x, y)
        }
        cut.stroke({ color: j % 2 ? 0xb4dfd1 : 0xf0fff5, width: 1 + (1 - phase) * 3, alpha: (1 - phase) * .9 })
      }
    }
    for (const feather of feathers) {
      const u = clamp(age / feather.life)
      feather.g.clear(); feather.g.alpha = impact && age >= 0 && age < feather.life ? 1 - u : 0
      if (!impact) continue
      const distance = Math.min(feather.reach, room(impact) / 1.5), theta = feather.angle + u * .45
      const p = { x: impact.x + Math.cos(theta) * distance * u, y: impact.y + Math.sin(theta) * distance * u + distance * .22 * u * u }
      fit(feather.g, p, 11); feather.g.rotation = feather.angle + feather.spin * u
      feather.g.moveTo(-8, 0).quadraticCurveTo(1, -5, 8, 0).quadraticCurveTo(0, -1, -8, 0).fill(0xd7f4e9)
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back * .7, duration: .25 }, 0)
    .to(attacker, { x: home.x + thrust, duration: .16 }, .35)
    .call(() => { update(.54) }, [], .54)
    .call(() => { impact = targetSocket('center', true); update(.83); onCue({ type: 'impact' }) }, [], .83)
    .to(defender, { x: defenderHome.x + recoil * .75, duration: .065, repeat: 5, yoyo: true }, .83)
    .to(attacker, { x: home.x, duration: .25 }, 1.91)
}
