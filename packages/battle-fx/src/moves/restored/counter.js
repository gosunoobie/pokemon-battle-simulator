import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function counter(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  const fitPose = p => ({ x: Math.max(left + w / 2 - center.x, Math.min(right - w / 2 - center.x, p.x)), y: Math.max(top + h / 2 - center.y, Math.min(bottom - h / 2 - center.y, p.y)) })
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const hand = context.source.hasAnchor?.('fist') ? 'fist' : 'hand', pose = fitPose(solveContact(hand, 0)), brace = fitPose({ x: home.x - 10, y: home.y })
  const radius = Math.min(29, Math.max(18, h * .13))
  const guard = new Graphics(); guard.alpha = 0; temporary.addChild(guard)
  const trail = new Graphics(); trail.alpha = 0; temporary.addChild(trail)
  const palm = new Graphics(); palm.label = 'counter-strike'; palm.alpha = 0; temporary.addChild(palm)
  const hit = new Graphics(); hit.label = 'counter-impact'; hit.alpha = 0; temporary.addChild(hit)
  const chips = Array.from({ length: 18 }, (_, i) => {
    const g = new Graphics().poly([-3, 0, 0, -2, 4, 0, 0, 2]).fill(i % 2 ? 0xffb065 : 0xffe3a5); g.alpha = 0; temporary.addChild(g)
    return { g, angle: random() * Math.PI * 2, distance: 30 + random() * 36, life: .33 + random() * .2 }
  })
  let impact
  const update = time => {
    const body = socket('aura', true), fist = socket(hand, true), r = Math.min(radius, room(body) / 1.6)
    guard.clear(); guard.position.copyFrom(body); guard.alpha = time >= .08 && time < .62 ? Math.min(1, (time - .08) * 7) * Math.min(1, (.62 - time) * 7) : 0
    for (let i = 0; i < 3; i++) {
      const size = r * (1.4 - i * .25), squeeze = 1 - Math.max(0, time - .15) * .65
      guard.moveTo(size * .65 * squeeze, -size).lineTo(size * .95 * squeeze, 0).lineTo(size * .65 * squeeze, size)
        .stroke({ width: 3 - i * .5, color: i ? 0xf1b476 : 0xf37453, alpha: .9 - i * .2, cap: 'round' })
    }
    const u = Math.max(0, Math.min(1, (time - .52) / .26)), goal = impact ?? targetSocket('center', true)
    const at = { x: fist.x + (goal.x - fist.x) * u, y: fist.y + (goal.y - fist.y) * u }, size = Math.min(radius, room(at) / 1.6)
    palm.position.copyFrom(at); palm.alpha = time >= .44 && time < 1.03 ? Math.min(1, (time - .44) * 12) * Math.min(1, (1.03 - time) * 7) : 0
    palm.clear().roundRect(-size * 1.4, -size * .57, size * 1.4, size * 1.14, size * .24).fill(0xe57853).stroke({ color: 0xffd69e, width: 2 })
      .roundRect(-size * .75, size * .15, size * .53, size * .55, size * .16).fill(0xf4a36c)
    for (let i = 0; i < 3; i++) palm.moveTo(-size * .35, -size * .32 + i * size * .24).lineTo(-size * .9, -size * .32 + i * size * .24).stroke({ color: 0xffe4bc, width: 1.5, alpha: .8 })
    trail.clear(); trail.alpha = time >= .42 && time < .94 ? palm.alpha * .75 : 0
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * Math.min(8, room(fist) / 3, room(at) / 3)
      trail.moveTo(fist.x, fist.y + offset).quadraticCurveTo((fist.x + at.x) / 2, (fist.y + at.y) / 2 + offset, at.x - size, at.y + offset)
        .stroke({ width: i === 1 ? 3 : 1.5, color: i === 1 ? 0xffd080 : 0xe67c57, alpha: .7, cap: 'round' })
    }
    const age = time - .78; hit.clear(); hit.alpha = impact && age >= 0 && age < .47 ? Math.pow(1 - age / .47, .7) : 0
    if (impact) {
      hit.position.copyFrom(impact); const r = Math.min(radius * (1 + age * 2), room(impact) / 1.2)
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; hit.poly([Math.cos(a) * r * .2, Math.sin(a) * r * .2, Math.cos(a - .09) * r, Math.sin(a - .09) * r, Math.cos(a + .09) * r, Math.sin(a + .09) * r]).fill(i % 2 ? 0xffd38e : 0xf58b57) }
    }
    for (const p of chips) { const u = age / p.life, d = impact ? Math.min(p.distance, Math.max(0, room(impact) - 5)) : 0; p.g.alpha = impact && u >= 0 && u < 1 ? Math.sin(u * Math.PI) * .85 : 0; if (impact && u >= 0) { p.g.position.set(impact.x + Math.cos(p.angle) * d * u, impact.y + Math.sin(p.angle) * d * u); p.g.rotation = p.angle } }
  }
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const recoil = Math.max(0, Math.min(10, right - receiver.x - context.target.metrics.width / (2 * unit)))
  onFrame(update)
  tl.to(attacker, { ...brace, duration: .22 }, 0).to(attacker, { ...pose, duration: .34, ease: 'power3.in' }, .44)
    .call(() => { impact = targetSocket('center', true); update(.78); onCue({ type: 'impact' }); defender.tint = 0xf6bc8e }, [], .78)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 3, yoyo: true }, .78)
    .call(() => { defender.tint = 0xffffff }, [], 1.07)
    .to(attacker, { x: home.x, y: home.y, duration: .42, ease: 'power2.inOut' }, 1.02)
}
