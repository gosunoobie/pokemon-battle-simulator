import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Mist is a local, airy veil with counter-flowing ribbons.
export default function mist(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const art = new Container(); art.label = 'mist-veil'; art.alpha = 0; temporary.addChild(art)
  art.addChild(new Graphics().ellipse(0, 0, 74, 91).fill({ color: 0xd9f3f5, alpha: .055 }))
  const bands = Array.from({ length: 7 }, (_, i) => { const g = new Graphics(); g.label = 'mist-ribbon'; art.addChild(g); return g })
  const beads = Array.from({ length: 14 }, () => { const g = new Graphics().circle(0, 0, 1.5).fill(0xe8fcff); art.addChild(g); return g })
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  function update(time) {
    const p = socket('visualCenter', true), room = Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-3)
    art.position.copyFrom(p); art.scale.set(Math.min(1, room/101))
    bands.forEach((g, i) => { g.clear(); const y = -62 + i * 20, drift = Math.sin(time * 1.7 + i) * 5
      for (let j = 0; j <= 30; j++) { const x = -72 + j * 4.8, yy = y + Math.sin(j * .21 + time * (i % 2 ? 1 : -1) * 2 + i) * 8 + drift; j ? g.lineTo(x, yy) : g.moveTo(x, yy) }
      g.stroke({ color: i % 2 ? 0xc2e7eb : 0xe7f9ff, width: 7 - i * .5, alpha: .2 + Math.sin(time + i) ** 2 * .12 })
    })
    beads.forEach((g, i) => { const a = i * 2.4 + time * .55; g.position.set(Math.cos(a) * (45 + i % 3 * 12), Math.sin(a) * 82); g.alpha = .2 + Math.sin(time * 2 + i) ** 2 * .55 })
  }
  onFrame(update)
  tl.to(art, { alpha: 1, duration: .44 }, .04).to(art, { alpha: 0, duration: .53 }, 1.55)
    .call(() => { update(.82); onCue({ type: 'impact' }) }, [], .82)
}
