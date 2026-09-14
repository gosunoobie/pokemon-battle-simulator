import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function nightShade(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const launchSocket = context.source.hasAnchor?.('eyes') ? 'eyes' : 'emission'
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / extent)) }
  const root = make('night-shade-root'), tip = make('night-shade-tip'), impact = make('night-shade-impact')
  root.attachmentSocket = launchSocket; tip.attachmentSocket = launchSocket
  const wake = Array.from({ length: 5 }, (_, i) => ({ g: make(`night-shade-wake-${i}`), lag: i * .056 + .05 }))
  const pressures = Array.from({ length: 4 }, (_, i) => ({ g: make(`night-shade-pressure-${i}`), phase: i / 4 }))
  const grains = Array.from({ length: 12 }, (_, i) => ({ g: make(`night-shade-grain-${i}`), phase: i / 12 }))
  let struck = false

  function contour(g, rx, ry, phase, color, width, alpha) {
    for (let j = 0; j <= 52; j++) {
      const q = j * Math.PI * 2 / 52, ripple = 1 + Math.sin(q * 5 + phase) * .055 + Math.sin(q * 3 - phase * .7) * .025
      const x = Math.cos(q) * rx * ripple, y = Math.sin(q) * ry * ripple
      if (!j) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.closePath().stroke({ color, width, alpha })
  }
  function update(time) {
    const a = socket(launchSocket, true), b = targetSocket('center', true), dx = b.x - a.x, dy = b.y - a.y
    const reach = clamp((time - .36) / .46), head = { x: a.x + dx * reach, y: a.y + dy * reach }
    root.clear(); fit(root, a, 34); root.alpha = time >= .04 && time < .72 ? clamp((time - .04) / .22) * (1 - clamp((time - .38) / .34)) : 0
    const opening = 4 + clamp(time / .36) * 18
    root.ellipse(0, 0, opening, 7).fill({ color: 0x30243f, alpha: .35 }).stroke({ color: 0x8c79bb, width: 1.6, alpha: .8 })
      .moveTo(-opening * .64, 0).lineTo(opening * .64, 0).stroke({ color: 0xd2c6ea, width: 1.2, alpha: .72 })
    wake.forEach((w, i) => {
      const u = clamp((time - .36 - w.lag) / .46), p = { x: a.x + dx * u, y: a.y + dy * u }, g = w.g
      g.clear(); fit(g, p, 55); g.alpha = time >= .36 + w.lag && time < 1.18 ? (.31 - i * .027) * (1 - clamp((time - .85) / .33)) : 0
      const r = 18 + i * 2 + Math.sin(time * 8 + i) * 1.7
      contour(g, r, r * 1.48, time * 7 - i, i % 2 ? 0x8d78b5 : 0x655081, 1.5, .7)
    })
    tip.clear(); fit(tip, head, 64); tip.alpha = time >= .36 && time < 1.21 ? 1 - clamp((time - .88) / .33) : 0
    // One haunting face travels inside a wavering pressure front; the pale features are brief.
    for (let j = 0; j <= 48; j++) {
      const q = j * Math.PI * 2 / 48, ripple = 1 + Math.sin(q * 5 + time * 9) * .055
      const x = Math.cos(q) * 29 * ripple, y = Math.sin(q) * 44 * ripple
      if (!j) tip.moveTo(x, y); else tip.lineTo(x, y)
    }
    tip.closePath().fill({ color: 0x252039, alpha: .48 }).stroke({ color: 0x78609b, width: 2.1, alpha: .76 })
    contour(tip, 35, 51, time * 8, 0x9b87c3, 1.1, .54)
    const gaze = .46 + Math.sin(clamp((time - .36) / .7) * Math.PI) * .42
    for (const side of [-1, 1]) {
      tip.moveTo(side * 5, -9).lineTo(side * 23, -14).lineTo(side * 16, -5).lineTo(side * 7, -4).closePath().fill({ color: 0xe8e0f5, alpha: gaze })
    }
    tip.moveTo(-9, 15).quadraticCurveTo(0, 10 + Math.sin(time * 9) * 2, 9, 15).stroke({ color: 0xafa0c8, width: 1.4, alpha: .42 })
    const age = time - .82, u = clamp(age / .7)
    impact.clear(); fit(impact, b, 83); impact.alpha = struck && age >= 0 && age < .7 ? (1 - u) * .7 : 0
    contour(impact, 18 + u * 36, 26 + u * 45, time * 8, 0xb4a0d2, 2 - u, .8)
    pressures.forEach(p => {
      const cycle = (Math.max(0, age) * .66 + p.phase) % 1, g = p.g
      const displacement = Math.min(14, room(b) * .12), center = { x: b.x + Math.sin(time * 3 + p.phase * 6.28) * displacement, y: b.y + Math.cos(time * 2.7 + p.phase * 6.28) * displacement * .65 }
      g.clear(); fit(g, center, 98); g.alpha = age >= 0 && time < 2.04 ? clamp(age / .19) * (1 - clamp((time - 1.56) / .48)) * Math.sin(cycle * Math.PI) * .58 : 0
      contour(g, 28 + cycle * 36, 36 + cycle * 45, time * 5 + p.phase * 8, p.phase < .5 ? 0x73628f : 0x9e83c2, 1.7 - cycle * .8, .72)
    })
    grains.forEach(p => {
      const travel = (Math.max(0, age) * .55 + p.phase) % 1, q = p.phase * Math.PI * 2 + time * .77, span = Math.min(75, room(b) * .82), distance = span * (.3 + travel * .6)
      const at = { x: b.x + Math.cos(q) * distance, y: b.y + Math.sin(q) * distance * .77 + travel * Math.min(7, room(b) * .12) }, g = p.g
      g.clear(); fit(g, at, 6); g.rotation = q + time * .7
      g.alpha = age >= 0 && time < 2.06 ? clamp(age / .18) * (1 - clamp((time - 1.58) / .48)) * Math.sin(travel * Math.PI) * .65 : 0
      g.poly([-3, 0, 0, -1.5, 3, 0, 0, 1.5]).fill(p.phase < .5 ? 0xb2a1c8 : 0x75638c)
    })
  }
  onFrame(update)
  tl.call(() => update(.36), [], .36)
    .call(() => { struck = true; update(.82); onCue({ type: 'impact' }) }, [], .82)
    .to({}, { duration: 2.1 }, 0)
}
