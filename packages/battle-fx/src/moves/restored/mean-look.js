import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function meanLook(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, attacker, defender, home, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('eyes')?'eyes':'emission'
  const rx=Math.min(57,Math.max(32,context.target.metrics.width/unit*.28)),ry=rx*.47
  const cageX=Math.min(101,Math.max(48,context.target.metrics.width/unit*.47))
  const cageY=Math.min(91,Math.max(43,context.target.metrics.height/unit*.39))
  const glint=new Graphics().poly([-9,0,-2,-2,0,-11,2,-2,9,0,2,2,0,11,-2,2]).fill(0xddb9f5)
  glint.label='mean-look-source';glint.alpha=0;temporary.addChild(glint)
  const eye=new Container();eye.label='mean-look-eye';eye.alpha=0;temporary.addChild(eye)
  eye.addChild(new Graphics().moveTo(-rx,0).quadraticCurveTo(0,-ry*1.6,rx,0).quadraticCurveTo(0,ry*1.6,-rx,0)
    .fill({color:0x493351,alpha:.36}).stroke({color:0xd6adeb,width:2.6})
    .ellipse(0,0,ry*.7,ry*.94).stroke({color:0xaf81c9,width:2})
    .poly([0,-ry*.75,ry*.19,0,0,ry*.75,-ry*.19,0]).fill(0xedcdfa))
  const iris=new Graphics();eye.addChild(iris)
  const brackets=new Graphics();brackets.alpha=0;temporary.addChild(brackets)
  const floorRing=new Graphics();floorRing.alpha=0;temporary.addChild(floorRing)
  const closure={progress:0}
  const update=time=>{
    glint.position.copyFrom(socket(attachment,true));glint.rotation=time*.3
    const to=targetSocket('center',true),floor=targetSocket('floor',true)
    eye.position.copyFrom(to);brackets.position.copyFrom(to);floorRing.position.copyFrom(floor)
    iris.clear()
    for(let i=0;i<3;i++){const a=time*1.6+i*Math.PI*2/3;iris.arc(0,0,ry*1.06,a,a+.8).stroke({color:0xcca8e5,width:1.2,alpha:.7})}
    brackets.clear()
    const x=cageX*(1.16-closure.progress*.16),y=cageY
    for(const side of [-1,1])brackets.moveTo(side*(x-10),-y).lineTo(side*x,-y).lineTo(side*x,y).lineTo(side*(x-10),y)
      .stroke({color:0xb58dcd,width:2,alpha:.7,cap:'round',join:'round'})
    floorRing.clear()
    for(let i=0;i<3;i++){
      const a=time*1.8+i*Math.PI*2/3
      for(let j=0;j<=16;j++){const angle=a+j/16*1.25,px=Math.cos(angle)*cageX*.82,py=Math.sin(angle)*cageY*.16;j?floorRing.lineTo(px,py):floorRing.moveTo(px,py)}
      floorRing.stroke({color:i%2?0xc29bd9:0x9470af,width:2,alpha:.65})
    }
  }
  onFrame(update)
  tl.to(attacker,{rotation:.012,x:home.x+2,duration:.22},0).to(attacker,{rotation:0,x:home.x,duration:.28},.7)
    .to(glint,{alpha:1,duration:.09},.16).to(glint,{alpha:0,duration:.24},.53)
    .to(eye,{alpha:1,duration:.3},.35).fromTo(eye.scale,{x:.28,y:.15},{x:1,y:1,duration:.45,ease:'power2.out'},.35)
    .to(eye,{alpha:0,duration:.4},1.43)
    .to(brackets,{alpha:.9,duration:.22},.57).to(closure,{progress:1,duration:.33,ease:'power2.in'},.57)
    .to(brackets,{alpha:0,duration:.38},1.57)
    .to(floorRing,{alpha:.9,duration:.15},.75).to(floorRing,{alpha:0,duration:.45},1.61)
    .call(()=>{update(.9);onCue({type:'impact'});defender.tint=0xc4a9d5},[],.9)
    .call(()=>{defender.tint=0xffffff},[],1.18)
}
