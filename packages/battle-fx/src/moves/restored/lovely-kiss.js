import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function lovelyKiss(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const lips=new Graphics().moveTo(-17,0).quadraticCurveTo(-5,-13,0,-6).quadraticCurveTo(5,-13,17,0).quadraticCurveTo(0,15,-17,0).fill(0xd88fc0).moveTo(-13,0).quadraticCurveTo(0,3,13,0).stroke({color:0xffd4e6,width:1.7})
  lips.label='lovely-kiss-lips';lips.alpha=0;temporary.addChild(lips)
  const petals=Array.from({length:12},(_,i)=>{const g=new Graphics().ellipse(0,0,3,6).fill(i%2?0xd5b6e7:0xf2c1db);g.alpha=0;temporary.addChild(g);return g})
  const hush=new Graphics();hush.label='lovely-kiss-hush';hush.alpha=0;temporary.addChild(hush)
  const r=Math.min(46,Math.max(30,context.target.metrics.height/unit*.23))
  function update(time){
    const from=socket('emission',true),to=targetSocket('center',true),u=clamp((time-.3)/.78),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u+Math.sin(Math.PI*u)*Math.min(26,room(from)/2,room(to)/2)}
    fit(lips,p,22);lips.rotation=Math.sin(time*5)*.1
    fit(hush,to,r*1.5);hush.clear()
    for(let i=0;i<3;i++){const v=(Math.max(0,time-1.08)*.6+i/3)%1,y=(v-.5)*r;hush.ellipse(0,y,r*(.8-v*.28),r*.17).stroke({color:i%2?0xe9c6e9:0xc6b7e4,width:1.7,alpha:Math.sin(Math.PI*v)*.55})}
    petals.forEach((g,i)=>{const age=time-1.08-i*.025,v=clamp(age/.8),a=i*Math.PI/6;const p={x:to.x+Math.cos(a)*r*v*.75,y:to.y+Math.sin(a)*r*v*.4+v*v*r*.4};fit(g,p,9);g.rotation=a+v;g.alpha=age>=0&&age<.8?Math.sin(Math.PI*v)*.8:0})
  }
  onFrame(update)
  tl.to(lips,{alpha:1,duration:.18},.3).to(lips,{alpha:0,duration:.25},1.08).to(hush,{alpha:1,duration:.25},1).to(hush,{alpha:0,duration:.4},1.96)
    .call(()=>{update(1.08);onCue({type:'impact'})},[],1.08)

}
