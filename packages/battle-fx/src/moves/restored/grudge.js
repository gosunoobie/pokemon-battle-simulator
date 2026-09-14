import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function grudge(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const ends = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...ends), right = Math.max(...ends), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const sigil = make('grudge-vow-sigil'), flames = make('grudge-flame-vow'), tip = make('grudge-tip'), impact = make('grudge-impact')
  const embers = Array.from({ length: 18 }, (_, i) => ({ g: make(`grudge-ember-${i}`), phase: i / 18, side: i % 2 ? 1 : -1 }))
  let vowed = false

  function update(time) {
    const c = socket('center', true)
    const rx = Math.min(101, Math.max(46, context.source.metrics.width / unit * .61)), ry = Math.min(110, Math.max(55, context.source.metrics.height / unit * .6))
    const sx = Math.max(0, Math.min(1, (c.x - left - 6) / (rx + 8), (right - c.x - 6) / (rx + 8)))
    const sy = Math.max(0, Math.min(1, (c.y - top - 6) / (ry + 8), (bottom - c.y - 6) / (ry + 8)))
    const fade = clamp((time - .04) / .27) * (1 - clamp((time - 1.81) / .46)), gather = clamp((time - .12) / .78), seal = clamp((time - .9) / .18)
    sigil.clear(); sigil.position.copyFrom(c); sigil.scale.set(sx, sy); sigil.alpha = fade
    const reach = .58 + gather * .32, low = ry * .6
    // A hollow angular vow closes beneath the body, leaving the actor's silhouette readable.
    sigil.moveTo(-rx * reach, low).lineTo(0, low + ry * .18).lineTo(rx * reach, low).lineTo(0, low - ry * .18).closePath()
      .stroke({ color: 0x9a6fbf, width: 2.3, alpha: .6 })
      .moveTo(-rx * reach * .66, low).lineTo(0, low + ry * .1).lineTo(rx * reach * .66, low)
      .stroke({ color: 0xd4a4e4, width: 1.2, alpha: .73 })
    for (const side of [-1, 1]) {
      const x = side * rx * .87
      sigil.moveTo(x, -ry * .4).lineTo(x - side * 9, -ry * .23).lineTo(x, -ry * .12).lineTo(x - side * 6, ry * .12)
        .stroke({ color: 0xb083ce, width: 1.9, alpha: .54 + seal * .23 })
    }
    flames.clear(); flames.position.copyFrom(c); flames.scale.set(sx, sy); flames.alpha = fade
    for (let j = 0; j < 9; j++) {
      const angle = j * Math.PI * 2 / 9, x = Math.cos(angle) * rx * .77, y = Math.sin(angle) * ry * .48 + ry * .11
      const length = (15 + gather * 17) * (.81 + Math.sin(time * 8 + j * 1.8) * .16), sway = Math.sin(time * 4 + j) * 6
      const ceiling = -ry * .94, apex = Math.max(ceiling, y - length * 1.5)
      flames.moveTo(x - 8, y + 4).quadraticCurveTo(x - 15, y - length * .45, x + sway, apex)
        .quadraticCurveTo(x + 2, y - length * .55, x + 6, y - length * .69)
        .quadraticCurveTo(x + 17, y - length * .17, x + 8, y + 4).quadraticCurveTo(x, y + 10, x - 8, y + 4)
        .fill({ color: j % 2 ? 0x604071 : 0x795090, alpha: .48 })
        .moveTo(x - 3, y + 1).quadraticCurveTo(x - 7, y - length * .27, x + sway * .55, Math.max(ceiling + 3, y - length))
        .quadraticCurveTo(x + 3, y - length * .41, x + 4, y + 1).quadraticCurveTo(x, y + 5, x - 3, y + 1)
        .fill({ color: 0xbe94d2, alpha: .54 })
    }
    tip.clear(); tip.position.copyFrom(c); tip.scale.set(Math.min(1, room(c) / 13)); tip.alpha = time >= .65 && time < 1.2 ? Math.min(1, (time - .65) / .18, (1.2 - time) / .23) : 0
    tip.moveTo(0, -9).lineTo(6, 0).lineTo(0, 9).lineTo(-6, 0).closePath().stroke({ color: 0xe2b7ee, width: 1.5 })
      .circle(0, 0, 1.7).fill(0xf4d5f4)
    const age = time - .9, u = clamp(age / .62)
    impact.clear(); impact.position.copyFrom(c); impact.scale.set(sx, sy); impact.alpha = vowed && age >= 0 && age < .62 ? 1 - u : 0
    const radius = .31 + u * .57
    for (const side of [-1, 1]) {
      impact.moveTo(side * rx * radius, -ry * radius * .45).quadraticCurveTo(side * rx * radius * 1.03, ry * radius * .2, 0, ry * radius * .74)
        .stroke({ color: 0xd6abec, width: 2.2, alpha: .76 })
    }
    for (const ember of embers) {
      const u = (Math.max(0, time - .18) * .72 + ember.phase) % 1, spread = .68 + Math.sin(time * 2.3 + ember.phase * 8) * .14
      const p = { x: c.x + ember.side * rx * spread * sx, y: c.y + ry * (.65 - u * 1.43) * sy }, g = ember.g
      g.clear(); g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / 9)); g.rotation = Math.sin(time * 3 + ember.phase * 8) * .4
      g.alpha = fade * Math.sin(u * Math.PI) * .66
      g.moveTo(0, -7).quadraticCurveTo(-5, 0, -1, 4).quadraticCurveTo(5, 3, 0, -7).fill(0xc499d9)
    }
  }
  onFrame(update)
  tl.call(() => { vowed = true; update(.9); onCue({ type: 'impact' }) }, [], .9).to({}, { duration: 2.35 }, 0)
}
