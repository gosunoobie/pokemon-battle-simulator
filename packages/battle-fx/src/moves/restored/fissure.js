import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function fissure(context) {
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
  const lift = Math.max(0, Math.min(7, sourceCenter.y - context.source.metrics.height / (2 * unit) - top))
  const jolt = Math.max(0, Math.min(6, targetCenter.y - context.target.metrics.height / (2 * unit) - top))
  const recoil = Math.max(0, Math.min(5, right - targetCenter.x - context.target.metrics.width / (2 * unit)))
  const routeArt = make('fissure-chasm'), tip = make('fissure-tip'), impact = make('fissure-impact')
  const faults = Array.from({ length: 15 }, (_, i) => i === 0 || i === 14 ? 0 : (i % 2 ? -1 : 1) * (.45 + random() * .55))
  const slabs = Array.from({ length: 12 }, (_, i) => ({
    g: make(`fissure-slab-${i}`), u: .12 + i * .072, side: i % 2 ? -1 : 1,
    size: 11 + random() * 9, rise: 10 + random() * 11,
  }))
  const grit = Array.from({ length: 40 }, (_, i) => ({
    g: make(`fissure-grit-${i}`), start: 1.04 + i % 10 * .055, u: .25 + random() * .75,
    vx: (random() - .5) * 54, lift: 15 + random() * 30, life: .62 + random() * .29, size: 2 + random() * 3.5,
  }))
  const dust = Array.from({ length: 16 }, (_, i) => ({
    g: make(`fissure-dust-${i}`), start: .92 + i * .065, u: .35 + random() * .65,
    side: i % 2 ? -1 : 1, reach: 15 + random() * 27, life: .45 + random() * .13,
  }))
  let struck = false

  function update(time) {
    const a = socket('ground', true), b = targetSocket('floor')
    const dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx), nx = -Math.sin(angle), ny = Math.cos(angle)
    const at = u => {
      const p = { x: a.x + dx * u, y: a.y + dy * u }, index = Math.min(13, Math.floor(u * 14)), part = u * 14 - index
      const jag = (faults[index] + (faults[index + 1] - faults[index]) * part) * Math.min(11, room(p) * .19)
      return { x: p.x + nx * jag, y: p.y + ny * jag }
    }
    const front = clamp((time - .44) / .6), opening = clamp((time - .74) / .39), closing = clamp((time - 1.92) / .52)
    const aperture = opening * (1 - closing), head = at(front)
    routeArt.clear(); routeArt.alpha = time >= .44 && time < 2.5 ? Math.min(1, .82 + (time - .44) * 4, (2.5 - time) / .18) : 0
    if (front > 0) {
      const upper = [], lower = [], points = []
      for (let j = 0; j <= 56; j++) {
        const u = front * j / 56, p = at(u)
        const width = Math.min((1.8 + aperture * (10 + 12 * u)) * Math.sin(j / 56 * Math.PI) ** .45, room(p) * .65)
        upper.push(p.x - nx * width, p.y - ny * width)
        lower.unshift(p.y + ny * width); lower.unshift(p.x + nx * width)
        points.push({ p, width, u })
      }
      routeArt.poly([...upper, ...lower]).fill({ color: 0x1a1712, alpha: .94 })
      for (const side of [-1, 1]) {
        for (let j = 0; j < points.length; j++) {
          const { p, width } = points[j], x = p.x + nx * width * side, y = p.y + ny * width * side
          if (j === 0) routeArt.moveTo(x, y); else routeArt.lineTo(x, y)
        }
        routeArt.stroke({ color: side < 0 ? 0xd09a48 : 0x715431, width: 2, alpha: .9 })
      }
      for (let j = 1; j < 12; j++) {
        const u = j / 14
        if (u >= front) continue
        const p = at(u), branch = Math.min(13 + aperture * 15, room(p) * .45), side = j % 2 ? -1 : 1
        routeArt.moveTo(p.x, p.y).lineTo(p.x + nx * branch * side + Math.cos(angle) * 6, p.y + ny * branch * side + Math.sin(angle) * 6)
          .lineTo(p.x + nx * branch * side * 1.38, p.y + ny * branch * side * 1.38)
          .stroke({ color: 0x483820, width: 2.2, alpha: .82 * (1 - closing) })
      }
    }
    tip.clear(); fit(tip, head, 16); tip.rotation = angle
    tip.alpha = time >= .44 && time < 1.38 ? Math.min(1, .88 + (time - .44) * 4, (1.38 - time) / .23) : 0
    tip.poly([0, 0, -12, -4, -9, 0, -14, 4]).fill(0x20190f)
      .moveTo(-12, -4).lineTo(0, 0).lineTo(-14, 4).stroke({ color: 0xf1bd65, width: 1.4, alpha: .94 })
    impact.clear(); fit(impact, b, 88); impact.rotation = angle
    impact.alpha = struck && time >= 1.04 && time < 2.48 ? Math.min(1, (2.48 - time) / .2) : 0
    const spread = 13 + aperture * 43, depth = 3 + aperture * 19
    impact.poly([-spread, -depth * .1, -spread * .59, -depth, -spread * .2, -depth * .63, spread * .2, -depth * .9,
      spread, 0, spread * .45, depth * .82, spread * .05, depth, -spread * .49, depth * .68]).fill({ color: 0x171411, alpha: .95 })
      .moveTo(-spread, -depth * .1).lineTo(-spread * .59, -depth).lineTo(-spread * .2, -depth * .63)
      .lineTo(spread * .2, -depth * .9).lineTo(spread, 0).stroke({ color: 0xc08d48, width: 2.4, alpha: .95 })
      .moveTo(-spread * .49, depth * .68).lineTo(spread * .05, depth).lineTo(spread * .45, depth * .82)
      .lineTo(spread, 0).stroke({ color: 0x795531, width: 2.5, alpha: .95 })
    for (const slab of slabs) {
      const age = time - (.44 + slab.u * .6), growth = clamp(age / .19), p = at(slab.u)
      const clearance = room(p), displacement = Math.min(10 + aperture * 16, clearance * .29) * slab.side
      p.x += nx * displacement; p.y += ny * displacement - Math.min(slab.rise, clearance * .2) * growth * (1 - closing)
      const g = slab.g, r = slab.size
      g.clear(); fit(g, p, r * 1.75); g.rotation = angle + slab.side * aperture * .13
      g.alpha = age >= 0 && time < 2.48 ? Math.min(1, age / .09, (2.48 - time) / .18) * (1 - closing * .8) : 0
      g.poly([-r, 0, -r * .78, -r * .51, -r * .19, -r * .78, r * .59, -r * .38, r, 0, r * .54, r * .39, -r * .56, r * .28]).fill(0x8c704b)
        .poly([-r, 0, -r * .78, -r * .51, -r * .19, -r * .78, r * .59, -r * .38, r, 0, r * .18, -r * .04]).fill(0xb89a67)
        .poly([r * .18, -r * .04, r, 0, r * .54, r * .39, -r * .56, r * .28]).fill(0x665036)
        .moveTo(-r * .58, -r * .28).lineTo(-r * .2, -r * .08).lineTo(r * .08, -r * .3).stroke({ color: 0xd6b989, width: 1, alpha: .55 })
    }
    for (const grain of grit) {
      const age = time - grain.start, u = clamp(age / grain.life), base = at(grain.u), clearance = room(base)
      const p = { x: base.x + grain.vx * u * Math.min(1, clearance / 66), y: base.y - Math.min(grain.lift, clearance * .44) * Math.sin(u * Math.PI) + Math.min(10, clearance * .1) * u * u }
      const g = grain.g, r = grain.size
      g.clear(); fit(g, p, r * 1.9); g.rotation = age * 5 + grain.u * 8
      g.alpha = struck && age >= 0 && age < grain.life ? Math.min(1, age / .04, (grain.life - age) / .18) * .88 : 0
      g.poly([-r, 0, -r * .37, -r, r * .68, -r * .65, r, r * .57, -r * .2, r]).fill(0xb49562)
    }
    for (const puff of dust) {
      const age = time - puff.start, u = clamp(age / puff.life), base = at(puff.u), reach = Math.min(puff.reach, room(base) * .46)
      const p = { x: base.x + Math.cos(angle) * puff.side * reach * u, y: base.y + Math.sin(angle) * puff.side * reach * u - Math.min(16, room(base) * .18) * Math.sin(u * Math.PI * .7) }
      const g = puff.g; g.clear(); fit(g, p, 48); g.rotation = angle
      g.alpha = age >= 0 && age < puff.life ? Math.sin(u * Math.PI) * .34 : 0
      const r = 8 + u * 17
      g.ellipse(-r * .65, 0, r * .7, r * .35).fill({ color: 0xc5af84, alpha: .4 })
        .ellipse(r * .14, -2 - Math.sin(age * 9) * 2, r, r * .43).fill({ color: 0xb59b73, alpha: .32 })
        .ellipse(r * .7, 2, r * .64, r * .31).fill({ color: 0xd7c298, alpha: .28 })
    }
  }
  onFrame(update)
  tl.to(attacker, { y: home.y - lift, duration: .23, ease: 'power1.out' }, 0)
    .to(attacker, { y: home.y, duration: .19, ease: 'power2.in' }, .23)
    .call(() => update(.44), [], .44)
    .call(() => { struck = true; update(1.04); onCue({ type: 'impact' }); defender.tint = 0xe2c18c }, [], 1.04)
    .to(defender, { y: defenderHome.y - jolt, x: defenderHome.x + recoil, duration: .07, repeat: 5, yoyo: true }, 1.04)
    .call(() => { defender.tint = 0xffffff }, [], 1.47)
    .call(() => {}, [], 2.65)
}
