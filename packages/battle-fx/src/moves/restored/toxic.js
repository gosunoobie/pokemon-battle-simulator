import { Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Concentrated venom arrives in an arc, then bubbles through three tight pulses.
export default function toxic(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, focus, socket, unit } = bindEffectSpace(context)
  const width = Math.min(146, Math.max(80, context.target.metrics.width / unit * .76))
  const height = Math.min(136, Math.max(76, context.target.metrics.height / unit * .68))
  const drops = [], bubbles = []
  for (let i = 0; i < 11; i++) {
    const r = i === 0 ? 6 : 2.4 + random() * 1.8
    const drop = new Graphics().ellipse(0, 0, r, r * 1.25).fill(i % 3 ? 0x9f3fae : 0xd97ccf)
      .circle(-r * .25, -r * .38, r * .3).fill(0xf2b9e9)
    drop.alpha = 0; temporary.addChild(drop)
    drops.push({ drop, at: .24 + i * .024, phase: random() * 6.28,
      x: focus.x + (random() - .5) * width * .28,
      y: focus.y + (random() - .5) * height * .28 })
  }
  for (let i = 0; i < 25; i++) {
    const r = 2.5 + random() * 3.5
    const bubble = new Graphics().circle(0, 0, r).fill({ color: 0xa344b8, alpha: .42 })
      .circle(0, 0, r).stroke({ color: i % 3 ? 0xd77de0 : 0xf0ace7, width: 1.2, alpha: .9 })
      .circle(-r * .28, -r * .3, r * .23).fill(0xffd5f3)
    bubble.alpha = 0; temporary.addChild(bubble)
    bubbles.push({ bubble, at: .86 + i * .026, life: .52 + random() * .12,
      x: focus.x + (random() - .5) * width * .82,
      y: focus.y + height * (.1 + random() * .2),
      phase: random() * 6.28, rise: height * (.45 + random() * .35) })
  }
  const aura = new Sprite(glowTexture); aura.anchor.set(.5); aura.tint = 0xac3aaf
  aura.position.copyFrom(focus); aura.width = width; aura.height = height; aura.alpha = 0; temporary.addChildAt(aura, 0)
  for (let i = 0; i < 3; i++) {
    const ring = new Graphics().ellipse(0, 0, width * .39, height * .16)
      .stroke({ color: i % 2 ? 0xf0a2e3 : 0xc067d6, width: 2.3, alpha: .82 })
    ring.position.set(focus.x, focus.y + height * (.23 - i * .19)); ring.scale.set(.45); ring.alpha = 0
    temporary.addChild(ring)
    const at = .86 + i * .23
    tl.to(ring, { alpha: .8, duration: .07 }, at)
      .to(ring.scale, { x: 1.2, y: 1.12, duration: .46, ease: 'power2.out' }, at)
      .to(ring, { y: ring.y - height * .18, duration: .5, ease: 'sine.out' }, at)
      .to(ring, { alpha: 0, duration: .33 }, at + .14)
  }
  onFrame(time => {
    const from = socket('emission', true)
    for (const p of drops) {
      const age = time - p.at
      if (age < 0 || age > .83) { p.drop.alpha = 0; continue }
      const u = Math.min(1, age / .62), settle = Math.max(0, age - .62)
      p.drop.x = from.x + (p.x - from.x) * u + Math.sin(p.phase) * Math.sin(Math.PI * u) * 5
      p.drop.y = from.y + (p.y - from.y) * u - Math.sin(Math.PI * u) * height * .35 + settle * 21
      p.drop.rotation = Math.atan2(p.y - from.y - Math.cos(Math.PI * u) * height * .35 * Math.PI, p.x - from.x) - Math.PI / 2
      p.drop.alpha = Math.min(1, age / .06) * Math.max(0, 1 - settle / .21) * .9
    }
    for (const p of bubbles) {
      const age = time - p.at
      if (age < 0 || age > p.life) { p.bubble.alpha = 0; continue }
      const u = age / p.life
      p.bubble.x = p.x + Math.sin(p.phase + u * 6) * 7 * u
      p.bubble.y = p.y - p.rise * u
      p.bubble.scale.set(.55 + u * .75)
      p.bubble.alpha = Math.sin(Math.PI * u) * .85
    }
    const age = time - .82
    aura.alpha = age >= 0 && age <= 1.2 ? Math.sin(Math.PI * age / 1.2) * (.12 + Math.sin(age * 14) ** 2 * .11) : 0
    aura.width = width * (1 + Math.sin(time * 9) * .05)
    aura.height = height * (1 + Math.cos(time * 8) * .06)
  })
  tl.to(attacker, { rotation: -.04, y: home.y - 3, duration: .22 }, 0)
    .to(attacker, { rotation: 0, y: home.y, duration: .3 }, .22)
    .call(() => { onCue({ type: 'impact' }); defender.tint = 0xc581d0 }, [], .86)
    .call(() => { defender.tint = 0xffffff }, [], 1.06)
    .call(() => { defender.tint = 0xdba3db }, [], 1.3)
    .call(() => { defender.tint = 0xffffff }, [], 1.51)
}
