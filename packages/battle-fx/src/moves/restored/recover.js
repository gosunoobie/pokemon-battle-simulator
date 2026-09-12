import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function recover(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(66,Math.max(38,context.source.metrics.height/unit*.3))
  const aura=new Container();aura.label='recover-aura';temporary.addChild(aura)
  const pieces=Array.from({length:12},(_,i)=>{const g=new Graphics().poly([0,-7,3,0,0,7,-3,0]).fill(i%3?0xc7ffe3:0xf1fff5);g.alpha=0;aura.addChild(g);return g})
  const core=new Graphics();core.alpha=0;aura.addChild(core)
  const stars=Array.from({length:5},(_,i)=>{const g=new Graphics().poly([0,-4,1,-1,4,0,1,1,0,4,-1,1,-4,0,-1,-1]).fill(i%2?0xbbefd8:0xf4fff0);g.alpha=0;aura.addChild(g);return g})
  function update(time){
    fit(aura,socket('aura',true),r*1.35)
    pieces.forEach((g,i)=>{const age=time-.15-i*.04,u=clamp(age/.61),a=i*Math.PI/6+u*1.6,rad=r*(1-u)**.7;g.position.set(Math.cos(a)*rad,Math.sin(a)*rad*.8);g.rotation=a;g.scale.set((.8-u*.55)*r/66);g.alpha=age>=0&&age<.75?Math.min(1,age*14)*Math.min(1,(.75-age)*9):0})
    core.clear().circle(0,0,r*(.19+Math.sin(time*8)**2*.07)).fill({color:0xbbf3d7,alpha:.13})
      .moveTo(-r*.15,0).lineTo(r*.15,0).moveTo(0,-r*.15).lineTo(0,r*.15).stroke({color:0xebfff0,width:3,alpha:.85,cap:'round'})
    stars.forEach((g,i)=>{const age=time-1.2-i*.07,u=clamp(age/.55);g.position.set((i-2)*r*.23,r*(.1-u*.7));g.rotation=u*.4;g.alpha=age>=0&&age<.55?Math.sin(Math.PI*u):0;g.scale.set(r/66)})
  }
  onFrame(update)
  tl.to(core,{alpha:1,duration:.3},.75).to(core,{alpha:0,duration:.35},1.57).call(()=>{update(1.2);onCue({type:'impact'})},[],1.2)

}
