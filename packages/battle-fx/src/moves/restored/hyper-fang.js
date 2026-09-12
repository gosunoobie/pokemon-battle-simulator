import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function hyperFang(context) {
  const { tl, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, solveContact, unit } = bindEffectSpace(context)
  const at = .38, size = Math.min(1.1, Math.max(.76, context.target.metrics.height / unit / 174))
  const point = { x: focus.x, y: focus.y + 6 }, pose = solveContact('emission', .11, point)
  const fangs = new Container(); fangs.label = 'hyper-fang-teeth'; fangs.position.copyFrom(point); fangs.scale.set(size); fangs.rotation = -.24; fangs.alpha = 0; temporary.addChild(fangs)
  for (const side of [-1, 1]) {
    const fang = new Graphics().moveTo(-12, -21).quadraticCurveTo(3, -29, 13, -17)
      .lineTo(1, 35).quadraticCurveTo(-9, 12, -12, -21).closePath().fill(0xfff4d3)
      .stroke({ color: 0xd4ad62, width: 1.8, join: 'round' })
      .moveTo(-5, -16).lineTo(1, 23).stroke({ color: 0xffffff, width: 3, alpha: .9, cap: 'round' })
    fang.scale.y = -side; fang.x = side * 18; fang.y = side * 63; fangs.addChild(fang)
    tl.to(fang, { y: side * 18, duration: .105, ease: 'power4.in' }, at - .105)
      .to(fang, { y: side * 35, duration: .12, ease: 'power2.out' }, at + .07)
    const trail = new Graphics().moveTo(side * 18, side * 112).lineTo(side * 18, side * 46)
      .stroke({ color: 0xffe2a2, width: 2, alpha: .7, cap: 'round' })
    trail.alpha = 0; fangs.addChild(trail)
    tl.to(trail, { alpha: 1, duration: .03 }, .255).to(trail, { alpha: 0, duration: .09 }, at)
  }
  const flash = new Graphics(); flash.position.copyFrom(point); flash.scale.set(size); flash.rotation = -.24; flash.alpha = 0; temporary.addChild(flash)
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a)
    flash.poly([-dy * 5, dx * 5, dx * 55, dy * 55, dy * 5, -dx * 5]).fill(i % 2 ? 0xffdaa0 : 0xffffff)
  }
  flash.circle(0, 0, 6).fill(0xffffff)
  for (let i = 0; i < 2; i++) {
    const ring = new Graphics().ellipse(0, 0, 10, 7).stroke({ color: 0xffe8b1, width: 2, alpha: .9 })
    ring.alpha = 0; ring.position.set(point.x + (i ? 16 : -16) * size, point.y); ring.rotation = -.24; temporary.addChild(ring)
    tl.to(ring, { alpha: 1, duration: .025 }, at)
      .to(ring.scale, { x: 2.2, y: 2.2, duration: .21, ease: 'power2.out' }, at)
      .to(ring, { alpha: 0, duration: .17 }, at + .05)
  }
  tl.to(attacker, { x: home.x - 7, y: home.y + 3, rotation: -.04, duration: .1 }, 0)
    .to(attacker, { x: pose.x * .78, y: pose.y - 27, rotation: .025, duration: .14, ease: 'power2.in' }, .1)
    .to(attacker, { ...pose, duration: .14, ease: 'power3.in' }, .24)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .4, ease: 'power2.inOut' }, .48)
    .to(fangs, { alpha: 1, duration: .045 }, .23).to(fangs, { alpha: 0, duration: .15 }, .51)
    .to(flash, { alpha: .95, duration: .02 }, at).to(flash, { alpha: 0, duration: .14 }, at + .045)
    .call(() => { onCue({ type: 'impact' }); defender.tint = 0xffebc7 }, [], at)
    .to(defender, { x: defenderHome.x + 15, y: defenderHome.y - 3, duration: .06, ease: 'power2.out' }, at)
    .to(defender, { x: defenderHome.x, y: defenderHome.y, duration: .2, ease: 'power2.out' }, at + .06)
    .call(() => { defender.tint = 0xffffff }, [], at + .13)
}
