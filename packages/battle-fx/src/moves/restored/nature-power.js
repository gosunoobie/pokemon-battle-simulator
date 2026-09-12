import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function naturePower(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(52,Math.max(34,context.source.metrics.height/unit*.23)),motifs=[0,1,2,3].map(i=>make(`nature-power-motif-${i}`)),ring=make('nature-power-ring'),seed=make('nature-power-result')
  function update(time){
    const c=socket('aura',true),floor=socket('floor',true),u=clamp((time-.25)/.93)
    fit(ring,floor,r*1.6);ring.clear();ring.alpha=show(time,.1,1.51)
    for(let j=0;j<3;j++){const a=j*Math.PI*2/3+time*1.4;for(let k=0;k<=16;k++){const q=a+k*.065,x=Math.cos(q)*r,y=Math.sin(q)*r*.23;k?ring.lineTo(x,y):ring.moveTo(x,y)}ring.stroke({color:j%2?0xaace9f:0xe9d6a0,width:2})}
    motifs.forEach((g,i)=>{const phase=i*Math.PI/2,d=Math.min(r,room(floor)/2),from={x:floor.x+Math.cos(phase)*d,y:floor.y+Math.sin(phase)*d*.2},p={x:from.x+(c.x-from.x)*u,y:from.y+(c.y-from.y)*u};fit(g,p,22);g.rotation=Math.sin(Math.PI*u)*(i%2?1:-1)*.8;g.clear();g.alpha=show(time,.2+i*.035,1.42)
      if(i===0)g.moveTo(-12,4).quadraticCurveTo(-9,-13,12,-5).quadraticCurveTo(7,13,-12,4).fill(0xaace89).moveTo(-9,3).lineTo(9,-3).stroke({color:0xe0efb6,width:1})
      if(i===1)g.poly([-10,-5,-1,-11,10,-4,8,8,-7,10]).fill(0xb4a484).moveTo(-8,-3).lineTo(0,-7).lineTo(7,-2).stroke({color:0xe1d6b2,width:1.2})
      if(i===2)g.moveTo(0,-14).quadraticCurveTo(16,5,0,11).quadraticCurveTo(-16,5,0,-14).fill(0xa2d4e3)
      if(i===3)g.poly([0,-13,3,-3,13,0,3,3,0,13,-3,3,-13,0,-3,-3]).fill(0xeee2a0)})
    fit(seed,c,r*1.5);seed.clear();seed.alpha=show(time,1.18,1.9);const v=clamp((time-1.18)/.6);seed.circle(0,0,r*(.15+v*.45)).fill({color:0xdbe4b2,alpha:(1-v)*.55}).stroke({color:0xe9efc2,width:2})
    for(let j=0;j<5;j++){const a=j*Math.PI*2/5+v,d=r*(.25+v*.7);seed.circle(Math.cos(a)*d,Math.sin(a)*d,2.5).fill(0xc4dfaf)}
  }
  onFrame(update);tl.call(()=>{update(1.18);onCue({type:'impact'})},[],1.18)

}
