import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function detect(context){
  const{tl,random,onFrame,onCue}=context
  const{temporary,socket,unit}=bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('eyes')?'eyes':'emission'
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const eyes=make('detect-eye-glint'),tip=make('detect-tip'),impact=make('detect-impact')
  const guard=new Container();guard.label='detect-guard';temporary.addChild(guard)
  const arcs=new Graphics();guard.addChild(arcs)
  const rx=Math.max(33,context.source.metrics.width/unit*.57),ry=Math.max(39,context.source.metrics.height/unit*.54)
  const streaks=Array.from({length:12},(_,i)=>({g:make(`detect-streak-${i}`),start:.54+i*.013,angle:i*Math.PI/6,phase:random()*.3,life:.4+random()*.16}))
  let aware=false
  function update(time){
    const center=socket('center',true),body=socket(context.source.hasAnchor?.('visualCenter')?'visualCenter':'center',true),eye=socket(attachment,true)
    const fit=Math.max(0,Math.min(1,(body.x-left-4)/(rx+7),(right-body.x-4)/(rx+7),(body.y-top-4)/(ry+7),(bottom-body.y-4)/(ry+7)))
    eyes.clear();eyes.position.copyFrom(eye);eyes.scale.set(Math.min(1,room(eye)/34))
    const eyePulse=clamp((time-.07)/.28)
    eyes.alpha=time>=.07&&time<.92?Math.min(1,(time-.07)/.1,(.92-time)/.25):0
    eyes.poly([-28*eyePulse,0,-4,-1.5,0,-11,3,-1.5,28*eyePulse,0,3,1.5,0,11,-4,1.5]).fill(0xf5efb0)
      .moveTo(-24*eyePulse,0).lineTo(24*eyePulse,0).stroke({color:0xfdffe2,width:1.5,alpha:.97})
    guard.position.copyFrom(body);guard.scale.set(fit)
    const open=clamp((time-.21)/.33),fade=clamp((time-1.01)/.3)
    guard.alpha=time>=.21&&time<1.31?Math.min(1,(time-.21)/.14)*(1-fade):0
    arcs.clear()
    // Open angular guard corners and short scanning arcs keep this distinct from a dome.
    for(const side of[-1,1]){
      const x=side*rx*(.82+open*.18),y=ry*(.76+open*.19)
      arcs.moveTo(x*.62,-y).lineTo(x,-y*.64).lineTo(x,-y*.32)
        .moveTo(x,y*.32).lineTo(x,y*.64).lineTo(x*.62,y)
        .stroke({color:side>0?0xccecb6:0x83c6c0,width:1.9,alpha:.78})
    }
    for(let j=0;j<3;j++){
      const theta=time*(j%2?3.1:-2.3)+j*2.1,radius=.88-j*.095
      for(let k=0;k<=22;k++){
        const q=theta+k*.034,x=Math.cos(q)*rx*radius,y=Math.sin(q)*ry*radius
        if(k===0)arcs.moveTo(x,y);else arcs.lineTo(x,y)
      }
      arcs.stroke({color:j===1?0xf0dc91:0x9ddbd0,width:j===1?2:1.2,alpha:.84-j*.13})
    }
    const age=time-.54,u=clamp(age/.43)
    tip.clear();tip.position.copyFrom(center);tip.scale.set(Math.min(1,room(center)/23))
    tip.alpha=time>=.35&&time<.96?Math.min(1,(time-.35)/.12,(.96-time)/.23):0
    tip.poly([0,-16,2,-3,17,0,2,3,0,16,-2,3,-17,0,-2,-3]).fill({color:0xc8f1d4,alpha:.6})
    impact.clear();impact.position.copyFrom(center);impact.scale.set(Math.min(1,room(center)/39))
    impact.alpha=aware&&age>=0&&age<.43?1-u:0
    impact.moveTo(-27,0).lineTo(-7,0).lineTo(0,-19).lineTo(7,0).lineTo(27,0)
      .moveTo(-7,0).lineTo(0,19).lineTo(7,0).stroke({color:0xf5f2bc,width:2,alpha:.89})
    for(const streak of streaks){
      const age=time-streak.start,u=clamp(age/streak.life),theta=streak.angle+u*.34
      const p={x:body.x+Math.cos(theta)*rx*(.7+u*.2)*fit,y:body.y+Math.sin(theta)*ry*(.7+u*.2)*fit}
      const g=streak.g;g.clear();g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/10));g.rotation=theta+Math.PI/2
      g.alpha=age>=0&&age<streak.life?Math.sin(u*Math.PI)*.85:0
      g.poly([-7,0,0,-1.5,7,0,0,1.5]).fill(streak.angle<Math.PI?0xeae4a0:0xb7e2cf)
    }
  }
  onFrame(update)
  tl.call(()=>{aware=true;update(.54);onCue({type:'impact'})},[],.54).call(()=>{},[],1.65)
}
