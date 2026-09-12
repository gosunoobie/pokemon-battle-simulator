import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function reflect(context) {
  const { tl, onCue, onFrame } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const w = Math.max(76, context.source.metrics.width / unit * 1.02)
  const h = Math.max(94, context.source.metrics.height / unit)
  const mirror = new Container(); mirror.label = 'reflect-shield'; temporary.addChild(mirror)
  onFrame(() => { const p = socket('center', true); mirror.position.set(p.x + w * .18, p.y) })
  const panels = []
  for (let i = 0; i < 3; i++) {
    const panel = new Container(); panel.x = (i - 1) * w * .28; panel.y = (i - 1) * h * .035
    panel.scale.x = .035; panel.alpha = 0; mirror.addChild(panel)
    const rw = w * .13, rh = h * (.49 - Math.abs(i - 1) * .045)
    const face = new Graphics().poly([-rw,-rh,rw,-rh+h*.045,rw,rh,-rw,rh-h*.045])
      .fill({ color: i === 1 ? 0xd2a6ed : 0xf7a9d8, alpha: .1 })
      .stroke({ color: 0xf9c9ed, width: 2, alpha: .9 })
      .moveTo(-rw*.82,rh-h*.07).lineTo(-rw*.82,-rh+h*.045)
      .stroke({ color: 0xb8edff, width: 1.4, alpha: .75 })
    const glint = new Graphics(); panel.addChild(face, glint)
    panels.push({ panel, glint, rw, rh, at: .24 + i * .12 })
    tl.to(panel, { alpha: 1, duration: .14 }, .18 + i * .12)
      .to(panel.scale, { x: 1, duration: .3, ease: 'power2.out' }, .18 + i * .12)
      .to(panel, { x: panel.x + (i - 1) * w * .035, alpha: 0, duration: .4 }, 1.65 + i * .06)
      .to(panel.scale, { x: .06, duration: .4, ease: 'sine.in' }, 1.65 + i * .06)
  }
  for (let i = 0; i < 3; i++) {
    const ripple = new Graphics().poly([0,-h*.26,w*.2,0,0,h*.26,-w*.2,0])
      .stroke({ color: i % 2 ? 0xbdeeff : 0xffd4f2, width: 1.6, alpha: .75 })
    ripple.alpha = 0; ripple.scale.set(.45); mirror.addChild(ripple)
    const at = .72 + i * .16
    tl.to(ripple, { alpha: .75, duration: .06 }, at)
      .to(ripple.scale, { x: 1.28, y: 1.28, duration: .43, ease: 'sine.out' }, at)
      .to(ripple, { alpha: 0, duration: .32 }, at + .11)
  }
  onFrame(time => {
    for (const p of panels) {
      p.glint.clear()
      const u = (time - p.at - .28) / .72
      if (u < 0 || u > 1) continue
      const y = p.rh * (.75 - 1.5 * u), alpha = Math.sin(Math.PI * u)
      p.glint.moveTo(-p.rw*.84,y+p.rh*.1).lineTo(p.rw*.84,y-p.rh*.1)
        .stroke({ color: 0xffffff, width: 6, alpha: alpha * .15 })
        .moveTo(-p.rw*.84,y+p.rh*.1).lineTo(p.rw*.84,y-p.rh*.1)
        .stroke({ color: 0xe7f8ff, width: 1.8, alpha: alpha * .8 })
    }
  })
  tl.call(() => onCue({ type: 'impact' }), [], .72)
}
