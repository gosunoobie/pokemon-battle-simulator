import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function silverWind(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n)), room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / extent)) }
  const sourceCenter = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const back = Math.max(0, Math.min(5, sourceCenter.x - context.source.metrics.width / (2 * unit) - left)), recoil = Math.max(0, Math.min(7, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const gathered = make('silver-wind-gather'), tip = make('silver-wind-tip'), shimmer = make('silver-wind-impact')
  const currents = Array.from({ length: 5 }, (_, i) => ({ g: make('silver-wind-current-' + i), at: .36 + i * .065, phase: i * 1.3, lane: (i - 2) * .4 }))
  const scales = Array.from({ length: 52 }, (_, i) => {
    const g = make('silver-wind-scale-' + i), r = 2.3 + random() * 1.9
    g.moveTo(-r, -r * .6).quadraticCurveTo(0, -r, r, -r * .55).lineTo(r * .65, r * .7).quadraticCurveTo(0, r * 1.1, -r * .7, r * .7).closePath()
      .fill(i % 4 === 0 ? 0xf4e9c8 : i % 2 ? 0xc7bbdf : 0xe7edf0)
      .moveTo(0, -r * .7).lineTo(0, r * .65).stroke({ color: 0xffffff, width: .7, alpha: .75 })
    return { g, at: .36 + i * .012, flight: .54 + random() * .14, phase: random() * 6.28, lane: (random() - .5) * 2, radius: 20 + random() * 39, life: .39 + random() * .17 }
  })
  let struck = false
  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true), dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx), nx = -Math.sin(angle), ny = Math.cos(angle)
    const position = (u, lane = 0, phase = 0) => {
      const p = { x: a.x + dx * u, y: a.y + dy * u }, bend = Math.sin(Math.PI * u) * Math.min(37, room(p) * .57) * lane * Math.sin(time * 5 + phase + u * 3)
      p.x += nx * bend; p.y += ny * bend; return p
    }
    gathered.clear(); fit(gathered, a, 43); gathered.alpha = time >= .05 && time < .55 ? clamp((time - .05) / .16) * (1 - clamp((time - .35) / .2)) * .8 : 0
    for (let j = 0; j < 8; j++) {
      const q = j * Math.PI / 4 + time * 2, radius = 30 * (1 - clamp(time / .42) * .5), x = Math.cos(q) * radius, y = Math.sin(q) * radius * .66
      gathered.ellipse(x, y, 2.7, 1.4).fill(j % 2 ? 0xd9cce9 : 0xf2f2e4)
      gathered.moveTo(x - Math.cos(q) * 8, y - Math.sin(q) * 6).lineTo(x - Math.cos(q) * 4, y - Math.sin(q) * 3).stroke({ color: 0xdbd5ed, width: 1.1, alpha: .6 })
    }
    const headAge = time - .36, u = clamp(headAge / .54), head = position(u)
    tip.clear(); fit(tip, head, 23); tip.rotation = angle; tip.alpha = headAge >= 0 && time < 1.25 ? .94 * (1 - clamp((time - 1.03) / .22)) : 0
    tip.poly([0, -4, 4, 0, 0, 4, -4, 0]).fill(0xfaf6ff)
    for (let j = 0; j < 3; j++) {
      const phase = time * 9 + j * 2.09, x = -7 - j * 3, y = Math.sin(phase) * 9
      tip.ellipse(x, y, 3, 1.6).fill(j % 2 ? 0xd1c5e5 : 0xf2edf1)
      tip.moveTo(-20, y * .55).quadraticCurveTo(-11, y + Math.cos(phase) * 4, -3, y * .55).stroke({ color: 0xe1d6ee, width: 1.1, alpha: .65 })
    }
    for (const p of currents) {
      const age = time - p.at, u = clamp(age / .54), at = position(u, p.lane, p.phase), g = p.g
      g.clear(); fit(g, at, 86); g.rotation = angle; g.alpha = age >= 0 && age < .93 ? clamp(age / .08) * (1 - clamp((age - .58) / .35)) * .79 : 0
      // Short, separated air curls carry scale dust; no continuous beam joins the actors.
      for (let lane = 0; lane < 3; lane++) {
        const phase = time * 5 + p.phase + lane, shift = (lane - 1) * 12
        for (let k = 0; k <= 24; k++) {
          const v = k / 24, x = -73 + v * 70, y = shift + Math.sin(v * 5.4 + phase) * (10 + lane * 2) * Math.sin(Math.PI * v)
          if (!k) g.moveTo(x, y); else g.lineTo(x, y)
        }
        g.stroke({ color: lane === 1 ? 0xf3f1f9 : 0xbbafd0, width: lane === 1 ? 1.8 : 1.15, alpha: lane === 1 ? .85 : .6, cap: 'round' })
      }
    }
    scales.forEach(p => {
      const age = time - p.at, u = clamp(age / p.flight), drift = Math.max(0, age - p.flight), at = position(u, p.lane, p.phase)
      if (drift > 0) { const spread = Math.min(p.radius, room(b) * .68) * clamp(drift / p.life), phase = p.phase + time * 4.2; at.x += Math.cos(phase) * spread; at.y += Math.sin(phase) * spread * .56 + Math.min(11, room(b) * .17) * (drift / p.life) ** 2 }
      fit(p.g, at, 7); p.g.rotation = angle + Math.sin(time * 9 + p.phase) * .9
      p.g.scale.x *= .3 + Math.abs(Math.cos(time * 12 + p.phase)) * .7
      p.g.alpha = age >= 0 && drift < p.life ? clamp(age / .065) * (1 - clamp(drift / p.life)) * (.53 + Math.sin(time * 14 + p.phase) ** 2 * .45) : 0
    })
    const age = time - .9, spread = clamp(age / .9)
    shimmer.clear(); fit(shimmer, b, 72); shimmer.alpha = struck && age >= 0 && age < .95 ? 1 - clamp(age / .95) : 0
    for (let j = 0; j < 11; j++) {
      const phase = j * Math.PI * 2 / 11 + time * (j % 2 ? 2.4 : -1.8), radius = 14 + spread * (28 + j % 3 * 5), x = Math.cos(phase) * radius, y = Math.sin(phase) * radius * .78, r = 2 + Math.sin(time * 17 + j) ** 2 * 3
      shimmer.moveTo(x - r, y).lineTo(x + r, y).moveTo(x, y - r).lineTo(x, y + r).stroke({ color: j % 3 ? 0xf8f4ff : 0xd4bee9, width: 1.3, alpha: .8 })
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .2, ease: 'power1.inOut' }, 0)
    .to(attacker, { x: home.x, duration: .14, ease: 'power2.out' }, .2)
    .call(() => update(.36), [], .36)
    .call(() => { struck = true; update(.9); onCue({ type: 'impact' }); defender.tint = 0xe3daee }, [], .9)
    .to(defender, { x: defenderHome.x + recoil, duration: .08, repeat: 3, yoyo: true }, .9)
    .call(() => { defender.tint = 0xffffff }, [], 1.23)
    .to({}, { duration: 2.3 }, 0)
}
