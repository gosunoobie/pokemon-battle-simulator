import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function milkDrink(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const drink=new Container();drink.label='milk-drink-pour';drink.alpha=0;temporary.addChild(drink)
  const cup=new Container();drink.addChild(cup)
  cup.addChild(new Graphics().moveTo(-11,-13).lineTo(11,-13).lineTo(9,13).quadraticCurveTo(0,17,-9,13).closePath().fill({color:0xc3d9e5,alpha:.32}).stroke({color:0xe5f3f2,width:1.3})
    .moveTo(-9,-5).lineTo(9,-5).lineTo(7,11).quadraticCurveTo(0,14,-7,11).closePath().fill(0xfff1d7).ellipse(0,-5,9,2.6).fill(0xfffbed))
  const pour=new Graphics();drink.addChild(pour)
  const drops=Array.from({length:12},()=>{const g=new Graphics().ellipse(0,0,1.6,3).fill(0xfff8e1);g.alpha=0;drink.addChild(g);return g})
  const settle=new Graphics();settle.label='milk-drink-settle';settle.alpha=0;temporary.addChild(settle)
  function update(time){
    fit(drink,socket('emission',true),71);const tilt=clamp((time-.2)/.35)*Math.min(1,Math.max(0,(1.5-time)/.35));cup.position.set(-27,-25);cup.rotation=tilt*.8
    pour.clear();const pouring=time>.45&&time<1.4
    if(pouring)pour.moveTo(-16,-28).quadraticCurveTo(-4,-24,0,0).stroke({color:0xfff4d7,width:3,alpha:.75,cap:'round'})
    drops.forEach((g,i)=>{const age=time-.46-i*.06,u=clamp(age/.4);g.position.set(-16*(1-u)**2,-28*(1-u));g.alpha=age>=0&&age<.4?Math.sin(Math.PI*u):0})
    fit(settle,socket('aura',true),47);settle.clear()
    for(let i=0;i<3;i++){const u=(Math.max(0,time-.8)*.8+i/3)%1;settle.ellipse(0,16*(1-u),8+u*22,3+u*6).stroke({color:0xf5e2b8,width:1.8,alpha:Math.sin(Math.PI*u)*.65})}
  }
  onFrame(update)
  tl.to(drink,{alpha:1,duration:.22},.04).to(drink,{alpha:0,duration:.35},1.48).to(settle,{alpha:1,duration:.25},.85).to(settle,{alpha:0,duration:.35},1.75)
    .call(()=>{update(1.1);onCue({type:'impact'})},[],1.1)

}
