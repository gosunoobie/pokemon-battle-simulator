import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function withdraw(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(72,Math.max(42,context.source.metrics.height/unit*.32))
  const shell=new Container();shell.label='withdraw-shell';shell.alpha=0;temporary.addChild(shell)
  const ribs=Array.from({length:5},()=>{const g=new Graphics();shell.addChild(g);return g})
  const base=new Graphics();shell.addChild(base)
  function update(time){
    fit(shell,socket('aura',true),r*1.5);const close=clamp((time-.14)/.86),unfold=1-clamp((time-1.5)/.45)
    ribs.forEach((g,i)=>{const lane=i-2,w=r*(.2+Math.abs(lane)*.12),x=lane*r*(.34-close*.09),h=r*(.85-Math.abs(lane)*.09)*close*unfold
      g.clear().moveTo(x-w*.5,r*.55).quadraticCurveTo(x-w*.45,-h,x,-h).quadraticCurveTo(x+w*.45,-h,x+w*.5,r*.55).fill({color:i%2?0x8daeb4:0xb2c8bf,alpha:.1}).stroke({color:i%2?0xc7dfd2:0xa9ccd2,width:2,alpha:.7,cap:'round'})})
    base.clear().ellipse(0,r*.55,r*.84,r*.15).stroke({color:0xc9dcc0,width:2,alpha:.55})
  }
  onFrame(update)
  tl.to(shell,{alpha:1,duration:.3},.08).to(shell,{alpha:0,duration:.4},1.68).call(()=>{update(1);onCue({type:'impact'})},[],1)

}
