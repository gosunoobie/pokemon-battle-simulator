import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// The non-Ghost ritual gathers weight around its user. Its independent art
// does not borrow the opponent-directed thorn seal or decide any stat change.
export default function curseSelfSetup(context) {
  const { tl, onFrame, onCue, random } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges)
  const top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const root = new Container(); root.label = 'curse-self-setup-root'; temporary.addChild(root)
  const bands = new Graphics(); bands.label = 'curse-self-setup-bands'; root.addChild(bands)
  const plates = Array.from({ length: 6 }, (_, i) => {
    const g = new Graphics(); g.label = `curse-self-setup-weight-${i}`; root.addChild(g)
    return { g, angle: i * Math.PI / 3, glint: random() * .22 }
  })
  const flecks = new Graphics(); flecks.label = 'curse-self-setup-flecks'; root.addChild(flecks)
  function update(time) {
    const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center', true)
    root.position.copyFrom(center)
    const size = Math.max(0, Math.min(1, (center.x - left - 4) / 91, (right - center.x - 4) / 91,
      (center.y - top - 4) / 98, (bottom - center.y - 4) / 98))
    root.scale.set(size)
    root.alpha = time >= .04 && time < 1.72 ? Math.min(1, (time - .04) / .18, (1.72 - time) / .37) : 0
    const gather = clamp((time - .1) / .7), lock = clamp((time - .8) / .22)
    const radius = 74 - gather * 18, pulse = Math.max(0, 1 - Math.abs(time - .8) / .27)
    bands.clear()
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * 34, rx = radius * (i === 1 ? .92 : .75)
      bands.ellipse(0, y, rx, 11).stroke({ color: 0x332c3e, width: 5, alpha: .39 })
        .ellipse(0, y, rx, 11).stroke({ color: i === 1 ? 0xbd8966 : 0x98849e, width: 1.7, alpha: .63 + pulse * .25 })
    }
    for (const { g, angle, glint } of plates) {
      const theta = angle + (1 - gather) * .5, x = Math.cos(theta) * radius, y = Math.sin(theta) * radius * 1.03
      g.position.set(x, y); g.rotation = theta + Math.PI / 2
      const breadth = 7 + gather * 4
      g.clear().poly([-breadth, -15, breadth, -15, breadth + 4, -9, breadth + 4, 9, breadth, 15,
        -breadth, 15, -breadth - 4, 9, -breadth - 4, -9]).fill({ color: 0x3e3546, alpha: .85 })
        .stroke({ color: 0xb08b86, width: 1.5, alpha: .8 })
        .moveTo(-breadth + 3, -10).lineTo(breadth - 3, -10).moveTo(-breadth + 3, 10).lineTo(breadth - 3, 10)
        .stroke({ color: 0xceb29b, width: 1.3, alpha: .75 })
        .poly([0, -8, 4, 0, 0, 8, -4, 0]).fill({ color: 0xe5b481, alpha: .35 + pulse * .5 })
      g.scale.set(1 + pulse * (.06 + glint * .1))
    }
    flecks.clear()
    for (let i = 0; i < 12; i++) {
      const theta = i * Math.PI / 6 + time * .26, r = radius + 8 + lock * 8
      const x = Math.cos(theta) * r, y = Math.sin(theta) * r + lock * 7
      flecks.moveTo(x - 2, y - 3).lineTo(x + 2, y + 3).stroke({ color: i % 2 ? 0xc9a184 : 0xab8aaf,
        width: 1.3, alpha: .3 + pulse * .55 })
    }
  }
  onFrame(update)
  tl.call(() => { update(.8); onCue({ type: 'impact' }) }, [], .8).call(() => {}, [], 1.8)
}
