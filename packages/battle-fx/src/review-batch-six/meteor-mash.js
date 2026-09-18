import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

export const timing = Object.freeze({ contact: 1.34, duration: 2.50, markers: [{id:'comet',label:'Comet fist approaches',timeSeconds:.42},{id:'star-crest',label:'Cosmic star impact crest',timeSeconds:1.49}] })

export default function meteorMash(context) {
  const { tl, random, onFrame, onCue, glowTexture, scene, layer } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('fist')?'fist':'hand'
  const r=Math.min(37,Math.max(22,context.source.metrics.height/unit*.15)),point={x:focus.x,y:focus.y+4},rotation=.09
  const a=temporary.toLocal({x:0,y:0},layer), b=temporary.toLocal({x:scene.width,y:scene.height},layer)
  const bounds={left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)}
  const clamp=(v,l,h)=>Math.max(l,Math.min(h,v))
  const fitPoint=(p,radius)=>({x:clamp(p.x,bounds.left+radius,bounds.right-radius),y:clamp(p.y,bounds.top+radius,bounds.bottom-radius)})
  const center=socket('visualCenter')
  function fitPose(p){
    const c=Math.cos(p.rotation),s=Math.sin(p.rotation),w=context.source.metrics.width/unit,h=context.source.metrics.height/unit
    const rx=(w*Math.abs(c)+h*Math.abs(s))/2,ry=(h*Math.abs(c)+w*Math.abs(s))/2
    const x=p.x+center.x*c-center.y*s,y=p.y+center.x*s+center.y*c
    return {...p,x:p.x+clamp(x,bounds.left+rx,bounds.right-rx)-x,y:p.y+clamp(y,bounds.top+ry,bounds.bottom-ry)-y}
  }
  const recoil=Math.max(0,Math.min(12,bounds.right-targetSocket('visualCenter').x-context.target.metrics.width/(2*unit)))
  const pose=fitPose(solveContact(attachment,rotation,{x:point.x-Math.cos(rotation)*r,y:point.y-Math.sin(rotation)*r}))
  const handHome=socket(attachment)
  point.x=pose.x+(handHome.x+r)*Math.cos(rotation)-handHome.y*Math.sin(rotation)
  point.y=pose.y+(handHome.x+r)*Math.sin(rotation)+handHome.y*Math.cos(rotation)
  const motion={x:home.x,y:home.y,rotation:0},flashGrowth={value:1}
  let impactOffset=null,collision=null
  const fist=new Container();fist.label='meteor-mash-fist';fist.alpha=0;temporary.addChild(fist)
  const comet=new Graphics();fist.addChild(comet)
  fist.addChild(new Graphics().poly([-r*.68,-r*.32,-r*.4,-r*.66,r*.72,-r*.66,r,-r*.4,r,r*.25,r*.63,r*.58,-r*.22,r*.6,-r*.66,r*.27])
    .fill(0x9bb8c9).stroke({color:0xe8f7ff,width:1.8,join:'round'})
    .poly([-r*.66,r*.03,r*.73,r*.05,r*.63,r*.58,-r*.22,r*.6,-r*.66,r*.27]).fill(0x6f8fa4)
    .moveTo(-r*.24,-r*.55).lineTo(-r*.24,-r*.12).moveTo(r*.13,-r*.55).lineTo(r*.13,-r*.12).moveTo(r*.5,-r*.53).lineTo(r*.5,-r*.1)
    .stroke({color:0xcbe4ef,width:1.6,cap:'round'}))
  const starShape=size=>{const points=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,d=size*(i%2?.43:1);points.push(Math.cos(a)*d,Math.sin(a)*d)}return points}
  fist.addChild(new Graphics().poly(starShape(r*.21)).fill(0xf5edd0))
  const stars=Array.from({length:11},(_,i)=>{const g=new Graphics().poly(starShape(3+random()*3.5)).fill(i%3?0xe1f3ff:0xffe8b4);g.alpha=0;temporary.addChild(g);return{g,phase:i/11}})
  const fragments=Array.from({length:16},(_,i)=>{const g=new Graphics().poly(starShape(3+random()*4)).fill(i%3?0xcbeaff:0xffe1a4);g.alpha=0;temporary.addChild(g);return{g,a:i*Math.PI/8,v:70+random()*100,life:.33+random()*.23}})
  const flash=new Graphics().poly(starShape(r*2.25)).fill(0xeef8ff).poly(starShape(r*1.18)).fill(0xfce5b4)
  flash.label='meteor-mash-impact';flash.position.copyFrom(point);flash.alpha=0;temporary.addChild(flash)
  const cosmos=new Container();cosmos.label='meteor-mash-cosmic-impact';cosmos.alpha=0;temporary.addChildAt(cosmos,temporary.getChildIndex(flash))
  const cloud=new Sprite(glowTexture);cloud.anchor.set(.5);cloud.width=r*7.4;cloud.height=r*6.4;cloud.tint=0x100d35;cloud.alpha=.9;cosmos.addChild(cloud)
  const violet=new Sprite(glowTexture);violet.anchor.set(.5);violet.width=r*5;violet.height=r*4;violet.tint=0x5745ac;violet.blendMode='add';violet.alpha=.36;cosmos.addChild(violet)
  const impactStars=Array.from({length:9},(_,i)=>{
    const g=new Graphics().poly(starShape(6+i%3*2.6)).fill(i%3?0xe7f2ff:0xffedbb).stroke({color:0x958bcf,width:1.2})
    g.label='meteor-mash-impact-star-'+i;cosmos.addChild(g);return {g,angle:i*Math.PI*2/9,distance:r*(.9+i%3*.38)}
  })
  const approachEase=progress=>progress**4
  const recoveryEase=progress=>progress<.5?4*progress**3:1-(-2*progress+2)**3/2
  const roomAt=p=>Math.max(0,Math.min(p.x-bounds.left,bounds.right-p.x,p.y-bounds.top,bounds.bottom-p.y)-2)
  const update=time=>{
    const target=targetSocket('center',true), delta={x:target.x-focus.x,y:target.y-focus.y}
    const follow=time<1.34?approachEase(clamp((time-.88)/.46,0,1)):time<1.57?1:1-recoveryEase(clamp((time-1.57)/.55,0,1))
    const p=fitPose({...motion,x:motion.x+delta.x*follow,y:motion.y+delta.y*follow})
    attacker.position.set(p.x,p.y);attacker.rotation=p.rotation
    const hand=socket(attachment,true);fist.position.copyFrom(hand);fist.rotation=attacker.rotation
    if(time>=timing.contact&&!impactOffset){
      collision={x:hand.x+Math.cos(attacker.rotation)*r,y:hand.y+Math.sin(attacker.rotation)*r}
      impactOffset={x:collision.x-target.x,y:collision.y-target.y}
    }
    const impact=impactOffset?{x:target.x+impactOffset.x,y:target.y+impactOffset.y}:{x:point.x+delta.x,y:point.y+delta.y}
    flash.position.copyFrom(impact);cosmos.position.copyFrom(impact)
    // The full impact fits around the visible contact; its center never drifts to make room.
    flash.scale.set(Math.min(flashGrowth.value,roomAt(impact)/(r*2.25)))
    cosmos.scale.set(Math.min(1,roomAt(impact)/(r*3.75)))
    const age=time-timing.contact,life=Math.max(0,Math.min(1,age/.64))
    cosmos.alpha=age>=0&&age<.72?Math.min(1,age/.035)*Math.min(1,(.72-age)/.24):0
    impactStars.forEach(({g,angle,distance},i)=>{
      const d=distance*(.4+life*1.15),turn=angle+age*.32
      g.position.set(Math.cos(turn)*d,Math.sin(turn)*d*.85)
      g.scale.set(.4+Math.sin(Math.PI*Math.min(1,life+.05))*.8)
      g.alpha=.72+.28*Math.sin(age*20+i)**2;g.rotation=age*(i%2?-.8:.8)
    })
    comet.clear()
    for(let i=0;i<3;i++)comet.moveTo(-r*(2.4-i*.22),(i-1)*r*.24).quadraticCurveTo(-r*.95,(i-1)*r*.46,-r*.3,(i-1)*r*.12)
      .stroke({color:i%2?0xe6f5ff:0xa3d2e9,width:i===1?4:1.6,alpha:.55,cap:'round'})
    stars.forEach(p=>{const u=(p.phase+time*1.7)%1;p.g.position.copyFrom(fitPoint({x:hand.x-r*(.5+u*1.7),y:hand.y+Math.sin(u*Math.PI*2+p.phase)*r*.36},8));p.g.rotation=time*1.5+p.phase;p.g.alpha=time>.24&&time<1.48?Math.sin(Math.PI*u)*Math.min(1,(time-.24)/.13,(1.48-time)/.2)*.8:0})
    for(const p of fragments){const age=time-1.34,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.9:0;if(age>=0){const origin=collision??point;p.g.position.copyFrom(fitPoint({x:origin.x+Math.cos(p.a)*p.v*age,y:origin.y+Math.sin(p.a)*p.v*age+22*age*age},9));p.g.rotation=age*3}}
  }
  onFrame(update)
  tl.to(motion,{x:home.x-11,rotation:-.055,duration:.42},0)
    .to(motion,{x:pose.x-r*.7,y:pose.y-r*.65,rotation:-.035,duration:.46,ease:'power2.out'},.42)
    .to(motion,{...pose,duration:.46,ease:'power3.in'},.88)
    .to(motion,{x:home.x,y:home.y,rotation:0,duration:.55,ease:'power2.inOut'},1.57)
    .to(fist,{alpha:1,duration:.15},.19).to(fist,{alpha:0,duration:.26},1.47)
    .to(flash,{alpha:1,duration:.035},1.34).to(flashGrowth,{value:1.22,duration:.15},1.34).to(flash,{alpha:0,rotation:.2,duration:.32},1.49)
    .call(()=>{update(1.34);onCue({type:'impact'});defender.tint=0xc6dfed},[],1.34)
    .to(defender,{x:defenderHome.x+recoil,duration:.07,repeat:3,yoyo:true},1.34).call(()=>{defender.tint=0xffffff},[],1.62)
    .call(()=>{},[],timing.duration)
}
