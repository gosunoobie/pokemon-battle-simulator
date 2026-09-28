import { Graphics } from 'pixi.js'

export default function hail({ layer, scene, random }) {
  const { width: w, height: h, unit: u } = scene
  layer.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x8cbedb, alpha: .065 }))
  const pellets = Array.from({ length: 34 }, () => {
    const size = (2 + random() * 1.8) * u
    const ice = new Graphics().poly([-size, 0, -size * .4, -size, size * .7, -size * .65, size, size * .35, 0, size])
      .fill(0xb9e1f1).poly([-size * .4, -size, size * .7, -size * .65, 0, size * .2]).fill(0xf0fbff)
    ice.label = 'hail-pellet'; layer.addChild(ice)
    const chips = [-1, 1].map(sign => {
      const chip = new Graphics().poly([0, -size * .45, size * .5, size * .35, -size * .4, size * .2]).fill(0xd9f4ff)
      chip.label = 'hail-chip'; layer.addChild(chip); return { chip, sign }
    })
    return { ice, chips, size, x: w * (.09 + random() * .82), floor: h * (.64 + random() * .23),
      period: .56 + random() * .18, offset: random(), bounce: (9 + random() * 8) * u, drift: (random() - .5) * 16 * u }
  })
  return { duration: .94, render(time) {
    for (const p of pellets) {
      const phase = (time / p.period + p.offset) % 1, fall = Math.min(1, phase / .64), bounce = Math.max(0, (phase - .64) / .2)
      const top = p.size * 1.5
      p.ice.alpha = phase < .84 ? .83 : 0
      if (phase < .64) p.ice.position.set(p.x + p.drift * fall, top + (p.floor - top) * fall ** 1.6)
      else p.ice.position.set(p.x + p.drift + Math.min(1, bounce) * 6 * u,
        p.floor - 4 * p.bounce * Math.min(1, bounce) * (1 - Math.min(1, bounce)))
      p.ice.rotation = phase * 4
      const split = Math.max(0, (phase - .84) / .16)
      for (const { chip, sign } of p.chips) {
        chip.alpha = phase >= .84 ? (1 - split) * .65 : 0
        chip.position.set(p.x + p.drift + 6 * u + sign * split * 12 * u, p.floor - Math.sin(split * Math.PI) * 5 * u)
        chip.rotation = sign * phase * 6
      }
    }
  } }
}
