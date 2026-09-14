import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function flash(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n)), room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, radius) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / radius)) }
  const glint = make('flash-source-glint'), fan = make('flash-light-fan'), tip = make('flash-tip'), impact = make('flash-impact')
  tip.attachmentSocket = 'emission'
  const lenses = Array.from({ length: 5 }, (_, i) => ({ g: make('flash-afterimage-' + i), at: .62 + i * .055, side: i % 2 ? 1 : -1, angle: (random() - .5) * .45 }))
  let struck = false
  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true), dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx), nx = -Math.sin(angle), ny = Math.cos(angle)
    const reach = clamp((time - .3) / .32), head = { x: a.x + dx * reach, y: a.y + dy * reach }
    glint.clear(); fit(glint, a, 48); glint.alpha = time >= .03 && time < .84 ? clamp((time - .03) / .17) * (1 - clamp((time - .43) / .41)) : 0
    const r = 16 + Math.sin(clamp(time / .3) * Math.PI / 2) * 16
    glint.poly([0, -r, r * .11, -r * .13, r, 0, r * .11, r * .13, 0, r, -r * .11, r * .13, -r, 0, -r * .11, -r * .13]).fill(0xfff4cd)
      .circle(0, 0, r * .16).fill(0xffffff)
    for (let j = 0; j < 4; j++) { const q = j * Math.PI / 2 + Math.PI / 4 + time * .25; glint.moveTo(Math.cos(q) * r * .43, Math.sin(q) * r * .43).lineTo(Math.cos(q) * r * .84, Math.sin(q) * r * .84).stroke({ color: 0xebd395, width: 1.3, alpha: .75 }) }
    fan.clear(); fan.alpha = time >= .3 && time < .93 ? clamp((time - .3) / .035) * (1 - clamp((time - .64) / .29)) : 0
    for (let lane = -4; lane <= 4; lane++) {
      for (let k = 0; k <= 38; k++) {
        const u = reach * k / 38, p = { x: a.x + dx * u, y: a.y + dy * u }, spread = Math.sin(Math.PI * u) * Math.min(58, room(p) * .76) * lane / 4
        const x = p.x + nx * spread, y = p.y + ny * spread
        if (!k) fan.moveTo(x, y); else fan.lineTo(x, y)
      }
      fan.stroke({ color: lane % 2 ? 0xfff9e0 : 0xe8d293, width: lane === 0 ? 2.6 : lane % 2 ? 1.25 : .8, alpha: lane === 0 ? .77 : .48, cap: 'round' })
    }
    tip.clear(); fit(tip, head, 28); tip.rotation = angle; tip.alpha = time >= .3 && time < 1.01 ? 1 - clamp((time - .67) / .34) : 0
    tip.poly([0, -17, 3, -3, 24, 0, 3, 3, 0, 17, -3, 3, -24, 0, -3, -3]).fill({ color: 0xfffbde, alpha: .88 }).circle(0, 0, 3.5).fill(0xffffff)
    const age = time - .62, u = clamp(age / .57)
    impact.clear(); fit(impact, b, 72); impact.alpha = struck && age >= 0 && age < .57 ? (1 - u) * .87 : 0
    impact.ellipse(0, 0, 9 + u * 36, 17 + u * 42).stroke({ color: 0xfff2c0, width: 2 - u, alpha: .8 })
    for (let j = 0; j < 8; j++) { const q = j * Math.PI / 4 + time * .3, inner = 13 + u * 22, outer = inner + 8 * (1 - u); impact.moveTo(Math.cos(q) * inner, Math.sin(q) * inner).lineTo(Math.cos(q) * outer, Math.sin(q) * outer).stroke({ color: j % 2 ? 0xffffff : 0xe7cd8b, width: 1.6, alpha: .8, cap: 'round' }) }
    lenses.forEach((p, i) => {
      const age = time - p.at, u = clamp(age / .78), distance = Math.min(56, room(b) * .62) * u, at = { x: b.x + nx * distance * p.side + Math.cos(angle + p.angle) * distance * .2, y: b.y + ny * distance * p.side + Math.sin(angle + p.angle) * distance * .2 }
      const g = p.g; g.clear(); fit(g, at, 31); g.rotation = angle + p.angle
      g.alpha = age >= 0 && age < .78 ? Math.sin(Math.PI * u) * (1 - u) * .66 : 0
      const r = (17 - i * 1.5) * (1 - u * .45)
      g.ellipse(0, 0, r * .3, r).stroke({ color: i % 2 ? 0xf1dfab : 0xffffff, width: 1.2, alpha: .7 })
        .moveTo(-r * .78, 0).lineTo(r * .78, 0).stroke({ color: 0xfceccb, width: .9, alpha: .6 })
    })
  }
  onFrame(update)
  tl.call(() => update(.3), [], .3)
    .call(() => { struck = true; update(.62); onCue({ type: 'impact' }) }, [], .62)
    .to({}, { duration: 1.8 }, 0)
}
