import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function sweetKiss(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const kiss=new Container();kiss.label='sweet-kiss-heart';kiss.alpha=0;temporary.addChild(kiss)
  kiss.addChild(new Graphics().moveTo(0,10).bezierCurveTo(-20,-2,-9,-19,0,-8).bezierCurveTo(9,-19,20,-2,0,10).fill(0xf6bddc).stroke({color:0xffe4f3,width:1.3}))
  const trail=Array.from({length:9},()=>{const g=new Graphics().poly([0,-3,1,0,0,3,-1,0]).fill(0xffe2b7);g.alpha=0;temporary.addChild(g);return g})
  const daze=new Container();daze.label='sweet-kiss-daze';daze.alpha=0;temporary.addChild(daze)
  const swirl=new Graphics();daze.addChild(swirl)
  const dots=Array.from({length:5},(_,i)=>{const g=new Graphics().poly([0,-4,1,-1,4,0,1,1,0,4,-1,1,-4,0,-1,-1]).fill(i%2?0xd4b6ec:0xffd9ac);daze.addChild(g);return g})
  const r=Math.min(44,Math.max(28,context.target.metrics.height/unit*.21))
  function update(time){
    const from=socket('emission',true),to=targetSocket('center',true),bow=Math.min(35,room(from)/2,room(to)/2),u=clamp((time-.24)/.72)
    const at=p=>({x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p-Math.sin(Math.PI*p)*bow})
    fit(kiss,at(u),23);kiss.rotation=Math.sin(Math.PI*u)*.3
    trail.forEach((g,i)=>{const age=time-.24-i*.045,p=clamp(age/.72);fit(g,at(p),6);g.alpha=age>=0&&age<.86?Math.sin(Math.PI*clamp(age/.86))*.7:0})
    fit(daze,to,r*1.45);swirl.clear()
    for(let i=0;i<=50;i++){const p=i/50,a=p*Math.PI*4+time*1.8,rad=r*(.15+p*.8),x=Math.cos(a)*rad,y=Math.sin(a)*rad*.56;i?swirl.lineTo(x,y):swirl.moveTo(x,y)}
    swirl.stroke({color:0xd1b3e5,width:1.4,alpha:.65})
    dots.forEach((g,i)=>{const a=-time*2.5+i*Math.PI*2/5;g.position.set(Math.cos(a)*r,Math.sin(a)*r*.55);g.rotation=time;g.scale.set(r/44)})
  }
  onFrame(update)
  tl.to(kiss,{alpha:1,duration:.15},.24).to(kiss,{alpha:0,duration:.25},.96).to(daze,{alpha:1,duration:.2},.9).to(daze,{alpha:0,duration:.4},1.93)
    .call(()=>{update(.96);onCue({type:'impact'})},[],.96)

}
