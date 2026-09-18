import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Independent Sacred Fire review: purple fire gathers around the user, seven
// burning embers converge, and the explosion unfolds into a living rainbow crown.
// The body charge uses widening, fading flame puffs inspired by Flamethrower;
// the ember contours and seven long crown tongues are authored for this move.
export const timing = Object.freeze({ contact: 1.42, duration: 4.5, markers: Object.freeze([
  { id: 'charge', label: 'Purple body flames gather', timeSeconds: .08 },
  { id: 'charge-rise', label: 'Purple charge swells', timeSeconds: .18 },
  { id: 'launch', label: 'First sacred ember launches', timeSeconds: .84 },
  { id: 'final-launch', label: 'Last sacred ember launches', timeSeconds: .99 },
  { id: 'crown-rise', label: 'Rainbow flame crown rises', timeSeconds: 1.56 },
  { id: 'crown-surge', label: 'Rainbow crown surges', timeSeconds: 3.44 },
  { id: 'crown-fade', label: 'Flowing crown begins fading', timeSeconds: 3.85 },
  { id: 'flames-clear', label: 'Crown flames clear', timeSeconds: 4.32 },
]) })

const PURPLE = [0x6331db, 0x9b48ef, 0xc786ff, 0xf0d8ff]
const RAINBOW = [0xff5874, 0xff964d, 0xffd95f, 0x93ed86, 0x69dfec, 0x7f9aff, 0xd98cff]

