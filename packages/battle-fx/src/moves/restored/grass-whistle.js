import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function grassWhistle(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const leaf=new Graphics();leaf.label='grass-whistle-leaf';leaf.alpha=0;temporary.addChild(leaf)
  const ripples=Array.from({length:5},(_,i)=>{const g=new Graphics();g.label=`grass-whistle-pulse-${i}`;g.alpha=0;temporary.addChild(g);return g})
  const drift=new Container();drift.label='grass-whistle-drift';drift.alpha=0;temporary.addChild(drift)
  const seeds=Array.from({length:10},(_,i)=>{const g=new Graphics().ellipse(0,0,3.5,1.7).fill(i%2?0xd6eba6:0x9ed7a6);drift.addChild(g);return g})
  const r=Math.min(46,Math.max(29,context.target.metrics.height/unit*.23))
  function update(time){
    const from=socket('emission',true),to=targetSocket('center',true)
    fit(leaf,from,30);leaf.rotation=Math.sin(time*9)*.06
    leaf.clear().moveTo(-18,5).quadraticCurveTo(0,-22,24,-6).quadraticCurveTo(5,13,-18,5).fill(0x70b982).moveTo(-16,5).quadraticCurveTo(4,-5,22,-6).stroke({color:0xd6ed9e,width:1.2})
    ripples.forEach((g,i)=>{const age=time-.28-i*.15,u=clamp(age/.6),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u-Math.sin(Math.PI*u)*Math.min(17,room(from)/3,room(to)/3)}
      fit(g,p,24);g.rotation=Math.atan2(to.y-from.y,to.x-from.x);g.clear().ellipse(0,0,5+u*4,10+u*9).stroke({color:i%2?0xe4f2b6:0xa3d7a3,width:1.7,alpha:.85});g.alpha=age>=0&&age<.85?Math.min(1,age*12)*Math.min(1,(.85-age)*6):0})
    fit(drift,to,r*1.4)
    seeds.forEach((g,i)=>{const a=i*Math.PI/5+time*.65;g.position.set(Math.cos(a)*r*.8,Math.sin(a)*r*.5+Math.sin(time*2+i)*r*.15);g.rotation=a;g.alpha=.3+Math.sin(time*4+i)**2*.5})
  }
  onFrame(update)
  tl.to(leaf,{alpha:1,duration:.16},.06).to(leaf,{alpha:0,duration:.3},1.24)
    .to(drift,{alpha:1,duration:.3},.8).to(drift,{alpha:0,duration:.45},1.9)
    .call(()=>{update(.88);onCue({type:'impact'})},[],.88)

}
