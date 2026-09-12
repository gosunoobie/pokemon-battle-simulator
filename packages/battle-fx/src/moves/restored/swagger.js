import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function swagger(context) {
  const { tl, onFrame, onCue }=context
  const { temporary, socket, targetSocket, unit }=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const r=Math.min(43,Math.max(28,context.target.metrics.height/unit*.21))
  const boast=new Graphics();boast.label='swagger-boast';boast.alpha=0;temporary.addChild(boast)
  const star=new Graphics().poly([0,-9,2,-2,9,0,2,2,0,9,-2,2,-9,0,-2,-2]).fill(0xffe2a5)
  star.label='swagger-star';star.alpha=0;temporary.addChild(star)
  const field=new Container();field.label='swagger-field';field.alpha=0;temporary.addChild(field)
  const flare=new Graphics(),orbit=new Graphics();field.addChild(flare,orbit)
  const motes=Array.from({length:5},(_,i)=>{const g=new Graphics().poly([0,-4,2,-1,4,0,2,1,0,4,-2,1,-4,0,-2,-1]).fill(i%2?0xe1b5ec:0xffd19e);field.addChild(g);return g})
  function update(time){
    const from=socket('aura',true),to=targetSocket('center',true),sr=Math.min(48,room(from)/1.35)
    boast.position.copyFrom(from);boast.clear()
    const open=Math.max(0,Math.min(1,(time-.08)/.42))
    for(let i=0;i<7;i++){const a=-Math.PI*.95+i*Math.PI*.15,inner=sr*.55,outer=sr*(.65+open*.5)
      boast.moveTo(Math.cos(a)*inner,Math.sin(a)*inner).lineTo(Math.cos(a)*outer,Math.sin(a)*outer).stroke({color:i%2?0xffd59f:0xeeba7f,width:i%2?2:3,alpha:.8,cap:'round'})}
    const u=Math.max(0,Math.min(1,(time-.42)/.6)),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u-Math.sin(Math.PI*u)*Math.min(22,room(from)/2,room(to)/2)}
    star.position.copyFrom(p);star.rotation=time*3;star.scale.set(Math.min(1,room(p)/12))
    field.position.copyFrom(to);field.scale.set(Math.min(1,room(to)/(r*1.45)))
    flare.clear();orbit.clear()
    const lift=Math.max(0,Math.min(1,(time-1.02)/.35)),s=r*(.75+Math.sin(time*12)*.05)
    for(let i=0;i<3;i++){
      const x=(i-1)*r*.44,y=r*(.4-lift*.3)
      flare.moveTo(x-r*.15,y+r*.22).lineTo(x,y-r*.32).lineTo(x+r*.15,y+r*.22).stroke({color:0xf3a18b,width:2.5,alpha:.8,cap:'round',join:'round'})
    }
    flare.moveTo(-s*.43,-s*.28).lineTo(-s*.08,-s*.08).moveTo(s*.43,-s*.28).lineTo(s*.08,-s*.08).stroke({color:0xf28f98,width:3,cap:'round'})
    for(let i=0;i<2;i++){
      const a=time*2.4+i*Math.PI
      for(let j=0;j<=22;j++){const angle=a+j/22*2.2,x=Math.cos(angle)*r*1.05,y=Math.sin(angle)*r*.43-r*.5;j?orbit.lineTo(x,y):orbit.moveTo(x,y)}
      orbit.stroke({color:0xc5a1dd,width:1.5,alpha:.65})
    }
    motes.forEach((g,i)=>{const a=time*3+i*Math.PI*2/5;g.position.set(Math.cos(a)*r*1.08,Math.sin(a)*r*.44-r*.5);g.rotation=-time*2;g.scale.set(r/43);g.alpha=.55+Math.sin(time*7+i)**2*.4})
  }
  onFrame(update)
  tl.to(boast,{alpha:1,duration:.2},.08).to(boast,{alpha:0,duration:.28},.76)
    .to(star,{alpha:1,duration:.1},.42).to(star,{alpha:0,duration:.16},1.02)
    .to(field,{alpha:1,duration:.2},.92).to(field,{alpha:0,duration:.4},1.98)
    .call(()=>{update(1.02);onCue({type:'impact'})},[],1.02)
}
