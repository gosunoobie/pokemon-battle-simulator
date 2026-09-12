import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function rapidSpin(context) {
  const { tl, random, onCue, onFrame } = context
  const { temporary, attacker, defender, defenderHome, focus, socket, unit } = bindEffectSpace(context)
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), tackle = socket('tackle')
  const end = { x: focus.x - tackle.x + center.x, y: focus.y + 8 - tackle.y + center.y }
  const width = context.source.metrics.width / unit, height = context.source.metrics.height / unit
  const wind = new Container(); wind.label = 'rapid-spin-wind'; temporary.addChild(wind)
  const strokes = Array.from({ length: 3 }, () => { const g = new Graphics(); wind.addChild(g); return g })
  const clamp = u => Math.max(0, Math.min(1, u)), smooth = u => u*u*(3-2*u)
  const specks = []
  for (let i = 0; i < 16; i++) {
    const dust = new Graphics().ellipse(0,0,2+random()*2,1.2).fill(i%2?0xe9f5ec:0xc5dadb)
    dust.alpha = 0; temporary.addChild(dust)
    const angle = random()*Math.PI*2
    specks.push({ dust, angle, speed: 35+random()*45, life: .3+random()*.12 })
  }
  function update(time) {
    const launch = clamp((time-.24)/.48), back = smooth(clamp((time-.86)/.48))
    const u = smooth(launch)*(1-back), spin = clamp(time/.24)*(1-clamp((time-.72)/.16))
    const p = { x: center.x+(end.x-center.x)*u, y: center.y+(end.y-center.y)*u-Math.sin(Math.PI*launch)*8*(1-back) }
    // A vertical twirl: narrow the silhouette while keeping its visible center fixed.
    const sx = 1-(1-Math.abs(Math.cos(time*23)))*.42*spin*Math.sin(Math.PI*launch)
    const rotation = Math.sin(time*23)*.055*spin*Math.sin(Math.PI*launch)
    attacker.scale.set(sx,1); attacker.rotation=rotation
    const c=Math.cos(rotation),s=Math.sin(rotation)
    attacker.x=p.x-center.x*sx*c+center.y*s; attacker.y=p.y-center.x*sx*s-center.y*c
    wind.position.copyFrom(p)
    for(let i=0;i<3;i++){
      const g=strokes[i];g.clear()
      const rx=Math.max(30,width*.55)+i*4,ry=Math.max(11,height*.12),phase=time*17+i*Math.PI*.68
      for(let j=0;j<=24;j++){
        const a=phase+j/24*Math.PI*1.25,x=Math.cos(a)*rx,y=Math.sin(a)*ry+(i-1)*height*.12
        if(j===0)g.moveTo(x,y);else g.lineTo(x,y)
      }
      g.stroke({color:i===1?0xffffff:0xcce9e8,width:i===1?2.8:1.6,alpha:.8,cap:'round'})
      g.alpha=clamp((time-.08)/.16)*(1-clamp((time-.76)/.28))
    }
    for(const p of specks){
      const age=time-.72
      if(age<0||age>p.life){p.dust.alpha=0;continue}
      p.dust.position.set(focus.x+Math.cos(p.angle)*p.speed*age,focus.y+8+Math.sin(p.angle)*p.speed*age+age*age*35)
      p.dust.rotation=p.angle+age*6;p.dust.alpha=Math.sin(Math.PI*age/p.life)*.8
    }
  }
  onFrame(update)
  const flash=new Graphics().ellipse(0,0,22,13).stroke({color:0xf4fff7,width:3})
  flash.position.set(focus.x,focus.y+8);flash.alpha=0;temporary.addChild(flash)
  tl.to(flash,{alpha:.85,duration:.025},.72).to(flash.scale,{x:1.7,y:1.7,duration:.2},.72).to(flash,{alpha:0,duration:.2},.77)
    .call(()=>{update(.72);onCue({type:'impact'});defender.tint=0xe5f4ed},[],.72)
    .to(defender,{x:defenderHome.x+8,duration:.065,repeat:3,yoyo:true},.72)
    .call(()=>{defender.tint=0xffffff},[],.94)
}
