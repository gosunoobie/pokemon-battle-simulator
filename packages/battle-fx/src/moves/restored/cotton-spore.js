import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function cottonSpore(context){
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('cotton-spore-root'),tip=make('cotton-spore-tip'),impact=make('cotton-spore-impact')
  root.attachmentSocket='emission';tip.contactPoint={x:0,y:0}
  const tufts=Array.from({length:22},(_,i)=>({g:make(`cotton-spore-tuft-${i}`),start:.42+i*.024,phase:random()*6.28,side:i%2?1:-1,size:3.7+random()*3.6}))
  const down=Array.from({length:16},(_,i)=>({g:make(`cotton-spore-down-${i}`),phase:random()*6.28,start:1.08+i*.017,size:1.8+random()*2.6}))
  let dusted=false
  function route(v,time,a,b,phase=0){const p={x:a.x+(b.x-a.x)*v,y:a.y+(b.y-a.y)*v};p.y+=Math.sin(v*Math.PI)*Math.sin(time*3+phase+v*2)*Math.min(37,room(p)*.39);return p}
  function tuft(g,r){
    for(let i=0;i<6;i++){const q=i*Math.PI/3;g.circle(Math.cos(q)*r*.5,Math.sin(q)*r*.5,r*.62).fill({color:i%2?0xf0eddf:0xd8d6c5,alpha:.72})}
    g.circle(-r*.2,-r*.2,r*.56).fill({color:0xfffbed,alpha:.72})
      .moveTo(-r*.5,0).quadraticCurveTo(0,r*.27,r*.4,-r*.2).stroke({color:0xc3c5b3,width:.8,alpha:.6})
  }
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),u=clamp((time-.38)/.7),p=route(u,time,a,b)
    root.clear();fit(root,a,33);root.alpha=time>.08&&time<1.27?clamp((time-.08)/.19)*(1-clamp((time-.91)/.36)):0
    for(let i=0;i<5;i++){const q=i*1.256+time*.8,r=11+Math.sin(time*3)*3;root.circle(Math.cos(q)*r,Math.sin(q)*r,6).fill({color:0xe4e4cf,alpha:.43})}
    tip.clear();fit(tip,p,45);tip.rotation=Math.atan2(b.y-a.y,b.x-a.x);tip.alpha=time>=.38&&time<1.39?1-clamp((time-1.12)/.27):0
    for(const[x,y,r]of[[-8,0,8],[-17,-7,9],[-27,1,10],[-17,9,8]])tip.circle(x,y,r).fill({color:0xe8e7d6,alpha:.81})
    tip.circle(-13,-3,6).fill({color:0xfffbea,alpha:.74})
    tufts.forEach(f=>{
      const age=time-f.start,v=clamp(age/.83),at=route(v,time,a,b,f.phase),g=f.g
      at.y+=Math.sin(v*Math.PI)*f.side*Math.min(18,room(at)*.23)
      g.clear();fit(g,at,17);g.rotation=Math.sin(time*2.5+f.phase)*.4;g.alpha=age>=0&&age<1.28?clamp(age/.14)*(1-clamp((age-.73)/.55))*.8:0;tuft(g,f.size)
    })
    const age=time-1.08,v=clamp(age/1.2),radius=25+v*33
    impact.clear();fit(impact,b,88);impact.alpha=dusted&&age>=0&&age<1.2?1-clamp((age-.56)/.64):0
    // Cotton puffs bloom as a loose halo with clear gaps instead of an opaque powder cloud.
    for(let i=0;i<9;i++){const q=i*Math.PI*2/9+time*.34,x=Math.cos(q)*radius,y=Math.sin(q)*radius*.67;impact.circle(x,y,5+(i%3)*1.7).fill({color:i%2?0xf1eedb:0xd9dcc8,alpha:.44})}
    down.forEach(f=>{const age=time-f.start,v=clamp(age/1.21),r=Math.min(95,room(b)*.77),at={x:b.x+Math.cos(f.phase+v*.9)*r*(.25+v*.48),y:b.y+Math.sin(f.phase)*r*.28+r*(.13*v+.34*v*v)},g=f.g
      g.clear();fit(g,at,10);g.rotation=f.phase+v*.8;g.alpha=dusted&&age>=0&&age<1.21?clamp(age/.16)*(1-clamp((v-.58)/.42))*.78:0
      tuft(g,f.size)
    })
  }
  onFrame(update)
  tl.call(()=>update(.38),[],.38).call(()=>{dusted=true;update(1.08);onCue({type:'impact'})},[],1.08).to({}, {duration:2.55},0)
}
