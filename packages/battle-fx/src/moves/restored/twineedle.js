import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function twineedle(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('stinger') ? 'stinger' : 'emission'
  const r = Math.min(12, Math.max(8, context.target.metrics.height / unit * .053))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const pair=[],flecks=[]
  for(let i=0;i<2;i++){
    const needle=new Graphics().poly([0,0,-r*2.65,-r*.23,-r*3,-r*.08,-r*2.8,r*.27]).fill(0xc8b267)
      .poly([0,0,-r*2.65,-r*.23,-r*3,-r*.08]).fill(0xf4df91)
      .poly([-r*2.25,-r*.19,-r*2.7,-r*.49,-r*2.6,0,-r*2.7,r*.49,-r*2.25,r*.2]).fill(0xa9b273)
    needle.label=`twineedle-shot-${i}`;needle.alpha=0;temporary.addChild(needle)
    const impact=new Graphics().ellipse(0,0,r*.24,r*.65).stroke({color:0xe9d798,width:2.5});impact.label=`twineedle-impact-${i}`;impact.alpha=0;temporary.addChild(impact)
    const path=new Graphics();path.alpha=0;temporary.addChildAt(path,0)
    const p={needle,mark:impact,path,start:.28+i*.2,flight:.43,lane:(i?1:-1)*r*.5,bow:(i?1:-1)*r*2,from:null,impact:null};pair.push(p)
    for(let j=0;j<8;j++){const g=new Graphics().poly([0,-1.5,5,0,0,1.5]).fill(j%2?0xe7d28d:0xadb772);g.alpha=0;temporary.addChild(g);flecks.push({g,p,a:random()*Math.PI*2,v:35+random()*50,life:.24+random()*.18})}
    const at=p.start+p.flight
    tl.call(()=>{p.from=socket(attachment,true);update(p.start)},[],p.start)
      .to(impact,{alpha:1,duration:.025},at).to(impact.scale,{x:1.5,y:1.3,duration:.19},at).to(impact,{alpha:0,duration:.2},at+.04)
      .call(()=>{p.impact=endPoint(p);update(at);if(i===1)onCue({type:'impact'});defender.tint=0xe2d8a1},[],at)
      .to(defender,{x:defenderHome.x+Math.min(i?7:5,recoil),duration:.055,repeat:1,yoyo:true},at)
  }
  function endPoint(p){const b=targetSocket('center',true),c=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',true),half=context.target.metrics.height/(2*unit);return{x:b.x,y:Math.max(c.y-half,Math.min(c.y+half,b.y+p.lane))}}
  function update(time){for(const p of pair){const age=time-p.start,u=Math.max(0,Math.min(1,age/p.flight)),a=p.from??socket(attachment,true),b=p.impact??endPoint(p)
    const margin=Math.max(0,Math.min(Math.min(a.y,b.y)-top,bottom-Math.max(a.y,b.y))-r*3),bow=Math.max(-margin,Math.min(margin,p.bow))
    const bend=Math.sin(Math.PI*u*2)*bow;p.needle.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u+bend);p.needle.rotation=Math.atan2(b.y-a.y+2*Math.PI*Math.cos(Math.PI*u*2)*bow,b.x-a.x)
    p.needle.alpha=age>=0&&age<=p.flight+.05?Math.min(1,age/.02)*Math.max(0,1-Math.max(0,age-p.flight)/.05):0;p.mark.position.copyFrom(b)
    p.path.clear();p.path.alpha=age>0&&age<p.flight?.45:0;for(let j=0;j<=8;j++){const t=Math.max(0,u-.15)+j/8*Math.min(.15,u),x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t+Math.sin(Math.PI*t*2)*bow;j?p.path.lineTo(x,y):p.path.moveTo(x,y)}p.path.stroke({color:0xd4cc8c,width:1.5})
    }for(const q of flecks){const age=time-q.p.start-q.p.flight,t=age/q.life,p=q.p.impact;q.g.alpha=p&&t>=0&&t<1?Math.sin(t*Math.PI)*.85:0;if(p&&age>=0){q.g.position.set(p.x+Math.cos(q.a)*q.v*age,p.y+Math.sin(q.a)*q.v*age+35*age*age);q.g.rotation=q.a}}}
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.14},0).to(attacker,{x:home.x+thrust,duration:.11},.14)
    .to(attacker,{x:home.x,duration:.34},.55).call(()=>{defender.tint=0xffffff},[],1.08)

}
