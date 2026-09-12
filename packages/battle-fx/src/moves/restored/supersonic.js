import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function supersonic(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(40,Math.max(27,context.target.metrics.height/unit*.18)),rings=Array.from({length:5},(_,i)=>make(`supersonic-wave-${i}`)),spiral=make('supersonic-impact')
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true)
    rings.forEach((g,i)=>{const at=.17+i*.08,u=clamp((time-at)/.51),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};fit(g,p,r*1.5);g.clear();g.alpha=show(time,at,at+.72,.2);const s=r*(.23+u*.7);g.ellipse(0,0,s*.24,s*.85).stroke({color:i%2?0xf3dc8f:0xd9c597,width:1.5})})
    fit(spiral,b,r*1.6);spiral.clear();spiral.alpha=show(time,.68,1.77);const v=clamp((time-.68)/.9)
    for(let i=0;i<=64;i++){const q=i/64,a=q*Math.PI*4-time*3,d=r*(.1+q*.78)*(1-v*.25);i?spiral.lineTo(Math.cos(a)*d,Math.sin(a)*d*.65):spiral.moveTo(Math.cos(a)*d,Math.sin(a)*d*.65)}spiral.stroke({color:0xead5a0,width:2,alpha:.85})
    for(let j=0;j<3;j++){const a=j*Math.PI*2/3+time*2,d=r;spiral.circle(Math.cos(a)*d,Math.sin(a)*d*.7,3).fill(0xf7e5b7)}
  }
  onFrame(update);tl.call(()=>{update(.68);onCue({type:'impact'})},[],.68)

}
