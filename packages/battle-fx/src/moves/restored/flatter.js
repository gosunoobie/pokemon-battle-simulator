import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function flatter(context) {
  const { tl, onFrame, onCue }=context
  const { temporary, socket, targetSocket, unit }=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const r=Math.min(46,Math.max(28,context.target.metrics.height/unit*.22))
  const ribbon=new Graphics();ribbon.label='flatter-ribbon';ribbon.alpha=0;temporary.addChild(ribbon)
  const gifts=Array.from({length:5},(_,i)=>{
    const g=new Graphics();g.label=`flatter-light-${i}`;g.alpha=0;temporary.addChild(g)
    if(i%2)g.moveTo(0,5).bezierCurveTo(-13,-2,-7,-11,0,-5).bezierCurveTo(7,-11,13,-2,0,5).fill(0xf6c4cf)
    else g.poly([0,-7,2,-2,7,0,2,2,0,7,-2,2,-7,0,-2,-2]).fill(0xffe4b4)
    return g
  })
  const halo=new Container();halo.label='flatter-halo';halo.alpha=0;temporary.addChild(halo)
  const curls=new Graphics(),gleams=[];halo.addChild(curls)
  for(let i=0;i<7;i++){const g=new Graphics().circle(0,0,i%2?2.2:3).fill(i%2?0xe0b9ed:0xffe4c4);halo.addChild(g);gleams.push(g)}
  function update(time){
    const from=socket('emission',true),to=targetSocket('center',true),bow=Math.min(25,room(from)/2,room(to)/2)
    ribbon.clear()
    const lead=Math.max(0,Math.min(1,(time-.24)/.72))
    for(let lane=0;lane<2;lane++){
      for(let i=0;i<=36;i++){const u=i/36*lead,x=from.x+(to.x-from.x)*u,y=from.y+(to.y-from.y)*u+Math.sin(Math.PI*u)*Math.sin(u*Math.PI*2-time*3+lane*Math.PI)*bow;i?ribbon.lineTo(x,y):ribbon.moveTo(x,y)}
      ribbon.stroke({color:lane?0xefbad6:0xffdab2,width:1.5,alpha:.5,cap:'round'})
    }
    gifts.forEach((g,i)=>{
      const age=time-.24-i*.11,u=Math.max(0,Math.min(1,age/.72)),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u+Math.sin(Math.PI*u)*Math.sin(u*Math.PI*2-time*3+i*Math.PI)*bow}
      g.position.copyFrom(p);g.rotation=Math.sin(time*5+i)*.2;g.scale.set(Math.min(.85,room(p)/12));g.alpha=age>=0&&age<.9?Math.min(1,age*14)*Math.min(1,(.9-age)*7):0
    })
    halo.position.copyFrom(to);halo.scale.set(Math.min(1,room(to)/(r*1.4)));curls.clear()
    for(let lane=0;lane<3;lane++){
      const rad=r*(.5+lane*.2),a=time*(lane%2?-1.6:1.6)+lane*2.1
      for(let i=0;i<=28;i++){const angle=a+i/28*Math.PI*1.55,x=Math.cos(angle)*rad,y=Math.sin(angle)*rad*.64-Math.sin(time*3+lane)*r*.06;i?curls.lineTo(x,y):curls.moveTo(x,y)}
      curls.stroke({color:lane===1?0xf6c9da:0xc9abe2,width:lane===1?2.3:1.4,alpha:.7})
    }
    gleams.forEach((g,i)=>{const a=-time*2.2+i*Math.PI*2/7;g.position.set(Math.cos(a)*r,Math.sin(a)*r*.67);g.alpha=.35+Math.sin(time*5+i)**2*.6;g.scale.set(r/46)})
  }
  onFrame(update)
  tl.to(ribbon,{alpha:1,duration:.2},.24).to(ribbon,{alpha:0,duration:.3},1.3)
    .to(halo,{alpha:1,duration:.25},.88).to(halo,{alpha:0,duration:.44},1.84)
    .call(()=>{update(.96);onCue({type:'impact'})},[],.96)
}
