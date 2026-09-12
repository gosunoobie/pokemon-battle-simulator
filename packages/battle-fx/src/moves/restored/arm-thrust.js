import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function armThrust(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  function fitPose(p) {
    let angle=p.rotation??0,c,s,rx,ry
    for(let i=0;i<12;i++){c=Math.cos(angle);s=Math.sin(angle);rx=(w*Math.abs(c)+h*Math.abs(s))/2;ry=(h*Math.abs(c)+w*Math.abs(s))/2;if(rx*2<=right-left&&ry*2<=bottom-top)break;angle*=.5}
    const x=p.x+center.x*c-center.y*s,y=p.y+center.x*s+center.y*c
    return{x:p.x+Math.max(left+rx,Math.min(right-rx,x))-x,y:p.y+Math.max(top+ry,Math.min(bottom-ry,y))-y,rotation:angle}
  }
  const fitActor=()=>{const p=fitPose(attacker);attacker.position.set(p.x,p.y);attacker.rotation=p.rotation}
  const room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const fitArt=(g,p,extent)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/extent))}
  const clamp=x=>Math.max(0,Math.min(1,x))
  const receiver=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center')
  const recoil=Math.max(0,Math.min(9,right-receiver.x-context.target.metrics.width/(2*unit)))

  const hand=context.source.hasAnchor?.('palm')?'palm':'hand',r=Math.min(34,Math.max(22,h*.15)),times=[.62,.98,1.34],points=[]
  const pose=fitPose(solveContact(hand,0)),palm=new Graphics();palm.label='arm-thrust-palm';palm.alpha=0;temporary.addChild(palm)
  const forearm=new Graphics();forearm.alpha=0;temporary.addChild(forearm)
  const presses=times.map((_,i)=>{const g=new Graphics();g.label=`arm-thrust-impact-${i}`;g.alpha=0;temporary.addChild(g);return g})
  function update(time){
    fitActor();const i=Math.min(2,Math.max(0,Math.floor((time-.43)/.36))),at=times[i],u=time<=at?clamp((time-at+.19)/.19):1-clamp((time-at)/.15),from=socket(hand,true),to=points[i]??targetSocket('center',true),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u}
    fitArt(palm,p,r*1.7);palm.alpha=time>=.3&&time<1.6?Math.min(1,(time-.3)*10)*Math.min(1,(1.6-time)*7):0;palm.clear()
      .roundRect(-r*.62,-r*.84,r*.62,r*1.6,r*.14).fill(0xdf967a).stroke({color:0xffd7ae,width:1.8})
      .roundRect(-r*.78,r*.18,r*.42,r*.57,r*.16).fill(0xedb08d)
    for(let j=0;j<3;j++)palm.moveTo(-r*.08,-r*.58+j*r*.23).lineTo(-r*.42,-r*.58+j*r*.23).stroke({color:0xaa705e,width:1.2,cap:'round'})
    const offset=Math.min(r*.22,room(from)/2,room(p)/2);forearm.clear();forearm.alpha=palm.alpha*.65
    forearm.moveTo(from.x,from.y-offset).lineTo(p.x-r*.45*palm.scale.x,p.y-offset).moveTo(from.x,from.y+offset).lineTo(p.x-r*.45*palm.scale.x,p.y+offset).stroke({color:0xebbea0,width:2.2,alpha:.6,cap:'round'})
    presses.forEach((g,k)=>{const age=time-times[k],v=clamp(age/.36);g.clear();g.alpha=points[k]&&age>=0&&age<.36?1-v:0;if(!points[k])return;fitArt(g,points[k],r*1.6)
      g.ellipse(0,0,r*(.2+v*.2),r*(.58+v*.6)).stroke({color:0xffddac,width:3,alpha:.85})
      for(const side of [-1,1])g.moveTo(r*.17,side*r*.68).lineTo(r*.53,side*r*.98).stroke({color:0xe6a37e,width:2,cap:'round'})})
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:-8,y:3,rotation:0}),duration:.2},0).to(attacker,{...pose,duration:.31,ease:'power2.in'},.28)
  times.forEach((at,i)=>{tl.call(()=>{points[i]=targetSocket('center',true);update(at);if(i===2)onCue({type:'impact'});defender.tint=0xf3c6a0},[],at)
    .to(defender,{x:defenderHome.x+recoil,duration:.065,repeat:1,yoyo:true},at).call(()=>{defender.tint=0xffffff},[],at+.16)
    if(i<2)tl.to(attacker,{...fitPose({x:pose.x-11,y:pose.y,rotation:0}),duration:.14},at+.04).to(attacker,{...pose,duration:.17,ease:'power3.in'},at+.19)})
  tl.to(attacker,{x:0,y:0,rotation:0,duration:.46,ease:'power2.inOut'},1.6)

}
