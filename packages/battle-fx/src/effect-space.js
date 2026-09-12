import { Container, Point } from 'pixi.js'

/** Coordinate/ownership adapter only. It defines no attack shapes, particles or choreography. */
export function bindEffectSpace({ layer, source, target, scene }) {
  const unit = Math.min(scene.unit * 1.25, Math.max(scene.unit * .6, target.metrics.height / 168.90625))
  const sign = source === target ? (source.facing < 0 ? -1 : 1) : (target.base('center').x < source.base('center').x ? -1 : 1)
  const origin = source.base('origin')
  const temporary = new Container(); temporary.label='move-artwork'
  temporary.position.copyFrom(origin); temporary.scale.set(sign * unit, unit); layer.addChild(temporary)
  const local = p => ({ x: (p.x-origin.x)/(sign*unit), y:(p.y-origin.y)/unit })
  const home = { x:0,y:0 }, defenderHome=local(target.base('origin'))
  const focus=local(target.base('center')), floor=local(target.base('floor'))
  const socket=(name,posed=false)=>local(posed?source.anchor(name):source.base(name))
  const targetSocket=(name,posed=false)=>local(posed?target.anchor(name):target.base(name))
  const emission=socket('emission')
  function actorProxy(actor,base){
    const result={scale:actor.pose.scale,anchor:new Point(.5,1)}
    for(const key of ['x','y'])Object.defineProperty(result,key,{
      enumerable:true,get:()=>base[key]+actor.pose[key]/(unit*(key==='x'?sign:1)),
      set:v=>{const offset=v-base[key];actor.pose[key]=offset===0?0:offset*unit*(key==='x'?sign:1)},
    })
    Object.defineProperty(result,'rotation',{enumerable:true,get:()=>actor.pose.rotation*sign,set:v=>{actor.pose.rotation=v===0?0:v*sign}})
    for(const key of ['alpha','tint'])Object.defineProperty(result,key,{enumerable:true,get:()=>actor.pose[key],set:v=>{actor.pose[key]=v}})
    result.position={get x(){return result.x},get y(){return result.y},set(x,y=x){result.x=x;result.y=y;return this},copyFrom(p){return this.set(p.x,p.y)}}
    return result
  }
  const attacker=actorProxy(source,home),defender=actorProxy(target,defenderHome)
  const world={};for(const key of ['x','y'])Object.defineProperty(world,key,{enumerable:true,get:()=>scene.camera[key]/(unit*(key==='x'?sign:1)),set:v=>{scene.camera[key]=v===0?0:v*unit*(key==='x'?sign:1)}})
  function solveContact(name,rotation,point=focus){
    const p=socket(name),cos=Math.cos(rotation),sin=Math.sin(rotation)
    return {x:point.x-p.x*cos+p.y*sin,y:point.y-p.x*sin-p.y*cos,rotation}
  }
  function captureActor(){
    const wrapper=new Container();wrapper.anchor=new Point(.5,1)
    const image=source.snapshot?.()
    if(image){image.position.set(0,0);image.rotation=0;image.scale.set(sign/unit,1/unit);wrapper.addChild(image)}
    return wrapper
  }
  return {temporary,attacker,defender,home,defenderHome,focus,floor,emission,socket,targetSocket,solveContact,captureActor,world,unit,gridOrigin:{x:origin.x/(sign*unit),y:origin.y/unit}}
}
