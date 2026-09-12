import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function bulkUp(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, attacker, home, unit } = bindEffectSpace(context)
  const rx=Math.min(108,Math.max(42,context.source.metrics.width/unit*.51))
  const ry=Math.min(112,Math.max(48,context.source.metrics.height/unit*.48))
  const aura=new Container();aura.label='bulk-up-aura';aura.alpha=0;temporary.addChild(aura)
  const shell=new Graphics().moveTo(-rx*.66,ry*.55).lineTo(-rx*.84,-ry*.18)
    .quadraticCurveTo(-rx*.6,-ry*.7,0,-ry*.8).quadraticCurveTo(rx*.6,-ry*.7,rx*.84,-ry*.18)
    .lineTo(rx*.66,ry*.55).stroke({color:0xefb887,width:3,alpha:.55})
    .ellipse(0,ry*.65,rx*.88,ry*.18).stroke({color:0xffd9a8,width:2,alpha:.65})
  aura.addChild(shell)
  const columns=[]
  for(let i=0;i<10;i++){
    const g=new Graphics().poly([-2,14,0,-18,3,9,1,21]).fill(i%2?0xefba8d:0xffd5aa)
    g.alpha=0;aura.addChild(g);columns.push(g)
  }
  const pulse=new Graphics().ellipse(0,0,rx*.7,ry*.74).fill({color:0xf2b389,alpha:.1})
  pulse.alpha=0;aura.addChild(pulse)
  const update=time=>{
    aura.position.copyFrom(socket('center',true))
    columns.forEach((g,i)=>{
      const age=time-.22-i*.07,u=Math.max(0,Math.min(1,age/.9))
      g.position.set((i%2?-1:1)*rx*(.58+(i%5)*.055),ry*(.7-u*1.4))
      g.scale.y=.7+Math.sin(Math.PI*u)*.4;g.alpha=age>=0&&age<=.9?Math.sin(Math.PI*u)*.7:0
    })
  }
  onFrame(update)
  const brace=Math.min(5,context.source.metrics.height/unit*.027)
  tl.to(attacker,{y:home.y+brace,duration:.28,ease:'power2.inOut'},.06)
    .to(attacker,{y:home.y,duration:.18,ease:'power2.out'},.48)
    .to(aura,{alpha:1,duration:.22},.14).to(aura,{alpha:0,duration:.35},1.45)
    .to(pulse,{alpha:1,duration:.1},.56).to(pulse,{alpha:0,duration:.3},.66)
    .call(()=>{update(.66);onCue({type:'impact'})},[],.66)
}
