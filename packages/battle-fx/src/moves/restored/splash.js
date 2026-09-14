import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function splash(context){
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('splash-root'),tip=make('splash-tip'),impact=make('splash-impact'),floor=make('splash-floor-ripples')
  root.attachmentSocket='center'
  const drops=Array.from({length:16},(_,i)=>({g:make(`splash-drop-${i}`),start:.76+i*.018,side:i%2?1:-1,speed:.27+random()*.33,rise:.2+random()*.2,size:1.4+random()*1.5}))
  let landed=false
  function update(time){
    // Three small, harmless hops retain the actor silhouette and use only available headroom.
    const actor=context.source;actor.pose.y=0
    const body=actor.anchor('visualCenter'),angle=actor.pose.rotation
    const halfHeight=(actor.metrics.height*Math.abs(Math.cos(angle))+actor.metrics.width*Math.abs(Math.sin(angle)))/2
    const lift=Math.min(18*unit,Math.max(0,body.y-halfHeight-4))
    const hops=[[.12,.30,1],[.46,.30,.78],[.89,.30,.5]]
    let jump=0;for(const [start,duration,strength] of hops){const v=(time-start)/duration;if(v>0&&v<1)jump=Math.max(jump,Math.sin(v*Math.PI)*strength)}
    actor.pose.y=-lift*jump
    const c=socket('center',true),rest=socket('center'),baseBody=actor.base('visualCenter'),groundWorld={x:baseBody.x,y:baseBody.y+actor.metrics.height/2}
    const ground={x:(groundWorld.x-temporary.x)/temporary.scale.x,y:(groundWorld.y-temporary.y)/unit}
    const age=time-.76,u=clamp(age/.62)
    root.clear();fit(root,c,47);root.alpha=time>=.08&&time<1.31?clamp((time-.08)/.12)*(1-clamp((time-1.03)/.28)):0
    for(const side of[-1,1])root.moveTo(side*24,12).quadraticCurveTo(side*36,-2,side*28,-18)
      .stroke({color:0xaac9d4,width:1.5,alpha:.62,cap:'round'})
    floor.clear();fit(floor,ground,75);floor.alpha=time>.32&&time<1.52?1-clamp((time-1.1)/.42):0
    for(const at of[.42,.76,1.19]){const v=clamp((time-at)/.47);if(time>=at&&v<1)floor.ellipse(0,0,15+v*45,3+v*8).stroke({color:0xb9d3dc,width:1.5-v*.6,alpha:(1-v)*.47})}
    tip.clear();fit(tip,c,28);tip.alpha=time>=.65&&time<1.13?1-clamp((time-.83)/.3):0
    // A little contact twinkle marks the futile landing, without an offensive hit flash.
    tip.moveTo(-14,0).quadraticCurveTo(0,8,14,0).moveTo(0,-7).lineTo(0,6).stroke({color:0xd2e5e8,width:1.7,alpha:.82,cap:'round'})
    impact.clear();fit(impact,c,43);impact.alpha=landed&&age>=0&&age<.62?1-u:0
    impact.ellipse(0,4,14+u*20,5+u*6).stroke({color:0xc1dbe3,width:1.2,alpha:.55})
    drops.forEach(p=>{
      const age=time-p.start,v=clamp(age/.96),r=Math.min(68,room(rest)*.75),at={x:rest.x+p.side*r*(.19+v*p.speed),y:rest.y+r*(.27-p.rise*v+v*v*.64)}
      const g=p.g;g.clear();fit(g,at,8);g.rotation=p.side*(.3-v*.3)
      g.alpha=landed&&age>=0&&age<.96?clamp(age/.1)*(1-clamp((v-.53)/.47))*.65:0
      g.ellipse(0,0,p.size*.78,p.size*(1.35+v*.35)).fill({color:p.side>0?0xc1dfe8:0xaccbdc,alpha:.7}).circle(-.4,-.8,p.size*.32).fill(0xe7f4f2)
    })
  }
  onFrame(update)
  tl.call(()=>{landed=true;update(.76);onCue({type:'impact'})},[],.76).to({}, {duration:1.85},0)
}
