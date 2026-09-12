import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function aromatherapy(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const rx = Math.min(108, Math.max(44, context.source.metrics.width / unit * .51))
  const ry = Math.min(105, Math.max(48, context.source.metrics.height / unit * .46))
  const garden = new Container(); garden.label = 'aromatherapy-aura'; temporary.addChild(garden)
  const leaves = [], wisps = []
  for (let i = 0; i < 12; i++) {
    const g = new Graphics().moveTo(-8,0).quadraticCurveTo(-1,-8,10,0).quadraticCurveTo(1,8,-8,0).fill(i % 3 ? 0xb6dea2 : 0xd5edb0)
      .moveTo(-7,0).quadraticCurveTo(0,-1,8,0).stroke({color:0xf2f6cf,width:.9})
    g.alpha = 0; garden.addChild(g); leaves.push(g)
  }
  for (let i = 0; i < 3; i++) {
    const g = new Graphics(); g.alpha = 0; garden.addChild(g); wisps.push(g)
  }
  const petals = []
  for (let i = 0; i < 10; i++) {
    const g = new Graphics().ellipse(0,0,2.8,5).fill(i % 2 ? 0xe5c8e8 : 0xffe8c2)
    g.alpha = 0; garden.addChild(g); petals.push(g)
  }
  const update = time => {
    garden.position.copyFrom(socket('center', true))
    leaves.forEach((g,i) => {
      const age = time - .18 - i * .06, u = Math.max(0, Math.min(1, age / 1.5)), a = i * 2.4 + u * 4.1
      g.position.set(Math.cos(a) * rx * (.55 + u * .3), ry * (.82 - u * 1.65) + Math.sin(a) * 12)
      g.rotation = a + .4; g.scale.set(.65 + .25 * Math.sin(a) ** 2, .5 + .5 * Math.abs(Math.cos(a)))
      g.alpha = age >= 0 && age <= 1.5 ? Math.sin(Math.PI * u) * .9 : 0
    })
    wisps.forEach((g,i) => {
      const age = time - .25 - i * .16, u = Math.max(0, Math.min(1, age / 1.9))
      g.clear(); const y = ry * (.55 - u * 1.2), bend = Math.sin(time * 3 + i) * 14
      g.moveTo(-rx*.7,y+12).bezierCurveTo(-rx*.4,y-30+bend,rx*.45,y+26-bend,rx*.76,y-16)
        .stroke({color:i===1?0xeee3f3:0xcce8bd,width:10,alpha:.09,cap:'round'})
        .moveTo(-rx*.7,y+12).bezierCurveTo(-rx*.4,y-30+bend,rx*.45,y+26-bend,rx*.76,y-16)
        .stroke({color:0xe4f2cf,width:1.2,alpha:.35,cap:'round'})
      g.alpha = age >= 0 && age <= 1.9 ? Math.sin(Math.PI * u) : 0
    })
    petals.forEach((g,i) => {
      const age = time - .66 - i * .08, u = Math.max(0,Math.min(1,age/.95)), a = i * 2.1
      g.position.set(Math.cos(a + u) * rx * .8, Math.sin(a) * ry * .4 - u * 30)
      g.rotation = a + u * 2; g.alpha = age >= 0 && age <= .95 ? Math.sin(Math.PI * u) * .8 : 0
    })
  }
  onFrame(update)
  tl.call(() => { update(.9); onCue({ type: 'impact' }) }, [], .9)
}
