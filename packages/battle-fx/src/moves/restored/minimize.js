import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function minimize(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, attacker, unit } = bindEffectSpace(context)
  const floor=socket('floor'),width=context.source.metrics.width/unit,height=context.source.metrics.height/unit
  const rx=Math.min(104,Math.max(40,width*.52)),ry=Math.min(110,Math.max(48,height*.48))
  const aura=new Container();aura.label='minimize-aura';temporary.addChild(aura)
  const brackets=new Graphics();aura.addChild(brackets)
  const motes=[]
  for(let i=0;i<8;i++){
    const g=new Graphics().poly([0,-3,1,0,0,3,-1,0]).fill(0xedd8f7);g.alpha=0;aura.addChild(g);motes.push(g)
  }
  const clamp=u=>Math.max(0,Math.min(1,u)),smooth=u=>u*u*(3-2*u)
  const update=time=>{
    const shrink=smooth(clamp((time-.16)/.54)),back=smooth(clamp((time-1.35)/.5)),amount=shrink*(1-back),scale=1-.58*amount
    const dodge=clamp((time-.78)/.42),dx=dodge>0&&dodge<1?Math.sin(Math.PI*dodge)*Math.min(9,rx*.1):0
    attacker.scale.set(scale);attacker.x=floor.x*(1-scale)+dx;attacker.y=floor.y*(1-scale)
    aura.position.copyFrom(socket('center',true))
    const x=rx*scale+10,y=ry*scale*.65
    brackets.clear().moveTo(-x+7,-y).quadraticCurveTo(-x-12,0,-x+7,y)
      .moveTo(x-7,-y).quadraticCurveTo(x+12,0,x-7,y).stroke({color:0xe7cef5,width:1.8,alpha:.7})
    brackets.alpha=clamp((time-.12)/.2)*(1-clamp((time-.95)/.4))
    motes.forEach((g,i)=>{
      const age=time-.7-i*.045,u=clamp(age/.6),a=i*Math.PI/4+u
      g.position.set(Math.cos(a)*rx*scale*.92,Math.sin(a)*ry*scale*.86-u*9)
      g.alpha=age>=0&&age<=.6?Math.sin(Math.PI*u)*.8:0
    })
  }
  onFrame(update)
  tl.call(()=>{update(.7);onCue({type:'impact'})},[],.7)
}
