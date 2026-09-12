import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function teleport(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(65,Math.max(42,context.source.metrics.height/unit*.3)),rings=make('teleport-rings'),columns=make('teleport-columns'),glints=make('teleport-arrival')
  function update(time){
    const c=socket('center',true),u=clamp((time-.16)/.66),back=clamp((time-.9)/.55),narrow=time<.9?1-u*.86:.14+back*.86
    fit(rings,c,r*1.7);rings.clear();rings.alpha=show(time,.08,1.55)
    for(let j=0;j<4;j++){const y=r*((j-1.5)*.42)*(1-u*.3),rx=r*(.9-j*.08)*narrow;rings.ellipse(0,y,rx,Math.max(1,rx*.18)).stroke({color:j%2?0xd7b6f4:0xa58fdf,width:2,alpha:.85})}
    fit(columns,c,r*1.7);columns.clear();columns.alpha=show(time,.18,1.48)*.7
    for(let j=0;j<10;j++){const x=(j-4.5)*r*.16*narrow,y=((time*1.6+j*.19)%1-.5)*r*2;columns.moveTo(x,y).lineTo(x,y-r*.2).stroke({color:0xe9d3ff,width:1.6,alpha:.7})}
    fit(glints,c,r*1.65);glints.clear();glints.alpha=show(time,.83,1.62)
    for(let j=0;j<8;j++){const a=j*Math.PI/4+time*.5,d=r*(.2+back*.8);glints.moveTo(Math.cos(a)*d-3,Math.sin(a)*d).lineTo(Math.cos(a)*d+3,Math.sin(a)*d).moveTo(Math.cos(a)*d,Math.sin(a)*d-3).lineTo(Math.cos(a)*d,Math.sin(a)*d+3).stroke({color:0xf4e5ff,width:1.5})}
  }
  onFrame(update)
  tl.to(attacker,{alpha:.2,duration:.28},.42).call(()=>{update(.82);onCue({type:'impact'})},[],.82).to(attacker,{alpha:1,duration:.35},.97)

}
