import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function fakeTears(context) {
  const { tl, onFrame, onCue }=context
  const { temporary, socket, targetSocket, unit }=bindEffectSpace(context)
  const eyes=context.source.hasAnchor?.('eyes')?'eyes':'emission'
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const r=Math.min(41,Math.max(26,context.target.metrics.height/unit*.2))
  const welling=new Graphics();welling.label='fake-tears-source';welling.alpha=0;temporary.addChild(welling)
  const drops=Array.from({length:28},(_,i)=>{
    const g=new Graphics().moveTo(0,-6).quadraticCurveTo(-6,2,0,4).quadraticCurveTo(6,2,0,-6).fill(i%3?0xa9d9f4:0xd9f4ff)
      .moveTo(-1,-1).lineTo(-1,1).stroke({color:0xf1fbff,width:1,cap:'round'})
    g.label=`fake-tears-drop-${i}`;g.alpha=0;temporary.addChild(g);return g
  })
  const pleas=Array.from({length:3},(_,i)=>{const g=new Graphics().ellipse(0,0,6,13).stroke({color:i%2?0xd5c7ed:0xb6def6,width:1.8,alpha:.8});g.label=`fake-tears-plea-${i}`;g.alpha=0;temporary.addChild(g);return g})
  const lowering=new Container();lowering.label='fake-tears-lowering';lowering.alpha=0;temporary.addChild(lowering)
  const arcs=new Graphics(),marks=new Graphics();lowering.addChild(arcs,marks)
  function update(time){
    const from=socket(eyes,true),to=targetSocket('center',true),span=Math.min(39,Math.max(21,context.source.metrics.height/unit*.17),room(from)/1.6)
    welling.position.copyFrom(from);welling.scale.set(Math.min(1,room(from)/17));welling.clear()
    for(const side of [-1,1])welling.ellipse(side*8,2,4,2.3+Math.sin(time*14)**2*1.5).fill({color:0xc7edff,alpha:.85})
    drops.forEach((g,i)=>{
      const age=time-.15-Math.floor(i/2)*.065,u=Math.max(0,Math.min(1,age/.52)),side=i%2?1:-1
      const p={x:from.x+side*span*(.22+u*.58),y:from.y+span*(u*.24+u*u*.95)}
      g.position.copyFrom(p);g.scale.set(Math.min(.8,room(p)/8));g.rotation=-side*(.4-u*.2)
      g.alpha=age>=0&&age<.52?Math.min(1,age*22)*(1-u*u):0
    })
    pleas.forEach((g,i)=>{
      const age=time-.32-i*.2,u=Math.max(0,Math.min(1,age/.56)),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u}
      g.position.copyFrom(p);g.rotation=Math.atan2(to.y-from.y,to.x-from.x);g.scale.set(Math.min(.7+u*.3,room(p)/16));g.alpha=age>=0&&age<.72?Math.min(1,age*12)*Math.min(1,(.72-age)*8):0
    })
    lowering.position.copyFrom(to);lowering.scale.set(Math.min(1,room(to)/(r*1.45)));arcs.clear();marks.clear()
    for(let i=0;i<3;i++){
      const u=((Math.max(0,time-.88)*1.5+i/3)%1),y=(u-.5)*r*1.2
      arcs.moveTo(-r*.8,y-r*.1).quadraticCurveTo(0,y+r*.35,r*.8,y-r*.1).stroke({color:i%2?0xb8c9e9:0xc7b4e5,width:2,alpha:Math.sin(Math.PI*u)*.75,cap:'round'})
    }
    for(const side of [-1,1]){
      const x=side*r*.46,y=Math.sin(time*6)*r*.07
      marks.moveTo(x-r*.13,y).lineTo(x,y+r*.23).lineTo(x+r*.13,y).stroke({color:0xd9c9f1,width:2.6,cap:'round',join:'round'})
    }
  }
  onFrame(update)
  tl.to(welling,{alpha:1,duration:.12},.08).to(welling,{alpha:0,duration:.28},1.14)
    .to(lowering,{alpha:1,duration:.18},.82).to(lowering,{alpha:0,duration:.4},1.66)
    .call(()=>{update(.88);onCue({type:'impact'})},[],.88)
}
