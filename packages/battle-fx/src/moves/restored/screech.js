import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function screech(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(44,Math.max(29,context.target.metrics.height/unit*.2)),ribbons=make('screech-ribbons'),tip=make('screech-tip'),shards=make('screech-impact')
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),u=clamp((time-.2)/.5),amplitude=Math.min(r*.3,room(a)/2,room(b)/2),end={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}
    ribbons.clear();ribbons.alpha=show(time,.2,1.24)
    for(let lane=0;lane<2;lane++){for(let j=0;j<=48;j++){const q=u*j/48,x=a.x+(b.x-a.x)*q,y=a.y+(b.y-a.y)*q+Math.sin(q*40-time*32+lane*Math.PI)*amplitude*Math.sin(q*Math.PI);j?ribbons.lineTo(x,y):ribbons.moveTo(x,y)}ribbons.stroke({color:lane?0xece7bc:0xc3d7b8,width:1.8,alpha:.85})}
    fit(tip,end,r*1.45);tip.clear();tip.alpha=show(time,.22,1.25);tip.poly([0,-r*.66,r*.12,-r*.2,r*.43,0,r*.12,r*.2,0,r*.66,-r*.12,r*.2,-r*.43,0,-r*.12,-r*.2]).stroke({color:0xf6eac2,width:2})
    fit(shards,b,r*1.65);shards.clear();shards.alpha=show(time,.7,1.68);const q=clamp((time-.7)/.8)
    for(let i=0;i<6;i++){const a=i*Math.PI/3,d=r*(.35+q*.7);shards.poly([Math.cos(a)*d,Math.sin(a)*d,Math.cos(a+.15)*(d+10),Math.sin(a+.15)*(d+10),Math.cos(a-.13)*(d+5),Math.sin(a-.13)*(d+5)]).fill({color:i%2?0xcee0c4:0xe7dcb1,alpha:1-q})}
  }
  onFrame(update);tl.call(()=>{update(.7);onCue({type:'impact'})},[],.7)

}
