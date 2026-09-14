import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function nightmare(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const ends = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...ends), right = Math.max(...ends), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const fit = (g, p, radius) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / radius)) }
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const attachment = context.source.hasAnchor?.('eyes') ? 'eyes' : 'emission'
  const root = make('nightmare-root'), trail = make('nightmare-dream-trail')
  const spirits = Array.from({ length: 3 }, (_, i) => ({ g: make(i ? `nightmare-wisp-${i}` : 'nightmare-tip'), phase: i * 2.1, start: .46 + i * .052 }))
  const impact = make('nightmare-impact'), curls = make('nightmare-curls'), eyes = make('nightmare-crescent-eyes')
  const motes = Array.from({ length: 15 }, (_, i) => ({ g: make(`nightmare-mote-${i}`), phase: i * Math.PI * 2 / 15 }))
  let arrived = false

  function update(time) {
    const a = socket(attachment, true), b = targetSocket('center', true), dx = b.x - a.x, dy = b.y - a.y, length = Math.max(1, Math.hypot(dx, dy))
    const nx = -dy / length, ny = dx / length
    const route = (u, phase = 0) => {
      const p = { x: a.x + dx * u, y: a.y + dy * u }
      const bend = Math.sin(Math.PI * u) * Math.sin(u * Math.PI * 2 + phase - time * 2.8) * Math.min(39, length * .13, room(p) * .65)
      return { x: p.x + nx * bend, y: p.y + ny * bend }
    }
    root.clear(); fit(root, a, 31)
    root.alpha = time >= .04 && time < .72 ? Math.min(1, (time - .04) / .18, (.72 - time) / .2) : 0
    const pulse = .82 + Math.sin(time * 8) * .1
    for (const side of [-1, 1]) {
      const x = side * 11
      root.moveTo(x - 8, -4).quadraticCurveTo(x, -12 * pulse, x + 8, -4)
        .quadraticCurveTo(x, -7 * pulse, x - 8, -4).fill({ color: 0xd8c5ff, alpha: .92 })
    }
    root.arc(0, 0, 25, time * 2, time * 2 + 2.1).stroke({ color: 0x8377c7, width: 1.5, alpha: .55 })
    trail.clear(); trail.alpha = time >= .46 && time < 1.24 ? Math.min(1, (time - .46) / .1, (1.24 - time) / .22) : 0
    for (let lane = 0; lane < 3; lane++) {
      const front = clamp((time - .46 - lane * .052) / (.56 - lane * .052))
      for (let j = 0; j <= 30; j++) {
        const u = Math.max(0, front - .36 + j * .012), p = route(Math.min(front, u), lane * 2.1)
        j ? trail.lineTo(p.x, p.y) : trail.moveTo(p.x, p.y)
      }
      trail.stroke({ color: lane % 2 ? 0xb5a1e5 : 0x7263aa, width: lane ? 2 : 3.5, alpha: lane ? .4 : .48, cap: 'round' })
    }
    for (const spirit of spirits) {
      const u = clamp((time - spirit.start) / (1.02 - spirit.start)), p = route(u, spirit.phase)
      const next = route(Math.min(1, u + .003), spirit.phase), prev = route(Math.max(0, u - .003), spirit.phase)
      const g = spirit.g; g.clear(); fit(g, p, 50); g.rotation = Math.atan2(next.y - prev.y, next.x - prev.x)
      g.alpha = time >= spirit.start && time < 1.18 ? Math.min(1, (time - spirit.start) / .07, (1.18 - time) / .16) : 0
      // Local zero is the pointed leading face; the three curled tails remain behind it.
      g.moveTo(0, 0).bezierCurveTo(-8, -15, -26, -12, -29, -1)
        .quadraticCurveTo(-35, 7, -45, 1).quadraticCurveTo(-39, 15, -25, 8)
        .quadraticCurveTo(-29, 20, -14, 13).quadraticCurveTo(-15, 5, 0, 0)
        .fill({ color: 0x594878, alpha: .56 })
        .moveTo(0, 0).quadraticCurveTo(-12, -12, -23, -3).quadraticCurveTo(-31, 5, -37, 2)
        .quadraticCurveTo(-27, 11, -17, 3).quadraticCurveTo(-8, 7, 0, 0).fill({ color: 0xaaa0d9, alpha: .7 })
        .moveTo(-5, -2).quadraticCurveTo(-10, -6, -14, -2).quadraticCurveTo(-9, -3, -5, -2).fill(0xf0d4ef)
      g.circle(0, 0, 1.25).fill(0xf9e8ff)
    }
    const age = time - 1.02, fade = arrived && age >= 0 ? clamp(age / .15) * (1 - clamp((time - 1.91) / .51)) : 0
    const rx = Math.min(91, Math.max(38, context.target.metrics.width / unit * .59)), ry = Math.min(99, Math.max(46, context.target.metrics.height / unit * .58))
    const auraFit = Math.max(0, Math.min(1, (b.x - left - 5) / (rx + 6), (right - b.x - 5) / (rx + 6), (b.y - top - 5) / (ry + 6), (bottom - b.y - 5) / (ry + 6)))
    curls.clear(); curls.position.copyFrom(b); curls.scale.set(auraFit); curls.alpha = fade * .8
    for (let lane = 0; lane < 4; lane++) {
      for (let j = 0; j <= 40; j++) {
        const u = j / 40, theta = lane * Math.PI / 2 + time * (lane % 2 ? -.7 : .7) + u * Math.PI * 1.65, r = .45 + .43 * u
        const x = Math.cos(theta) * rx * r, y = Math.sin(theta) * ry * r
        j ? curls.lineTo(x, y) : curls.moveTo(x, y)
      }
      curls.stroke({ color: lane % 2 ? 0xb29ad8 : 0x655583, width: lane % 2 ? 1.9 : 4, alpha: lane % 2 ? .62 : .38, cap: 'round' })
    }
    eyes.clear(); eyes.position.copyFrom(b); eyes.scale.set(auraFit); eyes.alpha = fade
    for (const side of [-1, 1]) {
      const x = side * rx * .24, y = -ry * .65 + Math.sin(time * 2.2) * 3
      eyes.moveTo(x - 12, y - 3).quadraticCurveTo(x, y + 8, x + 12, y - 3)
        .quadraticCurveTo(x, y + 3, x - 12, y - 3).fill({ color: 0xe4bbec, alpha: .86 })
    }
    impact.clear(); fit(impact, b, 58); impact.alpha = arrived && age >= 0 && age < .4 ? 1 - age / .4 : 0
    for (let j = 0; j < 3; j++) {
      const angle = j * Math.PI * 2 / 3 + age, radius = 12 + clamp(age / .4) * 31
      impact.arc(0, 0, radius, angle, angle + 1.25).stroke({ color: 0xdcc3f0, width: 2.2, alpha: .75 })
    }
    for (const mote of motes) {
      const theta = mote.phase + age * 1.7, wave = .65 + Math.sin(age * 3 + mote.phase) * .12
      const p = { x: b.x + Math.cos(theta) * rx * wave * auraFit, y: b.y + Math.sin(theta) * ry * wave * auraFit }
      const g = mote.g; g.clear(); fit(g, p, 9); g.rotation = theta + Math.PI / 2; g.alpha = fade * (.28 + .3 * Math.sin(theta) ** 2)
      g.moveTo(5, 0).quadraticCurveTo(-2, -5, -6, 1).quadraticCurveTo(-1, -1, 5, 0).fill(0xbda5df)
    }
  }
  onFrame(update)
  tl.call(() => { arrived = true; update(1.02); onCue({ type: 'impact' }) }, [], 1.02).to({}, { duration: 2.5 }, 0)
}
