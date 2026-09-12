import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function calmMind(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const rx=Math.min(108,Math.max(43,context.source.metrics.width/unit*.52))
  const ry=Math.min(115,Math.max(50,context.source.metrics.height/unit*.49))
  const aura=new Container();aura.label='calm-mind-aura';aura.alpha=0;temporary.addChild(aura)
  const center=new Graphics().ellipse(0,0,rx*.6,ry*.66).fill({color:0xb9b7ed,alpha:.07});aura.addChild(center)
  const rings=[],orbs=[]
  for(let i=0;i<3;i++){
    const g=new Graphics().ellipse(0,0,rx*(.64+i*.17),ry*(.64+i*.17))
      .stroke({color:i===1?0xe6c7ef:0xbfd8fa,width:1.6-i*.2,alpha:.65})
    aura.addChild(g);rings.push(g)
  }
  for(let i=0;i<2;i++){
    const g=new Graphics().circle(0,0,7).fill({color:i?0xe4c0ef:0xb6dcf7,alpha:.12})
      .circle(0,0,3).fill(i?0xf2d6ff:0xdaf2ff)
    aura.addChild(g);orbs.push(g)
  }
  const motes=[]
  for(let i=0;i<12;i++){
    const g=new Graphics().circle(0,0,1.6).fill(i%2?0xeccff4:0xcceaff)
    g.alpha=0;aura.addChild(g);motes.push(g)
  }
  const update=time=>{
    aura.position.copyFrom(socket('center',true))
    rings.forEach((g,i)=>{g.scale.set(1+Math.sin(time*2.6-i*.75)*.035);g.alpha=.58+Math.sin(time*2-i*.6)**2*.3})
    orbs.forEach((g,i)=>{const a=time*.95+i*Math.PI;g.position.set(Math.cos(a)*rx*.83,Math.sin(a)*ry*.83)})
    motes.forEach((g,i)=>{
      const age=time-.22-i*.05,u=Math.max(0,Math.min(1,age/.95)),a=i*Math.PI/6+u*.28
      g.position.set(Math.cos(a)*rx*(.95-u*.6),Math.sin(a)*ry*(.95-u*.6))
      g.alpha=age>=0&&age<=.95?Math.sin(Math.PI*u)*.65:0
    })
  }
  onFrame(update)
  tl.to(aura,{alpha:1,duration:.5,ease:'sine.out'},.08).to(aura,{alpha:0,duration:.48},1.7)
    .call(()=>{update(.9);onCue({type:'impact'})},[],.9)
}
