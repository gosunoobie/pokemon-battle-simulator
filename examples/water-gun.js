// Inactive teaching recipe. It owns its artwork and has no battle-state dependency.
import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../packages/battle-fx/src/effect-space.js'
export function buildWaterGun(context) {
  const { tl, onCue }=context
  const { temporary, emission, focus }=bindEffectSpace(context)
  const jet=new Graphics(),splash=new Graphics(),state={reach:0}
  temporary.addChild(jet,splash);jet.alpha=splash.alpha=0
  splash.circle(0,0,18).stroke({width:3,color:0xc8f4ff});splash.position.copyFrom(focus)
  const draw=()=>{jet.clear();for(const [width,color]of[[10,0x67c8ed],[3,0xe2fcff]])jet.moveTo(emission.x,emission.y).lineTo(emission.x+(focus.x-emission.x)*state.reach,emission.y+(focus.y-emission.y)*state.reach).stroke({width,color,cap:'round'})}
  tl.to(jet,{alpha:.9,duration:.05},.25).to(state,{reach:1,duration:.2,onUpdate:draw},.25)
    .call(()=>onCue({type:'impact'}),[],.45).to(splash,{alpha:.8,duration:.05},.45)
    .to(splash.scale,{x:2,y:2,duration:.35},.45).to(splash,{alpha:0,duration:.3},.5)
    .to(jet,{alpha:0,duration:.2},.65).call(()=>{},[],1.3)
}
