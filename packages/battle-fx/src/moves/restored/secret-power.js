import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function secretPower(context){
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('secret-power-root'),tip=make('secret-power-tip'),impact=make('secret-power-impact')
  root.attachmentSocket='emission';tip.contactPoint={x:0,y:0}
  const traces=Array.from({length:5},(_,i)=>({g:make(`secret-power-trace-${i}`),delay:i*.038}))
  const fragments=Array.from({length:24},(_,i)=>({g:make(`secret-power-fragment-${i}`),angle:i*Math.PI/12+random()*.13,start:.84+i*.01,size:2+random()*3,speed:.43+random()*.28}))
  let struck=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),u=clamp((time-.38)/.46),front={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}
    const angle=Math.atan2(b.y-a.y,b.x-a.x),charge=clamp(time/.38)
    root.clear();fit(root,a,44);root.rotation=time*1.8
    root.alpha=time>=.04&&time<.79?clamp((time-.04)/.13)*(1-clamp((time-.43)/.36)):0
    // Neutral pearl and sandstone facets gather without selecting a terrain or secondary status.
    for(let i=0;i<3;i++){
      const q=i*Math.PI*2/3,r=21*(1-charge*.44),x=Math.cos(q)*r,y=Math.sin(q)*r
      root.poly([x,y-11,x+8,y,x,y+11,x-8,y]).fill({color:i===1?0xceb181:0xe6d6ad,alpha:.49}).stroke({color:0xf1e7ca,width:1.2,alpha:.79})
    }
    tip.clear();fit(tip,front,66);tip.rotation=angle;tip.alpha=time>=.38&&time<1.16?1-clamp((time-.89)/.27):0
    tip.poly([0,0,-20,-22,-42,-16,-53,0,-39,19,-20,23]).fill({color:0xc9af87,alpha:.78})
      .poly([0,0,-22,-11,-39,0,-22,11]).fill({color:0xf5e7c3,alpha:.92})
      .moveTo(-20,-22).lineTo(-22,-11).lineTo(-42,-16).moveTo(-22,11).lineTo(-20,23).moveTo(-39,0).lineTo(-53,0)
      .stroke({color:0xe8d4b0,width:1.5,alpha:.89})
      .moveTo(-8,0).lineTo(-34,0).stroke({color:0xfff5da,width:2.2,alpha:.94})
    traces.forEach(p=>{
      const age=time-.38-p.delay,v=clamp(age/.46),at={x:a.x+(b.x-a.x)*v,y:a.y+(b.y-a.y)*v},g=p.g
      g.clear();fit(g,at,23);g.rotation=angle+time*(p.delay>.08?-.6:.6)
      g.alpha=age>=0&&age<.81?clamp(age/.09)*(1-clamp((age-.39)/.42))*.37:0
      g.poly([0,-14,12,-7,12,7,0,14,-12,7,-12,-7]).stroke({color:p.delay>.08?0xddc999:0xf3e9ce,width:1.6,alpha:.7})
    })
    const age=time-.84,v=clamp(age/.74)
    impact.clear();fit(impact,b,123);impact.rotation=time*.35;impact.alpha=struck&&age>=0&&age<.74?1-v:0
    for(let i=0;i<8;i++){
      const q=i*Math.PI/4,r=15+v*23,outer=42+v*28,spread=.105+v*.05
      impact.poly([Math.cos(q)*r,Math.sin(q)*r,Math.cos(q-spread)*outer,Math.sin(q-spread)*outer,Math.cos(q)*(outer+9),Math.sin(q)*(outer+9),Math.cos(q+spread)*outer,Math.sin(q+spread)*outer])
        .fill({color:i%2?0xe6d5ae:0xbfa889,alpha:.45}).stroke({color:0xf0e3c2,width:1.1,alpha:.75})
    }
    impact.circle(0,0,8+v*15).stroke({color:0xf8efd8,width:2-v,alpha:.8})
    fragments.forEach(p=>{
      const age=time-p.start,u=clamp(age/1.04),r=Math.min(100,room(b)*.79),at={x:b.x+Math.cos(p.angle)*r*(.18+p.speed*u),y:b.y+Math.sin(p.angle)*r*.36+r*(-.08*u+.5*u*u)}
      const g=p.g;g.clear();fit(g,at,12);g.rotation=p.angle+u*2.6
      g.alpha=struck&&age>=0&&age<1.04?clamp(age/.1)*(1-clamp((u-.54)/.46))*.83:0
      const s=p.size;g.poly([-s,-s*.4,s*.4,-s,s,s*.43,-s*.3,s]).fill({color:p.angle>3?0xe7d7b3:0xd4bd92,alpha:.84})
        .moveTo(-s,-s*.4).lineTo(s*.4,-s).stroke({color:0xfff0cd,width:.8,alpha:.9})
    })
  }
  onFrame(update)
  tl.call(()=>update(.38),[],.38).call(()=>{struck=true;update(.84);onCue({type:'impact'})},[],.84).to({}, {duration:2.1},0)
}
