import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function disable(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const eyes = context.source.hasAnchor?.('eyes') ? 'eyes' : 'emission'
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const r = Math.min(43, Math.max(26, context.target.metrics.height / unit * .2))
  const glint = new Graphics().poly([-10,0,-2,-2,0,-7,2,-2,10,0,2,2,0,7,-2,2]).fill(0xf2dfff)
  glint.label = 'disable-source'; glint.alpha = 0; temporary.addChild(glint)
  const pulses = Array.from({ length: 3 }, (_, i) => {
    const g = new Graphics().ellipse(0, 0, 5 + i, 12 + i * 3).stroke({ color: i === 1 ? 0xf0d5ff : 0xae99e3, width: 2 })
    g.alpha = 0; g.label = `disable-pulse-${i}`; temporary.addChild(g); return g
  })
  const seal = new Container(); seal.label = 'disable-seal'; seal.alpha = 0; temporary.addChild(seal)
  const ring = new Graphics(), clamps = new Graphics(), cross = new Graphics()
  seal.addChild(ring, clamps, cross)
  function update(time) {
    const from = socket(eyes, true), to = targetSocket('center', true)
    glint.position.copyFrom(from); glint.scale.set(Math.min(1, room(from) / 12))
    pulses.forEach((g, i) => {
      const age = time - .18 - i * .09, u = Math.max(0, Math.min(1, age / .58))
      const p = { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }
      g.position.copyFrom(p); g.rotation = Math.atan2(to.y - from.y, to.x - from.x)
      g.scale.set(Math.min(.6 + u * .4, room(p) / 23)); g.alpha = age >= 0 && age < .7 ? Math.min(1, age * 14) * Math.min(1, (.7 - age) * 10) : 0
    })
    seal.position.copyFrom(to); seal.scale.set(Math.min(1, room(to) / (r * 1.45)))
    const close = Math.max(0, Math.min(1, (time - .42) / .34)), x = r * (1.3 - close * .3)
    ring.clear().circle(0, 0, r * .78).fill({ color: 0x56456f, alpha: .09 })
    for (let i = 0; i < 3; i++) {
      const a = time * 1.8 + i * Math.PI * 2 / 3, rad = r * .84
      ring.moveTo(Math.cos(a) * rad, Math.sin(a) * rad).arc(0, 0, rad, a, a + 1.5).stroke({ color: 0xbba3e6, width: 1.8, alpha: .7 })
    }
    clamps.clear()
    for (const side of [-1, 1]) clamps.moveTo(side * (x - r * .2), -r * .57).lineTo(side * x, -r * .57).lineTo(side * x, r * .57).lineTo(side * (x - r * .2), r * .57).stroke({ color: 0xe2c7fa, width: 3, cap: 'round', join: 'round' })
    const grow = Math.max(0, Math.min(1, (time - .68) / .08)) * r * .4
    cross.clear().moveTo(-grow,-grow).lineTo(grow,grow).moveTo(grow,-grow).lineTo(-grow,grow).stroke({ color: 0xf6dcff, width: 4, cap: 'round' })
    cross.alpha = .75 + Math.sin(time * 12) ** 2 * .25
  }
  onFrame(update)
  tl.to(glint, { alpha: 1, duration: .1 }, .08).to(glint, { alpha: 0, duration: .2 }, .45)
    .to(seal, { alpha: 1, duration: .25 }, .42).to(seal, { alpha: 0, duration: .42 }, 1.48)
    .call(() => { update(.76); onCue({ type: 'impact' }) }, [], .76)
}
