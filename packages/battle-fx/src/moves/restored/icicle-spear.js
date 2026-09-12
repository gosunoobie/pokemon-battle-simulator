import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function icicleSpear(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('emission') ? 'emission' : 'emission'
  const r = Math.min(15, Math.max(9, context.target.metrics.height / unit * .064))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const spears=[],shards=[]
  for(let i=0;i<3;i++){
    const spear=new Graphics().poly([0,0,-r*2.1,-r*.35,-r*3,-r*.13,-r*2.65,r*.27,-r*1.8,r*.33]).fill(0x99d5e9)
      .poly([0,0,-r*2.1,-r*.35,-r*3,-r*.13,-r*1.6,0]).fill(0xe5faff)
      .poly([0,0,-r*1.6,0,-r*2.65,r*.27,-r*1.8,r*.33]).fill(0x6aadc9)
    spear.label=`icicle-spear-shot-${i}`;spear.alpha=0;temporary.addChild(spear)
    const frost=new Graphics().circle(0,0,r*.9).stroke({color:0xcdf6ff,width:2,alpha:.8});frost.label=`icicle-spear-impact-${i}`;frost.alpha=0;temporary.addChild(frost)
    const mist=new Graphics();mist.alpha=0;temporary.addChildAt(mist,0)
    const p={spear,frost,mist,start:.34+i*.2,flight:.5,lane:[-.4,.6,0][i]*r,from:null,impact:null};spears.push(p)
    for(let j=0;j<12;j++){const g=new Graphics().poly([0,-5,2,0,0,4,-2,0]).fill(j%2?0xdffaff:0x8cc7df);g.alpha=0;temporary.addChild(g);shards.push({g,p,a:random()*Math.PI*2,v:45+random()*90,life:.31+random()*.16})}
    const at=p.start+p.flight
    tl.call(()=>{p.from=socket(attachment,true);update(p.start)},[],p.start)
      .to(frost,{alpha:.9,duration:.03},at).to(frost.scale,{x:1.45,y:1.45,duration:.23},at).to(frost,{alpha:0,duration:.21},at+.06)
      .call(()=>{p.impact=endPoint(p);update(at);if(i===2)onCue({type:'impact'});defender.tint=0xc3ecf6},[],at)
      .to(defender,{x:defenderHome.x+Math.min(6,recoil),duration:.055,repeat:1,yoyo:true},at)
  }
  function endPoint(p){const b=targetSocket('center',true),c=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',true),half=context.target.metrics.height/(2*unit);return{x:b.x,y:Math.max(c.y-half,Math.min(c.y+half,b.y+p.lane))}}
  function update(time){for(const p of spears){const age=time-p.start,u=Math.max(0,Math.min(1,age/p.flight)),a=p.from??socket(attachment,true),b=p.impact??endPoint(p),bow=Math.min(r*1.55,Math.max(0,Math.min(a.y,b.y)-top-r*3))
    p.spear.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u-Math.sin(Math.PI*u)*bow);p.spear.rotation=Math.atan2(b.y-a.y-Math.cos(Math.PI*u)*Math.PI*bow,b.x-a.x)
    p.spear.alpha=age>=0&&age<=p.flight+.04?Math.min(1,age/.025)*Math.max(0,1-Math.max(0,age-p.flight)/.04):0;p.frost.position.copyFrom(b);p.mist.clear();p.mist.alpha=age>0&&age<p.flight?.3:0
    const len=Math.min(r*4,Math.hypot(p.spear.x-a.x,p.spear.y-a.y));p.mist.moveTo(p.spear.x-Math.cos(p.spear.rotation)*len,p.spear.y-Math.sin(p.spear.rotation)*len).lineTo(p.spear.x,p.spear.y).stroke({color:0xc9eff8,width:3,cap:'round'})
    }for(const q of shards){const age=time-q.p.start-q.p.flight,t=age/q.life,p=q.p.impact;q.g.alpha=p&&t>=0&&t<1?Math.sin(t*Math.PI)*.85:0;if(p&&age>=0){q.g.position.set(p.x+Math.cos(q.a)*q.v*age,p.y+Math.sin(q.a)*q.v*age+75*age*age);q.g.rotation=q.a+age*4}}}
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.2},0).to(attacker,{x:home.x+thrust,duration:.12},.2)
    .to(attacker,{x:home.x,duration:.4},.8).call(()=>{defender.tint=0xffffff},[],1.41)

}
