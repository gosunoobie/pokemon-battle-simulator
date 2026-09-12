import { Container, Graphics } from 'pixi.js'

export default function hail({ layer, scene, tl, random, onFrame, onCue }) {
  const { width: w, height: h, unit: u } = scene
  const art = new Container(); art.label = 'move-artwork'; art.alpha = 0; layer.addChild(art)
  art.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x8cbedb, alpha: .07 }))
  const pellets = Array.from({ length: 48 }, (_, i) => {
    const size = (2.4 + random() * 2.3) * u
    const ice = new Graphics().poly([-size, 0, -size * .4, -size, size * .7, -size * .65, size, size * .35, 0, size])
      .fill(0xb9e1f1).poly([-size * .4, -size, size * .7, -size * .65, 0, size * .2]).fill(0xf0fbff)
    ice.label = 'hail-pellet'; art.addChild(ice)
    const chips = [-1, 1].map(sign => {
      const g = new Graphics().poly([0, -size * .45, size * .5, size * .35, -size * .4, size * .2]).fill(0xd9f4ff)
      g.label = 'hail-chip'; art.addChild(g); return { g, sign }
    })
    return { ice, chips, x: w * (.08 + random() * .84), floor: h * (.59 + random() * .31), start: .1 + i / 48 * 1.46,
      fall: .48 + random() * .2, bounce: (14 + random() * 15) * u, drift: (random() - .5) * 28 * u }
  })
  onFrame(time => {
    for (const p of pellets) {
      const age = time - p.start, t = age / p.fall, b = (age - p.fall) / .32
      p.ice.alpha = age >= 0 && b < 1 ? .85 : 0
      if (t < 1) p.ice.position.set(p.x + p.drift * t, 6 * u + (p.floor - 6 * u) * Math.max(0, t) ** 1.6)
      else p.ice.position.set(p.x + p.drift + b * 9 * u, p.floor - 4 * p.bounce * b * (1 - b))
      p.ice.rotation = Math.max(0, age) * 4
      const split = (age - p.fall - .32) / .33
      for (const { g, sign } of p.chips) {
        g.alpha = split >= 0 && split < 1 ? (1 - split) * .7 : 0
        g.position.set(p.x + p.drift + 9 * u + sign * Math.max(0, split) * 17 * u, p.floor - Math.sin(Math.max(0, split) * Math.PI) * 6 * u)
        g.rotation = sign * age * 6
      }
    }
  })
  tl.to(art, { alpha: 1, duration: .4 }, .05)
    .call(() => onCue({ type: 'impact' }), [], .65)
    .to(art, { alpha: 0, duration: .55 }, 2.4)
}
