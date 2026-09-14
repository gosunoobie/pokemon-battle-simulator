import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function ingrain(context) {
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n))
  const room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const roots=make('ingrain-roots'),tip=make('ingrain-tip'),impact=make('ingrain-impact'),pulse=make('ingrain-pulse')
  const leaves=Array.from({length:18},(_,i)=>({g:make(`ingrain-leaf-${i}`),start:.78+i*.027,phase:random()*Math.PI*2,life:.79+random()*.13,size:3+random()*3}))
  let settled=false
  function update(time){
    const floor=socket('floor'),center=socket(context.source.hasAnchor?.('visualCenter')?'visualCenter':'center',true)
    const grow=clamp((time-.06)/.98),fade=clamp((time-1.9)/.35)
    const span=Math.min(98,Math.max(42,context.source.metrics.width/unit*.43))
    const rootFit=Math.max(0,Math.min(1,(floor.x-left-4)/(span+10),(right-floor.x-4)/(span+10),(floor.y-top-4)/49,(bottom-floor.y-4)/36))
    roots.clear();roots.position.copyFrom(floor);roots.scale.set(rootFit)
    roots.alpha=time>=.06&&time<2.25?Math.min(1,(time-.06)/.14)*(1-fade):0
    for(let j=0;j<7;j++){
      const side=j%2?-1:1,extent=span*(.56+j*.06),phase=j*.73
      const points=[]
      for(let k=0;k<=30;k++){
        const u=grow*k/30,x=side*extent*u,y=Math.sin(u*Math.PI*2.25+phase)*10*u+(j%3-1)*8*u
        points.push({x,y})
      }
      for(const [width,color,alpha]of[[7,0x4c5631,.92],[4.8,j%2?0x829348:0x9aaa58,.94],[1.2,0xc5d68d,.75]]){
        points.forEach((p,k)=>k===0?roots.moveTo(p.x,p.y):roots.lineTo(p.x,p.y));roots.stroke({width,color,alpha})
      }
      for(let k=7;k<points.length;k+=7){const p=points[k];roots.moveTo(p.x,p.y).quadraticCurveTo(p.x+side*6,p.y+8,p.x+side*12,p.y+11).stroke({color:0x839647,width:1.8,alpha:.86})}
    }
    tip.clear();tip.position.copyFrom(floor);tip.scale.set(Math.min(1,room(floor)/12));tip.alpha=time>=.12&&time<2.2?Math.min(1,(time-.12)/.2,(2.2-time)/.25):0
    tip.poly([0,-8,4,-3,8,0,3,4,0,7,-4,2,-7,0,-3,-4]).fill({color:0xbad87e,alpha:.62})
    impact.clear();impact.position.copyFrom(floor);impact.scale.set(rootFit)
    const age=time-1.04;impact.alpha=settled&&age>=0&&age<.75?1-age/.75:0
    for(let j=0;j<3;j++)impact.ellipse(0,-age*(14+j*4),16+age*26+j*7,5+j*2).stroke({color:j%2?0xf1f1b5:0xbfe295,width:1.7,alpha:.7})
    const rise=clamp((time-.93)/1.12),height=Math.max(35,floor.y-center.y)*1.5
    pulse.clear();pulse.position.copyFrom(floor)
    pulse.scale.set(Math.max(0,Math.min(1,(floor.x-left-4)/(span*.67+4),(right-floor.x-4)/(span*.67+4),(floor.y-top-4)/(height+10),(bottom-floor.y-4)/18)))
    pulse.alpha=time>=.93&&time<2.12?Math.sin(rise*Math.PI)*.43:0
    for(let j=0;j<4;j++){
      const y=-height*rise+j*5,r=span*(.51+Math.sin(rise*Math.PI)*.12)
      pulse.ellipse(0,y,r,7).stroke({color:j%2?0xd1ebaa:0xe8e7a9,width:j===0?2:1,alpha:.52-j*.1})
    }
    for(const leaf of leaves){
      const age=time-leaf.start,u=clamp(age/leaf.life),reach=Math.min(span*.61,room(floor)*.55)
      const p={x:floor.x+Math.sin(leaf.phase+u*2)*reach,y:floor.y-Math.min(height*.74,room(floor)*.85)*u}
      const g=leaf.g,r=leaf.size;g.clear();g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/(r*1.8)));g.rotation=leaf.phase+u*.8
      g.alpha=age>=0&&age<leaf.life?Math.sin(u*Math.PI)*.66:0
      g.moveTo(-r,0).quadraticCurveTo(-r*.1,-r*.6,r,0).quadraticCurveTo(0,r*.6,-r,0).fill(0xc6df8d)
    }
  }
  onFrame(update)
  tl.call(()=>{settled=true;update(1.04);onCue({type:'impact'})},[],1.04).call(()=>{},[],2.35)
}
