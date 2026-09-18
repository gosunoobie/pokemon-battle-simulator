import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Second-review addition to the independent restored Overheat: keep its three
// expanding heat crests, then send three more across the later measured crests.
// The new arrivals are cosmetic; the first arrival remains the only result cue.
export const timing = Object.freeze({ contact: .98, duration: 2.5, markers: Object.freeze([
  { id: 'launch', label: 'First heat wave launches', timeSeconds: .58 },
  { id: 'wave-four-impact', label: 'Fourth heat wave arrives', timeSeconds: 1.516 },
  { id: 'wave-five-impact', label: 'Fifth heat wave arrives', timeSeconds: 1.988 },
  { id: 'wave-six-impact', label: 'Sixth heat wave arrives', timeSeconds: 2.124 },
  { id: 'final-launch', label: 'Sixth heat wave launches', timeSeconds: 1.724 },
  { id: 'return', label: 'Return after the last heat wave', timeSeconds: 2.18 },
]) })

export default function overheat(context) {
  const { tl, glowTexture, random, onCue, onFrame } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, world, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges)
  const top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const sourceHalf = context.source.metrics.width / (2 * unit), targetHalf = context.target.metrics.width / (2 * unit)
  const back = Math.max(0, Math.min(16, center.x - sourceHalf - left - 2))
  const thrust = Math.max(0, Math.min(12, right - center.x - sourceHalf - 2))
  const recoil = Math.max(0, Math.min(21, right - receiver.x - targetHalf - 2))
  const shake = Math.max(0, Math.min(2, center.x - sourceHalf - left, right - center.x - sourceHalf,
    receiver.x - targetHalf - left, right - receiver.x - targetHalf,
    center.y - context.source.metrics.height / (2 * unit) - top,
    receiver.y - context.target.metrics.height / (2 * unit) - top))
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 2)
  const fit = (node, point, extent, x = 1, y = x) => {
    node.position.copyFrom(point); const safe = Math.min(1, room(point) / (extent * Math.max(x, y)))
    node.scale.set(x * safe, y * safe)
  }
  const glow = (parent, width, height, tint, alpha = 1, label = '') => {
    const sprite = new Sprite(glowTexture); sprite.anchor.set(.5); sprite.width = width; sprite.height = height
    sprite.tint = tint; sprite.alpha = alpha; sprite.blendMode = 'add'; sprite.label = label; parent.addChild(sprite); return sprite
  }
  const aura = new Container(); aura.label = 'overheat-review-aura'; temporary.addChild(aura)
  const sourceRatio = context.source.metrics.height / 229.114583333333 / unit
  glow(aura, 205 * sourceRatio, 265 * sourceRatio, 0xff4a18)
  const impactGlow = new Container(); impactGlow.label = 'overheat-review-impact-glow'; temporary.addChild(impactGlow)
  glow(impactGlow, 380, 280, context.tint)
  const arrivals = [.98, 1.07, 1.16, 1.516, 1.988, 2.124]
  const waves = arrivals.map((arrival, i) => {
    const wave = new Container(); wave.label = `overheat-review-wave-${i + 1}`; temporary.addChild(wave)
    glow(wave, 120, 160, i % 3 === 1 ? 0xffa62f : 0xff571c, .5)
    const crest = new Graphics(); crest.label = `overheat-review-crest-${i + 1}`
    for (const [width, color, alpha] of [[32, 0xff4817, .24], [12, 0xffa62f, .8], [4, 0xfff1ad, 1]]) {
      crest.moveTo(-10, -65).quadraticCurveTo(62, 0, -10, 65).stroke({ width, color, alpha, cap: 'round' })
    }
    wave.addChild(crest)
    return { wave, at: arrival - .4, arrival, origin: null, impact: null }
  })
  const smoke = Array.from({ length: 4 }, (_, i) => {
    const sprite = glow(temporary, 42, 42, 0xb9aaa0, 0, `overheat-review-smoke-${i}`); sprite.blendMode = 'normal'
    return { sprite, at: 2.06 + i * .05, index: i, origin: null }
  })
  const sparks = arrivals.flatMap((at, wave) => Array.from({ length: wave ? 22 : 50 }, (_, i) => ({
    sprite: glow(temporary, 1, 1, 0xffb151, 0, `overheat-review-spark-${wave + 1}-${i}`),
    at, angle: random() * Math.PI * 2, velocity: 260 * (.4 + random() * .6),
    life: wave === 5 ? .2 + random() * .14 : .24 + random() * .25, size: 7 + random() * 15,
    origin: null,
  })))
  function update(time) {
    const mouth = socket('emission', true), target = targetSocket('center', true)
    fit(aura, socket('aura', true), 132.5 * sourceRatio)
    aura.alpha = .55 * clamp((time - .05) / .45) * (1 - clamp((time - 1.78) / .4))
    for (const wave of waves) {
      const age = time - wave.at, q = clamp(age / .4), travel = q * q
      if (age >= 0 && !wave.origin) wave.origin = { ...mouth }
      if (time >= wave.arrival && !wave.impact) wave.impact = { ...target }
      const from = wave.origin ?? mouth, aim = wave.impact ?? target
      const point = { x: from.x + (aim.x - from.x) * travel, y: from.y + (aim.y - from.y) * travel }
      fit(wave.wave, point, 82, .4 + 1.1 * q, .45 + 1.1 * q)
      wave.wave.alpha = age >= 0 ? .9 * clamp(age / .05) * (1 - clamp((time - wave.arrival) / .32)) : 0
    }
    const power = arrivals.reduce((sum, at) => time >= at ? sum + (1 - clamp((time - at) / .24)) : sum, 0)
    fit(impactGlow, target, 190); impactGlow.alpha = Math.min(.75, power * .68)
    for (const s of smoke) {
      const age = time - s.at, q = clamp(age / .25)
      if (age >= 0 && !s.origin) {
        const p = socket('smoke', true)
        s.origin = { x: p.x + Math.min(s.index * 14, Math.max(0, right - p.x - 44)), y: p.y }
      }
      const p = s.origin ?? socket('smoke', true)
      const point = { x: p.x + Math.min(18, Math.max(0, right - p.x - 43)) * q, y: p.y - Math.min(55, Math.max(0, p.y - top - 43)) * q }
      s.sprite.position.copyFrom(point)
      const size = 42 + 40 * q, safe = Math.min(1, room(point) / (size / 2))
      s.sprite.width = s.sprite.height = size * safe
      s.sprite.alpha = age >= 0 && age < .25 ? .17 * clamp(age / .06) * (1 - clamp((age - .07) / .18)) : 0
    }
    for (const s of sparks) {
      const age = time - s.at, q = clamp(age / s.life)
      if (age >= 0 && !s.origin) s.origin = { ...target }
      const origin = s.origin ?? target, reach = Math.min(s.velocity * s.life, Math.max(0, room(origin) - 28))
      const point = { x: origin.x + Math.cos(s.angle) * reach * q, y: origin.y + Math.sin(s.angle) * reach * q + Math.sin(s.angle + Math.max(0, age) * 22) * 4 * q }
      s.sprite.position.copyFrom(point); s.sprite.rotation = s.angle
      const width = s.size * (1 + q * .2) * 1.6, height = s.size * (1 + q * .2) * .75
      const safe = Math.min(1, room(point) / (Math.hypot(width, height) / 2))
      s.sprite.width = width * safe; s.sprite.height = height * safe
      s.sprite.alpha = age >= 0 && age < s.life ? Math.min(1, age * 20) * (1 - q) ** .65 : 0
    }
  }
  onFrame(update); update(0)
  tl.to(attacker, { x: home.x - back, duration: .42 }, 0)
    .to(attacker, { x: home.x + thrust, duration: .16, ease: 'power2.out' }, .42)
  for (const wave of waves) {
    tl.call(() => { wave.origin = socket('emission', true); update(wave.at) }, [], wave.at)
      .call(() => { wave.impact = targetSocket('center', true); update(wave.arrival) }, [], wave.arrival)
  }
  tl.call(() => { update(timing.contact); onCue({ type: 'impact' }); defender.tint = context.tint }, [], timing.contact)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 7, yoyo: true, ease: 'none' }, timing.contact)
    .to(world, { x: shake, y: -shake / 2, duration: .06, repeat: 7, yoyo: true, ease: 'none' }, timing.contact)
    .call(() => { defender.tint = 0xffffff }, [], timing.contact + .24)
    .set(defender, { x: defenderHome.x }, timing.contact + .5)
    .set(world, { x: 0, y: 0 }, timing.contact + .5)
    .to(attacker, { x: home.x, duration: .3 }, 2.18)
    .call(() => {}, [], timing.duration)
}
