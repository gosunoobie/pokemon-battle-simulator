import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function twister(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n)), room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
  const sourceCenter = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const halfW = context.target.metrics.width / (2 * unit), halfH = context.target.metrics.height / (2 * unit)
  const back = Math.max(0, Math.min(5, sourceCenter.x - context.source.metrics.width / (2 * unit) - left))
  const buffet = Math.max(0, Math.min(8, receiver.x - halfW - left, right - receiver.x - halfW)), lift = Math.max(0, Math.min(13, receiver.y - halfH - top))
  const radius = Math.min(70, Math.max(34, context.target.metrics.width / unit * .37)), height = Math.min(162, Math.max(108, context.target.metrics.height / unit * .94)), extent = Math.max(radius * 1.22 + 7, height * .55 + radius * .2 + 21)
  const motion = { strength: 0 }
  const seed = new Graphics(); seed.label = 'twister-gather'; seed.alpha = 0; temporary.addChild(seed)
  const funnel = new Container(); funnel.label = 'twister-tip'; funnel.alpha = 0; temporary.addChild(funnel)
  const veil = new Graphics(), wind = new Graphics(); veil.label = 'twister-funnel-veil'; wind.label = 'twister-helical-wind'; funnel.addChild(veil, wind)
  const impact = new Graphics(); impact.label = 'twister-impact'; impact.alpha = 0; temporary.addChild(impact)
  const debris = Array.from({ length: 25 }, (_, i) => {
    const g = new Graphics().poly([-3, -1, 0, -2, 4, 0, 1, 2, -2, 1]).fill(i % 4 ? 0xbcb4ce : 0xd7d3bf)
    g.label = 'twister-debris-' + i; funnel.addChild(g)
    return { g, phase: i / 25, turn: random() * 6.28, lane: .77 + random() * .18 }
  })
  let struck = false
  function update(time) {
    const age = time - .92
    defender.position.set(defenderHome.x + Math.sin(Math.max(0, age) * 17) * buffet * motion.strength, defenderHome.y - (.62 + Math.sin(Math.max(0, age) * 12) * .38) * lift * motion.strength)
    const a = socket('emission', true), b = targetSocket('center', true), u = clamp((time - .36) / .56), ease = u * u * (3 - 2 * u)
    const p = { x: a.x + (b.x - a.x) * ease, y: a.y + (b.y - a.y) * ease }
    p.y -= Math.sin(Math.PI * u) * Math.min(14, room(p) * .18)
    seed.position.copyFrom(a); seed.scale.set(Math.min(1, room(a) / 35)); seed.clear(); seed.alpha = time >= .03 && time < .5 ? clamp((time - .03) / .18) * (1 - clamp((time - .31) / .19)) * .84 : 0
    for (let j = 0; j < 3; j++) {
      const r = 10 + j * 7, phase = time * 11 + j * 1.7
      for (let k = 0; k <= 18; k++) { const q = phase + k * .19, x = Math.cos(q) * r, y = Math.sin(q) * r * .43 + (j - 1) * 4; if (!k) seed.moveTo(x, y); else seed.lineTo(x, y) }
      seed.stroke({ color: j === 1 ? 0xd9cfe9 : 0xafa3c2, width: 1.7, alpha: .7, cap: 'round' })
    }
    const grow = .36 + .64 * u, fade = 1 - clamp((time - 1.75) / .57)
    funnel.position.copyFrom(p); funnel.scale.set(Math.min(1, room(p) / extent)); funnel.alpha = time >= .36 ? fade : 0
    veil.clear(); wind.clear()
    const sway = Math.sin(time * 5.2) * radius * .045
    veil.moveTo(-radius * .11 * grow, height * .47 * grow)
      .bezierCurveTo(-radius * .35 * grow, height * .1 * grow, (-radius * .76 + sway) * grow, -height * .35 * grow, (-radius + sway) * grow, -height * .47 * grow)
      .quadraticCurveTo(sway * grow, -height * .58 * grow, (radius + sway) * grow, -height * .47 * grow)
      .bezierCurveTo((radius * .76 + sway) * grow, -height * .35 * grow, radius * .35 * grow, height * .1 * grow, radius * .11 * grow, height * .47 * grow)
      .closePath().fill({ color: 0x9483ae, alpha: .1 })
    for (let band = 0; band < 9; band++) {
      const v = band / 8, r = radius * (.13 + v * .87) * grow, y = (.47 - v * .96) * height * grow, phase = time * 12.5 - band * .66
      for (let part = 0; part < 2; part++) {
        for (let k = 0; k <= 25; k++) {
          const q = phase + part * Math.PI + k / 25 * Math.PI * .87, x = Math.cos(q) * r + sway * v * grow, yy = y + Math.sin(q) * r * .155
          if (!k) wind.moveTo(x, yy); else wind.lineTo(x, yy)
        }
        wind.stroke({ color: part ? 0xddd5e8 : band % 2 ? 0x92819f : 0xb3a5c8, width: part ? 2.15 : 1.4, alpha: part ? .77 : .5, cap: 'round' })
      }
    }
    // A traveling vertical thread links the rotating bands into one coherent funnel.
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k <= 52; k++) {
        const v = k / 52, r = radius * (.13 + v * .87) * grow, q = time * 12.5 - v * 5.28 + j * Math.PI, x = Math.cos(q) * r + sway * v * grow, y = (.47 - v * .96) * height * grow + Math.sin(q) * r * .155
        if (!k) wind.moveTo(x, y); else wind.lineTo(x, y)
      }
      wind.stroke({ color: j ? 0xb6a6ca : 0xe0d9ec, width: 1.2, alpha: .38, cap: 'round' })
    }
    debris.forEach(d => {
      const v = (d.phase + time * .66) % 1, q = time * 12.5 - v * 5.28 + d.turn, r = radius * (.13 + v * .87) * grow * d.lane, falling = Math.max(0, time - 1.78) ** 2 * 33
      d.g.position.set(Math.cos(q) * r + sway * v * grow, (.47 - v * .96) * height * grow + Math.sin(q) * r * .155 + falling)
      d.g.rotation = q + time * 2.6; d.g.alpha = .22 + Math.sin(Math.PI * v) * .61
    })
    impact.position.copyFrom(b); impact.scale.set(Math.min(1, room(b) / 65)); impact.clear(); impact.alpha = struck && age >= 0 && age < .66 ? (1 - age / .66) * .83 : 0
    for (let j = 0; j < 3; j++) {
      const r = 19 + j * 11 + clamp(age / .66) * 6, phase = time * 6 + j * 1.7
      for (let k = 0; k <= 22; k++) { const q = phase + k / 22 * Math.PI * 1.35, x = Math.cos(q) * r, y = Math.sin(q) * r * .63; if (!k) impact.moveTo(x, y); else impact.lineTo(x, y) }
      impact.stroke({ color: j === 1 ? 0xe0d7ed : 0xac99c7, width: j === 1 ? 2.2 : 1.4, alpha: .8, cap: 'round' })
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .2, ease: 'power1.inOut' }, 0)
    .to(attacker, { x: home.x, duration: .14, ease: 'power2.out' }, .2)
    .call(() => update(.36), [], .36)
    .call(() => { struck = true; update(.92); onCue({ type: 'impact' }); defender.tint = 0xd3c8df }, [], .92)
    .to(motion, { strength: 1, duration: .2, ease: 'power2.out' }, .94)
    .call(() => { defender.tint = 0xffffff }, [], 1.37)
    .to(motion, { strength: 0, duration: .48, ease: 'power2.inOut' }, 1.65)
    .to({}, { duration: 2.5 }, 0)
}
