import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function attract(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const hearts=Array.from({length:5},(_,i)=>{const g=new Graphics().moveTo(0,7).bezierCurveTo(-13,-1,-7,-12,0,-5).bezierCurveTo(7,-12,13,-1,0,7).fill(i%2?0xf4a9cf:0xffc4d9);g.label=`attract-heart-${i}`;g.alpha=0;temporary.addChild(g);return g})
  const orbit=new Container();orbit.label='attract-orbit';orbit.alpha=0;temporary.addChild(orbit)
  const tiny=Array.from({length:6},(_,i)=>{const g=new Graphics().moveTo(0,5).bezierCurveTo(-9,-1,-4,-8,0,-3).bezierCurveTo(4,-8,9,-1,0,5).fill(i%2?0xeec5ec:0xffc9df);orbit.addChild(g);return g})
  const r=Math.min(47,Math.max(30,context.target.metrics.height/unit*.23))
  function update(time){
    const from=socket('aura',true),to=targetSocket('center',true),bow=Math.min(32,room(from)/2,room(to)/2)
    hearts.forEach((g,i)=>{const age=time-.2-i*.13,u=clamp(age/.72),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u+Math.sin(Math.PI*u)*Math.sin(i*1.8+u*4)*bow};fit(g,p,15);g.rotation=Math.sin(time*4+i)*.12;g.alpha=age>=0&&age<1?Math.min(1,age*12)*Math.min(1,(1-age)*5):0})
    fit(orbit,to,r*1.4);tiny.forEach((g,i)=>{const a=time*1.5+i*Math.PI/3;g.position.set(Math.cos(a)*r*.9,Math.sin(a)*r*.5);g.scale.set((.65+(Math.sin(a)+1)*.13)*r/47);g.alpha=.55+Math.sin(time*4+i)**2*.4})
  }
  onFrame(update)
  tl.to(orbit,{alpha:1,duration:.28},.84).to(orbit,{alpha:0,duration:.42},1.98).call(()=>{update(.92);onCue({type:'impact'})},[],.92)

}
