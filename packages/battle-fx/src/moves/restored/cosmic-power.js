import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function cosmicPower(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(71,Math.max(42,context.source.metrics.height/unit*.32))
  const sky=new Container();sky.label='cosmic-power-constellation';sky.alpha=0;temporary.addChild(sky)
  const points=[[-.7,-.35],[-.3,-.77],[.5,-.57],[.73,.15],[.13,.66],[-.56,.4]]
  const links=new Graphics(),orbits=new Graphics();sky.addChild(links,orbits)
  const stars=points.map((_,i)=>{const g=new Graphics().poly([0,-5,1.5,-1.5,5,0,1.5,1.5,0,5,-1.5,1.5,-5,0,-1.5,-1.5]).fill(i%2?0xffe1a5:0xd8c4f4);sky.addChild(g);return g})
  const planets=[new Graphics().circle(0,0,4).fill(0xc0d5f2),new Graphics().circle(0,0,3).fill(0xf0c9e7)];sky.addChild(...planets)
  function update(time){
    fit(sky,socket('aura',true),r*1.5);links.clear();orbits.clear()
    const progress=clamp((time-.15)/1)
    for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],u=clamp(progress*points.length-i);if(u)links.moveTo(a[0]*r,a[1]*r).lineTo((a[0]+(b[0]-a[0])*u)*r,(a[1]+(b[1]-a[1])*u)*r).stroke({color:0xbba9d8,width:1.2,alpha:.45})}
    stars.forEach((g,i)=>{g.position.set(points[i][0]*r,points[i][1]*r);g.scale.set((.7+Math.sin(time*3+i)**2*.4)*r/71);g.alpha=clamp(progress*6-i+1)})
    for(let lane=0;lane<2;lane++){
      const tilt=lane?-.55:.48,rx=r*(lane?.84:1),ry=r*.33
      for(let j=0;j<=48;j++){const a=j/48*Math.PI*2,x=Math.cos(a)*rx,y=Math.sin(a)*ry,px=x*Math.cos(tilt)-y*Math.sin(tilt),py=x*Math.sin(tilt)+y*Math.cos(tilt);j?orbits.lineTo(px,py):orbits.moveTo(px,py)}
      orbits.stroke({color:lane?0xddbce6:0xc1cceb,width:1,alpha:.3})
      const a=time*(lane?-1.5:1.1)+lane*Math.PI,x=Math.cos(a)*rx,y=Math.sin(a)*ry;planets[lane].position.set(x*Math.cos(tilt)-y*Math.sin(tilt),x*Math.sin(tilt)+y*Math.cos(tilt));planets[lane].scale.set(r/71)
    }
  }
  onFrame(update)
  tl.to(sky,{alpha:1,duration:.4},.05).to(sky,{alpha:0,duration:.45},1.94).call(()=>{update(1.15);onCue({type:'impact'})},[],1.15)

}
