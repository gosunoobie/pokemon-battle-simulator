import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Local review variation of restored/fire-blast.js: the charged orb, five blazing
// rays and expanding ring retain their move-owned artwork. Timing is presentation.
export const timing = Object.freeze({ contact: 2.0225, duration: 3.15, markers: Object.freeze([
  { id: 'windup', label: 'Delayed fire windup', timeSeconds: .9725 },
  { id: 'charge', label: 'Fire orb charge', timeSeconds: 1.1525 },
  { id: 'launch', label: 'Fire orb launch', timeSeconds: 1.5425 },
  { id: 'blast-fade', label: 'Five-ray fire fade', timeSeconds: 2.4425 },
]) })

export default function fireBlast(context) {
  const { tl, glowTexture, random, onCue, onFrame } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, world, unit } = bindEffectSpace(context)
  const contact = timing.contact, launchAt = 1.5425, chargeAt = 1.1525
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges)
  const top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const sourceHalf = context.source.metrics.width / (2 * unit), targetHalf = context.target.metrics.width / (2 * unit)
  const back = Math.max(0, Math.min(22, center.x - sourceHalf - left - 2))
  const thrust = Math.max(0, Math.min(14, right - center.x - sourceHalf - 2))
  const recoil = Math.max(0, Math.min(23, right - receiver.x - targetHalf - 2))
  const shake = Math.max(0, Math.min(2, center.x - sourceHalf - left, right - center.x - sourceHalf,
    receiver.x - targetHalf - left, right - receiver.x - targetHalf,
    center.y - context.source.metrics.height / (2 * unit) - top,
    receiver.y - context.target.metrics.height / (2 * unit) - top))
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 2)
  const fit = (node, point, extent, scale = 1) => { node.position.copyFrom(point); node.scale.set(Math.min(scale, room(point) / extent)) }
  const glow = (parent, width, height, tint, label) => {
    const sprite = new Sprite(glowTexture); sprite.anchor.set(.5); sprite.width = width; sprite.height = height
    sprite.tint = tint; sprite.blendMode = 'add'; sprite.alpha = 0; sprite.label = label; parent.addChild(sprite); return sprite
  }
  // Bounds fitting happens on wrapper containers, preserving each glow's aspect.
  const glowAt = (width, height, tint, label) => {
    const wrapper = new Container(); wrapper.label = label; temporary.addChild(wrapper)
    const sprite = glow(wrapper, width, height, tint, `${label}-art`); sprite.alpha = 1
    return wrapper
  }
  const impactGlow = glowAt(420, 340, context.tint, 'fire-blast-review-impact-glow')
  const mouthGlow = glowAt(150, 150, 0xff6c1d, 'fire-blast-review-mouth')
  const orb = new Container(); orb.label = 'fire-blast-review-orb'; temporary.addChild(orb)
  for (const [size, tint] of [[145, 0xff3a0c], [95, 0xffa125], [43, 0xfff4b5]]) {
    glow(orb, size, size, tint, 'fire-blast-review-orb-layer').alpha = 1
  }
  const blast = new Container(); blast.label = 'fire-blast-review-five-rays'; temporary.addChild(blast)
  const tips = [[0, -105], [-112, -22], [112, -22], [-78, 96], [78, 96]]
  for (const [x, y] of tips) {
    const ray = new Graphics()
    for (const [width, color, alpha] of [[38, 0xff4917, .25], [19, 0xff9b24, .8], [6, 0xfff5b6, 1]]) {
      ray.moveTo(0, 0).lineTo(x, y).stroke({ width, color, alpha, cap: 'round' })
    }
    blast.addChild(ray)
  }
  const ring = new Graphics().circle(0, 0, 66).stroke({ width: 5, color: 0xffbd68, alpha: .85 })
  ring.label = 'fire-blast-review-ring'; temporary.addChild(ring)
  const sparks = Array.from({ length: 70 }, (_, i) => {
    const sprite = glow(temporary, 1, 1, 0xffa733, `fire-blast-review-ember-${i}`)
    const angle = random() * Math.PI * 2, velocity = 330 * (.4 + random() * .6)
    return { sprite, angle, velocity, life: .35 + random() * .35, size: 7 + random() * 15 }
  })
  let origin, impact
  function update(time) {
    const mouth = socket('emission', true), target = targetSocket('center', true)
    fit(mouthGlow, mouth, 75); mouthGlow.alpha = time < 1.0725 ? 0 : .9 * clamp((time - 1.0725) / .4) * (1 - clamp((time - 1.6525) / .25))
    const flight = clamp((time - launchAt) / (contact - launchAt)), progress = flight ** 2
    const from = origin ?? mouth, aim = impact ?? target
    const point = time <= launchAt ? mouth : { x: from.x + (aim.x - from.x) * progress, y: from.y + (aim.y - from.y) * progress }
    const grow = time < launchAt ? .2 + .6 * clamp((time - chargeAt) / .4) : .8 + .45 * flight
    fit(orb, point, 73, grow)
    orb.alpha = time < chargeAt ? 0 : clamp((time - chargeAt) / .28) * (1 - clamp((time - contact) / .025))
    const age = time - contact, fade = 1 - clamp((age - .42) / .58)
    fit(blast, target, 134, .2 + .85 * (1 - (1 - clamp(age / .25)) ** 3) + .2 * clamp((age - .42) / .58))
    blast.alpha = age >= 0 ? fade : 0
    fit(impactGlow, target, 210); impactGlow.alpha = age >= 0 ? .8 * (1 - clamp((age - .3) / .65)) : 0
    fit(ring, target, 69, 1 + 1.5 * (1 - (1 - clamp(age / .5)) ** 2))
    ring.alpha = age >= 0 ? .8 * (1 - clamp((age - .09) / .42)) : 0
    for (const s of sparks) {
      const q = clamp(age / s.life), distance = Math.min(s.velocity * s.life, Math.max(0, room(aim) - 28))
      const p = { x: aim.x + Math.cos(s.angle) * distance * q, y: aim.y + Math.sin(s.angle) * distance * q + Math.sin(s.angle + Math.max(0, age) * 22) * 4 * q }
      s.sprite.position.copyFrom(p); s.sprite.rotation = s.angle
      const width = s.size * (1 + q * .2) * 1.6, height = s.size * (1 + q * .2) * .75
      const scale = Math.min(1, room(p) / (Math.hypot(width, height) / 2))
      s.sprite.width = width * scale; s.sprite.height = height * scale
      s.sprite.alpha = age >= 0 && age < s.life ? Math.min(1, age * 20) * (1 - q) ** .65 : 0
    }
  }
  onFrame(update); update(0)
  tl.to(attacker, { x: home.x - back, duration: .35, ease: 'power2.inOut' }, .9725)
    .to(attacker, { x: home.x + thrust, duration: .17, ease: 'power3.out' }, 1.3725)
    .call(() => { origin = socket('emission', true); update(launchAt) }, [], launchAt)
    .call(() => { impact = targetSocket('center', true); update(contact); onCue({ type: 'impact' }); defender.tint = context.tint }, [], contact)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 7, yoyo: true, ease: 'none' }, contact)
    .to(world, { x: shake, y: -shake / 2, duration: .06, repeat: 7, yoyo: true, ease: 'none' }, contact)
    .call(() => { defender.tint = 0xffffff }, [], contact + .24)
    .set(defender, { x: defenderHome.x }, contact + .5)
    .set(world, { x: 0, y: 0 }, contact + .5)
    .to(attacker, { x: home.x, duration: .3 }, contact + .7)
    .call(() => {}, [], timing.duration)
}
