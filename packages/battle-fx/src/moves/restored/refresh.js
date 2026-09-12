import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function refresh(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const width = Math.min(110, Math.max(42, context.source.metrics.width / unit * .52))
  const height = Math.min(190, Math.max(80, context.source.metrics.height / unit * .95))
  const veil = new Container(); veil.label = 'refresh-aura'; temporary.addChild(veil)
  const rings = [], glints = []
  for (let i = 0; i < 3; i++) {
    const g = new Graphics().ellipse(0, 0, width, width * .23).stroke({ color: i === 1 ? 0xffffff : 0xa9f5e1, width: 2.6 - i * .4 })
      .ellipse(0, 0, width * .9, width * .19).stroke({ color: 0xa7dfe8, width: .9, alpha: .45 })
    g.alpha = 0; veil.addChild(g); rings.push(g)
  }
  for (let i = 0; i < 18; i++) {
    const g = new Graphics().poly([0,-4,1.2,-1.2,4,0,1.2,1.2,0,4,-1.2,1.2,-4,0,-1.2,-1.2]).fill(i % 3 ? 0xd9fff1 : 0xffffff)
    g.alpha = 0; veil.addChild(g); glints.push(g)
  }
  const pulse = new Graphics().ellipse(0, 0, width * .82, height * .44).fill({ color: 0xc6f4dd, alpha: .1 })
  pulse.alpha = 0; veil.addChild(pulse)
  const update = time => {
    veil.position.copyFrom(socket('center', true))
    rings.forEach((g, i) => {
      const age = time - .12 - i * .16, u = Math.max(0, Math.min(1, age / 1.15))
      g.y = height * (.45 - u * .98); g.scale.set(.75 + Math.sin(Math.PI * u) * .3)
      g.alpha = age >= 0 && age <= 1.15 ? Math.sin(Math.PI * u) * .9 : 0
    })
    glints.forEach((g, i) => {
      const age = time - .38 - i * .045, u = Math.max(0, Math.min(1, age / .65)), a = i * 2.4
      g.position.set(Math.cos(a) * width * (.45 + u * .55), Math.sin(a) * height * .34 - u * 22)
      g.rotation = u * .7; g.scale.set(.4 + Math.sin(Math.PI * u) * .7)
      g.alpha = age >= 0 && age <= .65 ? Math.sin(Math.PI * u) : 0
    })
  }
  onFrame(update)
  tl.to(pulse, { alpha: 1, duration: .18 }, .5).to(pulse, { alpha: 0, duration: .48 }, .68)
    .call(() => { update(.68); onCue({ type: 'impact' }) }, [], .68)
}
