import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function rage(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const r = Math.min(58, Math.max(30, context.source.metrics.height / unit * .27))
  const pose = solveContact('tackle', .09)
  const pressure = new Container(); pressure.label = 'rage-pressure'; pressure.alpha = 0; temporary.addChild(pressure)
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3
    const mark = new Graphics().moveTo(r * .66, -r * .17).quadraticCurveTo(r * .92, -r * .1, r * .86, r * .16)
      .stroke({ color: i % 2 ? 0xffb679 : 0xdc6757, width: 3, cap: 'round' })
    mark.rotation = a; pressure.addChild(mark)
  }
  const flash = new Graphics(); flash.label = 'rage-impact'; flash.position.copyFrom(focus); flash.alpha = 0
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9, x = Math.cos(a), y = Math.sin(a), reach = r * (i % 2 ? .57 : .88)
    flash.poly([x*5-y*4,y*5+x*4,x*reach,y*reach,x*5+y*4,y*5-x*4]).fill(i%2 ? 0xf59a60 : 0xffe7c3)
  }
  temporary.addChild(flash)
  const sparks = Array.from({ length: 15 }, () => {
    const g = new Graphics().poly([-3,-1,4,0,-3,2]).fill(0xf7a778); g.alpha = 0; temporary.addChild(g)
    return { g, a: random()*Math.PI*2, v:r*(1.2+random()), life:.3+random()*.16 }
  })
  const follow = () => { pressure.position.copyFrom(socket('center', true)); pressure.rotation = attacker.rotation }
  onFrame(time => {
    follow()
    pressure.scale.set(1 + Math.sin(time * 27) * .045)
    for (const p of sparks) {
      const age = time - .62
      p.g.alpha = age >= 0 && age < p.life ? Math.sin(Math.PI*age/p.life) * .9 : 0
      if (age >= 0) { p.g.position.set(focus.x+Math.cos(p.a)*p.v*age,focus.y+Math.sin(p.a)*p.v*age+45*age*age); p.g.rotation=p.a+age*2 }
    }
  })
  tl.to(attacker,{x:home.x-r*.18,rotation:-.04,duration:.2},0)
    .to(attacker,{rotation:.015,duration:.055,repeat:3,yoyo:true},.2)
    .to(attacker,{...pose,duration:.2,ease:'power3.in'},.42)
    .to(attacker,{x:pose.x-r*.24,y:pose.y+4,rotation:-.03,duration:.13},.7)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.5,ease:'power2.inOut'},.85)
    .to(pressure,{alpha:.85,duration:.14},.08).to(pressure,{alpha:0,duration:.25},.67)
    .to(flash,{alpha:1,duration:.025},.62).to(flash.scale,{x:1.25,y:1.25,duration:.2},.62)
    .to(flash,{alpha:0,duration:.22},.67)
    .call(()=>{follow(); onCue({type:'impact'}); defender.tint=0xf4b493},[],.62)
    .to(defender,{x:defenderHome.x+9,duration:.065,repeat:3,yoyo:true},.62)
    .call(()=>{defender.tint=0xffffff},[],.84)
}
