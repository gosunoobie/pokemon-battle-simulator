import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function rockBlast(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, unit } = bindEffectSpace(context)
  const base=socket('emission'),release={x:home.x+7,y:home.y,rotation:.018}
  const origin={x:release.x+base.x*Math.cos(release.rotation)-base.y*Math.sin(release.rotation),y:release.y+base.x*Math.sin(release.rotation)+base.y*Math.cos(release.rotation)}
  const r=Math.min(22,Math.max(14,context.target.metrics.height/unit*.1)),shots=[],chips=[]
  for(let i=0;i<3;i++){
    const rock=new Container();rock.label='rock-blast-stone-'+i;rock.alpha=0;temporary.addChild(rock)
    rock.addChild(new Graphics().poly([-r*.9,-r*.26,-r*.47,-r*.85,r*.31,-r*.78,r*.94,-r*.17,r*.69,r*.6,-r*.18,r*.83,-r*.8,r*.39])
      .fill(i%2?0xb59b79:0xc4aa86).stroke({color:0x776954,width:1.4,join:'round'})
      .poly([-r*.47,-r*.85,r*.31,-r*.78,r*.12,-r*.06,-r*.9,-r*.26]).fill(0xe0cba8)
      .poly([r*.12,-r*.06,r*.94,-r*.17,r*.69,r*.6,-r*.18,r*.83]).fill(0x998061)
      .moveTo(-r*.51,r*.27).lineTo(-r*.09,-r*.03).lineTo(r*.39,r*.25).stroke({color:0x75664f,width:1.2}))
    const start=.32+i*.2,flight=.4,hit=start+flight,end={x:focus.x,y:focus.y+[0,-.3,.3][i]*r}
    const trail=new Graphics();trail.alpha=0;temporary.addChildAt(trail,0)
    const ring=new Graphics().ellipse(0,0,r*.42,r*.9).stroke({color:0xebd5ae,width:2});ring.position.copyFrom(end);ring.alpha=0;temporary.addChild(ring)
    shots.push({rock,trail,start,flight,hit,end,ring})
    for(let j=0;j<9;j++){const g=new Graphics().poly([-2,-2,4,-1,2,3,-3,1]).fill(j%2?0xcfb28b:0x9f896b);g.alpha=0;temporary.addChild(g);chips.push({g,end,start:hit,a:random()*Math.PI*2,v:50+random()*85,life:.3+random()*.14})}
    tl.to(ring,{alpha:.85,duration:.025},hit).to(ring.scale,{x:1.65,y:1.3,duration:.21},hit).to(ring,{alpha:0,duration:.18},hit+.05)
      .to(defender,{x:defenderHome.x+6,duration:.045,repeat:3,yoyo:true},hit)
  }
  const update=time=>{
    for(const p of shots){
      const age=time-p.start,u=Math.max(0,Math.min(1,age/p.flight)),fade=Math.max(0,1-Math.max(0,age-p.flight)/.045)
      const x=origin.x+(p.end.x-origin.x)*u,y=origin.y+(p.end.y-origin.y)*u
      p.rock.position.set(x,y);p.rock.rotation=age*5;p.rock.alpha=age>=0&&age<=p.flight+.045?Math.min(1,age/.025)*fade:0
      p.trail.clear();p.trail.alpha=age>0&&age<p.flight?Math.min(1,age/.05):0
      const a=Math.atan2(p.end.y-origin.y,p.end.x-origin.x),length=Math.min(r*2.5,Math.hypot(x-origin.x,y-origin.y))
      p.trail.moveTo(x-Math.cos(a)*length,y-Math.sin(a)*length).lineTo(x,y).stroke({color:0xd4bc92,width:2.4,alpha:.5,cap:'round'})
    }
    for(const p of chips){const age=time-p.start,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.85:0;if(age>=0){p.g.position.set(p.end.x+Math.cos(p.a)*p.v*age,p.end.y+Math.sin(p.a)*p.v*age+60*age*age);p.g.rotation=p.a+age*4}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-7,rotation:-.03,duration:.18},0).to(attacker,{...release,duration:.12,ease:'power2.out'},.18)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.42,ease:'power2.inOut'},.9)
    .call(()=>{update(.72);onCue({type:'impact'});defender.tint=0xddc59f},[],.72)
    .call(()=>{defender.tint=0xffffff},[],1.32)
}
