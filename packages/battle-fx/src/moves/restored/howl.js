import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function howl(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, attacker, home, unit } = bindEffectSpace(context)
  const span=Math.min(92,Math.max(44,context.source.metrics.height/unit*.42))
  const aura=new Container();aura.label='howl-aura';temporary.addChild(aura)
  const mouth=new Container();mouth.label='howl-emission';mouth.rotation=-.4;aura.addChild(mouth)
  const glow=new Graphics().ellipse(0,0,13,9).fill({color:0xffeac9,alpha:.2})
    .ellipse(0,0,7,4).fill({color:0xfff2d7,alpha:.4})
  glow.alpha=0;mouth.addChild(glow)
  const waves=[]
  for(let i=0;i<4;i++){
    const g=new Graphics();g.alpha=0;mouth.addChild(g);waves.push(g)
  }
  const update=time=>{
    const center=socket('center',true),emission=socket('emission',true)
    aura.position.copyFrom(center);mouth.position.set(emission.x-center.x,emission.y-center.y)
    waves.forEach((g,i)=>{
      const age=time-.5-i*.18,u=Math.max(0,Math.min(1,age/.8)),r=span*(.16+u*.74)
      g.clear().moveTo(r*.46,-r*.72).quadraticCurveTo(r*1.22,0,r*.46,r*.72)
        .stroke({color:i%2?0xd9e5f5:0xffe4b6,width:2.6-i*.35,alpha:.85,cap:'round'})
      g.x=u*span*.3;g.alpha=age>=0&&age<=.8?Math.sin(Math.PI*u)*.85:0
    })
  }
  onFrame(update)
  tl.to(attacker,{rotation:-.05,y:home.y-2,duration:.28,ease:'sine.out'},.1)
    .to(attacker,{rotation:0,y:home.y,duration:.35,ease:'sine.inOut'},1.12)
    .to(glow,{alpha:1,duration:.16},.34).to(glow,{alpha:0,duration:.35},.64)
    .call(()=>{update(.5);onCue({type:'impact'})},[],.5)
}
