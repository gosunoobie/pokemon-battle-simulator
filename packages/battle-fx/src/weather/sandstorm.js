import { Graphics } from 'pixi.js'

export default function sandstorm({ layer, scene, random }) {
  const { width: w, height: h, unit: u } = scene
  layer.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0xab7b3b, alpha: .06 }))
  const bands = Array.from({ length: 4 }, (_, i) => {
    const gust = new Graphics(); gust.label = 'sand-gust'; layer.addChild(gust)
    return { gust, y: h * (.25 + i * .16), phase: i * 1.6, width: (10 + i * 3) * u }
  })
  const grains = Array.from({ length: 66 }, (_, i) => {
    const heavy = i % 5 === 0, size = (heavy ? 2.4 : .8 + random()) * u
    const grain = new Graphics().poly([-size, 0, 0, -size * .6, size, 0, size * .5, size * .7])
      .fill(i % 3 ? 0xe2c58c : 0xae844e)
    grain.label = heavy ? 'sand-chip' : 'sand-grain'; layer.addChild(grain)
    return { grain, heavy, offset: random(), period: .65 + random() * .45,
      y: h * (heavy ? .77 + random() * .11 : .2 + random() * .57), phase: random() * Math.PI * 2 }
  })
  return { duration: .9, render(time) {
    const strength = .76 + .24 * Math.sin(time * 5)
    for (const p of bands) {
      const points = []
      for (let side = 0; side < 2; side++) {
        for (let n = 0; n <= 24; n++) {
          const i = side ? 24 - n : n, fraction = i / 24
          points.push(w * (.025 + fraction * .95), p.y + Math.sin(i * .33 - time * 5 + p.phase) * 10 * u * strength +
            (side ? p.width * Math.sin(fraction * Math.PI) : 0))
        }
      }
      p.gust.clear().poly(points).fill({ color: 0xc7a16a, alpha: .085 * strength })
    }
    for (const p of grains) {
      const phase = (time / p.period + p.offset) % 1
      p.grain.position.set(w * (.025 + phase * .95), p.y + (p.heavy ? -Math.abs(Math.sin(phase * Math.PI * 4)) * 10 * u :
        Math.sin(phase * 8 + p.phase) * 13 * u))
      p.grain.rotation = time * (p.heavy ? 4 : 1.3) + p.phase
      p.grain.alpha = Math.sin(phase * Math.PI) * (p.heavy ? .62 : .48)
    }
  } }
}
