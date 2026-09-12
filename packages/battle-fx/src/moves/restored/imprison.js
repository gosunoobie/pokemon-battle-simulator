import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function imprison(context) {
  const { tl, onFrame, onCue }=context
  const { temporary, socket, unit }=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const r=Math.min(67,Math.max(37,context.source.metrics.height/unit*.3))
  const seal=new Container();seal.label='imprison-seal';seal.alpha=0;temporary.addChild(seal)
  const rings=new Graphics(),runes=new Graphics(),lock=new Graphics();seal.addChild(rings,runes,lock)
  const motes=Array.from({length:12},(_,i)=>{const g=new Graphics().rect(-1.5,-3,3,6).fill(i%2?0xf7b8d5:0xbd9be3);g.alpha=0;seal.addChild(g);return g})
  function update(time){
    const at=socket('aura',true);seal.position.copyFrom(at);seal.scale.set(Math.min(1,room(at)/(r*1.4)))
    const closing=Math.max(0,Math.min(1,(time-.3)/.62)),radius=r*(1.22-closing*.22)
    rings.clear().circle(0,0,r*.68).fill({color:0x854372,alpha:.075})
    for(let lane=0;lane<2;lane++){
      const points=[],a=(1-closing)*(lane?-1:1)*.65+lane*Math.PI/6
      for(let i=0;i<6;i++){const ang=a+i*Math.PI/3;points.push(Math.cos(ang)*radius*(lane?.74:1),Math.sin(ang)*radius*(lane?.74:1))}
      rings.poly(points).stroke({color:lane?0xbb9bdf:0xf3a9ca,width:lane?1.6:2.3,alpha:.82})
    }
    runes.clear()
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3+time*.45,x=Math.cos(a)*r*1.15,y=Math.sin(a)*r*1.15,d=r*.08
      runes.moveTo(x-d,y).lineTo(x,y-d).lineTo(x+d,y).lineTo(x,y+d).closePath().stroke({color:0xfbd0e4,width:1.5,alpha:.6+Math.sin(time*6+i)**2*.3})
    }
    lock.clear();lock.alpha=Math.max(0,Math.min(1,(time-.7)/.22))
    const s=r*.35
    lock.moveTo(-s*.6,-s*.03).lineTo(-s*.6,-s*.55).quadraticCurveTo(0,-s*1.3,s*.6,-s*.55).lineTo(s*.6,-s*.03).stroke({color:0xffd8e9,width:3,cap:'round'})
      .roundRect(-s,-s*.04,s*2,s*1.2,s*.2).fill({color:0x9b588c,alpha:.38}).stroke({color:0xf6b3d0,width:2})
      .circle(0,s*.38,s*.13).fill(0xffe0ed).rect(-s*.05,s*.4,s*.1,s*.3).fill(0xffe0ed)
    motes.forEach((g,i)=>{const age=time-.92-i*.025,u=Math.max(0,Math.min(1,age/.85)),a=i*Math.PI/6+u*.25
      g.position.set(Math.cos(a)*r*(.9+u*.22),Math.sin(a)*r*(.9+u*.22));g.rotation=a+time*.6;g.scale.set(r/67);g.alpha=age>=0&&age<.85?Math.sin(Math.PI*u)*.8:0})
  }
  onFrame(update)
  tl.to(seal,{alpha:1,duration:.4},.1).to(seal,{alpha:0,duration:.42},1.9)
    .call(()=>{update(.92);onCue({type:'impact'})},[],.92)
}
