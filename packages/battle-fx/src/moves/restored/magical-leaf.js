import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function magicalLeaf(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges)
  const top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const clamp = n => Math.max(0, Math.min(1, n))
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / extent)) }
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const sourceCenter = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const targetCenter = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const back = Math.max(0, Math.min(5, sourceCenter.x - context.source.metrics.width / (2 * unit) - left))
  const recoil = Math.max(0, Math.min(7, right - targetCenter.x - context.target.metrics.width / (2 * unit)))
  const palette = [0xb9ff83, 0x6effbe, 0xffaadf, 0xffe790, 0x9cffcd, 0xc5a4ff]
  const wreath = make('magical-leaf-charge')
  const leaves = Array.from({ length: 6 }, (_, i) => ({
    g: make(i === 0 ? 'magical-leaf-tip' : `magical-leaf-leaf-${i}`), trail: make(`magical-leaf-trail-${i}`),
    color: palette[i], size: 20 + random() * 5, phase: i * Math.PI / 3, lane: (i % 2 ? -1 : 1) * (.5 + i * .16), start: .42 + i * .021,
  }))
  const flower = make('magical-leaf-impact')
  const seeds = Array.from({ length: 24 }, (_, i) => ({ g: make(`magical-leaf-glint-${i}`), angle: i * Math.PI / 12, speed: 34 + random() * 40, life: .48 + random() * .32, color: palette[i % 6] }))
  let struck = false

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true)
    const dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx), nx = -Math.sin(angle), ny = Math.cos(angle)
    const route = (u, lane) => {
      const p = { x: a.x + dx * u, y: a.y + dy * u }
      const bow = Math.sin(Math.PI * u) * Math.min(72, Math.hypot(dx, dy) * .2, room(p) * .65) * lane
      return { x: p.x + nx * bow, y: p.y + ny * bow }
    }
    wreath.clear(); fit(wreath, a, 61)
    wreath.alpha = time >= .04 && time < .61 ? Math.min(1, (time - .04) / .12, (.61 - time) / .19) : 0
    for (let j = 0; j < 3; j++) {
      const radius = 19 + j * 11, rotation = time * (j % 2 ? -3 : 2) + j * 2
      wreath.arc(0, 0, radius, rotation, rotation + 1.4).stroke({ color: palette[j], width: 1.5, alpha: .58 })
    }
    for (const leaf of leaves) {
      const age = time - leaf.start, u = clamp(age / (1.06 - leaf.start))
      let p, rotation
      if (age < 0) {
        const orbit = Math.max(0, Math.sin(clamp((time - .025) / (leaf.start - .025)) * Math.PI))
        const theta = leaf.phase + time * 5, radius = Math.min(39, room(a) * .5) * orbit
        p = { x: a.x + Math.cos(theta) * radius, y: a.y + Math.sin(theta) * radius * .7 }
        rotation = theta + Math.PI / 2
      } else {
        p = route(u, leaf.lane)
        const ahead = route(Math.min(1, u + .002), leaf.lane), behind = route(Math.max(0, u - .002), leaf.lane)
        rotation = Math.atan2(ahead.y - behind.y, ahead.x - behind.x)
      }
      const g = leaf.g, r = leaf.size
      g.clear(); fit(g, p, r * 1.65); g.rotation = rotation
      g.alpha = time >= .035 && time < 1.21 ? Math.min(1, (time - .035) / .12, (1.21 - time) / .15) : 0
      // The pointed front stays at the root; the curved vein and lobes trail behind it.
      g.moveTo(0, 0).quadraticCurveTo(-r * .52, -r * .72, -r * 1.3, -r * .07)
        .quadraticCurveTo(-r * .66, r * .46, 0, 0).fill({ color: leaf.color, alpha: .22 })
        .moveTo(0, 0).quadraticCurveTo(-r * .49, -r * .44, -r, 0)
        .quadraticCurveTo(-r * .5, r * .39, 0, 0).fill(leaf.color)
        .moveTo(-r * .94, 0).quadraticCurveTo(-r * .46, -r * .05, 0, 0)
        .stroke({ color: 0xfaffec, width: 1.4, alpha: .95 })
      for (let j = 1; j < 4; j++) {
        const x = -r * j / 5
        g.moveTo(x, 0).lineTo(x - r * .15, -r * .2).moveTo(x, 0).lineTo(x - r * .12, r * .15)
          .stroke({ color: 0xf8ffee, width: .7, alpha: .65 })
      }
      const tail = leaf.trail; tail.clear(); tail.alpha = age >= 0 && time < 1.2 ? g.alpha * .63 : 0
      if (age >= 0) {
        for (let j = 1; j <= 9; j++) {
          const v = Math.max(0, u - j * .018), q = route(v, leaf.lane), z = route(Math.max(0, v - .018), leaf.lane)
          tail.moveTo(q.x, q.y).lineTo(z.x, z.y).stroke({ color: leaf.color, width: 2.8 * (1 - j / 11), alpha: 1 - j / 11 })
        }
      }
    }
    const age = time - 1.06, u = clamp(age / .74)
    flower.clear(); fit(flower, b, 67); flower.rotation = age * .5
    flower.alpha = struck && age >= 0 && age < .74 ? 1 - u : 0
    for (let j = 0; j < 6; j++) {
      const theta = j * Math.PI / 3, radius = 12 + u * 29, cx = Math.cos(theta) * radius, cy = Math.sin(theta) * radius
      flower.moveTo(0, 0).quadraticCurveTo(cx - cy * .3, cy + cx * .3, cx, cy)
        .quadraticCurveTo(cx + cy * .3, cy - cx * .3, 0, 0).fill({ color: palette[j], alpha: .48 })
    }
    flower.circle(0, 0, 7 * (1 - u) + 2).fill(0xf9ffe4)
    for (const seed of seeds) {
      const v = clamp(age / seed.life), reach = Math.min(seed.speed, room(b) * .66)
      const p = { x: b.x + Math.cos(seed.angle) * reach * v, y: b.y + Math.sin(seed.angle) * reach * v + Math.min(12, room(b) * .1) * v * v }
      seed.g.clear(); fit(seed.g, p, 9); seed.g.rotation = seed.angle + age
      seed.g.alpha = struck && age >= 0 && age < seed.life ? (1 - v) * .9 : 0
      seed.g.poly([0, -6, 1.5, -1.5, 6, 0, 1.5, 1.5, 0, 6, -1.5, 1.5, -6, 0, -1.5, -1.5]).fill(seed.color)
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .26 }, 0)
    .to(attacker, { x: home.x, duration: .14 }, .27)
    .call(() => update(.42), [], .42)
    .call(() => { struck = true; update(1.06); onCue({ type: 'impact' }); defender.tint = 0xe4ffd0 }, [], 1.06)
    .to(defender, { x: defenderHome.x + recoil, duration: .055, repeat: 3, yoyo: true }, 1.06)
    .call(() => { defender.tint = 0xffffff }, [], 1.3)
    .call(() => {}, [], 2.05)
}
