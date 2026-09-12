import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function bulletSeed(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('emission') ? 'emission' : 'emission'
  const r = Math.min(10, Math.max(6, context.target.metrics.height / unit * .044))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const shots=[],flecks=[]
  for(let i=0;i<5;i++){
    const seed=new Graphics().ellipse(0,0,r,r*.62).fill(0x9daa42).stroke({color:0xd8dd80,width:1.2})
      .moveTo(-r*.65,0).quadraticCurveTo(0,-r*.19,r*.67,0).stroke({color:0x616d2b,width:1.3})
    seed.label=`bullet-seed-shot-${i}`;seed.alpha=0;temporary.addChild(seed)
    const trail=new Graphics();trail.alpha=0;temporary.addChildAt(trail,0)
    const hit=new Graphics().ellipse(0,0,r*1.6,r*.92).stroke({color:0xd4de85,width:2});hit.label=`bullet-seed-impact-${i}`;hit.alpha=0;temporary.addChild(hit)
    const p={seed,trail,hit,start:.25+i*.105,flight:.36,lane:[0,-.7,.6,-.3,.3][i]*r,from:null,impact:null};shots.push(p)
    for(let j=0;j<7;j++){const g=new Graphics().poly([-2,-1,3,0,-1,2]).fill(j%2?0xc4c979:0x7f963d);g.alpha=0;temporary.addChild(g);flecks.push({g,p,a:random()*Math.PI*2,v:35+random()*55,life:.23+random()*.14})}
    const at=p.start+p.flight
    tl.call(()=>{p.from=socket(attachment,true);update(p.start)},[],p.start)
      .to(hit,{alpha:.9,duration:.025},at).to(hit.scale,{x:1.5,y:1.4,duration:.2},at).to(hit,{alpha:0,duration:.17},at+.05)
      .call(()=>{p.impact=destination(p);update(at);if(i===4)onCue({type:'impact'});defender.tint=0xd8df9a},[],at)
      .to(defender,{x:defenderHome.x+Math.min(4,recoil),duration:.035,repeat:1,yoyo:true},at)
  }
  function destination(p){const b=targetSocket('center',true),c=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',true),half=context.target.metrics.height/(2*unit);return{x:b.x,y:Math.max(c.y-half,Math.min(c.y+half,b.y+p.lane))}}
  function update(time){
    for(const p of shots){const age=time-p.start,u=Math.max(0,Math.min(1,age/p.flight)),from=p.from??socket(attachment,true),end=p.impact??destination(p)
      p.seed.position.set(from.x+(end.x-from.x)*u,from.y+(end.y-from.y)*u);p.seed.rotation=Math.atan2(end.y-from.y,end.x-from.x)
      p.seed.alpha=age>=0&&age<=p.flight+.035?Math.min(1,age/.016)*Math.max(0,1-Math.max(0,age-p.flight)/.035):0
      p.trail.clear();p.trail.alpha=age>0&&age<p.flight?.52:0
      const a=p.seed.rotation,len=Math.min(r*2.4,Math.hypot(p.seed.x-from.x,p.seed.y-from.y));p.trail.moveTo(p.seed.x-Math.cos(a)*len,p.seed.y-Math.sin(a)*len).lineTo(p.seed.x,p.seed.y).stroke({color:0xb3c567,width:1.7})
      p.hit.position.copyFrom(end)
    }
    for(const q of flecks){const age=time-q.p.start-q.p.flight,t=age/q.life,at=q.p.impact;q.g.alpha=at&&t>=0&&t<1?Math.sin(t*Math.PI)*.85:0;if(at&&age>=0){q.g.position.set(at.x+Math.cos(q.a)*q.v*age,at.y+Math.sin(q.a)*q.v*age+45*age*age);q.g.rotation=q.a+age*3}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.13},0).to(attacker,{x:home.x+thrust,duration:.1},.13)
    .to(attacker,{x:home.x,duration:.3},.72).call(()=>{defender.tint=0xffffff},[],1.17)

}
