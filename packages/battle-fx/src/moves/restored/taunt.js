import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function taunt(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('hand') ? 'hand' : 'emission'
  const edges = [-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const r=Math.min(34,Math.max(23,context.target.metrics.height/unit*.17))
  const gesture=new Container();gesture.label='taunt-gesture';gesture.alpha=0;temporary.addChild(gesture)
  const palm=new Graphics().roundRect(-10,-1,19,17,5).fill(0xe9b7a0).stroke({color:0xffd9c1,width:1.1})
    .roundRect(-12,3,6,11,3).fill(0xf3c7ad).moveTo(-5,7).lineTo(6,7).moveTo(-4,11).lineTo(5,11).stroke({color:0xc08785,width:1,alpha:.6})
  const finger=new Graphics();gesture.addChild(palm,finger)
  const waves=Array.from({length:3},(_,i)=>{const g=new Graphics();g.label=`taunt-wave-${i}`;g.alpha=0;temporary.addChild(g);return g})
  const anger=new Container();anger.label='taunt-anger';anger.alpha=0;temporary.addChild(anger)
  const glyph=new Graphics(),ticks=new Graphics();anger.addChild(glyph,ticks)
  function update(time){
    const from=socket(attachment,true),to=targetSocket('center',true)
    gesture.position.copyFrom(from);gesture.scale.set(Math.min(1,room(from)/29));gesture.rotation=Math.sin(time*11)*.08
    const curl=(Math.sin((time-.1)*Math.PI*6)+1)*.5
    finger.clear().moveTo(2,1).lineTo(2,-14).quadraticCurveTo(13,-24,14-curl*7,-9).stroke({color:0xffdbc0,width:6,cap:'round',join:'round'})
    waves.forEach((g,i)=>{
      const age=time-.3-i*.13,u=Math.max(0,Math.min(1,age/.5)),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u}
      g.position.copyFrom(p);g.rotation=Math.atan2(to.y-from.y,to.x-from.x);g.scale.set(Math.min(1,room(p)/23))
      g.clear().moveTo(-9,-17).quadraticCurveTo(4,-10,0,0).quadraticCurveTo(4,10,-9,17).stroke({color:i===1?0xf4b0a9:0xcd788e,width:2.6,alpha:.85,cap:'round'})
      g.alpha=age>=0&&age<.64?Math.min(1,age*15)*Math.min(1,(.64-age)*9):0
    })
    anger.position.copyFrom(to);anger.scale.set(Math.min(1,room(to)/(r*1.5)))
    const s=r*(.76+Math.sin(time*13)*.045)
    glyph.clear()
    for(const [x,y] of [[-1,-1],[1,-1],[-1,1],[1,1]]) glyph.moveTo(x*s*.12,y*s*.8).lineTo(x*s*.15,y*s*.28).quadraticCurveTo(x*s*.22,y*s*.18,x*s*.8,y*s*.12).stroke({color:0xf7a1a8,width:4,cap:'round',join:'round'})
    ticks.clear()
    for(let i=0;i<6;i++){const a=i*Math.PI/3,timePulse=.9+Math.sin(time*10+i)*.1
      ticks.moveTo(Math.cos(a)*r,Math.sin(a)*r).lineTo(Math.cos(a)*r*1.28*timePulse,Math.sin(a)*r*1.28*timePulse).stroke({color:0xffcbb3,width:1.7,alpha:.7,cap:'round'})}
  }
  onFrame(update)
  tl.to(gesture,{alpha:1,duration:.15},.08).to(gesture,{alpha:0,duration:.25},1.05)
    .to(anger,{alpha:1,duration:.14},.72).to(anger,{alpha:0,duration:.38},1.52)
    .call(()=>{update(.8);onCue({type:'impact'})},[],.8)
}
