import { Container, Graphics } from 'pixi.js'

/** Field coordinates: rain keeps its scale and downward gravity for either user. */
export default function rainDance({ layer, scene, tl, random, onFrame, onCue }) {
  const { width: w, height: h, unit: u } = scene
  const art = new Container(); art.label = 'move-artwork'; art.alpha = 0; layer.addChild(art)
  art.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x284f77, alpha: .12 }))
  const clouds = new Container(); art.addChild(clouds)
  for (let i = 0; i < 9; i++) {
    const cloud = new Graphics().ellipse(0, 0, w * .065, h * .028).fill({ color: 0x718fa8, alpha: .13 })
    cloud.position.set(w * (.075 + i * .106), h * (.055 + (i % 3) * .035)); clouds.addChild(cloud)
  }
  const drops = Array.from({ length: 76 }, (_, i) => {
    const depth = .55 + random() * .45, length = (11 + depth * 13) * u
    const drop = new Graphics().moveTo(0, 0).lineTo(-length * .26, length).stroke({ color: i % 3 ? 0x9cd6ef : 0xd9f4ff, width: (1 + depth * .5) * u, alpha: .7 })
    drop.label = 'rain-streak'; art.addChild(drop)
    const ring = new Graphics().ellipse(0, 0, 8 * u, 2.4 * u).stroke({ color: 0xb6e7f5, width: u })
    ring.label = 'rain-splash'; art.addChild(ring)
    return { drop, ring, x: w * (.07 + random() * .9), floor: h * (.61 + random() * .3), start: .2 + random() * .72, period: .7 + random() * .32, depth, length }
  })
  onFrame(time => {
    clouds.x = Math.sin(time * .8) * 5 * u
    for (const p of drops) {
      const age = time - p.start, cycle = Math.floor(Math.max(0, age) / p.period), phase = ((age % p.period) + p.period) % p.period
      const emitting = age >= 0 && p.start + cycle * p.period < 2.25
      const fall = phase / (p.period * .72)
      p.drop.alpha = emitting && fall < 1 ? p.depth : 0
      p.drop.position.set(p.x - 35 * u * fall, Math.min(1, fall) * (p.floor - p.length))
      const splash = (phase - p.period * .72) / (p.period * .28)
      p.ring.alpha = emitting && splash >= 0 ? (1 - splash) * .42 : 0
      p.ring.position.set(p.x - 35 * u - p.length * .26, p.floor); p.ring.scale.set(.4 + Math.max(0, splash) * 1.4)
    }
  })
  tl.to(art, { alpha: 1, duration: .48 }, .05)
    .call(() => onCue({ type: 'impact' }), [], .65)
    .to(art, { alpha: 0, duration: .55 }, 2.45)
}
