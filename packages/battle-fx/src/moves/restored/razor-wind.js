import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function razorWind(context) {
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
  const back = Math.max(0, Math.min(6, sourceCenter.x - context.source.metrics.width / (2 * unit) - left))
  const recoil = Math.max(0, Math.min(9, right - targetCenter.x - context.target.metrics.width / (2 * unit)))
  const winding = make('razor-wind-charge')
  const blades = Array.from({ length: 2 }, (_, i) => ({ g: make(i === 0 ? 'razor-wind-tip' : 'razor-wind-blade-1'), start: .84 + i * .06, radius: i === 0 ? 53 : 43, lane: i === 0 ? -.8 : .9 }))
  const cut = make('razor-wind-impact')
  const threads = Array.from({ length: 22 }, (_, i) => ({ g: make(`razor-wind-thread-${i}`), angle: i * Math.PI / 11 + random() * .08, length: 11 + random() * 14, reach: 38 + random() * 43, life: .47 + random() * .42 }))
  let struck = false

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true)
    const dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx), nx = -Math.sin(angle), ny = Math.cos(angle)
    const growth = clamp(time / .8)
    winding.clear(); fit(winding, a, 85); winding.rotation = angle
    winding.alpha = time >= .04 && time < 1.02 ? Math.min(1, (time - .04) / .17, (1.02 - time) / .18) : 0
    // A long windup gathers thin, accelerating silver coils into a compact cutting edge.
    for (let j = 0; j < 5; j++) {
      const phase = j * 1.256 + time * (1.3 + growth * 3.4), radius = (29 + j * 8) * (1 - growth * .35)
      for (let k = 0; k <= 24; k++) {
        const theta = phase + k * .074, taper = .56 + k / 24 * .44
        const x = Math.cos(theta) * radius * .62 * taper - (1 - growth) * 6
        const y = Math.sin(theta) * radius * taper
        if (k === 0) winding.moveTo(x, y); else winding.lineTo(x, y)
      }
      winding.stroke({ color: j % 2 ? 0xbccdd7 : 0xf3fcff, width: 1.2 + growth * 1.3, alpha: .48 + growth * .32 })
    }
    winding.ellipse(0, 0, 3 + growth * 3, 9 + growth * 15).fill({ color: 0xf8ffff, alpha: growth * .57 })
    for (const blade of blades) {
      const age = time - blade.start, u = clamp(age / .32)
      const p = { x: a.x + dx * u, y: a.y + dy * u }
      const bow = Math.sin(Math.PI * u) * Math.min(30, room(p) * .48) * blade.lane
      p.x += nx * bow; p.y += ny * bow
      const r = blade.radius, g = blade.g
      g.clear(); fit(g, p, r * 2.15); g.rotation = angle + Math.cos(u * Math.PI) * blade.lane * .095
      g.alpha = age >= 0 && age < .48 ? Math.min(1, .88 + age * 5, (.48 - age) / .16) : 0
      // A broad folded air sheet has one exact front at (0, 0), with a long swept rear edge.
      g.moveTo(0, 0).quadraticCurveTo(-r * .18, -r * .69, -r * .69, -r)
        .quadraticCurveTo(-r * 1.11, -r * 1.12, -r * 1.51, -r * .78)
        .quadraticCurveTo(-r * .69, -r * .48, -r * .55, 0)
        .quadraticCurveTo(-r * .7, r * .49, -r * 1.51, r * .78)
        .quadraticCurveTo(-r * 1.11, r * 1.12, -r * .69, r)
        .quadraticCurveTo(-r * .18, r * .69, 0, 0).fill({ color: 0xc8e0ed, alpha: .2 })
      g.moveTo(0, 0).quadraticCurveTo(-r * .21, -r * .7, -r * .69, -r)
        .quadraticCurveTo(-r * .51, -r * .43, -r * .42, 0)
        .quadraticCurveTo(-r * .51, r * .43, -r * .69, r)
        .quadraticCurveTo(-r * .21, r * .7, 0, 0).fill({ color: 0xe5f1f7, alpha: .93 })
      g.moveTo(-r * .69, -r).quadraticCurveTo(-r * .21, -r * .7, 0, 0)
        .quadraticCurveTo(-r * .21, r * .7, -r * .69, r)
        .stroke({ color: 0xffffff, width: 2.3, alpha: .98 })
      for (let j = 0; j < 3; j++) {
        const offset = (j - 1) * r * .35
        g.moveTo(-r * .58, offset).quadraticCurveTo(-r * 1.02, offset - j * 2, -r * (1.67 + j * .08), offset - j * 4)
          .stroke({ color: 0xcbdee8, width: 1.2, alpha: .49 })
      }
    }
    const age = time - 1.16, u = clamp(age / .85)
    cut.clear(); fit(cut, b, 89); cut.rotation = angle
    cut.alpha = struck && age >= 0 && age < .85 ? 1 - u : 0
    for (let j = 0; j < 3; j++) {
      const r = (27 + j * 12) * (.75 + u * .55), lean = (j - 1) * .28 + age * .4
      const x = Math.sin(lean) * r, y = Math.cos(lean) * r
      cut.moveTo(-x, -y).quadraticCurveTo(r * .7, -r * .28, 0, 0)
        .quadraticCurveTo(-r * .4, r * .3, x, y)
        .stroke({ color: j === 1 ? 0xffffff : 0xd9ebf4, width: 4 - j * .9, alpha: .86 - j * .16 })
    }
    for (const thread of threads) {
      const v = clamp(age / thread.life), radius = Math.min(thread.reach, room(b) * .64) * v
      const p = { x: b.x + Math.cos(thread.angle) * radius, y: b.y + Math.sin(thread.angle) * radius }
      const g = thread.g; g.clear(); fit(g, p, thread.length * 1.6); g.rotation = thread.angle + age * .65
      g.alpha = struck && age >= 0 && age < thread.life ? Math.sin(Math.PI * v) * .81 : 0
      g.moveTo(-thread.length, -2).quadraticCurveTo(0, -7 * (1 - v), thread.length * .38, 0)
        .stroke({ color: 0xe4f4fc, width: 1.4, alpha: .9 })
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .58, ease: 'power1.inOut' }, 0)
    .to(attacker, { x: home.x, duration: .16, ease: 'power2.out' }, .67)
    .call(() => update(.84), [], .84)
    .call(() => { struck = true; update(1.16); onCue({ type: 'impact' }); defender.tint = 0xe6f5ff }, [], 1.16)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 5, yoyo: true }, 1.16)
    .call(() => { defender.tint = 0xffffff }, [], 1.52)
    .call(() => {}, [], 2.35)
}
