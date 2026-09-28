import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// A stored pearl sinks inward before a small fountain of recovery crosses.
export default function swallow(context) {
  const {tl,onFrame,onCue}=context
  const {temporary,socket,unit}=bindEffectSpace(context)
  const art=new Container();art.label='swallow-recovery';art.alpha=0;temporary.addChild(art)
  const pearl=new Graphics().circle(0,0,15).fill({color:0xe6deb2,alpha:.24}).circle(-3,-3,8).fill(0xf4e8ba).circle(-5,-5,2.5).fill(0xfff9da);pearl.label='swallow-pearl';art.addChild(pearl)
  const arcs=Array.from({length:3},()=>{const g=new Graphics().ellipse(0,0,36,13).stroke({color:0xc8e9bb,width:1.6,alpha:.7});art.addChild(g);return g})
  const crosses=Array.from({length:12},(_,i)=>{const g=new Graphics().poly([-2,-7,2,-7,2,-2,7,-2,7,2,2,2,2,7,-2,7,-2,2,-7,2,-7,-2,-2,-2]).fill(i%2?0xb5e6bb:0xe5f6cc);g.label='swallow-cross';art.addChild(g);return g})
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  function update(time){const p=socket('visualCenter',true),room=Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-3)
    art.position.copyFrom(p);art.scale.set(Math.min(1,room/104))
    const u=Math.max(0,Math.min(1,(time-.12)/.74));pearl.position.set(Math.sin(u*Math.PI)*15,-63*(1-u));pearl.scale.set(1-u*.82);pearl.alpha=time<.9?1:Math.max(0,1-(time-.9)/.12)
    arcs.forEach((g,i)=>{const age=time-.48-i*.12,v=Math.max(0,Math.min(1,age/.62));g.y=22-v*42;g.scale.set(.35+v*.95);g.alpha=age>=0&&age<=.62?Math.sin(Math.PI*v)*.65:0})
    crosses.forEach((g,i)=>{const age=time-.78-i*.06,v=Math.max(0,Math.min(1,age/.8));g.position.set(Math.sin(i*2.4)*48+Math.sin(time*2+i)*4,36-v*111);g.scale.set(.55+(i%3)*.12);g.alpha=age>=0&&age<.8?Math.sin(Math.PI*v)*.9:0})
  }
  onFrame(update)
  tl.to(art,{alpha:1,duration:.2},.04).to(art,{alpha:0,duration:.38},1.8).call(()=>{update(.9);onCue({type:'impact'})},[],.9)
}
