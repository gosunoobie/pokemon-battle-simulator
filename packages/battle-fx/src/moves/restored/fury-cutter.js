import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function furyCutter(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const length=Math.min(68,Math.max(32,context.source.metrics.height/unit*.26))
  const point={x:focus.x,y:focus.y+4},angle=-.6,rotation=-.06
  const pose=solveContact('hand',rotation,{x:point.x-Math.cos(angle+rotation)*length,y:point.y-Math.sin(angle+rotation)*length})
  const swing={angle:1.05},blade=new Container();blade.label='fury-cutter-blade';blade.alpha=0;temporary.addChild(blade)
  const echoes=[]
  // These are closely spaced motion echoes of one cut, not additional battle hits.
  for(let i=2;i>=1;i--){
    const g=new Graphics().moveTo(0,-length*.1).quadraticCurveTo(length*.67,-length*.47,length,0)
      .quadraticCurveTo(length*.6,-length*.22,0,length*.12).closePath().fill({color:0xd6e89b,alpha:.22/i})
    g.rotation=.2*i;blade.addChild(g);echoes.push(g)
  }
  blade.addChild(new Graphics().moveTo(0,-length*.1).quadraticCurveTo(length*.67,-length*.47,length,0)
    .quadraticCurveTo(length*.6,-length*.22,0,length*.12).closePath().fill(0x98c767).stroke({color:0x597e48,width:1.4})
    .moveTo(0,-length*.1).quadraticCurveTo(length*.67,-length*.47,length,0).stroke({color:0xe7f8b6,width:2.4,cap:'round'})
    .moveTo(0,length*.06).quadraticCurveTo(length*.4,-length*.16,length*.65,-length*.13).stroke({color:0x5c9149,width:1.8}))
  const follow=()=>{blade.position.copyFrom(socket('hand',true));blade.rotation=swing.angle+attacker.rotation}
  const shards=[]
  for(let i=0;i<14;i++){
    const g=new Graphics().poly([-2,0,7+random()*7,-2,2,3]).fill(i%3?0xd8eda6:0x7fb65d)
    g.alpha=0;temporary.addChild(g);shards.push({g,angle:-.9+(random()-.5)*2,speed:60+random()*75,life:.26+random()*.14})
  }
  onFrame(time=>{
    follow()
    const strength=Math.min(1,Math.max(0,(time-.32)/.13))*Math.max(0,1-(time-.6)/.2)
    for(const echo of echoes)echo.alpha=strength
    for(const p of shards){const age=time-.6;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(point.x+Math.cos(p.angle)*p.speed*age,point.y+Math.sin(p.angle)*p.speed*age);p.g.rotation=p.angle-age*3;p.g.alpha=Math.sin(Math.PI*age/p.life)}
  })
  const score=new Graphics().moveTo(-32,34).quadraticCurveTo(9,2,31,-37).stroke({color:0xaed572,width:8,alpha:.3,cap:'round'})
    .moveTo(-32,34).quadraticCurveTo(9,2,31,-37).stroke({color:0xf2ffd1,width:2.8,cap:'round'})
  score.position.copyFrom(point);score.alpha=0;temporary.addChild(score)
  tl.to(attacker,{x:home.x-11,rotation:.055,duration:.18},0)
    .to(attacker,{...pose,duration:.42,ease:'power3.in'},.18)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.44,ease:'power2.inOut'},.81)
    .to(swing,{angle,duration:.28,ease:'power3.in'},.32)
    .to(blade,{alpha:1,duration:.12},.2).to(blade,{alpha:0,duration:.2},.66)
    .to(score,{alpha:1,duration:.03},.6).to(score,{alpha:0,duration:.24},.65)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xd8e7b3},[],.6)
    .to(defender,{x:defenderHome.x+9,duration:.06,repeat:3,yoyo:true},.6)
    .call(()=>{defender.tint=0xffffff},[],.84)
}
