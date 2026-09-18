import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

const tailAccents = [1.92, 2.17, 2.29, 2.41, 2.66]
export const timing = Object.freeze({ contact: .98, duration: 3.18, markers: [
  { id: 'ducks-start', label: 'Three confusion ducks begin circling', timeSeconds: 1.81 },
  ...tailAccents.map((timeSeconds, i) => ({ id: `duck-bob-${i + 1}`, label: `Duck bob at sound accent ${i + 1}`, timeSeconds })),
  { id: 'ducks-clear', label: 'Circling ducks finish their fade', timeSeconds: 3.18 },
] })

export default function confuseRay(context) {
  const { tl, onFrame, onCue, scene, layer } = context
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

  const a=temporary.toLocal({x:0,y:0},layer),b=temporary.toLocal({x:scene.width,y:scene.height},layer)
  const bounds={left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)}
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value))
  const duckSize=clamp(r/34,.78,1.12),duckExtent=25*duckSize
  const orbitX=Math.min(68,Math.max(34,context.target.metrics.width/unit*.28),(bounds.right-bounds.left)/2-duckExtent)
  const orbitY=Math.min(18,Math.max(10,orbitX*.25),(bounds.bottom-bounds.top)/2-duckExtent)
  const ducks=new Container();ducks.label='confuse-ray-ducks';ducks.alpha=0;ducks.sortableChildren=true;temporary.addChild(ducks)
  const orbit=new Graphics().ellipse(0,0,orbitX,orbitY).stroke({color:0xf3d98c,width:1.1,alpha:.28})
  orbit.label='confuse-ray-duck-orbit';orbit.zIndex=-2;ducks.addChild(orbit)
  const birds=Array.from({length:3},(_,i)=>{
    const node=new Container();node.label=`confuse-ray-duck-${i}`;ducks.addChild(node)
    const art=new Container();art.label=`confuse-ray-duck-art-${i}`;node.addChild(art)
    const body=new Graphics().poly([-6,2,-13,-1,-10,7,-5,8]).fill(0xffd447)
      .ellipse(-1,4,9.5,6).fill(0xffd447).stroke({color:0x966420,width:1.1})
      .circle(5,-3,6).fill(0xffe76a).stroke({color:0x966420,width:1.1})
    body.label=`confuse-ray-duck-body-${i}`;art.addChild(body)
    const bill=new Graphics().poly([9,-3,16,-2,15,1,9.5,1]).fill(0xf39727).stroke({color:0xb46523,width:.8,join:'round'})
    bill.label=`confuse-ray-duck-bill-${i}`;art.addChild(bill)
    const wing=new Graphics().ellipse(0,0,4.7,2.8).fill(0xeab52f).stroke({color:0xc58b27,width:.8})
    wing.label=`confuse-ray-duck-wing-${i}`;wing.position.set(-2,4);art.addChild(wing)
    const eye=new Graphics().circle(7,-4.2,1.15).fill(0x302b28).circle(7.25,-4.55,.32).fill(0xffffff)
    eye.label=`confuse-ray-duck-eye-${i}`;art.addChild(eye)
    return{node,art,wing}
  })
  function updateDucks(time){
    const age=time-1.81
    ducks.alpha=age>=0&&time<timing.duration?Math.min(1,age/.11)*Math.min(1,(timing.duration-time)/.18):0
    const center=targetSocket('visualCenter',true),hasHead=context.target.hasAnchor?.('head')
    const crown=hasHead?targetSocket('head',true):{x:center.x,y:center.y-context.target.metrics.height/unit*.48}
    ducks.position.set(clamp(crown.x,bounds.left+orbitX+duckExtent,bounds.right-orbitX-duckExtent),clamp(crown.y-6,bounds.top+orbitY+duckExtent,bounds.bottom-orbitY-duckExtent))
    birds.forEach(({node,art,wing},i)=>{
      const angle=i*Math.PI*2/3+age*5.4,depth=Math.sin(angle),scale=duckSize*(.88+.12*depth)
      const bob=tailAccents.reduce((sum,at,index)=>sum+(index%3===i?Math.exp(-(((time-at)/.045)**2)):0),0)
      node.position.set(Math.cos(angle)*orbitX,depth*orbitY);node.zIndex=depth
      node.alpha=.77+.23*(depth+1)/2
      // Cancel only the field's horizontal reflection so every little face stays readable.
      art.scale.set(Math.sign(temporary.scale.x)*scale,scale);art.y=-3.5*bob
      art.rotation=Math.sin(time*8+i)*.035;wing.rotation=Math.sin(time*15+i)*.15-bob*.28
    })
    ducks.sortChildren()
  }
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
    updateDucks(time)
  }
  onFrame(update)
  tl.to(attacker,{x:home.x+3,rotation:.013,duration:.2},0).to(attacker,{x:home.x,rotation:0,duration:.35},1.2)
    .to(source,{alpha:1,duration:.13},.12).to(source,{alpha:0,duration:.24},1.02)
    .to(ray,{alpha:.85,duration:.1},.26).to(draw,{progress:1,duration:.72,ease:'none'},.26).to(ray,{alpha:0,duration:.22},1.04)
    .to(head,{alpha:1,duration:.1},.26).to(head,{alpha:0,duration:.25},1.01)
    .to(halo,{alpha:.95,duration:.2},.98).fromTo(halo.scale,{x:.35,y:.35},{x:1,y:1,duration:.35},.98)
    .to(halo,{alpha:0,duration:.45},1.65)
    .call(()=>{update(.98);onCue({type:'impact'});defender.tint=0xe5c6a2},[],.98).call(()=>{defender.tint=0xffffff},[],1.22)
    .call(()=>{},[],timing.duration)
}
