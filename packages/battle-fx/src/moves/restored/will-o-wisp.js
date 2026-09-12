import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function willOWisp(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, focus, socket, unit } = bindEffectSpace(context)
  const size=Math.min(18,Math.max(11,context.target.metrics.height/unit*.085))
  const orbitX=Math.min(60,Math.max(30,context.target.metrics.width/unit*.3)),orbitY=Math.min(44,Math.max(24,context.target.metrics.height/unit*.22))
  const wisps=[],cinders=[]
  for(let i=0;i<3;i++){
    const wisp=new Container();wisp.label='will-o-wisp-flame-'+i;wisp.alpha=0;temporary.addChild(wisp)
    const flame=new Graphics().moveTo(0,size*.7).bezierCurveTo(-size*1.1,size*.3,-size*.7,-size*.7,-size*.18,-size*1.7)
      .quadraticCurveTo(size*.42,-size*.7,size*.1,-size*.3).quadraticCurveTo(size*.56,-size*.65,size*.58,-size)
      .bezierCurveTo(size*1.2,-size*.1,size*.92,size*.5,0,size*.7).closePath().fill({color:0x8875d3,alpha:.85})
      .moveTo(0,size*.52).quadraticCurveTo(-size*.65,0,0,-size*.95).quadraticCurveTo(size*.13,-size*.2,size*.4,-size*.35)
      .quadraticCurveTo(size*.64,size*.3,0,size*.52).closePath().fill(0x96c5f2)
      .ellipse(0,size*.2,size*.22,size*.29).fill(0xf0dbdf)
    wisp.addChild(flame);wisps.push({wisp,flame,start:.28+i*.08,flight:.82+i*.03,phase:i*Math.PI*2/3})
  }
  for(let i=0;i<12;i++){
    const g=new Graphics().ellipse(0,0,1.5+random()*1.5,3).fill(i%2?0xcab7ef:0xf2c8b4)
    g.alpha=0;temporary.addChild(g);cinders.push({g,start:1.1+i*.035,x:(random()-.5)*orbitX,y:(random()-.5)*orbitY,life:.42+random()*.2,phase:random()*6})
  }
  const update=time=>{
    const from=socket('emission',true)
    for(const p of wisps){
      const age=time-p.start;if(age<0||age>p.flight+.85){p.wisp.alpha=0;continue}
      const u=Math.min(1,age/p.flight),linger=Math.max(0,age-p.flight),a=p.phase+age*5
      if(u<1)p.wisp.position.set(from.x+(focus.x-from.x)*u+Math.sin(a)*18*Math.sin(Math.PI*u),from.y+(focus.y-from.y)*u-Math.sin(Math.PI*u)*(28+Math.cos(a)*19))
      else {const spread=Math.min(1,linger/.3);p.wisp.position.set(focus.x+Math.cos(a)*orbitX*spread,focus.y+Math.sin(a)*orbitY*spread-linger*18)}
      p.flame.scale.set(.9+Math.sin(time*17+p.phase)*.1,1+Math.sin(time*21+p.phase)*.12)
      p.flame.rotation=Math.sin(time*8+p.phase)*.12
      p.wisp.alpha=Math.min(1,age/.13)*Math.max(0,1-linger/.85)
    }
    for(const p of cinders){const age=time-p.start;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(focus.x+p.x+Math.sin(age*7+p.phase)*5,focus.y+p.y-age*48);p.g.alpha=Math.sin(Math.PI*age/p.life)*.8}
  }
  onFrame(update)
  tl.to(attacker,{y:home.y-4,rotation:-.02,duration:.2},0)
    .to(attacker,{y:home.y,rotation:0,duration:.35},.2)
    .call(()=>{update(1.1);onCue({type:'impact'});defender.tint=0xdfbfe7},[],1.1)
    .call(()=>{defender.tint=0xffffff},[],1.3)
    .call(()=>{defender.tint=0xf2ccbd},[],1.55)
    .call(()=>{defender.tint=0xffffff},[],1.78)
}
