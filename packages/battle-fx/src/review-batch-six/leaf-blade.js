import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Review-only choreography. The unedited recording plays at native pitch from .40 s.
export const timing = Object.freeze({ contact: 2.56, duration: 4.20, markers: Object.freeze([
  { id: 'first-blade-contact', label: 'First physical contact · right-inclined slash', timeSeconds: .81 },
  { id: 'second-blade-contact', label: 'Second physical contact · left-inclined slash', timeSeconds: 1.69 },
  { id: 'cross-finish', label: 'Both slashes form the cross · result cue', timeSeconds: 2.56 },
]) })

export default function leafBlade(context) {
  const { tl, onFrame, onCue, random } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const sign = Math.sign(temporary.scale.x)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const field = { left: Math.min(...edges), right: Math.max(...edges), top: -temporary.y / unit, bottom: (context.scene.height - temporary.y) / unit }
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n))
  const smooth = n => { const u = clamp(n); return u * u * (3 - 2 * u) }
  const lerp = (a, b, u) => a + (b - a) * u
  const rotate = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) })
  const room = p => Math.max(0, Math.min(p.x - field.left, field.right - p.x, p.y - field.top, field.bottom - p.y) - 8)
  const attachment = context.source.hasAnchor?.('blade') ? 'blade' : 'hand'
  const hand = socket(attachment), center = socket('visualCenter')
  const width = context.source.metrics.width / unit, height = context.source.metrics.height / unit
  const targetCenter = targetSocket('visualCenter'), focus = targetSocket('center')
  const targetWidth = context.target.metrics.width / unit, targetHeight = context.target.metrics.height / unit
  const length = Math.min(112, Math.max(62, height * .48))
  // The sharp end really lies behind the attachment, not at the end of a forward leaf.
  const tip = { x: -length, y: -length * .14 }, tipAngle = Math.atan2(tip.y, tip.x), tipLength = Math.hypot(tip.x, tip.y)
  const contour = [[0, 0], [-.09, -.22], [-.48, -.48], [-1, -.14], [-.73, -.14], [-.58, .06], [-.29, .11], [-.13, .08]]
    .map(([x, y]) => ({ x: x * length, y: y * length }))

  // Fit the complete actor and curved blade together; its real hand never detaches.
  function limits(rotation, bladeAngle, withBlade = true) {
    const c = rotate(center, rotation), cos = Math.abs(Math.cos(rotation)), sin = Math.abs(Math.sin(rotation))
    const rx = (width * cos + height * sin) / 2, ry = (height * cos + width * sin) / 2
    let minX = c.x - rx, maxX = c.x + rx, minY = c.y - ry, maxY = c.y + ry
    if (withBlade) {
      const root = rotate(hand, rotation)
      for (const p of contour) {
        const q = rotate(p, bladeAngle)
        minX = Math.min(minX, root.x + q.x - 7); maxX = Math.max(maxX, root.x + q.x + 7)
        minY = Math.min(minY, root.y + q.y - 7); maxY = Math.max(maxY, root.y + q.y + 7)
      }
    }
    return { left: field.left - minX, right: field.right - maxX, top: field.top - minY, bottom: field.bottom - maxY }
  }
  function fit(p, withBlade = true) {
    let rotation = p.rotation, bounds = limits(rotation, p.swing + rotation, withBlade)
    for (let i = 0; i < 12 && (bounds.left > bounds.right || bounds.top > bounds.bottom); i++) {
      rotation *= .5; bounds = limits(rotation, p.swing + rotation, withBlade)
    }
    return { ...p, rotation, x: clamp(p.x, bounds.left, bounds.right), y: clamp(p.y, bounds.top, bounds.bottom) }
  }
  const targetInset = Math.min(8, targetWidth * .12, targetHeight * .12)
  const targetBody = { left: targetCenter.x - targetWidth / 2 + targetInset, right: targetCenter.x + targetWidth / 2 - targetInset,
    top: targetCenter.y - targetHeight / 2 + targetInset, bottom: targetCenter.y + targetHeight / 2 - targetInset }
  function solveStrike(preferred, preferredRotation) {
    const offsets = [0]
    for (let i = 1; i <= 32; i++) offsets.push(i * .09, -i * .09)
    let closest
    for (const rotation of [preferredRotation, preferredRotation * .5, 0]) for (const offset of offsets) {
      const aim = preferred + offset, bladeAngle = aim - tipAngle
      const bounds = limits(rotation, bladeAngle), root = rotate(hand, rotation)
      const delta = { x: root.x + Math.cos(aim) * tipLength, y: root.y + Math.sin(aim) * tipLength }
      const reachable = { left: bounds.left + delta.x, right: bounds.right + delta.x, top: bounds.top + delta.y, bottom: bounds.bottom + delta.y }
      const overlap = { left: Math.max(targetBody.left, reachable.left), right: Math.min(targetBody.right, reachable.right),
        top: Math.max(targetBody.top, reachable.top), bottom: Math.min(targetBody.bottom, reachable.bottom) }
      if (bounds.left > bounds.right || bounds.top > bounds.bottom) continue
      const point = { x: clamp(focus.x, reachable.left, reachable.right), y: clamp(focus.y, reachable.top, reachable.bottom) }
      const distance = Math.hypot(point.x - clamp(point.x, targetBody.left, targetBody.right), point.y - clamp(point.y, targetBody.top, targetBody.bottom))
      const result = { x: point.x - delta.x, y: point.y - delta.y, rotation, swing: bladeAngle - rotation - Math.PI * 2, point, shift: { x: 0, y: 0 } }
      if (!closest || distance < closest.distance) closest = { ...result, distance }
      if (overlap.left <= overlap.right && overlap.top <= overlap.bottom) {
        result.point = { x: clamp(focus.x, overlap.left, overlap.right), y: clamp(focus.y, overlap.top, overlap.bottom) }
        result.x = result.point.x - delta.x; result.y = result.point.y - delta.y
        return result
      }
    }
    // A very wide user at an extreme field edge can need a small, bounded receiver lean.
    const catchCenter = { x: clamp(targetCenter.x, closest.point.x - targetWidth / 2 + targetInset, closest.point.x + targetWidth / 2 - targetInset),
      y: clamp(targetCenter.y, closest.point.y - targetHeight / 2 + targetInset, closest.point.y + targetHeight / 2 - targetInset) }
    catchCenter.x = clamp(catchCenter.x, field.left + targetWidth / 2, field.right - targetWidth / 2)
    catchCenter.y = clamp(catchCenter.y, field.top + targetHeight / 2, field.bottom - targetHeight / 2)
    closest.shift = { x: catchCenter.x - targetCenter.x, y: catchCenter.y - targetCenter.y }
    return closest
  }
  const first = solveStrike(-sign * .68, .055), second = solveStrike(sign * .68, -.045)
  const finish = { x: home.x + Math.min(29, Math.abs(focus.x) * .075), y: home.y - 3, rotation: .025, swing: .12 }
  const keys = [
    { time: 0, ...home, rotation: 0, swing: 0 },
    { time: .15, x: home.x - 7, y: home.y + 1, rotation: -.025, swing: 0 },
    { time: .36, x: home.x - 14, y: home.y + 3, rotation: -.06, swing: .18 },
    { time: .81, ...first, ease: 'in' },
    { time: .96, x: first.x + 5, y: first.y - 3, rotation: .07, swing: first.swing - .33, ease: 'out' },
    { time: 1.26, x: lerp(first.x, second.x, .45) - 28, y: lerp(first.y, second.y, .45) - 3, rotation: -.06, swing: second.swing - 1.13 },
    { time: 1.69, ...second, ease: 'in' },
    { time: 1.85, x: second.x + 4, y: second.y + 3, rotation: -.065, swing: second.swing + .34, ease: 'out' },
    { time: 2.30, ...finish },
    { time: 2.73, ...finish },
    { time: 3.35, ...home, rotation: 0, swing: 0 },
    { time: timing.duration, ...home, rotation: 0, swing: 0 },
  ]
  function poseAt(time) {
    let i = 1
    while (i < keys.length - 1 && time > keys[i].time) i++
    const a = keys[i - 1], b = keys[i], q = clamp((time - a.time) / (b.time - a.time))
    const u = b.ease === 'in' ? q ** 3 : b.ease === 'out' ? 1 - (1 - q) ** 3 : smooth(q)
    return Object.fromEntries(['x', 'y', 'rotation', 'swing'].map(key => [key, lerp(a[key], b[key], u)]))
  }
  function outline(g) {
    return g.moveTo(0, 0).bezierCurveTo(-length * .09, -length * .22, -length * .48, -length * .48, tip.x, tip.y)
      .bezierCurveTo(-length * .73, -length * .14, -length * .58, length * .06, -length * .29, length * .11)
      .quadraticCurveTo(-length * .13, length * .08, 0, 0).closePath()
  }
  const trail = new Graphics(); trail.label = 'leaf-blade-review-sweep'; temporary.addChild(trail)
  const blade = new Container(); blade.label = 'leaf-blade-review-blade'; blade.alpha = 0; temporary.addChild(blade)
  blade.attachmentSocket = attachment
  const halo = outline(new Graphics()).stroke({ color: 0xadff75, width: 12, alpha: .09, join: 'round' })
  halo.label = 'leaf-blade-review-edge-glow'; blade.addChild(halo)
  const leaf = outline(new Graphics()).fill(0x69bf43).stroke({ color: 0xf8fff0, width: 2.7, join: 'round' })
  leaf.label = 'leaf-blade-review-curved-leaf'; blade.addChild(leaf)
  leaf.moveTo(0, 0).bezierCurveTo(-length * .24, -length * .06, -length * .6, -length * .3, tip.x, tip.y)
    .bezierCurveTo(-length * .65, -length * .14, -length * .44, length * .09, -length * .29, length * .11)
    .quadraticCurveTo(-length * .13, length * .08, 0, 0).closePath().fill({ color: 0x348c36, alpha: .72 })
    .moveTo(0, 0).bezierCurveTo(-length * .24, -length * .06, -length * .6, -length * .3, tip.x, tip.y)
    .stroke({ color: 0xc9f99c, width: 1.7, alpha: .9 })
  for (let i = 1; i <= 4; i++) {
    const u = i / 6
    leaf.moveTo(-length * u, -length * .15 * Math.sin(u * Math.PI))
      .lineTo(-length * (u + .065), -length * (.14 + .1 * Math.sin(u * Math.PI)))
      .stroke({ color: 0xc8ed9c, width: 1.1, alpha: .65 })
  }
  const grip = new Graphics().moveTo(3, -4).quadraticCurveTo(-4, -5, -11, -1).moveTo(3, 3).quadraticCurveTo(-3, 5, -9, 4)
    .stroke({ color: 0xe9ffd4, width: 2, cap: 'round' })
  grip.label = 'leaf-blade-review-grip'; blade.addChild(grip)
  const bladeTip = new Container(); bladeTip.label = 'leaf-blade-review-tip'; bladeTip.position.copyFrom(tip); blade.addChild(bladeTip)
  const cuts = [0, 1].map(i => { const cut = new Graphics(); cut.label = `leaf-blade-review-slash-${i + 1}`; temporary.addChild(cut); return cut })
  const cross = new Container(); cross.label = 'leaf-blade-review-cross'; cross.alpha = 0; temporary.addChild(cross)
  const crossGlow = new Graphics(); crossGlow.label = 'leaf-blade-review-cross-glow'; cross.addChild(crossGlow)
  const crossCuts = [0, 1].map(i => { const cut = new Graphics(); cut.label = `leaf-blade-review-cross-${i + 1}`; cross.addChild(cut); return cut })
  const debris = []
  for (let impact = 0; impact < 3; impact++) for (let i = 0; i < (impact === 2 ? 24 : 10); i++) {
    const g = new Graphics(), size = 2.8 + random() * 3
    g.moveTo(-size, 0).quadraticCurveTo(-size * .2, -size * .8, size, 0).quadraticCurveTo(size * .1, size * .65, -size, 0)
      .closePath().fill(i % 3 ? 0xa2d970 : 0xeaffe0).moveTo(-size, 0).lineTo(size, 0).stroke({ color: 0xffffff, width: .65, alpha: .7 })
    g.label = `leaf-blade-review-fragment-${impact}-${i}`; g.alpha = 0; temporary.addChild(g)
    debris.push({ g, impact, angle: i * Math.PI * 2 / (impact === 2 ? 24 : 10) + random() * .17,
      life: impact === 2 ? 1.13 + random() * .43 : .40 + random() * .23, reach: 48 + random() * (impact === 2 ? 54 : 26), spin: (random() - .5) * 8 })
  }
  function targetShift(time) {
    const blend = smooth((time - 1.03) / .37)
    const base = { x: lerp(first.shift.x, second.shift.x, blend), y: lerp(first.shift.y, second.shift.y, blend) }
    const amount = smooth(time / .55) * (1 - smooth((time - 1.95) / .4))
    return { x: base.x * amount, y: base.y * amount }
  }
  function liveContact(strike) {
    const live = targetSocket('visualCenter', true)
    return { x: live.x + strike.point.x - targetCenter.x - strike.shift.x, y: live.y + strike.point.y - targetCenter.y - strike.shift.y }
  }
  function drawCut(g, radius) {
    g.clear().moveTo(-radius, 0).bezierCurveTo(-radius * .3, -radius * .055, radius * .37, -radius * .065, radius, 0)
      .bezierCurveTo(radius * .22, radius * .043, -radius * .33, radius * .065, -radius, 0).closePath()
      .fill(0xf6fff0).stroke({ color: 0xa3ef62, width: 2, alpha: .86, join: 'round' })
      .moveTo(-radius * .93, 0).quadraticCurveTo(0, -radius * .027, radius * .93, 0)
      .stroke({ color: 0xafff64, width: 11, alpha: .14, cap: 'round' })
      .moveTo(-radius * .8, 0).lineTo(radius * .86, 0).stroke({ color: 0xffffff, width: 1.2, alpha: 1, cap: 'round' })
  }
  const accents = [.81, 1.69, 2.56]
  function update(time) {
    blade.alpha = smooth((time - .10) / .16) * (1 - smooth((time - 3.03) / .48))
    const pose = fit(poseAt(time), blade.alpha > 0)
    attacker.position.copyFrom(pose); attacker.rotation = pose.rotation
    const shift = targetShift(time), tCenter = { x: targetCenter.x + shift.x, y: targetCenter.y + shift.y }
    const recoilRoom = Math.max(0, Math.min(9, field.right - tCenter.x - targetWidth / 2))
    let recoil = 0, reaction = false
    accents.forEach(at => {
      const age = time - at
      if (age >= 0 && age < .24) { recoil += Math.sin(age / .24 * Math.PI * 2) ** 2 * recoilRoom * (1 - age / .24); reaction = true }
    })
    defender.position.set(defenderHome.x + shift.x + recoil, defenderHome.y + shift.y)
    defender.tint = reaction ? 0xe5ffd3 : 0xffffff
    const root = socket(attachment, true), angle = pose.swing + attacker.rotation
    blade.position.copyFrom(root); blade.rotation = angle
    trail.clear(); trail.alpha = 0
    for (const [i, at] of accents.slice(0, 2).entries()) {
      const strength = smooth((time - at + .27) / .11) * (1 - smooth((time - at) / .17))
      if (strength <= 0) continue
      const outer = [], inner = [], direction = i ? -1 : 1
      for (let j = 0; j <= 22; j++) {
        const u = j / 22, a = angle + tipAngle + direction * .68 * (1 - u)
        for (const [list, r] of [[outer, tipLength * (.98 + u * .02)], [inner, tipLength * (.98 - Math.sin(u * Math.PI) * .23)]]) {
          const x = clamp(root.x + Math.cos(a) * r, field.left + 7, field.right - 7), y = clamp(root.y + Math.sin(a) * r, field.top + 7, field.bottom - 7)
          if (list === inner) list.unshift(x, y); else list.push(x, y)
        }
      }
      trail.poly([...outer, ...inner]).fill({ color: 0xb4f276, alpha: .25 * strength }); trail.alpha = 1
    }
    const points = [liveContact(first), liveContact(second), targetSocket('center', true)]
    cuts.forEach((cut, i) => {
      const age = time - accents[i], rise = smooth((age + .045) / .045), fade = 1 - smooth(age / .30)
      const radius = Math.min(78, targetHeight * .53, room(points[i]) * .86) * (.5 + rise * .5)
      cut.position.copyFrom(points[i]); cut.rotation = sign * (i ? .72 : -.72); cut.alpha = rise * fade
      drawCut(cut, radius)
    })
    const crossAge = time - timing.contact, crossRise = smooth((crossAge + .045) / .045)
    cross.position.copyFrom(points[2]); cross.alpha = crossRise * (1 - smooth((crossAge - .12) / .57))
    const radius = Math.min(85, targetHeight * .57, room(points[2]) * .84) * (.68 + .32 * crossRise)
    crossCuts.forEach((cut, i) => { cut.rotation = sign * (i ? .72 : -.72); drawCut(cut, radius) })
    crossGlow.clear().circle(0, 0, radius * .28).fill({ color: 0xb5ff77, alpha: .12 })
      .circle(0, 0, radius * .14).fill({ color: 0xeaffbe, alpha: .24 }).circle(0, 0, radius * .045).fill({ color: 0xffffff, alpha: .8 })
    for (const p of debris) {
      const age = time - accents[p.impact], u = age / p.life, origin = [first.point, second.point, focus][p.impact]
      p.g.alpha = u > 0 && u < 1 ? Math.sin(Math.PI * u) * (p.impact === 2 ? .82 : .7) : 0
      const reach = Math.min(p.reach, Math.max(0, room(origin) - 8) / 1.55), q = clamp(u)
      p.g.position.set(origin.x + Math.cos(p.angle) * reach * q, origin.y + Math.sin(p.angle) * reach * q + reach * .48 * q * q)
      p.g.rotation = p.angle + age * p.spin; p.g.scale.y = .4 + .6 * Math.abs(Math.cos(age * 6 + p.angle))
    }
  }
  onFrame(update)
  tl.call(() => update(.81), [], .81)
    .call(() => update(1.69), [], 1.69)
    .call(() => { update(timing.contact); onCue({ type: 'impact' }) }, [], timing.contact)
    .to({}, { duration: timing.duration }, 0)
}
