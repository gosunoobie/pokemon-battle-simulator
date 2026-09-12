import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function peck(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('beak')?'beak':'emission'
  const base=socket(attachment),length=Math.min(36,Math.max(18,context.source.metrics.height/unit*.13))
  const point={x:focus.x,y:focus.y+4},aim=Math.atan2(point.y-base.y,point.x-base.x),rotation=.025
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(aim+rotation)*length,y:point.y-Math.sin(aim+rotation)*length})
  const beak=new Container();beak.label='peck-beak';beak.alpha=0;temporary.addChild(beak)
  const upper=new Graphics().poly([0,-length*.25,length,0,0,1]).fill(0xf6d990).stroke({color:0xc69c5c,width:1.2,join:'round'})
  const lower=new Graphics().poly([0,1,length,0,0,length*.19]).fill(0xdca962)
  beak.addChild(upper,lower)
  const follow=()=>{beak.position.copyFrom(socket(attachment,true));beak.rotation=aim+attacker.rotation}
  const flecks=[]
  for(let i=0;i<9;i++){
    const g=new Graphics().poly([0,-1.5,7+random()*5,0,0,1.5]).fill(i%2?0xffe8b4:0xe5f5fa)
    g.alpha=0;temporary.addChild(g)
    flecks.push({g,angle:(random()-.5)*Math.PI*1.5,speed:32+random()*40,life:.22+random()*.08})
  }
  onFrame(time=>{
    follow()
    for(const p of flecks){const age=time-.36;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(point.x+Math.cos(p.angle)*p.speed*age,point.y+Math.sin(p.angle)*p.speed*age);p.g.rotation=p.angle;p.g.alpha=Math.sin(Math.PI*age/p.life)*.9}
  })
  const spark=new Graphics().poly([-4,-4,0,-17,4,-4,17,0,4,4,0,17,-4,4,-17,0]).fill(0xfff5d7)
  spark.position.copyFrom(point);spark.alpha=0;temporary.addChild(spark)
  tl.to(attacker,{x:home.x-5,rotation:-.045,duration:.12},0)
    .to(attacker,{...pose,duration:.24,ease:'power3.in'},.12)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.34,ease:'power2.inOut'},.46)
    .to(beak,{alpha:1,duration:.07},.13).to(beak,{alpha:0,duration:.15},.46)
    .to(upper,{rotation:-.16,duration:.08},.14).to(lower,{rotation:.16,duration:.08},.14)
    .to(upper,{rotation:0,duration:.07,ease:'power3.in'},.29).to(lower,{rotation:0,duration:.07,ease:'power3.in'},.29)
    .to(spark,{alpha:1,duration:.02},.36).to(spark,{alpha:0,duration:.14},.4)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xf4e8c9},[],.36)
    .to(defender,{x:defenderHome.x+6,duration:.055,repeat:3,yoyo:true},.36)
    .call(()=>{defender.tint=0xffffff},[],.52)
}
