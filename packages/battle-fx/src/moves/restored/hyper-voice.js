import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function hyperVoice(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(57,Math.max(38,context.target.metrics.height/unit*.26)),waves=Array.from({length:4},(_,i)=>make(`hyper-voice-wave-${i}`)),voice=make('hyper-voice-source'),pulse=make('hyper-voice-impact')
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true)
    fit(voice,a,r*1.4);voice.clear();voice.alpha=show(time,.08,1.22);for(let j=0;j<3;j++)voice.ellipse(0,0,r*(.23+j*.12),r*(.14+j*.08)).stroke({color:0xf2d7ae,width:1.5,alpha:.75-j*.14})
    waves.forEach((g,i)=>{const at=.26+i*.16,u=clamp((time-at)/.48),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};fit(g,p,r*1.55);g.clear();g.alpha=show(time,at,at+.77,.28)
      const s=r*(.25+u*.8);g.moveTo(-s*.3,-s).bezierCurveTo(s*.48,-s*.58,s*.48,s*.58,-s*.3,s).stroke({color:i%2?0xf4c691:0xffe3b7,width:5,alpha:.8,cap:'round'})
      g.moveTo(-s*.43,-s*.86).bezierCurveTo(s*.22,-s*.4,s*.22,s*.4,-s*.43,s*.86).stroke({color:0xfcf0d3,width:1.4,alpha:.7})})
    fit(pulse,b,r*1.5);pulse.clear();pulse.alpha=show(time,.74,1.82);const q=(time-.74)*5
    for(let j=0;j<6;j++){const a=j*Math.PI/3,d=r*(.65+.09*Math.sin(q+j));pulse.moveTo(Math.cos(a)*d,Math.sin(a)*d).lineTo(Math.cos(a)*(d+7),Math.sin(a)*(d+7)).stroke({color:0xe8c396,width:2,alpha:.7})}
  }
  onFrame(update);tl.call(()=>{update(.74);onCue({type:'impact'});defender.tint=0xefdbbd},[],.74).call(()=>{defender.tint=0xffffff},[],1.08)

}
