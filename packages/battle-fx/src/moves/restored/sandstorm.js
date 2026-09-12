import { Container, Graphics } from 'pixi.js'

export default function sandstorm({ layer, scene, tl, random, onFrame, onCue }) {
  const { width: w, height: h, unit: u } = scene
  const art = new Container(); art.label = 'move-artwork'; art.alpha = 0; layer.addChild(art)
  art.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0xab7b3b, alpha: .07 }))
  const bands = Array.from({ length: 5 }, (_, i) => {
    const g = new Graphics(); g.label = 'sand-gust'; art.addChild(g)
    return { g, y: h * (.24 + i * .135), phase: i * 1.6, width: (12 + i * 3) * u }
  })
  const grains = Array.from({ length: 86 }, (_, i) => {
    const heavy = i % 5 === 0, size = (heavy ? 2.7 : 1 + random()) * u
    const g = new Graphics().poly([-size, 0, 0, -size * .6, size, 0, size * .5, size * .7]).fill(i % 3 ? 0xe2c58c : 0xae844e)
    g.label = heavy ? 'sand-chip' : 'sand-grain'; art.addChild(g)
    return { g, heavy, start: random(), period: 1.05 + random() * .6, y: h * (heavy ? .76 + random() * .14 : .17 + random() * .65), phase: random() * 6.28 }
  })
  onFrame(time => {
    const gust = .72 + .28 * Math.sin(time * 4.5)
    for (const p of bands) {
      p.g.clear()
      const points = []
      for (let i = 0; i <= 28; i++) {
        const x = w * (.025 + i / 28 * .95), y = p.y + Math.sin(i * .28 - time * 3.7 + p.phase) * 12 * u * gust
        points.push(x, y)
      }
      for (let i = 28; i >= 0; i--) {
        const x = w * (.025 + i / 28 * .95), y = p.y + Math.sin(i * .28 - time * 3.7 + p.phase) * 12 * u * gust
        points.push(x, y + p.width * Math.sin(i / 28 * Math.PI))
      }
      p.g.poly(points).fill({ color: 0xc7a16a, alpha: .08 * gust })
    }
    for (const p of grains) {
      const t = ((time / p.period + p.start) % 1 + 1) % 1
      p.g.position.set(w * (.025 + t * .95), p.y + (p.heavy ? -Math.abs(Math.sin(t * Math.PI * 4)) * 13 * u : Math.sin(t * 8 + p.phase) * 16 * u))
      p.g.rotation = time * (p.heavy ? 4 : 1.3) + p.phase
      p.g.alpha = Math.sin(t * Math.PI) * (p.heavy ? .65 : .5)
    }
  })
  tl.to(art, { alpha: 1, duration: .5 }, .07)
    .call(() => onCue({ type: 'impact' }), [], .7)
    .to(art, { alpha: 0, duration: .65 }, 2.45)
}
