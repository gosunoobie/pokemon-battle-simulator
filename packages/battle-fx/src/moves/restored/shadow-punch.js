import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function shadowPunch(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, defender, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('fist') ? 'fist' : 'hand'
  const r = Math.min(33, Math.max(20, context.source.metrics.height / unit * .125))
  const right = Math.max(-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x)
  const recoil = Math.max(0, Math.min(9, right - targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center').x - context.target.metrics.width / (2 * unit)))
  // The spectral fist travels independently; the user stays at its own slot.
  function shape() {
    return new Graphics().poly([-r * .7, -r * .28, -r * .31, -r * .64, r * .71, -r * .64, r, -r * .3, r, r * .24, r * .66, r * .51, r * .08, r * .64, -r * .58, r * .37])
      .fill(0x34243f).stroke({ color: 0xbd87df, width: 2, join: 'round' })
      .moveTo(-r * .15, -r * .5).lineTo(-r * .14, -r * .16).moveTo(r * .24, -r * .5).lineTo(r * .24, -r * .14)
      .moveTo(r * .61, -r * .46).lineTo(r * .61, -r * .1).moveTo(-r * .4, r * .03).quadraticCurveTo(0, -r * .07, r * .34, r * .25)
      .stroke({ color: 0x8563a2, width: 1.4, cap: 'round' })
  }
  const ghosts = Array.from({ length: 3 }, () => { const g = shape(); g.label = 'shadow-punch-afterimage'; g.alpha = 0; temporary.addChild(g); return g })
  const mist = new Graphics(); mist.label = 'shadow-punch-mist'; temporary.addChild(mist)
  const fist = new Container(); fist.label = 'shadow-punch-fist'; fist.alpha = 0; fist.addChild(shape()); temporary.addChild(fist)
  const crescent = new Graphics(); crescent.label = 'shadow-punch-impact'; crescent.alpha = 0; temporary.addChild(crescent)
  crescent.arc(0, 0, r * 1.05, -.9, 1.4).stroke({ color: 0xcea0ed, width: 3.5, cap: 'round' })
    .arc(0, 0, r * .72, 2.1, 4.3).stroke({ color: 0x9166b9, width: 2.2, cap: 'round' })
  const wisps = Array.from({ length: 12 }, (_, i) => {
    const g = new Graphics().ellipse(0, 0, 4 + random() * 3, 2 + random() * 2).fill(i % 2 ? 0x9d7db9 : 0x625074)
    g.label = 'shadow-punch-wisp'; g.alpha = 0; temporary.addChild(g)
    return { g, angle: i * Math.PI / 6, life: .42 + random() * .24, distance: r * (1.3 + random() * .6) }
  })
  let launch
  const flight = { progress: 0 }
  function route(p) {
    const start = launch ?? socket(attachment, true), target = targetSocket('center', true), angle = -.1 + p * .16
    return { x: start.x + (target.x - Math.cos(angle) * r - start.x) * p, y: start.y + (target.y - Math.sin(angle) * r - start.y) * p - Math.sin(Math.PI * p) * r * .48, angle }
  }
  function update(time) {
    const p = flight.progress, position = route(p); fist.position.set(position.x, position.y); fist.rotation = position.angle
    const target = targetSocket('center', true); crescent.position.copyFrom(target); mist.clear(); mist.alpha = time < .96 ? 1 : 0
    for (let i = 0; i < 3; i++) {
      const ghost = ghosts[i], delayed = Math.max(0, p - (i + 1) * .075), q = route(delayed)
      ghost.position.set(q.x, q.y); ghost.rotation = q.angle
      ghost.alpha = time >= .32 && time < .86 ? Math.sin(Math.PI * Math.min(1, p)) * (.24 - i * .05) : 0
      const wave = Math.sin(time * 8 + i * 2) * r * .15
      if (time < .96) mist.moveTo(position.x - r * .65, position.y + (i - 1) * r * .26)
        .quadraticCurveTo(position.x - r * 1.5, position.y - r * .45 + wave, position.x - r * (1.7 + i * .18), position.y + r * .1 + wave)
        .stroke({ color: i % 2 ? 0x9c76ba : 0x695078, width: 5 - i, alpha: fist.alpha * .35, cap: 'round' })
    }
    for (const p of wisps) {
      const age = time - .74, t = age / p.life
      p.g.alpha = t >= 0 && t < 1 ? Math.sin(Math.PI * t) * .65 : 0
      if (age >= 0) { const a = p.angle + t * 1.4, reach = p.distance * (1 - t * .7); p.g.position.set(target.x + Math.cos(a) * reach, target.y + Math.sin(a) * reach * .72); p.g.rotation = a }
    }
  }
  onFrame(update)
  tl.to(fist, { alpha: 1, duration: .25 }, .06)
    .call(() => { launch = socket(attachment, true) }, [], .32)
    .to(flight, { progress: 1, duration: .42, ease: 'power2.in' }, .32)
    .to(fist, { alpha: 0, duration: .2 }, .78)
    .to(crescent, { alpha: .9, duration: .04 }, .74).to(crescent.scale, { x: 1.24, y: 1.24, duration: .28 }, .74)
    .to(crescent, { alpha: 0, rotation: .65, duration: .32 }, .86)
    .call(() => { update(.74); onCue({ type: 'impact' }); defender.tint = 0xc7a3dd }, [], .74)
    .to(defender, { x: defenderHome.x + recoil, duration: .1 }, .74).to(defender, { x: defenderHome.x, duration: .28, ease: 'power2.out' }, .86)
    .call(() => { defender.tint = 0xffffff }, [], 1.08)
}
