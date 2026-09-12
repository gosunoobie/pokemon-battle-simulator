import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function bellyDrum(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const drum=new Container();drum.label='belly-drum-beat';drum.alpha=0;temporary.addChild(drum)
  const r=Math.min(54,Math.max(32,context.source.metrics.height/unit*.23))
  const palms=[-1,1].map(side=>{const g=new Graphics().roundRect(-9,-6,18,13,4).fill(0xf4bf93).moveTo(-5,-2).lineTo(5,-2).moveTo(-5,2).lineTo(5,2).stroke({color:0xffe0b6,width:1.4});drum.addChild(g);return{g,side}})
  const rings=new Graphics(),arrows=new Graphics();drum.addChild(rings,arrows)
  function update(time){
    fit(drum,socket('center',true),r*1.65);rings.clear();arrows.clear()
    let beat=0;for(const at of [.36,.58,.8,1.02])beat=Math.max(beat,Math.max(0,1-Math.abs(time-at)/.1))
    palms.forEach(({g,side})=>{g.position.set(side*r*(.85-beat*.55),r*.16);g.rotation=side*(.3-beat*.4);g.scale.set(r/54)})
    for(const at of [.36,.58,.8,1.02]){const u=(time-at)/.4;if(u>=0&&u<=1)rings.ellipse(0,r*.16,r*(.18+u*.7),r*(.1+u*.45)).stroke({color:0xffc788,width:2.7,alpha:(1-u)*.85})}
    const u=clamp((time-1.02)/.65)
    for(let i=0;i<3;i++){const x=(i-1)*r*.48,y=r*(.5-u*1.1);arrows.moveTo(x-r*.15,y+r*.22).lineTo(x,y-r*.1).lineTo(x+r*.15,y+r*.22).stroke({color:i===1?0xffe6a7:0xf2a276,width:3,alpha:time>=1.02?Math.sin(Math.PI*u):0,cap:'round',join:'round'})}
  }
  onFrame(update)
  tl.to(drum,{alpha:1,duration:.15},.1).to(drum,{alpha:0,duration:.35},1.72)
    .call(()=>{update(1.02);onCue({type:'impact'})},[],1.02)

}
