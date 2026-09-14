import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function sheerCold(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges)
  const top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const clamp = n => Math.max(0, Math.min(1, n))
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / extent)) }
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const sourceCenter = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const back = Math.max(0, Math.min(5, sourceCenter.x - context.source.metrics.width / (2 * unit) - left))
  const charge = make('sheer-cold-charge'), tip = make('sheer-cold-tip'), wake = make('sheer-cold-freeze-wake')
  const motes = Array.from({ length: 24 }, (_, i) => ({
    g: make(`sheer-cold-mote-${i}`), phase: i * Math.PI / 12, radius: 31 + random() * 27,
    size: 2.5 + random() * 3.5, start: .06 + i % 6 * .019,
  }))
  const impact = new Container(); impact.label = 'sheer-cold-impact'; impact.alpha = 0; temporary.addChild(impact)
  const prism = new Graphics(); prism.label = 'sheer-cold-prism'; impact.addChild(prism)
  const halfWidth = Math.max(28, context.target.metrics.width / (2 * unit) * 1.2)
  const halfHeight = Math.max(43, context.target.metrics.height / (2 * unit) * 1.18)
  const shards = Array.from({ length: 28 }, (_, i) => ({
    g: make(`sheer-cold-shard-${i}`), start: 1.78 + i % 4 * .027,
    x: (random() - .5) * 1.62, y: (random() - .5) * 1.62,
    size: 5 + random() * 9, drift: (random() - .5) * 54, fall: 35 + random() * 39,
    phase: random() * Math.PI * 2, life: .65 + random() * .1,
  }))
  const fog = Array.from({ length: 12 }, (_, i) => ({
    g: make(`sheer-cold-vapor-${i}`), start: 1.65 + i * .018, side: i % 2 ? -1 : 1,
    reach: 15 + random() * 29, phase: random() * Math.PI * 2, life: .55 + random() * .17,
  }))
  let struck = false

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true)
    const v = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center', true)
    const dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx), nx = -Math.sin(angle), ny = Math.cos(angle)
    const growth = clamp((time - .06) / .52)
    charge.clear(); fit(charge, a, 61); charge.rotation = time * .4
    charge.alpha = time >= .06 && time < .85 ? Math.min(1, (time - .06) / .17, (.85 - time) / .22) : 0
    const radius = 8 + growth * 14
    for (let j = 0; j < 6; j++) {
      const theta = j * Math.PI / 3, x = Math.cos(theta), y = Math.sin(theta)
      charge.moveTo(x * 3, y * 3).lineTo(x * radius, y * radius)
        .moveTo(x * radius * .7 - y * 4, y * radius * .7 + x * 4).lineTo(x * radius * .5, y * radius * .5)
        .lineTo(x * radius * .7 + y * 4, y * radius * .7 - x * 4).stroke({ color: 0xe8ffff, width: 1.7, alpha: .85 })
    }
    charge.circle(0, 0, radius * .4).fill({ color: 0xbceeff, alpha: .16 })
    for (const mote of motes) {
      const u = clamp((time - mote.start) / (.58 - mote.start)), theta = mote.phase + u * 1.5
      const r = Math.min(mote.radius, room(a) * .65) * (1 - u)
      const p = { x: a.x + Math.cos(theta) * r, y: a.y + Math.sin(theta) * r }
      const g = mote.g, size = mote.size
      g.clear(); fit(g, p, size * 1.8); g.rotation = theta + time
      g.alpha = time >= mote.start && time < .66 ? Math.min(1, (time - mote.start) / .1, (.66 - time) / .08) * .87 : 0
      g.poly([0, -size, size * .38, 0, 0, size, -size * .38, 0]).fill(0xdaf8ff)
    }
    const front = clamp((time - .58) / .58), head = { x: a.x + dx * front, y: a.y + dy * front }
    tip.clear(); fit(tip, head, 61); tip.rotation = angle
    tip.alpha = time >= .58 && time < 1.41 ? Math.min(1, .91 + (time - .58) * 3, (1.41 - time) / .23) : 0
    // A single abrupt, faceted freezing edge crosses the field before the enclosure grows.
    tip.poly([0, 0, -17, -38, -32, -24, -21, 0, -32, 24, -17, 38]).fill({ color: 0x86d8f7, alpha: .18 })
      .poly([0, 0, -17, -38, -11, -12, -15, 0, -11, 12, -17, 38]).fill({ color: 0xe9fbff, alpha: .74 })
      .moveTo(-17, -38).lineTo(-8, -16).lineTo(0, 0).lineTo(-8, 16).lineTo(-17, 38)
      .stroke({ color: 0xf5ffff, width: 2.2, alpha: .95 })
      .poly([-13, 0, -21, -7, -37, 0, -21, 7]).fill({ color: 0xb4e9ff, alpha: .41 })
    wake.clear(); wake.alpha = time >= .58 && time < 1.34 ? Math.min(1, (1.34 - time) / .18) : 0
    for (let j = 0; j < 13; j++) {
      const u = Math.max(0, front - .022 * (j + 1)), p = { x: a.x + dx * u, y: a.y + dy * u }
      const r = Math.min(3 + j % 3 * 2, room(p) * .3), side = j % 2 ? -1 : 1
      const offset = Math.min(13, room(p) * .4) * side * Math.sin(front * Math.PI)
      wake.poly([p.x + nx * offset, p.y + ny * offset - r,
        p.x + nx * offset + r * .37, p.y + ny * offset,
        p.x + nx * offset, p.y + ny * offset + r,
        p.x + nx * offset - r * .37, p.y + ny * offset]).fill({ color: 0xd7f7ff, alpha: (1 - j / 15) * .6 })
    }
    const age = time - 1.16, grow = .2 + clamp(age / .28) * .8, breakUp = clamp((time - 1.78) / .31)
    const w = halfWidth, h = halfHeight
    const cageFit = Math.max(0, Math.min(1, (v.x - left - 4) / (w + 5), (right - v.x - 4) / (w + 5), (v.y - top - 4) / (h + 5), (bottom - v.y - 4) / (h + 5)))
    impact.position.copyFrom(b); impact.alpha = struck && age >= 0 && time < 2.12 ? 1 - breakUp : 0
    prism.clear(); prism.position.set(v.x - b.x, v.y - b.y); prism.scale.set(cageFit * grow)
    // Transparent planes preserve the target silhouette inside the large hexagonal ice prism.
    prism.poly([0, -h, w * .86, -h * .58, w, h * .58, 0, h, -w, h * .58, -w * .86, -h * .58]).fill({ color: 0xace7fa, alpha: .075 })
      .poly([0, -h, w * .86, -h * .58, w, h * .58, 0, h, w * .22, h * .31, w * .14, -h * .43]).fill({ color: 0x7ccbea, alpha: .15 })
      .poly([0, -h, -w * .86, -h * .58, -w, h * .58, 0, h, -w * .21, h * .31, -w * .14, -h * .43]).fill({ color: 0xd4f8ff, alpha: .11 })
      .poly([0, -h, w * .86, -h * .58, w, h * .58, 0, h, -w, h * .58, -w * .86, -h * .58]).stroke({ color: 0xe5fcff, width: 2, alpha: .9 })
      .moveTo(0, -h).lineTo(-w * .14, -h * .43).lineTo(-w * .21, h * .31).lineTo(0, h)
      .moveTo(0, -h).lineTo(w * .14, -h * .43).lineTo(w * .22, h * .31).lineTo(0, h)
      .moveTo(-w * .86, -h * .58).lineTo(-w * .14, -h * .43).lineTo(w * .14, -h * .43).lineTo(w * .86, -h * .58)
      .stroke({ color: 0xc8f2ff, width: 1.2, alpha: .64 })
    const frost = clamp((age - .08) / .38)
    for (let j = 0; j < 8; j++) {
      const theta = j * Math.PI / 4, x = Math.cos(theta) * w * .79 * frost, y = Math.sin(theta) * h * .77 * frost
      prism.moveTo(0, 0).lineTo(x * .34 + y * .06, y * .35).lineTo(x * .67 - y * .045, y * .7).lineTo(x, y)
        .moveTo(x * .58 - y * .1, y * .58 + x * .12).lineTo(x * .42, y * .42)
        .lineTo(x * .63 + y * .09, y * .55 - x * .13).stroke({ color: 0xecffff, width: 1.25, alpha: .63 })
    }
    for (const shard of shards) {
      const age = time - shard.start, u = clamp(age / shard.life)
      const base = { x: v.x + shard.x * w * cageFit, y: v.y + shard.y * h * cageFit }, clearance = room(base)
      const p = { x: base.x + shard.drift * u * Math.min(1, clearance / 62), y: base.y + Math.min(shard.fall, clearance * .65) * (u * .27 + u * u * .73) }
      const g = shard.g, r = shard.size
      g.clear(); fit(g, p, r * 1.9); g.rotation = shard.phase + u * (shard.x > 0 ? 1.1 : -1.1)
      g.alpha = struck && age >= 0 && age < shard.life ? Math.min(1, age / .045, (shard.life - age) / .23) * .8 : 0
      g.poly([0, -r * 1.25, r * .48, -r * .3, r * .33, r, -r * .43, r * .47, -r * .58, -r * .45]).fill({ color: 0xb9ebff, alpha: .5 })
        .moveTo(0, -r * 1.25).lineTo(-r * .08, r * .7).lineTo(r * .33, r)
        .stroke({ color: 0xecffff, width: 1.1, alpha: .89 })
    }
    for (const puff of fog) {
      const age = time - puff.start, u = clamp(age / puff.life), clearance = room(v), reach = Math.min(puff.reach, clearance * .36)
      const p = { x: v.x + puff.side * reach * u, y: v.y + Math.min(h * .61, clearance * .5) + Math.min(15, clearance * .13) * u }
      const g = puff.g; g.clear(); fit(g, p, 36); g.rotation = Math.sin(puff.phase + age * 4) * .1
      g.alpha = struck && age >= 0 && age < puff.life ? Math.sin(u * Math.PI) * .36 : 0
      g.ellipse(-9, 0, 15 + u * 5, 4 + u * 3).fill({ color: 0xb7e7f5, alpha: .23 })
        .moveTo(-24, 2).quadraticCurveTo(-6, -6 + Math.sin(age * 8) * 2, 10, 0).quadraticCurveTo(17, 4, 25, 0)
        .stroke({ color: 0xddfaff, width: 1.1, alpha: .58 })
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .34 }, 0)
    .to(attacker, { x: home.x, duration: .18 }, .35)
    .call(() => update(.58), [], .58)
    .call(() => { struck = true; update(1.16); onCue({ type: 'impact' }); defender.tint = 0xd3f7ff }, [], 1.16)
    .call(() => { defender.tint = 0xffffff }, [], 1.81)
    .call(() => {}, [], 2.7)
}
