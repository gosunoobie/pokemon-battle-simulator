import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function scaryFace(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('eyes')?'eyes':'emission'
  const r=Math.min(52,Math.max(32,context.target.metrics.height/unit*.27))
  const mask=new Container();mask.label='scary-face-mask';mask.alpha=0;temporary.addChild(mask)
  const face=new Graphics();mask.addChild(face)
  const path={progress:0}
  const fear=Array.from({length:6},(_,i)=>{
    const g=new Graphics().moveTo(0,0).lineTo(2,8).lineTo(-1,14).stroke({color:i%2?0xdfb7de:0xc09ccb,width:2,cap:'round'})
    g.alpha=0;temporary.addChild(g);return g
  })
  const slow=new Container();slow.alpha=0;temporary.addChild(slow)
  for(let i=0;i<2;i++)slow.addChild(new Graphics().moveTo(-r*.16,-i*r*.25).lineTo(0,r*.11-i*r*.25).lineTo(r*.16,-i*r*.25).stroke({color:0xd7b6dd,width:2.8,cap:'round',join:'round'}))
  const update=time=>{
    const from=socket(attachment,true),to=targetSocket('center',true),p=path.progress
    mask.position.set(from.x+(to.x-from.x)*p,from.y+(to.y-from.y)*p-Math.sin(Math.PI*p)*r*.32)
    face.clear()
    const jaw=r*(.23+Math.sin(Math.max(0,time-.3)*8)*.025)
    face.moveTo(-r*.84,-r*.53).quadraticCurveTo(-r*.42,-r*.37,-r*.1,-r*.18)
      .quadraticCurveTo(-r*.51,r*.09,-r*.84,-r*.53).fill({color:0xf3cabf,alpha:.95})
      .moveTo(r*.84,-r*.53).quadraticCurveTo(r*.42,-r*.37,r*.1,-r*.18)
      .quadraticCurveTo(r*.51,r*.09,r*.84,-r*.53).fill({color:0xf3cabf,alpha:.95})
      .ellipse(-r*.4,-r*.23,r*.055,r*.13).fill(0x8f4c79).ellipse(r*.4,-r*.23,r*.055,r*.13).fill(0x8f4c79)
      .moveTo(-r*.94,-r*.66).lineTo(-r*.12,-r*.32).moveTo(r*.94,-r*.66).lineTo(r*.12,-r*.32)
      .stroke({color:0xb881ac,width:3.6,cap:'round'})
      .moveTo(-r*.54,r*.2).lineTo(-r*.3,r*.31).lineTo(-r*.1,r*.2).lineTo(r*.12,r*.32).lineTo(r*.34,r*.2).lineTo(r*.54,r*.27)
      .quadraticCurveTo(r*.3,r*.3+jaw,0,r*.32+jaw).quadraticCurveTo(-r*.36,r*.3+jaw,-r*.54,r*.2)
      .fill({color:0x513555,alpha:.52}).stroke({color:0xdab0cf,width:2.4,join:'round'})
    fear.forEach((g,i)=>{const age=time-.8-i*.045,u=age/.6;const side=i%2?1:-1;g.position.set(to.x+side*r*(.74+u*.24),to.y-r*.35+Math.floor(i/2)*r*.3+u*r*.24);g.rotation=side*-.2;g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.75:0})
    slow.position.set(to.x,to.y+r*.62+Math.max(0,time-.8)*r*.24)
  }
  onFrame(update)
  tl.to(attacker,{rotation:-.022,y:home.y-2,duration:.24},0).to(attacker,{rotation:0,y:home.y,duration:.3},.64)
    .to(mask,{alpha:1,duration:.15},.17).fromTo(mask.scale,{x:.4,y:.4},{x:1,y:1,duration:.48,ease:'back.out(1.2)'},.25)
    .to(path,{progress:1,duration:.55,ease:'power1.inOut'},.25)
    .to(mask,{alpha:0,duration:.32},1.04)
    .to(slow,{alpha:.8,duration:.1},.82).to(slow,{alpha:0,duration:.32},1.27)
    .call(()=>{update(.8);onCue({type:'impact'});defender.tint=0xd5b6d3},[],.8)
    .to(defender,{x:defenderHome.x+7,y:defenderHome.y+3,duration:.13},.8)
    .to(defender,{x:defenderHome.x,y:defenderHome.y,duration:.42},1.06)
    .call(()=>{defender.tint=0xffffff},[],1.16)
}
