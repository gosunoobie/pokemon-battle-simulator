import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function torment(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width-temporary.x) / temporary.scale.x]
  const left=Math.min(...edges), right=Math.max(...edges), top=-temporary.y/unit, bottom=(context.scene.height-temporary.y)/unit
  const room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const r=Math.min(53,Math.max(31,context.target.metrics.height/unit*.25))
  const field=new Container();field.label='torment-field';field.alpha=0;temporary.addChild(field)
  const bands=new Graphics(),mark=new Graphics(),shards=[];field.addChild(bands,mark)
  for(let i=0;i<10;i++){const g=new Graphics().poly([-2,-6,3,-1,0,1,3,6,-3,1,0,-1]).fill(i%2?0xd68dc9:0xf495a0);g.alpha=0;field.addChild(g);shards.push(g)}
  function update(time){
    const at=targetSocket('center',true);field.position.copyFrom(at);field.scale.set(Math.min(1,room(at)/(r*1.5)))
    bands.clear();mark.clear()
    const close=Math.max(0,Math.min(1,(time-.2)/.64))
    for(let i=0;i<3;i++){
      const rad=r*(1.32-close*.38),start=time*(i%2?-3:3)+i*2.1
      for(let j=0;j<=24;j++){const a=start+j/24*2.3,x=Math.cos(a)*rad,y=Math.sin(a)*rad*.45+(i-1)*r*.36;j?bands.lineTo(x,y):bands.moveTo(x,y)}
      bands.stroke({color:i===1?0x9c6cae:0xe48b9b,width:2.8,alpha:.7,cap:'round'})
    }
    const pulse=1+Math.sin(time*11)*.07,s=r*.46*pulse
    mark.poly([-s,-s*.65,-s*.2,-s*.2,0,-s*.9,s*.18,-s*.2,s,-s*.65,s*.52,s*.22,s*.85,s*.75,0,s*.45,-s*.85,s*.75,-s*.52,s*.22]).fill({color:0x462c50,alpha:.35}).stroke({color:0xf09cad,width:2,join:'round'})
      .moveTo(-s*.5,-s*.08).lineTo(-s*.13,s*.08).moveTo(s*.5,-s*.08).lineTo(s*.13,s*.08).stroke({color:0xffcfce,width:2,cap:'round'})
    shards.forEach((g,i)=>{const age=time-.84-i*.035,u=Math.max(0,Math.min(1,age/.9)),a=i*Math.PI/5+Math.sin(time*5+i)*.1
      g.position.set(Math.cos(a)*r*(.63+u*.46),Math.sin(a)*r*(.55+u*.42));g.rotation=a+Math.sin(time*13+i)*.16;g.scale.set(r/53);g.alpha=age>=0&&age<.9?Math.sin(Math.PI*u)*.8:0})
  }
  onFrame(update)
  tl.to(field,{alpha:1,duration:.32},.2).to(field,{alpha:0,duration:.4},1.74)
    .call(()=>{update(.84);onCue({type:'impact'})},[],.84)
}
