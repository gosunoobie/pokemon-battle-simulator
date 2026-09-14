import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function bide(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / extent)) }
  const bands = [make('bide-restraint-0'), make('bide-restraint-1')], root = make('bide-root'), tip = make('bide-tip'), impact = make('bide-impact')
  root.attachmentSocket = 'emission'; tip.attachmentSocket = 'emission'; tip.contactPoint = { x: 0, y: 0 }
  const charges = Array.from({ length: 18 }, (_, i) => ({ g: make(`bide-charge-spark-${i}`), phase: i / 18 }))
  const wakes = Array.from({ length: 3 }, (_, i) => ({ g: make(`bide-pressure-wake-${i}`), lag: .055 + i * .057 }))
  const ripples = Array.from({ length: 3 }, (_, i) => ({ g: make(`bide-force-ripple-${i}`), at: 1.58 + i * .055 }))
  const cinders = Array.from({ length: 18 }, (_, i) => ({ g: make(`bide-cinder-${i}`), at: 1.58 + i % 3 * .04, side: i % 2 ? -1 : 1, reach: .3 + random() * .65, lift: .2 + random() * .4, size: 1.5 + random() * 2 }))
  let hitPoint = null

  function update(time) {
    const c = socket('center', true), a = socket('emission', true), b = targetSocket('center', true)
    const rx = Math.min(105, Math.max(54, context.source.metrics.width / unit * .57)), ry = Math.min(101, Math.max(51, context.source.metrics.height / unit * .53))
    const sx = Math.max(0, Math.min(1, (c.x - left - 6) / (rx + 11), (right - c.x - 6) / (rx + 11)))
    const sy = Math.max(0, Math.min(1, (c.y - top - 6) / (ry + 11), (bottom - c.y - 6) / (ry + 11)))
    const compress = 1 - clamp((time - .97) / .21) * .49, releaseFade = 1 - clamp((time - 1.18) / .2)
    bands.forEach((g, i) => {
      const build = clamp((time - (.08 + i * .39)) / .38), tilt = i ? -.51 : .51
      g.clear(); g.position.copyFrom(c); g.scale.set(sx, sy); g.alpha = time >= .08 + i * .39 && time < 1.38 ? build * releaseFade : 0
      // Two broad restraint bands visibly build in sequence, then cinch before release.
      const radius = (.87 + Math.sin(time * 9 + i) * .025) * compress, half = (3.2 + build * 2.2) * compress
      for (let j = 0; j < 56; j++) {
        const q = j * Math.PI * 2 / 56 + time * (i ? -.73 : .73), next = q + Math.PI * 2 / 56
        const p = angle => ({ x: Math.cos(angle) * rx * radius, y: Math.sin(angle) * ry * .34 * radius + Math.cos(angle) * ry * tilt * radius })
        const f = p(q), z = p(next)
        g.poly([f.x, f.y - half, z.x, z.y - half, z.x, z.y + half, f.x, f.y + half]).fill({ color: i ? 0xeaa44f : 0xc86451, alpha: Math.sin(q) > 0 ? .69 : .27 })
        if (j % 4 < 2) g.moveTo(f.x, f.y - half * .55).lineTo(z.x, z.y - half * .55).stroke({ color: i ? 0xffdc9a : 0xf3a36e, width: 1.5, alpha: .78, cap: 'round' })
      }
    })
    const chargeFade = clamp((time - .13) / .2) * releaseFade
    charges.forEach(p => {
      const u = (time * .88 + p.phase) % 1, q = p.phase * Math.PI * 2 + time * .35, distance = (.97 - u * .54) * compress
      const at = { x: c.x + Math.cos(q) * rx * distance * sx, y: c.y + Math.sin(q) * ry * .73 * distance * sy }, g = p.g
      g.clear(); fit(g, at, 9); g.rotation = q
      g.alpha = time < 1.38 ? chargeFade * Math.sin(u * Math.PI) * .86 : 0
      g.poly([-5, 0, -1, -2, 4, -1, 1, 1, 5, 2, -2, 2]).fill(p.phase < .5 ? 0xf9bd6e : 0xe9805c)
    })
    const dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx), u = clamp((time - 1.18) / .4), front = { x: a.x + dx * u, y: a.y + dy * u }
    root.clear(); fit(root, a, 41); root.rotation = angle
    root.alpha = time >= .86 && time < 1.52 ? clamp((time - .86) / .28) * (1 - clamp((time - 1.23) / .29)) : 0
    const aperture = 8 + clamp((time - .91) / .27) * 12
    root.moveTo(-8, -aperture).quadraticCurveTo(aperture, -aperture * .88, aperture * .92, 0).quadraticCurveTo(aperture, aperture * .88, -8, aperture)
      .stroke({ color: 0xffd495, width: 4.2, alpha: .8, cap: 'round' })
      .moveTo(-12, -aperture * .63).quadraticCurveTo(8, 0, -12, aperture * .63).stroke({ color: 0xd67a51, width: 3, alpha: .8, cap: 'round' })
    wakes.forEach((p, i) => {
      const v = clamp((time - 1.18 - p.lag) / .4), at = { x: a.x + dx * v, y: a.y + dy * v }, g = p.g
      g.clear(); fit(g, at, 46); g.rotation = angle
      g.alpha = time >= 1.18 + p.lag && time < 1.86 ? (.55 - i * .1) * (1 - clamp((time - 1.6) / .26)) : 0
      const r = 19 + i * 5
      g.moveTo(-r * .45, -r).quadraticCurveTo(r * .18, 0, -r * .45, r).stroke({ color: i % 2 ? 0xed9f5e : 0xfbd298, width: 3.4 - i * .7, alpha: .66, cap: 'round' })
    })
    tip.clear(); fit(tip, front, 75); tip.rotation = angle
    tip.alpha = time >= 1.18 && time < 1.82 ? 1 - clamp((time - 1.62) / .2) : 0
    // A short, broad force packet releases the compressed bands; its front stays at zero.
    tip.moveTo(0, 0).bezierCurveTo(-4, -28, -20, -36, -37, -25).lineTo(-61, -15)
      .quadraticCurveTo(-43, -3, -60, 14).lineTo(-36, 25).bezierCurveTo(-18, 35, -4, 27, 0, 0)
      .closePath().fill({ color: 0xda8455, alpha: .43 })
      .moveTo(-2, 0).quadraticCurveTo(-5, -25, -25, -27).stroke({ color: 0xffdf9e, width: 3.4, alpha: .96, cap: 'round' })
      .moveTo(-2, 0).quadraticCurveTo(-5, 25, -25, 27).stroke({ color: 0xffdf9e, width: 3.4, alpha: .96, cap: 'round' })
    for (const x of [-18, -33, -46]) tip.moveTo(x - 9, -20).quadraticCurveTo(x + 9, 0, x - 9, 20).stroke({ color: x === -18 ? 0xffedb6 : 0xecaa69, width: x === -18 ? 4.3 : 2.6, alpha: .77, cap: 'round' })
    const target = hitPoint ?? b, age = time - 1.58, expand = clamp(age / .5)
    impact.clear(); fit(impact, target, 83); impact.rotation = angle; impact.alpha = hitPoint && age >= 0 && age < .68 ? 1 - clamp((age - .09) / .59) : 0
    const r = 12 + expand * 48
    for (const side of [-1, 1]) impact.moveTo(-r * .2, side * r).quadraticCurveTo(r * .75, 0, -r * .2, -side * r)
      .stroke({ color: side < 0 ? 0xffd891 : 0xe08c57, width: 4.6 - expand * 2.2, alpha: .72, cap: 'round' })
    for (let j = 0; j < 6; j++) {
      const q = j * Math.PI / 3 + .2, inner = 10 + expand * 19, outer = inner + 11 * (1 - expand)
      impact.moveTo(Math.cos(q) * inner, Math.sin(q) * inner).lineTo(Math.cos(q) * outer, Math.sin(q) * outer).stroke({ color: 0xffe2a7, width: 3 - expand, alpha: .8, cap: 'round' })
    }
    ripples.forEach((p, i) => {
      const age = time - p.at, v = clamp(age / 1.04), drift = Math.min(13, room(target) * .15) * v
      const at = { x: target.x + Math.cos(angle) * drift, y: target.y + Math.sin(angle) * drift + Math.min(8, room(target) * .08) * v * v }, g = p.g
      g.clear(); fit(g, at, 92); g.rotation = angle + Math.sin(time * 3 + i) * .025
      g.alpha = hitPoint && age >= 0 && age < 1.04 ? clamp(age / .07) * (1 - clamp((v - .45) / .55)) * .6 : 0
      const r = 22 + v * 48
      for (const side of [-1, 1]) g.moveTo(-r * .15, side * r * .91).quadraticCurveTo(r * .57, side * r * .4, r * .47, 0)
        .stroke({ color: i % 2 ? 0xc98253 : 0xe9b978, width: 2.6 - v, alpha: .67, cap: 'round' })
    })
    cinders.forEach((p, i) => {
      const age = time - p.at, v = clamp(age / 1.08), span = Math.min(86, room(target) * .43)
      const at = { x: target.x + p.side * span * p.reach * v, y: target.y - span * p.lift * v + span * 1.5 * v * v }, g = p.g
      g.clear(); fit(g, at, 10); g.rotation = time * 2.6 + i
      g.alpha = hitPoint && age >= 0 && age < 1.08 ? clamp(age / .06) * (1 - clamp((v - .6) / .4)) * .79 : 0
      g.poly([-p.size * 1.4, 0, -p.size * .3, -p.size * .6, p.size * 1.1, 0, p.size * .2, p.size * .75]).fill(i % 2 ? 0xe8aa62 : 0xcb8055)
    })
  }
  onFrame(update)
  tl.call(() => update(1.18), [], 1.18)
    .call(() => { hitPoint = targetSocket('center', true); update(1.58); onCue({ type: 'impact' }) }, [], 1.58)
    .to({}, { duration: 2.75 }, 0)
}
