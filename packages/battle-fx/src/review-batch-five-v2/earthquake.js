import { Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Local second review of the ground rings, jagged fault and matte lifted debris.
// Successive expanding aftershocks keep moving until the recording settles.
export const timing = Object.freeze({ contact: .66, duration: 2.25, markers: Object.freeze([
  { id: 'ground-strike', label: 'First ground shockwave', timeSeconds: .32 },
  { id: 'aftershocks', label: 'Continuing ground shockwaves', timeSeconds: 1.04 },
  { id: 'shockwave-end', label: 'Final shockwave settles', timeSeconds: 2.10 },
]) })

export default function earthquake(context) {
  const { tl, assets, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, world, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges) + 6, right = Math.max(...edges) - 6
  const top = -temporary.y / unit + 6, bottom = (context.scene.height - temporary.y) / unit - 6
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
  const sourceFloor = socket('floor'), floor = targetSocket('floor'), sourceCenter = socket('visualCenter'), receiver = targetSocket('visualCenter')
  const sourceHalfH = context.source.metrics.height / (2 * unit), targetHalfW = context.target.metrics.width / (2 * unit)
  const up = Math.max(0, Math.min(10, sourceCenter.y - sourceHalfH - top)), down = Math.max(0, Math.min(4, bottom - sourceCenter.y - sourceHalfH))
  const recoil = Math.max(0, Math.min(10, right - receiver.x - targetHalfW))
  const slope = (floor.y - sourceFloor.y) / Math.max(1, floor.x - sourceFloor.x)
  const point = (x, y, pad = 3) => ({ x: clamp(x, left + pad, right - pad), y: clamp(y, top + pad, bottom - pad) })
  const groundPoint = (x, y) => point(sourceFloor.x + (floor.x - sourceFloor.x) * x / 495,
    sourceFloor.y + (floor.y - sourceFloor.y) * x / 495 + y + 67 * x / 495, 5)
  const rings = [], pebbles = [], dust = []
  const births = [.32, .45, .58, .71, 1.04, 1.22, 1.40, 1.58, 1.76, 1.90]
  births.forEach((birth, i) => {
    const ring = new Graphics(); ring.label = `earthquake-v2-wave-${i}`; temporary.addChild(ring)
    rings.push({ ring, birth, life: i < 4 ? .9 : Math.min(.72, 2.22 - birth), i })
  })
  const cracks = new Graphics(); cracks.label = 'earthquake-v2-fault'; temporary.addChild(cracks)
  const points = [[58, -16], [128, -43], [213, -21], [283, -61], [358, -43], [438, -73], [513, -53], [583, -81]].map(([x, y]) => groundPoint(x, y))
  for (let wave = 0; wave < 3; wave++) for (let i = 0; i < 10; i++) {
    const origin = groundPoint(108 + i * 49, -6 - i * 49 * .11), size = 8 + i % 3 * 3
    const g = new Sprite(assets.rock); g.anchor.set(.5); g.width = g.height = size; g.tint = 0xc1aa87; g.alpha = 0
    g.label = `earthquake-v2-pebble-${wave}-${i}`; temporary.addChild(g)
    const birth = .4 + i * .045 + wave * .56
    pebbles.push({ g, origin, size, birth, direction: i % 2 ? 1 : -1,
      life: Math.min(wave < 2 ? .52 : .40, 2.22 - birth), height: wave === 0 ? 44 : 23 })
  }
  for (let wave = 0; wave < 6; wave++) for (let i = 0; i < 8; i++) {
    const origin = groundPoint(100 + wave % 3 * 165, -11 - wave % 3 * 24)
    const g = new Sprite(glowTexture); g.anchor.set(.5); g.tint = i % 2 ? 0xbca98b : 0xd6c7a8; g.alpha = 0
    g.label = `earthquake-v2-dust-${wave}-${i}`; temporary.addChild(g)
    const birth = .32 + wave * .265
    dust.push({ g, origin, birth, life: Math.min(.65, 2.22 - birth), offset: (i / 7 - .5) * 100, size: 24 + i % 3 * 8 })
  }
  function update(time) {
    for (const { ring, birth, life, i } of rings) {
      ring.clear(); const age = time - birth, p = age / life
      if (age < 0 || p >= 1) continue
      const eased = 1 - (1 - p) ** 2, rx = 40 + 600 * eased, ry = 11 + 99 * eased
      const center = { x: sourceFloor.x + 36, y: sourceFloor.y - 8 }
      // Draw the same expanding ground ellipse on the source-to-target slope;
      // clip its contour to the field so near-edge art never spills offscreen.
      for (let j = 0; j <= 64; j++) {
        const a = j * Math.PI * 2 / 64, dx = Math.cos(a) * rx
        const q = point(center.x + dx, center.y + slope * dx + Math.sin(a) * ry, 3)
        j ? ring.lineTo(q.x, q.y) : ring.moveTo(q.x, q.y)
      }
      ring.stroke({ color: i % 2 ? 0xd5bb83 : 0x9e8157, width: i === 0 ? 4 : 2.5,
        alpha: .75 * Math.min(1, age / .08) * Math.min(1, (1 - p) / .45), cap: 'round', join: 'round' })
    }
    cracks.clear()
    for (let i = 0; i < points.length - 1; i++) {
      const birth = .36 + i * .045, alpha = Math.min(1, Math.max(0, (time - birth) / .06)) * clamp((2.20 - time) / .3, 0, 1)
      const pulse = time >= 1.04 ? .76 + .24 * Math.sin((time - 1.04) * 17 - i) ** 2 : 1
      for (const [width, color, opacity] of [[7, 0x342e22, .9], [2, 0xb99e6c, .8]])
        cracks.moveTo(points[i].x, points[i].y).lineTo(points[i + 1].x, points[i + 1].y).stroke({ width, color, alpha: alpha * pulse * opacity, cap: 'round' })
    }
    for (const p of pebbles) {
      const age = time - p.birth, u = age / p.life
      p.g.alpha = u >= 0 && u < 1 ? .9 * Math.min(1, (1 - u) / .3) : 0
      if (!p.g.alpha) continue
      const q = point(p.origin.x + p.direction * 20 * u, p.origin.y - p.height * Math.sin(u * Math.PI), p.size)
      p.g.position.copyFrom(q); p.g.rotation = p.direction * u * 3
    }
    for (const p of dust) {
      const age = time - p.birth, u = age / p.life
      p.g.alpha = u >= 0 && u < 1 ? .22 * Math.min(1, age / .08) * Math.min(1, (1 - u) / .7) : 0
      if (!p.g.alpha) continue
      const q = point(p.origin.x + p.offset * (1 - (1 - u) ** 2), p.origin.y - (22 + p.size / 2) * u, 2)
      const available = Math.max(0, Math.min(q.x - left, right - q.x, q.y - top, bottom - q.y))
      p.g.position.copyFrom(q); p.g.width = Math.min(p.size * (1.6 + u), available * 2); p.g.height = Math.min(p.size * (.7 + .9 * u), available * 2)
    }
  }
  onFrame(update)
  tl.to(attacker, { y: home.y - up, duration: .18, ease: 'power2.out' }, 0)
    .to(attacker, { y: home.y + down, duration: .14, ease: 'power3.in' }, .18)
    .to(attacker, { y: home.y, duration: .08 }, .32)
    .call(() => { update(timing.contact); onCue({ type: 'impact' }); defender.tint = 0xc1aa87 }, [], timing.contact)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 7, yoyo: true, ease: 'none' }, timing.contact)
    .call(() => { defender.tint = 0xffffff }, [], .90)
    .set(defender, { x: defenderHome.x }, 1.16)
    .set(world, { x: 0, y: 0 }, timing.duration)
    .call(() => {}, [], timing.duration)
}
