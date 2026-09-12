import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function slackOff(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const puffs=Array.from({length:3},(_,i)=>{const g=new Graphics().ellipse(0,0,12,7).fill({color:0xe3eadb,alpha:.12}).ellipse(-3,-1,5,2).fill({color:0xfaffee,alpha:.15});g.alpha=0;g.label=`slack-off-exhale-${i}`;temporary.addChild(g);return g})
  const rest=new Container();rest.label='slack-off-rest';rest.alpha=0;temporary.addChild(rest)
  const settle=new Graphics(),glints=new Graphics();rest.addChild(settle,glints)
  const r=Math.min(62,Math.max(38,context.source.metrics.height/unit*.28))
  function update(time){
    const from=socket('emission',true),span=Math.min(24,room(from)/2)
    puffs.forEach((g,i)=>{const age=time-.2-i*.23,u=clamp(age/1.2),p={x:from.x+span*u,y:from.y-u*span*.24};fit(g,p,23);g.scale.set(g.scale.x*(.5+u*.8));g.alpha=age>=0&&age<1.2?Math.sin(Math.PI*u)*.9:0})
    fit(rest,socket('aura',true),r*1.35);settle.clear();glints.clear()
    for(let i=0;i<2;i++){const u=clamp((time-.3-i*.25)/1.35);settle.ellipse(0,r*(.15+u*.3),r*(.6+u*.3),r*(.18-u*.08)).stroke({color:0xd5e8cf,width:1.7,alpha:Math.sin(Math.PI*u)*.55})}
    const breathe=(Math.sin(time*2.8)+1)*.5
    for(let i=0;i<4;i++){const a=i*Math.PI/2+.5,x=Math.cos(a)*r*.6,y=Math.sin(a)*r*.48;glints.circle(x,y,1.8+breathe*.8).fill({color:0xf0f5d6,alpha:.25+breathe*.35})}
  }
  onFrame(update)
  tl.to(rest,{alpha:1,duration:.48},.1).to(rest,{alpha:0,duration:.5},1.7).call(()=>{update(1.05);onCue({type:'impact'})},[],1.05)

}
