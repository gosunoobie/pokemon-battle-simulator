import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function barrier(context) {
  const { tl, onCue, onFrame } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const w = Math.max(72, context.source.metrics.width / unit * .92)
  const h = Math.max(96, context.source.metrics.height / unit * 1.02)
  const wall = new Container(); wall.label = 'barrier-shield'; temporary.addChild(wall)
  const follow = () => { const p = socket('center', true); wall.position.set(p.x + w * .17, p.y) }
  follow(); onFrame(follow)
  const outline = new Graphics().poly([-w*.4,-h*.42,-w*.27,-h*.53,w*.27,-h*.53,w*.4,-h*.42,w*.4,h*.42,w*.27,h*.53,-w*.27,h*.53,-w*.4,h*.42])
    .fill({ color: 0x778bdf, alpha: .045 }).stroke({ color: 0xb1ccff, width: 2.4, alpha: .8 })
  outline.alpha = 0; outline.scale.y = .08; wall.addChild(outline)
  tl.to(outline, { alpha: .8, duration: .25 }, .16)
    .to(outline.scale, { y: 1, duration: .5, ease: 'power2.out' }, .16)
    .to(outline, { alpha: 0, duration: .38 }, 1.7)
  for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
    const rx = w * .12, ry = h * .096
    const pane = new Graphics().poly([-rx,0,-rx*.5,-ry,rx*.5,-ry,rx,0,rx*.5,ry,-rx*.5,ry])
      .fill({ color: (row + col) % 2 ? 0x82b7ee : 0x9c8de9, alpha: .16 })
      .stroke({ color: 0xc3d5ff, width: 1.3, alpha: .7 })
      .moveTo(-rx*.5,-ry*.7).lineTo(rx*.25,-ry*.7).stroke({ color: 0xf0f3ff, width: 1.5, alpha: .8 })
    const x = (col - 1) * w * .24 + (row % 2 ? w * .025 : 0), y = (row - 2) * h * .19
    pane.position.set(x, y + h * .2); pane.alpha = 0; wall.addChild(pane)
    const at = .18 + (4 - row) * .075 + col * .025
    tl.to(pane, { y, alpha: 1, duration: .17, ease: 'power2.out' }, at)
      .to(pane, { alpha: .55, duration: .2 }, at + .28)
      .to(pane, { y: y - h * .08, alpha: 0, duration: .32 }, 1.56 + row * .045)
  }
  for (let i = 0; i < 2; i++) {
    const chevron = new Graphics().moveTo(-w*.16,0).lineTo(0,-h*.08).lineTo(w*.16,0)
      .stroke({ color: 0xe2e7ff, width: 3, alpha: .8, cap: 'round', join: 'round' })
    chevron.y = h * .24; chevron.alpha = 0; wall.addChild(chevron)
    tl.to(chevron, { alpha: .9, duration: .1 }, .7 + i * .2)
      .to(chevron, { y: -h * .22, duration: .62, ease: 'sine.out' }, .7 + i * .2)
      .to(chevron, { alpha: 0, duration: .3 }, 1.02 + i * .2)
  }
  tl.call(() => onCue({ type: 'impact' }), [], .7)
}
