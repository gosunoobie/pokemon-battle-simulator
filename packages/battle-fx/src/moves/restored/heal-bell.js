import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function healBell(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const rx = Math.min(112, Math.max(48, context.source.metrics.width / unit * .5))
  const ry = Math.min(110, Math.max(50, context.source.metrics.height / unit * .48))
  const aura = new Container(); aura.label = 'heal-bell-aura'; temporary.addChild(aura)
  const bell = new Container(); bell.label = 'heal-bell-instrument'; bell.alpha = 0; aura.addChild(bell)
  const size = Math.min(1.25, Math.max(.7, ry / 80)); bell.scale.set(size)
  bell.addChild(new Graphics().circle(0, -5, 4).stroke({ color: 0xffeab0, width: 2 })
    .moveTo(-5,0).bezierCurveTo(-17,2,-12,19,-20,25).quadraticCurveTo(0,34,20,25)
    .bezierCurveTo(12,19,17,2,5,0).closePath().fill(0xf0cf79).stroke({ color: 0xffefbf, width: 1.3 })
    .ellipse(0,25,20,5).fill(0xb99252).stroke({ color: 0xffe6a3, width: 2 })
    .moveTo(-7,5).quadraticCurveTo(-11,13,-10,20).stroke({ color: 0xfff4ca, width: 3, cap: 'round' }))
  const clapper = new Graphics().moveTo(0,18).lineTo(0,29).stroke({ color: 0xffe6a3, width: 2 }).circle(0,30,4).fill(0xffe6a3)
  bell.addChild(clapper)
  const waves = [], notes = []
  for (let i = 0; i < 3; i++) {
    const g = new Graphics().ellipse(0,0,rx,ry).stroke({ color: i % 2 ? 0xffedaf : 0xe9f6d6, width: 2.1 })
    g.alpha = 0; aura.addChild(g); waves.push(g)
  }
  for (let i = 0; i < 6; i++) {
    const g = new Graphics().ellipse(-3,0,4,2.8).fill(0xffe6a3).moveTo(0,0).lineTo(0,-14).lineTo(7,-11).stroke({color:0xffe6a3,width:2,cap:'round'})
    g.alpha = 0; aura.addChild(g); notes.push(g)
  }
  const update = time => {
    aura.position.copyFrom(socket('center', true)); bell.y = -ry * .73 - 18
    bell.rotation = time < .4 ? 0 : Math.sin((time - .4) * 18) * .22 * Math.max(0, 1 - (time - .4) / 1.45)
    clapper.x = -Math.sin((time - .4) * 18) * 3
    waves.forEach((g,i) => {
      const age = time - .72 - i * .27, u = Math.max(0, Math.min(1, age / .9))
      g.scale.set(.48 + u * .67); g.alpha = age >= 0 && age <= .9 ? Math.sin(Math.PI * u) * .7 : 0
    })
    notes.forEach((g,i) => {
      const age = time - .64 - i * .17, u = Math.max(0, Math.min(1, age / .7))
      g.position.set((i % 2 ? 1 : -1) * rx * (.22 + u * .6), -ry * .3 - u * 42)
      g.scale.x = context.source.facing < 0 ? -1 : 1; g.alpha = age >= 0 && age <= .7 ? Math.sin(Math.PI * u) * .85 : 0
    })
  }
  onFrame(update)
  tl.to(bell, { alpha: 1, duration: .24 }, .12).to(bell, { alpha: 0, duration: .32 }, 1.68)
    .call(() => { update(.72); onCue({ type: 'impact' }) }, [], .72)
}
