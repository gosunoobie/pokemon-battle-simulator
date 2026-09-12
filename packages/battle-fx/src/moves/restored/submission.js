import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function submission(context) {
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
  const key=context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',center=targetSocket(key),world=context.target.base(key),w=context.target.metrics.width,h=context.target.metrics.height
  const margin=8*context.scene.unit,room=Math.min(world.x,context.scene.width-world.x,world.y,context.scene.height-world.y)-margin,rad=Math.hypot(w,h)/2
  const full=rad<=room,turn=full?Math.PI*2:(Math.max(w/2+h*.2,h/2+w*.2)<=room?.4:0)
  const reachY=full?rad:h/2+w*Math.abs(turn)/2,r=Math.min(57,Math.max(32,h/unit*.25)),lift=Math.max(0,Math.min(24,(world.y-reachY-margin)/unit)),grip=fitPose(solveContact('hand',0,focus))
  const wrap=new Graphics();wrap.label='submission-wrap';wrap.alpha=0;temporary.addChild(wrap)
  const recoil=new Graphics().ellipse(0,0,r*.33,r*.27).stroke({color:0xdcac96,width:2});recoil.label='submission-recoil';recoil.alpha=0;temporary.addChild(recoil)
  const ring=new Graphics().ellipse(0,0,r*1.05,r*.24).stroke({color:0xe4bf9e,width:2.5});ring.position.copyFrom(floor);ring.alpha=0;temporary.addChild(ring)
  const chips=Array.from({length:16},(_,i)=>{const g=new Graphics().poly([-2,-1,4,0,-2,2]).fill(i%2?0xddc7a8:0xbca385);g.alpha=0;temporary.addChild(g);return{g,vx:(random()-.5)*140,vy:24+random()*35,life:.34+random()*.2}})
  const update=time=>{
    if(time>=.48){
      const u=Math.max(0,Math.min(1,(time-.48)/.64)),angle=full?(u===1?0:turn*u):turn*Math.sin(Math.PI*2*u),c=Math.cos(angle),s=Math.sin(angle)
      const dx=center.x-defenderHome.x,dy=center.y-defenderHome.y
      defender.position.set(center.x-dx*c+dy*s,center.y-lift*Math.sin(Math.PI*u)-dx*s-dy*c);defender.rotation=angle
      if(time<=1.12){const point=targetSocket('center',true),pose=solveContact('hand',Math.sin(u*Math.PI*2)*.18,point);attacker.position.set(pose.x,pose.y);attacker.rotation=pose.rotation}
    }
    fitAttacker();const to=targetSocket('center',true);wrap.position.copyFrom(to);recoil.position.copyFrom(socket('center',true));wrap.clear()
    for(let lane=0;lane<2;lane++)for(let i=0;i<=22;i++){const a=time*9+lane*Math.PI+i/22*Math.PI*1.2,x=Math.cos(a)*r*.8,y=Math.sin(a)*r*.54;i?wrap.lineTo(x,y):wrap.moveTo(x,y);if(i===22)wrap.stroke({color:lane?0xf0d4b1:0xc8a887,width:2.6-lane*.6,alpha:.7,cap:'round'})}
    for(const p of chips){const age=time-1.12,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.8:0;if(age>=0){p.g.position.set(floor.x+p.vx*age,floor.y-p.vy*age+55*age*age);p.g.rotation=age*3}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-8,rotation:-.04,duration:.2},0).to(attacker,{...grip,duration:.28,ease:'power2.in'},.2)
    .to(wrap,{alpha:.9,duration:.1},.4).to(wrap,{alpha:0,duration:.24},1.14)
    .to(ring,{alpha:.8,duration:.035},1.12).to(ring.scale,{x:1.35,y:1.25,duration:.32},1.12).to(ring,{alpha:0,duration:.27},1.2)
    .call(()=>{update(1.12);onCue({type:'impact'});defender.tint=0xdfbda1;attacker.tint=0xe0b49d},[],1.12)
    .to(recoil,{alpha:.9,duration:.04},1.17).to(recoil,{alpha:0,duration:.25},1.24)
    .to(attacker,{x:grip.x-18,y:grip.y+4,rotation:-.1,duration:.16},1.18)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.5},1.38)
    .call(()=>{defender.tint=0xffffff;attacker.tint=0xffffff},[],1.43)
}
