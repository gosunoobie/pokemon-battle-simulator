import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function cometPunch(context) {
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

  const hand=context.source.hasAnchor?.('fist')?'fist':'hand',r=Math.min(28,Math.max(18,h*.12)),times=[.56,.86,1.16],points=[]
  const pose=fitPose(solveContact(hand,0)),fist=new Container();fist.label='comet-punch-fist';fist.alpha=0;temporary.addChild(fist)
  const tail=new Graphics(),knuckles=new Graphics();fist.addChild(tail,knuckles)
  const impacts=times.map((_,i)=>{const g=new Graphics();g.label=`comet-punch-impact-${i}`;g.alpha=0;temporary.addChild(g);return g})
  const stars=times.flatMap((at,i)=>Array.from({length:7},(_,j)=>{const g=new Graphics().poly([0,-3,1,-1,3,0,1,1,0,3,-1,1,-3,0,-1,-1]).fill(j%2?0xffd89b:0xf4b174);g.alpha=0;temporary.addChild(g);return{g,at,i,a:j*Math.PI*2/7}}))
  function update(time){
    fitActor();const i=Math.min(2,Math.max(0,Math.floor((time-.42)/.3))),at=times[i],punch=time<=at?clamp((time-at+.14)/.14):1-clamp((time-at)/.13),from=socket(hand,true),to=points[i]??targetSocket('center',true)
    const p={x:from.x+(to.x-from.x)*punch,y:from.y+(to.y-from.y)*punch};fitArt(fist,p,r*2.7);fist.alpha=time>=.31&&time<1.4?Math.min(1,(time-.31)*12)*Math.min(1,(1.4-time)*8):0
    tail.clear();knuckles.clear()
    for(let lane=0;lane<3;lane++){const y=(lane-1)*r*.24;tail.moveTo(-r*(1.25+punch*.9),y).quadraticCurveTo(-r*.9,y+Math.sin(time*17+lane)*r*.09,-r*.55,y).stroke({color:lane===1?0xffd293:0xe8a363,width:lane===1?3:1.6,alpha:.7,cap:'round'})}
    knuckles.roundRect(-r*.95,-r*.5,r*.95,r,r*.22).fill(0xf1b57b).stroke({color:0xffe4b0,width:1.5})
    for(let j=0;j<3;j++)knuckles.moveTo(-r*.04,-r*.28+j*r*.27).lineTo(-r*.42,-r*.28+j*r*.27).stroke({color:0xba8255,width:1.3,cap:'round'})
    impacts.forEach((g,k)=>{const age=time-times[k],u=clamp(age/.35);g.clear();g.alpha=points[k]&&age>=0&&age<.35?1-u:0;if(!points[k])return;fitArt(g,points[k],r*1.8)
      for(let j=0;j<6;j++){const a=j*Math.PI/3,rad=r*(.5+u*.75);g.poly([Math.cos(a)*rad*.15,Math.sin(a)*rad*.15,Math.cos(a-.1)*rad,Math.sin(a-.1)*rad,Math.cos(a+.1)*rad,Math.sin(a+.1)*rad]).fill(j%2?0xffe7ac:0xf2b370)}})
    stars.forEach(p=>{const age=time-p.at,u=clamp(age/.45),at=points[p.i],d=at?Math.min(r*1.55,Math.max(0,room(at)-6)):0;p.g.alpha=at&&age>=0&&age<.45?Math.sin(Math.PI*u):0;if(at){p.g.position.set(at.x+Math.cos(p.a)*d*u,at.y+Math.sin(p.a)*d*u);p.g.rotation=u*2;p.g.scale.set(Math.min(1,room(at)/8))}})
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:-10,y:0,rotation:0}),duration:.18},0).to(attacker,{...pose,duration:.28,ease:'power3.in'},.26)
  times.forEach((at,i)=>{tl.call(()=>{points[i]=targetSocket('center',true);update(at);if(i===2)onCue({type:'impact'});defender.tint=0xf6cc9a},[],at)
    .to(defender,{x:defenderHome.x+recoil*.75,duration:.045,repeat:1,yoyo:true},at).call(()=>{defender.tint=0xffffff},[],at+.12)
    if(i<2)tl.to(attacker,{...fitPose({x:pose.x-8,y:pose.y,rotation:0}),duration:.11},at+.03).to(attacker,{...pose,duration:.16,ease:'power2.in'},at+.14)})
  tl.to(attacker,{x:0,y:0,rotation:0,duration:.45,ease:'power2.inOut'},1.4)

}
