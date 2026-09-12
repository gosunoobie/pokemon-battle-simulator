import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function uproar(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(49,Math.max(32,context.target.metrics.height/unit*.23)),barks=Array.from({length:6},(_,i)=>make(`uproar-wave-${i}`)),noise=make('uproar-source'),jag=make('uproar-impact')
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true)
    fit(noise,a,r*1.45);noise.clear();noise.alpha=show(time,.06,1.58)
    for(let j=0;j<5;j++){const q=(j-2)*.46,d=r*(.3+.07*Math.sin(time*30+j));noise.moveTo(Math.cos(q)*d,Math.sin(q)*d).lineTo(Math.cos(q)*(d+8),Math.sin(q)*(d+8)).stroke({color:0xe8b891,width:2,alpha:.8})}
    barks.forEach((g,i)=>{const at=.17+i*.15,u=clamp((time-at)/.46),bend=Math.min(r*.2,room(a)/3,room(b)/3),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u+Math.sin(Math.PI*u)*bend*(i%2?1:-1)};fit(g,p,r*1.6);g.clear();g.alpha=show(time,at,at+.73,.26)
      const s=r*(.3+u*.75);g.moveTo(-s*.3,-s*.75).lineTo(s*.05,-s*.43).lineTo(-s*.1,-s*.18).lineTo(s*.3,0).lineTo(-s*.1,s*.18).lineTo(s*.05,s*.43).lineTo(-s*.3,s*.75).stroke({color:i%2?0xe5b3a1:0xf2d49e,width:3,cap:'round',join:'round'})})
    fit(jag,b,r*1.7);jag.clear();jag.alpha=show(time,.63,1.87);for(let j=0;j<7;j++){const a=j*Math.PI*2/7,d=r*(.6+.1*Math.sin(time*29+j));jag.moveTo(Math.cos(a)*d,Math.sin(a)*d).lineTo(Math.cos(a+.08)*(d+10),Math.sin(a+.08)*(d+10)).stroke({color:0xeec9a3,width:2})}
  }
  onFrame(update);tl.call(()=>{update(.63);onCue({type:'impact'});defender.tint=0xedc9b4},[],.63).call(()=>{defender.tint=0xffffff},[],.92)

}
