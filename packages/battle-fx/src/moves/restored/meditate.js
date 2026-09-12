import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function meditate(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, attacker, home, unit } = bindEffectSpace(context)
  const rx = Math.min(105, Math.max(40, context.source.metrics.width / unit * .5))
  const ry = Math.min(110, Math.max(48, context.source.metrics.height / unit * .47))
  const aura = new Container(); aura.label = 'meditate-aura'; aura.alpha = 0; temporary.addChild(aura)
  const lotus = new Graphics()
  for (let i = -2; i <= 2; i++) {
    const x = i * rx * .27
    lotus.moveTo(0,ry*.7).quadraticCurveTo(x-rx*.28,ry*.5,x,ry*(i===0?.04:.3))
      .quadraticCurveTo(x+rx*.28,ry*.54,0,ry*.7).fill({color:i===0?0xf6cfdd:0xd9a2cd,alpha:.12})
      .stroke({color:0xf1b9d7,width:1.2,alpha:.55})
  }
  lotus.ellipse(0,ry*.75,rx*.88,ry*.16).stroke({color:0xf7d3e6,width:1.8,alpha:.6}); aura.addChild(lotus)
  const field = new Graphics().ellipse(0,0,rx*.7,ry*.88).fill({color:0xe6b7dd,alpha:.055})
    .moveTo(-rx*.65,ry*.2).bezierCurveTo(-rx*.93,-ry*.8,rx*.93,-ry*.8,rx*.65,ry*.2)
    .stroke({color:0xf7d6e8,width:1.6,alpha:.65}); aura.addChild(field)
  const motes = []
  for(let i=0;i<8;i++){
    const g=new Graphics().poly([0,-4,2,0,0,4,-2,0]).fill(0xffe2ef)
    aura.addChild(g);motes.push(g)
  }
  const update = time => {
    aura.position.copyFrom(socket('center',true))
    const phase=Math.max(0,time-.18)
    field.scale.set(1+Math.sin(phase*3)*.018)
    motes.forEach((g,i)=>{
      const a=i*Math.PI/4+phase*.48
      g.position.set(Math.cos(a)*rx*.79,Math.sin(a)*ry*.66)
      g.alpha=.35+Math.sin(a+phase)**2*.5;g.rotation=a*.25
    })
  }
  onFrame(update)
  const lift=Math.min(4,context.source.metrics.height/unit*.022)
  tl.to(aura,{alpha:1,duration:.32},.12).to(aura,{alpha:0,duration:.42},1.45)
    .to(attacker,{y:home.y-lift,duration:.5,ease:'sine.inOut'},.15)
    .to(attacker,{y:home.y,duration:.4,ease:'sine.inOut'},1.4)
    .call(()=>{update(.7);onCue({type:'impact'})},[],.7)
}
