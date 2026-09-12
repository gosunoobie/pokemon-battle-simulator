import { Container, Graphics } from 'pixi.js'

export default function sunnyDay({ layer, scene, tl, random, onFrame, onCue }) {
  const { width: w, height: h, unit: u } = scene
  const art = new Container(); art.label = 'move-artwork'; art.alpha = 0; layer.addChild(art)
  const wash = new Graphics().rect(0, 0, w, h).fill({ color: 0xffcd73, alpha: .085 }); art.addChild(wash)
  const sunX = w * .5, sunY = h * .09
  const rays = Array.from({ length: 7 }, (_, i) => {
    const ray = new Graphics(); ray.label = 'sun-ray'; art.addChild(ray)
    return { ray, end: w * (.07 + i * .143), phase: random() * Math.PI * 2 }
  })
  const halo = new Graphics().circle(0, 0, 31 * u).fill({ color: 0xffcb69, alpha: .08 })
    .circle(0, 0, 23 * u).fill({ color: 0xffe8a0, alpha: .16 })
    .circle(0, 0, 15 * u).fill({ color: 0xfff2ba, alpha: .6 })
  halo.label = 'sun-disc'; halo.position.set(sunX, sunY); art.addChild(halo)
  const glints = Array.from({ length: 18 }, () => {
    const g = new Graphics().moveTo(-2 * u, 0).lineTo(2 * u, 0).moveTo(0, -4 * u).lineTo(0, 4 * u).stroke({ color: 0xffe9a8, width: u })
    g.label = 'heat-glint'; art.addChild(g)
    return { g, x: w * (.09 + random() * .82), y: h * (.36 + random() * .51), start: .45 + random() * 1.1 }
  })
  onFrame(time => {
    for (const p of rays) {
      const drift = Math.sin(time * .6 + p.phase) * w * .016
      p.ray.clear().poly([sunX - 4 * u, sunY, sunX + 4 * u, sunY, p.end + drift + w * .035, h * .91, p.end + drift - w * .035, h * .91])
        .fill({ color: 0xffe5a2, alpha: .065 + .018 * Math.sin(time * 1.6 + p.phase) })
    }
    halo.scale.set(1 + .055 * Math.sin(time * 2.2)); wash.alpha = .85 + .15 * Math.sin(time)
    for (const p of glints) {
      const t = (time - p.start) / 1.05
      p.g.alpha = t > 0 && t < 1 ? Math.sin(t * Math.PI) * .5 : 0
      p.g.position.set(p.x + Math.sin(t * 2.3) * 3 * u, p.y - Math.max(0, t) * 27 * u)
    }
  })
  tl.to(art, { alpha: 1, duration: .65 }, .08)
    .call(() => onCue({ type: 'impact' }), [], .75)
    .to(art, { alpha: 0, duration: .6 }, 2.1)
}
