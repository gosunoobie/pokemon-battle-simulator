import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function defenseCurl(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(65,Math.max(38,context.source.metrics.height/unit*.29))
  const cocoon=new Container();cocoon.label='defense-curl-cocoon';cocoon.alpha=0;temporary.addChild(cocoon)
  const bands=new Graphics(),ends=new Graphics();cocoon.addChild(bands,ends)
  function update(time){
    fit(cocoon,socket('aura',true),r*1.5);bands.clear();ends.clear()
    const close=clamp((time-.1)/.82),radius=r*(1.08-close*.27)
    for(let lane=0;lane<2;lane++){
      const start=lane*Math.PI+.18,end=close*Math.PI*1.42
      for(let j=0;j<=42;j++){const u=j/42,a=start+u*end,rad=radius*(1-Math.max(0,u-.78)*1.7),x=Math.cos(a)*rad,y=Math.sin(a)*rad*.86;j?bands.lineTo(x,y):bands.moveTo(x,y)}
      bands.stroke({color:lane?0xf2d8b0:0xd8c4a5,width:4,alpha:.58,cap:'round'})
      const a=start+(time*1.5%1)*end,x=Math.cos(a)*radius*.96,y=Math.sin(a)*radius*.82
      ends.ellipse(x,y,r*.04,r*.065).fill({color:0xffedc4,alpha:.85})
    }
  }
  onFrame(update)
  tl.to(cocoon,{alpha:1,duration:.22},.08).to(cocoon,{alpha:0,duration:.42},1.57).call(()=>{update(.92);onCue({type:'impact'})},[],.92)

}
