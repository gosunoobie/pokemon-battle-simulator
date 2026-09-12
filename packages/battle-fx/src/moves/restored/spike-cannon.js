import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function spikeCannon(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('spike') ? 'spike' : 'emission'
  const r = Math.min(15, Math.max(9, context.target.metrics.height / unit * .064))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const shots=[],fragments=[]
  for(let i=0;i<3;i++){
    const cone=new Graphics().poly([0,0,-r*2.1,-r*.42,-r*2.48,0,-r*2.1,r*.42]).fill(0xded9c6)
      .poly([0,0,-r*2.1,-r*.42,-r*2.48,0]).fill(0xfff6df).moveTo(-r*2.16,r*.17).lineTo(-r*.2,0).stroke({color:0x9d9c91,width:1.3})
    cone.label=`spike-cannon-shot-${i}`;cone.alpha=0;temporary.addChild(cone)
    const muzzle=new Graphics().ellipse(0,0,r*.37,r*.85).stroke({color:0xe9e6d6,width:2.5});muzzle.alpha=0;temporary.addChild(muzzle)
    const ring=new Graphics().ellipse(0,0,r*.42,r).stroke({color:0xf5ecce,width:2.7});ring.label=`spike-cannon-impact-${i}`;ring.alpha=0;temporary.addChild(ring)
    const p={cone,muzzle,ring,start:.28+i*.19,flight:.31,lane:[0,-.5,.5][i]*r,from:null,impact:null};shots.push(p)
    for(let j=0;j<8;j++){const g=new Graphics().poly([0,-1.5,6,0,0,1.5]).fill(j%2?0xc8c4b6:0xf4e8c8);g.alpha=0;temporary.addChild(g);fragments.push({g,p,a:(random()-.5)*3,v:60+random()*70,life:.27+random()*.15})}
    const at=p.start+p.flight
    tl.call(()=>{p.from=socket(attachment,true);muzzle.position.copyFrom(p.from);update(p.start)},[],p.start)
      .to(muzzle,{alpha:.7,duration:.025},p.start).to(muzzle.scale,{x:1.4,y:1.2,duration:.12},p.start).to(muzzle,{alpha:0,duration:.13},p.start+.04)
      .to(ring,{alpha:.9,duration:.025},at).to(ring.scale,{x:1.6,y:1.3,duration:.2},at).to(ring,{alpha:0,duration:.19},at+.04)
      .call(()=>{p.impact=endPoint(p);update(at);if(i===2)onCue({type:'impact'});defender.tint=0xe9e2cc},[],at)
      .to(defender,{x:defenderHome.x+Math.min(7,recoil),duration:.055,repeat:1,yoyo:true},at)
  }
  function endPoint(p){const b=targetSocket('center',true),c=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',true),half=context.target.metrics.height/(2*unit);return{x:b.x,y:Math.max(c.y-half,Math.min(c.y+half,b.y+p.lane))}}
  function update(time){for(const p of shots){const age=time-p.start,u=Math.max(0,Math.min(1,age/p.flight)),a=p.from??socket(attachment,true),b=p.impact??endPoint(p)
    p.cone.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u);p.cone.rotation=Math.atan2(b.y-a.y,b.x-a.x);p.cone.alpha=age>=0&&age<=p.flight+.045?Math.min(1,age/.015)*Math.max(0,1-Math.max(0,age-p.flight)/.045):0;p.ring.position.copyFrom(b)
    }for(const q of fragments){const age=time-q.p.start-q.p.flight,t=age/q.life,p=q.p.impact;q.g.alpha=p&&t>=0&&t<1?Math.sin(t*Math.PI)*.85:0;if(p&&age>=0){q.g.position.set(p.x+Math.cos(q.a)*q.v*age,p.y+Math.sin(q.a)*q.v*age+35*age*age);q.g.rotation=q.a}}}
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.16},0).to(attacker,{x:home.x+thrust,duration:.1},.16)
    .to(attacker,{x:home.x,duration:.35},.72).call(()=>{defender.tint=0xffffff},[],1.15)

}
