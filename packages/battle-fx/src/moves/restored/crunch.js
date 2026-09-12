import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function crunch(context) {
  const { tl, random, glowTexture, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, solveContact, world, unit } = bindEffectSpace(context)
  const at = .64, size = Math.min(1.12, Math.max(.78, context.target.metrics.width / unit / 184))
  const point = { x: focus.x, y: focus.y + 6 }, pose = solveContact('emission', .065, point)
  const pressure = new Sprite(glowTexture); pressure.anchor.set(.5); pressure.position.copyFrom(point)
  pressure.width = 174 * size; pressure.height = 130 * size; pressure.tint = 0x815ca0; pressure.alpha = 0; temporary.addChild(pressure)
  const jaws = new Container(); jaws.label = 'crunch-jaws'; jaws.position.copyFrom(point); jaws.scale.set(size); jaws.rotation = -.07; jaws.alpha = 0; temporary.addChild(jaws)
  for (const side of [-1, 1]) {
    const jaw = new Graphics().poly([-65, -8, -49, -23, -18, -29, 17, -27, 48, -21, 65, -7, 45, -9, 13, -15, -16, -16, -44, -11])
      .fill({ color: 0x302a3e, alpha: .86 }).stroke({ color: 0x8e789f, width: 2, join: 'round' })
    for (let i = 0; i < 5; i++) {
      const x = -47 + i * 23 + (side === 1 ? 6 : 0), tip = i % 2 ? 19 : 27
      jaw.poly([x - 10, -13, x + 10, -13, x + 7, 3, x, tip, x - 6, 4]).fill(0xe4ded5)
        .stroke({ color: 0x74627e, width: 1.5, join: 'round' })
      jaw.moveTo(x - 5, -8).lineTo(x, tip - 8).stroke({ color: 0xfff8e9, width: 2, alpha: .75 })
    }
    jaw.scale.y = -side; jaw.y = side * 48; jaws.addChild(jaw)
    tl.to(jaw, { y: side * 17, duration: .15, ease: 'power3.in' }, .49)
      .to(jaw, { y: side * 12, duration: .13, ease: 'power2.in' }, .76)
      .to(jaw, { y: side * 31, duration: .2, ease: 'power2.out' }, .99)
  }
  const cracks = new Graphics(); cracks.alpha = 0; cracks.position.copyFrom(point); cracks.scale.set(size); temporary.addChild(cracks)
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7, dx = Math.cos(a), dy = Math.sin(a)
    cracks.moveTo(dx * 18, dy * 12).lineTo(dx * 35 - dy * 6, dy * 24 + dx * 6)
      .lineTo(dx * 41 + dy * 4, dy * 28 - dx * 4).lineTo(dx * 64, dy * 43)
      .stroke({ color: i % 2 ? 0xc5adcf : 0xffecd4, width: i % 2 ? 2 : 3, alpha: .85, join: 'round' })
  }
  for (let i = 0; i < 14; i++) {
    const a = random() * Math.PI * 2, radius = (38 + random() * 36) * size
    const shard = new Graphics().poly([-3, -5, 4, -2, 2, 5, -4, 1]).fill(i % 3 ? 0x9b83b1 : 0xf6e4cc)
    shard.alpha = 0; shard.position.copyFrom(point); temporary.addChild(shard)
    const birth = at + i % 3 * .035
    tl.set(shard, { alpha: .85 }, birth)
      .to(shard, { x: point.x + Math.cos(a) * radius, y: point.y + Math.sin(a) * radius * .68 + 10, rotation: (i % 2 ? 1 : -1) * 2.5, duration: .43, ease: 'power2.out' }, birth)
      .to(shard, { alpha: 0, duration: .23 }, birth + .2)
  }
  tl.to(attacker, { x: home.x - 15, rotation: -.09, duration: .28 }, 0)
    .to(attacker, { ...pose, duration: .36, ease: 'power2.in' }, .28)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .49, ease: 'power2.inOut' }, 1.04)
    .to(jaws, { alpha: 1, duration: .14 }, .3)
    .to(jaws, { rotation: .035, duration: .12 }, .69).to(jaws, { rotation: -.025, duration: .15 }, .81)
    .to(jaws, { alpha: 0, duration: .24 }, 1.08)
    .to(pressure, { alpha: .38, duration: .12 }, .53).to(pressure, { alpha: 0, duration: .38 }, .97)
    .to(cracks, { alpha: 1, duration: .04 }, at).to(cracks, { alpha: 0, duration: .28 }, .83)
    .call(() => { onCue({ type: 'impact' }); defender.tint = 0xcbb5d7 }, [], at)
    .to(defender.scale, { x: 1.035, y: .94, duration: .13, ease: 'power2.out' }, at)
    .to(defender.scale, { x: 1, y: 1, duration: .22, ease: 'sine.out' }, .99)
    .to(defender, { x: defenderHome.x + 5, duration: .065, repeat: 5, yoyo: true, ease: 'none' }, at)
    .to(world, { x: 2.5, y: -1, duration: .065, repeat: 3, yoyo: true, ease: 'none' }, at)
    .call(() => { defender.tint = 0xffffff }, [], .94)
}
