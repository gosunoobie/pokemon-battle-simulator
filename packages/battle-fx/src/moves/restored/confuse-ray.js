import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function confuseRay(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, attacker, defender, home, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('eyes')?'eyes':'emission'
  const r=Math.min(42,Math.max(24,context.target.metrics.height/unit*.2)),width=Math.min(18,Math.max(10,context.target.metrics.height/unit*.075))
  const source=new Graphics().circle(0,0,6).fill(0xffe6a2).circle(0,0,3).fill(0xfff6d5);source.label='confuse-ray-source';source.alpha=0;temporary.addChild(source)
  const ray=new Graphics();ray.label='confuse-ray-ribbon';ray.alpha=0;temporary.addChild(ray)
  const head=new Container();head.label='confuse-ray-head';head.alpha=0;temporary.addChild(head)
  head.addChild(new Graphics().circle(0,0,8).fill({color:0xc4a0db,alpha:.35}).circle(0,0,5).fill(0xffdea0).circle(0,0,2.4).fill(0xfff8d9))
  const halo=new Container();halo.label='confuse-ray-halo';halo.alpha=0;temporary.addChild(halo)
  const spiral=new Graphics();halo.addChild(spiral)
  const sparks=Array.from({length:7},(_,i)=>{const g=new Graphics().poly([0,-3,1.2,-1,3,0,1.2,1,0,3,-1.2,1,-3,0,-1.2,-1]).fill(i%2?0xe4c28b:0xc5a0e1);halo.addChild(g);return g})
  const draw={progress:0}
  const update=time=>{
    const from=socket(attachment,true),to=targetSocket('center',true),dx=to.x-from.x,dy=to.y-from.y,length=Math.max(1,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length
    source.position.copyFrom(from);ray.clear()
    for(let lane=0;lane<2;lane++){
      for(let i=0;i<=40;i++){const u=i/40*draw.progress,offset=Math.sin(u*Math.PI)*Math.sin(u*Math.PI*4-time*8+lane*Math.PI)*width
        const x=from.x+dx*u+nx*offset,y=from.y+dy*u+ny*offset;i?ray.lineTo(x,y):ray.moveTo(x,y)}
      ray.stroke({color:lane?0xf5d58d:0xc5a0e0,width:lane?2.8:4.2,alpha:lane?.9:.45,cap:'round',join:'round'})
    }
    const u=draw.progress,offset=Math.sin(u*Math.PI)*Math.sin(u*Math.PI*4-time*8)*width
    head.position.set(from.x+dx*u+nx*offset,from.y+dy*u+ny*offset)
    halo.position.copyFrom(to);spiral.clear()
    for(let lane=0;lane<2;lane++){
      for(let i=0;i<=44;i++){const u=i/44,a=u*Math.PI*3.2+time*2.3+lane*Math.PI,rad=r*(.12+u*.8),x=Math.cos(a)*rad,y=Math.sin(a)*rad*.68;i?spiral.lineTo(x,y):spiral.moveTo(x,y)}
      spiral.stroke({color:lane?0xdab7e6:0xf0d29a,width:1.7,alpha:.7,cap:'round'})
    }
    sparks.forEach((g,i)=>{const a=i*Math.PI*2/7-time*2.1;g.position.set(Math.cos(a)*r*.92,Math.sin(a)*r*.63);g.rotation=time+i;g.alpha=.5+Math.sin(time*6+i)*.3})
  }
  onFrame(update)
  tl.to(attacker,{x:home.x+3,rotation:.013,duration:.2},0).to(attacker,{x:home.x,rotation:0,duration:.35},1.2)
    .to(source,{alpha:1,duration:.13},.12).to(source,{alpha:0,duration:.24},1.02)
    .to(ray,{alpha:.85,duration:.1},.26).to(draw,{progress:1,duration:.72,ease:'none'},.26).to(ray,{alpha:0,duration:.22},1.04)
    .to(head,{alpha:1,duration:.1},.26).to(head,{alpha:0,duration:.25},1.01)
    .to(halo,{alpha:.95,duration:.2},.98).fromTo(halo.scale,{x:.35,y:.35},{x:1,y:1,duration:.35},.98)
    .to(halo,{alpha:0,duration:.45},1.65)
    .call(()=>{update(.98);onCue({type:'impact'});defender.tint=0xe5c6a2},[],.98).call(()=>{defender.tint=0xffffff},[],1.22)
}
