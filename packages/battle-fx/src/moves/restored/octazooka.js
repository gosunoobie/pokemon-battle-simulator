import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function octazooka(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / extent)) }
  const root = make('octazooka-root'), tip = make('octazooka-tip'), impact = make('octazooka-impact')
  root.attachmentSocket = 'emission'; tip.attachmentSocket = 'emission'; tip.contactPoint = { x: 0, y: 0 }
  const spray = Array.from({ length: 10 }, (_, i) => ({ g: make(`octazooka-spindrift-${i}`), at: .12 + i * .027, side: i % 2 ? -1 : 1, size: 1.3 + random() * 1.5 }))
  const wake = Array.from({ length: 7 }, (_, i) => ({ g: make(`octazooka-wake-${i}`), lag: .02 + i * .022, side: i % 2 ? -1 : 1 }))
  const billows = Array.from({ length: 7 }, (_, i) => ({ g: make(`octazooka-billow-${i}`), at: .76 + i * .028, angle: i * Math.PI * 2 / 7, phase: random() * Math.PI * 2 }))
  const drops = Array.from({ length: 18 }, (_, i) => ({ g: make(`octazooka-drop-${i}`), at: .72 + i % 3 * .045, side: i % 2 ? -1 : 1, reach: .4 + random() * .6, lift: .28 + random() * .38, size: 2 + random() * 2.7 }))
  let hitPoint = null

  function inkEdge(g, radius, phase, color, alpha) {
    for (let j = 0; j <= 60; j++) {
      const q = j * Math.PI * 2 / 60, lobe = 1 + Math.sin(q * 7 + phase) * .17 + Math.sin(q * 11 - phase * .6) * .075
      const x = Math.cos(q) * radius * lobe, y = Math.sin(q) * radius * lobe
      if (!j) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.closePath().fill({ color, alpha })
  }
  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true), dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx)
    const reach = clamp((time - .32) / .4), head = { x: a.x + dx * reach, y: a.y + dy * reach }, nx = -Math.sin(angle), ny = Math.cos(angle)
    const pulse = .55 + Math.sin(time * 43) ** 2 * .45
    root.clear(); fit(root, a, 27); root.rotation = angle
    root.alpha = time >= .06 && time < .61 ? clamp((time - .06) / .09) * (1 - clamp((time - .42) / .19)) * pulse : 0
    root.moveTo(-6, -11 * pulse).quadraticCurveTo(16, -12, 18 * pulse, 0).quadraticCurveTo(15, 10, -6, 11 * pulse)
      .quadraticCurveTo(1, 0, -6, -11 * pulse).fill({ color: 0x242839, alpha: .76 })
      .moveTo(3, -8 * pulse).quadraticCurveTo(15, -6, 16 * pulse, -1).stroke({ color: 0xa2c6d7, width: 1.7, alpha: .79, cap: 'round' })
    spray.forEach(p => {
      const age = time - p.at, u = clamp(age / .28), distance = Math.min(35, room(a) * .48) * u, spread = Math.min(15, room(a) * .22) * Math.sin(u * Math.PI) * p.side
      const at = { x: a.x + Math.cos(angle) * distance + nx * spread, y: a.y + Math.sin(angle) * distance + ny * spread + Math.min(6, room(a) * .08) * u * u }, g = p.g
      g.clear(); fit(g, at, 7); g.rotation = angle + p.side * .25
      g.alpha = age >= 0 && age < .28 ? Math.sin(u * Math.PI) * .74 : 0
      g.ellipse(0, 0, p.size * 1.5, p.size * .63).fill(0x596984).ellipse(p.size * .2, -p.size * .12, p.size * .55, p.size * .2).fill(0xb8d2de)
    })
    wake.forEach((p, i) => {
      const u = clamp((time - .32 - p.lag) / .4), at = { x: a.x + dx * u, y: a.y + dy * u }, offset = Math.min(12, room(at) * .25) * p.side * Math.sin(u * Math.PI)
      at.x += nx * offset; at.y += ny * offset
      const g = p.g; g.clear(); fit(g, at, 17); g.rotation = angle
      g.alpha = time >= .32 + p.lag && time < .96 ? (.67 - i * .045) * (1 - clamp((time - .74) / .22)) : 0
      const length = 8 + Math.sin(time * 31 + i) * 2
      g.moveTo(0, 0).quadraticCurveTo(-5, -4, -length * 1.3, -2).quadraticCurveTo(-length, 3, -4, 3).closePath().fill(0x24263d)
        .moveTo(-3, -1.6).lineTo(-length * .75, -1.2).stroke({ color: 0x7c8fbd, width: 1, alpha: .75 })
    })
    // The thick water-borne ink packet has its visible leading point exactly at local zero.
    tip.clear(); fit(tip, head, 75); tip.rotation = angle
    tip.alpha = time >= .32 && time < .9 ? 1 - clamp((time - .76) / .14) : 0
    const wobble = Math.sin(time * 37) * 2
    tip.moveTo(0, 0).bezierCurveTo(-3, -16, -18, -23 + wobble, -35, -17)
      .quadraticCurveTo(-45, -11, -63, -8).quadraticCurveTo(-46, -2, -59, 8)
      .quadraticCurveTo(-39, 8, -34, 16).bezierCurveTo(-17, 24 + wobble, -3, 16, 0, 0)
      .closePath().fill({ color: 0x101d30, alpha: .96 })
      .moveTo(-2, -1).bezierCurveTo(-6, -14, -16, -19, -32, -15)
      .stroke({ color: 0x95bad5, width: 2.7, alpha: .94, cap: 'round' })
      .moveTo(-4, 7).quadraticCurveTo(-12, 18, -28, 15).stroke({ color: 0x5b6d9f, width: 2.1, alpha: .82, cap: 'round' })
      .ellipse(-20, -8 + wobble * .22, 8, 3).fill({ color: 0xc5dce9, alpha: .74 })
      .ellipse(-31, 5, 14, 7).fill({ color: 0x373052, alpha: .78 })
    const c = hitPoint ?? b, age = time - .72, burst = clamp(age / .42)
    impact.clear(); fit(impact, c, 79); impact.alpha = hitPoint && age >= 0 && age < .68 ? 1 - clamp((age - .15) / .53) : 0
    inkEdge(impact, 10 + burst * 33, time * 3.7, 0x151d32, .66)
    for (let j = 0; j < 8; j++) {
      const q = j * Math.PI * 2 / 8 + .13, inner = 9 + burst * 19, outer = inner + (7 + j % 3 * 6) * Math.sin(burst * Math.PI * .78)
      impact.moveTo(Math.cos(q) * inner, Math.sin(q) * inner).quadraticCurveTo(Math.cos(q + .1) * outer, Math.sin(q + .1) * outer, Math.cos(q) * (outer + 5), Math.sin(q) * (outer + 5))
        .stroke({ color: j % 2 ? 0x4a496f : 0x889fbd, width: 2.8 - burst * 1.2, alpha: j % 2 ? .74 : .58, cap: 'round' })
    }
    billows.forEach((p, i) => {
      const age = time - p.at, u = clamp(age / 1.24), span = Math.min(62, room(c) * .44), spread = (.18 + u * .76) * span
      const at = { x: c.x + Math.cos(p.angle + Math.sin(time * 2 + p.phase) * .17) * spread, y: c.y + Math.sin(p.angle) * spread * .66 + span * .34 * u * u }, g = p.g
      g.clear(); fit(g, at, 58); g.rotation = Math.sin(time * 1.9 + p.phase) * .22
      g.alpha = hitPoint && age >= 0 && age < 1.24 ? clamp(age / .17) * (1 - clamp((u - .52) / .48)) * .36 : 0
      const r = 12 + u * 20
      inkEdge(g, r, time * 3.6 + p.phase, i % 2 ? 0x35334d : 0x24334a, .76)
      g.ellipse(-r * .23 + Math.sin(time * 3 + p.phase) * 2, -r * .23, r * .55, r * .43).fill({ color: 0x73728b, alpha: .25 })
    })
    drops.forEach((p, i) => {
      const age = time - p.at, u = clamp(age / 1.21), span = Math.min(90, room(c) * .43)
      const at = { x: c.x + p.side * span * p.reach * u, y: c.y - span * p.lift * u + span * 1.65 * u * u }, g = p.g
      g.clear(); fit(g, at, 10); g.rotation = 0
      g.alpha = hitPoint && age >= 0 && age < 1.21 ? clamp(age / .045) * (1 - clamp((u - .68) / .32)) * .89 : 0
      const stretch = 1 + u * .43
      g.moveTo(0, -p.size * stretch * 1.5).quadraticCurveTo(-p.size * 1.1, -p.size * .1, -p.size * .67, p.size * .76)
        .quadraticCurveTo(0, p.size * 1.45, p.size * .67, p.size * .76).quadraticCurveTo(p.size * 1.1, -p.size * .1, 0, -p.size * stretch * 1.5)
        .fill(i % 2 ? 0x292b43 : 0x172638)
        .ellipse(-p.size * .23, -p.size * .04, p.size * .22, p.size * .48).fill({ color: 0x9aaecb, alpha: .7 })
    })
  }
  onFrame(update)
  tl.call(() => update(.32), [], .32)
    .call(() => { hitPoint = targetSocket('center', true); update(.72); onCue({ type: 'impact' }) }, [], .72)
    .to({}, { duration: 2.05 }, 0)
}
