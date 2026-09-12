import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// A light mint veil lifts, slows and rains down; the target gently nods off.
export default function sleepPowder(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, unit } = bindEffectSpace(context)
  const width = Math.min(170, Math.max(86, context.target.metrics.width / unit * .82))
  const height = Math.min(148, Math.max(80, context.target.metrics.height / unit * .72))
  const veil = new Container(), pollen = new Container()
  veil.label = 'sleep-powder-veil'; pollen.label = 'sleep-powder-pollen'
  temporary.addChild(veil, pollen)
  const motes = []
  for (let i = 0; i < 60; i++) {
    const r = 1.5 + random() * 1.8
    const mote = new Graphics().ellipse(0, 0, r, r * .68).fill(i % 3 ? 0xb9efd7 : 0xf0ffe1)
    if (i % 6 === 0) mote.moveTo(-r * 1.7, 0).lineTo(r * 1.7, 0).moveTo(0, -r * 1.7).lineTo(0, r * 1.7).stroke({ color: 0xf0ffe1, width: .8, alpha: .6 })
    mote.alpha = 0; pollen.addChild(mote)
    motes.push({ mote, at: .22 + i * .009, travel: .8 + i % 4 * .018,
      x: focus.x + (random() - .5) * width,
      y: focus.y - height * .4 + random() * height * .34,
      phase: random() * Math.PI * 2, fall: 38 + random() * 32 })
  }
  const wisps = []
  for (let i = 0; i < 4; i++) {
    const wisp = new Sprite(glowTexture); wisp.anchor.set(.5)
    wisp.tint = i % 2 ? 0xc9efd1 : 0x85d4b6; wisp.alpha = 0
    wisp.width = width * .7; wisp.height = height * .48; veil.addChild(wisp)
    wisps.push({ wisp, at: .27 + i * .12 })
  }
  onFrame(time => {
    const from = socket('emission', true)
    for (const p of motes) {
      const age = time - p.at
      if (age < 0 || age > p.travel + .8) { p.mote.alpha = 0; continue }
      const u = Math.min(1, age / p.travel), fall = Math.max(0, age - p.travel)
      const drift = Math.sin(p.phase + age * 3)
      p.mote.x = from.x + (p.x - from.x) * u + drift * Math.sin(Math.PI * u) * 10 + drift * fall * 12
      p.mote.y = from.y + (p.y - from.y) * u - Math.sin(Math.PI * u) * height * .54 + fall * p.fall
      p.mote.rotation = p.phase + Math.sin(age * 3) * .5
      p.mote.alpha = Math.min(1, age / .12) * Math.max(0, 1 - fall / .8) * (.63 + .17 * Math.sin(age * 7 + p.phase))
    }
    for (const p of wisps) {
      const age = time - p.at
      if (age < 0 || age > 1.6) { p.wisp.alpha = 0; continue }
      const u = Math.min(1, age / .85), fall = Math.max(0, age - .85)
      p.wisp.x = from.x + (focus.x - from.x) * u + Math.sin(age * 3 + p.at * 12) * 15 * u
      p.wisp.y = from.y + (focus.y - height * .25 - from.y) * u - Math.sin(Math.PI * u) * height * .45 + fall * 42
      p.wisp.alpha = Math.sin(Math.PI * age / 1.6) * .12
    }
  })
  // Small rising sleep marks stay within the target's silhouette envelope.
  const textFacing = context.target.base('center').x < context.source.base('center').x ? -1 : 1
  for (let i = 0; i < 3; i++) {
    const z = new Graphics().moveTo(-5, -5).lineTo(5, -5).lineTo(-5, 5).lineTo(5, 5)
      .stroke({ color: 0xe0f6dc, width: 1.8, cap: 'round', join: 'round' })
    z.alpha = 0; z.scale.set(textFacing * (.7 + i * .16), .7 + i * .16)
    z.position.set(focus.x + width * .22 + i * 7, focus.y - height * .16)
    temporary.addChild(z)
    const at = 1.16 + i * .22
    tl.to(z, { alpha: .82, duration: .13 }, at)
      .to(z, { x: z.x + 13, y: z.y - 33 - i * 4, duration: .72, ease: 'sine.out' }, at)
      .to(z, { alpha: 0, duration: .25 }, at + .47)
  }
  tl.to(attacker, { rotation: -.025, duration: .22 }, 0)
    .to(attacker, { rotation: 0, duration: .32 }, .22)
    .call(() => onCue({ type: 'impact' }), [], 1.02)
    .to(defender, { y: defenderHome.y + 4, rotation: .025, duration: .4, ease: 'sine.inOut' }, 1.02)
    .to(defender, { y: defenderHome.y, rotation: 0, duration: .58, ease: 'sine.inOut' }, 1.72)
}
