import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function endeavor(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  const fit = p => ({ x: Math.max(left + w / 2 - center.x, Math.min(right - w / 2 - center.x, p.x)), y: Math.max(top + h / 2 - center.y, Math.min(bottom - h / 2 - center.y, p.y)) })
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const pose = fit(solveContact('tackle', 0)), brace = fit({ x: home.x - 12, y: home.y + 3 }), r = Math.min(39, Math.max(25, h * .18))
  const resolve = new Graphics(); resolve.alpha = 0; temporary.addChild(resolve)
  const streaks = new Graphics(); streaks.alpha = 0; temporary.addChild(streaks)
  const front = new Graphics(); front.label = 'endeavor-front'; front.alpha = 0; temporary.addChild(front)
  const ring = new Graphics(); ring.label = 'endeavor-impact'; ring.alpha = 0; temporary.addChild(ring)
  const motes = Array.from({ length: 20 }, (_, i) => { const g = new Graphics().ellipse(0, 0, 3.5, 1.8).fill(i % 2 ? 0xf7e6b0 : 0xd2bf92); g.alpha = 0; temporary.addChild(g); return { g, angle: random() * 6.28, distance: r * (.65 + random() * .9), life: .35 + random() * .2 } })
  let impact
  function update(time) {
    const a = socket('aura', true), body = socket('tackle', true), goal = impact ?? targetSocket('center', true), u = Math.max(0, Math.min(1, (time - .5) / .2))
    const at = { x: body.x + (goal.x - body.x) * u, y: body.y + (goal.y - body.y) * u }, radius = Math.min(r, room(at) / 1.1)
    resolve.clear(); resolve.position.copyFrom(a); resolve.alpha = time >= .08 && time < .47 ? Math.sin((time - .08) / .39 * Math.PI) * .85 : 0
    const size = Math.min(r * .8, room(a) / 1.2)
    resolve.moveTo(-size, size * .15).lineTo(-size * .2, -size * .06).moveTo(size * .2, -size * .06).lineTo(size, size * .15).stroke({ color: 0xffe8ad, width: 3, cap: 'round' })
    streaks.clear(); streaks.alpha = time >= .3 && time < .9 ? Math.min(1, (time - .3) * 10) * Math.min(1, (.9 - time) * 7) : 0
    const length = Math.max(0, Math.min(r * 2.2, a.x - left - 4)), offset = Math.min(r * .38, room(a) / 2)
    for (let i = 0; i < 5; i++) { const y = (i - 2) * offset / 2; streaks.moveTo(a.x - length, a.y + y).lineTo(a.x - length * .17, a.y + y * .6).stroke({ color: i === 2 ? 0xffefc3 : 0xd6c6a4, width: i === 2 ? 3 : 1.5, alpha: .8, cap: 'round' }) }
    front.clear(); front.position.copyFrom(at); front.alpha = time >= .46 && time < .98 ? Math.min(1, (time - .46) * 12) * Math.min(1, (.98 - time) * 6) : 0
    front.moveTo(-radius * .35, -radius * .65).quadraticCurveTo(radius * .35, 0, -radius * .35, radius * .65).stroke({ color: 0xffedb9, width: 4, cap: 'round' })
      .moveTo(-radius * .7, -radius * .5).quadraticCurveTo(-radius * .12, 0, -radius * .7, radius * .5).stroke({ color: 0xe3be83, width: 2, cap: 'round' })
    const age = time - .7; ring.clear(); ring.alpha = impact && age >= 0 && age < .49 ? Math.pow(1 - age / .49, .7) : 0
    if (impact) { const size = Math.max(0, Math.min(r * (.5 + age * 2), room(impact) - 2)); ring.position.copyFrom(impact); ring.ellipse(0, 0, size, size * .62).stroke({ color: 0xfde4a5, width: 3, alpha: .85 }) }
    for (const p of motes) { const u = age / p.life, d = impact ? Math.max(0, Math.min(p.distance, room(impact) - 5)) : 0; p.g.alpha = impact && u >= 0 && u < 1 ? Math.sin(u * Math.PI) * .8 : 0; if (impact && u >= 0) { p.g.position.set(impact.x + Math.cos(p.angle) * d * u, impact.y + Math.sin(p.angle) * d * u); p.g.rotation = p.angle } }
  }
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const recoil = Math.max(0, Math.min(10, right - receiver.x - context.target.metrics.width / (2 * unit)))
  onFrame(update)
  tl.to(attacker, { ...brace, duration: .27 }, 0).to(attacker, { ...pose, duration: .36, ease: 'power3.in' }, .34)
    .call(() => { impact = targetSocket('center', true); update(.7); onCue({ type: 'impact' }); defender.tint = 0xf2dba9 }, [], .7)
    .to(defender, { x: defenderHome.x + recoil, duration: .055, repeat: 3, yoyo: true }, .7)
    .call(() => { defender.tint = 0xffffff }, [], .98)
    .to(attacker, { x: home.x, y: home.y, duration: .45, ease: 'power2.inOut' }, 1.01)
}
