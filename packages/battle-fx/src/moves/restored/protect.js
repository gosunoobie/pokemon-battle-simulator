import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function protect(context) {
  const { tl, random, onCue, onFrame } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const rx = Math.max(44, context.source.metrics.width / unit * .59)
  const ry = Math.max(54, context.source.metrics.height / unit * .56)
  const dome = new Container(); dome.label = 'protect-shield'; dome.alpha = 0; dome.scale.set(.18); temporary.addChild(dome)
  const shell = new Graphics().ellipse(0,0,rx,ry).fill({ color: 0x52d9a6, alpha: .09 })
    .stroke({ color: 0x8bffd4, width: 3, alpha: .85 })
    .ellipse(0,0,rx*.93,ry*.94).stroke({ color: 0xddffed, width: 1.2, alpha: .55 })
    .ellipse(0,0,rx*.5,ry).stroke({ color: 0xa1ffe0, width: 1, alpha: .25 })
  for (const y of [-.36,.12,.52]) shell.ellipse(0,ry*y,rx*Math.sqrt(1-y*y),ry*.14)
    .stroke({ color: 0xc4ffe6, width: 1, alpha: .28 })
  shell.moveTo(-rx*.7,-ry*.52).bezierCurveTo(-rx*.5,-ry*.9,rx*.3,-ry,rx*.62,-ry*.65)
    .stroke({ color: 0xf0fff9, width: 4, alpha: .65, cap: 'round' })
  dome.addChild(shell)
  const motes = []
  for (let i = 0; i < 16; i++) {
    const mote = new Graphics().circle(0,0,1.4+random()*1.4).fill(0xdcffec)
    mote.alpha = 0; dome.addChild(mote); motes.push({ mote, phase: i * Math.PI / 8, speed: .8 + random() * .7 })
  }
  onFrame(time => {
    dome.position.copyFrom(socket('center', true))
    const age = time - .42
    shell.scale.set(1 + Math.sin(Math.max(0, age) * 10) * .018)
    for (const p of motes) {
      const a = p.phase + Math.max(0, age) * p.speed
      p.mote.position.set(Math.cos(a) * rx * .96, Math.sin(a) * ry * .96)
      p.mote.alpha = age >= 0 && age < 1.2 ? Math.sin(Math.PI * age / 1.2) * (.45 + Math.sin(a * 3) ** 2 * .45) : 0
    }
  })
  for (let i = 0; i < 2; i++) {
    const ripple = new Graphics().ellipse(0,0,rx,ry).stroke({ color: 0x98ffce, width: 1.7, alpha: .8 })
    ripple.alpha = 0; dome.addChild(ripple)
    const at = .5 + i * .28
    tl.to(ripple, { alpha: .65, duration: .06 }, at)
      .to(ripple.scale, { x: 1.1, y: 1.08, duration: .42, ease: 'sine.out' }, at)
      .to(ripple, { alpha: 0, duration: .36 }, at + .06)
  }
  tl.to(dome, { alpha: 1, duration: .2 }, .14)
    .to(dome.scale, { x: 1, y: 1, duration: .36, ease: 'back.out(1.1)' }, .14)
    .call(() => onCue({ type: 'impact' }), [], .5)
    .to(dome.scale, { x: .96, y: 1.025, duration: .32, ease: 'sine.inOut' }, 1.3)
    .to(dome, { alpha: 0, duration: .4 }, 1.48)
}
