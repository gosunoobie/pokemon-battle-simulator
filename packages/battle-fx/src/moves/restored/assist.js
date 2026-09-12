import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function assist(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(50,Math.max(33,context.source.metrics.height/unit*.23)),paws=[0,1,2].map(i=>make(`assist-paw-${i}`)),flare=make('assist-result')
  function update(time){
    const a=socket('aura',true),b=socket('emission',true)
    paws.forEach((g,i)=>{const u=clamp((time-.5-i*.06)/(.6-i*.06)),q=i*Math.PI*2/3-1.4,d=Math.min(r,room(a)/2),from={x:a.x+Math.cos(q)*d,y:a.y+Math.sin(q)*d*.6},p=i===1?{x:from.x+(b.x-from.x)*u,y:from.y+(b.y-from.y)*u}:from
      fit(g,p,30);g.rotation=Math.sin(time*5+i)*.14;g.clear();g.alpha=show(time,.12+i*.09,i===1?1.38:1.14+i*.06)
      g.ellipse(0,6,10,8).fill(i===1?0xf5cf98:0xd8b9de);for(let j=0;j<3;j++)g.ellipse((j-1)*9,-6+(j===1?-4:0),4.4,5.6).fill(i===1?0xffe0ad:0xe8c9e8)})
    fit(flare,b,r*1.45);flare.clear();flare.alpha=show(time,1.1,1.74);const v=clamp((time-1.1)/.55)
    for(let j=0;j<6;j++){const a=j*Math.PI/3+v*.5,d=r*(.2+v*.6);flare.moveTo(Math.cos(a)*d,Math.sin(a)*d).lineTo(Math.cos(a)*(d+7),Math.sin(a)*(d+7)).stroke({color:0xf6dcac,width:2,alpha:1-v})}
  }
  onFrame(update);tl.call(()=>{update(1.1);onCue({type:'impact'})},[],1.1)

}
