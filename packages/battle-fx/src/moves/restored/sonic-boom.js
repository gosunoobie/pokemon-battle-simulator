import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function sonicBoom(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(42,Math.max(29,context.target.metrics.height/unit*.2)),blade=make('sonic-boom-front'),trail=make('sonic-boom-wake'),breaks=make('sonic-boom-impact')
  let launch,impact
  function update(time){
    const a=launch??socket('emission',true),b=impact??targetSocket('center',true),u=clamp((time-.22)/.31),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}
    fit(blade,p,r*1.55);blade.clear();blade.alpha=show(time,.15,.79,.18)
    blade.moveTo(-r*.47,-r*.93).quadraticCurveTo(r*.47,0,-r*.47,r*.93).quadraticCurveTo(-r*.14,0,-r*.47,-r*.93).fill({color:0xe1eee7,alpha:.65})
      .moveTo(-r*.47,-r*.93).quadraticCurveTo(r*.47,0,-r*.47,r*.93).stroke({color:0xf6f6d8,width:2.5})
    const lag=clamp((time-.26)/.31),q={x:a.x+(b.x-a.x)*lag,y:a.y+(b.y-a.y)*lag};fit(trail,q,r*1.6);trail.clear();trail.alpha=show(time,.26,.83,.21)*.4;trail.moveTo(-r*.5,-r*.9).quadraticCurveTo(r*.1,0,-r*.5,r*.9).stroke({color:0xb3cfd0,width:2})
    fit(breaks,b,r*1.7);breaks.clear();breaks.alpha=show(time,.53,1.13);const v=clamp((time-.53)/.52)
    for(const side of[-1,1])breaks.moveTo(-r*.25,r*side*(.2+v*.55)).quadraticCurveTo(r*.25,r*side*(.4+v*.55),-r*.2,r*side*(.7+v*.55)).stroke({color:0xd3e4d9,width:2,alpha:1-v})
  }
  onFrame(update);tl.call(()=>{launch=socket('emission',true);update(.22)},[],.22).call(()=>{impact=targetSocket('center',true);update(.53);onCue({type:'impact'})},[],.53)

}
