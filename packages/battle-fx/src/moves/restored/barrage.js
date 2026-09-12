import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function barrage(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('emission') ? 'emission' : 'emission'
  const r = Math.min(16, Math.max(11, context.target.metrics.height / unit * .071))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const shots=[],chips=[]
  for(let i=0;i<5;i++){
    const nut=new Graphics().circle(0,0,r).fill(i%2?0xbfa476:0xcbb68c).stroke({color:0x7e7155,width:1.6})
      .moveTo(-r*.6,-r*.78).quadraticCurveTo(r*.15,0,-r*.6,r*.78).moveTo(r*.45,-r*.85).quadraticCurveTo(-r*.25,0,r*.45,r*.85).stroke({color:0x8e7958,width:1.8})
      .ellipse(-r*.22,-r*.34,r*.17,r*.1).fill(0xe5d3ac)
    nut.label=`barrage-shot-${i}`;nut.alpha=0;temporary.addChild(nut)
    const pop=new Graphics().poly([0,-r*1.3,r*.26,-r*.4,r*1.3,-r*.23,r*.45,r*.2,r*.75,r*1.15,0,r*.55,-r*.9,r,-r*.52,r*.13,-r*1.2,-r*.52,-r*.35,-r*.38]).fill({color:0xead2a1,alpha:.75})
    pop.label=`barrage-impact-${i}`;pop.alpha=0;temporary.addChild(pop)
    const p={nut,pop,start:.27+i*.13,flight:.42+(i%2)*.03,lane:[0,-.6,.5,-.25,.25][i]*r,bow:r*(1.5+(i%3)*.7),from:null,impact:null};shots.push(p)
    for(let j=0;j<8;j++){const g=new Graphics().poly([-2,-1,3,-2,2,2,-1,2]).fill(j%2?0xc3a67b:0xe3cfa6);g.alpha=0;temporary.addChild(g);chips.push({g,p,a:random()*Math.PI*2,v:45+random()*70,life:.22+random()*.17})}
    const at=p.start+p.flight
    tl.call(()=>{p.from=socket(attachment,true);update(p.start)},[],p.start).to(pop,{alpha:1,duration:.025},at).to(pop.scale,{x:1.4,y:1.4,duration:.16},at).to(pop,{alpha:0,duration:.19},at+.045)
      .call(()=>{p.impact=endPoint(p);update(at);if(i===4)onCue({type:'impact'});defender.tint=0xe4cda5},[],at)
      .to(defender,{x:defenderHome.x+Math.min(5,recoil),duration:.035,repeat:1,yoyo:true},at)
  }
  function endPoint(p){const b=targetSocket('center',true),c=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',true),half=context.target.metrics.height/(2*unit);return{x:b.x,y:Math.max(c.y-half,Math.min(c.y+half,b.y+p.lane))}}
  function update(time){for(const p of shots){const age=time-p.start,u=Math.max(0,Math.min(1,age/p.flight)),a=p.from??socket(attachment,true),b=p.impact??endPoint(p),rise=Math.min(p.bow,Math.max(0,Math.min(a.y,b.y)-top-r*1.2))
    p.nut.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u-4*rise*u*(1-u));p.nut.rotation=age*(p.start>.5?-7:7)
    p.nut.alpha=age>=0&&age<=p.flight+.035?Math.min(1,age/.02)*Math.max(0,1-Math.max(0,age-p.flight)/.035):0;p.pop.position.copyFrom(b)
    }for(const q of chips){const age=time-q.p.start-q.p.flight,t=age/q.life,p=q.p.impact;q.g.alpha=p&&t>=0&&t<1?Math.sin(t*Math.PI)*.9:0;if(p&&age>=0){q.g.position.set(p.x+Math.cos(q.a)*q.v*age,p.y+Math.sin(q.a)*q.v*age+55*age*age);q.g.rotation=age*8}}}
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.14},0).to(attacker,{x:home.x+thrust,duration:.1},.14)
    .to(attacker,{x:home.x,duration:.36},.85).call(()=>{defender.tint=0xffffff},[],1.37)

}
