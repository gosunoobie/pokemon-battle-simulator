import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function roar(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(57,Math.max(36,context.target.metrics.height/unit*.25)),fans=[0,1,2].map(i=>make(`roar-front-${i}`)),rays=make('roar-rays')
  const v=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center'),recoil=Math.max(0,Math.min(19,right-v.x-context.target.metrics.width/unit/2))
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true)
    fans.forEach((g,i)=>{const at=.18+i*.17,u=clamp((time-at)/.47),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};fit(g,p,r*1.5);g.clear();g.alpha=show(time,at,at+.73,.24)
      const s=r*(.3+u*.78);g.poly([-s*.2,-s*.85,s*.05,-s*.53,-s*.12,-s*.27,s*.3,0,-s*.12,s*.27,s*.05,s*.53,-s*.2,s*.85,-s*.5,s*.5,-s*.32,0,-s*.5,-s*.5]).fill({color:i%2?0xd6ad72:0xf0d49b,alpha:.24}).stroke({color:0xeacc98,width:2,alpha:.85})})
    fit(rays,b,r*1.5);rays.clear();rays.alpha=show(time,.65,1.55);const q=clamp((time-.65)/.75);for(let j=0;j<7;j++){const angle=(j-3)*.38,d=r*(.3+q*.55);rays.moveTo(Math.cos(angle)*d,Math.sin(angle)*d).lineTo(Math.cos(angle)*(d+r*.3),Math.sin(angle)*(d+r*.3)).stroke({color:0xe5c89c,width:2,alpha:1-q})}
  }
  onFrame(update);tl.call(()=>{update(.65);onCue({type:'impact'})},[],.65).to(defender,{x:defenderHome.x+recoil,duration:.18},.65).to(defender,{x:defenderHome.x,duration:.38},1.19)

}
