import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function waterPulse(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, radius) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / radius)) }
  const root = make('water-pulse-root')
  const rings = Array.from({ length: 5 }, (_, i) => ({ g: make(i ? `water-pulse-ring-${i}` : 'water-pulse-tip'), start: .28 + i * .055, phase: i * 1.37 }))
  const impact = make('water-pulse-impact'), ripples = make('water-pulse-ripples')
  const beads = Array.from({ length: 15 }, (_, i) => ({ g: make(`water-pulse-rim-drop-${i}`), start: .32 + i * .035, phase: i * Math.PI * 2 / 5, size: 1.8 + random() * 1.1 }))
  const drops = Array.from({ length: 28 }, (_, i) => ({
    g: make(`water-pulse-drop-${i}`), start: .76 + Math.floor(i / 7) * .1,
    angle: i * Math.PI * 2 / 28, reach: 41 + random() * 32, life: .76 + random() * .12, size: 2.1 + random() * 1.5,
  }))
  const radius = Math.min(47, Math.max(30, context.target.metrics.height / unit * .25))
  let struck = false

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true), dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx)
    const cos = Math.cos(angle), sin = Math.sin(angle), route = u => ({ x: a.x + dx * u, y: a.y + dy * u })
    root.clear(); fit(root, a, 38); root.rotation = angle
    root.alpha = time >= .035 && time < .67 ? Math.min(1, (time - .035) / .13, (.67 - time) / .2) : 0
    const pressure = clamp((time - .035) / .245)
    for (let j = 0; j < 3; j++) {
      const span = 8 + pressure * 13 + j * 4, shift = -5 + j * 2
      root.ellipse(shift, 0, span * .27, span).stroke({ color: j === 1 ? 0xd9fbff : 0x51c4e7, width: j === 1 ? 1.8 : 1.3, alpha: .58 - j * .08 })
    }
    root.ellipse(0, 0, 2.1, 7 + pressure * 5).fill({ color: 0xb6f4ff, alpha: .58 })

    for (const ring of rings) {
      const age = time - ring.start, u = clamp(age / .48), linger = Math.max(0, age - .48), p = route(u), g = ring.g
      const r = radius * (.53 + u * .47) * (1 + linger * .63), width = r * (.29 + Math.sin(time * 6 + ring.phase) * .015)
      g.clear(); fit(g, p, r * 1.3 + 7); g.rotation = angle
      g.alpha = age >= 0 && age < .79 ? Math.min(1, age / .045, (.79 - age) / .31) : 0
      // The ring stays hollow. Its frontmost rim is local zero; its body trails behind that point.
      for (const [scale, color, thickness, alpha] of [[1, 0x258ebc, 5, .29], [1, 0x66d9f3, 2.5, .88], [.78, 0xb6f5ff, 1.3, .7]]) {
        const cx = -width, rx = width * scale, ry = r * scale
        for (let j = 0; j <= 52; j++) {
          const theta = j * Math.PI * 2 / 52, ripple = Math.sin(theta * 4 - time * 13 + ring.phase) * .025
          const x = cx + Math.cos(theta) * rx, y = Math.sin(theta) * ry * (1 + ripple)
          j ? g.lineTo(x, y) : g.moveTo(x, y)
        }
        g.closePath().stroke({ color, width: thickness, alpha, cap: 'round', join: 'round' })
      }
      // Moving arcs and beads give the transparent rim a liquid surface.
      for (let j = 0; j < 3; j++) {
        const start = time * 3.6 + ring.phase + j * Math.PI * 2 / 3
        for (let k = 0; k <= 9; k++) {
          const theta = start + k / 9 * .53, x = -width + Math.cos(theta) * width, y = Math.sin(theta) * r
          k ? g.lineTo(x, y) : g.moveTo(x, y)
        }
        g.stroke({ color: 0xeeffff, width: 2.3, alpha: .83, cap: 'round' })
        const theta = start + .58
        g.ellipse(-width + Math.cos(theta) * width, Math.sin(theta) * r, 1.8, 2.5).fill({ color: 0xc6f8ff, alpha: .78 })
      }
      g.ellipse(-.9, 0, .9, 2.2).fill(0xe6ffff)
    }

    for (const bead of beads) {
      const age = time - bead.start, u = clamp(age / .49), p = route(u), reach = Math.min(radius * .88, room(p) * .58) * Math.sin(u * Math.PI)
      const along = Math.cos(bead.phase + age * 7) * reach * .19, across = Math.sin(bead.phase + age * 7) * reach
      const q = { x: p.x + cos * along - sin * across, y: p.y + sin * along + cos * across + Math.min(7, room(p) * .08) * u * u }, g = bead.g, r = bead.size
      g.clear(); fit(g, q, r * 2.1); g.rotation = angle
      g.alpha = age >= 0 && age < .49 ? Math.sin(u * Math.PI) * .76 : 0
      g.ellipse(0, 0, r, r * 1.25).fill(0x65d5f2).ellipse(-r * .24, -r * .32, r * .36, r * .5).fill(0xddfbff)
    }

    const age = time - .76, expansion = clamp(age / .47)
    impact.clear(); fit(impact, b, radius * 1.88); impact.rotation = angle
    impact.alpha = struck && age >= 0 && age < .75 ? 1 - clamp((age - .22) / .53) : 0
    for (let j = 0; j < 3; j++) {
      const r = radius * (.37 + expansion * .85 + j * .12), rx = r * (.3 + expansion * .34)
      impact.ellipse(-rx * .12, 0, rx, r).stroke({ color: j === 1 ? 0xd4faff : 0x6ad5f0, width: j === 1 ? 2.4 : 1.5, alpha: .62 - j * .1 })
    }
    for (let j = 0; j < 8; j++) {
      const theta = j * Math.PI / 4 + age * .8, inner = radius * .29, outer = radius * (.58 + expansion * .87)
      impact.moveTo(Math.cos(theta) * inner * .6, Math.sin(theta) * inner)
        .quadraticCurveTo(Math.cos(theta + .16) * outer * .56, Math.sin(theta + .16) * outer * .86, Math.cos(theta) * outer * .81, Math.sin(theta) * outer)
        .stroke({ color: j % 2 ? 0xe4fcff : 0x6bd9f3, width: 3 * (1 - expansion) + .8, alpha: (1 - expansion) * .72, cap: 'round' })
    }

    ripples.clear(); fit(ripples, b, radius * 2.13)
    ripples.alpha = struck && age >= .13 && time < 2.08 ? Math.min(1, (age - .13) / .17, (2.08 - time) / .48) * .65 : 0
    for (let j = 0; j < 3; j++) {
      const u = (Math.max(0, age - .13) * .68 + j / 3) % 1, r = radius * (.7 + u * 1.14), y = radius * (.38 + u * .24)
      ripples.ellipse(0, y, r, r * .32).stroke({ color: j % 2 ? 0xd3f5ff : 0x7ddbed, width: 1.9 - u, alpha: (1 - u) * .69 })
    }
    for (const drop of drops) {
      const age = time - drop.start, u = clamp(age / drop.life), distance = Math.min(drop.reach, room(b) * .46)
      const vx = Math.cos(drop.angle) * distance, vy = Math.sin(drop.angle) * distance * .57
      const p = { x: b.x + vx * u, y: b.y + vy * u + distance * .94 * u * u }, g = drop.g, r = drop.size
      g.clear(); fit(g, p, r * 2); g.rotation = Math.atan2(vy + distance * 1.88 * u, vx) - Math.PI / 2
      g.alpha = struck && age >= 0 && age < drop.life ? Math.min(1, age / .045, (drop.life - age) / .26) * .88 : 0
      g.moveTo(0, -r * 1.5).quadraticCurveTo(-r * 1.2, -r * .25, -r * .8, r * .6)
        .quadraticCurveTo(0, r * 1.45, r * .8, r * .6).quadraticCurveTo(r * 1.15, -r * .25, 0, -r * 1.5).fill(0x67cfee)
        .ellipse(-r * .17, -r * .02, r * .31, r * .67).fill({ color: 0xe6fbff, alpha: .91 })
    }
  }
  onFrame(update)
  tl.call(() => update(.28), [], .28)
    .call(() => { struck = true; update(.76); onCue({ type: 'impact' }) }, [], .76)
    .to({}, { duration: 2.15 }, 0)
}
