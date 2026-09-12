import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function vitalThrow(context) {
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
  const centerKey=context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',center=targetSocket(centerKey),worldCenter=context.target.base(centerKey)
  const w=context.target.metrics.width,h=context.target.metrics.height,diagonal=Math.hypot(w,h)/2,margin=8*context.scene.unit
  const roomX=Math.min(worldCenter.x,context.scene.width-worldCenter.x)-margin,roomY=Math.min(worldCenter.y,context.scene.height-worldCenter.y)-margin
  const full=diagonal<=Math.min(roomX,roomY),turn=full?Math.PI*2:(w/2+h*.175<=roomX&&h/2+w*.175<=roomY?.35:0)
  const reachX=full?diagonal:w/2+h*Math.abs(turn)/2,reachY=full?diagonal:h/2+w*Math.abs(turn)/2
  const r=Math.min(54,Math.max(30,h/unit*.23)),lift=Math.max(0,Math.min(55,(worldCenter.y-reachY-margin)/unit))
  const sign=worldCenter.x<context.source.base('center').x?-1:1,roomToward=sign>0?worldCenter.x:context.scene.width-worldCenter.x
  const pull=Math.max(0,Math.min(r*.6,(roomToward-reachX-margin)/unit)),grip=fitPose(solveContact('hand',-.04,focus))
  const clamp=u=>Math.max(0,Math.min(1,u))
  const applyTarget=time=>{
    const u=clamp((time-.42)/.66),angle=full?(u===1?0:-turn*u):-turn*Math.sin(Math.PI*2*u),c=Math.cos(angle),s=Math.sin(angle)
    const x=center.x-pull*Math.sin(Math.PI*u),y=center.y-lift*Math.sin(Math.PI*u),dx=center.x-defenderHome.x,dy=center.y-defenderHome.y
    defender.position.set(x-dx*c+dy*s,y-dx*s-dy*c);defender.rotation=angle
  }
  const gripMark=new Graphics().ellipse(0,0,r*.4,r*.22).stroke({color:0xf0d4aa,width:2.3});gripMark.label='vital-throw-grip';gripMark.alpha=0;temporary.addChild(gripMark)
  const arc=new Graphics();arc.label='vital-throw-arc';arc.alpha=0;temporary.addChild(arc)
  const ring=new Graphics().ellipse(0,0,r*1.1,r*.22).stroke({color:0xe2c29b,width:2.8});ring.position.copyFrom(floor);ring.alpha=0;temporary.addChild(ring)
  const dust=Array.from({length:14},(_,i)=>{const g=new Graphics().ellipse(0,0,3+i%3,2).fill(i%2?0xdac3a0:0xaa987f);g.alpha=0;temporary.addChild(g);return{g,vx:(random()-.5)*150,vy:20+random()*35,life:.32+random()*.2}})
  const update=time=>{
    if(time>=.42)applyTarget(time)
    fitAttacker();gripMark.position.copyFrom(socket('hand',true));arc.clear()
    const u=clamp((time-.42)/.66)
    for(let i=0;i<=24;i++){const v=Math.max(0,u-.26)+i/24*Math.min(u,.26),x=center.x-pull*Math.sin(Math.PI*v),y=center.y-lift*Math.sin(Math.PI*v);i?arc.lineTo(x,y):arc.moveTo(x,y)}
    arc.stroke({color:0xe5cda8,width:3,alpha:.65,cap:'round'})
    for(const p of dust){const age=time-1.08,v=age/p.life;p.g.alpha=v>=0&&v<1?Math.sin(Math.PI*v)*.65:0;if(age>=0){p.g.position.set(floor.x+p.vx*age,floor.y-p.vy*age+45*age*age);p.g.scale.set(1+age)}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-9,rotation:-.035,duration:.18},0).to(attacker,{...grip,duration:.24,ease:'power2.in'},.18)
    .to(attacker,{x:grip.x-10,rotation:-.12,duration:.2},.46).to(attacker,{x:home.x,y:home.y,rotation:0,duration:.48},.92)
    .to(gripMark,{alpha:1,duration:.08},.35).to(gripMark,{alpha:0,duration:.2},.53)
    .to(arc,{alpha:.8,duration:.12},.42).to(arc,{alpha:0,duration:.22},1)
    .to(ring,{alpha:.9,duration:.035},1.08).to(ring.scale,{x:1.35,y:1.3,duration:.35},1.08).to(ring,{alpha:0,duration:.3},1.14)
    .call(()=>{update(1.08);onCue({type:'impact'});defender.tint=0xe9c6a2},[],1.08).call(()=>{defender.tint=0xffffff},[],1.3)
}
