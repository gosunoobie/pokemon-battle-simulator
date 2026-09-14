import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function icyWind(context) {
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
  const thrust = Math.max(0, Math.min(4, right - sourceCenter.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(6, right - targetCenter.x - context.target.metrics.width / (2 * unit)))
  const breath = make('icy-wind-breath'), mist = make('icy-wind-stream'), tip = make('icy-wind-tip')
  const flakes = Array.from({ length: 34 }, (_, i) => ({
    g: make(`icy-wind-flake-${i}`), start: .38 + i * .023, phase: random() * Math.PI * 2,
    size: 4.2 + random() * 4.8, lane: (random() - .5) * 1.8, drift: (random() - .5) * 40,
    life: .28 + random() * .15, snow: i % 3 !== 0,
  }))
  const frost = make('icy-wind-impact')
  const wisps = Array.from({ length: 14 }, (_, i) => ({
    g: make(`icy-wind-frost-wisp-${i}`), start: .88 + i * .045, lane: i % 2 ? -1 : 1,
    phase: random() * Math.PI * 2, reach: 20 + random() * 35, life: .48 + random() * .2,
  }))
  let struck = false

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true)
    const dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx), nx = -Math.sin(angle), ny = Math.cos(angle)
    // The cold breeze sags toward the floor before rising to the live target socket.
    // Local positive y is gravity on either side of the field.
    const route = u => {
      const p = { x: a.x + dx * u, y: a.y + dy * u }
      p.y += Math.sin(u * Math.PI) * Math.min(38, room(p) * .52, Math.hypot(dx, dy) * .12)
      return p
    }
    breath.clear(); fit(breath, a, 47); breath.rotation = angle
    breath.alpha = time >= .05 && time < 1.36 ? Math.min(1, (time - .05) / .17, (1.36 - time) / .22) : 0
    for (let j = 0; j < 3; j++) {
      const phase = time * 3 + j * 2.1, radius = 17 + j * 8
      breath.arc(-4, 0, radius, phase, phase + 1.6).stroke({ color: j === 1 ? 0xe5ffff : 0x95ddea, width: 1.4, alpha: .35 })
    }
    const front = clamp((time - .38) / .5), tail = clamp((time - 1.16) / .5), head = route(front)
    mist.clear(); mist.alpha = time >= .38 && time < 1.7 ? Math.min(1, .7 + (time - .38) * 5, (1.7 - time) / .12) : 0
    if (front > tail) {
      // Four translucent wind ribbons leave space between their fine rippling seams.
      for (let lane = 0; lane < 4; lane++) {
        const outer = [], inner = []
        for (let j = 0; j <= 44; j++) {
          const t = j / 44, u = tail + (front - tail) * t, p = route(u)
          const taper = Math.sin(t * Math.PI) ** .6, clearance = room(p)
          const width = Math.min(9 + 20 * u, clearance * .7) * taper
          const ripple = Math.sin(u * 18 - time * 10 + lane * 1.7) * width * .18
          const lower = width * (lane / 2 - .91) + ripple, upper = lower + width * .46
          outer.push(p.x + nx * lower, p.y + ny * lower)
          inner.unshift(p.y + ny * upper); inner.unshift(p.x + nx * upper)
        }
        mist.poly([...outer, ...inner]).fill({ color: lane % 2 ? 0xc8f6ff : 0x78cddd, alpha: lane % 2 ? .12 : .09 })
      }
      for (let j = 0; j < 15; j++) {
        const u = (time * 1.75 + j / 15) % 1
        if (u <= tail || u >= front) continue
        const end = Math.min(front, u + .065), lane = (j % 5 - 2) * .36
        for (let k = 0; k <= 7; k++) {
          const v = u + (end - u) * k / 7, p = route(v)
          const width = Math.min(8 + 15 * v, room(p) * .54)
          const offset = (lane + Math.sin(v * 19 - time * 8 + j) * .16) * width
          if (k === 0) mist.moveTo(p.x + nx * offset, p.y + ny * offset)
          else mist.lineTo(p.x + nx * offset, p.y + ny * offset)
        }
        mist.stroke({ color: j % 2 ? 0xedffff : 0xb2e8f5, width: 1.15, alpha: .6 })
      }
    }
    tip.clear(); fit(tip, head, 35); tip.rotation = angle
    tip.alpha = time >= .38 && time < 1.7 ? Math.min(1, .86 + (time - .38) * 3, (1.7 - time) / .15) : 0
    tip.moveTo(0, 0).quadraticCurveTo(-9, -12, -26, -10)
      .quadraticCurveTo(-13, -5, -8, 0).quadraticCurveTo(-13, 7, -25, 11)
      .quadraticCurveTo(-9, 13, 0, 0).fill({ color: 0xdaf9ff, alpha: .33 })
      .moveTo(-21, -8).quadraticCurveTo(-7, -7, 0, 0)
      .quadraticCurveTo(-7, 8, -21, 9).stroke({ color: 0xedffff, width: 1.8, alpha: .9 })
    for (const flake of flakes) {
      const age = time - flake.start, u = clamp(age / .5), after = Math.max(0, age - .5), fall = clamp(after / flake.life)
      const p = route(u), width = Math.min(11 + 19 * u, room(p) * .48)
      const offset = Math.sin(Math.PI * u) * (flake.lane + Math.sin(u * 12 + flake.phase - time * 3) * .22) * width
      p.x += nx * offset; p.y += ny * offset
      if (after > 0) {
        const clearance = room(b), drift = Math.min(1, clearance / 65)
        p.x += (flake.drift * fall + Math.sin(flake.phase + after * 7) * 6 * fall) * drift
        p.y += Math.min(45, clearance * .5) * (fall * .35 + fall * fall * .65)
      }
      const g = flake.g, r = flake.size
      g.clear(); fit(g, p, r * 1.7); g.rotation = flake.phase + time * (flake.snow ? 2.1 : -3)
      g.alpha = age >= 0 && age < .5 + flake.life ? Math.min(1, age / .045) * (1 - fall) * .88 : 0
      if (flake.snow) {
        for (let j = 0; j < 6; j++) {
          const theta = j * Math.PI / 3, x = Math.cos(theta), y = Math.sin(theta)
          g.moveTo(0, 0).lineTo(x * r, y * r)
            .moveTo(x * r * .63 - y * r * .22, y * r * .63 + x * r * .22)
            .lineTo(x * r * .42, y * r * .42)
            .lineTo(x * r * .63 + y * r * .22, y * r * .63 - x * r * .22)
            .stroke({ color: 0xebffff, width: 1, alpha: .92 })
        }
      } else {
        g.poly([0, -r, r * .34, -r * .2, r * .2, r * .9, -r * .25, r * .34, -r * .43, -r * .25]).fill({ color: 0xb5e9fa, alpha: .88 })
          .moveTo(0, -r).lineTo(-r * .05, r * .75).stroke({ color: 0xf4ffff, width: .8 })
      }
    }
    const age = time - .88, u = clamp(age / 1.16)
    frost.clear(); fit(frost, b, 73); frost.rotation = age * .13
    frost.alpha = struck && age >= 0 && age < 1.16 ? (1 - u) * .87 : 0
    // A small frost flower opens once; the surrounding vapor keeps slipping downward.
    for (let j = 0; j < 6; j++) {
      const theta = j * Math.PI / 3, x = Math.cos(theta), y = Math.sin(theta), r = 14 + Math.min(1, age / .2) * 19
      frost.moveTo(x * 5, y * 5).lineTo(x * r, y * r)
        .moveTo(x * r * .74 - y * 6, y * r * .74 + x * 6)
        .lineTo(x * r * .54, y * r * .54).lineTo(x * r * .74 + y * 6, y * r * .74 - x * 6)
        .stroke({ color: 0xe4fdff, width: 1.6, alpha: .77 })
    }
    for (const wisp of wisps) {
      const age = time - wisp.start, v = clamp(age / wisp.life), reach = Math.min(wisp.reach, room(b) * .44)
      const p = { x: b.x + wisp.lane * reach * v, y: b.y + Math.min(34, room(b) * .33) * v * v }
      const g = wisp.g; g.clear(); fit(g, p, 31); g.rotation = Math.sin(wisp.phase + age * 3) * .15
      g.alpha = struck && age >= 0 && age < wisp.life ? Math.sin(v * Math.PI) * .48 : 0
      const wave = Math.sin(wisp.phase + age * 8) * 4
      g.moveTo(-23, 3).quadraticCurveTo(-9, -7 + wave, 4, -2).quadraticCurveTo(14, 4, 23, -3)
        .stroke({ color: 0xb9e8f3, width: 3.5, alpha: .2 })
        .moveTo(-20, 3).quadraticCurveTo(-8, -5 + wave, 5, 0).quadraticCurveTo(14, 5, 21, -1)
        .stroke({ color: 0xe8ffff, width: 1, alpha: .57 })
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .2 }, 0)
    .to(attacker, { x: home.x + thrust, duration: .16, ease: 'power2.out' }, .2)
    .call(() => update(.38), [], .38)
    .call(() => { struck = true; update(.88); onCue({ type: 'impact' }); defender.tint = 0xc9f5ff }, [], .88)
    .to(defender, { x: defenderHome.x + recoil, duration: .08, repeat: 5, yoyo: true }, .88)
    .call(() => { defender.tint = 0xffffff }, [], 1.38)
    .to(attacker, { x: home.x, duration: .27 }, 1.7)
    .call(() => {}, [], 2.25)
}
