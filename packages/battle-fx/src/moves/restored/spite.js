import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function spite(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const ends = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...ends), right = Math.max(...ends), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const fit = (g, p, radius) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / radius)) }
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const root = make('spite-root'), tip = make('spite-tip'), scratches = make('spite-travel-tears'), impact = make('spite-impact'), curse = make('spite-torn-marks')
  const motes = Array.from({ length: 4 }, (_, i) => ({ g: make(`spite-mote-${i}`), tail: make(`spite-mote-trail-${i}`), side: i % 2 ? 1 : -1, row: i < 2 ? -1 : 1 }))
  let struck = false

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true), dx = b.x - a.x, dy = b.y - a.y, length = Math.max(1, Math.hypot(dx, dy)), nx = -dy / length, ny = dx / length
    const route = u => {
      const p = { x: a.x + dx * u, y: a.y + dy * u }, offset = Math.sin(Math.PI * u) * Math.min(26, length * .07, room(p) * .3)
      return { x: p.x + nx * offset, y: p.y + ny * offset }
    }
    root.clear(); fit(root, a, 36)
    root.alpha = time >= .03 && time < .53 ? Math.min(1, (time - .03) / .1, (.53 - time) / .18) : 0
    const tighten = clamp(time / .32)
    for (let j = 0; j < 3; j++) {
      const x = (j - 1) * (17 - tighten * 7)
      root.poly([x - 4, -20, x + 4, -7, x - 1, -3, x + 3, 16, x - 8, 2, x - 3, -2]).fill({ color: j % 2 ? 0xdd9ee8 : 0x9d60b8, alpha: .7 })
    }
    const u = clamp((time - .32) / .54), p = route(u), next = route(Math.min(1, u + .002)), prev = route(Math.max(0, u - .002))
    tip.clear(); fit(tip, p, 49); tip.rotation = Math.atan2(next.y - prev.y, next.x - prev.x)
    tip.alpha = time >= .32 && time < .99 ? Math.min(1, (time - .32) / .06, (.99 - time) / .13) : 0
    // The torn curse has one sharp front at local zero and three unequal paper-like tails.
    tip.poly([0, 0, -15, -14, -19, -5, -35, -12, -26, 0, -43, 8, -20, 6, -22, 17, -8, 6]).fill({ color: 0x743185, alpha: .68 })
      .poly([0, 0, -17, -7, -11, 0, -32, 4, -14, 6]).fill({ color: 0xd998e3, alpha: .94 })
      .moveTo(-25, 3).lineTo(-8, 1).lineTo(0, 0).stroke({ color: 0xffd8f5, width: 1.4 })
    scratches.clear(); scratches.alpha = time >= .32 && time < 1.01 ? tip.alpha * .62 : 0
    for (let j = 1; j <= 7; j++) {
      const q = route(Math.max(0, u - j * .04)), z = route(Math.max(0, u - j * .04 - .025)), sign = j % 2 ? -1 : 1, side = Math.min(6, room(q) * .2) * sign
      scratches.moveTo(q.x + nx * side, q.y + ny * side).lineTo(z.x + nx * side * .5, z.y + ny * side * .5)
        .stroke({ color: j % 2 ? 0xdb8edc : 0x8854a5, width: 2.5 - j * .23, alpha: 1 - j / 9, cap: 'round' })
    }
    const age = time - .86, fade = struck && age >= 0 ? clamp(age / .07) * (1 - clamp((time - 1.29) / .5)) : 0
    curse.clear(); fit(curse, b, 79); curse.alpha = fade
    for (let j = 0; j < 4; j++) {
      const x = (j - 1.5) * 21, y = (j % 2 ? 1 : -1) * 7, drift = Math.sin(age * 5 + j) * 2
      curse.poly([x - 6 + drift, y - 37, x + 4, y - 15, x, y - 7, x + 9, y + 35,
        x - 3, y + 16, x - 2, y + 6, x - 12, y - 21]).fill({ color: j % 2 ? 0xb578c9 : 0x79448b, alpha: .42 })
      curse.moveTo(x - 4, y - 29).lineTo(x + 1, y - 8).lineTo(x - 2, y - 4).lineTo(x + 5, y + 23)
        .stroke({ color: 0xeab2e9, width: 1.5, alpha: .78 })
    }
    impact.clear(); fit(impact, b, 59); impact.alpha = struck && age >= 0 && age < .27 ? 1 - age / .27 : 0
    const cut = 16 + clamp(age / .27) * 29
    impact.moveTo(-cut, -cut * .72).lineTo(cut, cut * .72).moveTo(-cut * .72, cut).lineTo(cut * .72, -cut)
      .stroke({ color: 0xfbe0fa, width: 2.4 - clamp(age / .27), alpha: .85 })
    const spreadX = Math.min(94, Math.max(44, context.target.metrics.width / unit * .67)), spreadY = Math.min(63, Math.max(32, context.target.metrics.height / unit * .38))
    for (let i = 0; i < motes.length; i++) {
      const mote = motes[i], v = clamp((age - i * .045) / .88)
      const travel = .1 + .88 * (1 - (1 - v) ** 2), fitX = Math.max(0, Math.min(spreadX, b.x - left - 16, right - b.x - 16)), fitY = Math.max(0, Math.min(spreadY, b.y - top - 16, bottom - b.y - 16))
      const x = mote.side * fitX * travel, y = mote.row * fitY * (.12 + .64 * v) - Math.sin(v * Math.PI) * Math.min(12, fitY * .2)
      const q = { x: b.x + x, y: b.y + y }, g = mote.g
      g.clear(); fit(g, q, 13); g.rotation = mote.side * v * 2 + i * .6
      g.alpha = struck && age >= i * .045 && v < 1 ? Math.min(1, (age - i * .045) / .07) * (1 - v) : 0
      g.poly([0, -9, 4, -2, 9, 0, 3, 5, 0, 9, -5, 2, -8, 0, -3, -4]).fill({ color: 0xcc9bdd, alpha: .88 })
        .poly([0, -4, 2, 0, 0, 4, -2, 0]).fill(0xf9d7f4)
      mote.tail.clear(); mote.tail.alpha = g.alpha * .57
      mote.tail.moveTo(b.x + x * .62, b.y + y * .62).quadraticCurveTo(b.x + x * .76, b.y + y * .83 - Math.min(6, fitY * .1), q.x, q.y)
        .stroke({ color: 0xb885c8, width: 1.6, alpha: .7, cap: 'round' })
    }
  }
  onFrame(update)
  tl.call(() => { struck = true; update(.86); onCue({ type: 'impact' }) }, [], .86).to({}, { duration: 2.15 }, 0)
}
