import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Sacred Fire review v2 preserves the approved purple body charge exactly.
// Dragon Breath-inspired widening flame flow connects the live mouth and target;
// the receiver crown uses that same opening material at twice its dimensions.
export const timing = Object.freeze({ contact: 1.42, duration: 4.5, markers: Object.freeze([
  { id: 'charge', label: 'Purple body flames gather', timeSeconds: .08 },
  { id: 'charge-rise', label: 'Purple charge swells', timeSeconds: .18 },
  { id: 'launch', label: 'Purple flame stream starts', timeSeconds: .84 },
  { id: 'final-launch', label: 'Purple flame stream cuts off', timeSeconds: 1.54 },
  { id: 'stream-clear', label: 'Last released flames clear', timeSeconds: 2.24 },
  { id: 'crown-rise', label: 'Purple flame crown rises', timeSeconds: 1.56 },
  { id: 'crown-surge', label: 'Purple flame crown surges', timeSeconds: 3.44 },
  { id: 'crown-fade', label: 'Flowing crown begins fading', timeSeconds: 3.85 },
  { id: 'flames-clear', label: 'Crown flames clear', timeSeconds: 4.32 },
]) })

const PURPLE = [0x6331db, 0x9b48ef, 0xc786ff, 0xf0d8ff]

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
  // Analytic emission at 180/s preserves dense, continuous Dragon Breath flow
  // while making seeking and frame cadence independent of particle simulation.
  const stream = Array.from({ length: 127 }, (_, i) => {
    const flame = sprite(temporary, 1, 1, PURPLE[i % 4], `sacred-fire-review-stream-puff-${i}`)
    flame.anchor.set(1, .5) // the actual leading edge reaches the target at contact
    return { sprite: flame, launch: .84 + i / 180, size: 14 + random() * 13,
      phase: random() * Math.PI * 2, lane: (random() - .5) * 2, from: null }
  })
  const streamRoot = new Container(); streamRoot.label = 'sacred-fire-review-stream-root'; temporary.addChild(streamRoot)
  sprite(streamRoot, 64, 56, 0x9b48ef, 'sacred-fire-review-stream-nozzle', .35)
  const streamFront = new Container(); streamFront.label = 'sacred-fire-review-stream-front'; temporary.addChild(streamFront)
  const explosion = new Container(); explosion.label = 'sacred-fire-review-explosion'; temporary.addChild(explosion)
  const bloom = sprite(explosion, r * 6.8, r * 5.2, 0xc694ff, 'sacred-fire-review-bloom')
  const flash = new Graphics(); flash.label = 'sacred-fire-review-flash'; explosion.addChild(flash)
  const rings = new Graphics(); rings.label = 'sacred-fire-review-rings'; explosion.addChild(rings)
  const crown = new Container(); crown.label = 'sacred-fire-review-crown'; temporary.addChild(crown)
  const plumes = Array.from({ length: 7 }, (_, i) => {
    const node = new Container(); node.label = `sacred-fire-review-crown-flame-${i}`; crown.addChild(node)
    return { node, lane: i - 3, height: 0 }
  })
  const crownPuffs = Array.from({ length: 126 }, (_, i) => {
    const opening = chargePuffs[i % chargePuffs.length]
    return { sprite: sprite(plumes[i % 7].node, 1, 1, opening.sprite.tint, `sacred-fire-review-crown-puff-${i}`),
      plume: i % 7, phase: opening.phase, size: opening.size }
  })
  const crownSpacing = 78, crownHalfWidth = crownSpacing * 3 + 53
  const crownHeight = r * 6.2, crownPadding = 78
  const debris = Array.from({ length: 72 }, (_, i) => ({
    sprite: sprite(temporary, 1, 1, PURPLE[i % 4], `sacred-fire-review-burst-${i}`),
    angle: random() * Math.PI * 2, speed: 90 + random() * 110, life: .42 + random() * .36, size: 4 + random() * 5,
  }))
  let impact
  function streamPoint(time, item, target) {
    const from = item.from ?? socket('emission', true)
    const q = clamp((time - item.launch) / .58)
    const dx = target.x - from.x, dy = target.y - from.y
    const angle = Math.atan2(dy, dx), sway = Math.sin(q * Math.PI) * item.lane * (9 + q * 12)
    return { x: from.x + dx * q - Math.sin(angle) * sway,
      y: from.y + dy * q + Math.cos(angle) * sway + Math.sin(time * 22 + item.phase) * Math.sin(q * Math.PI) * 3, angle, q }
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
    streamRoot.position.copyFrom(liveMouth)
    place(streamRoot, liveMouth, [-33, -29, 33, 29])
    streamRoot.alpha = window(time, .84, 1.7, .16)
    for (const item of stream) {
      const age = time - item.launch, point = streamPoint(time, item, liveTarget)
      item.sprite.position.set(point.x, point.y); item.sprite.rotation = point.angle
      const spread = 1 + point.q * 1.65
      const width = item.size * 1.6 * spread, height = item.size * .75 * spread
      const safe = fit(point, point.angle, -width, -height / 2, 0, height / 2)
      item.sprite.width = width * safe; item.sprite.height = height * safe
      const emission = .6 + .4 * Math.min(1, (item.launch - .84) / .12)
      item.sprite.alpha = age >= 0 && age < .7
        ? clamp(age / .035) * (.85 - point.q * .16) * (1 - clamp((age - .58) / .12)) * emission : 0
    }
    streamFront.position.copyFrom(streamPoint(time, stream[0], liveTarget))
    const hitAge = time - timing.contact
    place(explosion, liveTarget, [-r * 3.5, -r * 2.7, r * 3.5, r * 2.7])
    bloom.alpha = hitAge >= 0 && hitAge < .65 ? .62 * (1 - hitAge / .65) ** 1.2 : 0
    flash.clear().ellipse(0, 0, r * 1.04, r * .9).fill(0xffedff)
    flash.alpha = hitAge >= 0 && hitAge < .18 ? .9 * (1 - hitAge / .18) ** 2 : 0
    rings.clear(); rings.alpha = hitAge >= 0 && hitAge < .6 ? 1 : 0
    for (let i = 0; i < 2; i++) {
      const q = (hitAge - i * .06) / .45
      if (q >= 0 && q < 1) rings.ellipse(0, 0, r * (.55 + q * 2.7), r * (.3 + q * 1.45)).stroke({ color: i ? 0xf0d8ff : 0xd0a8ff, width: (1 - q) * 3, alpha: (1 - q) * .8 })
    }
    const crownAlpha = window(time, timing.contact, 4.32, .47)
    const surge = Math.max(0, 1 - Math.abs(time - 3.44) / .28)
    const lift = (.26 + .74 * clamp(hitAge / .26)) * (1 + surge * .18)
    // Keep the live target root, then fit the complete crown as one evenly
    // spaced formation. Constrained fields move its base before scaling it.
    crown.position.copyFrom(liveTarget); crown.alpha = crownAlpha
    const fullHeight = crownHeight * 1.18 + crownPadding * 2
    const safe = Math.min(1, (right - left - 8) / (crownHalfWidth * 2), (bottom - top - 8) / fullHeight)
    crown.scale.set(safe)
    const cx = Math.max(left + 4 + crownHalfWidth * safe, Math.min(right - 4 - crownHalfWidth * safe, liveTarget.x))
    const cy = Math.max(top + 4 + (crownHeight * 1.18 + crownPadding) * safe,
      Math.min(bottom - 4 - crownPadding * safe, liveTarget.y + targetHalf.y * .75))
    for (const plume of plumes) {
      plume.height = r * (6.2 - Math.abs(plume.lane) * .55) * lift
      plume.node.position.set((cx - liveTarget.x) / safe + plume.lane * crownSpacing,
        (cy - liveTarget.y) / safe - Math.abs(plume.lane) * 5)
    }
    for (const [i, p] of crownPuffs.entries()) {
      const plume = plumes[p.plume], q = (Math.max(0, hitAge) * 1.5 + Math.floor(i / 7) / 18) % 1
      const sway = Math.sin(time * 9 + p.phase + q * 5)
      p.sprite.position.set(sway * 8, -plume.height * q)
      p.sprite.rotation = -Math.PI / 2 + sway * .13
      // Same opening law, material and aspect ratio, exactly doubled on both axes.
      const size = p.size * (1 + q * .95)
      p.sprite.width = 2 * size * 1.35; p.sprite.height = 2 * size * .62
      p.sprite.alpha = Math.min(1, q * 9) * (1 - q) ** .65 * .66
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
  for (const item of stream) tl.call(() => { item.from = socket('emission', true); update(item.launch) }, [], item.launch)
  tl.call(() => { impact = targetSocket('center', true); update(timing.contact); onCue({ type: 'impact' }); defender.tint = 0xdfa7ff }, [], timing.contact)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 5, yoyo: true }, timing.contact)
    .to(world, { x: shake, y: -shake / 2, duration: .05, repeat: 5, yoyo: true }, timing.contact)
    .call(() => { defender.tint = 0xffffff }, [], 1.74)
    .set(world, { x: 0, y: 0 }, 1.74)
    .set(defender, { x: defenderHome.x }, 1.8)
    .to(attacker, { x: home.x, duration: .44, ease: 'power2.inOut' }, 1.54)
    .call(() => {}, [], timing.duration)
}
