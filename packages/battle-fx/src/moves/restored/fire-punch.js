import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function firePunch(context) {
  const { tl, random, onFrame, onCue, glowTexture } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('fist') ? 'fist' : 'hand'
  const r = Math.min(32, Math.max(19, context.source.metrics.height / unit * .12)), rotation = .07
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const xs = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...xs), right = Math.max(...xs), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const recoil = Math.max(0, Math.min(11, right - targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center').x - context.target.metrics.width / (2 * unit)))
  function fit(p) {
    const c = Math.cos(p.rotation), s = Math.sin(p.rotation), w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
    const rx = (w * Math.abs(c) + h * Math.abs(s)) / 2, ry = (h * Math.abs(c) + w * Math.abs(s)) / 2
    const x = p.x + center.x * c - center.y * s, y = p.y + center.x * s + center.y * c
    return { ...p, x: p.x + Math.max(left + rx, Math.min(right - rx, x)) - x, y: p.y + Math.max(top + ry, Math.min(bottom - ry, y)) - y }
  }
  const pose = fit(solveContact(attachment, rotation, { x: focus.x - Math.cos(rotation) * r, y: focus.y - Math.sin(rotation) * r }))
  const hand = socket(attachment), point = { x: pose.x + (hand.x + r) * Math.cos(rotation) - hand.y * Math.sin(rotation), y: pose.y + (hand.x + r) * Math.sin(rotation) + hand.y * Math.cos(rotation) }
  const fist = new Container(); fist.label = 'fire-punch-fist'; fist.alpha = 0; temporary.addChild(fist)
  const glow = new Sprite(glowTexture); glow.anchor.set(.5); glow.width = r * 3.1; glow.height = r * 2.8; glow.tint = 0xff6c25; glow.blendMode = 'add'; glow.alpha = .42; fist.addChild(glow)
  const flames = new Graphics(); flames.label = 'fire-punch-flames'; fist.addChild(flames)
  fist.addChild(new Graphics().moveTo(-r * .7, -r * .25).lineTo(-r * .4, -r * .64).lineTo(r * .68, -r * .64)
    .quadraticCurveTo(r, -r * .62, r, -r * .3).lineTo(r, r * .24).quadraticCurveTo(r * .86, r * .57, r * .3, r * .57)
    .lineTo(-r * .58, r * .4).closePath().fill(0xffac4f).stroke({ color: 0xffeaa2, width: 1.8, join: 'round' })
    .moveTo(-r * .2, -r * .49).lineTo(-r * .17, -r * .14).moveTo(r * .19, -r * .49).lineTo(r * .2, -r * .13)
    .moveTo(r * .55, -r * .46).lineTo(r * .57, -r * .13).moveTo(-r * .43, r * .07).quadraticCurveTo(0, -r * .07, r * .34, r * .24)
    .stroke({ color: 0xc95d32, width: 1.6, cap: 'round' }))
  const fan = new Graphics(); fan.label = 'fire-punch-impact'; fan.position.copyFrom(point); fan.alpha = 0; temporary.addChild(fan)
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * .45, x = Math.cos(a), y = Math.sin(a), reach = r * (1.55 + (i % 2) * .32)
    fan.moveTo(-r * .25, 0).quadraticCurveTo(x * reach * .55 - y * r * .42, y * reach * .55 + x * r * .42, x * reach, y * reach)
      .quadraticCurveTo(x * reach * .5 + y * r * .23, y * reach * .5 - x * r * .23, 0, 0).fill({ color: i % 2 ? 0xffb548 : 0xf26c32, alpha: .85 })
  }
  fan.circle(0, 0, r * .32).fill(0xffefb2)
  const embers = Array.from({ length: 17 }, () => {
    const g = new Graphics().ellipse(0, 0, 1.6 + random() * 1.4, 3.5 + random() * 2).fill(random() < .45 ? 0xffcc68 : 0xf98c39)
    g.label = 'fire-punch-ember'; g.alpha = 0; temporary.addChild(g)
    return { g, vx: (random() - .25) * 135, vy: 45 + random() * 100, life: .35 + random() * .24 }
  })
  const swing = { angle: -.24 }
  function follow() {
    const p = fit({ x: attacker.x, y: attacker.y, rotation: attacker.rotation }); attacker.position.set(p.x, p.y)
    fist.position.copyFrom(socket(attachment, true)); fist.rotation = attacker.rotation + swing.angle
  }
  function update(time) {
    follow(); flames.clear()
    for (let i = 0; i < 6; i++) {
      const y = (i / 5 - .5) * r * 1.35, reach = r * (1.05 + .28 * Math.sin(time * 17 + i * 1.7))
      flames.moveTo(r * .24, y).quadraticCurveTo(-r * .8, y - r * .37, -reach, y - r * (.33 + .25 * Math.sin(time * 13 + i)))
        .quadraticCurveTo(-r * .52, y + r * .1, r * .36, y + r * .18).fill({ color: i % 2 ? 0xffb340 : 0xf36b2c, alpha: .78 })
    }
    glow.alpha = .38 + Math.sin(time * 11) * .06
    for (const p of embers) {
      const age = time - .68, t = age / p.life
      p.g.alpha = t >= 0 && t < 1 ? Math.sin(Math.PI * t) * .9 : 0
      if (age >= 0) { p.g.position.set(point.x + p.vx * age, point.y - p.vy * age + 24 * age * age); p.g.rotation = age * 2.2 }
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - 13, y: home.y + 4, rotation: -.08, duration: .24 }, 0)
    .to(attacker, { x: pose.x - r * .65, y: pose.y + r * .35, rotation: -.07, duration: .22 }, .24)
    .to(attacker, { ...pose, duration: .22, ease: 'power3.in' }, .46)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .5, ease: 'power2.inOut' }, .92)
    .to(swing, { angle: 0, duration: .22, ease: 'power2.in' }, .46)
    .to(fist, { alpha: 1, duration: .16 }, .12).to(fist, { alpha: 0, duration: .24 }, .86)
    .to(fan, { alpha: 1, duration: .035 }, .68).to(fan.scale, { x: 1.2, y: 1.2, duration: .22 }, .68).to(fan, { alpha: 0, duration: .27 }, .77)
    .call(() => { update(.68); onCue({ type: 'impact' }); defender.tint = 0xffb976 }, [], .68)
    .to(defender, { x: defenderHome.x + recoil, duration: .065, repeat: 3, yoyo: true }, .68)
    .call(() => { defender.tint = 0xffffff }, [], .96)
}
