import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function swordsDance(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const rx=Math.min(112,Math.max(46,context.source.metrics.width/unit*.57))
  const ry=Math.min(105,Math.max(48,context.source.metrics.height/unit*.44))
  const length=Math.min(74,Math.max(40,context.source.metrics.height/unit*.32))
  const aura=new Container();aura.label='swords-dance-aura';aura.alpha=0;temporary.addChild(aura)
  const blades=[],traces=[]
  for(let i=0;i<4;i++){
    const sword=new Container();sword.label='swords-dance-blade-'+i
    sword.addChild(new Graphics().poly([-4,0,-6,-length*.73,0,-length,6,-length*.73,4,0]).fill(0xc7ddeb)
      .poly([0,0,0,-length,6,-length*.73,4,0]).fill(0xf1f6f3)
      .moveTo(0,-4).lineTo(0,-length*.83).stroke({color:0x8caec8,width:1})
      .roundRect(-12,-2,24,5,2).fill(0xe4c387).roundRect(-3,3,6,14,2).fill(0x9e7954)
      .circle(0,18,4).fill(0xe7cf9b))
    aura.addChild(sword);blades.push(sword)
    const trace=new Graphics();aura.addChild(trace);traces.push(trace)
  }
  const update=time=>{
    aura.position.copyFrom(socket('center',true))
    const phase=Math.max(0,Math.min(1,(time-.2)/1.35)),turn=phase*4.8
    blades.forEach((g,i)=>{
      const a=i*Math.PI/2+turn
      g.position.set(Math.cos(a)*rx,Math.sin(a)*ry*.34+length*.27)
      g.rotation=Math.cos(a)*.22;g.alpha=.5+(Math.sin(a)+1)*.25
      g.scale.set(.78+(Math.sin(a)+1)*.1)
      const trail=traces[i];trail.clear()
      for(let j=0;j<=12;j++){
        const b=a-.6+j*.05,x=Math.cos(b)*rx,y=Math.sin(b)*ry*.34+length*.27
        if(j===0)trail.moveTo(x,y);else trail.lineTo(x,y)
      }
      trail.stroke({color:0xdbe9ef,width:1.2,alpha:.45})
    })
  }
  onFrame(update)
  tl.to(aura,{alpha:1,duration:.28},.12).to(aura,{alpha:0,duration:.42},1.72)
    .call(()=>{update(.95);onCue({type:'impact'})},[],.95)
}
