import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Brisk amber spore puffs break apart, then catch in short surface crackles.
export default function stunSpore(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, unit } = bindEffectSpace(context)
  const width = Math.min(174, Math.max(90, context.target.metrics.width / unit * .84))
  const height = Math.min(145, Math.max(76, context.target.metrics.height / unit * .7))
  const spores = new Container(); spores.label = 'stun-spore-seeds'; temporary.addChild(spores)
  const seeds = []
  for (let i = 0; i < 54; i++) {
    const r = 2.2 + random() * 1.8
    const seed = new Graphics().ellipse(0, 0, r * .7, r).fill(i % 3 ? 0xeac657 : 0xc99831)
      .ellipse(-r * .12, -r * .25, r * .22, r * .38).fill(0xfff2b4)
    seed.alpha = 0; spores.addChild(seed)
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random())
    seeds.push({ seed, at: .18 + Math.floor(i / 18) * .14 + i % 18 * .007,
      travel: .56 + i % 3 * .025,
      x: focus.x + Math.cos(angle) * width * .43 * radius,
      y: focus.y + Math.sin(angle) * height * .44 * radius,
      phase: random() * Math.PI * 2, angle, speed: 16 + random() * 18 })
  }
  onFrame(time => {
    const from = socket('emission', true)
    for (const p of seeds) {
      const age = time - p.at
      if (age < 0 || age > p.travel + .78) { p.seed.alpha = 0; continue }
      const u = Math.min(1, age / p.travel), drift = Math.max(0, age - p.travel)
      const spread = Math.sin(Math.PI * u)
      p.seed.x = from.x + (p.x - from.x) * u + Math.cos(p.phase) * spread * 18 + Math.cos(p.angle) * drift * p.speed
      p.seed.y = from.y + (p.y - from.y) * u - spread * 28 + Math.sin(p.phase + u * 5) * spread * 14 + drift * 15
      p.seed.rotation = p.phase + age * 3.2
      p.seed.alpha = Math.min(1, age / .065) * Math.max(0, 1 - drift / .78) * .86
    }
  })
  // Six small jagged catches, staggered rather than a screen-wide lightning flash.
  for (let i = 0; i < 6; i++) {
    const angle = i / 6 * Math.PI * 2
    const x = focus.x + Math.cos(angle) * width * .37
    const y = focus.y + Math.sin(angle) * height * .37
    const crackle = new Graphics()
    for (const [strokeWidth, color, alpha] of [[5, 0xeac34c, .18], [1.6, 0xffec9d, .95]]) {
      crackle.moveTo(-10, -11).lineTo(-3, -3).lineTo(-7, 1).lineTo(5, 4).lineTo(9, 13)
        .stroke({ width: strokeWidth, color, alpha, join: 'round', cap: 'round' })
    }
    crackle.alpha = 0; crackle.position.set(x, y); crackle.rotation = angle * .4
    temporary.addChild(crackle)
    const at = .74 + i * .08
    tl.to(crackle, { alpha: .95, duration: .05 }, at)
      .to(crackle, { alpha: 0, duration: .19 }, at + .1)
      .to(crackle, { alpha: .65, duration: .05 }, at + .42)
      .to(crackle, { alpha: 0, duration: .2 }, at + .49)
  }
  tl.to(attacker, { x: home.x - 4, duration: .14 }, 0)
    .to(attacker, { x: home.x, duration: .16 }, .14)
    .call(() => { onCue({ type: 'impact' }); defender.tint = 0xffe9a6 }, [], .74)
    .to(defender, { x: defenderHome.x + 2, duration: .055, repeat: 3, yoyo: true, ease: 'none' }, .74)
    .call(() => { defender.tint = 0xffffff }, [], 1.03)
    .to(defender, { x: defenderHome.x - 1.5, duration: .065, repeat: 3, yoyo: true, ease: 'none' }, 1.14)
}
