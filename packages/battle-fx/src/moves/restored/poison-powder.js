import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// A rolling, granular violet cloud. All shapes and motion belong to this move.
export default function poisonPowder(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, focus, socket, unit } = bindEffectSpace(context)
  const width = Math.min(178, Math.max(90, context.target.metrics.width / unit * .88))
  const height = Math.min(142, Math.max(74, context.target.metrics.height / unit * .64))
  const haze = new Container(), grains = new Container()
  haze.label = 'poison-powder-haze'; grains.label = 'poison-powder-grains'
  temporary.addChild(haze, grains)
  const particles = []
  for (let i = 0; i < 72; i++) {
    const radius = 1.8 + random() * 2.2
    const grain = new Graphics().circle(0, 0, radius).fill(i % 3 ? 0xc888e9 : 0x8752ba)
      .circle(-radius * .32, -radius * .32, radius * .35).fill(0xf0ceff)
    if (i % 4 === 0) grain.circle(radius * 1.6, -radius, radius * .48).fill(0xb475d7)
    grain.alpha = 0; grains.addChild(grain)
    const angle = random() * Math.PI * 2, spread = Math.sqrt(random())
    particles.push({ grain, at: .24 + i * .009, travel: .66 + i % 5 * .018,
      x: focus.x + Math.cos(angle) * width * .45 * spread,
      y: focus.y + Math.sin(angle) * height * .43 * spread,
      phase: random() * Math.PI * 2, curl: 13 + random() * 14, drift: 8 + random() * 14 })
  }
  // Thin overlapping puffs roll forward and continue churning after contact.
  const puffs = []
  for (let i = 0; i < 7; i++) {
    const puff = new Sprite(glowTexture); puff.anchor.set(.5)
    puff.tint = i % 2 ? 0x8e4bb1 : 0xc578d7
    puff.width = width * (.45 + random() * .15); puff.height = height * .65
    puff.alpha = 0; haze.addChild(puff)
    puffs.push({ puff, at: .3 + i * .065, phase: i * 1.9 })
  }
  onFrame(time => {
    const from = socket('emission', true)
    for (const p of particles) {
      const age = time - p.at
      if (age < 0 || age > p.travel + .64) { p.grain.alpha = 0; continue }
      const u = Math.min(1, age / p.travel), settle = Math.max(0, age - p.travel)
      const curl = Math.sin(Math.PI * u)
      p.grain.x = from.x + (p.x - from.x) * u + Math.sin(p.phase + u * 8) * p.curl * curl + Math.sin(p.phase + settle * 5) * settle * 13
      p.grain.y = from.y + (p.y - from.y) * u - curl * (18 + p.curl) + Math.cos(p.phase + u * 7) * p.curl * curl + settle * p.drift
      p.grain.rotation = p.phase + age * 1.7
      p.grain.alpha = Math.min(1, age / .09) * Math.max(0, 1 - settle / .64) * .82
    }
    for (const p of puffs) {
      const age = time - p.at
      if (age < 0 || age > 1.5) { p.puff.alpha = 0; continue }
      const u = Math.min(1, age / .72), linger = Math.max(0, age - .72)
      p.puff.x = from.x + (focus.x - from.x) * u + Math.sin(p.phase + age * 3) * width * .18 * u
      p.puff.y = from.y + (focus.y - from.y) * u - Math.sin(Math.PI * u) * 30 + Math.cos(p.phase + age * 2.8) * height * .2 * u + linger * 10
      p.puff.rotation = Math.sin(p.phase + age * 2) * .25
      p.puff.alpha = Math.sin(Math.PI * age / 1.5) * .16
    }
  })
  tl.to(attacker, { rotation: -.035, y: home.y - 3, duration: .18 }, 0)
    .to(attacker, { rotation: 0, y: home.y, duration: .3 }, .18)
    .call(() => { onCue({ type: 'impact' }); defender.tint = 0xd5a2e8 }, [], .9)
    .call(() => { defender.tint = 0xffffff }, [], 1.16)
    .call(() => { defender.tint = 0xe8c7f2 }, [], 1.38)
    .call(() => { defender.tint = 0xffffff }, [], 1.62)
}
