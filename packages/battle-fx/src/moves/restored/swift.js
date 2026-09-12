import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function swift(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('emission') ? 'emission' : 'emission'
  const r = Math.min(16, Math.max(10, context.target.metrics.height / unit * .071))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const stars=[],glints=[]
  for(let i=0;i<5;i++){
    const points=[];for(let j=0;j<10;j++){const a=-Math.PI/2+j*Math.PI/5,d=r*(j%2?.43:1);points.push(Math.cos(a)*d,Math.sin(a)*d)}
    const star=new Graphics().poly(points).fill(0xf7d568).stroke({color:0xfff2b9,width:1.4,join:'round'}).circle(-r*.16,-r*.15,r*.16).fill(0xfff5c8)
    star.label=`swift-shot-${i}`;star.alpha=0;temporary.addChild(star)
    const trail=new Graphics();trail.alpha=0;temporary.addChildAt(trail,0)
    const flash=new Graphics().poly([0,-r*.9,r*.13,-r*.13,r*.9,0,r*.13,r*.13,0,r*.9,-r*.13,r*.13,-r*.9,0,-r*.13,-r*.13]).fill(0xffedaf)
    flash.label=`swift-impact-${i}`;flash.alpha=0;temporary.addChild(flash)
    const p={star,trail,flash,start:.32+i*.085,flight:.62,bow:(i%2?-1:1)*r*(2.5+i*.5),lane:[0,-.4,.4,-.2,.2][i]*r,from:null,impact:null};stars.push(p)
    for(let j=0;j<6;j++){const g=new Graphics().poly([0,-3,1,0,0,3,-1,0]).fill(j%2?0xfff1b5:0xdabd6d);g.alpha=0;temporary.addChild(g);glints.push({g,p,a:random()*Math.PI*2,v:30+random()*70,life:.25+random()*.2})}
    const at=p.start+p.flight
    tl.call(()=>{p.from=socket(attachment,true);update(p.start)},[],p.start).to(flash,{alpha:1,duration:.025},at).to(flash,{alpha:0,duration:.23},at+.055)
      .call(()=>{p.impact=endPoint(p);update(at);if(i===4)onCue({type:'impact'});defender.tint=0xffe8a1},[],at)
      .to(defender,{x:defenderHome.x+Math.min(4,recoil),duration:.032,repeat:1,yoyo:true},at)
  }
  function endPoint(p){const b=targetSocket('center',true),c=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',true),half=context.target.metrics.height/(2*unit);return{x:b.x,y:Math.max(c.y-half,Math.min(c.y+half,b.y+p.lane))}}
  function route(p,u,a,b){const margin=Math.max(0,Math.min(Math.min(a.y,b.y)-top,bottom-Math.max(a.y,b.y))-r*1.6),bow=Math.max(-margin,Math.min(margin,p.bow));return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u+Math.sin(Math.PI*u)*bow*(1-u*.25)}}
  function update(time){for(const p of stars){const age=time-p.start,u=Math.max(0,Math.min(1,age/p.flight)),a=p.from??socket(attachment,true),b=p.impact??endPoint(p),pos=route(p,u,a,b)
    p.star.position.copyFrom(pos);p.star.rotation=age*7;p.star.alpha=age>=0&&age<=p.flight+.06?Math.min(1,age/.03)*Math.max(0,1-Math.max(0,age-p.flight)/.06):0;p.flash.position.copyFrom(b)
    p.trail.clear();p.trail.alpha=age>0&&age<p.flight?.6:0;for(let j=0;j<=12;j++){const t=Math.max(0,u-.2)+j/12*Math.min(u,.2),q=route(p,t,a,b);j?p.trail.lineTo(q.x,q.y):p.trail.moveTo(q.x,q.y)}p.trail.stroke({color:0xe4c56e,width:2,cap:'round'})
    }for(const q of glints){const age=time-q.p.start-q.p.flight,t=age/q.life,p=q.p.impact;q.g.alpha=p&&t>=0&&t<1?Math.sin(t*Math.PI)*.8:0;if(p&&age>=0){q.g.position.set(p.x+Math.cos(q.a)*q.v*age,p.y+Math.sin(q.a)*q.v*age);q.g.rotation=age*4}}}
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.19},0).to(attacker,{x:home.x+thrust,duration:.11},.19)
    .to(attacker,{x:home.x,duration:.37},.72).call(()=>{defender.tint=0xffffff},[],1.43)

}
