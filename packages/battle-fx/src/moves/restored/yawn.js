import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function yawn(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / extent)) }
  const root = make('yawn-root'), tip = make('yawn-tip'), impact = make('yawn-impact')
  root.attachmentSocket = 'emission'; tip.attachmentSocket = 'emission'; tip.contactPoint = { x: 0, y: 0 }
  const breaths = Array.from({ length: 6 }, (_, i) => ({ g: make(`yawn-breath-${i}`), at: .34 + i * .047, side: i % 2 ? -1 : 1, size: 3.5 + random() * 2.2 }))
  const wisps = Array.from({ length: 6 }, (_, i) => ({ g: make(`yawn-wisp-${i}`), phase: i / 6, side: i % 2 ? -1 : 1 }))
  const pearls = Array.from({ length: 12 }, (_, i) => ({ g: make(`yawn-pearl-${i}`), phase: i / 12, size: 1.5 + random() * 1.8 }))
  let arrived = false

  function path(u, time, a, b) {
    const p = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
    const drift = Math.min(17, room(p) * .25) * Math.sin(u * Math.PI)
    p.y += drift * (.3 + Math.sin(time * 3 + u * 3) * .35)
    return p
  }
  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true), u = clamp((time - .3) / .64), front = path(u, time, a, b)
    const next = path(Math.min(1, u + .004), time, a, b), previous = path(Math.max(0, u - .004), time, a, b), angle = Math.atan2(next.y - previous.y, next.x - previous.x)
    root.clear(); fit(root, a, 31); root.rotation = Math.atan2(b.y - a.y, b.x - a.x)
    root.alpha = time >= .045 && time < .7 ? clamp((time - .045) / .14) * (1 - clamp((time - .38) / .32)) : 0
    const exhale = 8 + clamp(time / .3) * 11
    root.ellipse(0, 0, exhale * .36, exhale * .58).fill({ color: 0xe8cae1, alpha: .21 }).stroke({ color: 0xe6cbeb, width: 1.3, alpha: .65 })
      .moveTo(3, -8).quadraticCurveTo(18, -5, 23, 3).stroke({ color: 0xf6ddea, width: 2.4, alpha: .38, cap: 'round' })
      .moveTo(2, 7).quadraticCurveTo(13, 15, 22, 12).stroke({ color: 0xc7b9dc, width: 2, alpha: .37, cap: 'round' })
    breaths.forEach(p => {
      const age = time - p.at, v = clamp(age / .65), at = path(v, time, a, b), spread = Math.min(12, room(at) * .22) * Math.sin(v * Math.PI) * p.side
      at.y += spread
      const g = p.g; g.clear(); fit(g, at, 12); g.rotation = 0
      g.alpha = age >= 0 && age < .76 ? clamp(age / .08) * (1 - clamp((age - .48) / .28)) * .42 : 0
      const r = p.size * (.75 + v * .35)
      g.circle(0, 0, r).fill({ color: 0xe4cce9, alpha: .13 }).stroke({ color: 0xd6c5e4, width: 1.1, alpha: .62 })
        .ellipse(-r * .3, -r * .37, r * .22, r * .12).fill({ color: 0xffedf5, alpha: .8 })
    })
    // The soft bubble's leading point is zero; its sleepy face has no mirrored text.
    tip.clear(); fit(tip, front, 61); tip.rotation = angle
    tip.alpha = time >= .3 && time < 1.22 ? 1 - clamp((time - .98) / .24) : 0
    const sag = Math.sin(time * 5) * 1.5
    tip.moveTo(0, 0).bezierCurveTo(-1, -19, -20, -29, -38, -21)
      .bezierCurveTo(-57, -14, -56, 12, -39, 22 + sag).bezierCurveTo(-20, 34 + sag, -1, 21, 0, 0)
      .closePath().fill({ color: 0xe1c6e6, alpha: .19 })
      .moveTo(-1.5, -1).bezierCurveTo(-3, -19, -22, -26, -37, -19)
      .stroke({ color: 0xffddeb, width: 2.1, alpha: .85, cap: 'round' })
      .moveTo(-49, -9).bezierCurveTo(-55, 10, -38, 24 + sag, -22, 23)
      .stroke({ color: 0xbdaed6, width: 1.7, alpha: .74, cap: 'round' })
      .ellipse(-35, -15, 6.3, 3.1).fill({ color: 0xfff2f7, alpha: .75 })
    for (const x of [-35, -17]) tip.moveTo(x - 5, -2).quadraticCurveTo(x, 3, x + 5, -2).stroke({ color: 0x9785ad, width: 1.5, alpha: .78, cap: 'round' })
    tip.ellipse(-26, 11, 3.3, 5.5 + Math.sin(time * 4) * .5).stroke({ color: 0xb79bbf, width: 1.2, alpha: .57 })
    const age = time - .94, settle = clamp(age / .52)
    impact.clear(); fit(impact, b, 67); impact.alpha = arrived && age >= 0 && age < .71 ? 1 - clamp((age - .08) / .63) : 0
    for (const side of [-1, 1]) {
      const width = 10 + settle * 33, height = 14 + settle * 28
      impact.moveTo(0, -height).bezierCurveTo(side * width * 1.1, -height * .85, side * width * 1.18, height * .6, side * width * .63, height)
        .stroke({ color: side < 0 ? 0xf1ccdf : 0xc8b8e2, width: 2.6 - settle, alpha: .6, cap: 'round' })
    }
    wisps.forEach(p => {
      const localAge = age - p.phase * .12, v = clamp(localAge / 1.17), span = Math.min(61, room(b) * .66), sway = Math.sin(time * 2.7 + p.phase * 8)
      const at = { x: b.x + p.side * span * (.22 + v * .35 + sway * .09), y: b.y + span * (-.18 + p.phase * .3 + v * .53) }, g = p.g
      g.clear(); fit(g, at, 34); g.rotation = sway * .12
      g.alpha = arrived && localAge >= 0 && localAge < 1.17 ? clamp(localAge / .18) * (1 - clamp((v - .56) / .44)) * .55 : 0
      const droop = 12 + v * 9
      g.moveTo(-18, -7).bezierCurveTo(-3, -12, 20, -3, 14, droop).quadraticCurveTo(9, droop + 8, 4, droop - 1)
        .stroke({ color: p.side < 0 ? 0xd9c7e9 : 0xedcadf, width: 2.4 - v * .8, alpha: .57, cap: 'round' })
        .moveTo(-12, -3).quadraticCurveTo(4, -4, 6, 6).stroke({ color: 0xffeaf2, width: 1, alpha: .48, cap: 'round' })
    })
    pearls.forEach(p => {
      const v = clamp(age / 1.29), spread = Math.min(69, room(b) * .61), q = p.phase * Math.PI * 2
      const at = { x: b.x + Math.cos(q) * spread * (.3 + v * .48) + Math.sin(time * 2 + q) * spread * .07, y: b.y + Math.sin(q) * spread * .28 + spread * (.12 * v + .5 * v * v) }, g = p.g
      g.clear(); fit(g, at, 7); g.alpha = arrived && age >= 0 && age < 1.29 ? clamp(age / .18) * (1 - clamp((v - .62) / .38)) * .64 : 0
      g.circle(0, 0, p.size).fill({ color: p.phase < .5 ? 0xf7dce9 : 0xdbcaee, alpha: .68 })
        .circle(-p.size * .2, -p.size * .25, p.size * .27).fill(0xfff4f7)
    })
  }
  onFrame(update)
  tl.call(() => update(.3), [], .3)
    .call(() => { arrived = true; update(.94); onCue({ type: 'impact' }) }, [], .94)
    .to({}, { duration: 2.3 }, 0)
}
