import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function seismicToss(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  // Keep the complete source silhouette in view; edge layouts may grip below the semantic center.
  const sourceCenter=socket(context.source.hasAnchor?.('visualCenter')?'visualCenter':'center')
  const left=Math.min(-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x),right=Math.max(-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x)
  const topLimit=-temporary.y/unit,bottomLimit=(context.scene.height-temporary.y)/unit
  const fitPose=pose=>{
    const c=Math.cos(pose.rotation),s=Math.sin(pose.rotation),w=context.source.metrics.width/unit,h=context.source.metrics.height/unit
    const rx=(w*Math.abs(c)+h*Math.abs(s))/2,ry=(h*Math.abs(c)+w*Math.abs(s))/2
    const cx=pose.x+sourceCenter.x*c-sourceCenter.y*s,cy=pose.y+sourceCenter.x*s+sourceCenter.y*c
    return {...pose,x:pose.x+Math.max(left+rx,Math.min(right-rx,cx))-cx,y:pose.y+Math.max(topLimit+ry,Math.min(bottomLimit-ry,cy))-cy}
  }
  const fitAttacker=()=>{const p=fitPose({x:attacker.x,y:attacker.y,rotation:attacker.rotation});attacker.position.set(p.x,p.y)}
  const key=context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',center=targetSocket(key),world=context.target.base(key),w=context.target.metrics.width,h=context.target.metrics.height,margin=8*context.scene.unit
  const roomX=Math.min(world.x,context.scene.width-world.x)-margin,roomY=Math.min(world.y,context.scene.height-world.y)-margin
  const lean=w/2+h*.07<=roomX&&h/2+w*.07<=roomY?.14:0,reachY=h/2+w*lean/2
  const lift=Math.max(0,Math.min(155,h/unit*.72,(world.y-reachY-margin)/unit)),r=Math.min(69,Math.max(38,w/unit*.3)),grip=fitPose(solveContact('hand',-.025,focus)),motion={height:0,angle:0}
  const catchMark=new Graphics().ellipse(0,0,r*.36,r*.22).stroke({color:0xe9d0a7,width:2.2});catchMark.label='seismic-toss-grip';catchMark.alpha=0;temporary.addChild(catchMark)
  const rush=new Graphics();rush.label='seismic-toss-rush';rush.alpha=0;temporary.addChild(rush)
  const impact=new Graphics().ellipse(0,0,r,r*.2).stroke({color:0xe9c49a,width:3}).ellipse(0,0,r*.72,r*.13).stroke({color:0xf6dfb6,width:1.6})
  impact.label='seismic-toss-impact';impact.position.copyFrom(floor);impact.alpha=0;temporary.addChild(impact)
  const cracks=new Graphics();cracks.position.copyFrom(floor);cracks.alpha=0;temporary.addChild(cracks)
  for(let i=0;i<5;i++){const side=i%2?1:-1,x=side*r*(.25+i*.12);cracks.moveTo(side*r*.14,0).lineTo(x,-3+i).lineTo(x+side*9,2+i).lineTo(x+side*16,i).stroke({color:0xc3a583,width:1.5,alpha:.75})}
  const dust=Array.from({length:22},(_,i)=>{const g=new Graphics().ellipse(0,0,3+i%4,2+i%2).fill(i%2?0xd7c19f:0xb39e7e);g.alpha=0;temporary.addChild(g);return{g,vx:(random()-.5)*190,vy:25+random()*45,life:.4+random()*.2}})
  const update=time=>{
    const c=Math.cos(motion.angle),s=Math.sin(motion.angle),dx=center.x-defenderHome.x,dy=center.y-defenderHome.y
    defender.position.set(center.x-dx*c+dy*s,center.y-lift*motion.height-dx*s-dy*c);defender.rotation=motion.angle
    fitAttacker();catchMark.position.copyFrom(socket('hand',true));const to=targetSocket(key,true);rush.position.copyFrom(to);rush.clear()
    for(const side of [-1,1])for(let i=0;i<2;i++){const x=side*r*(.5+i*.22);rush.moveTo(x,-r*(1.1+i*.3)).lineTo(x,-r*.18).stroke({color:i?0xd6c6ae:0xf0dec1,width:i?1.5:3,alpha:.7,cap:'round'})}
    for(const p of dust){const age=time-1.5,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.65:0;if(age>=0){p.g.position.set(floor.x+p.vx*age,floor.y-p.vy*age+65*age*age);p.g.scale.set(1+age)}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-7,rotation:-.035,duration:.18},0).to(attacker,{...grip,duration:.28,ease:'power2.in'},.18)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.58},.77)
    .to(catchMark,{alpha:1,duration:.08},.37).to(catchMark,{alpha:0,duration:.2},.54)
    .to(motion,{height:1,angle:lean,duration:.52,ease:'power2.out'},.46).to(motion,{angle:-lean*.55,duration:.18},.98)
    .to(motion,{height:0,angle:0,duration:.34,ease:'power3.in'},1.16)
    .to(motion,{height:lift>0?Math.min(.08,5/lift):0,duration:.09,ease:'power2.out'},1.5).to(motion,{height:0,duration:.18,ease:'power2.in'},1.59)
    .to(rush,{alpha:.85,duration:.1},1.16).to(rush,{alpha:0,duration:.17},1.5)
    .to(impact,{alpha:.9,duration:.035},1.5).to(impact.scale,{x:1.5,y:1.5,duration:.4},1.5).to(impact,{alpha:0,duration:.33},1.61)
    .to(cracks,{alpha:.8,duration:.04},1.5).to(cracks,{alpha:0,duration:.35},1.72)
    .call(()=>{update(1.5);onCue({type:'impact'});defender.tint=0xe8c7a0},[],1.5).call(()=>{defender.tint=0xffffff},[],1.76)
}
