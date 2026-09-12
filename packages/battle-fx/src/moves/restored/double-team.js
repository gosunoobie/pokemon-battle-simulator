import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function doubleTeam(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, captureActor, unit } = bindEffectSpace(context)
  const center=socket('center'),width=context.source.metrics.width/unit,height=context.source.metrics.height/unit
  const spread=Math.min(74,Math.max(28,width*.39))
  const aura=new Container();aura.label='double-team-aura';temporary.addChild(aura)
  const ghosts=[]
  for(let i=0;i<4;i++){
    const ghost=captureActor();ghost.label='double-team-echo-'+i;ghost.alpha=0;ghost.tint=0xc4dbef
    if(!ghost.children.length)ghost.addChild(new Graphics().ellipse(center.x,center.y,width*.43,height*.45).stroke({color:0xc4dbef,width:1.5,alpha:.7}))
    aura.addChild(ghost);ghosts.push(ghost)
  }
  const ring=new Graphics().ellipse(0,0,Math.min(96,width*.55),Math.min(100,height*.45))
    .stroke({color:0xdaeafa,width:1.2,alpha:.45})
  ring.alpha=0;aura.addChild(ring)
  const smooth=u=>u*u*(3-2*u),clamp=u=>Math.max(0,Math.min(1,u))
  const update=time=>{
    aura.position.copyFrom(socket('center',true))
    ghosts.forEach((g,i)=>{
      const start=.16+i*.05,open=smooth(clamp((time-start)/.55)),close=smooth(clamp((time-1.22)/.45))
      const side=i%2?1:-1,rank=i<2?.6:1,dx=side*spread*rank*open*(1-close)
      g.position.set(-center.x+dx,-center.y+Math.sin(time*7+i)*3*open*(1-close))
      g.alpha=time>=start&&time<1.72?Math.min(1,(time-start)/.12)*(1-close)*(i<2?.24:.14):0
    })
  }
  onFrame(update)
  tl.to(ring,{alpha:1,duration:.16},.48).to(ring,{alpha:0,duration:.4},.72)
    .call(()=>{update(.72);onCue({type:'impact'})},[],.72)
}
