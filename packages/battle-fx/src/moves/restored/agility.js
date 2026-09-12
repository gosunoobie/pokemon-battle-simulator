import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function agility(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, attacker, home, unit } = bindEffectSpace(context)
  const width=context.source.metrics.width/unit,height=context.source.metrics.height/unit
  const step=Math.min(22,width*.13),span=Math.min(95,Math.max(38,width*.42))
  const aura=new Container();aura.label='agility-aura';temporary.addChild(aura)
  const streaks=[]
  for(let i=0;i<9;i++){
    const g=new Graphics().moveTo(-span*.42,0).quadraticCurveTo(0,-2,span*.42,0)
      .stroke({color:i%2?0xd5eaf7:0xffffff,width:i%3?1.2:2.3,alpha:.8,cap:'round'})
    g.alpha=0;aura.addChild(g);streaks.push(g)
  }
  const floorFlash=new Graphics().ellipse(0,0,span*.5,8).stroke({color:0xe0f6fa,width:1.8})
  floorFlash.alpha=0;aura.addChild(floorFlash)
  const update=time=>{
    const u=Math.max(0,Math.min(1,(time-.16)/.96)),weight=u>0&&u<1?Math.sin(Math.PI*u):0
    attacker.x=home.x+Math.sin(u*Math.PI*6)*step*weight
    attacker.y=home.y-Math.sin(u*Math.PI*6)**2*4*weight
    aura.position.copyFrom(socket('center',true))
    const foot=socket('floor',true),center=socket('center',true)
    floorFlash.position.set(foot.x-center.x,foot.y-center.y)
    streaks.forEach((g,i)=>{
      const age=time-.18-i*.065,v=Math.max(0,Math.min(1,age/.48))
      g.position.set((i%2?1:-1)*span*(.18+v*.32),(i%3-1)*Math.min(34,height*.14))
      g.scale.x=.65+Math.sin(Math.PI*v)*.35;g.alpha=age>=0&&age<=.48?Math.sin(Math.PI*v)*.75:0
    })
  }
  onFrame(update)
  tl.to(floorFlash,{alpha:.7,duration:.08},.54).to(floorFlash,{alpha:0,duration:.34},.62)
    .call(()=>{update(.62);onCue({type:'impact'})},[],.62)
}
