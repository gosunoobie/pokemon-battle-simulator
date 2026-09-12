import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function safeguard(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(76,Math.max(44,context.source.metrics.height/unit*.34))
  const ward=new Container();ward.label='safeguard-panes';ward.alpha=0;temporary.addChild(ward)
  const panes=Array.from({length:6},(_,i)=>{const g=new Graphics();const points=[];for(let j=0;j<6;j++){const a=j*Math.PI/3;points.push(Math.cos(a)*15,Math.sin(a)*18)}g.poly(points).fill({color:0x83e1ca,alpha:.07}).stroke({color:0xbeeede,width:1.3,alpha:.8});ward.addChild(g);return g})
  const ribbon=new Graphics(),lights=new Graphics();ward.addChild(ribbon,lights)
  function update(time){
    fit(ward,socket('aura',true),r*1.55);ribbon.clear();lights.clear()
    panes.forEach((g,i)=>{const a=i*Math.PI/3,u=clamp((time-.1-i*.09)/.5);g.position.set(Math.cos(a)*r*.77,Math.sin(a)*r*.75+(1-u)*r*.26);g.scale.set(r/76);g.alpha=u*(.7+Math.sin(time*3+i)**2*.25)})
    for(let j=0;j<=64;j++){const a=j/64*Math.PI*2,x=Math.cos(a)*r*.8,y=Math.sin(a)*r*.72+Math.sin(a*3-time*2)*r*.05;j?ribbon.lineTo(x,y):ribbon.moveTo(x,y)}
    ribbon.stroke({color:0x9adfcf,width:1.3,alpha:.45})
    for(let i=0;i<6;i++){const a=time*1.2+i*Math.PI/3;lights.circle(Math.cos(a)*r*.8,Math.sin(a)*r*.72,2*r/76).fill({color:0xe4fff1,alpha:.75})}
  }
  onFrame(update)
  tl.to(ward,{alpha:1,duration:.35},.05).to(ward,{alpha:0,duration:.46},1.86).call(()=>{update(1.05);onCue({type:'impact'})},[],1.05)

}
