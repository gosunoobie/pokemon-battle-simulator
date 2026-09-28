import { Container, Graphics } from 'pixi.js'

export default function rain({ layer, scene, random }) {
  const { width: w, height: h, unit: u } = scene
  layer.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x284f77, alpha: .075 }))
  const clouds = new Container(); clouds.label = 'rain-clouds'; layer.addChild(clouds)
  for (let i = 0; i < 7; i++) {
    const cloud = new Graphics().ellipse(0, 0, w * .057, h * .022).fill({ color: 0x718fa8, alpha: .12 })
    cloud.position.set(w * (.09 + i * .136), h * (.052 + (i % 3) * .026)); clouds.addChild(cloud)
  }
  const drops = Array.from({ length: 54 }, (_, i) => {
    const depth = .55 + random() * .45, length = (10 + depth * 12) * u
    const drop = new Graphics().moveTo(0, 0).lineTo(-length * .26, length)
      .stroke({ color: i % 3 ? 0x9cd6ef : 0xd9f4ff, width: (1 + depth * .4) * u, alpha: .72 })
    drop.label = 'rain-streak'; layer.addChild(drop)
    const ring = new Graphics().ellipse(0, 0, 6 * u, 1.8 * u).stroke({ color: 0xb6e7f5, width: .8 * u })
    ring.label = 'rain-splash'; layer.addChild(ring)
    return { drop, ring, depth, length, x: w * (.12 + random() * .82), floor: h * (.64 + random() * .26),
      offset: random(), period: .42 + random() * .2 }
  })
  return { duration: .88, render(time) {
    clouds.x = Math.sin(time * 1.3) * 3 * u
    for (const p of drops) {
      const phase = (time / p.period + p.offset) % 1, fall = Math.min(1, phase / .75)
      p.drop.alpha = phase < .75 ? p.depth : 0
      p.drop.position.set(p.x - 24 * u * fall, u + fall * (p.floor - p.length - u))
      const splash = Math.max(0, (phase - .75) / .25)
      p.ring.alpha = phase >= .75 ? (1 - splash) * .4 : 0
      p.ring.position.set(p.x - 24 * u - p.length * .26, p.floor)
      p.ring.scale.set(.4 + splash * 1.15)
    }
  } }
}
