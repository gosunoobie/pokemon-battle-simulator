import { Container, Graphics, GraphicsPath } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Exact Lorc Rock Slide silhouette, kept local so this review does not change asset loading.
export const ROCK_SLIDE_PATH = 'M228.813 23 68.75 72.28 39.5 182.095l47.53-21.22 10.44-4.655 2.5 11.155 8.75 39.125 6.405 28.53-21.75-19.53-15.72-14.125-28.218 32.344 140.657 136 9.656-40.69 7.53-31.874 10.407 31.063 54.72 163.592 159.936-26.31 45.75-202.938-84.563-148.718L228.814 23zm-57.688 49.875-27.813 39.906-3.25 73.44-27.187-88.94 58.25-24.405zm17.844 93.406 113.124 155.25L407 355.407l-107.375-.844-110.656-128v-60.28zM79.312 330.25l140.125 153.125-5.563-65.875-134.563-87.25z'
export const timing = Object.freeze({ contact: 1.34, duration: 2.4, markers: [{id:'lift',label:'Stones begin rising',timeSeconds:.16},{id:'launch',label:'First stone launches',timeSeconds:.86}] })

export default function ancientPower(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, unit } = bindEffectSpace(context)
  const r=Math.min(22,Math.max(12,context.source.metrics.height/unit*.085)),hold={x:home.x-6,y:home.y,rotation:-.022}
  const transform=p=>({x:hold.x+p.x*Math.cos(hold.rotation)-p.y*Math.sin(hold.rotation),y:hold.y+p.x*Math.sin(hold.rotation)+p.y*Math.cos(hold.rotation)})
  const center=transform(socket('aura')),ground=transform(socket('floor')),stones=[],fragments=[]
  const field=new Container();field.label='ancient-power-field';field.alpha=0;temporary.addChild(field)
  const circle=new Graphics().ellipse(0,0,r*2.15,r*1.1).stroke({color:0xd7c08d,width:1.6,alpha:.7})
    .ellipse(0,0,r*1.75,r*.9).stroke({color:0xbba6d6,width:1.3,alpha:.6});field.addChild(circle)
  const motes=Array.from({length:12},(_,i)=>{const g=new Graphics().poly([0,-3,2,0,0,3,-2,0]).fill(i%2?0xe3d3b4:0xc5b3e1);field.addChild(g);return g})
  for(let i=0;i<5;i++){
    const stone=new Container();stone.label='ancient-power-stone-'+i;stone.alpha=0;temporary.addChild(stone)
    const artwork=new Graphics().path(new GraphicsPath(ROCK_SLIDE_PATH,true)).fill(i%2?0xbfa787:0xd1b997)
    artwork.label='ancient-power-rock-slide-art-'+i
    const rockBounds=artwork.getLocalBounds()
    artwork.pivot.set(rockBounds.x+rockBounds.width/2,rockBounds.y+rockBounds.height/2)
    artwork.scale.set((r*1.72+2)/Math.max(rockBounds.width,rockBounds.height))
    stone.addChild(artwork)
    stone.addChild(new Graphics().moveTo(-r*.31,-r*.2).lineTo(r*.23,-r*.2).lineTo(-r*.03,r*.22).lineTo(r*.32,r*.22)
      .stroke({color:0xffe6b0,width:2,cap:'round'}))
    const angle=-Math.PI*.9+i*Math.PI*.45,launch=.86+i*.055,flight=.48
    const origin={x:center.x+Math.cos(angle)*r*2.25,y:center.y+Math.sin(angle)*r*1.15}
    const end={x:focus.x+[0,-.4,.4,-.2,.2][i]*r,y:focus.y+[0,.2,-.2,-.5,.5][i]*r}
    const trail=new Graphics();trail.alpha=0;temporary.addChildAt(trail,0)
    stones.push({stone,trail,start:.16+i*.06,launch,flight,origin,end,bow:(i-2)*r*.35})
    for(let j=0;j<6;j++){const g=new Graphics().poly([-2,-1,3,-2,2,2,-2,3]).fill(j%2?0xdbcba5:0xb8a6d1);g.alpha=0;temporary.addChild(g);fragments.push({g,end,start:launch+flight,a:random()*Math.PI*2,v:45+random()*70,life:.35+random()*.17})}
  }
  const pulse=new Graphics().circle(0,0,r*1.4).stroke({color:0xe9d8b0,width:2}).circle(0,0,r*.75).stroke({color:0xc8b6dc,width:1.5})
  pulse.label='ancient-power-impact';pulse.position.copyFrom(focus);pulse.alpha=0;temporary.addChild(pulse)
  const update=time=>{
    const target=targetSocket('center',true),dx=target.x-focus.x,dy=target.y-focus.y
    field.position.copyFrom(socket('aura',true));circle.rotation=Math.sin(time*2)*.15
    motes.forEach((g,i)=>{const a=i*Math.PI/6+time*1.8;g.position.set(Math.cos(a)*r*2.15,Math.sin(a)*r*1.1);g.alpha=.5+Math.sin(time*7+i)*.25})
    for(const p of stones){
      const age=time-p.start,travel=time-p.launch,u=Math.max(0,Math.min(1,travel/p.flight));p.trail.clear();p.trail.alpha=0
      if(age<0||travel>p.flight+.07){p.stone.alpha=0;continue}
      p.stone.alpha=Math.min(1,age/.16)*Math.max(0,1-Math.max(0,travel-p.flight)/.07)
      if(travel<0){const lift=Math.min(1,age/.4),ease=1-(1-lift)**3;p.stone.position.set(p.origin.x,ground.y-r+(p.origin.y-ground.y+r)*ease+Math.sin(time*6+p.start)*r*.06*Math.sin(Math.PI*lift));p.stone.rotation=Math.sin(time*3+p.start)*.12}
      else {
        const v=u*u*(3-2*u),x=p.origin.x+(p.end.x+dx-p.origin.x)*v,y=p.origin.y+(p.end.y+dy-p.origin.y)*v+Math.sin(Math.PI*v)*p.bow
        p.stone.position.set(x,y);p.stone.rotation=Math.sin(p.launch*3+p.start)*.12+travel*3
        const back=Math.max(0,v-.07),bx=p.origin.x+(p.end.x+dx-p.origin.x)*back,by=p.origin.y+(p.end.y+dy-p.origin.y)*back+Math.sin(Math.PI*back)*p.bow
        p.trail.alpha=u<1?.6:0;p.trail.moveTo(bx,by).lineTo(x,y).stroke({color:0xd6c49b,width:2.3,cap:'round'})
      }
    }
    for(const p of fragments){const age=time-p.start,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.85:0;if(age>=0){p.g.position.set(p.end.x+dx+Math.cos(p.a)*p.v*age,p.end.y+dy+Math.sin(p.a)*p.v*age+32*age*age);p.g.rotation=p.a+age*2}}
  }
  onFrame(update)
  tl.to(attacker,{...hold,duration:.24},0).to(attacker,{x:home.x,y:home.y,rotation:0,duration:.5},1.16)
    .to(field,{alpha:.8,duration:.28},.1).to(field,{alpha:0,duration:.3},1.02)
    .to(pulse,{alpha:.85,duration:.06},1.34).to(pulse.scale,{x:1.6,y:1.6,duration:.4},1.34).to(pulse,{alpha:0,duration:.32},1.5)
    .call(()=>{update(1.34);onCue({type:'impact'});defender.tint=0xd6c7ab},[],1.34)
    .to(defender,{x:defenderHome.x+9,duration:.07,repeat:5,yoyo:true},1.34).call(()=>{defender.tint=0xffffff},[],1.78)
}
