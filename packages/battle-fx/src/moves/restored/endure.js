import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function endure(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(64,Math.max(39,context.source.metrics.height/unit*.28))
  const brace=new Container();brace.label='endure-brace';brace.alpha=0;temporary.addChild(brace)
  const strokes=new Graphics(),band=new Graphics();brace.addChild(band,strokes)
  const sparks=Array.from({length:14},(_,i)=>{const g=new Graphics().rect(-1,-3,2,6).fill(i%2?0xf2bc80:0xffe0a5);g.alpha=0;brace.addChild(g);return g})
  function update(time){
    fit(brace,socket('aura',true),r*1.55);strokes.clear();band.clear();const lock=clamp((time-.1)/.85),x=r*(1.12-lock*.3)
    for(const side of [-1,1])for(let i=0;i<3;i++){const y=(i-1)*r*.4;strokes.moveTo(side*(x-r*.17),y-r*.13).lineTo(side*x,y).lineTo(side*(x-r*.17),y+r*.13).stroke({color:i===1?0xffd39b:0xe7a16f,width:3,alpha:.8,cap:'round',join:'round'})}
    const pulse=.7+Math.sin(time*8)**2*.3
    band.moveTo(-r*.65,r*.43).quadraticCurveTo(0,r*.7,r*.65,r*.43).stroke({color:0xe59b6c,width:5,alpha:.16*pulse,cap:'round'}).moveTo(-r*.65,r*.43).quadraticCurveTo(0,r*.7,r*.65,r*.43).stroke({color:0xffcf94,width:1.8,alpha:.75*pulse,cap:'round'})
    sparks.forEach((g,i)=>{const age=time-.95-i*.02,u=clamp(age/.75),a=i*Math.PI*2/14;g.position.set(Math.cos(a)*r*u*.7,Math.sin(a)*r*u*.35+u*u*r*.45);g.rotation=a;g.scale.set(r/64);g.alpha=age>=0&&age<.75?Math.sin(Math.PI*u)*.8:0})
  }
  onFrame(update)
  tl.to(brace,{alpha:1,duration:.24},.08).to(brace,{alpha:0,duration:.42},1.7).call(()=>{update(.95);onCue({type:'impact'})},[],.95)

}
