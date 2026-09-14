import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function wrap(context){
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('wrap-root'),ribbon=make('wrap-unfurling-band'),tip=make('wrap-tip'),impact=make('wrap-impact')
  root.attachmentSocket='emission';tip.contactPoint={x:0,y:0}
  const tails=Array.from({length:9},(_,i)=>({g:make(`wrap-tail-${i}`),phase:i*2.4,start:1.1+i*.023,size:5+random()*4}))
  let wrapped=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),u=clamp((time-.34)/.56),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}
    root.clear();fit(root,a,32);root.alpha=time>.06&&time<1.16?clamp((time-.06)/.18)*(1-clamp((time-.77)/.39)):0
    root.moveTo(-18,7).quadraticCurveTo(4,-22,20,-7).quadraticCurveTo(29,7,4,16).stroke({color:0xe6c49a,width:8,alpha:.6})
    ribbon.clear();ribbon.alpha=time>=.34&&time<1.18?1-clamp((time-.91)/.27):0
    const upper=[],lower=[]
    for(let j=0;j<=44;j++){const v=u*j/44,q={x:a.x+(b.x-a.x)*v,y:a.y+(b.y-a.y)*v},edge=Math.min(6,room(q)*.26)*Math.sin(j/44*Math.PI),sway=Math.sin(v*9-time*4)*Math.min(23,room(q)*.32)*Math.sin(j/44*Math.PI);upper.push(q.x,q.y+sway-edge);lower.unshift(q.y+sway+edge);lower.unshift(q.x)}
    ribbon.poly([...upper,...lower]).fill({color:0xcda77d,alpha:.78}).stroke({color:0xf0d6aa,width:1.2,alpha:.85})
    tip.clear();fit(tip,p,36);tip.rotation=Math.atan2(b.y-a.y,b.x-a.x);tip.alpha=time>=.34&&time<1.21?1-clamp((time-.96)/.25):0
    tip.poly([0,0,-15,-10,-28,-5,-19,4,-25,12,-10,9]).fill({color:0xecd0a2,alpha:.94}).stroke({color:0xb99775,width:1.2,alpha:.85})
    const age=time-.9,open=clamp(age/.33),loose=clamp((age-.64)/.59)
    impact.clear();fit(impact,b,104);impact.alpha=wrapped&&age>=0&&age<1.23?1-clamp((age-.76)/.47):0
    // Three broad cloth-like loops wrap on different diagonals, leaving open gaps over the actor.
    for(let band=0;band<3;band++){
      const vertices=[],bottomEdge=[],y0=(band-1)*27,width=61+open*15+loose*9
      for(let j=0;j<=44;j++){const q=j/44*Math.PI*2,x=Math.cos(q)*width,y=y0+Math.sin(q)*16+(x/width)*(band%2?13:-13)+loose*Math.sin(q+time*2)*8;vertices.push(x,y-4.2);bottomEdge.unshift(y+4.2);bottomEdge.unshift(x)}
      impact.poly([...vertices,...bottomEdge]).fill({color:band%2?0xddbb8e:0xf0d7ae,alpha:.63})
        .stroke({color:0xa98768,width:1,alpha:.62})
    }
    tails.forEach(f=>{const age=time-f.start,v=clamp(age/.98),r=Math.min(84,room(b)*.69),at={x:b.x+Math.cos(f.phase+v*.7)*r*(.3+v*.62),y:b.y+Math.sin(f.phase)*r*.36+r*v*.39},g=f.g
      g.clear();fit(g,at,24);g.rotation=Math.sin(time*4+f.phase)*.3+f.phase;g.alpha=wrapped&&age>=0&&age<.98?clamp(age/.13)*(1-clamp((v-.54)/.46))*.72:0
      const s=f.size;g.moveTo(-s,-3).quadraticCurveTo(0,-8,s,1).lineTo(s,5).quadraticCurveTo(0,-2,-s,3).closePath().fill({color:0xe4c79f,alpha:.7})})
  }
  onFrame(update)
  tl.call(()=>update(.34),[],.34).call(()=>{wrapped=true;update(.9);onCue({type:'impact'})},[],.9).to({}, {duration:2.25},0)
}
