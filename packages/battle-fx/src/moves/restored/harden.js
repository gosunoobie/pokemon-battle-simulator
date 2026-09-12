import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function harden(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(64,Math.max(39,context.source.metrics.height/unit*.29))
  const shell=new Container();shell.label='harden-facets';shell.alpha=0;temporary.addChild(shell)
  const facets=Array.from({length:6},(_,i)=>{const g=new Graphics().poly([-12,-18,9,-15,16,3,3,19,-13,10]).fill({color:i%2?0xc9d0d5:0xebebdc,alpha:.18}).stroke({color:0xedeeda,width:1.4,alpha:.7});shell.addChild(g);return g})
  const gleam=new Graphics();shell.addChild(gleam)
  function update(time){
    fit(shell,socket('aura',true),r*1.5);const lock=clamp((time-.14)/.76)
    facets.forEach((g,i)=>{const a=i*Math.PI/3,rad=r*(1.03-lock*.4);g.position.set(Math.cos(a)*rad,Math.sin(a)*rad*.8);g.rotation=a*.35;g.scale.set(r/64);g.alpha=.45+Math.sin(time*3+i)**2*.35})
    gleam.clear();const u=clamp((time-.65)/.7),x=r*(-.76+u*1.52)
    gleam.moveTo(x-r*.15,-r*.56).lineTo(x+r*.15,r*.56).stroke({color:0xfafff0,width:3,alpha:Math.sin(Math.PI*u)*.75,cap:'round'})
  }
  onFrame(update)
  tl.to(shell,{alpha:1,duration:.3},.1).to(shell,{alpha:0,duration:.4},1.52).call(()=>{update(.9);onCue({type:'impact'})},[],.9)

}
