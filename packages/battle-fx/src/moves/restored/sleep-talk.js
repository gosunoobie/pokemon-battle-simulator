import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function sleepTalk(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(41,Math.max(29,context.source.metrics.height/unit*.19)),bubble=make('sleep-talk-bubble'),words=make('sleep-talk-dots'),pulse=make('sleep-talk-result')
  function update(time){
    const a=socket('emission',true),u=clamp((time-.15)/.93);fit(bubble,a,r*1.65);bubble.clear();bubble.alpha=show(time,.09,1.59)
    bubble.roundRect(-r*.72,-r*.62,r*1.44,r*.95,r*.24).fill({color:0xa59cce,alpha:.26}).stroke({color:0xd1c3eb,width:2})
      .moveTo(-r*.35,r*.33).lineTo(-r*.6,r*.61).lineTo(-r*.07,r*.33).stroke({color:0xd1c3eb,width:2})
    fit(words,a,r*1.65);words.clear();words.alpha=show(time,.2,1.5)
    for(let j=0;j<3;j++){const x=(j-1)*r*.33,y=-r*.13+Math.sin(time*6+j*1.6)*r*.08;words.circle(x,y,3.5+Math.sin(time*5+j)*.5).fill(0xe6d9f2)}
    fit(pulse,a,r*1.7);pulse.clear();pulse.alpha=show(time,1.08,1.72);const v=clamp((time-1.08)/.55),s=r*(.25+v*.65)
    pulse.poly([-s*.8,-s*.3,-s*.2,-s*.25,0,-s*.9,s*.24,-s*.15,s*.8,0,s*.25,s*.3,s*.1,s*.83,-s*.2,s*.25,-s*.77,s*.4,-s*.5,0]).stroke({color:0xd8c8ed,width:2,alpha:1-v*.7})
  }
  onFrame(update);tl.call(()=>{update(1.08);onCue({type:'impact'})},[],1.08)

}
