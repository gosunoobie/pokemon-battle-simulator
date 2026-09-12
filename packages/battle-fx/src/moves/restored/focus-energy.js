import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function focusEnergy(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const rx=Math.min(105,Math.max(42,context.source.metrics.width/unit*.49))
  const ry=Math.min(115,Math.max(50,context.source.metrics.height/unit*.49))
  const aura=new Container();aura.label='focus-energy-aura';temporary.addChild(aura)
  const streaks=[]
  for(let i=0;i<14;i++){
    const g=new Graphics();g.alpha=0;aura.addChild(g);streaks.push(g)
  }
  const seal=new Graphics().poly([0,-ry*.54,rx*.45,0,0,ry*.54,-rx*.45,0]).stroke({color:0xffdd9a,width:2,alpha:.9})
    .ellipse(0,0,rx*.32,ry*.4).fill({color:0xffd485,alpha:.08})
  seal.alpha=0;aura.addChild(seal)
  const flash=new Graphics().poly([0,-21,4,-4,21,0,4,4,0,21,-4,4,-21,0,-4,-4]).fill(0xffedbd)
  flash.alpha=0;aura.addChild(flash)
  const sparks=[]
  for(let i=0;i<8;i++){
    const g=new Graphics().poly([0,-3,1,0,0,3,-1,0]).fill(0xffdc91)
    g.alpha=0;aura.addChild(g);sparks.push(g)
  }
  const update=time=>{
    aura.position.copyFrom(socket('center',true))
    streaks.forEach((g,i)=>{
      const age=time-.1-i*.025,u=Math.max(0,Math.min(1,age/.5)),a=i*Math.PI/7
      const r=1.1-u*.64,length=(.16+Math.sin(Math.PI*u)*.16)
      g.clear().moveTo(Math.cos(a)*rx*r,Math.sin(a)*ry*r)
        .lineTo(Math.cos(a)*rx*(r+length),Math.sin(a)*ry*(r+length)).stroke({color:i%2?0xffe8b1:0xe9b075,width:i%3?1.6:2.5,cap:'round'})
      g.alpha=age>=0&&age<=.5?Math.sin(Math.PI*u)*.9:0
    })
    sparks.forEach((g,i)=>{
      const age=time-.62-i*.055,u=Math.max(0,Math.min(1,age/.76)),a=i*Math.PI/4
      g.position.set(Math.cos(a)*rx*(.45+u*.18),Math.sin(a)*ry*.55-u*17)
      g.alpha=age>=0&&age<=.76?Math.sin(Math.PI*u)*.85:0
    })
  }
  onFrame(update)
  tl.to(seal,{alpha:1,duration:.16},.46).to(seal.scale,{x:.86,y:.86,duration:.32,ease:'power2.out'},.46)
    .to(seal,{alpha:0,duration:.35},1.28)
    .to(flash,{alpha:.85,duration:.055},.565).to(flash,{alpha:0,duration:.2},.62)
    .call(()=>{update(.62);onCue({type:'impact'})},[],.62)
}
