import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function thrash(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, solveContact, unit } = bindEffectSpace(context)
  const r = Math.min(60, Math.max(32, context.source.metrics.height / unit * .28))
  const rotations = [.13, -.16, .19], times = [.54, .96, 1.42]
  const poses = rotations.map(rotation => solveContact('tackle', rotation))
  const swings = times.map((at, index) => {
    const g = new Graphics(); g.label = `thrash-swing-${index}`; g.alpha = 0; temporary.addChild(g)
    const direction = index % 2 ? -1 : 1
    g.moveTo(-r*.95,-r*.45*direction).quadraticCurveTo(-r*.18,-r*.75*direction,r*.35,r*.15*direction)
      .stroke({color:0xeadbb9,width:4,alpha:.85,cap:'round'})
      .moveTo(-r*.76,-r*.57*direction).quadraticCurveTo(-r*.08,-r*.86*direction,r*.41,r*.02*direction)
      .stroke({color:0xfff2dc,width:1.5,alpha:.8,cap:'round'})
    return {g, at}
  })
  const follow = () => { for (const s of swings) { s.g.position.copyFrom(socket('tackle',true)); s.g.rotation=attacker.rotation } }
  for (const [i, at] of times.entries()) {
    const burst = new Graphics(); burst.label=`thrash-impact-${i}`; burst.position.copyFrom(focus); burst.alpha=0
    for(let j=0;j<7;j++) {
      const a=j*Math.PI*2/7+i*.43, x=Math.cos(a), y=Math.sin(a), reach=r*(j%2?.44:.78)
      burst.poly([x*7-y*3,y*7+x*3,x*reach,y*reach,x*7+y*3,y*7-x*3]).fill(j%2?0xe0c69b:0xfff4df)
    }
    temporary.addChild(burst)
    tl.to(swings[i].g,{alpha:.85,duration:.065},at-.16).to(swings[i].g,{alpha:0,duration:.18},at+.025)
      .to(burst,{alpha:1,duration:.02},at).to(burst.scale,{x:1.35,y:1.2,duration:.19},at).to(burst,{alpha:0,duration:.17},at+.04)
      .call(()=>{follow(); if(i===0)onCue({type:'impact'}); defender.tint=0xeee0bc},[],at)
      .to(defender,{x:defenderHome.x+8+i*2,rotation:.018*(i%2?-1:1),duration:.055},at)
      .to(defender,{x:defenderHome.x,rotation:0,duration:.15},at+.055)
      .call(()=>{defender.tint=0xffffff},[],at+.16)
  }
  const dust=Array.from({length:24},(_,i)=>{
    const g=new Graphics().ellipse(0,0,3+random()*2,2).fill(0xc9b997);g.alpha=0;temporary.addChild(g)
    return {g,at:times[i%3],dx:(random()-.5)*r*2,dy:9+random()*14,life:.3+random()*.17}
  })
  onFrame(time=>{
    follow()
    for(const p of dust){const age=time-p.at,t=age/p.life;p.g.alpha=t>=0&&t<1?Math.sin(Math.PI*t)*.62:0;if(t>=0)p.g.position.set(floor.x+p.dx*t,floor.y-p.dy*Math.sin(Math.PI*t))}
  })
  tl.to(attacker,{x:home.x-r*.2,y:home.y+3,rotation:-.08,duration:.24},0)
    .to(attacker,{...poses[0],duration:.3,ease:'power2.in'},.24)
    .to(attacker,{x:poses[1].x-r*.6,y:poses[1].y-r*.22,rotation:-.21,duration:.15},.59)
    .to(attacker,{...poses[1],duration:.22,ease:'power2.in'},.74)
    .to(attacker,{x:poses[2].x-r*.72,y:poses[2].y+r*.18,rotation:.02,duration:.19},1.01)
    .to(attacker,{...poses[2],duration:.22,ease:'power3.in'},1.2)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.58,ease:'power2.inOut'},1.58)
}
