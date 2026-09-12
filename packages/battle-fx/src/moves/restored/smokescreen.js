import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// A compact smoke shot opens into charcoal billows, which peel apart and rise.
export default function smokescreen(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, home, focus, socket, unit } = bindEffectSpace(context)
  const width = Math.min(178, Math.max(88, context.target.metrics.width / unit * .88))
  const height = Math.min(138, Math.max(76, context.target.metrics.height / unit * .68))
  const shot = new Container(); shot.label = 'smokescreen-shot'; shot.alpha = 0; temporary.addChild(shot)
  for (let i = 0; i < 5; i++) {
    const knot = new Graphics().circle(i * -6, Math.sin(i * 2) * 5, 8 - i * .7)
      .fill(i % 2 ? 0x737a80 : 0x434a52)
    knot.alpha = 1 - i * .12; shot.addChild(knot)
  }
  const billows = [], ash = []
  for (let i = 0; i < 10; i++) {
    const cloud = new Container(); cloud.label = 'smokescreen-billow'; cloud.alpha = 0; temporary.addChild(cloud)
    const body = new Graphics()
    for (let j = 0; j < 5; j++) {
      const a = j * Math.PI * 2 / 5
      body.circle(Math.cos(a) * 11, Math.sin(a) * 9, 14 + random() * 4)
    }
    body.fill(i % 2 ? 0x59616a : 0x343c45)
      .ellipse(-5, -9, 17, 9).fill({ color: 0x99a2aa, alpha: .25 })
      .moveTo(-15, 3).quadraticCurveTo(-8, -8, 6, -5).quadraticCurveTo(18, -1, 8, 7)
      .stroke({ color: 0xabb2b7, width: 1.8, alpha: .3, cap: 'round' })
    cloud.addChild(body)
    const angle = i * Math.PI * 2 / 10 + (random() - .5) * .35
    billows.push({ cloud, at: .64 + i * .012, angle, scale: .75 + random() * .2,
      spin: (i % 2 ? 1 : -1) * (.3 + random() * .2) })
  }
  for (let i = 0; i < 18; i++) {
    const fleck = new Graphics().ellipse(0, 0, .8 + random(), 1.8 + random()).fill(0x8e969f)
    fleck.alpha = 0; temporary.addChild(fleck)
    ash.push({ fleck, at: .67 + i * .023, x: (random() - .5) * width * .64,
      vx: (random() - .5) * 30, vy: -20 - random() * 20, phase: random() * 6.28 })
  }
  onFrame(time => {
    const from = socket('emission', true), age = time - .16
    if (age >= 0 && age <= .64) {
      const u = Math.min(1, age / .48)
      shot.position.set(from.x + (focus.x - from.x) * u, from.y + (focus.y - from.y) * u - Math.sin(Math.PI * u) * 12)
      shot.rotation = Math.atan2(focus.y - from.y, focus.x - from.x)
      shot.scale.set(.55 + u * .6)
      shot.alpha = Math.min(1, age / .06) * Math.max(0, 1 - Math.max(0, age - .48) / .16) * .85
    } else shot.alpha = 0
    for (const p of billows) {
      const t = time - p.at
      if (t < 0 || t > 1.16) { p.cloud.alpha = 0; continue }
      const bloom = 1 - (1 - Math.min(1, t / .32)) ** 3
      const drift = Math.max(0, t - .32)
      p.cloud.x = focus.x + Math.cos(p.angle) * width * (.08 + bloom * .24 + drift * .11) + Math.sin(p.angle + t * 5) * 5 * bloom
      p.cloud.y = focus.y + Math.sin(p.angle) * height * (.06 + bloom * .24) - drift * 28 + Math.cos(p.angle + t * 4) * 5 * bloom
      p.cloud.rotation = p.angle * .1 + t * p.spin
      p.cloud.scale.set(p.scale * (.25 + bloom * .8 + drift * .16), p.scale * (.25 + bloom * .8) * (1 + Math.sin(t * 6 + p.angle) * .08))
      p.cloud.alpha = Math.min(1, t / .075) * Math.max(0, 1 - drift / .84) * .49
    }
    for (const p of ash) {
      const t = time - p.at
      if (t < 0 || t > .8) { p.fleck.alpha = 0; continue }
      p.fleck.x = focus.x + p.x + p.vx * t + Math.sin(t * 6 + p.phase) * t * 9
      p.fleck.y = focus.y + p.vy * t - t * t * 15
      p.fleck.rotation = p.phase + t * 2
      p.fleck.alpha = Math.sin(Math.PI * t / .8) * .52
    }
  })
  tl.to(attacker, { x: home.x - 5, rotation: -.035, duration: .14 }, 0)
    .to(attacker, { x: home.x, rotation: 0, duration: .24 }, .14)
    .call(() => onCue({ type: 'impact' }), [], .64)
}
