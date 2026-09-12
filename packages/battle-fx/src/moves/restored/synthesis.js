import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function synthesis(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(67,Math.max(39,context.source.metrics.height/unit*.31))
  const garden=new Container();garden.label='synthesis-garden';garden.alpha=0;temporary.addChild(garden)
  const leaves=Array.from({length:4},()=>{const g=new Graphics();garden.addChild(g);return g})
  const motes=Array.from({length:16},(_,i)=>{const g=new Graphics().circle(0,0,2.6).fill(i%3?0xd6f5a7:0xf3ffcb);g.alpha=0;garden.addChild(g);return g})
  const seed=new Graphics();seed.alpha=0;garden.addChild(seed)
  function update(time){
    fit(garden,socket('aura',true),r*1.55)
    leaves.forEach((g,i)=>{const side=i%2?1:-1,open=clamp((time-.1-i*.08)/.5),x=side*r*(i<2?.72:.5),y=r*(i<2?.2:.6),w=r*.2*open,h=r*.66*open
      g.position.set(x,y);g.rotation=side*(.35+Math.sin(time*2+i)*.055);g.clear().moveTo(0,0).quadraticCurveTo(-w,-h*.6,0,-h).quadraticCurveTo(w,-h*.55,0,0).fill({color:i%2?0x8bc789:0x62a97d,alpha:.7}).moveTo(0,-2).lineTo(0,-h*.92).stroke({color:0xd9efa8,width:1.1,alpha:.85})})
    motes.forEach((g,i)=>{const age=time-.58-i*.035,u=clamp(age/.65),lane=i%4,side=lane%2?1:-1,x=side*r*(lane<2?.72:.5),y=r*(lane<2?-.2:.18);g.position.set(x*(1-u),y*(1-u)-Math.sin(Math.PI*u)*r*.24);g.alpha=age>=0&&age<.85?Math.min(1,age*12)*Math.min(1,(.85-age)*6):0;g.scale.set(r/67)})
    seed.clear().ellipse(0,0,r*(.18+Math.sin(time*7)**2*.03),r*.24).fill({color:0xddf9bc,alpha:.2})
      .poly([0,-r*.14,r*.05,0,0,r*.14,-r*.05,0]).fill(0xeeffcf)
  }
  onFrame(update)
  tl.to(garden,{alpha:1,duration:.3},.08).to(garden,{alpha:0,duration:.45},1.92).to(seed,{alpha:1,duration:.3},1).to(seed,{alpha:0,duration:.4},1.64)
    .call(()=>{update(1.23);onCue({type:'impact'})},[],1.23)

}
