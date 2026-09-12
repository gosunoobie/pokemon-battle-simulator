import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function encore(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const r = Math.min(47, Math.max(30, context.target.metrics.height / unit * .23))
  const applause = new Container(); applause.label = 'encore-applause'; applause.alpha = 0; temporary.addChild(applause)
  const hands = [-1, 1].map(side => {
    const hand = new Container(); hand.label = `encore-hand-${side}`; applause.addChild(hand)
    hand.addChild(new Graphics().roundRect(-9, -7, 17, 22, 5).fill(0xf1c5a2).stroke({ color: 0xffe5c6, width: 1.2 })
      .roundRect(-9, -19, 3.8, 17, 1.8).fill(0xffdfbd).roundRect(-4.4, -23, 3.8, 20, 1.8).fill(0xffe8ce)
      .roundRect(.2, -22, 3.8, 19, 1.8).fill(0xffdfbd).roundRect(4.8, -18, 3.8, 16, 1.8).fill(0xf7d2ad)
      .roundRect(6, 1, 6, 12, 3).fill(0xffdfbd))
    hand.scale.set(side * r / 45, r / 45); return { hand, side }
  })
  const rings = new Graphics(); applause.addChild(rings)
  const stars = Array.from({ length: 18 }, (_, i) => {
    const g = new Graphics().poly([0,-4,1.3,-1.2,4,0,1.3,1.2,0,4,-1.3,1.2,-4,0,-1.3,-1.2]).fill(i%3 === 0 ? 0xf5b9d0 : i%3 === 1 ? 0xffe9a9 : 0xcaddeb)
    g.alpha = 0; applause.addChild(g); return g
  })
  function update(time) {
    const to = targetSocket('center', true); applause.position.copyFrom(to); applause.scale.set(Math.min(1, room(to) / (r * 1.7)))
    let snap = 0
    for (const hit of [.64, .98, 1.32]) snap = Math.max(snap, Math.max(0, 1 - Math.abs(time-hit) / .14))
    hands.forEach(({ hand, side }) => { hand.position.set(side * r * (.76 - snap * .56), r * .08); hand.rotation = side * (.28 - snap * .22) })
    rings.clear()
    for (const hit of [.64, .98, 1.32]) {
      const u = (time-hit)/.38
      if (u < 0 || u > 1) continue
      rings.ellipse(0, -r * .2, r * (.3+u*.85), r * (.2+u*.52)).stroke({ color: 0xffe7b2, width: 2*(1-u)+.6, alpha: (1-u)*.75 })
    }
    stars.forEach((g,i) => {
      const age = time - [.64,.98,1.32][Math.floor(i/6)], u = Math.max(0, Math.min(1, age/.6)), a = i * Math.PI * 2 / 6
      g.position.set(Math.cos(a)*r*(.32+u*.94), Math.sin(a)*r*(.26+u*.75) - Math.sin(Math.PI*u)*r*.22)
      g.rotation = i + u*2; g.scale.set(r/47); g.alpha = age>=0&&age<.6 ? Math.sin(Math.PI*u)*.95 : 0
    })
  }
  onFrame(update)
  tl.to(applause, { alpha: 1, duration: .22 }, .18).to(applause, { alpha: 0, duration: .3 }, 1.74)
    .call(() => { update(.64); onCue({ type: 'impact' }) }, [], .64)
}
