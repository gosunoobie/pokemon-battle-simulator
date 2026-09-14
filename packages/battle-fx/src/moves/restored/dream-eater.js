import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function dreamEater(context) {
  const { tl, onFrame, onCue, random } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const ends = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...ends), right = Math.max(...ends), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const fit = (g, p, radius) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / radius)) }
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const root = make('dream-eater-root'), thought = make('dream-eater-thought-ribbon'), tip = make('dream-eater-tip')
  const corona = make('dream-eater-dream-corona'), impact = make('dream-eater-impact'), siphon = make('dream-eater-siphon')
  const sleepMotes = Array.from({ length: 12 }, (_, i) => ({ g: make(`dream-eater-sleep-mote-${i}`), phase: i / 12, size: 3.5 + random() * 2 }))
  const packets = Array.from({ length: 12 }, (_, i) => ({
    g: make(i ? `dream-eater-return-mote-${i}` : 'dream-eater-recovery-tip'),
    trail: make(`dream-eater-return-trail-${i}`), start: .72 + i * .055,
    lane: i % 2 ? 1 : -1, phase: i * .83, radius: i ? 5 + random() * 1.7 : 8,
  }))
  const receive = make('dream-eater-receive')
  const glints = Array.from({ length: 16 }, (_, i) => ({ g: make(`dream-eater-receive-glint-${i}`), phase: i * Math.PI / 8 }))
  let touched = false, recovered = false

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true), c = socket('aura', true)
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy))
    const thoughtPath = u => {
      const p = { x: a.x + dx * u, y: a.y + dy * u }
      const bow = Math.sin(Math.PI * u) * Math.min(35, distance * .09, room(p) * .46)
      return { x: p.x, y: p.y - bow }
    }
    const rx = c.x - b.x, ry = c.y - b.y, returnDistance = Math.max(1, Math.hypot(rx, ry)), nx = -ry / returnDistance, ny = rx / returnDistance
    const dreamPath = (u, lane) => {
      const p = { x: b.x + rx * u, y: b.y + ry * u }
      const wave = Math.sin(Math.PI * u) * (Math.sin(u * Math.PI * 2 - time * 1.5) * .65 + lane * .42)
      const bend = wave * Math.min(44, returnDistance * .12, room(p) * .5)
      return { x: p.x + nx * bend, y: p.y + ny * bend }
    }

    root.clear(); fit(root, a, 40)
    root.alpha = time >= .025 && time < .61 ? Math.min(1, (time - .025) / .13, (.61 - time) / .25) : 0
    const gather = clamp(time / .24)
    root.moveTo(-21, -11).quadraticCurveTo(0, 15 - gather * 7, 21, -11)
      .quadraticCurveTo(0, 23 - gather * 7, -21, -11).fill({ color: 0xd4b9ef, alpha: .66 })
      .moveTo(-15, 10).quadraticCurveTo(0, 23, 15, 10).stroke({ color: 0xe7a6ce, width: 1.4, alpha: .67 })
      .circle(0, -5, 3 + gather * 2).fill({ color: 0xffd9ec, alpha: .83 })
    for (let j = 0; j < 3; j++) {
      const angle = time * 2.4 + j * Math.PI * 2 / 3, radius = 25 - gather * 9
      root.circle(Math.cos(angle) * radius, Math.sin(angle) * radius, 1.4).fill(0xeed7f9)
    }

    const u = clamp((time - .24) / .42), front = thoughtPath(u), ahead = thoughtPath(Math.min(1, u + .003)), behind = thoughtPath(Math.max(0, u - .003))
    tip.clear(); fit(tip, front, 44); tip.rotation = Math.atan2(ahead.y - behind.y, ahead.x - behind.x)
    tip.alpha = time >= .24 && time < .81 ? Math.min(1, (time - .24) / .055, (.81 - time) / .15) : 0
    // The crescent's forward point is local zero, so the visible thought meets its receiver exactly.
    tip.moveTo(0, 0).bezierCurveTo(-10, -19, -29, -17, -33, -3)
      .quadraticCurveTo(-35, 15, -14, 17).quadraticCurveTo(-26, 6, -21, -5)
      .quadraticCurveTo(-14, -11, 0, 0).fill({ color: 0xbea0dd, alpha: .86 })
      .moveTo(0, 0).quadraticCurveTo(-15, -13, -26, -6).stroke({ color: 0xffd7eb, width: 2.4, alpha: .92 })
      .circle(0, 0, 1.2).fill(0xffedf8)
    thought.clear(); thought.alpha = time >= .24 && time < .84 ? Math.min(1, (time - .24) / .08, (.84 - time) / .18) : 0
    for (let j = 0; j < 26; j++) {
      const v = Math.max(0, u - .6 + j * .6 / 26), q = thoughtPath(v), z = thoughtPath(Math.min(u, v + .6 / 26)), weight = (j + 1) / 26
      thought.moveTo(q.x, q.y).lineTo(z.x, z.y).stroke({ color: 0xaa83c6, width: 5.5 * weight, alpha: weight * .22, cap: 'round' })
        .moveTo(q.x, q.y).lineTo(z.x, z.y).stroke({ color: 0xe8b5db, width: 1.8 * weight, alpha: weight * .64, cap: 'round' })
    }

    const age = time - .66, dreamFade = touched && age >= 0 ? clamp(age / .12) * (1 - clamp((time - 1.64) / .44)) : 0
    const haloX = Math.min(81, Math.max(38, context.target.metrics.width / unit * .53)), haloY = Math.min(87, Math.max(40, context.target.metrics.height / unit * .52))
    const haloFit = Math.max(0, Math.min(1, (b.x - left - 5) / (haloX + 8), (right - b.x - 5) / (haloX + 8), (b.y - top - 5) / (haloY + 8), (bottom - b.y - 5) / (haloY + 8)))
    corona.clear(); corona.position.copyFrom(b); corona.scale.set(haloFit); corona.alpha = dreamFade
    for (let j = 0; j < 3; j++) {
      const theta = j * Math.PI * 2 / 3 - time * .7
      for (let k = 0; k <= 28; k++) {
        const v = k / 28, angle = theta + v * Math.PI * 1.1, radius = .78 + Math.sin(v * Math.PI) * .1
        const x = Math.cos(angle) * haloX * radius, y = Math.sin(angle) * haloY * radius
        k ? corona.lineTo(x, y) : corona.moveTo(x, y)
      }
      corona.stroke({ color: j === 1 ? 0xe3a8ce : 0xb1a0dc, width: j === 1 ? 1.7 : 1.2, alpha: .47, cap: 'round' })
    }
    impact.clear(); fit(impact, b, 56); impact.alpha = touched && age >= 0 && age < .38 ? 1 - age / .38 : 0
    const opening = 8 + clamp(age / .38) * 34
    for (const side of [-1, 1]) {
      impact.moveTo(0, -opening).quadraticCurveTo(side * opening, 0, 0, opening)
        .quadraticCurveTo(side * opening * .48, 0, 0, -opening).fill({ color: side < 0 ? 0xeac0ed : 0xc6b0e4, alpha: .43 })
    }
    impact.circle(0, 0, 4.5 * (1 - clamp(age / .38)) + 1).fill(0xffeafa)
    for (const mote of sleepMotes) {
      const v = (Math.max(0, age) * .6 + mote.phase) % 1, angle = mote.phase * Math.PI * 2 + time * .42
      const p = { x: b.x + Math.cos(angle) * haloX * .67 * haloFit, y: b.y + haloY * (.58 - v * 1.31) * haloFit }, g = mote.g, r = mote.size
      g.clear(); fit(g, p, r * 2); g.rotation = Math.sin(time * 2 + mote.phase * 8) * .4
      g.alpha = dreamFade * Math.sin(v * Math.PI) * .72
      if (mote.phase * 12 % 3 < 1) {
        g.moveTo(-r, -r).quadraticCurveTo(r * 1.2, -r * .6, r, r)
          .quadraticCurveTo(-r * 1.4, r * .5, -r, -r).fill({ color: 0xe3b7df, alpha: .76 })
      } else {
        g.moveTo(r * .7, -r).quadraticCurveTo(-r * 1.5, -r * .2, 0, r)
          .quadraticCurveTo(-r * .55, -r * .1, r * .7, -r).fill(0xc9b5e8)
      }
    }

    siphon.clear(); siphon.alpha = time >= .72 && time < 2.17 ? Math.min(1, (time - .72) / .16, (2.17 - time) / .24) * .67 : 0
    if (siphon.alpha) {
      const leading = clamp((time - .72) / .66), trailing = clamp((time - 1.4) / .66)
      for (const lane of [-1, 1]) {
        for (let k = 0; k <= 42; k++) {
          const v = trailing + (leading - trailing) * k / 42, p = dreamPath(v, lane)
          k ? siphon.lineTo(p.x, p.y) : siphon.moveTo(p.x, p.y)
        }
        siphon.stroke({ color: lane < 0 ? 0xc5ade7 : 0xe7accc, width: lane < 0 ? 2 : 1.4, alpha: .43, cap: 'round' })
      }
    }
    for (const packet of packets) {
      const age = time - packet.start, progress = clamp(age / .66), p = dreamPath(progress, packet.lane), g = packet.g, r = packet.radius
      const next = dreamPath(Math.min(1, progress + .003), packet.lane), prev = dreamPath(Math.max(0, progress - .003), packet.lane)
      g.clear(); fit(g, p, r * 2.7); g.rotation = packet.phase + time * 1.8
      g.alpha = age >= 0 && age < .81 ? Math.min(1, age / .065, (.81 - age) / .15) : 0
      // The luminous center, including the first recovery mote, arrives at the aura socket.
      g.circle(0, 0, r * 1.55).fill({ color: 0xc89ce0, alpha: .11 })
        .circle(0, 0, r * .65).fill(packet.lane < 0 ? 0xf2c6e2 : 0xdac8f4)
        .circle(0, 0, r * .26).fill(0xffeffa)
        .moveTo(r * .8, -r * 1.5).quadraticCurveTo(-r * 2.3, -r * .3, -r * .1, r * 1.4)
        .quadraticCurveTo(-r * 1.3, 0, r * .8, -r * 1.5).fill({ color: 0xe6b6df, alpha: .69 })
      const heading = Math.atan2(next.y - prev.y, next.x - prev.x), tail = packet.trail
      tail.clear(); tail.alpha = age >= 0 && age < .66 ? g.alpha * .64 : 0
      const tailLength = Math.min(23, room(p) * .52) * Math.sin(progress * Math.PI)
      tail.moveTo(p.x - Math.cos(heading) * tailLength, p.y - Math.sin(heading) * tailLength).lineTo(p.x, p.y)
        .stroke({ color: packet.lane < 0 ? 0xf3c9e5 : 0xd6c0ef, width: 1.7, alpha: .73, cap: 'round' })
    }

    const receiveAge = time - 1.38, receiveFade = recovered && receiveAge >= 0 ? 1 - clamp((time - 2.14) / .43) : 0
    receive.clear(); fit(receive, c, 76); receive.alpha = receiveFade
    const settle = clamp(receiveAge / .28), pulse = .94 + Math.sin(Math.max(0, receiveAge) * 7) * .035
    receive.ellipse(0, 0, 35 * pulse, 43 * pulse).fill({ color: 0xe5b8df, alpha: .055 })
    for (const side of [-1, 1]) {
      const spread = 28 + settle * 19
      receive.moveTo(0, -spread).quadraticCurveTo(side * spread * 1.35, -spread * .45, side * spread * .93, spread * .61)
        .quadraticCurveTo(side * spread * .83, spread * .21, side * spread * .72, 0)
        .quadraticCurveTo(side * spread * .54, -spread * .61, 0, -spread).fill({ color: side < 0 ? 0xccb5eb : 0xeabbdc, alpha: .51 })
    }
    receive.moveTo(-28, 30).quadraticCurveTo(0, 46, 28, 30).stroke({ color: 0xf6dbec, width: 1.9, alpha: .7 })
    const receiveRadius = Math.min(67, room(c) * .8)
    for (const glint of glints) {
      const angle = glint.phase + Math.max(0, receiveAge) * .85, radius = receiveRadius * (.48 + .35 * Math.sin(Math.max(0, receiveAge) * 2 + glint.phase) ** 2)
      const p = { x: c.x + Math.cos(angle) * radius, y: c.y + Math.sin(angle) * radius * .85 }, g = glint.g
      g.clear(); fit(g, p, 8); g.rotation = angle
      g.alpha = receiveFade * (.24 + .4 * Math.sin(time * 3 + glint.phase) ** 2)
      g.poly([0, -5, 1.3, -1.3, 5, 0, 1.3, 1.3, 0, 5, -1.3, 1.3, -5, 0, -1.3, -1.3]).fill(0xf2d7ef)
    }
  }
  onFrame(update)
  tl.call(() => { touched = true; update(.66); onCue({ type: 'impact' }) }, [], .66)
    .call(() => { recovered = true; update(1.38); onCue({ type: 'recovery' }) }, [], 1.38)
    .to({}, { duration: 2.65 }, 0)
}
