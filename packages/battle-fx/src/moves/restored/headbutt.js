import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function headbutt(context) {
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

  const headSocket=context.source.hasAnchor?.('head')?'head':'emission',r=Math.min(31,Math.max(22,h*.14)),pose=fitPose(solveContact(headSocket,.045))
  const cap=new Graphics();cap.label='headbutt-contact';cap.alpha=0;temporary.addChild(cap)
  const wake=new Graphics();wake.alpha=0;temporary.addChild(wake)
  const ring=new Graphics();ring.label='headbutt-impact';ring.alpha=0;temporary.addChild(ring)
  let contact
  function update(time){
    fitActor();const from=socket(headSocket,true),to=contact??targetSocket('center',true),reach=clamp((time-.35)/.23)*(1-clamp((time-.63)/.19)),p={x:from.x+(to.x-from.x)*reach,y:from.y+(to.y-from.y)*reach}
    fitArt(cap,p,r*1.4);cap.alpha=time>=.18&&time<.88?Math.min(1,(time-.18)*9)*Math.min(1,(.88-time)*8):0
    cap.clear().moveTo(0,0).bezierCurveTo(0,-r*.82,-r*.92,-r*.95,-r*1.07,-r*.16).quadraticCurveTo(-r*.62,r*.6,0,0).fill({color:0xe5c798,alpha:.35})
      .moveTo(-r*.93,-r*.17).bezierCurveTo(-r*.7,-r*.85,-r*.05,-r*.63,0,0).stroke({color:0xffe8bd,width:3,cap:'round'})
    wake.clear();wake.alpha=cap.alpha*.5;wake.moveTo(from.x,from.y).lineTo(p.x,p.y).stroke({color:0xc4b08f,width:3,alpha:.45,cap:'round'})
    const age=time-.58,v=clamp(age/.43);ring.clear();ring.alpha=contact&&age>=0&&age<.43?1-v:0
    if(contact){fitArt(ring,contact,r*1.75);ring.ellipse(0,0,r*(.18+v*.38),r*(.4+v*.65)).stroke({color:0xffe6b5,width:3*(1-v)+1})
      for(const side of[-1,1])ring.moveTo(r*.3,side*r*(.25+v*.5)).lineTo(r*.75,side*r*(.45+v*.55)).stroke({color:0xd5b580,width:2,cap:'round'})}
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:-8,y:5,rotation:-.04}),duration:.19},0).to(attacker,{...pose,duration:.23,ease:'power3.in'},.33)
    .call(()=>{contact=targetSocket('center',true);update(.58);onCue({type:'impact'});defender.tint=0xead5b4},[],.58)
    .to(defender,{x:defenderHome.x+recoil,duration:.07,repeat:1,yoyo:true},.58).call(()=>{defender.tint=0xffffff},[],.77)
    .to(attacker,{...fitPose({x:pose.x-13,y:pose.y+3,rotation:-.025}),duration:.15},.66)
    .to(attacker,{x:0,y:0,rotation:0,duration:.4,ease:'power2.inOut'},.88)

}
