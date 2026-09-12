import { Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function painSplit(context) {
  const { tl, glowTexture, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const radius = Math.min(33, Math.max(21, Math.min(context.source.metrics.height, context.target.metrics.height) / unit * .17))
  const tether = new Graphics(); tether.alpha = 0; temporary.addChild(tether)
  const halos = [0xe2a9db, 0xb6b7ef].map((color, i) => {
    const glow = new Sprite(glowTexture); glow.anchor.set(.5); glow.tint = color; glow.alpha = 0; glow.blendMode = 'add'; temporary.addChild(glow)
    const ring = new Graphics(); ring.label = `pain-split-halo-${i}`; ring.alpha = 0; temporary.addChild(ring); return { glow, ring, color }
  })
  const beads = []
  for (let lane = 0; lane < 2; lane++) for (let i = 0; i < 10; i++) {
    const g = new Graphics().circle(0, 0, 5).fill(lane ? 0xc1b9ed : 0xefb0db).circle(-1, -1, 2).fill(0xfff0fb)
    g.label = `pain-split-transfer-${lane}-${i}`; g.alpha = 0; temporary.addChild(g)
    beads.push({ g, lane, start: .34 + i * .04 })
  }
  function update(time) {
    const points = [socket('aura', true), targetSocket('aura', true)], bow = Math.max(0, Math.min(28, room(points[0]) - 8, room(points[1]) - 8))
    const envelope = time >= .08 && time < 1.99 ? Math.min(1, (time - .08) * 5) * Math.min(1, (1.99 - time) * 3) : 0
    halos.forEach(({ glow, ring, color }, i) => {
      const at = points[i], size = Math.max(0, Math.min(radius * (1 + .12 * Math.sin(time * 9)), room(at) / 1.4))
      glow.position.copyFrom(at); glow.width = glow.height = size * 2.5; glow.alpha = envelope * .32
      ring.position.copyFrom(at); ring.alpha = envelope; ring.clear()
      for (let j = 0; j < 2; j++) {
        const a = time * (i ? -3 : 3) + j * Math.PI, r = size * (j ? 1.1 : .8)
        ring.moveTo(Math.cos(a) * r, Math.sin(a) * r).arc(0, 0, r, a, a + 2.2).stroke({ color: time >= 1.4 ? 0xe7c8ee : color, width: 2, alpha: .8 })
      }
    })
    tether.clear(); tether.alpha = time >= .34 && time < 1.68 ? Math.min(1, (time - .34) * 8) * Math.min(1, (1.68 - time) * 5) : 0
    for (let lane = 0; lane < 2; lane++) {
      const a = points[lane], b = points[1 - lane]
      for (let i = 0; i <= 36; i++) { const u = i / 36, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * bow * (lane ? -1 : 1); i ? tether.lineTo(x, y) : tether.moveTo(x, y) }
      tether.stroke({ color: lane ? 0xb9b4e9 : 0xe9aed8, width: 1.5, alpha: .45 })
    }
    for (const p of beads) {
      const age = time - p.start, u = Math.max(0, Math.min(1, age / .7)), a = points[p.lane], b = points[1 - p.lane]
      const at = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * bow * (p.lane ? -1 : 1) }
      p.g.position.copyFrom(at); p.g.scale.set(Math.min(1, room(at) / 6))
      p.g.alpha = age >= 0 && age < .88 ? Math.min(1, age * 16) * Math.max(0, 1 - Math.max(0, age - .7) / .18) : 0
    }
  }
  onFrame(update)
  tl.call(() => { update(1.4); onCue({ type: 'impact' }) }, [], 1.4)
}
