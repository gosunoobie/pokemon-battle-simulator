import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function ironTail(context) {
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

  const tailSocket=context.source.hasAnchor?.('tail')?'tail':'hand',r=Math.min(36,Math.max(24,h*.16)),pose=fitPose(solveContact(tailSocket,.05))
  const chain=new Graphics();chain.alpha=0;temporary.addChild(chain)
  const head=new Graphics();head.label='iron-tail-tip';head.alpha=0;temporary.addChild(head)
  const shock=new Graphics();shock.label='iron-tail-impact';shock.alpha=0;temporary.addChild(shock)
  let contact
  function update(time){
    fitActor();const forward=clamp((time-.48)/.43),back=clamp((time-.98)/.31),u=forward*(1-back),from=socket(tailSocket,true),to=contact??targetSocket('center',true)
    const bend=Math.min(r*1.4,room(from)/2,room(to)/2),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u-Math.sin(Math.PI*u)*bend}
    const alpha=time>=.17&&time<1.34?Math.min(1,(time-.17)*6)*Math.min(1,(1.34-time)*7):0
    fitArt(head,p,r*1.65);head.rotation=-.7*(1-forward)+back*.4;head.alpha=alpha
    head.clear().poly([0,-r*.28,-r*.35,-r*.47,-r*.98,-r*.3,-r*1.13,r*.21,-r*.46,r*.43,0,r*.23]).fill(0x8aa0af).stroke({color:0xe4f3fa,width:1.7})
      .poly([-r*.04,-r*.2,-r*.4,-r*.36,-r*.87,-r*.22,-r*.65,-r*.06]).fill(0xe9f3f7)
      .moveTo(-r*.42,-r*.36).lineTo(-r*.54,r*.3).stroke({color:0x5b7386,width:2})
    chain.clear();chain.alpha=alpha;const reach=Math.hypot(p.x-from.x,p.y-from.y),thick=Math.max(0,Math.min(r*.21,room(from)/3,room(p)/3))
    for(let j=0;j<7;j++){const a=j/7,b=(j+.84)/7,x=from.x+(p.x-from.x)*a,y=from.y+(p.y-from.y)*a-Math.sin(Math.PI*a)*Math.min(bend*.7,reach*.15),xx=from.x+(p.x-from.x)*b,yy=from.y+(p.y-from.y)*b-Math.sin(Math.PI*b)*Math.min(bend*.7,reach*.15)
      chain.moveTo(x,y).lineTo(xx,yy).stroke({color:j%2?0xa2b8c5:0x748f9e,width:thick*2,cap:'round'}).moveTo(x,y-thick*.3).lineTo(xx,yy-thick*.3).stroke({color:0xe4f1f6,width:Math.max(.1,thick*.4),cap:'round'})}
    const age=time-.91,v=clamp(age/.57);shock.clear();shock.alpha=contact&&age>=0&&age<.57?1-v:0
    if(contact){fitArt(shock,contact,r*2);for(let j=0;j<8;j++){const a=j*Math.PI/4+.15,d=r*(.3+v*.7);shock.moveTo(Math.cos(a)*d,Math.sin(a)*d).lineTo(Math.cos(a)*(d+r*.6),Math.sin(a)*(d+r*.6)).stroke({color:j%2?0xc2d6df:0xf5fcff,width:3*(1-v)+.5,cap:'round'})}
      shock.ellipse(0,0,r*(.4+v),r*(.18+v*.5)).stroke({color:0xa7c1d0,width:2,alpha:.6})}
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:-14,y:3,rotation:-.08}),duration:.3},0).to(attacker,{...pose,duration:.38,ease:'power3.in'},.5)
    .call(()=>{contact=targetSocket('center',true);update(.91);onCue({type:'impact'});defender.tint=0xb9cfdd},[],.91)
    .to(defender,{x:defenderHome.x+recoil,duration:.095,repeat:1,yoyo:true},.91).call(()=>{defender.tint=0xffffff},[],1.15)
    .to(attacker,{x:0,y:0,rotation:0,duration:.5,ease:'power2.inOut'},1.36)

}
