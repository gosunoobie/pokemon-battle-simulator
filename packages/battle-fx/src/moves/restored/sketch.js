import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function sketch(context) {
  const { tl, random, onFrame, onCue }=context
  const { temporary, socket, targetSocket, unit }=bindEffectSpace(context)
  const e=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x],left=Math.min(...e),right=Math.max(...e),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g},fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('sketch-root'),line=make('sketch-pencil-line'),tip=make('sketch-tip'),paper=make('sketch-study'),impact=make('sketch-impact')
  const dust=Array.from({length:16},(_,i)=>({g:make(`sketch-fleck-${i}`),angle:i*Math.PI/8,start:1.14+i%5*.10,life:.64+random()*.15,size:1.8+random()*1.5}))
  let struck=false
  function route(a,b,u){const reach=Math.min(29,room(a)*.36,room(b)*.36);return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u+Math.sin(u*Math.PI*2)*Math.sin(u*Math.PI)*reach}}
  function update(time){
    const a=socket('hand',true),b=targetSocket('center',true),angle=Math.atan2(b.y-a.y,b.x-a.x)
    root.clear();fit(root,a,50);root.rotation=angle-.3+Math.sin(time*13)*.12;root.alpha=time>.025&&time<.72?Math.min(1,(time-.025)/.12,(.72-time)/.26):0
    root.poly([3,0,-11,-6,-38,-5,-44,0,-38,5,-11,6]).fill({color:0xdcc29a,alpha:.75})
      .poly([3,0,-11,-6,-11,6]).fill(0x504b4a).moveTo(-36,-2).lineTo(-13,-2).stroke({color:0xffedc7,width:2})
    const u=clamp((time-.38)/.7),p=route(a,b,u),previous=route(a,b,Math.max(0,u-.002));tip.clear();fit(tip,p,34)
    tip.rotation=u>.002?Math.atan2(p.y-previous.y,p.x-previous.x):angle
    tip.alpha=time>=.38&&time<1.29?Math.min(1,(1.29-time)/.21):0
    tip.poly([0,0,-13,-7,-29,-5,-29,5,-13,7]).fill(0xd6b886).poly([0,0,-13,-7,-13,7]).fill(0x514754)
      .moveTo(-14,-3).lineTo(-27,-2).stroke({color:0xfff0ce,width:2.4,alpha:.9})
    line.clear();line.alpha=time>=.38&&time<1.65?Math.min(1,(1.65-time)/.52)*.57:0
    for(let j=0;j<2;j++){
      const end=u,start=Math.max(0,u-.29),count=20
      for(let k=0;k<=count;k++){const v=start+(end-start)*k/count,q=route(a,b,v),off=Math.sin(v*53+j)*Math.min(1.5,room(q)*.2);if(k===0)line.moveTo(q.x,q.y+off);else line.lineTo(q.x,q.y+off)}
      line.stroke({color:j?0xe7cfa9:0x65546b,width:j?.8:1.4,alpha:j?.8:.65,cap:'round'})
    }
    const age=time-1.08,draw=clamp(age/.54),fade=clamp((time-1.91)/.38)
    paper.clear();fit(paper,b,102);paper.alpha=struck&&age>=0&&time<2.29?(1-fade)*.92:0
    // Open paper corners and an evolving study keep the receiver legible.
    for(const sx of [-1,1])for(const sy of [-1,1])paper.moveTo(sx*29,sy*60).lineTo(sx*42,sy*60).lineTo(sx*42,sy*47).stroke({color:0xf0dfbb,width:2,alpha:.65})
    const outline=[[-27,39],[-34,14],[-23,-3],[-18,-28],[0,-42],[18,-30],[23,-2],[35,13],[28,39],[10,45],[-9,44],[-27,39]]
    const segments=draw*(outline.length-1),full=Math.floor(segments)
    if(draw>0){paper.moveTo(...outline[0]);for(let k=1;k<=full;k++)paper.lineTo(...outline[k]);if(full<outline.length-1){const q=outline[full],r=outline[full+1],v=segments-full;paper.lineTo(q[0]+(r[0]-q[0])*v,q[1]+(r[1]-q[1])*v)}paper.stroke({color:0xe2c797,width:2.2,alpha:.85})}
    for(let j=0;j<5;j++)if(draw>.35+j*.10){const yy=-13+j*10;paper.moveTo(-13,yy+5).lineTo(16,yy-5).stroke({color:0xa79582,width:1,alpha:.42})}
    impact.clear();fit(impact,b,43);impact.alpha=struck&&age>=0&&age<.48?1-age/.48:0
    const r=5+clamp(age/.4)*20;impact.circle(0,0,r).stroke({color:0xffedcc,width:1.4,alpha:.85})
    for(let j=0;j<5;j++){const t=j*Math.PI*2/5;impact.moveTo(Math.cos(t)*r*1.2,Math.sin(t)*r*1.2).lineTo(Math.cos(t)*(r+11),Math.sin(t)*(r+11)).stroke({color:0xd7b689,width:1.6})}
    for(const f of dust){
      const age=time-f.start,u=clamp(age/f.life),d=Math.min(66,room(b)*.58),p={x:b.x+Math.cos(f.angle)*d*(.27+.73*u),y:b.y+Math.sin(f.angle)*d*.44+d*.23*u*u},g=f.g,r=f.size
      g.clear();fit(g,p,r*2);g.rotation=f.angle+u*4;g.alpha=struck&&age>=0&&age<f.life?Math.min(1,age/.04,(f.life-age)/.24)*.75:0
      g.moveTo(-r,0).lineTo(r,0).stroke({color:f.angle<Math.PI?0xe9cda0:0x9b887e,width:1.6,cap:'round'})
    }
  }
  onFrame(update);tl.call(()=>{struck=true;update(1.08);onCue({type:'impact'})},[],1.08).to({},{duration:2.35},0)
}
