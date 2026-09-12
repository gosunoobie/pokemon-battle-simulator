import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function growl(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(37,Math.max(24,context.target.metrics.height/unit*.16)),waves=[0,1,2].map(i=>make(`growl-wave-${i}`)),throat=make('growl-throat'),drop=make('growl-impact')
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true)
    fit(throat,a,r*1.35);throat.clear();throat.alpha=show(time,.08,.88);throat.ellipse(0,0,r*(.3+.06*Math.sin(time*35)),r*.22).stroke({color:0xe3c299,width:2})
    waves.forEach((g,i)=>{const at=.2+i*.16,u=clamp((time-at)/.44),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};fit(g,p,r*1.55);g.clear();g.alpha=show(time,at,at+.63,.18)
      const size=r*(.35+u*.7);g.moveTo(-size*.22,-size*.65).quadraticCurveTo(size*.42,0,-size*.22,size*.65).stroke({color:i%2?0xc9ad89:0xe4cda6,width:3,alpha:.8,cap:'round'})})
    fit(drop,b,r*1.7);drop.clear();drop.alpha=show(time,.64,1.4);const u=clamp((time-.64)/.6);for(let i=0;i<3;i++){const x=(i-1)*r*.5,y=r*(u*.7-.2);drop.moveTo(x-5,y-5).lineTo(x,y).lineTo(x+5,y-5).stroke({color:0xc3af91,width:2,cap:'round'})}
  }
  onFrame(update);tl.call(()=>{update(.64);onCue({type:'impact'})},[],.64)

}
