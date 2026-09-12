import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function tailWhip(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const attachment=context.source.hasAnchor?.('tail')?'tail':'hand',r=Math.min(48,Math.max(31,context.source.metrics.height/unit*.23)),tail=make('tail-whip-tail'),wake=make('tail-whip-wake'),marks=make('tail-whip-result')
  function update(time){
    const a=socket(attachment,true),b=targetSocket('center',true),wave=Math.sin(clamp((time-.1)/.82)*Math.PI*5)*.65
    fit(tail,a,r*1.7);tail.clear();tail.alpha=show(time,.09,1.34);tail.rotation=wave
    tail.moveTo(0,0).bezierCurveTo(r*.35,r*.4,r*.83,-r*.35,r*1.08,-r*.02).bezierCurveTo(r*.87,r*.39,r*.21,r*.79,0,r*.17).closePath().fill(0xd8ba8d).stroke({color:0xf1dcb1,width:1.7})
    fit(wake,a,r*1.8);wake.clear();wake.alpha=show(time,.16,1.28)*.55
    for(const side of[-1,1])wake.moveTo(r*.55,side*r*.72).quadraticCurveTo(r*1.3,side*r*.3,r*1.35,0).stroke({color:0xe6d0aa,width:1.5,alpha:.7})
    fit(marks,b,r*1.65);marks.clear();marks.alpha=show(time,.86,1.72);const u=clamp((time-.86)/.7),y=r*(u*.65-.3)
    marks.moveTo(-r*.42,y-9).lineTo(0,y+4).lineTo(r*.42,y-9).stroke({color:0xdfc8a5,width:3,alpha:1-u*.5,cap:'round'})
    for(let j=0;j<4;j++){const x=(j-1.5)*r*.28;marks.circle(x,y+r*.42,2).fill(0xcbb08a)}
  }
  onFrame(update);tl.call(()=>{update(.86);onCue({type:'impact'})},[],.86)

}
