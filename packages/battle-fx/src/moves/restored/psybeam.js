import { Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function psybeam(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(5, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const r = Math.min(25, Math.max(16, context.target.metrics.height / unit * .12))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 3)
  const charge = new Sprite(glowTexture); charge.anchor.set(.5); charge.tint = 0xba83f4; charge.blendMode = 'add'; charge.alpha = 0; temporary.addChild(charge)
  const swirl = new Graphics(); swirl.alpha = 0; temporary.addChild(swirl)
  const beam = new Graphics(); beam.label = 'psybeam-stream'; beam.alpha = 0; temporary.addChild(beam)
  const tip = new Sprite(glowTexture); tip.label = 'psybeam-tip'; tip.anchor.set(.5); tip.tint = 0xf5ccff; tip.blendMode = 'add'; tip.alpha = 0; temporary.addChild(tip)
  const rings = new Graphics(); rings.label = 'psybeam-impact'; rings.alpha = 0; temporary.addChild(rings)
  const pulses = [], motes = []
  let impact
  for (let i = 0; i < 10; i++) {
    const g = new Graphics(); g.label = `psybeam-pulse-${i}`; g.alpha = 0; temporary.addChild(g)
    pulses.push({ g, start: .42 + i * .075, impact: null, color: i % 2 ? 0xf1a8e7 : 0xb39afa })
  }
  for (let i = 0; i < 22; i++) {
    const g = new Graphics().poly([-3, 0, 0, -3, 3, 0, 0, 3]).fill(i % 2 ? 0xf3b2ef : 0xc5b7ff)
    g.alpha = 0; temporary.addChild(g)
    motes.push({ g, angle: random() * Math.PI * 2, distance: r * (1.1 + random() * 1.2), life: .38 + random() * .3 })
  }
  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true), reach = Math.max(0, Math.min(1, (time - .42) / .26))
    const head = { x: a.x + (b.x - a.x) * reach, y: a.y + (b.y - a.y) * reach }
    const width = Math.min(18, room(a) * 1.4, room(b) * 1.4)
    const amplitude = Math.max(0, Math.min(r * .32, room(a) - width / 2, room(b) - width / 2))
    charge.position.copyFrom(a); charge.width = charge.height = Math.min(r * 2.6, room(a) * 2)
    charge.alpha = time >= .06 && time < 1.7 ? Math.min(1, (time - .06) * 4) * Math.min(1, (1.7 - time) * 4) * .52 : 0
    swirl.clear(); swirl.position.copyFrom(a); swirl.alpha = charge.alpha
    for (let i = 0; i < 3; i++) {
      const radius = Math.max(0, Math.min(r * (.52 + i * .14), room(a) - 1.5)), angle = time * 7 + i * 2.1
      swirl.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius).arc(0, 0, radius, angle, angle + 1.65).stroke({ width: 2, color: i === 1 ? 0xf8b5ed : 0xbca3ff, cap: 'round' })
    }
    const active = time >= .42 && time < 1.7 ? Math.min(1, (time - .42) * 20) * Math.min(1, (1.7 - time) / .28) : 0
    beam.clear(); beam.alpha = active
    for (const [size, color, alpha, phase] of [[width, 0x9464e6, .22, 0], [width * .42, 0xbf8df0, .85, 0], [width * .16, 0xf4c9f4, 1, 1.3]]) {
      for (let i = 0; i <= 48; i++) {
        const p = reach * i / 48, y = a.y + (b.y - a.y) * p + Math.sin(p * Math.PI) * Math.sin(p * 19 - time * 17 + phase) * amplitude
        i ? beam.lineTo(a.x + (b.x - a.x) * p, y) : beam.moveTo(a.x, a.y)
      }
      beam.stroke({ width: size, color, alpha, cap: 'round' })
    }
    tip.position.copyFrom(head); tip.width = tip.height = Math.min(r * 1.8, room(head) * 2); tip.alpha = active * .85
    for (const p of pulses) {
      const age = time - p.start, u = Math.max(0, Math.min(1, age / .26)), end = p.impact ?? b
      const at = { x: a.x + (end.x - a.x) * u, y: a.y + (end.y - a.y) * u }
      const size = Math.max(0, Math.min(r * (.44 + u * .5), room(at) - 2))
      p.g.clear().ellipse(0, 0, size * .3, size).stroke({ width: 2, color: p.color, alpha: .85 })
        .ellipse(0, 0, size * .16, size * .68).stroke({ width: 1, color: 0xf9e4ff, alpha: .7 })
      p.g.position.copyFrom(at); p.g.rotation = Math.atan2(end.y - a.y, end.x - a.x)
      p.g.alpha = age >= 0 && age < .4 ? Math.min(1, age * 25) * Math.max(0, 1 - Math.max(0, age - .26) / .14) : 0
    }
    rings.clear(); const hitAge = time - .68
    rings.alpha = impact && hitAge >= 0 && hitAge < .72 ? 1 : 0
    if (impact) {
      rings.position.copyFrom(impact)
      for (let i = 0; i < 3; i++) {
        const u = (hitAge - i * .09) / .5
        if (u < 0 || u >= 1) continue
        const radius = Math.max(0, Math.min(r * (.6 + u * 1.35), room(impact) - 2))
        rings.ellipse(0, 0, radius * (.7 + .15 * Math.sin(time * 8 + i)), radius).stroke({ width: 2 * (1 - u), color: i % 2 ? 0xf2b0e7 : 0xbca5ff, alpha: (1 - u) * .8 })
      }
    }
    for (const p of motes) {
      const u = hitAge / p.life, distance = impact ? Math.max(0, Math.min(p.distance, room(impact) - 5)) : 0
      p.g.alpha = impact && u >= 0 && u < 1 ? Math.sin(u * Math.PI) * .85 : 0
      if (impact && u >= 0) { p.g.position.set(impact.x + Math.cos(p.angle) * distance * u, impact.y + Math.sin(p.angle) * distance * u); p.g.rotation = p.angle + u }
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .23 }, 0).to(attacker, { x: home.x + thrust, duration: .16 }, .23)
    .call(() => { update(.42) }, [], .42)
    .call(() => { impact = targetSocket('center', true); update(.68); onCue({ type: 'impact' }); defender.tint = 0xc6a1f0 }, [], .68)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 5, yoyo: true }, .68)
    .call(() => { defender.tint = 0xffffff }, [], 1.04)
    .to(attacker, { x: home.x, duration: .32, ease: 'power2.inOut' }, 1.78)
  for (const p of pulses) tl.call(() => { p.impact = targetSocket('center', true); update(p.start + .26) }, [], p.start + .26)
}
