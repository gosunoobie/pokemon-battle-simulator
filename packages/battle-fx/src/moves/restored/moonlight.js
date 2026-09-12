import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function moonlight(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(65,Math.max(40,context.source.metrics.height/unit*.3))
  const night=new Container();night.label='moonlight-curtain';night.alpha=0;temporary.addChild(night)
  const moon=new Graphics(),curtain=new Graphics(),reflection=new Graphics();night.addChild(curtain,moon,reflection)
  const streaks=Array.from({length:14},(_,i)=>{const g=new Graphics().moveTo(0,-4).lineTo(0,4).stroke({color:i%2?0xe5e6ff:0xc2d8ef,width:1.2,alpha:.75});night.addChild(g);return g})
  function update(time){
    fit(night,socket('aura',true),r*1.6);moon.clear();curtain.clear();reflection.clear()
    const y=-r*.83,s=r*.26
    moon.moveTo(s*.45,y-s).bezierCurveTo(-s*1.5,y-s,-s*1.5,y+s,s*.45,y+s).bezierCurveTo(-s*.5,y+s*.38,-s*.5,y-s*.38,s*.45,y-s).fill(0xe6e5ff)
    curtain.poly([-r*.13,y+s,r*.13,y+s,r*.34,r*.46,-r*.34,r*.46]).fill({color:0xbabfe8,alpha:.09})
    streaks.forEach((g,i)=>{const u=(time*.58+i/14)%1;g.position.set(Math.sin(i*2.4)*r*(.12+u*.2),y+s+u*r*1.04);g.alpha=Math.sin(Math.PI*u)*.75;g.scale.set(r/65)})
    for(let i=0;i<3;i++){const u=(time*.5+i/3)%1;reflection.ellipse(0,r*.48,r*(.18+u*.35),r*(.04+u*.07)).stroke({color:0xc7e0f0,width:1.3,alpha:Math.sin(Math.PI*u)*.5})}
  }
  onFrame(update)
  tl.to(night,{alpha:1,duration:.5},.08).to(night,{alpha:0,duration:.48},1.86).call(()=>{update(1.15);onCue({type:'impact'})},[],1.15)

}
