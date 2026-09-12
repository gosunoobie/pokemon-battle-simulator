import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function ember(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, unit } = bindEffectSpace(context)
  const base=socket('emission'),release={x:home.x+7,y:home.y,rotation:.018}
  const origin={x:release.x+base.x*Math.cos(release.rotation)-base.y*Math.sin(release.rotation),y:release.y+base.x*Math.sin(release.rotation)+base.y*Math.cos(release.rotation)}
  const size=Math.min(15,Math.max(9,context.target.metrics.height/unit*.065)),flames=[],sparks=[]
  for(let i=0;i<5;i++){
    const flame=new Container();flame.label='ember-flame-'+i;flame.alpha=0;temporary.addChild(flame)
    flame.addChild(new Graphics().moveTo(size*.6,0).quadraticCurveTo(size*.4,-size*.65,-size*.4,-size*.52)
      .lineTo(-size*2,-size*.5).lineTo(-size*1.05,0).lineTo(-size*2.2,size*.55)
      .quadraticCurveTo(-size*.2,size*.85,size*.6,0).closePath().fill(0xf57b32)
      .ellipse(0,0,size*.56,size*.39).fill(0xffbc53).ellipse(size*.08,0,size*.25,size*.19).fill(0xfff1bc))
    const start=.26+i*.085,flight=.44+(i%2)*.03,lane=[0,-1,1,-.5,.5][i]
    flames.push({flame,start,flight,end:{x:focus.x,y:focus.y+lane*size},bow:lane*18})
    for(let j=0;j<5;j++){
      const g=new Graphics().poly([-2,-1,5,0,-2,1]).fill(j%2?0xffce6b:0xf69943);g.alpha=0;temporary.addChild(g)
      sparks.push({g,start:start+flight,y:focus.y+lane*size,angle:random()*Math.PI*2,speed:35+random()*55,life:.22+random()*.15})
    }
  }
  const update=time=>{
    for(const p of flames){
      const age=time-p.start;if(age<0||age>p.flight+.1){p.flame.alpha=0;continue}
      const u=Math.min(1,age/p.flight)
      p.flame.position.set(origin.x+(p.end.x-origin.x)*u,origin.y+(p.end.y-origin.y)*u+Math.sin(Math.PI*u)*p.bow)
      p.flame.rotation=Math.atan2(p.end.y-origin.y+Math.PI*Math.cos(Math.PI*u)*p.bow,p.end.x-origin.x)
      p.flame.scale.set(1+Math.sin(age*42)*.08,.87+Math.sin(age*37)*.12)
      p.flame.alpha=Math.min(1,age/.035)*Math.max(0,1-Math.max(0,age-p.flight)/.1)
    }
    for(const p of sparks){const age=time-p.start;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(focus.x+Math.cos(p.angle)*p.speed*age,p.y+Math.sin(p.angle)*p.speed*age-age*12);p.g.rotation=p.angle;p.g.alpha=Math.sin(Math.PI*age/p.life)}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-5,rotation:-.025,duration:.14},0)
    .to(attacker,{...release,duration:.1,ease:'power2.out'},.14)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.34,ease:'power2.inOut'},.68)
    .call(()=>{update(.7);onCue({type:'impact'});defender.tint=0xffd2a1},[],.7)
    .to(defender,{x:defenderHome.x+5,duration:.055,repeat:3,yoyo:true},.7)
    .call(()=>{defender.tint=0xffffff},[],.93)
}
