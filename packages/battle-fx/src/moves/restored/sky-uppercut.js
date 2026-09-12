import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function skyUppercut(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit, gridOrigin } = bindEffectSpace(context)
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
  const attachment=context.source.hasAnchor?.('fist')?'fist':'hand',r=Math.min(31,Math.max(18,context.source.metrics.height/unit*.12)),rotation=-.06
  const point={x:focus.x,y:focus.y+4},pose=fitPose(solveContact(attachment,rotation,{x:point.x-Math.sin(rotation)*r,y:point.y+Math.cos(rotation)*r}))
  const hand=socket(attachment);point.x=pose.x+hand.x*Math.cos(rotation)-hand.y*Math.sin(rotation)+Math.sin(rotation)*r;point.y=pose.y+hand.x*Math.sin(rotation)+hand.y*Math.cos(rotation)-Math.cos(rotation)*r
  const key=context.source.hasAnchor?.('visualCenter')?'visualCenter':'center',base=socket(key),sourceY=pose.y+base.x*Math.sin(rotation)+base.y*Math.cos(rotation)
  const extent=(context.source.metrics.height*Math.cos(rotation)+context.source.metrics.width*Math.abs(Math.sin(rotation)))/(2*unit),top=-gridOrigin.y+8*context.scene.unit/unit
  const sourceLift=Math.max(0,Math.min(r*.6,sourceY-extent-top)),targetCenter=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center')
  const targetLift=Math.max(0,Math.min(r*.95,targetCenter.y-context.target.metrics.height/(2*unit)-top))
  const fist=new Container();fist.label='sky-uppercut-fist';fist.alpha=0;temporary.addChild(fist)
  fist.addChild(new Graphics().poly([-r*.54,r*.45,-r*.61,-r*.55,-r*.3,-r,r*.32,-r,r*.6,-r*.57,r*.51,r*.42,r*.07,r*.65])
    .fill(0xe8c5a1).stroke({color:0xffe8c8,width:1.8,join:'round'})
    .moveTo(-r*.3,-r*.8).lineTo(-r*.3,-r*.42).moveTo(0,-r*.84).lineTo(0,-r*.44).moveTo(r*.28,-r*.8).lineTo(r*.28,-r*.44).stroke({color:0xb38f70,width:1.4})
    .moveTo(-r*.3,r*.26).quadraticCurveTo(r*.3,r*.18,r*.38,-r*.16).stroke({color:0xb38f70,width:1.5,cap:'round'}))
  const wind=new Graphics().moveTo(-r*.75,r*1.9).quadraticCurveTo(-r*.98,r*.28,-r*.35,-r*.84).stroke({color:0xd4e1dd,width:4,alpha:.65,cap:'round'})
    .moveTo(-r*1.08,r*1.45).quadraticCurveTo(-r*1.08,r*.12,-r*.6,-r*.53).stroke({color:0xf1eee2,width:1.5,alpha:.8,cap:'round'});fist.addChildAt(wind,0)
  const impact=new Graphics().poly([-r*.5,0,-r*.1,-r*.14,0,-r*1.28,r*.1,-r*.14,r*.5,0,r*.1,r*.14,0,r*.4,-r*.1,r*.14]).fill(0xffe6be)
  impact.label='sky-uppercut-impact';impact.position.copyFrom(point);impact.alpha=0;temporary.addChild(impact)
  const flecks=Array.from({length:13},()=>{const g=new Graphics().moveTo(0,3).lineTo(1,-5).stroke({color:0xe8dbbc,width:1.8,cap:'round'});g.alpha=0;temporary.addChild(g);return{g,vx:(random()-.5)*90,vy:60+random()*80,life:.32+random()*.2}})
  const follow=()=>{fitAttacker();fist.position.copyFrom(socket(attachment,true));fist.rotation=attacker.rotation}
  onFrame(time=>{follow();for(const p of flecks){const age=time-.62,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.8:0;if(age>=0)p.g.position.set(point.x+p.vx*age,point.y-p.vy*age+60*age*age)}})
  tl.to(attacker,{x:home.x-9,y:home.y+5,rotation:.05,duration:.18},0)
    .to(attacker,{x:pose.x-r*.55,y:pose.y+r*.8,rotation:.05,duration:.26},.18).to(attacker,{...pose,duration:.18,ease:'power3.in'},.44)
    .to(attacker,{y:pose.y-sourceLift,duration:.18,ease:'power2.out'},.62).to(attacker,{x:home.x,y:home.y,rotation:0,duration:.6},.96)
    .to(fist,{alpha:1,duration:.12},.3).to(fist,{alpha:0,duration:.27},.83)
    .to(impact,{alpha:1,duration:.03},.62).to(impact,{alpha:0,duration:.23},.72)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xebd5b5},[],.62)
    .to(defender,{y:defenderHome.y-targetLift,duration:.2,ease:'power2.out'},.62).to(defender,{y:defenderHome.y,duration:.5,ease:'power2.inOut'},.91)
    .call(()=>{defender.tint=0xffffff},[],.9)
}
