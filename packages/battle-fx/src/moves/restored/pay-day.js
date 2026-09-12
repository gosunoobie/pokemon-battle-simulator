import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function payDay(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('coin') ? 'coin' : 'emission'
  const r = Math.min(16, Math.max(10, context.target.metrics.height / unit * .07))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const coins=[],sparks=[]
  for(let i=0;i<3;i++){
    const coin=new Container();coin.label=`pay-day-shot-${i}`;coin.alpha=0;temporary.addChild(coin)
    coin.addChild(new Graphics().circle(0,0,r).fill(0xd5a846).stroke({color:0xffe8a0,width:1.6}).circle(0,0,r*.73).stroke({color:0xa77732,width:1.5})
      .poly([0,-r*.43,r*.27,0,0,r*.43,-r*.27,0]).fill(0xffdd7d).moveTo(-r*.62,-r*.36).quadraticCurveTo(-r*.56,-r*.65,-r*.19,-r*.7).stroke({color:0xfff0b5,width:1.6,cap:'round'}))
    const ping=new Graphics().poly([0,-r*.8,r*.1,-r*.1,r*.8,0,r*.1,r*.1,0,r*.8,-r*.1,r*.1,-r*.8,0,-r*.1,-r*.1]).fill(0xffecad)
    ping.label=`pay-day-impact-${i}`;ping.alpha=0;temporary.addChild(ping)
    const p={coin,ping,start:.32+i*.15,flight:.58,lane:[-.6,0,.6][i]*r,from:null,impact:null};coins.push(p)
    for(let j=0;j<7;j++){const g=new Graphics().moveTo(-2,0).lineTo(3,0).stroke({color:j%2?0xffedb0:0xd6ad58,width:1.6});g.alpha=0;temporary.addChild(g);sparks.push({g,p,a:random()*Math.PI*2,v:40+random()*65,life:.23+random()*.15})}
    const at=p.start+p.flight
    tl.call(()=>{p.from=socket(attachment,true);update(p.start)},[],p.start)
      .to(ping,{alpha:1,duration:.025},at).to(ping,{alpha:0,duration:.23},at+.05)
      .call(()=>{p.impact=endPoint(p);update(at);if(i===2)onCue({type:'impact'});defender.tint=0xf0d394},[],at)
      .to(defender,{x:defenderHome.x+Math.min(5,recoil),duration:.045,repeat:1,yoyo:true},at)
  }
  function endPoint(p){const b=targetSocket('center',true),c=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',true),half=context.target.metrics.height/(2*unit);return{x:b.x,y:Math.max(c.y-half,Math.min(c.y+half,b.y+p.lane))}}
  function update(time){for(const p of coins){const age=time-p.start,u=Math.max(0,Math.min(1,age/p.flight)),a=p.from??socket(attachment,true),b=p.impact??endPoint(p),rise=Math.min(r*3.6,Math.max(0,Math.min(a.y,b.y)-top-r*1.3))
    p.coin.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u-4*rise*u*(1-u));p.coin.scale.x=.18+.82*Math.abs(Math.cos(age*14));p.coin.rotation=age*1.2
    p.coin.alpha=age>=0&&age<=p.flight+.06?Math.min(1,age/.02)*Math.max(0,1-Math.max(0,age-p.flight)/.06):0;p.ping.position.copyFrom(b)
    }for(const q of sparks){const age=time-q.p.start-q.p.flight,t=age/q.life,p=q.p.impact;q.g.alpha=p&&t>=0&&t<1?Math.sin(t*Math.PI)*.85:0;if(p&&age>=0){q.g.position.set(p.x+Math.cos(q.a)*q.v*age,p.y+Math.sin(q.a)*q.v*age+38*age*age);q.g.rotation=q.a}}}
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.18},0).to(attacker,{x:home.x+thrust,duration:.12},.18)
    .to(attacker,{x:home.x,duration:.36},.69).call(()=>{defender.tint=0xffffff},[],1.36)

}
