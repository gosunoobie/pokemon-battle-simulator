import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function destinyBond(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / extent)) }
  const chains = make('destiny-bond-links'), tip = make('destiny-bond-tip'), impact = make('destiny-bond-impact')
  tip.attachmentSocket = 'center'
  const lights = Array.from({ length: 2 }, (_, i) => ({ g: make(`destiny-bond-wisp-${i}`), phase: i * Math.PI }))
  const motes = Array.from({ length: 12 }, (_, i) => ({ g: make(`destiny-bond-mote-${i}`), phase: i / 12 }))
  let bound = false

  function update(time) {
    const c = socket('center', true), rx = Math.min(105, Math.max(55, context.source.metrics.width / unit * .64)), ry = Math.min(105, Math.max(50, context.source.metrics.height / unit * .56))
    const sx = Math.max(0, Math.min(1, (c.x - left - 6) / (rx + 16), (right - c.x - 6) / (rx + 16)))
    const sy = Math.max(0, Math.min(1, (c.y - top - 6) / (ry + 16), (bottom - c.y - 6) / (ry + 16)))
    const fade = clamp((time - .07) / .24) * (1 - clamp((time - 1.76) / .44)), gather = clamp((time - .1) / .68)
    const orbit = time * 2.7, knot = 1 - .82 * Math.exp(-Math.pow((time - .88) / .15, 2))
    chains.clear(); chains.position.copyFrom(c); chains.scale.set(sx, sy); chains.alpha = fade
    // Two linked loops cross at the caster; individual chain links keep flowing through the seal.
    for (let strand = 0; strand < 2; strand++) {
      const offset = strand * Math.PI, reach = .48 + gather * .42
      for (let j = 0; j < 25; j++) {
        const q = j * Math.PI * 2 / 25 + orbit * (strand ? -.43 : .43) + offset
        const x = Math.sin(q) * rx * reach, y = Math.sin(q * 2 + offset) * ry * .53
        const tangent = Math.atan2(Math.cos(q * 2 + offset) * ry * 1.06, Math.cos(q) * rx * reach)
        const length = 5.5 + Math.sin(q * 2 + time * 3) * .7, breadth = j % 2 ? 2.3 : 3.4
        for (let k = 0; k <= 14; k++) {
          const a = k * Math.PI * 2 / 14, along = Math.cos(a) * length, across = Math.sin(a) * breadth
          const px = x + Math.cos(tangent) * along - Math.sin(tangent) * across, py = y + Math.sin(tangent) * along + Math.cos(tangent) * across
          if (!k) chains.moveTo(px, py); else chains.lineTo(px, py)
        }
        chains.closePath().stroke({ color: strand ? 0xba9ddc : 0x8cccd6, width: j % 2 ? 1.1 : 1.5, alpha: j % 2 ? .47 : .76 })
      }
    }
    lights.forEach((p, i) => {
      const q = orbit + p.phase, x = Math.sin(q) * rx * .84 * knot * sx, y = Math.cos(q) * ry * .67 * knot * sy
      const at = { x: c.x + x, y: c.y + y }, g = p.g, tangent = Math.atan2(-Math.sin(q) * ry * .67 * sy, Math.cos(q) * rx * .84 * sx)
      g.clear(); fit(g, at, 33); g.rotation = tangent; g.alpha = fade
      const tail = 23 + Math.sin(time * 7 + p.phase) * 3
      g.moveTo(10, 0).quadraticCurveTo(3, -12, -tail, -7).quadraticCurveTo(-tail * .5, -1, -tail * .78, 4)
        .quadraticCurveTo(-2, 12, 10, 0).fill({ color: i ? 0x9471bb : 0x66adba, alpha: .66 })
        .ellipse(1, 0, 6, 5).fill({ color: i ? 0xe3cbf6 : 0xd0f4ef, alpha: .94 })
        .circle(3, -1, 2.2).fill(0xffffff)
    })
    tip.clear(); fit(tip, c, 27); tip.alpha = time >= .55 && time < 1.4 ? clamp((time - .55) / .23) * (1 - clamp((time - 1.05) / .35)) : 0
    const close = clamp((time - .55) / .33), separation = 8 * (1 - close) + 3
    for (const side of [-1, 1]) {
      tip.ellipse(side * separation, 0, 10, 15).stroke({ color: side < 0 ? 0xabe4e5 : 0xd3b5ed, width: 2, alpha: .86 })
    }
    tip.circle(0, 0, 2.6).fill({ color: 0xf3ecfb, alpha: .9 })
    const age = time - .88, u = clamp(age / .58)
    impact.clear(); fit(impact, c, 65); impact.alpha = bound && age >= 0 && age < .58 ? 1 - u : 0
    for (const side of [-1, 1]) {
      const r = 14 + u * 32
      impact.moveTo(0, -r * .5).bezierCurveTo(side * r * 1.16, -r, side * r * 1.16, r, 0, r * .5)
        .bezierCurveTo(-side * r * .45, r * .12, -side * r * .45, -r * .12, 0, -r * .5)
        .stroke({ color: side < 0 ? 0xa8dfe6 : 0xd0b4ed, width: 2.3 - u, alpha: .72 })
    }
    motes.forEach(p => {
      const q = time * 1.45 + p.phase * Math.PI * 2, distance = .49 + Math.sin(time * 2.5 + p.phase * 10) * .12
      const at = { x: c.x + Math.sin(q) * rx * distance * sx, y: c.y + Math.sin(q * 2) * ry * .42 * sy }, g = p.g
      g.clear(); fit(g, at, 5); g.alpha = fade * (.3 + Math.sin(time * 4 + p.phase * 8) * .15)
      g.circle(0, 0, 1.4 + p.phase).fill(p.phase < .5 ? 0x9dced7 : 0xc5a8e0)
    })
  }
  onFrame(update)
  tl.call(() => { bound = true; update(.88); onCue({ type: 'impact' }) }, [], .88)
    .to({}, { duration: 2.25 }, 0)
}
