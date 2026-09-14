import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function memento(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n)), room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const make = name => { const g = new Graphics(); g.label = name; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, radius) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / radius)) }
  const gather = make('memento-gather'), ribbon = make('memento-parting-ribbons'), tip = make('memento-tip'), impact = make('memento-impact')
  tip.attachmentSocket = 'emission'
  const symbols = ['attack', 'special'].map((name, i) => ({ g: make('memento-stat-' + name), side: i ? 1 : -1, at: 1.16 + i * .1 }))
  const embers = Array.from({ length: 30 }, (_, i) => {
    const g = make('memento-ember-' + i); g.poly([0, -3, 2, 0, 0, 3, -2, 0]).fill(i % 3 ? 0xbb7597 : 0xdd9eac)
    return { g, at: .54 + i * .014, angle: random() * 6.28, distance: 20 + random() * 32, life: .58 + random() * .22 }
  })
  let struck = false
  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true), dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx), nx = -Math.sin(angle), ny = Math.cos(angle)
    const path = u => { const p = { x: a.x + dx * u, y: a.y + dy * u }, bow = Math.sin(Math.PI * u) * Math.min(31, room(p) * .52); p.x += nx * bow; p.y += ny * bow; return p }
    gather.clear(); fit(gather, a, 49); gather.alpha = time >= .05 && time < .76 ? clamp((time - .05) / .25) * (1 - clamp((time - .5) / .26)) : 0
    for (let j = 0; j < 3; j++) {
      const r = 19 + j * 8, q = time * 2.4 + j * 2.09
      for (let k = 0; k <= 20; k++) { const phase = q + k * .135, x = Math.cos(phase) * r, y = Math.sin(phase) * r * .7; if (!k) gather.moveTo(x, y); else gather.lineTo(x, y) }
      gather.stroke({ color: j === 1 ? 0xcb859e : 0x796181, width: j === 1 ? 2.3 : 1.3, alpha: .7, cap: 'round' })
    }
    const u = clamp((time - .54) / .58), head = path(u), tail = Math.max(0, u - .6 + clamp((time - 1.12) / .56) * .6)
    ribbon.clear(); ribbon.alpha = time >= .54 && time < 1.77 ? clamp((time - .54) / .06) * (1 - clamp((time - 1.27) / .5)) : 0
    for (let lane = 0; lane < 2; lane++) {
      const upper = [], lower = []
      for (let j = 0; j <= 35; j++) {
        const v = j / 35, q = tail + (u - tail) * v, p = path(q), clearance = room(p), flutter = Math.sin(q * 11 - time * 8 + lane * Math.PI) * Math.min(13, clearance * .32) * Math.sin(Math.PI * v)
        const width = Math.min(3.2 + lane * 1.3, clearance * .15) * Math.sin(Math.PI * v)
        upper.push(p.x + nx * (flutter + width), p.y + ny * (flutter + width)); lower.unshift(p.x + nx * (flutter - width), p.y + ny * (flutter - width))
      }
      ribbon.poly([...upper, ...lower]).fill({ color: lane ? 0xa06a93 : 0x813e62, alpha: lane ? .76 : .88 })
    }
    tip.clear(); fit(tip, head, 29); tip.rotation = Math.sin(time * 5) * .08
    tip.alpha = time >= .54 && time < 1.48 ? 1 - clamp((time - 1.17) / .31) : 0
    tip.poly([0, -23, 13, -7, 8, 15, 0, 24, -8, 15, -13, -7]).fill({ color: 0x392840, alpha: .73 }).stroke({ color: 0xc589a8, width: 1.8, join: 'round' })
      .poly([0, -12, 6, 0, 0, 13, -6, 0]).fill(0xa15c83)
      .moveTo(-18, -3).lineTo(-10, 2).moveTo(18, -3).lineTo(10, 2).stroke({ color: 0xebb8c7, width: 1.5, alpha: .85, cap: 'round' })
    const age = time - 1.12, spread = clamp(age / .77)
    impact.clear(); fit(impact, b, 65); impact.alpha = struck && age >= 0 && age < .77 ? (1 - spread) * .85 : 0
    for (let j = 0; j < 4; j++) { const phase = j * Math.PI / 2 + time * 1.5, r = 21 + spread * 26; impact.moveTo(Math.cos(phase) * r, Math.sin(phase) * r).lineTo(Math.cos(phase + .23) * r * .7, Math.sin(phase + .23) * r * .7).lineTo(Math.cos(phase + .45) * r, Math.sin(phase + .45) * r).stroke({ color: j % 2 ? 0xd298b1 : 0x9b739f, width: 2.1, alpha: .8, cap: 'round' }) }
    symbols.forEach(({ g, side, at }, index) => {
      const age = time - at, u = clamp(age / .98), radius = Math.min(45, room(b) * .58), p = { x: b.x + side * radius * .55, y: b.y - radius * .48 + radius * 1.22 * u }
      g.clear(); fit(g, p, 35); g.alpha = age >= 0 && age < .98 ? clamp(age / .1) * (1 - clamp((age - .55) / .43)) : 0
      g.moveTo(0, -2).lineTo(0, 12).moveTo(-7, 7).lineTo(0, 14).lineTo(7, 7).stroke({ color: index ? 0xd0a5dd : 0xe2a8b6, width: 2.1, cap: 'round', join: 'round' })
      if (index) g.poly([0, -20, 3, -14, 10, -12, 3, -9, 0, -3, -3, -9, -10, -12, -3, -14]).fill(0xb58dc8)
      else g.poly([-3, -19, 3, -19, 3, -9, 6, -9, 6, -6, -6, -6, -6, -9, -3, -9]).fill(0xc58b9f)
      for (let j = 0; j < 2; j++) g.moveTo(-5, -25 - j * 5 + ((time * 13) % 5)).lineTo(5, -25 - j * 5 + ((time * 13) % 5)).stroke({ color: 0x947092, width: 1.2, alpha: .35 })
    })
    embers.forEach(p => {
      const age = time - p.at, u = clamp(age / .58), after = Math.max(0, age - .58), at = path(u)
      if (after > 0) { const travel = clamp(after / p.life), distance = Math.min(p.distance, room(b) * .64) * travel; at.x += Math.cos(p.angle) * distance; at.y += Math.sin(p.angle) * distance * .55 + distance * .28 * travel }
      fit(p.g, at, 5); p.g.rotation = time * 2 + p.angle; p.g.alpha = age >= 0 && after < p.life ? clamp(age / .06) * (1 - clamp(after / p.life)) * .76 : 0
    })
  }
  onFrame(update)
  tl.call(() => update(.54), [], .54)
    .call(() => { struck = true; update(1.12); onCue({ type: 'impact' }) }, [], 1.12)
    .to({}, { duration: 2.55 }, 0)
}
