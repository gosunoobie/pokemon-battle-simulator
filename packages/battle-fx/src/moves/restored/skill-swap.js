import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function skillSwap(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const tokens=[make('skill-swap-token-0'),make('skill-swap-token-1')],routes=make('skill-swap-routes'),settle=make('skill-swap-arrivals'),r=Math.min(43,Math.max(29,context.source.metrics.height/unit*.2))
  function update(time){
    const points=[socket('aura',true),targetSocket('aura',true)],u=clamp((time-.35)/.9),bow=Math.min(37,room(points[0])/2,room(points[1])/2)
    routes.clear();routes.alpha=show(time,.3,1.6)*.45;settle.clear();settle.alpha=show(time,1.25,1.99)
    for(let i=0;i<2;i++){const a=points[i],b=points[1-i],side=i?1:-1,p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u+Math.sin(Math.PI*u)*bow*side};fit(tokens[i],p,29);tokens[i].clear();tokens[i].rotation=Math.sin(Math.PI*u)*2*side;tokens[i].alpha=show(time,.12,1.78)
      if(i===0)tokens[i].poly([0,-19,15,0,0,19,-15,0]).fill({color:0x99d8d7,alpha:.55}).stroke({color:0xc7eeea,width:2}).poly([0,-10,8,0,0,10,-8,0]).stroke({color:0xe9f7ed,width:1.3})
      else tokens[i].circle(0,0,17).stroke({color:0xf0d397,width:4}).circle(0,0,9).fill({color:0xd6ac80,alpha:.4})
      for(let j=0;j<=30;j++){const q=j/30,x=a.x+(b.x-a.x)*q,y=a.y+(b.y-a.y)*q+Math.sin(Math.PI*q)*bow*side;j?routes.lineTo(x,y):routes.moveTo(x,y)}routes.stroke({color:i?0xe3be8a:0xa9dbd9,width:1.2,alpha:.6})
      const v=clamp((time-1.25)/.6),radius=Math.min(r*(.3+v*.55),room(b)/1.3);settle.ellipse(b.x,b.y,radius,radius*.72).stroke({color:i?0xbce5dc:0xead1a4,width:1.6,alpha:1-v*.5})}
  }
  onFrame(update);tl.call(()=>{update(1.25);onCue({type:'impact'})},[],1.25)

}
