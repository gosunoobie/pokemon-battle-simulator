import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function thunderPunch(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('fist') ? 'fist' : 'hand'
  const r = Math.min(30, Math.max(18, context.source.metrics.height / unit * .115)), rotation = .025
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const recoil = Math.max(0, Math.min(8, right - targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center').x - context.target.metrics.width / (2 * unit)))
  function fit(p) {
    const c = Math.cos(p.rotation), s = Math.sin(p.rotation), w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
    const rx = (w * Math.abs(c) + h * Math.abs(s)) / 2, ry = (h * Math.abs(c) + w * Math.abs(s)) / 2
    const x = p.x + center.x * c - center.y * s, y = p.y + center.x * s + center.y * c
    return { ...p, x: p.x + Math.max(left + rx, Math.min(right - rx, x)) - x, y: p.y + Math.max(top + ry, Math.min(bottom - ry, y)) - y }
  }
  const pose = fit(solveContact(attachment, rotation, { x: focus.x - Math.cos(rotation) * r, y: focus.y - Math.sin(rotation) * r }))
  const hand = socket(attachment), point = { x: pose.x + (hand.x + r) * Math.cos(rotation) - hand.y * Math.sin(rotation), y: pose.y + (hand.x + r) * Math.sin(rotation) + hand.y * Math.cos(rotation) }
  const fist = new Container(); fist.label = 'thunder-punch-fist'; fist.alpha = 0; temporary.addChild(fist)
  const charge = new Graphics(); charge.label = 'thunder-punch-charge'; fist.addChild(charge)
  fist.addChild(new Graphics().poly([-r * .67, -r * .28, -r * .35, -r * .62, r * .73, -r * .62, r, -r * .33, r, r * .2, r * .72, r * .48, r * .12, r * .62, -r * .55, r * .36])
    .fill(0xffdc70).stroke({ color: 0xfff7c4, width: 2, join: 'round' })
    .moveTo(-r * .18, -r * .48).lineTo(-r * .17, -r * .15).moveTo(r * .23, -r * .48).lineTo(r * .23, -r * .13)
    .moveTo(r * .62, -r * .45).lineTo(r * .62, -r * .11).moveTo(-r * .38, 0).quadraticCurveTo(r * .04, -r * .04, r * .32, r * .24)
    .stroke({ color: 0xb88c33, width: 1.5, cap: 'round' }))
  const discharge = new Graphics(); discharge.label = 'thunder-punch-impact'; discharge.position.copyFrom(point); discharge.alpha = 0; temporary.addChild(discharge)
  const bolts = Array.from({ length: 8 }, (_, i) => ({ angle: i * Math.PI / 4 + (random() - .5) * .22, reach: r * (1.5 + random() * .6), phase: random() * 6.28 }))
  const sparks = Array.from({ length: 15 }, (_, i) => {
    const g = new Graphics().moveTo(-3, 0).lineTo(1, 0).lineTo(1, -3).stroke({ color: i % 2 ? 0xffdc6a : 0xffffcf, width: 1.6 })
    g.label = 'thunder-punch-spark'; g.alpha = 0; temporary.addChild(g)
    return { g, angle: random() * Math.PI * 2, distance: 28 + random() * 38, life: .22 + random() * .19 }
  })
  function follow() {
    const p = fit({ x: attacker.x, y: attacker.y, rotation: attacker.rotation }); attacker.position.set(p.x, p.y)
    fist.position.copyFrom(socket(attachment, true)); fist.rotation = attacker.rotation
  }
  function update(time) {
    follow(); charge.clear(); discharge.clear()
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * r * .74, zig = Math.sin(time * 22 + i * 2) * r * .11
      charge.moveTo(-r * 1.25, y).lineTo(-r * .7, y - r * .23 + zig).lineTo(-r * .8, y + r * .12).lineTo(r * .45, y + zig)
        .stroke({ color: i % 2 ? 0xf7cc48 : 0xfff5ad, width: 1.7, alpha: .75, cap: 'round' })
    }
    for (const p of bolts) {
      const x = Math.cos(p.angle), y = Math.sin(p.angle), bend = Math.sin(time * 29 + p.phase) * r * .18
      discharge.moveTo(0, 0).lineTo(x * p.reach * .4 - y * bend, y * p.reach * .4 + x * bend)
        .lineTo(x * p.reach * .44 + y * r * .16, y * p.reach * .44 - x * r * .16).lineTo(x * p.reach, y * p.reach)
        .stroke({ color: 0xffed85, width: 2.2, cap: 'round' })
        .moveTo(x * p.reach * .4 - y * bend, y * p.reach * .4 + x * bend)
        .lineTo(x * p.reach * .64 - y * r * .35, y * p.reach * .64 + x * r * .35).stroke({ color: 0xfffbd7, width: 1.2 })
    }
    discharge.circle(0, 0, r * .2).fill(0xffffdc)
    for (const p of sparks) {
      const age = time - .52, t = age / p.life
      p.g.alpha = t >= 0 && t < 1 ? Math.sin(Math.PI * t) * .85 : 0
      if (age >= 0) { const d = p.distance * (1 - (1 - Math.min(1, t)) ** 2); p.g.position.set(point.x + Math.cos(p.angle) * d, point.y + Math.sin(p.angle) * d) }
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - 8, rotation: -.035, duration: .2 }, 0)
    .to(attacker, { ...pose, duration: .2, ease: 'power4.in' }, .32)
    .to(attacker, { x: pose.x - r * .3, rotation: -.015, duration: .11 }, .62)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .43, ease: 'power2.inOut' }, .8)
    .to(fist, { alpha: 1, duration: .12 }, .08).to(fist, { alpha: 0, duration: .18 }, .73)
    .to(discharge, { alpha: 1, duration: .025 }, .52).to(discharge, { alpha: 0, duration: .3 }, .62)
    .call(() => { update(.52); onCue({ type: 'impact' }); defender.tint = 0xffe89a }, [], .52)
    .to(defender, { x: defenderHome.x + recoil, duration: .05, repeat: 5, yoyo: true }, .52)
    .call(() => { defender.tint = 0xffffff }, [], .84)
}
