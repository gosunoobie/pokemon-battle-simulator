import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function mirrorCoat(context) {
  const { tl, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const back = Math.max(0, Math.min(5, center.x - context.source.metrics.width / (2 * unit) - left)), recoil = Math.max(0, Math.min(9, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const r = Math.min(43, Math.max(28, context.source.metrics.height / unit * .22))
  const shield = new Graphics(); shield.label = 'mirror-coat-shield'; shield.alpha = 0; temporary.addChild(shield)
  const flash = new Sprite(glowTexture); flash.anchor.set(.5); flash.tint = 0xffd7f0; flash.blendMode = 'add'; flash.alpha = 0; temporary.addChild(flash)
  const incoming = [], outgoing = []
  for (let i = 0; i < 6; i++) {
    const g = new Graphics().ellipse(0, 0, 7, 2.5).fill(i % 2 ? 0xa9d8ff : 0xd8c1ff); g.alpha = 0; temporary.addChild(g)
    incoming.push({ g, start: .18 + i * .023 })
  }
  for (let i = 0; i < 3; i++) {
    const g = new Container(); g.label = `mirror-coat-return-${i}`; g.alpha = 0; temporary.addChild(g)
    const ray = new Graphics().poly([0, 0, -36, -7, -62, 0, -36, 7]).fill(i % 2 ? 0xf3a9d8 : 0xffd3e9).poly([-3, 0, -34, -2, -48, 0, -34, 2]).fill(0xfff4e9)
    g.addChild(ray); outgoing.push({ g, start: .54 + i * .035, from: null, impact: null })
  }
  const bloom = new Graphics(); bloom.label = 'mirror-coat-impact'; bloom.alpha = 0; temporary.addChild(bloom)
  let impact
  function update(time) {
    const a = socket('aura', true), b = targetSocket('center', true), size = Math.min(r, room(a) / 1.3)
    shield.clear(); shield.position.copyFrom(a); shield.alpha = time >= .05 && time < 1.3 ? Math.min(1, (time - .05) * 6) * Math.min(1, (1.3 - time) * 3) : 0
    shield.poly([-size * .58, -size * .8, 0, -size * 1.16, size * .58, -size * .8, size * .58, size * .8, 0, size * 1.16, -size * .58, size * .8]).fill({ color: 0xdb9eca, alpha: .16 }).stroke({ width: 2.5, color: 0xffd8ef, alpha: .9 })
      .moveTo(-size * .48, -size * .47).lineTo(size * .48, -size * .82).moveTo(-size * .48, size * .38).lineTo(size * .48, size * .03).stroke({ color: 0xffeff8, width: 2, alpha: .55 })
    const glintY = size * (1 - 2 * ((time * 1.8) % 1))
    shield.moveTo(-size * .48, glintY).lineTo(size * .48, glintY - size * .12).stroke({ color: 0xfff7e8, width: 2, alpha: .7 })
    flash.position.copyFrom(a); flash.width = flash.height = Math.min(r * 2.4, room(a) * 2)
    flash.alpha = time >= .5 && time < .79 ? Math.sin((time - .5) / .29 * Math.PI) * .75 : 0
    for (const p of incoming) {
      const age = time - p.start, u = Math.max(0, Math.min(1, age / .32)), point = { x: b.x + (a.x - b.x) * u, y: b.y + (a.y - b.y) * u }
      p.g.position.copyFrom(point); p.g.rotation = Math.atan2(a.y - b.y, a.x - b.x); p.g.scale.set(Math.min(1, room(point) / 8))
      p.g.alpha = age >= 0 && age < .38 ? Math.min(1, age * 20) * Math.max(0, 1 - Math.max(0, age - .32) / .06) * .65 : 0
    }
    for (const p of outgoing) {
      const age = time - p.start, u = Math.max(0, Math.min(1, age / .38)), from = p.from ?? a, to = p.impact ?? b
      const point = { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }
      p.g.position.copyFrom(point); p.g.rotation = Math.atan2(to.y - from.y, to.x - from.x); p.g.scale.set(Math.min(1, room(point) / 63))
      p.g.alpha = age >= 0 && age < .53 ? Math.min(1, age * 30) * Math.max(0, 1 - Math.max(0, age - .38) / .15) : 0
    }
    const age = time - .92; bloom.clear(); bloom.alpha = impact && age >= 0 && age < .7 ? Math.pow(1 - age / .7, .7) : 0
    if (impact) {
      bloom.position.copyFrom(impact); const radius = Math.min(r * (.45 + age * 1.5), room(impact) - 2)
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + age * .7, x = Math.cos(a) * radius, y = Math.sin(a) * radius; bloom.poly([x, y - 4, x + 2, y, x, y + 4, x - 2, y]).fill(i % 2 ? 0xfab9e4 : 0xffe5ef) }
      bloom.ellipse(0, 0, Math.max(0, radius * .62), Math.max(0, radius * .82)).stroke({ color: 0xffd1e9, width: 2, alpha: .75 })
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .18 }, 0).to(attacker, { x: home.x, duration: .32 }, 1.4)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 3, yoyo: true }, .92)
    .call(() => { defender.tint = 0xffffff }, [], 1.2)
  outgoing.forEach((p, i) => {
    tl.call(() => { p.from = socket('aura', true); update(p.start) }, [], p.start)
      .call(() => { p.impact = targetSocket('center', true); if (i === 0) impact = { ...p.impact }; update(p.start + .38); if (i === 0) { onCue({ type: 'impact' }); defender.tint = 0xf4bee2 } }, [], p.start + .38)
  })
}
