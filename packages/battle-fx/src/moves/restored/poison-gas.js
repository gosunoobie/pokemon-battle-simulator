import { Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Thin poisonous vapor curls into a gently circulating, translucent veil.
export default function poisonGas(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, focus, socket, unit } = bindEffectSpace(context)
  const width = Math.min(170, Math.max(86, context.target.metrics.width / unit * .88))
  const height = Math.min(130, Math.max(72, context.target.metrics.height / unit * .64))
  const vapor = [], threads = []
  for (let i = 0; i < 16; i++) {
    const puff = new Sprite(glowTexture); puff.anchor.set(.5); puff.alpha = 0
    puff.tint = i % 3 ? 0xa573c1 : 0xa8b865
    temporary.addChild(puff)
    vapor.push({ puff, at: .24 + i * .04, travel: .74 + i % 3 * .03,
      phase: random() * Math.PI * 2, radius: .15 + random() * .25,
      w: width * (.34 + random() * .15), h: height * (.36 + random() * .2) })
  }
  for (let i = 0; i < 4; i++) {
    const line = new Graphics(); line.label = 'poison-gas-tendril'; line.alpha = 0; temporary.addChild(line)
    threads.push({ line, at: .24 + i * .07, phase: i * 1.7, color: i % 2 ? 0xc29bdb : 0xc1d68e })
  }
  onFrame(time => {
    const from = socket('emission', true)
    for (const p of vapor) {
      const age = time - p.at
      if (age < 0 || age > p.travel + .9) { p.puff.alpha = 0; continue }
      const u = Math.min(1, age / p.travel), linger = Math.max(0, age - p.travel)
      const angle = p.phase + age * 2.9
      p.puff.x = from.x + (focus.x - from.x) * u + Math.sin(angle) * width * p.radius * u
      p.puff.y = from.y + (focus.y - from.y) * u - Math.sin(Math.PI * u) * 24 + Math.cos(angle) * height * p.radius * u - linger * 18
      p.puff.width = p.w * (.38 + u * .62 + linger * .22)
      p.puff.height = p.h * (.5 + u * .5) * (1 + Math.sin(angle) * .13)
      p.puff.rotation = Math.sin(angle) * .35
      p.puff.alpha = Math.min(1, age / .14) * Math.max(0, 1 - linger / .9) * .26
    }
    for (const p of threads) {
      const age = time - p.at
      p.line.clear()
      if (age < 0 || age > 1.72) { p.line.alpha = 0; continue }
      const head = age / .74, start = Math.max(0, Math.min(1, head - .46)), end = Math.min(1, head)
      for (let j = 0; j <= 22; j++) {
        const u = start + (end - start) * j / 22
        const curl = Math.sin(Math.PI * u), angle = p.phase + u * 8 - age * 4
        const x = from.x + (focus.x - from.x) * u + Math.sin(angle) * 7 * curl
        const y = from.y + (focus.y - from.y) * u - curl * 24 + Math.cos(angle) * 15 * curl
        if (j === 0) p.line.moveTo(x, y); else p.line.lineTo(x, y)
      }
      // As the tail catches up, the same vapor curls around the target and rises.
      const coil = Math.max(0, Math.min(1, (age - .63) / .35))
      if (coil > 0) {
        for (let j = 0; j <= 24; j++) {
          const a = p.phase + age * 2.3 + j / 24 * Math.PI * 1.6 * coil
          const x = focus.x + Math.cos(a) * width * .34
          const y = focus.y + Math.sin(a) * height * .22 - Math.max(0, age - .74) * 23
          if (j === 0) p.line.moveTo(x, y); else p.line.lineTo(x, y)
        }
      }
      p.line.stroke({ color: p.color, width: 2.2, alpha: .55, cap: 'round', join: 'round' })
      p.line.alpha = Math.min(1, age / .12) * Math.max(0, 1 - Math.max(0, age - 1.05) / .67)
    }
  })
  tl.to(attacker, { y: home.y - 3, rotation: -.03, duration: .2 }, 0)
    .to(attacker, { y: home.y, rotation: 0, duration: .35 }, .2)
    .call(() => { onCue({ type: 'impact' }); defender.tint = 0xc8a7d8 }, [], .98)
    .call(() => { defender.tint = 0xffffff }, [], 1.2)
    .call(() => { defender.tint = 0xe0c4e9 }, [], 1.48)
    .call(() => { defender.tint = 0xffffff }, [], 1.73)
}