export default function sacredFire(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, world, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const sourceCenterName = context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'
  const targetCenterName = context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'
  const sourceCenter = socket(sourceCenterName), receiver = targetSocket(targetCenterName)
  const sourceHalf = { x: context.source.metrics.width / (2 * unit), y: context.source.metrics.height / (2 * unit) }
  const targetHalf = { x: context.target.metrics.width / (2 * unit), y: context.target.metrics.height / (2 * unit) }
  const back = Math.max(0, Math.min(9, sourceCenter.x - sourceHalf.x - left - 3))
  const thrust = Math.max(0, Math.min(7, right - sourceCenter.x - sourceHalf.x - 3))
  const recoil = Math.max(0, Math.min(12, right - receiver.x - targetHalf.x - 3))
  const shake = Math.max(0, Math.min(2, sourceCenter.x - sourceHalf.x - left, right - sourceCenter.x - sourceHalf.x,
    receiver.x - targetHalf.x - left, right - receiver.x - targetHalf.x,
    sourceCenter.y - sourceHalf.y - top, receiver.y - targetHalf.y - top))
  const r = Math.min(32, Math.max(23, context.target.metrics.height / unit * .145))
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const window = (time, start, end, fade = .2) => time >= start && time < end ? Math.min(1, (time - start) / .08, (end - time) / fade) : 0
  function fit(point, angle, minX, minY, maxX, maxY) {
    const cos = Math.cos(angle), sin = Math.sin(angle)
    let scale = 1
    for (const x of [minX, maxX]) for (const y of [minY, maxY]) {
      const dx = x * cos - y * sin, dy = x * sin + y * cos
      if (dx) scale = Math.min(scale, (dx < 0 ? point.x - left - 4 : right - point.x - 4) / Math.abs(dx))
      if (dy) scale = Math.min(scale, (dy < 0 ? point.y - top - 4 : bottom - point.y - 4) / Math.abs(dy))
    }
    return Math.max(0, scale)
  }
  const place = (node, point, bounds, angle = 0) => {
    node.position.copyFrom(point); node.rotation = angle; node.scale.set(fit(point, angle, ...bounds))
  }
  const sprite = (parent, width, height, tint, label, alpha = 0) => {
    const s = new Sprite(glowTexture); s.anchor.set(.5); s.width = width; s.height = height
    s.tint = tint; s.blendMode = 'add'; s.alpha = alpha; s.label = label; parent.addChild(s); return s
  }
  const charge = new Container(); charge.label = 'sacred-fire-review-charge'; temporary.addChild(charge)
  const rx = sourceHalf.x + 12, ry = sourceHalf.y + 12
  const bodyGlow = sprite(charge, rx * 2.05, ry * 2.05, 0x873fea, 'sacred-fire-review-body-glow', .15)
  const chargePuffs = Array.from({ length: 72 }, (_, i) => ({
    sprite: sprite(charge, 1, 1, PURPLE[i % PURPLE.length], `sacred-fire-review-charge-puff-${i}`),
    side: i % 2 ? 1 : -1, phase: random() * Math.PI * 2, size: 12 + random() * 16,
  }))
  const mouth = new Container(); mouth.label = 'sacred-fire-review-mouth'; temporary.addChild(mouth)
  sprite(mouth, 74, 74, 0x8c3ce8, 'sacred-fire-review-mouth-outer', .45)
  sprite(mouth, 35, 35, 0xd89fff, 'sacred-fire-review-mouth-inner', .75)
  sprite(mouth, 12, 12, 0xffe8ff, 'sacred-fire-review-mouth-core', .9)
  const emberItems = []
  for (let i = 0; i < 7; i++) {
    const flame = new Container(); flame.label = `sacred-fire-review-ember-${i}`; temporary.addChild(flame)
    const glow = sprite(flame, 45, 26, PURPLE[1 + i % 2], `sacred-fire-review-ember-glow-${i}`, .45); glow.x = -18
    const body = new Graphics(); body.label = `sacred-fire-review-ember-body-${i}`; flame.addChild(body)
    const tails = Array.from({ length: 5 }, (_, j) => sprite(temporary, 1, 1, PURPLE[(i + j) % 3 + 1], `sacred-fire-review-trail-${i}-${j}`))
    emberItems.push({ flame, body, tails, launch: .84 + i * .025, lane: i === 0 ? 0 : i - 3.5, length: 46 + i % 3 * 7, width: 13 + i % 2 * 3, from: null })
  }
  const explosion = new Container(); explosion.label = 'sacred-fire-review-explosion'; temporary.addChild(explosion)
  const bloom = sprite(explosion, r * 6.8, r * 5.2, 0xc694ff, 'sacred-fire-review-bloom')
  const flash = new Graphics(); flash.label = 'sacred-fire-review-flash'; explosion.addChild(flash)
  const rings = new Graphics(); rings.label = 'sacred-fire-review-rings'; explosion.addChild(rings)
  const crown = new Container(); crown.label = 'sacred-fire-review-crown'; temporary.addChild(crown)
  const plumes = Array.from({ length: 7 }, (_, i) => {
    const g = new Graphics(); g.label = `sacred-fire-review-crown-flame-${i}`; crown.addChild(g)
    return { g, lane: i - 3, phase: random() * Math.PI * 2, tint: RAINBOW[i], inner: RAINBOW[(i + 1) % RAINBOW.length] }
  })
  const crownPuffs = Array.from({ length: 112 }, (_, i) => ({
    sprite: sprite(crown, 1, 1, i % 5 ? RAINBOW[(i + 2) % 7] : 0xffeaff, `sacred-fire-review-crown-puff-${i}`),
    plume: i % 7, phase: random() * Math.PI * 2, size: 4 + random() * 5,
  }))
  const debris = Array.from({ length: 72 }, (_, i) => ({
    sprite: sprite(temporary, 1, 1, i % 4 ? RAINBOW[i % 7] : 0xe3b6ff, `sacred-fire-review-burst-${i}`),
    angle: random() * Math.PI * 2, speed: 90 + random() * 110, life: .42 + random() * .36, size: 4 + random() * 5,
  }))
  let impact
  function drawEmber(g, length, width, curl) {
    g.clear().moveTo(0, 0)
      .bezierCurveTo(-length * .25, -width * .2, -length * .4, -width * (1 + curl), -length * .76, -width * .72)
      .quadraticCurveTo(-length * .56, -width * .08, -length, width * .3)
      .quadraticCurveTo(-length * .66, width * .11, -length * .78, width * .72)
      .bezierCurveTo(-length * .4, width * (1 - curl), -length * .2, width * .2, 0, 0).fill(0x7331d7)
      .moveTo(-length * .035, 0).quadraticCurveTo(-length * .36, -width * .08, -length * .6, -width * .6)
      .quadraticCurveTo(-length * .4, width * .08, -length * .72, width * .3)
      .quadraticCurveTo(-length * .25, width * .62, -length * .035, 0).fill(0xc27bff)
      .moveTo(-length * .07, 0).quadraticCurveTo(-length * .3, -width * .27, -length * .5, -width * .15)
      .quadraticCurveTo(-length * .32, width * .1, -length * .6, width * .22)
      .quadraticCurveTo(-length * .22, width * .3, -length * .07, 0).fill(0xf3d7ff)
  }
  function route(time, item, target) {
    const from = item.from ?? socket('emission', true)
    const u = clamp((time - item.launch) / (timing.contact - item.launch)), p = u * u
    const rise = Math.min(24 + Math.abs(item.lane) * 8, Math.max(0, Math.min(from.y, target.y) - top - 8))
    const bend = item.lane * Math.min(3, room(from) / 6, room(target) / 6)
    return { x: from.x + (target.x - from.x) * p + Math.sin(Math.PI * p) * bend,
      y: from.y + (target.y - from.y) * p - Math.sin(Math.PI * p) * rise,
      angle: Math.atan2(target.y - from.y - Math.cos(Math.PI * p) * Math.PI * rise, target.x - from.x + Math.cos(Math.PI * p) * Math.PI * bend) }
  }
  function paintCrownFlame(g, height, width, curl, color, inner) {
    const tip = curl * width * .65
    g.clear().moveTo(0, 0)
      .bezierCurveTo(-width * .95, -height * .14, -width * .6, -height * .43, -width * .72, -height * .68)
      .quadraticCurveTo(-width * .13, -height * .5, tip, -height)
      .bezierCurveTo(tip + width * .28, -height * .77, width * .8, -height * .54, width * .54, -height * .39)
      .quadraticCurveTo(width * 1.1, -height * .17, 0, 0).fill({ color: 0x883ee6, alpha: .75 })
      .moveTo(0, -height * .035).quadraticCurveTo(-width * .76, -height * .22, -width * .34, -height * .5)
      .quadraticCurveTo(-width * .15, -height * .41, tip * .65, -height * .88)
      .quadraticCurveTo(width * .22, -height * .54, width * .4, -height * .35)
      .quadraticCurveTo(width * .65, -height * .14, 0, -height * .035).fill({ color, alpha: .85 })
      .moveTo(0, -height * .08).quadraticCurveTo(-width * .35, -height * .22, -width * .09, -height * .45)
      .quadraticCurveTo(width * .05, -height * .3, tip * .27, -height * .7)
      .quadraticCurveTo(width * .42, -height * .26, 0, -height * .08).fill({ color: inner, alpha: .75 })
      .moveTo(0, -height * .11).quadraticCurveTo(-width * .14, -height * .2, 0, -height * .4)
      .quadraticCurveTo(width * .21, -height * .21, 0, -height * .11).fill({ color: 0xfff0dd, alpha: .65 })
  }
  function update(time) {
    const liveSource = socket(sourceCenterName, true), liveMouth = socket('emission', true), liveTarget = targetSocket('center', true)
    const chargeStrength = window(time, .08, 1.14, .23)
    place(charge, liveSource, [-rx - 44, -ry - 44, rx + 44, ry + 44]); charge.alpha = chargeStrength
    bodyGlow.alpha = .1 + .06 * Math.sin(time * 9) ** 2
    for (const [i, p] of chargePuffs.entries()) {
      const q = (Math.max(0, time - .08) * 1.5 + i / chargePuffs.length) % 1
      const sway = Math.sin(time * 9 + p.phase + q * 5)
      p.sprite.position.set(p.side * rx * (.73 + .16 * Math.sin(q * Math.PI)) + sway * 8, ry * (.86 - q * 1.72))
      p.sprite.rotation = -Math.PI / 2 + sway * .13
      const size = p.size * (1 + q * .95)
      p.sprite.width = size * 1.35; p.sprite.height = size * .62
      p.sprite.alpha = Math.min(1, q * 9) * (1 - q) ** .65 * .66
    }
    place(mouth, liveMouth, [-38, -38, 38, 38]); mouth.alpha = window(time, .13, 1.15, .18) * (.8 + .2 * Math.sin(time * 16) ** 2)
    for (const item of emberItems) {
      const age = time - item.launch, point = route(time, item, impact ?? liveTarget)
      place(item.flame, point, [-item.length * 1.03, -item.width * 1.3, 3, item.width * 1.3], point.angle)
      item.flame.alpha = age >= 0 && time < timing.contact + .1 ? clamp(age / .04) * (1 - clamp((time - timing.contact) / .1)) : 0
      drawEmber(item.body, item.length, item.width, Math.sin(time * 24 + item.lane) * .22)
      for (const [j, tail] of item.tails.entries()) {
        const at = route(time - (j + 1) * .025, item, impact ?? liveTarget)
        tail.position.set(at.x, at.y); tail.rotation = at.angle
        const width = 17 - j * 1.8, height = 9 - j * .8, safe = fit(at, at.angle, -width / 2, -height / 2, width / 2, height / 2)
        tail.width = width * safe; tail.height = height * safe
        tail.alpha = age >= (j + 1) * .025 && time < timing.contact + .15 ? .26 * (1 - j / 6) * (1 - clamp((time - timing.contact) / .15)) : 0
      }
    }
    const hitAge = time - timing.contact
    place(explosion, liveTarget, [-r * 3.5, -r * 2.7, r * 3.5, r * 2.7])
    bloom.alpha = hitAge >= 0 && hitAge < .65 ? .62 * (1 - hitAge / .65) ** 1.2 : 0
    flash.clear().ellipse(0, 0, r * 1.04, r * .9).fill(0xffedff)
    flash.alpha = hitAge >= 0 && hitAge < .18 ? .9 * (1 - hitAge / .18) ** 2 : 0
    rings.clear(); rings.alpha = hitAge >= 0 && hitAge < .6 ? 1 : 0
    for (let i = 0; i < 2; i++) {
      const q = (hitAge - i * .06) / .45
      if (q >= 0 && q < 1) rings.ellipse(0, 0, r * (.55 + q * 2.7), r * (.3 + q * 1.45)).stroke({ color: i ? 0xffd38f : 0xd0a8ff, width: (1 - q) * 3, alpha: (1 - q) * .8 })
    }
    const crownAlpha = window(time, timing.contact, 4.32, .47)
    const surge = Math.max(0, 1 - Math.abs(time - 3.44) / .28)
    const lift = (.26 + .74 * clamp(hitAge / .26)) * (1 + surge * .18)
    place(crown, liveTarget, [-r * 2.7, -r * 5.5, r * 2.7, r * 1.15]); crown.alpha = crownAlpha
    for (const plume of plumes) {
      const height = r * (4.4 - Math.abs(plume.lane) * .48) * lift * (1 + .035 * Math.sin(time * 12 + plume.phase))
      const width = r * (.46 + .025 * Math.sin(time * 10 + plume.phase))
      plume.g.position.set(plume.lane * r * .62, r * (.42 + Math.abs(plume.lane) * .035))
      paintCrownFlame(plume.g, height, width, Math.sin(time * 16 + plume.phase), plume.tint, plume.inner)
      plume.g.alpha = .8 + surge * .2
      plume.height = height
    }
    for (const [i, p] of crownPuffs.entries()) {
      const plume = plumes[p.plume], q = (Math.max(0, hitAge) * 1.65 + Math.floor(i / 7) / 16) % 1
      p.sprite.position.set(plume.g.x + Math.sin(time * 17 + p.phase + q * 4) * r * .13, plume.g.y - plume.height * q)
      p.sprite.rotation = -Math.PI / 2 + Math.sin(time * 13 + p.phase) * .1
      const size = p.size * (1 + q * .8); p.sprite.width = size * 1.45; p.sprite.height = size * .65
      p.sprite.alpha = Math.min(1, q * 10) * (1 - q) ** .65 * .7
    }
    for (const p of debris) {
      const age = hitAge, q = clamp(age / p.life), origin = impact ?? liveTarget
      const reach = Math.min(p.speed * p.life, Math.max(0, room(origin) - 16))
      const gravity = Math.min(35 * p.life * p.life, Math.max(0, room(origin) - reach - 10))
      const point = { x: origin.x + Math.cos(p.angle) * reach * q, y: origin.y + Math.sin(p.angle) * reach * q + gravity * q * q }
      p.sprite.position.copyFrom(point); p.sprite.rotation = p.angle
      const width = p.size * (1.7 - q * .3), height = p.size * .7, safe = fit(point, p.angle, -width / 2, -height / 2, width / 2, height / 2)
      p.sprite.width = width * safe; p.sprite.height = height * safe
      p.sprite.alpha = age >= 0 && age < p.life ? clamp(age / .035) * (1 - q) ** .7 : 0
    }
  }
  onFrame(update); update(0)
  tl.to(attacker, { x: home.x - back, duration: .32, ease: 'power2.inOut' }, 0)
    .to(attacker, { x: home.x + thrust, duration: .18, ease: 'power2.out' }, .64)
  for (const item of emberItems) tl.call(() => { item.from = socket('emission', true); update(item.launch) }, [], item.launch)
  tl.call(() => { impact = targetSocket('center', true); update(timing.contact); onCue({ type: 'impact' }); defender.tint = 0xdfa7ff }, [], timing.contact)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 5, yoyo: true }, timing.contact)
    .to(world, { x: shake, y: -shake / 2, duration: .05, repeat: 5, yoyo: true }, timing.contact)
    .call(() => { defender.tint = 0xffffff }, [], 1.74)
    .set(world, { x: 0, y: 0 }, 1.74)
    .set(defender, { x: defenderHome.x }, 1.8)
    .to(attacker, { x: home.x, duration: .44, ease: 'power2.inOut' }, 1.54)
    .call(() => {}, [], timing.duration)
}
