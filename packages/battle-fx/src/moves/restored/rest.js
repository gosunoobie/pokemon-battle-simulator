import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function rest(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, attacker, home, socket, unit } = bindEffectSpace(context)
  const rx = Math.min(110, Math.max(44, context.source.metrics.width / unit * .5))
  const ry = Math.min(110, Math.max(48, context.source.metrics.height / unit * .48))
  const sleep = new Container(); sleep.label = 'rest-aura'; temporary.addChild(sleep)
  const halo = new Graphics().ellipse(0,0,rx*.78,ry*.78).fill({color:0xb3bde8,alpha:.09})
    .ellipse(0,0,rx*.83,ry*.83).stroke({color:0xc9d3f1,width:1.2,alpha:.35})
  halo.alpha = 0; sleep.addChild(halo)
  const moon = new Graphics().moveTo(5,-15).bezierCurveTo(-17,-17,-20,15,3,17)
    .quadraticCurveTo(13,16,16,7).bezierCurveTo(-1,16,-9,-5,5,-15).fill(0xf2e8bd)
  moon.alpha = 0; sleep.addChild(moon)
  const marks = []
  for (let i = 0; i < 3; i++) {
    const g = new Graphics().moveTo(-6,-7).lineTo(6,-7).lineTo(-6,7).lineTo(6,7).stroke({color:0xdfe5ff,width:2.4,cap:'round',join:'round'})
    g.alpha = 0; sleep.addChild(g); marks.push(g)
  }
  const settle = Math.min(7,context.source.metrics.height/unit*.035)
  const update = time => {
    sleep.position.copyFrom(socket('center',true)); moon.position.set(-rx*.48,-ry*.65)
    halo.scale.set(1 + Math.sin(Math.max(0,time-.6)*5)*.025)
    marks.forEach((g,i) => {
      const age = time - .82 - i * .33, u = Math.max(0,Math.min(1,age/.98))
      g.position.set(rx*(.3+u*.25), -ry*(.26+u*.62)); g.scale.set((context.source.facing<0?-1:1)*(.55+u*.5),.55+u*.5)
      g.alpha = age >= 0 && age <= .98 ? Math.sin(Math.PI*u)*.9 : 0
    })
  }
  onFrame(update)
  tl.to(attacker,{y:home.y+settle,rotation:.035,duration:.5,ease:'sine.inOut'},.12)
    .to(attacker,{y:home.y+settle*.65,duration:.28,repeat:3,yoyo:true,ease:'sine.inOut'},.7)
    .to(attacker,{y:home.y,rotation:0,duration:.42,ease:'sine.inOut'},1.88)
    .to(halo,{alpha:1,duration:.3},.3).to(halo,{alpha:0,duration:.38},1.96)
    .to(moon,{alpha:.9,duration:.26},.45).to(moon,{alpha:0,duration:.38},1.85)
    .call(() => { update(.82); onCue({type:'impact'}) }, [], .82)
}
