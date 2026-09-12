import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function trick(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const parcels=[0xbfa5ef,0xf0c290].map((color,i)=>{
    const g=new Graphics().roundRect(-10,-10,20,20,3).fill({color,alpha:.75}).stroke({color:0xffeadc,width:1.6}).moveTo(-9,0).lineTo(9,0).moveTo(0,-9).lineTo(0,9).stroke({color:0xffe5b8,width:2})
    g.label=`trick-item-${i}`;g.alpha=0;temporary.addChild(g);return g
  })
  const routes=new Graphics();routes.alpha=0;temporary.addChild(routes)
  const sparks=[new Graphics(),new Graphics()];sparks.forEach((g,i)=>{g.label=`trick-arrival-${i}`;g.alpha=0;temporary.addChild(g)})
  function update(time){
    const points=[socket('hand',true),targetSocket('hand',true)],bow=Math.min(37,room(points[0])/2,room(points[1])/2),u=clamp((time-.35)/.8)
    routes.clear()
    for(let lane=0;lane<2;lane++){
      const a=points[lane],b=points[1-lane]
      for(let j=0;j<=30;j++){const p=j/30;const x=a.x+(b.x-a.x)*p,y=a.y+(b.y-a.y)*p+Math.sin(Math.PI*p)*bow*(lane?1:-1);j?routes.lineTo(x,y):routes.moveTo(x,y)}
      routes.stroke({color:lane?0xf1c89f:0xc6abea,width:1.2,alpha:.4})
      const p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u+Math.sin(Math.PI*u)*bow*(lane?1:-1)}
      fit(parcels[lane],p,17);parcels[lane].rotation=Math.sin(Math.PI*u)*Math.PI*2*(lane?1:-1)
      fit(sparks[lane],b,40);sparks[lane].clear()
      const v=clamp((time-1.15)/.6)
      for(let j=0;j<6;j++){const angle=j*Math.PI/3+v*.4,rad=8+v*20;sparks[lane].moveTo(Math.cos(angle)*rad,Math.sin(angle)*rad).lineTo(Math.cos(angle)*(rad+5),Math.sin(angle)*(rad+5)).stroke({color:0xffe7bb,width:2,alpha:1-v,cap:'round'})}
    }
  }
  onFrame(update)
  for(const g of parcels)tl.to(g,{alpha:1,duration:.2},.1).to(g,{alpha:0,duration:.25},1.23)
  for(const g of sparks)tl.to(g,{alpha:1,duration:.08},1.15).to(g,{alpha:0,duration:.3},1.6)
  tl.to(routes,{alpha:1,duration:.2},.3).to(routes,{alpha:0,duration:.3},1.22).call(()=>{update(1.15);onCue({type:'impact'})},[],1.15)

}
