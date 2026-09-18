import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Local review variation of restored/solar-beam.js. Keep the green/gold charging
// orb, inward motes, three beam layers and expanding receiving ring; extend the
// live beam and its cosmetic impact flow without adding another result.
export const timing = Object.freeze({ contact: 1.26, duration: 3.8, markers: Object.freeze([
  { id: 'charge', label: 'Solar orb charge', timeSeconds: .06 },
  { id: 'launch', label: 'Solar beam launch', timeSeconds: 1.14 },
  { id: 'pulse-one', label: 'Cosmetic solar impact pulse', timeSeconds: 2.0525 },
  { id: 'pulse-main', label: 'Strong cosmetic solar impact pulse', timeSeconds: 2.6375 },
  { id: 'pulse-last', label: 'Cosmetic solar impact pulse', timeSeconds: 2.7725 },
  { id: 'beam-fade', label: 'Solar beam cutoff', timeSeconds: 3.4 },
  { id: 'return', label: 'Return after beam cutoff', timeSeconds: 3.56 },
]) })

export default function solarBeam(context) {
  const { tl, glowTexture, random, onCue, onFrame } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, world, unit } = bindEffectSpace(context)
  const launchAt = 1.14, contact = timing.contact, cutoff = 3.4, cleared = 3.56
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges)
  const top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const sourceHalf = context.source.metrics.width / (2 * unit), targetHalf = context.target.metrics.width / (2 * unit)
  const back = Math.max(0, Math.min(12, center.x - sourceHalf - left - 2))
  const thrust = Math.max(0, Math.min(10, right - center.x - sourceHalf - 2))
  const recoil = Math.max(0, Math.min(18, right - receiver.x - targetHalf - 2))
  const shake = Math.max(0, Math.min(2, center.x - sourceHalf - left, right - center.x - sourceHalf,
    receiver.x - targetHalf - left, right - receiver.x - targetHalf,
    center.y - context.source.metrics.height / (2 * unit) - top,
    receiver.y - context.target.metrics.height / (2 * unit) - top))
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 2)
  const fit = (node, point, extent, scale = 1) => { node.position.copyFrom(point); node.scale.set(Math.min(scale, room(point) / extent)) }
  const glow = (parent, width, height, tint, label) => {
    const s = new Sprite(glowTexture); s.anchor.set(.5); s.width = width; s.height = height
    s.tint = tint; s.blendMode = 'add'; s.alpha = 0; s.label = label; parent.addChild(s); return s
  }
  const charge = new Container(); charge.label = 'solar-beam-review-charge'; temporary.addChild(charge)
  const orb = new Container(); orb.label = 'solar-beam-review-orb'; charge.addChild(orb)
  for (const [size, tint] of [[145, 0x91ce4b], [86, 0xf3ef83], [32, 0xffffe6]]) {
    glow(orb, size, size, tint, 'solar-beam-review-orb-layer').alpha = 1
  }
  const chargeRing = new Graphics().circle(0, 0, 52).stroke({ color: 0xeafa9b, width: 2, alpha: .65 })
  chargeRing.label = 'solar-beam-review-charge-ring'; charge.addChild(chargeRing)
  const motes = Array.from({ length: 18 }, (_, i) => ({
    sprite: glow(charge, 9 + (i % 3) * 3, 9 + (i % 3) * 3, i % 2 ? 0xeafa9b : 0xfff5ac, `solar-beam-review-mote-${i}`),
    angle: i * Math.PI * 2 / 18, radius: 70 + (i % 3) * 20, at: .08 + i * .036,
  }))
  const beam = new Graphics(); beam.label = 'solar-beam-review-beam'; beam.blendMode = 'add'; temporary.addChild(beam)
  const tip = new Container(); tip.label = 'solar-beam-review-tip'; temporary.addChild(tip)
  const impactGlow = new Container(); impactGlow.label = 'solar-beam-review-impact-glow'; temporary.addChild(impactGlow)
  glow(impactGlow, 330, 240, context.tint, 'solar-beam-review-impact-glow-art').alpha = 1
  const ring = new Graphics().circle(0, 0, 42).stroke({ width: 3, color: 0xf1f7ac, alpha: .8 })
  ring.label = 'solar-beam-review-ring'; temporary.addChild(ring)
  const flare = new Graphics(); flare.label = 'solar-beam-review-target-sparks'; flare.blendMode = 'add'; temporary.addChild(flare)
  const glints = Array.from({ length: 18 }, (_, i) => glow(temporary, 5 + i % 3, 5 + i % 3, i % 2 ? 0xeafa9b : 0xffffdf, `solar-beam-review-glint-${i}`))
  const pulses = [{ at: contact, strength: .7, count: 38 }, { at: 2.0525, strength: .65, count: 26 }, { at: 2.6375, strength: 1, count: 46 }, { at: 2.7725, strength: .8, count: 30 }]
  const sparks = pulses.flatMap((pulse, burst) => Array.from({ length: pulse.count }, (_, i) => ({
    sprite: glow(temporary, 1, 1, i % 3 ? context.tint : 0xffffe6, `solar-beam-review-spark-${burst}-${i}`),
    at: pulse.at, angle: random() * Math.PI * 2, velocity: 210 * (.4 + random() * .6),
    life: .35 + random() * .35, size: 7 + random() * 15, origin: null,
  })))
  function update(time) {
    const mouth = socket('emission', true), target = targetSocket('center', true)
    const fade = 1 - clamp((time - cutoff) / (cleared - cutoff)), firing = time >= launchAt && time < cleared
    // The original 18 inward motes and ring share the live mouth transform.
    fit(charge, mouth, 118)
    charge.alpha = fade
    orb.scale.set(.1 + .9 * clamp((time - .06) / .9) ** 2)
    orb.alpha = clamp((time - .06) / .3) * (time > contact ? .82 + .06 * Math.sin(time * 15) : .9)
    chargeRing.scale.set(1.45 - .95 * clamp((time - .14) / .82))
    chargeRing.alpha = clamp((time - .14) / .12) * (1 - clamp((time - .84) / .15))
    for (const mote of motes) {
      const age = time - mote.at, p = clamp(age / .28), radius = mote.radius * (1 - p ** 2)
      mote.sprite.position.set(Math.cos(mote.angle) * radius, Math.sin(mote.angle) * radius)
      mote.sprite.alpha = age >= 0 ? .9 * clamp(age / .06) * (1 - clamp((age - .24) / .06)) : 0
    }
    const angle = Math.atan2(target.y - mouth.y, target.x - mouth.x)
    const length = Math.hypot(target.x - mouth.x, target.y - mouth.y)
    const extension = 1 - (1 - clamp((time - launchAt) / (contact - launchAt))) ** 4
    const end = { x: mouth.x + (target.x - mouth.x) * extension, y: mouth.y + (target.y - mouth.y) * extension }
    const pressure = (.94 + .06 * Math.sin(Math.max(0, time - contact) * Math.PI / .16)) * fade
    const axisProjection = Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle))
    const widthScale = Math.min(1, room(mouth) / (40 * axisProjection), room(end) / (40 * axisProjection))
    beam.clear(); beam.position.copyFrom(mouth); beam.rotation = angle; beam.alpha = firing ? .85 * clamp((time - launchAt) / .04) * fade : 0
    for (const [width, color, alpha] of [[80, 0x92ce4b, .13], [42, 0xe7ed78, .55], [12, 0xffffdf, .95]]) {
      beam.moveTo(0, 0).lineTo(length * extension, 0).stroke({ width: Math.max(.001, width * pressure * widthScale), color, alpha, cap: 'round' })
    }
    tip.position.copyFrom(end); tip.alpha = beam.alpha
    // Ongoing glints use elapsed recipe time and the current nozzle/receiver.
    for (const [i, glint] of glints.entries()) {
      const phase = ((Math.max(0, time - launchAt) * 1.65 + i / glints.length) % 1)
      const p = { x: mouth.x + (end.x - mouth.x) * phase, y: mouth.y + (end.y - mouth.y) * phase }
      glint.position.copyFrom(p); glint.rotation = angle
      const size = 5 + i % 3, safe = Math.min(1, room(p) / (size * .71))
      glint.width = glint.height = size * safe
      glint.alpha = firing ? .8 * Math.sin(phase * Math.PI) * fade : 0
    }
    const livePulse = pulses.reduce((sum, pulse) => time >= pulse.at ? sum + pulse.strength * (1 - clamp((time - pulse.at) / .36)) : sum, 0)
    const active = time >= contact && time < cleared
    fit(impactGlow, target, 165); impactGlow.alpha = active ? Math.min(.72, .2 + livePulse * .52) * fade : 0
    const lastPulse = [...pulses].reverse().find(pulse => time >= pulse.at)
    const pulseAge = lastPulse ? time - lastPulse.at : -1
    const ringProgress = clamp(pulseAge / .42)
    fit(ring, target, 44, 1 + 1.1 * (1 - (1 - ringProgress) ** 2))
    ring.alpha = pulseAge >= 0 ? .65 * (1 - clamp((pulseAge - .1) / .32)) * fade : 0
    flare.clear(); flare.rotation = time * .17
    fit(flare, target, 76 * (Math.abs(Math.cos(flare.rotation)) + Math.abs(Math.sin(flare.rotation))))
    flare.alpha = active ? Math.min(.8, .22 + livePulse * .58) * fade : 0
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + Math.sin(time * 6 + i) * .045, inner = 23 + 4 * Math.sin(time * 11 + i)
      const outer = inner + 15 + 25 * Math.max(0, Math.sin(time * 14 + i * 1.9))
      flare.moveTo(Math.cos(a) * inner, Math.sin(a) * inner).lineTo(Math.cos(a) * outer, Math.sin(a) * outer)
        .stroke({ color: i % 3 ? 0xeafa9b : 0xffffe6, width: i % 2 ? 2 : 3, alpha: .8, cap: 'round' })
    }
    for (const spark of sparks) {
      const age = time - spark.at, q = clamp(age / spark.life)
      if (age >= 0 && !spark.origin) spark.origin = { ...target }
      const origin = spark.origin ?? target, distance = Math.min(spark.velocity * spark.life, Math.max(0, room(origin) - 28))
      const p = { x: origin.x + Math.cos(spark.angle) * distance * q, y: origin.y + Math.sin(spark.angle) * distance * q + Math.sin(spark.angle + Math.max(0, age) * 22) * 4 * q }
      spark.sprite.position.copyFrom(p); spark.sprite.rotation = spark.angle
      const width = spark.size * (1 + q * .2) * 1.6, height = spark.size * (1 + q * .2) * .75
      const safe = Math.min(1, room(p) / (Math.hypot(width, height) / 2))
      spark.sprite.width = width * safe; spark.sprite.height = height * safe
      spark.sprite.alpha = age >= 0 && age < spark.life ? Math.min(1, age * 20) * (1 - q) ** .65 : 0
    }
  }
  onFrame(update); update(0)
  tl.to(attacker, { x: home.x - back, duration: .32 }, 0)
    .to(attacker, { x: home.x + thrust, duration: .14, ease: 'power2.out' }, 1)
    .call(() => { update(contact); onCue({ type: 'impact' }); defender.tint = context.tint }, [], contact)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 7, yoyo: true, ease: 'none' }, contact)
    .to(world, { x: shake, y: -shake / 2, duration: .06, repeat: 7, yoyo: true, ease: 'none' }, contact)
    .call(() => { defender.tint = 0xffffff }, [], contact + .24)
    .set(defender, { x: defenderHome.x }, contact + .5)
    .set(world, { x: 0, y: 0 }, contact + .5)
    .to(attacker, { x: home.x, duration: .24 }, cleared)
    .call(() => {}, [], timing.duration)
}
