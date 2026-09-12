import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function softBoiled(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const egg=new Container();egg.label='soft-boiled-egg';egg.alpha=0;temporary.addChild(egg)
  const upper=new Graphics().moveTo(-19,0).bezierCurveTo(-21,-36,21,-36,19,0).lineTo(11,-4).lineTo(3,2).lineTo(-5,-4).lineTo(-12,2).closePath().fill(0xffefd3).stroke({color:0xd8c19c,width:1.3})
  const lower=new Graphics().moveTo(-19,0).lineTo(-12,2).lineTo(-5,-4).lineTo(3,2).lineTo(11,-4).lineTo(19,0).bezierCurveTo(19,27,-19,27,-19,0).fill(0xf5e0b5).stroke({color:0xfff3da,width:1.4})
  egg.addChild(upper,lower)
  const pearls=Array.from({length:5},(_,i)=>{const g=new Graphics().circle(0,0,4+i%2).fill(0xffdf91).circle(-1,-1,1.5).fill(0xfffae0);g.label=`soft-boiled-pearl-${i}`;g.alpha=0;temporary.addChild(g);return g})
  const receive=new Graphics();receive.alpha=0;temporary.addChild(receive)
  function update(time){
    const from=socket('hand',true),to=socket('aura',true),open=clamp((time-.38)/.42)
    fit(egg,from,69);upper.position.set(-open*11,-open*22);upper.rotation=-open*.45;lower.position.set(open*6,open*12);lower.rotation=open*.28
    pearls.forEach((g,i)=>{const age=time-.55-i*.08,u=clamp(age/.61),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u-Math.sin(Math.PI*u)*Math.min(32,room(from)/2,room(to)/2)};fit(g,p,7);g.alpha=age>=0&&age<.83?Math.min(1,age*15)*Math.min(1,(.83-age)*6):0})
    fit(receive,to,43);receive.clear();const u=clamp((time-1.16)/.8)
    for(let i=0;i<6;i++){const a=i*Math.PI/3,rad=7+u*23;receive.circle(Math.cos(a)*rad,Math.sin(a)*rad*.7,2).fill({color:0xffe6aa,alpha:1-u})}
  }
  onFrame(update)
  tl.to(egg,{alpha:1,duration:.22},.08).to(egg,{alpha:0,duration:.4},1.32).to(receive,{alpha:1,duration:.15},1.1).to(receive,{alpha:0,duration:.3},1.85)
    .call(()=>{update(1.16);onCue({type:'impact'})},[],1.16)

}
