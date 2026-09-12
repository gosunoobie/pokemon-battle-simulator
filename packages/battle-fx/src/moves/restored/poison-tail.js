import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function poisonTail(context) {
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

  const tailSocket=context.source.hasAnchor?.('tail')?'tail':'hand',r=Math.min(34,Math.max(23,h*.15)),pose=fitPose(solveContact(tailSocket,-.04))
  const tail=new Graphics();tail.alpha=0;temporary.addChild(tail)
  const hook=new Graphics();hook.label='poison-tail-tip';hook.alpha=0;temporary.addChild(hook)
  const splash=new Graphics();splash.label='poison-tail-impact';splash.alpha=0;temporary.addChild(splash)
  const drops=Array.from({length:16},(_,i)=>{const g=new Graphics().ellipse(0,0,2+i%3,3+i%2).fill(i%2?0xb684da:0x74459e);g.alpha=0;temporary.addChild(g);return{g,a:random()*Math.PI*2,speed:.6+random()*.4}})
  let contact
  function update(time){
    fitActor();const u=clamp((time-.37)/.37),back=clamp((time-.81)/.29),reach=u*(1-back),from=socket(tailSocket,true),to=contact??targetSocket('center',true),bend=Math.min(r,room(from)/2,room(to)/2)
    const p={x:from.x+(to.x-from.x)*reach,y:from.y+(to.y-from.y)*reach+Math.sin(Math.PI*reach)*bend}
    const alpha=time>=.12&&time<1.19?Math.min(1,(time-.12)*7)*Math.min(1,(1.19-time)*7):0
    fitArt(hook,p,r*1.8);hook.rotation=.7*(1-u)-back*.45;hook.alpha=alpha
    hook.clear().moveTo(0,0).bezierCurveTo(-r*.3,-r*.08,-r*.26,-r*.78,-r*.88,-r*.64).bezierCurveTo(-r*1.18,-r*.25,-r*.65,r*.61,-r*.28,r*.44).quadraticCurveTo(-r*.56,r*.01,0,0).fill(0x8854aa)
      .moveTo(0,0).quadraticCurveTo(-r*.4,-r*.08,-r*.57,-r*.43).stroke({color:0xddb7e9,width:2,cap:'round'})
    tail.clear();tail.alpha=alpha;const bow=Math.min(bend*.7,Math.hypot(p.x-from.x,p.y-from.y)*.2),width=Math.min(r*.29,room(from)/3,room(p)/3)
    tail.moveTo(from.x,from.y).quadraticCurveTo((from.x+p.x)/2,(from.y+p.y)/2+bow,p.x,p.y).stroke({color:0x69428a,width:width*2,cap:'round'})
      .moveTo(from.x,from.y).quadraticCurveTo((from.x+p.x)/2,(from.y+p.y)/2+bow,p.x,p.y).stroke({color:0xb688ca,width:width*.55,cap:'round'})
    const age=time-.74,v=clamp(age/.57);splash.clear();splash.alpha=contact&&age>=0&&age<.57?(1-v)*.65:0
    if(contact){fitArt(splash,contact,r*1.6);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;splash.ellipse(Math.cos(a)*r*v*.5,Math.sin(a)*r*v*.5,r*(.2+v*.18),r*(.12+v*.14)).fill(i%2?0xb481d0:0x8051a4)}}
    drops.forEach(({g,a,speed})=>{const q=clamp(age/.68),d=contact?Math.max(0,Math.min(r*1.7,room(contact)-7)):0;g.alpha=contact&&age>=0&&age<.68?1-q:0;if(contact){g.position.set(contact.x+Math.cos(a)*d*q*speed*.7,contact.y+Math.sin(a)*d*q*speed*.55+d*q*q*.25);g.rotation=q*1.4;g.scale.set(Math.min(1,room(contact)/10)*(1-q*.35))}})
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:-9,y:2,rotation:.06}),duration:.22},0).to(attacker,{...pose,duration:.35,ease:'power2.in'},.37)
    .call(()=>{contact=targetSocket('center',true);update(.74);onCue({type:'impact'});defender.tint=0xc1a1d8},[],.74)
    .to(defender,{x:defenderHome.x+recoil*.85,duration:.06,repeat:1,yoyo:true},.74).call(()=>{defender.tint=0xffffff},[],.92)
    .to(attacker,{x:0,y:0,rotation:0,duration:.44,ease:'power2.inOut'},1.18)

}
