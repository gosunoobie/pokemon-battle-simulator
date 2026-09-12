import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function charm(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const wink=new Graphics();wink.label='charm-wink';wink.alpha=0;temporary.addChild(wink)
  const heart=new Graphics().moveTo(0,13).bezierCurveTo(-26,-2,-13,-23,0,-10).bezierCurveTo(13,-23,26,-2,0,13).fill({color:0xf5afc8,alpha:.85}).stroke({color:0xffdce9,width:1.4})
  heart.label='charm-heart';heart.alpha=0;temporary.addChild(heart)
  const soften=new Graphics();soften.label='charm-soften';soften.alpha=0;temporary.addChild(soften)
  const r=Math.min(42,Math.max(27,context.target.metrics.height/unit*.2))
  function update(time){
    const from=socket(context.source.hasAnchor?.('eyes')?'eyes':'emission',true),to=targetSocket('center',true),u=clamp((time-.3)/.6)
    fit(wink,from,22);wink.clear().moveTo(-13,0).quadraticCurveTo(0,8,13,0).stroke({color:0xffc9df,width:2.4,cap:'round'})
    const p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u-Math.sin(Math.PI*u)*Math.min(24,room(from)/2,room(to)/2)};fit(heart,p,27);heart.rotation=Math.sin(time*4)*.08
    fit(soften,to,r*1.5);soften.clear()
    const v=clamp((time-.9)/.9)
    for(let i=0;i<3;i++){const x=(i-1)*r*.55,y=r*(-.3+v*.8);soften.moveTo(x-r*.16,y).lineTo(x,y+r*.2).lineTo(x+r*.16,y).stroke({color:i%2?0xdac4ed:0xf1bbd0,width:2.5,alpha:1-v,cap:'round',join:'round'})}
    soften.ellipse(0,0,r*(.4+v*.7),r*(.28+v*.25)).stroke({color:0xf7d2df,width:1.4,alpha:(1-v)*.55})
  }
  onFrame(update)
  tl.to(wink,{alpha:1,duration:.12},.08).to(wink,{alpha:0,duration:.25},.55).to(heart,{alpha:1,duration:.15},.3).to(heart,{alpha:0,duration:.35},.92)
    .to(soften,{alpha:1,duration:.15},.85).to(soften,{alpha:0,duration:.3},1.65).call(()=>{update(.9);onCue({type:'impact'})},[],.9)

}
