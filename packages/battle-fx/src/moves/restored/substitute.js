import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function substitute(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(45,Math.max(30,context.source.metrics.height/unit*.2)),doll=make('substitute-decoy'),puffs=make('substitute-puffs'),spark=make('substitute-stitch')
  function update(time){
    const c=socket('center',true),rise=clamp((time-.32)/.68),p={x:c.x,y:c.y+r*.28*(1-rise)}
    fit(doll,p,r*1.65);doll.clear();doll.alpha=show(time,.34,1.85)
    const grow=.25+rise*.75;doll.scale.set(doll.scale.x*grow)
    doll.roundRect(-r*.52,-r*.12,r*1.04,r*.9,r*.22).fill(0x83b59c).ellipse(0,-r*.23,r*.48,r*.4).fill(0xa9d2b3)
      .poly([-r*.44,-r*.34,-r*.36,-r*.81,-r*.06,-r*.55]).fill(0x98c7a8).poly([r*.44,-r*.34,r*.36,-r*.81,r*.06,-r*.55]).fill(0x98c7a8)
      .ellipse(-r*.35,r*.68,r*.25,r*.13).fill(0x668f7d).ellipse(r*.35,r*.68,r*.25,r*.13).fill(0x668f7d)
      .circle(-r*.17,-r*.24,2.5).fill(0x375950).circle(r*.17,-r*.24,2.5).fill(0x375950)
      .moveTo(-r*.12,-r*.04).quadraticCurveTo(0,r*.08,r*.12,-r*.04).stroke({color:0x547969,width:1.5})
    fit(puffs,c,r*1.9);puffs.clear();puffs.alpha=show(time,.18,1.28)*.62
    for(let j=0;j<7;j++){const a=j*Math.PI*2/7+time*.2,d=r*(.25+rise*.8),s=r*(.2+(1-rise)*.18);puffs.circle(Math.cos(a)*d,Math.sin(a)*d*.7,s).fill({color:j%2?0xdbe4ce:0xc1d3c4,alpha:.62})}
    fit(spark,c,r*1.7);spark.clear();spark.alpha=show(time,1,1.7);for(let j=0;j<6;j++){const a=j*Math.PI/3,d=r*(.8+clamp((time-1)/.6)*.3);spark.moveTo(Math.cos(a)*d-3,Math.sin(a)*d).lineTo(Math.cos(a)*d+3,Math.sin(a)*d).stroke({color:0xd8efc0,width:2})}
  }
  onFrame(update);tl.call(()=>{update(1);onCue({type:'impact'})},[],1)

}
