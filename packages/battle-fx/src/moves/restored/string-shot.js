import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function stringShot(context){
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('string-shot-root'),silk=make('string-shot-silk'),tip=make('string-shot-tip'),impact=make('string-shot-impact')
  root.attachmentSocket='emission';tip.contactPoint={x:0,y:0}
  const beads=Array.from({length:18},(_,i)=>({g:make(`string-shot-bead-${i}`),phase:random()*6.28,start:.74+i*.014,r:1.5+random()*2}))
  let stuck=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),u=clamp((time-.26)/.48),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}
    root.clear();fit(root,a,23);root.alpha=time>.03&&time<1.07?clamp((time-.03)/.13)*(1-clamp((time-.66)/.41)):0
    root.ellipse(0,0,9,5).fill({color:0xe9e4c2,alpha:.76}).circle(-6,-5,4).fill({color:0xf4efd7,alpha:.65})
    silk.clear();silk.alpha=time>=.26&&time<1.15?1-clamp((time-.8)/.35):0
    for(let i=0;i<3;i++){
      for(let j=0;j<=62;j++){const v=u*j/62,q={x:a.x+(b.x-a.x)*v,y:a.y+(b.y-a.y)*v},sway=Math.sin(v*36-time*8+i)*Math.min(8,room(q)*.24)*Math.sin(j/62*Math.PI);q.y+=sway;j?silk.lineTo(q.x,q.y):silk.moveTo(q.x,q.y)}
      silk.stroke({color:i?0xf2edd2:0xc7c4a5,width:i?1.2:3.4,alpha:i?.64:.7,cap:'round'})
    }
    tip.clear();fit(tip,p,27);tip.rotation=Math.atan2(b.y-a.y,b.x-a.x);tip.alpha=time>=.26&&time<1.05?1-clamp((time-.8)/.25):0
    tip.moveTo(0,0).quadraticCurveTo(-6,-10,-17,-5).quadraticCurveTo(-27,1,-15,7).quadraticCurveTo(-4,12,0,0).fill({color:0xf2efd6,alpha:.88})
      .moveTo(-18,-3).lineTo(-5,-2).stroke({color:0xffffff,width:1.5,alpha:.76})
    const age=time-.74,spread=clamp(age/.31),sag=clamp((age-.4)/.7)
    impact.clear();fit(impact,b,84);impact.alpha=stuck&&age>=0&&age<1.09?1-clamp((age-.59)/.5):0
    // Sticky uneven crossings hang in loose strings instead of forming a geometric spider web.
    for(let i=0;i<7;i++){
      const side=i%2?1:-1,x=side*(29+spread*29),y=(i-3)*12
      impact.moveTo(-x,y-17).quadraticCurveTo(-x*.2,y+29+sag*13,x,y+9).stroke({color:i%2?0xe8e1b9:0xf4efd8,width:2.1,alpha:.8,cap:'round'})
      impact.circle(x,y+9,2.5).fill({color:0xe8e3c1,alpha:.8})
    }
    beads.forEach(f=>{const age=time-f.start,v=clamp(age/1.05),r=Math.min(77,room(b)*.7),at={x:b.x+Math.cos(f.phase)*r*(.3+v*.39),y:b.y+Math.sin(f.phase)*r*.3+r*(.14*v+.42*v*v)},g=f.g
      g.clear();fit(g,at,9);g.alpha=stuck&&age>=0&&age<1.05?clamp(age/.12)*(1-clamp((v-.54)/.46))*.74:0
      g.ellipse(0,0,f.r,f.r*(1+v*.7)).fill({color:0xeae7c9,alpha:.75}).circle(-.5,-.6,f.r*.34).fill({color:0xffffff,alpha:.8})})
  }
  onFrame(update)
  tl.call(()=>update(.26),[],.26).call(()=>{stuck=true;update(.74);onCue({type:'impact'})},[],.74).to({}, {duration:1.95},0)
}
