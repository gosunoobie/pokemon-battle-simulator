import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function bite(context) {
  const { tl, glowTexture, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, solveContact, unit } = bindEffectSpace(context)
  const at = .44, size = Math.min(1.1, Math.max(.75, context.target.metrics.width / unit / 176))
  const point = { x: focus.x, y: focus.y + 6 }, pose = solveContact('emission', .04, point)
  const jaws = new Container(); jaws.label = 'bite-jaws'; jaws.position.copyFrom(point); jaws.scale.set(size); jaws.alpha = 0
  temporary.addChild(jaws)
  for (const side of [-1, 1]) {
    const jaw = new Graphics().moveTo(-52, -7).quadraticCurveTo(0, -26, 52, -7)
      .stroke({ color: 0x554b62, width: 7, cap: 'round' })
      .moveTo(-49, -8).quadraticCurveTo(0, -24, 49, -8).stroke({ color: 0xd7d2e2, width: 2 })
    for (let i = 0; i < 4; i++) {
      const x = -36 + i * 24 + (side === 1 ? 5 : 0), tip = i % 3 === 0 ? 22 : 15
      jaw.poly([x - 9, -11, x + 9, -11, x + 1, tip]).fill(0xf6eee0)
        .stroke({ color: 0x71637b, width: 1.4, join: 'round' })
      jaw.moveTo(x - 4, -7).lineTo(x + 1, tip - 6).stroke({ color: 0xffffff, width: 1.5, alpha: .8 })
    }
    jaw.scale.y = -side; jaw.y = side * 38; jaws.addChild(jaw)
    tl.to(jaw, { y: side * 12, duration: .09, ease: 'power3.in' }, at - .09)
      .to(jaw, { y: side * 23, duration: .14, ease: 'power2.out' }, at + .12)
  }
  const flash = new Sprite(glowTexture); flash.anchor.set(.5); flash.position.copyFrom(point)
  flash.width = 92 * size; flash.height = 66 * size; flash.tint = 0xffe8bd; flash.alpha = 0; flash.blendMode = 'add'; temporary.addChild(flash)
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5, dx = Math.cos(angle), dy = Math.sin(angle)
    const fleck = new Graphics().moveTo(0, 0).lineTo(dx * (7 + i % 3 * 3), dy * (7 + i % 3 * 3))
      .stroke({ color: i % 2 ? 0xffedd0 : 0xbbaec8, width: 2, cap: 'round' })
    fleck.alpha = 0; fleck.position.copyFrom(point); temporary.addChild(fleck)
    tl.set(fleck, { alpha: .9 }, at)
      .to(fleck, { x: point.x + dx * 47 * size, y: point.y + dy * 32 * size, duration: .26, ease: 'power2.out' }, at)
      .to(fleck, { alpha: 0, duration: .17 }, at + .09)
  }
  tl.to(attacker, { x: home.x - 10, rotation: -.04, duration: .16 }, 0)
    .to(attacker, { ...pose, duration: .28, ease: 'power2.in' }, .16)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .38, ease: 'power2.inOut' }, .59)
    .to(jaws, { alpha: 1, duration: .08 }, .25)
    .to(jaws, { alpha: 0, duration: .19 }, .63)
    .to(flash, { alpha: .48, duration: .025 }, at).to(flash, { alpha: 0, duration: .22 }, at + .03)
    .call(() => { onCue({ type: 'impact' }); defender.tint = 0xe8dce9 }, [], at)
    .to(defender, { x: defenderHome.x + 9, duration: .055, repeat: 3, yoyo: true, ease: 'none' }, at)
    .call(() => { defender.tint = 0xffffff }, [], at + .16)
}
