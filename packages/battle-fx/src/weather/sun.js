import { Graphics } from 'pixi.js'

export default function sun({ layer, scene, random }) {
  const { width: w, height: h, unit: u } = scene
  const wash = new Graphics().rect(0, 0, w, h).fill({ color: 0xffcd73, alpha: .075 }); layer.addChild(wash)
  const sunX = w * .5, sunY = Math.max(h * .09, 26 * u)
  const rays = Array.from({ length: 7 }, (_, i) => {
    const ray = new Graphics(); ray.label = 'sun-ray'; layer.addChild(ray)
    return { ray, end: w * (.08 + i * .14), phase: random() * Math.PI * 2 }
  })
  const halo = new Graphics().circle(0, 0, 24 * u).fill({ color: 0xffcb69, alpha: .09 })
    .circle(0, 0, 18 * u).fill({ color: 0xffe8a0, alpha: .17 })
    .circle(0, 0, 11 * u).fill({ color: 0xfff2ba, alpha: .5 })
  halo.label = 'sun-disc'; halo.position.set(sunX, sunY); layer.addChild(halo)
  const glints = Array.from({ length: 15 }, () => {
    const glint = new Graphics().moveTo(-2 * u, 0).lineTo(2 * u, 0).moveTo(0, -4 * u).lineTo(0, 4 * u)
      .stroke({ color: 0xffe9a8, width: u })
    glint.label = 'heat-glint'; layer.addChild(glint)
    return { glint, x: w * (.1 + random() * .8), y: h * (.4 + random() * .44), phase: random() }
  })
  return { duration: .8, render(time) {
    for (const p of rays) {
      const drift = Math.sin(time * 1.8 + p.phase) * w * .012
      p.ray.clear().poly([sunX - 3 * u, sunY, sunX + 3 * u, sunY,
        p.end + drift + w * .028, h * .9, p.end + drift - w * .028, h * .9])
        .fill({ color: 0xffe5a2, alpha: .068 + .018 * Math.sin(time * 3 + p.phase) })
    }
    halo.scale.set(1 + .035 * Math.sin(time * 3.2)); wash.alpha = .9 + .1 * Math.sin(time * 2)
    for (const p of glints) {
      const phase = (time * .95 + p.phase) % 1
      p.glint.alpha = Math.sin(phase * Math.PI) * .45
      p.glint.position.set(p.x + Math.sin(phase * 5) * 3 * u, p.y - phase * 22 * u)
    }
  } }
}
