import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function facade(context) {
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

  const r=Math.min(44,Math.max(29,h*.19)),pose=fitPose(solveContact('tackle',0))
  const masks=[new Graphics(),new Graphics()];masks.forEach((g,i)=>{g.label=`facade-mask-${i}`;g.alpha=0;temporary.addChild(g)})
  const bridge=new Graphics();bridge.alpha=0;temporary.addChild(bridge)
  const front=new Graphics();front.label='facade-contact';front.alpha=0;temporary.addChild(front)
  const burst=new Graphics();burst.label='facade-impact';burst.alpha=0;temporary.addChild(burst)
  const shards=Array.from({length:10},(_,i)=>{const g=new Graphics().poly([0,-4,2,0,0,4,-2,0]).fill(i%2?0xf0c7a9:0xb9dee7);g.alpha=0;temporary.addChild(g);return{g,a:i*Math.PI/5+.2,s:.65+random()*.35}})
  let contact
  function update(time){
    fitActor();const c=socket('center',true),split=clamp((time-.45)/.34)
    masks.forEach((g,i)=>{const side=i?1:-1;fitArt(g,c,r*2);g.clear();g.alpha=time>=.1&&time<.85?Math.min(1,(time-.1)*6)*Math.min(1,(.85-time)*5):0
      const x=side*r*(.14+split*.6),y=-r*.08;g.moveTo(x-r*.35,y-r*.7).quadraticCurveTo(x+r*.3,y-r*.9,x+r*.42,y-r*.36).quadraticCurveTo(x+r*.29,y+r*.65,x-r*.2,y+r*.61).quadraticCurveTo(x-r*.52,y+r*.08,x-r*.35,y-r*.7).fill({color:i?0xe6b899:0x95bdcf,alpha:.62})
        .moveTo(x-r*.21,y-r*.24).quadraticCurveTo(x,y-r*.36,x+r*.21,y-r*.24).stroke({color:0xf4eee2,width:2})
        .moveTo(x-r*.15,y+r*.2).quadraticCurveTo(x,y+(i?.38:.05)*r,x+r*.15,y+r*.2).stroke({color:0xf5e9d9,width:1.6})})
    const from=socket('tackle',true),to=contact??targetSocket('center',true),reach=clamp((time-.53)/.29)*(1-clamp((time-.87)/.22)),p={x:from.x+(to.x-from.x)*reach,y:from.y+(to.y-from.y)*reach}
    fitArt(front,p,r*1.4);front.clear();front.alpha=time>=.46&&time<1.14?Math.min(1,(time-.46)*8)*Math.min(1,(1.14-time)*7):0
    front.moveTo(-r*.77,-r*.68).quadraticCurveTo(-r*.05,-r*.52,0,0).stroke({color:0xbadfe8,width:3,cap:'round'})
      .moveTo(0,0).quadraticCurveTo(-r*.05,r*.52,-r*.77,r*.68).stroke({color:0xf5c9a8,width:3,cap:'round'})
    bridge.clear();bridge.alpha=front.alpha*.45;bridge.moveTo(from.x,from.y).lineTo(p.x,p.y).stroke({color:0xd9d7c9,width:2,alpha:.5})
    const age=time-.82,v=clamp(age/.5);burst.clear();burst.alpha=contact&&age>=0&&age<.5?1-v:0
    if(contact){fitArt(burst,contact,r*1.65);const s=r*(.25+v*.6);burst.poly([0,-s,s*.4,-s*.25,s,0,s*.4,s*.25,0,s,-s*.4,s*.25,-s,0,-s*.4,-s*.25]).fill({color:0xfff2d7,alpha:.5}).stroke({color:0xe9e1c9,width:2})}
    shards.forEach(({g,a,s})=>{const q=clamp(age/.6),d=contact?Math.max(0,Math.min(r*1.7,room(contact)-7)):0;g.alpha=contact&&age>=0&&age<.6?1-q:0;if(contact){g.position.set(contact.x+Math.cos(a)*d*q*s,contact.y+Math.sin(a)*d*q*s);g.rotation=q*2;g.scale.set(Math.min(1,room(contact)/10))}})
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:-6,y:1,rotation:0}),duration:.25},0).to(attacker,{...pose,duration:.31,ease:'power3.in'},.48)
    .call(()=>{contact=targetSocket('center',true);update(.82);onCue({type:'impact'});defender.tint=0xe4d8cb},[],.82)
    .to(defender,{x:defenderHome.x+recoil*.9,duration:.07,repeat:1,yoyo:true},.82).call(()=>{defender.tint=0xffffff},[],1.02)
    .to(attacker,{x:0,y:0,rotation:0,duration:.48,ease:'power2.inOut'},1.17)

}
