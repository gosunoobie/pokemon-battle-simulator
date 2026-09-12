import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function doubleSlap(context) {
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

  const hand=context.source.hasAnchor?.('palm')?'palm':'hand',r=Math.min(30,Math.max(20,h*.13)),times=[.52,.88],points=[]
  const pose=fitPose(solveContact(hand,0)),brace=fitPose({x:-7,y:0,rotation:0})
  const palm=new Graphics();palm.label='double-slap-palm';palm.alpha=0;temporary.addChild(palm)
  const sweep=new Graphics();sweep.alpha=0;temporary.addChild(sweep)
  const stamps=times.map((_,i)=>{const g=new Graphics();g.label=`double-slap-impact-${i}`;g.alpha=0;temporary.addChild(g);return g})
  function update(time){
    fitActor();const from=socket(hand,true)
    let lane=time<.7?0:1,at=times[lane],reach=time<=at?clamp((time-at+.17)/.17):1-clamp((time-at)/.16),to=points[lane]??targetSocket('center',true),side=lane?1:-1
    const bend=Math.sin(Math.PI*reach)*Math.min(r*.5,room(from)/3,room(to)/3)*side,p={x:from.x+(to.x-from.x)*reach,y:from.y+(to.y-from.y)*reach+bend}
    fitArt(palm,p,r*1.6);palm.rotation=side*(1-reach)*.45;palm.alpha=time>=.28&&time<1.1?Math.min(1,(time-.28)*10)*Math.min(1,(1.1-time)*9):0
    palm.clear().roundRect(-r*.92,-r*.56,r*.92,r*1.12,r*.16).fill(lane?0xf6d7b0:0xead5b5).stroke({color:0xffedcd,width:1.4})
      .roundRect(-r*.6,r*.35,r*.43,r*.37,r*.14).fill(0xf7deb8)
    for(let i=0;i<4;i++)palm.moveTo(-r*.06,-r*.4+i*r*.24).lineTo(-r*.5,-r*.4+i*r*.24).stroke({color:0xb99d7b,width:1.2,alpha:.7,cap:'round'})
    sweep.clear();sweep.alpha=palm.alpha*.7
    const bow=Math.min(r*.6,room(from)/2,room(p)/2)*side
    sweep.moveTo(from.x,from.y).quadraticCurveTo((from.x+p.x)/2,(from.y+p.y)/2+bow,p.x,p.y).stroke({color:lane?0xffe7bf:0xd5c4a5,width:2,alpha:.65,cap:'round'})
    stamps.forEach((g,i)=>{const age=time-times[i],u=clamp(age/.3);g.alpha=points[i]&&age>=0&&age<.3?1-u:0;g.clear();if(!points[i])return;fitArt(g,points[i],r*1.5)
      for(let j=0;j<5;j++){const a=(j-2)*.45+(i?Math.PI:0),rad=r*(.35+u*.6);g.moveTo(Math.cos(a)*rad,Math.sin(a)*rad).lineTo(Math.cos(a)*(rad+r*.2),Math.sin(a)*(rad+r*.2)).stroke({color:0xffe4b6,width:2,cap:'round'})}})
  }
  onFrame(update)
  tl.to(attacker,{...brace,duration:.14},0).to(attacker,{...pose,duration:.31,ease:'power2.in'},.18)
    .to(attacker,{...fitPose({x:pose.x-6,y:pose.y,rotation:0}),duration:.12},.56).to(attacker,{...pose,duration:.18},.7)
    .to(attacker,{x:0,y:0,rotation:0,duration:.43,ease:'power2.inOut'},1.06)
  times.forEach((at,i)=>tl.call(()=>{points[i]=targetSocket('center',true);update(at);if(i===1)onCue({type:'impact'});defender.tint=0xf5d8b2},[],at)
    .to(defender,{x:defenderHome.x+recoil*(i?.9:.6),duration:.045,repeat:1,yoyo:true},at).call(()=>{defender.tint=0xffffff},[],at+.13))

}
