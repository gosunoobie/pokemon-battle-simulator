import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function acidArmor(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, attacker, unit } = bindEffectSpace(context)
  const floor=socket('floor'),width=context.source.metrics.width/unit,height=context.source.metrics.height/unit
  const rx=Math.min(108,Math.max(42,width*.51)),ry=Math.min(114,Math.max(50,height*.49))
  const aura=new Container();aura.label='acid-armor-aura';aura.alpha=0;temporary.addChild(aura)
  const film=new Graphics(),pool=new Graphics(),streaks=[];aura.addChild(film,pool)
  for(let i=0;i<5;i++){const g=new Graphics();aura.addChild(g);streaks.push(g)}
  const drops=[]
  for(let i=0;i<12;i++){
    const g=new Graphics().ellipse(0,0,2,3.8).fill(i%2?0xcebef0:0xc3eee1)
    g.alpha=0;aura.addChild(g);drops.push(g)
  }
  const clamp=u=>Math.max(0,Math.min(1,u)),smooth=u=>u*u*(3-2*u)
  const update=time=>{
    const soften=smooth(clamp((time-.16)/.6))*(1-smooth(clamp((time-1.5)/.5)))
    const sx=1+.05*soften,sy=1-.17*soften
    attacker.scale.set(sx,sy);attacker.x=floor.x*(1-sx);attacker.y=floor.y*(1-sy)
    const center=socket('center',true),ground=socket('floor',true);aura.position.copyFrom(center)
    film.clear().moveTo(-rx*sx*.76,ry*sy*.65)
      .bezierCurveTo(-rx*sx*1.02,0,-rx*sx*.6,-ry*sy,0,-ry*sy*.96)
      .bezierCurveTo(rx*sx*.65,-ry*sy,rx*sx*1.01,0,rx*sx*.76,ry*sy*.65)
      .quadraticCurveTo(0,ry*sy*.91,-rx*sx*.76,ry*sy*.65)
      .fill({color:0xb5a4df,alpha:.09}).stroke({color:0xcbbded,width:1.5,alpha:.55})
    pool.position.set(ground.x-center.x,ground.y-center.y)
    pool.clear().ellipse(0,0,rx*(.6+soften*.25),7+soften*3).fill({color:0xb1d6d5,alpha:.1})
      .ellipse(0,0,rx*(.62+Math.sin(time*5)*.035),6).stroke({color:0xbce4db,width:1.4,alpha:.45})
    streaks.forEach((g,i)=>{
      const a=(time*.7+i/5)%1,y=ry*sy*(-.78+a*1.48),x=(i-2)*rx*.27
      g.clear().moveTo(x-4,y-10).quadraticCurveTo(x+Math.sin(time*4+i)*6,y,x,y+13)
        .stroke({color:i%2?0xe4d8fa:0xd6f7e8,width:2.2,alpha:Math.sin(Math.PI*a)*.6,cap:'round'})
    })
    drops.forEach((g,i)=>{
      const age=time-.64-i*.075,u=clamp(age/.6),side=i%2?1:-1
      g.position.set(side*rx*(.56+u*.2),ry*sy*.2+u*(ground.y-center.y-ry*sy*.2))
      g.scale.set(.7+u*.25,1-u*.55);g.alpha=age>=0&&age<=.6?Math.sin(Math.PI*u)*.7:0
    })
  }
  onFrame(update)
  tl.to(aura,{alpha:1,duration:.3},.18).to(aura,{alpha:0,duration:.38},1.9)
    .call(()=>{update(.76);onCue({type:'impact'})},[],.76)
}
