import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function frustration(context) {
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

  const r=Math.min(40,Math.max(27,h*.18)),pose=fitPose(solveContact('tackle',0))
  const anger=new Graphics();anger.alpha=0;temporary.addChild(anger)
  const streak=new Graphics();streak.alpha=0;temporary.addChild(streak)
  const front=new Graphics();front.label='frustration-contact';front.alpha=0;temporary.addChild(front)
  const cracks=new Graphics();cracks.label='frustration-impact';cracks.alpha=0;temporary.addChild(cracks)
  let contact
  function update(time){
    fitActor();const c=socket('center',true),from=socket('tackle',true),to=contact??targetSocket('center',true),reach=clamp((time-.53)/.22)*(1-clamp((time-.81)/.19)),p={x:from.x+(to.x-from.x)*reach,y:from.y+(to.y-from.y)*reach}
    const av=time>=.08&&time<.62?Math.min(1,(time-.08)*9)*Math.min(1,(.62-time)*9):0
    fitArt(anger,c,r*1.9);anger.clear();anger.alpha=av
    for(let i=0;i<3;i++){const a=-Math.PI*.8+i*.62,x=Math.cos(a)*r,y=Math.sin(a)*r,s=5+Math.sin(time*23+i)*1.5;for(const [dx,dy]of[[-1,-1],[1,-1],[-1,1],[1,1]])anger.moveTo(x+dx*s,y+dy*s*.3).lineTo(x+dx*s*.35,y+dy*s*.3).lineTo(x+dx*s*.35,y+dy*s).stroke({color:0xe08778,width:2,cap:'round'})}
    fitArt(front,p,r*1.5);front.clear();front.alpha=time>=.49&&time<1.01?Math.min(1,(time-.49)*15)*Math.min(1,(1.01-time)*8):0
    front.moveTo(0,0).bezierCurveTo(-r*.04,-r*.55,-r*.65,-r*.9,-r*.86,-r*.77).moveTo(0,0).bezierCurveTo(-r*.04,r*.55,-r*.65,r*.9,-r*.86,r*.77).stroke({color:0xe89d8b,width:4,cap:'round'})
    streak.clear();streak.alpha=front.alpha*.65;const gap=Math.min(r*.2,room(from)/3,room(p)/3)
    for(const side of[-1,1])streak.moveTo(from.x,from.y+gap*side).lineTo(p.x,p.y+gap*side).stroke({color:0xab6057,width:2,alpha:.7})
    const age=time-.75,v=clamp(age/.53);cracks.clear();cracks.alpha=contact&&age>=0&&age<.53?1-v:0
    if(contact){fitArt(cracks,contact,r*1.9);for(let j=0;j<7;j++){const a=j*Math.PI*2/7,d=r*(.32+v*.38);cracks.moveTo(0,0).lineTo(Math.cos(a-.12)*d,Math.sin(a-.12)*d).lineTo(Math.cos(a+.12)*d*1.4,Math.sin(a+.12)*d*1.4).lineTo(Math.cos(a)*d*1.8,Math.sin(a)*d*1.8).stroke({color:j%2?0xf4c0a0:0xc57468,width:2.5,cap:'round'})}}
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:-9,y:2,rotation:0}),duration:.17},0)
    .to(attacker,{...fitPose({x:-12,y:2,rotation:0}),duration:.035,repeat:5,yoyo:true},.2)
    .to(attacker,{...pose,duration:.23,ease:'power4.in'},.49)
    .call(()=>{contact=targetSocket('center',true);update(.75);onCue({type:'impact'});defender.tint=0xe6a797},[],.75)
    .to(defender,{x:defenderHome.x+recoil,duration:.08,repeat:1,yoyo:true},.75).call(()=>{defender.tint=0xffffff},[],.96)
    .to(attacker,{x:0,y:0,rotation:0,duration:.49,ease:'power2.inOut'},1.08)

}
