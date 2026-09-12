import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Heavy exhaust rolls along the route, then tumbles down and thins out.
export default function smog(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, unit } = bindEffectSpace(context)
  const width = Math.min(164, Math.max(84, context.target.metrics.width / unit * .8))
  const height = Math.min(116, Math.max(68, context.target.metrics.height / unit * .57))
  const clouds = [], soot = []
  for (let i = 0; i < 13; i++) {
    const cloud = new Container(); cloud.label = 'smog-billow'; cloud.alpha = 0
    const body = new Graphics()
    for (let j = 0; j < 6; j++) {
      const angle = j * Math.PI / 3
      body.circle(Math.cos(angle) * 13, Math.sin(angle) * 9, 12 + random() * 6)
    }
    body.fill(i % 3 ? 0x85718f : 0x655e76)
      .ellipse(-4, -5, 16, 10).fill({ color: 0xb497b9, alpha: .38 })
      .moveTo(-17, 5).quadraticCurveTo(-3, -10, 12, -1).quadraticCurveTo(19, 8, 7, 10)
      .stroke({ color: 0xc3afc6, width: 1.8, alpha: .38, cap: 'round' })
    cloud.addChild(body); temporary.addChild(cloud)
    clouds.push({ cloud, at: .2 + i * .045, travel: .64,
      x: focus.x + (random() - .5) * width * .55,
      y: focus.y + (random() - .5) * height * .65,
      phase: random() * Math.PI * 2, scale: .8 + random() * .35 })
  }
  for (let i = 0; i < 30; i++) {
    const dot = new Graphics().circle(0, 0, .8 + random() * 1.4).fill(i % 2 ? 0x514757 : 0xbaa0c3)
    dot.alpha = 0; temporary.addChild(dot)
    soot.push({ dot, at: .25 + i * .018, phase: random() * 6.28,
      x: focus.x + (random() - .5) * width * .68,
      y: focus.y + (random() - .5) * height * .75 })
  }
  onFrame(time => {
    const from = socket('emission', true)
    for (const p of clouds) {
      const age = time - p.at
      if (age < 0 || age > 1.32) { p.cloud.alpha = 0; continue }
      const u = Math.min(1, age / p.travel), linger = Math.max(0, age - p.travel)
      p.cloud.x = from.x + (p.x - from.x) * u + Math.sin(p.phase + age * 4.8) * 7 * u + linger * 15
      p.cloud.y = from.y + (p.y - from.y) * u - Math.sin(Math.PI * u) * 11 + Math.cos(p.phase + age * 4) * 5 * u + linger * 15
      p.cloud.rotation = Math.sin(p.phase + age * 3.6) * .24
      p.cloud.scale.set(p.scale * (.42 + u * .63 + linger * .2) * (1 + Math.sin(age * 7 + p.phase) * .06))
      p.cloud.alpha = Math.min(1, age / .1) * Math.max(0, 1 - linger / .68) * .27
    }
    for (const p of soot) {
      const age = time - p.at
      if (age < 0 || age > 1.1) { p.dot.alpha = 0; continue }
      const u = Math.min(1, age / .64), fall = Math.max(0, age - .64)
      p.dot.x = from.x + (p.x - from.x) * u + Math.sin(p.phase + age * 9) * 8 * Math.sin(Math.PI * u) + fall * 14
      p.dot.y = from.y + (p.y - from.y) * u + Math.cos(p.phase + age * 7) * 6 * u + fall * 23
      p.dot.alpha = Math.sin(Math.PI * age / 1.1) * .62
    }
  })
  tl.to(attacker, { x: home.x - 4, rotation: -.025, duration: .16 }, 0)
    .to(attacker, { x: home.x, rotation: 0, duration: .3 }, .16)
    .call(() => { onCue({ type: 'impact' }); defender.tint = 0xc3accd }, [], .84)
    .to(defender, { x: defenderHome.x + 5, duration: .07, repeat: 3, yoyo: true }, .84)
    .call(() => { defender.tint = 0xffffff }, [], 1.12)
}
