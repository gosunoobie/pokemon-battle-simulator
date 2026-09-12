import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function metronome(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(42,Math.max(29,context.source.metrics.height/unit*.2)),finger=make('metronome-finger'),dots=make('metronome-dots'),star=make('metronome-result')
  function update(time){
    const a=socket('hand',true),u=clamp((time-.16)/.86);fit(finger,a,r*1.6);finger.clear();finger.alpha=show(time,.1,1.45);finger.rotation=Math.sin(u*u*Math.PI*6)*.35*(1-clamp((time-.85)/.17))
    finger.roundRect(-r*.23,-r*.12,r*.5,r*.62,r*.14).fill(0xf0dcb8).roundRect(-r*.14,-r*.95,r*.19,r*.94,r*.09).fill(0xffedca)
      .roundRect(r*.08,-r*.16,r*.2,r*.35,r*.08).fill(0xe1c7a2).roundRect(-r*.4,r*.02,r*.23,r*.26,r*.09).fill(0xe9d2b2)
    fit(dots,a,r*1.7);dots.clear();dots.alpha=show(time,.16,1.34)
    const colors=[0xd9b7eb,0xb1ddce,0xefcc93,0xb5d4ee,0xe9b7ca];for(let j=0;j<5;j++){const q=j*Math.PI*2/5+u*6,d=r*(.9-.65*clamp((time-.72)/.3));dots.circle(Math.cos(q)*d,Math.sin(q)*d,3.5).fill(colors[j])}
    fit(star,a,r*1.65);star.clear();star.alpha=show(time,1.02,1.62);const v=clamp((time-1.02)/.5),s=r*(.18+v*.6);star.poly([0,-s,s*.2,-s*.2,s,0,s*.2,s*.2,0,s,-s*.2,s*.2,-s,0,-s*.2,-s*.2]).fill({color:0xf7e8c1,alpha:1-v*.6})
  }
  onFrame(update);tl.call(()=>{update(1.02);onCue({type:'impact'})},[],1.02)

}
