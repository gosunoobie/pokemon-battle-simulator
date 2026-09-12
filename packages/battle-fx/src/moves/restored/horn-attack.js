import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function hornAttack(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('horn')?'horn':'emission'
  const base=socket(attachment),length=Math.min(64,Math.max(32,context.source.metrics.height/unit*.24))
  const point={x:focus.x,y:focus.y+6},aim=Math.atan2(point.y-base.y,point.x-base.x),rotation=.055
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(aim+rotation)*length,y:point.y-Math.sin(aim+rotation)*length})
  const horn=new Container();horn.label='horn-attack-horn';horn.alpha=0;temporary.addChild(horn)
  horn.addChild(new Graphics().moveTo(0,-length*.2).quadraticCurveTo(length*.4,-length*.19,length,0)
    .quadraticCurveTo(length*.5,length*.04,0,length*.19).closePath().fill(0xede0bd)
    .stroke({color:0xa69778,width:1.4,join:'round'})
    .moveTo(0,0).quadraticCurveTo(length*.47,length*.04,length,0).quadraticCurveTo(length*.4,length*.1,0,length*.19).closePath().fill(0xc8b88e)
    .moveTo(length*.08,-length*.13).quadraticCurveTo(length*.36,-length*.11,length*.77,-length*.025).stroke({color:0xfff8de,width:2.3,cap:'round'})
    .ellipse(0,0,length*.075,length*.19).stroke({color:0xc9b98b,width:2,alpha:.8}))
  const wake=new Graphics();horn.addChild(wake)
  for(let i=0;i<3;i++)wake.moveTo(-length*(.4+i*.13),(i-1)*length*.12).lineTo(-length*.07,(i-1)*length*.08).stroke({color:0xe6dcc0,width:i===1?2:1,alpha:.6,cap:'round'})
  const follow=()=>{horn.position.copyFrom(socket(attachment,true));horn.rotation=aim+attacker.rotation}
  const chips=[]
  for(let i=0;i<14;i++){
    const g=new Graphics().poly([-2,-2,5,0,-2,2]).fill(i%3?0xf8e7bd:0xbbaa86);g.alpha=0;temporary.addChild(g)
    chips.push({g,angle:random()*Math.PI*2,speed:40+random()*55,life:.3+random()*.12})
  }
  onFrame(time=>{
    follow();wake.alpha=Math.min(1,Math.max(0,(time-.22)/.13))*(1-Math.min(1,Math.max(0,(time-.6)/.2)))
    for(const p of chips){const age=time-.58;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(point.x+Math.cos(p.angle)*p.speed*age,point.y+Math.sin(p.angle)*p.speed*age+40*age*age);p.g.rotation=p.angle+age*2;p.g.alpha=Math.sin(Math.PI*age/p.life)*.85}
  })
  const ring=new Graphics().ellipse(0,0,12,19).stroke({color:0xffefc5,width:2.8})
  ring.position.copyFrom(point);ring.rotation=aim;ring.alpha=0;temporary.addChild(ring)
  tl.to(attacker,{x:home.x-11,rotation:-.06,duration:.22},0)
    .to(attacker,{...pose,duration:.36,ease:'power2.in'},.22)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.46,ease:'power2.inOut'},.78)
    .to(horn,{alpha:1,duration:.12},.17).to(horn,{alpha:0,duration:.23},.78)
    .to(ring,{alpha:.95,duration:.025},.58).to(ring.scale,{x:1.75,y:1.55,duration:.26},.58).to(ring,{alpha:0,duration:.21},.64)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xeeddbc},[],.58)
    .to(defender,{x:defenderHome.x+10,duration:.065,repeat:3,yoyo:true},.58)
    .call(()=>{defender.tint=0xffffff},[],.8)
}
