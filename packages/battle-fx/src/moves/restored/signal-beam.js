import { Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function signalBeam(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const back = Math.max(0, Math.min(6, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(5, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(9, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const r = Math.min(19, Math.max(12, context.target.metrics.height / unit * .09))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 3)
  const lens = new Graphics(); lens.alpha = 0; temporary.addChild(lens)
  const charge = new Sprite(glowTexture); charge.anchor.set(.5); charge.tint = 0xd6f68d; charge.blendMode = 'add'; charge.alpha = 0; temporary.addChild(charge)
  const beam = new Graphics(); beam.label = 'signal-beam-stream'; beam.alpha = 0; temporary.addChild(beam)
  const tip = new Sprite(glowTexture); tip.label = 'signal-beam-tip'; tip.anchor.set(.5); tip.tint = 0xf4f4ba; tip.blendMode = 'add'; tip.alpha = 0; temporary.addChild(tip)
  const burst = new Graphics(); burst.label = 'signal-beam-impact'; burst.alpha = 0; temporary.addChild(burst)
  const packets = [], chips = []
  let impact
  for (let i = 0; i < 16; i++) {
    const g = new Graphics().poly([-6, 0, 0, -2.4, 6, 0, 0, 2.4]).fill(i % 2 ? 0xb8f164 : 0xff777e)
    g.label = `signal-beam-packet-${i}`; g.alpha = 0; temporary.addChild(g)
    packets.push({ g, start: .36 + i * .05, side: i % 2 ? -1 : 1, impact: null })
  }
  for (let i = 0; i < 24; i++) {
    const g = new Graphics().rect(-2, -2, 4, 4).fill(i % 2 ? 0xc5f879 : 0xff8b8c)
    g.alpha = 0; temporary.addChild(g)
    chips.push({ g, angle: i * Math.PI / 12 + (random() - .5) * .15, distance: r * (1.3 + random() * 1.4), life: .36 + random() * .26 })
  }
  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true), reach = Math.max(0, Math.min(1, (time - .36) / .25))
    const head = { x: a.x + (b.x - a.x) * reach, y: a.y + (b.y - a.y) * reach }
    const radius = Math.min(r, room(a) / 1.5), angle = Math.atan2(b.y - a.y, b.x - a.x)
    charge.position.copyFrom(a); charge.width = charge.height = radius * 2.5
    const active = time >= .36 && time < 1.6 ? Math.min(1, (time - .36) * 25) * Math.min(1, (1.6 - time) / .25) : 0
    charge.alpha = time >= .04 && time < 1.6 ? Math.min(1, (time - .04) * 5) * Math.min(1, (1.6 - time) * 4) * .5 : 0
    lens.clear(); lens.position.copyFrom(a); lens.alpha = charge.alpha * 1.6; lens.rotation = time * 4
    for (let i = 0; i < 6; i++) {
      const q = i * Math.PI / 3, q2 = q + Math.PI / 3
      lens.moveTo(Math.cos(q) * radius, Math.sin(q) * radius).lineTo(Math.cos(q2) * radius, Math.sin(q2) * radius)
        .stroke({ width: 2, color: i % 2 ? 0xc1f772 : 0xff8a91, cap: 'round' })
    }
    const width = Math.min(11, room(a), room(b)), amplitude = Math.max(0, Math.min(r * .48, room(a) - width / 2, room(b) - width / 2))
    beam.clear(); beam.alpha = active
    beam.moveTo(a.x, a.y).lineTo(head.x, head.y).stroke({ width: width * .25, color: 0xf6f3c5, alpha: .65, cap: 'round' })
    for (let lane = 0; lane < 2; lane++) for (const [size, alpha] of [[width, .16], [width * .33, .95]]) {
      for (let i = 0; i <= 64; i++) {
        const p = reach * i / 64, y = a.y + (b.y - a.y) * p + Math.sin(p * 30 - time * 24 + lane * Math.PI) * amplitude * Math.sin(p * Math.PI)
        i ? beam.lineTo(a.x + (b.x - a.x) * p, y) : beam.moveTo(a.x, a.y)
      }
      beam.stroke({ width: size, color: lane ? 0xbcf565 : 0xff6975, alpha, cap: 'round' })
    }
    tip.position.copyFrom(head); tip.width = tip.height = Math.min(r * 2.1, room(head) * 2); tip.alpha = active * .9
    for (const p of packets) {
      const age = time - p.start, u = Math.max(0, Math.min(1, age / .25)), end = p.impact ?? b
      const point = { x: a.x + (end.x - a.x) * u, y: a.y + (end.y - a.y) * u + Math.sin(u * Math.PI) * Math.sin(u * 30 - time * 24) * amplitude * p.side }
      p.g.position.copyFrom(point); p.g.rotation = angle; p.g.scale.set(Math.min(1, room(point) / 7))
      p.g.alpha = age >= 0 && age < .35 ? Math.min(1, age * 35) * Math.max(0, 1 - Math.max(0, age - .25) / .1) : 0
    }
    const age = time - .61
    burst.clear(); burst.alpha = impact && age >= 0 && age < .62 ? 1 : 0
    if (impact) {
      burst.position.copyFrom(impact)
      for (let ring = 0; ring < 3; ring++) {
        const u = (age - ring * .065) / .42
        if (u < 0 || u >= 1) continue
        const radius = Math.max(0, Math.min(r * (.7 + u * 1.8), room(impact) - 2))
        for (let j = 0; j < 6; j++) {
          const a = j * Math.PI / 3 + time * (ring % 2 ? -3 : 3)
          burst.moveTo(Math.cos(a) * radius, Math.sin(a) * radius).arc(0, 0, radius, a, a + .66).stroke({ color: j % 2 ? 0xcbf987 : 0xff9098, width: 2 * (1 - u), alpha: (1 - u) * .85 })
        }
      }
    }
    for (const p of chips) {
      const u = age / p.life, distance = impact ? Math.max(0, Math.min(p.distance, room(impact) - 4)) : 0
      p.g.alpha = impact && u >= 0 && u < 1 ? Math.sin(u * Math.PI) * .9 : 0
      if (impact && u >= 0) { p.g.position.set(impact.x + Math.cos(p.angle) * distance * u, impact.y + Math.sin(p.angle) * distance * u); p.g.rotation = p.angle + u * 2 }
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .19 }, 0).to(attacker, { x: home.x + thrust, duration: .15 }, .19)
    .call(() => { update(.36) }, [], .36)
    .call(() => { impact = targetSocket('center', true); update(.61); onCue({ type: 'impact' }); defender.tint = 0xd9edb0 }, [], .61)
    .to(defender, { x: defenderHome.x + recoil, duration: .055, repeat: 5, yoyo: true }, .61)
    .call(() => { defender.tint = 0xffffff }, [], .95)
    .to(attacker, { x: home.x, duration: .33, ease: 'power2.inOut' }, 1.66)
  for (const p of packets) tl.call(() => { p.impact = targetSocket('center', true); update(p.start + .25) }, [], p.start + .25)
}
