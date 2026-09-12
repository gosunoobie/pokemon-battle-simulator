import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function wish(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(63,Math.max(39,context.source.metrics.height/unit*.29))
  const wishing=new Container();wishing.label='wish-cast';wishing.alpha=0;temporary.addChild(wishing)
  const star=new Graphics(),trail=new Graphics();wishing.addChild(trail,star)
  const sparks=Array.from({length:9},(_,i)=>{const g=new Graphics().poly([0,-3,1,0,0,3,-1,0]).fill(i%2?0xf5dfab:0xd9d5f3);g.alpha=0;wishing.addChild(g);return g})
  function update(time){
    fit(wishing,socket('aura',true),r*1.65);star.clear();trail.clear()
    const trace=clamp((time-.12)/.68),rise=clamp((time-.8)/1.05),cy=-r*(.15+rise*.72),rad=r*.25
    const points=Array.from({length:11},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,rr=i%2?rad*.43:rad;return{x:Math.cos(a)*rr,y:Math.sin(a)*rr}})
    star.position.set(0,cy);star.moveTo(points[0].x,points[0].y)
    for(let i=1;i<=10;i++){const part=clamp(trace*10-(i-1));if(!part)break;star.lineTo(points[i-1].x+(points[i].x-points[i-1].x)*part,points[i-1].y+(points[i].y-points[i-1].y)*part)}
    star.stroke({color:0xffe6a9,width:2.2,alpha:.9,cap:'round',join:'round'})
    if(trace===1)star.poly(points.slice(0,10).flatMap(p=>[p.x*.75,p.y*.75])).fill({color:0xfff0c1,alpha:.22})
    for(let i=0;i<7;i++){const u=i/7;trail.circle(Math.sin(u*Math.PI)*r*.12,-r*.15+(cy+r*.15)*u,1.3).fill({color:0xe9def1,alpha:rise*(.2+u*.35)})}
    sparks.forEach((g,i)=>{const age=time-1-i*.08,u=clamp(age/.7);g.position.set(Math.sin(i*2.4)*r*u*.56,cy+r*.22+u*r*.42);g.rotation=u*.4;g.scale.set(r/63);g.alpha=age>=0&&age<.7?Math.sin(Math.PI*u)*.65:0})
  }
  onFrame(update)
  tl.to(wishing,{alpha:1,duration:.25},.08).to(wishing,{alpha:0,duration:.45},1.98).call(()=>{update(1);onCue({type:'impact'})},[],1)

}
