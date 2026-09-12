import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function lightScreen(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const w = Math.max(70, context.source.metrics.width / unit * .9)
  const h = Math.max(90, context.source.metrics.height / unit * 1.04)
  const glass = new Container(); glass.label = 'light-screen-shield'; glass.alpha = 0; temporary.addChild(glass)
  const rise = { y: h * .2 }
  const face = new Graphics().poly([-w*.42,-h*.5,w*.42,-h*.44,w*.42,h*.5,-w*.42,h*.44])
    .fill({ color: 0xffd56d, alpha: .075 }).stroke({ color: 0xffe9aa, width: 2.2, alpha: .9 })
    .poly([-w*.46,-h*.54,w*.46,-h*.47,w*.46,h*.54,-w*.46,h*.47])
    .stroke({ color: 0xffcf70, width: 1, alpha: .5 })
  glass.addChild(face)
  const sheen = new Graphics(); glass.addChild(sheen)
  const stars = []
  for (let i = 0; i < 6; i++) {
    const star = new Graphics().poly([0,-5,1.4,-1.4,5,0,1.4,1.4,0,5,-1.4,1.4,-5,0,-1.4,-1.4]).fill(0xfff7d5)
    star.position.set((i % 2 ? 1 : -1) * w * .42, (i % 3 - 1) * h * .38)
    star.alpha = 0; glass.addChild(star); stars.push({ star, at: .52 + i * .13 })
  }
  onFrame(time => {
    const p = socket('center', true); glass.position.set(p.x + w * .2, p.y + rise.y)
    sheen.clear()
    for (let i = 0; i < 3; i++) {
      const u = (time - .26 - i * .26) / .9
      if (u < 0 || u > 1) continue
      const y = h * (.39 - u * .78), alpha = Math.sin(Math.PI * u)
      sheen.moveTo(-w*.4,y-h*.03).lineTo(w*.4,y+h*.03)
        .stroke({ color: 0xfff4ce, width: 6, alpha: alpha * .18, cap: 'round' })
        .moveTo(-w*.4,y-h*.03).lineTo(w*.4,y+h*.03)
        .stroke({ color: 0xfff8de, width: 1.5, alpha: alpha * .75 })
    }
    for (const p of stars) {
      const u = (time - p.at) / .48
      p.star.alpha = u >= 0 && u <= 1 ? Math.sin(Math.PI * u) * .95 : 0
      p.star.scale.set(.5 + Math.max(0, p.star.alpha) * .65)
      p.star.rotation = Math.max(0, u) * .3
    }
  })
  tl.to(glass, { alpha: 1, duration: .4 }, .14)
    .to(rise, { y: 0, duration: .56, ease: 'power2.out' }, .14)
    .call(() => onCue({ type: 'impact' }), [], .7)
    .to(face, { alpha: .6, duration: .24, repeat: 1, yoyo: true }, .84)
    .to(rise, { y: -h * .07, duration: .42, ease: 'sine.in' }, 1.65)
    .to(glass, { alpha: 0, duration: .42 }, 1.65)
}
