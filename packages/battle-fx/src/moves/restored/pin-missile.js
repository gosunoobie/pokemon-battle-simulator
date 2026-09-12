import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function pinMissile(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('spike') ? 'spike' : 'emission'
  const r = Math.min(12, Math.max(7, context.target.metrics.height / unit * .052))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(8, right - receiver.x - context.target.metrics.width / (2 * unit)))

  const missiles=[],chips=[]
  for(let i=0;i<4;i++){
    const pin=new Graphics().poly([0,0,-r*2.65,-r*.23,-r*2.34,0,-r*2.65,r*.23]).fill(0xe5dab0)
      .poly([-r*1.85,0,-r*2.5,-r*.57,-r*2.28,0,-r*2.5,r*.57]).fill(0x899d66)
      .moveTo(-r*2.28,0).lineTo(-r*.25,0).stroke({color:0xffffdd,width:1.2})
    pin.label=`pin-missile-shot-${i}`;pin.alpha=0;temporary.addChild(pin)
    const flash=new Graphics().poly([-r*.65,0,-r*.12,-r*.12,0,-r*.8,r*.12,-r*.12,r*.65,0,r*.12,r*.12,0,r*.8,-r*.12,r*.12]).fill(0xe3ecc1)
    flash.label=`pin-missile-impact-${i}`;flash.alpha=0;temporary.addChild(flash)
    const trail=new Graphics();trail.alpha=0;temporary.addChildAt(trail,0)
    const p={pin,flash,trail,start:.3+i*.12,flight:.46,lane:(i-1.5)*r*.5,bow:(i-1.5)*r*1.9,from:null,impact:null};missiles.push(p)
    for(let j=0;j<6;j++){const g=new Graphics().moveTo(-3,0).lineTo(4,0).stroke({color:j%2?0xd6d4a8:0xa9bb7e,width:1.4});g.alpha=0;temporary.addChild(g);chips.push({g,p,a:random()*Math.PI*2,v:35+random()*50,life:.25+random()*.13})}
    const at=p.start+p.flight
    tl.call(()=>{p.from=socket(attachment,true);update(p.start)},[],p.start).to(flash,{alpha:1,duration:.025},at).to(flash,{alpha:0,duration:.23},at+.04)
      .call(()=>{p.impact=endPoint(p);update(at);if(i===3)onCue({type:'impact'});defender.tint=0xd6e2ac},[],at)
      .to(defender,{x:defenderHome.x+Math.min(5,recoil),duration:.04,repeat:1,yoyo:true},at)
  }
  function endPoint(p){const b=targetSocket('center',true),c=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',true),half=context.target.metrics.height/(2*unit);return{x:b.x,y:Math.max(c.y-half,Math.min(c.y+half,b.y+p.lane))}}
  function update(time){
    for(const p of missiles){const age=time-p.start,u=Math.max(0,Math.min(1,age/p.flight)),a=p.from??socket(attachment,true),b=p.impact??endPoint(p)
      const above=Math.max(0,Math.min(a.y,b.y)-top-r*3),below=Math.max(0,bottom-Math.max(a.y,b.y)-r*3),bow=Math.max(-above,Math.min(below,p.bow))
      p.pin.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u+Math.sin(Math.PI*u)*bow)
      p.pin.rotation=Math.atan2(b.y-a.y+Math.cos(Math.PI*u)*Math.PI*bow,b.x-a.x);p.pin.alpha=age>=0&&age<=p.flight+.05?Math.min(1,age/.02)*Math.max(0,1-Math.max(0,age-p.flight)/.05):0
      p.flash.position.copyFrom(b);p.trail.clear();p.trail.alpha=age>0&&age<p.flight?.4:0
      const len=Math.min(r*4,Math.hypot(p.pin.x-a.x,p.pin.y-a.y));p.trail.moveTo(p.pin.x-Math.cos(p.pin.rotation)*len,p.pin.y-Math.sin(p.pin.rotation)*len).lineTo(p.pin.x,p.pin.y).stroke({color:0xd3d6a0,width:1.2})
    }
    for(const q of chips){const age=time-q.p.start-q.p.flight,t=age/q.life,p=q.p.impact;q.g.alpha=p&&t>=0&&t<1?Math.sin(t*Math.PI)*.8:0;if(p&&age>=0){q.g.position.set(p.x+Math.cos(q.a)*q.v*age,p.y+Math.sin(q.a)*q.v*age+25*age*age);q.g.rotation=q.a}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.18},0).to(attacker,{x:home.x+thrust,duration:.1},.18)
    .to(attacker,{x:home.x,duration:.36},.72).call(()=>{defender.tint=0xffffff},[],1.27)

}
