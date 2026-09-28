import { Container, Graphics } from 'pixi.js'

// Buoyant fungal capsules travel from the live emission socket to a sleepy cloud.
export default function spore({ layer, scene, source, target, tl, random, onFrame, onCue }) {
  const art=new Container();art.label='move-artwork';art.alpha=0;layer.addChild(art)
  const u=Math.min(scene.unit,scene.width/300,scene.height/240), margin=12*u
  const fitPoint=p=>({x:Math.max(margin,Math.min(scene.width-margin,p.x)),y:Math.max(margin,Math.min(scene.height-margin,p.y))})
  const spores=Array.from({length:30},(_,i)=>{
    const g=new Graphics().ellipse(0,0,3.6*u,5*u).fill(i%3?0xd4e6a4:0xf0edbd)
      .ellipse(-u,-1.5*u,1.2*u,2*u).fill({color:0xffffff,alpha:.6})
    g.label=`spore-capsule-${i}`;art.addChild(g)
    return{g,start:.14+i*.012,duration:.78-i*.012,phase:random()*6.28,lane:(random()-.5)*2,from:null}
  })
  const cloud=new Container();cloud.label='spore-cloud';art.addChild(cloud)
  const puffs=Array.from({length:8},(_,i)=>{const g=new Graphics().ellipse(0,0,19*u,15*u).fill({color:i%2?0xcbdca4:0xe6eabf,alpha:.17});cloud.addChild(g);return g})
  const motes=Array.from({length:16},(_,i)=>{const g=new Graphics().circle(0,0,(1.1+i%3*.3)*u).fill(i%2?0xf3f1cf:0xccdf9e);cloud.addChild(g);return g})
  let arrival
  function update(time){
    const from=fitPoint(source.anchor('emission')),to=fitPoint(target.anchor('center'))
    for(const p of spores){const age=time-p.start;if(age<0||age>p.duration+.24){p.g.alpha=0;continue}
      p.from??={...from};const v=Math.min(1,age/p.duration),sway=Math.sin(Math.PI*v)*p.lane*16*u
      const x=p.from.x+(to.x-p.from.x)*v,y=p.from.y+(to.y-p.from.y)*v+sway
      p.g.position.copyFrom(fitPoint({x,y}));p.g.rotation=p.phase+time*1.3;p.g.alpha=Math.min(1,age/.08)*Math.max(0,1-Math.max(0,age-p.duration)/.24)*.86
    }
    const age=time-.92;arrival??=age>=0?{...to}:null
    const center=arrival??to,room=Math.max(0,Math.min(center.x,scene.width-center.x,center.y,scene.height-center.y)-3*u)
    cloud.position.copyFrom(center);cloud.scale.set(Math.min(1,room/(91*u)));cloud.alpha=age>=0?Math.min(1,age/.14):0
    puffs.forEach((g,i)=>{const a=i*Math.PI/4+time*.18,r=(31+Math.sin(time*2+i)*5)*u;g.position.set(Math.cos(a)*r,Math.sin(a)*r*.7-Math.max(0,age)*12*u);g.scale.set(.7+Math.min(1,Math.max(0,age)/.28)*.3);g.alpha=.5+Math.sin(time+i)**2*.4})
    motes.forEach((g,i)=>{const a=i*2.4+time*.22;g.position.set(Math.cos(a)*(26+i%4*7)*u,Math.sin(a)*40*u+Math.max(0,age)*13*u);g.alpha=.22+Math.sin(time*3+i)**2*.6})
  }
  onFrame(update)
  tl.to(art,{alpha:1,duration:.18},.04).to(art,{alpha:0,duration:.48},1.7).call(()=>{update(.92);onCue({type:'impact'})},[],.92)
}
