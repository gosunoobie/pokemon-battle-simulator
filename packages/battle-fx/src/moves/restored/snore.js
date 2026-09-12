import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function snore(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const bubbles=Array.from({length:3},(_,i)=>{const g=new Graphics().circle(0,0,7+i*3).fill({color:0xd7e9ee,alpha:.1}).stroke({color:0xd5e4ee,width:1.3,alpha:.65});g.alpha=0;temporary.addChild(g);return g})
  const waves=Array.from({length:3},(_,i)=>{const g=new Graphics();g.label=`snore-wave-${i}`;g.alpha=0;temporary.addChild(g);return g})
  const hit=new Graphics();hit.label='snore-impact';hit.alpha=0;temporary.addChild(hit)
  const r=Math.min(47,Math.max(27,context.target.metrics.height/unit*.22))
  function update(time){
    const from=socket('emission',true),to=targetSocket('center',true),angle=Math.atan2(to.y-from.y,to.x-from.x)
    bubbles.forEach((g,i)=>{fit(g,from,24);const p=clamp((time-.02-i*.1)/.48);g.scale.set(g.scale.x*(.3+p*.7));g.alpha=time>=.02+i*.1&&time<.52+i*.1?Math.sin(Math.PI*p)*.7:0})
    waves.forEach((g,i)=>{const age=time-.32-i*.16,u=clamp(age/.4),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u};fit(g,p,r*1.3);g.rotation=angle;g.clear()
      const rad=r*(.45+u*.48)
      g.moveTo(-rad*.55,-rad).quadraticCurveTo(rad*.3,0,-rad*.55,rad).stroke({color:0xe6d8bd,width:6,alpha:.28,cap:'round'}).moveTo(-rad*.4,-rad*.84).quadraticCurveTo(rad*.27,0,-rad*.4,rad*.84).stroke({color:0xffead0,width:2.8,alpha:.85,cap:'round'})
      g.alpha=age>=0&&age<.61?Math.min(1,age*20)*Math.min(1,(.61-age)*8):0})
    fit(hit,to,r*1.6);hit.clear()
    for(let i=0;i<10;i++){const a=i*Math.PI/5,u=clamp((time-.72)/.75),rad=r*(.32+u*.8);hit.moveTo(Math.cos(a)*rad,Math.sin(a)*rad*.65).lineTo(Math.cos(a)*(rad+6),Math.sin(a)*(rad+6)*.65).stroke({color:i%2?0xe0d2b8:0xd5d9e9,width:2,alpha:1-u,cap:'round'})}
  }
  onFrame(update)
  tl.to(hit,{alpha:1,duration:.1},.7).to(hit,{alpha:0,duration:.3},1.3)
    .call(()=>{update(.72);onCue({type:'impact'})},[],.72)

}
