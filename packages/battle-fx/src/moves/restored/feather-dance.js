import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function featherDance(context){
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('feather-dance-root'),tip=make('feather-dance-tip'),impact=make('feather-dance-impact')
  root.attachmentSocket='emission';tip.contactPoint={x:0,y:0}
  const feathers=Array.from({length:16},(_,i)=>({g:make(`feather-dance-feather-${i}`),start:.43+i*.032,phase:random()*6.28,side:i%2?1:-1,size:.4+random()*.36}))
  const fallen=Array.from({length:14},(_,i)=>({g:make(`feather-dance-fallen-${i}`),start:1.1+i*.019,phase:random()*6.28,size:.32+random()*.26}))
  let danced=false
  function feather(g,size=1){
    g.moveTo(0,0).bezierCurveTo(-8,-15*size,-34*size,-19*size,-49*size,-3*size)
      .quadraticCurveTo(-28*size,17*size,0,0).fill({color:0xefdae0,alpha:.78})
      .moveTo(0,0).quadraticCurveTo(-21*size,-2*size,-53*size,5*size).stroke({color:0xb9a8b5,width:1.3,alpha:.81})
    for(let i=1;i<6;i++){const x=-i*7*size;g.moveTo(x,0).lineTo(x-7*size,-(9-i*.7)*size).moveTo(x,1).lineTo(x-7*size,(7-i*.6)*size).stroke({color:i%2?0xfff0ed:0xcdbdc9,width:.9,alpha:.65})}
  }
  function route(v,time,a,b,phase=0){const p={x:a.x+(b.x-a.x)*v,y:a.y+(b.y-a.y)*v};p.y+=Math.sin(v*Math.PI)*Math.cos(time*3+v*4+phase)*Math.min(44,room(p)*.38);return p}
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),u=clamp((time-.4)/.7),p=route(u,time,a,b)
    root.clear();fit(root,a,37);root.alpha=time>.08&&time<1.36?clamp((time-.08)/.18)*(1-clamp((time-.96)/.4)):0
    for(const side of[-1,1])root.moveTo(-7,side*9).quadraticCurveTo(10,side*25,24,side*8).stroke({color:0xe7cfd8,width:2,alpha:.66,cap:'round'})
    tip.clear();fit(tip,p,82);tip.rotation=Math.atan2(b.y-a.y,b.x-a.x);tip.alpha=time>=.4&&time<1.43?1-clamp((time-1.16)/.27):0;feather(tip)
    feathers.forEach(f=>{const age=time-f.start,v=clamp(age/.89),at=route(v,time,a,b,f.phase),g=f.g
      at.y+=f.side*Math.sin(v*Math.PI)*Math.min(19,room(at)*.22)
      g.clear();fit(g,at,50);g.rotation=Math.atan2(b.y-a.y,b.x-a.x)+Math.sin(time*6+f.phase)*.65
      g.alpha=age>=0&&age<1.35?clamp(age/.13)*(1-clamp((age-.77)/.58))*.82:0;feather(g,f.size)
    })
    const age=time-1.1,v=clamp(age/1.22)
    impact.clear();fit(impact,b,94);impact.alpha=danced&&age>=0&&age<1.22?1-clamp((age-.5)/.72):0
    for(let k=0;k<3;k++){const q=time*2+k*2.1,r=34+v*36;for(let j=0;j<=20;j++){const a=q+j*.052,x=Math.cos(a)*r,y=Math.sin(a)*r*.62;j?impact.lineTo(x,y):impact.moveTo(x,y)}impact.stroke({color:k%2?0xe1c4d3:0xf4e5dd,width:1.4,alpha:.52})}
    fallen.forEach(f=>{const age=time-f.start,v=clamp(age/1.25),r=Math.min(106,room(b)*.76),at={x:b.x+Math.cos(f.phase)*r*.4+Math.sin(time*3+f.phase)*r*.12,y:b.y+Math.sin(f.phase)*r*.22+r*(.12*v+.49*v*v)},g=f.g
      g.clear();fit(g,at,44);g.rotation=f.phase+Math.sin(time*4+f.phase)*.6;g.alpha=danced&&age>=0&&age<1.25?clamp(age/.18)*(1-clamp((v-.56)/.44))*.83:0;feather(g,f.size)})
  }
  onFrame(update)
  tl.call(()=>update(.4),[],.4).call(()=>{danced=true;update(1.1);onCue({type:'impact'})},[],1.1).to({}, {duration:2.6},0)
}
