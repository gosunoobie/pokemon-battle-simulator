import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function poisonFang(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, solveContact, unit } = bindEffectSpace(context)
  const at = .58, size = Math.min(1.1, Math.max(.78, context.target.metrics.width / unit / 180))
  const point = { x: focus.x, y: focus.y + 6 }, pose = solveContact('emission', .025, point)
  const jaws = new Container(); jaws.label = 'poison-fang-teeth'; jaws.position.copyFrom(point); jaws.scale.set(size); jaws.alpha = 0; temporary.addChild(jaws)
  const upper = new Container(); upper.y = -57; jaws.addChild(upper)
  for (const side of [-1, 1]) {
    const fang = new Graphics().moveTo(-12, -16).quadraticCurveTo(2, -25, 11, -13)
      .quadraticCurveTo(13, 13, -3, 35).quadraticCurveTo(1, 7, -8, -3).closePath()
      .fill(0xe5d5f2).stroke({ color: 0x9772b4, width: 1.6, join: 'round' })
      .moveTo(3, -13).quadraticCurveTo(6, 7, -3, 28).stroke({ color: 0xb1e58d, width: 2, alpha: .9 })
    fang.x = side * 23; fang.scale.x = -side; upper.addChild(fang)
  }
  const lower = new Graphics().moveTo(-46, -5).quadraticCurveTo(0, 21, 46, -5)
    .stroke({ color: 0x685079, width: 6, cap: 'round' })
    .moveTo(-43, -5).quadraticCurveTo(0, 17, 43, -5).stroke({ color: 0xd9c1e9, width: 2 })
  lower.y = 43; jaws.addChild(lower)
  const droplets = []
  for (let i = 0; i < 20; i++) {
    const drop = new Graphics().moveTo(0, -4).quadraticCurveTo(4.5, 1, 0, 5)
      .quadraticCurveTo(-4.5, 1, 0, -4).closePath().fill(i % 4 ? 0xbb83df : 0xb4df88)
    drop.alpha = 0; drop.scale.set(.55 + random() * .38); temporary.addChild(drop)
    const side = i % 2 ? 1 : -1
    droplets.push({ drop, birth: at + .045 + i * .023, life: .55 + random() * .15,
      x: point.x + side * 26 * size, y: point.y + 9 * size,
      vx: side * (9 + random() * 25), vy: -18 - random() * 28 })
  }
  onFrame(time => {
    for (const p of droplets) {
      const age = time - p.birth
      if (age < 0 || age > p.life) { p.drop.alpha = 0; continue }
      p.drop.position.set(p.x + p.vx * age, p.y + p.vy * age + 88 * age * age)
      p.drop.rotation = Math.atan2(p.vy + 176 * age, p.vx) - Math.PI / 2
      p.drop.alpha = Math.min(1, age / .04) * Math.max(0, 1 - (age / p.life) ** 2) * .86
    }
  })
  for (const side of [-1, 1]) {
    const seep = new Graphics().moveTo(0, 0).quadraticCurveTo(side * 6, 9, side * 2, 18)
      .quadraticCurveTo(-side * 3, 26, side * 5, 32).stroke({ color: 0xbb82db, width: 2.5, alpha: .75, cap: 'round' })
    seep.position.set(point.x + side * 26 * size, point.y + 9 * size); seep.alpha = 0; seep.scale.y = .15; temporary.addChild(seep)
    tl.to(seep, { alpha: .8, duration: .1 }, at + .06)
      .to(seep.scale, { y: size, duration: .4, ease: 'sine.out' }, at + .06)
      .to(seep, { y: seep.y + 13, alpha: 0, duration: .43, ease: 'sine.in' }, 1.04)
    const pulse = new Graphics().circle(0, 0, 9).stroke({ color: 0xd3a1ed, width: 2, alpha: .8 })
    pulse.position.set(point.x + side * 26 * size, point.y + 9 * size); pulse.alpha = 0; temporary.addChild(pulse)
    tl.to(pulse, { alpha: .85, duration: .045 }, at)
      .to(pulse.scale, { x: 1.8 * size, y: 1.8 * size, duration: .35, ease: 'power2.out' }, at)
      .to(pulse, { alpha: 0, duration: .25 }, at + .13)
  }
  tl.to(attacker, { x: home.x - 8, rotation: -.05, duration: .22 }, 0)
    .to(attacker, { ...pose, duration: .36, ease: 'power2.in' }, .22)
    .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .4, ease: 'power2.inOut' }, .72)
    .to(jaws, { alpha: 1, duration: .12 }, .29)
    .to(upper, { y: -26, duration: .12, ease: 'power3.in' }, .46)
    .to(lower, { y: 16, duration: .12, ease: 'power3.in' }, .46)
    .to(upper, { y: -41, duration: .2 }, .79).to(lower, { y: 28, duration: .2 }, .79)
    .to(jaws, { alpha: 0, duration: .23 }, .83)
    .call(() => { onCue({ type: 'impact' }); defender.tint = 0xd4a1e6 }, [], at)
    .to(defender, { x: defenderHome.x + 7, duration: .065, repeat: 3, yoyo: true, ease: 'none' }, at)
    .call(() => { defender.tint = 0xffffff }, [], .79)
    .call(() => { defender.tint = 0xe2bee9 }, [], 1.01)
    .call(() => { defender.tint = 0xffffff }, [], 1.21)
}
