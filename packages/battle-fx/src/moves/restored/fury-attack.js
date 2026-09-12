import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function furyAttack(context) {
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

  const pointSocket=context.source.hasAnchor?.('horn')?'horn':context.source.hasAnchor?.('beak')?'beak':'emission',r=Math.min(33,Math.max(21,h*.15)),times=[.44,.68,.92,1.16],points=[]
  const pose=fitPose(solveContact(pointSocket,0)),jab=new Graphics();jab.label='fury-attack-tip';jab.alpha=0;temporary.addChild(jab)
  const wake=new Graphics();wake.alpha=0;temporary.addChild(wake)
  const marks=times.map((_,i)=>{const g=new Graphics();g.label=`fury-attack-impact-${i}`;g.alpha=0;temporary.addChild(g);return g})
  function update(time){
    fitActor();const i=Math.min(3,Math.max(0,Math.floor((time-.32)/.24))),at=times[i],u=time<=at?clamp((time-at+.12)/.12):1-clamp((time-at)/.11),from=socket(pointSocket,true),center=targetSocket('center',true)
    const lane=(i%2?1:-1)*Math.min(7,context.target.metrics.height/unit*.045,room(center)/3),to=points[i]??{x:center.x,y:center.y+lane},p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u}
    fitArt(jab,p,r*1.8);jab.alpha=time>=.2&&time<1.34?Math.min(1,(time-.2)*15)*Math.min(1,(1.34-time)*9):0
    jab.clear().poly([0,0,-r*1.4,-r*.2,-r*1.2,r*.23]).fill(0xeee0bd).moveTo(-r*1.25,-r*.09).lineTo(0,0).stroke({color:0xfff2d4,width:1.7})
    wake.clear();wake.alpha=jab.alpha*.55;const offset=Math.min(5,room(from)/3,room(p)/3)
    for(const side of [-1,1])wake.moveTo(from.x,from.y+side*offset).lineTo(p.x,p.y+side*offset).stroke({color:0xd2c1a0,width:1.2,alpha:.55})
    marks.forEach((g,k)=>{const age=time-times[k],v=clamp(age/.25);g.clear();g.alpha=points[k]&&age>=0&&age<.25?1-v:0;if(!points[k])return;fitArt(g,points[k],r*1.2)
      const s=r*(.45+v*.35);g.poly([-s,0,-s*.2,-s*.13,0,-s*.75,s*.16,-s*.13,s,0,s*.16,s*.13,0,s*.75,-s*.2,s*.13]).fill(k%2?0xffedbd:0xddc7a0)})
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:-6,y:0,rotation:0}),duration:.13},0).to(attacker,{...pose,duration:.25,ease:'power2.in'},.16)
  times.forEach((at,i)=>{tl.call(()=>{const c=targetSocket('center',true),lane=(i%2?1:-1)*Math.min(7,context.target.metrics.height/unit*.045,room(c)/3);points[i]={x:c.x,y:c.y+lane};update(at);if(i===3)onCue({type:'impact'});defender.tint=0xe7d1a9},[],at)
    .to(defender,{x:defenderHome.x+recoil*.55,duration:.035,repeat:1,yoyo:true},at).call(()=>{defender.tint=0xffffff},[],at+.1)
    if(i<3)tl.to(attacker,{...fitPose({x:pose.x-5,y:pose.y,rotation:0}),duration:.085},at+.02).to(attacker,{...pose,duration:.12,ease:'power2.in'},at+.12)})
  tl.to(attacker,{x:0,y:0,rotation:0,duration:.4,ease:'power2.inOut'},1.36)

}
