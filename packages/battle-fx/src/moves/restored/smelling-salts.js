import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function smellingSalts(context) {
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

  const hand=context.source.hasAnchor?.('palm')?'palm':'hand',r=Math.min(31,Math.max(22,h*.14)),pose=fitPose(solveContact(hand,0))
  const palms=[new Graphics(),new Graphics()];palms.forEach((g,i)=>{g.label=`smelling-salts-palm-${i}`;g.alpha=0;temporary.addChild(g)})
  const wake=new Graphics();wake.label='smelling-salts-impact';wake.alpha=0;temporary.addChild(wake)
  const vapors=new Graphics();vapors.alpha=0;temporary.addChild(vapors)
  const grains=Array.from({length:18},(_,i)=>{const g=new Graphics().poly([0,-2.5,2.2,0,0,2.5,-2.2,0]).fill(i%2?0xeaf6d8:0xbfdba9);g.alpha=0;temporary.addChild(g);return{g,a:random()*Math.PI*2,s:.5+random()*.5}})
  let contact
  function update(time){
    fitActor();const from=socket(hand,true),to=contact??targetSocket('center',true),u=clamp((time-.43)/.41),back=clamp((time-.9)/.24),reach=u*(1-back),bend=Math.min(r,room(from)/2,room(to)/2)
    const alpha=time>=.3&&time<1.24?Math.min(1,(time-.3)*7)*Math.min(1,(1.24-time)*6):0
    palms.forEach((g,i)=>{const side=i?1:-1,p={x:from.x+(to.x-from.x)*reach,y:from.y+(to.y-from.y)*reach+side*Math.sin(Math.PI*reach)*bend};fitArt(g,p,r*1.5);g.alpha=alpha;g.rotation=side*(1-u)*.35
      g.clear().roundRect(-r*.7,side<0?-r*.5:0,r*.7,r*.5,r*.13).fill(i?0xd1e1b5:0xe8ebce).stroke({color:0xf4f5e0,width:1.5})
      for(let j=0;j<3;j++)g.moveTo(-r*.12,side*r*(.11+j*.12)).lineTo(-r*.42,side*r*(.11+j*.12)).stroke({color:0x9aac87,width:1})})
    const age=time-.84,v=clamp(age/.58);wake.clear();wake.alpha=contact&&age>=0&&age<.58?1-v:0
    if(contact){fitArt(wake,contact,r*1.9);wake.circle(0,0,r*(.2+v*.8)).stroke({color:0xf4ffda,width:3*(1-v)+.8})
      for(let j=0;j<6;j++){const a=j*Math.PI/3,d=r*(.55+v*.55);wake.moveTo(Math.cos(a)*d,Math.sin(a)*d).lineTo(Math.cos(a)*(d+r*.35),Math.sin(a)*(d+r*.35)).stroke({color:0xd5eeb4,width:2,cap:'round'})}}
    vapors.clear();vapors.alpha=contact&&age>=0&&age<.76?(1-clamp(age/.76))*.5:0
    if(contact){fitArt(vapors,contact,r*2);for(const side of[-1,1]){const rise=clamp(age/.76)*r*.6;vapors.moveTo(side*r*.28,r*.25-rise).bezierCurveTo(side*r*.6,-r*.05-rise,side*r*.15,-r*.25-rise,side*r*.42,-r*.55-rise).stroke({color:0xdceccb,width:3,alpha:.6,cap:'round'})}}
    grains.forEach(({g,a,s})=>{const q=clamp(age/.72),d=contact?Math.max(0,Math.min(r*1.65,room(contact)-6)):0;g.alpha=contact&&age>=0&&age<.72?1-q:0;if(contact){g.position.set(contact.x+Math.cos(a)*d*q*s*.8,contact.y+Math.sin(a)*d*q*s*.5-d*q*q*.25);g.rotation=q*3;g.scale.set(Math.min(1,room(contact)/8))}})
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:-5,y:0,rotation:0}),duration:.2},0).to(attacker,{...pose,duration:.33,ease:'power2.in'},.45)
    .call(()=>{contact=targetSocket('center',true);update(.84);onCue({type:'impact'});defender.tint=0xd8e9bc},[],.84)
    .to(defender,{x:defenderHome.x+recoil*.65,duration:.035,repeat:3,yoyo:true},.84).call(()=>{defender.tint=0xffffff},[],1.04)
    .to(attacker,{x:0,y:0,rotation:0,duration:.44,ease:'power2.inOut'},1.27)

}
