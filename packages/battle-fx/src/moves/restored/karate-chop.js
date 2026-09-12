import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function karateChop(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const size=Math.min(1.15,Math.max(.72,context.target.metrics.height/unit/170))
  const point={x:focus.x,y:focus.y+6},pose=solveContact('hand',.055,point)
  const palm=new Container();palm.label='karate-chop-hand';palm.scale.set(size);palm.alpha=0;temporary.addChild(palm)
  palm.addChild(new Graphics().moveTo(-8,17).lineTo(-9,-22).quadraticCurveTo(-5,-31,2,-29)
    .lineTo(7,-27).lineTo(9,-1).lineTo(16,5).quadraticCurveTo(20,12,12,20).lineTo(-8,17).closePath()
    .fill(0xf5dfba).stroke({color:0xba8560,width:1.5,join:'round'})
    .moveTo(-4,-22).lineTo(-3,-6).moveTo(1,-22).lineTo(2,-7).moveTo(7,2).lineTo(5,11)
    .stroke({color:0xc39976,width:1.2,cap:'round'}))
  const follow=()=>{palm.position.copyFrom(socket('hand',true));palm.rotation=attacker.rotation-.48}
  const sweep=new Graphics();sweep.label='karate-chop-sweep';temporary.addChild(sweep)
  const flecks=[]
  for(let i=0;i<12;i++){
    const fleck=new Graphics().poly([0,-2,8+random()*7,0,0,2]).fill(i%3?0xffeccb:0xd6b18c)
    fleck.alpha=0;temporary.addChild(fleck)
    flecks.push({fleck,angle:-.1+random()*Math.PI*1.25,speed:45+random()*65,life:.28+random()*.1})
  }
  onFrame(time=>{
    follow();sweep.clear()
    const u=Math.max(0,Math.min(1,(time-.34)/.18))
    if(time>=.34&&time<.86){
      for(const [width,color,alpha] of [[17,0xe7ae77,.22],[5,0xffd5a1,.85],[1.8,0xfff8e6,1]]){
        for(let j=0;j<=18;j++){
          const p=u*j/18,x=point.x+(-48+48*p)*size,y=point.y+(-66+66*p*p)*size
          if(j===0)sweep.moveTo(x,y);else sweep.lineTo(x,y)
        }
        sweep.stroke({color,width:width*size,alpha,cap:'round',join:'round'})
      }
      sweep.alpha=1-Math.max(0,(time-.55)/.31)
    }else sweep.alpha=0
    for(const p of flecks){const age=time-.52;if(age<0||age>p.life){p.fleck.alpha=0;continue}p.fleck.position.set(point.x+Math.cos(p.angle)*p.speed*age,point.y+Math.sin(p.angle)*p.speed*age);p.fleck.rotation=p.angle;p.fleck.alpha=Math.sin(Math.PI*age/p.life)*.9}
  })
  const strike=new Graphics().poly([-3,-29,4,-6,10,0,3,5,6,29,-3,7,-8,0,-3,-6]).fill(0xfff4d8)
  strike.position.copyFrom(point);strike.rotation=-.42;strike.scale.set(size);strike.alpha=0;temporary.addChild(strike)
  tl.to(attacker,{x:home.x-7,rotation:-.075,duration:.2},0)
    .to(attacker,{...pose,duration:.32,ease:'power3.in'},.2)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.43,ease:'power2.inOut'},.72)
    .to(palm,{alpha:.9,duration:.1},.25).to(palm,{alpha:0,duration:.2},.66)
    .to(strike,{alpha:1,duration:.025},.52).to(strike,{alpha:0,duration:.2},.59)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xf4d4ac},[],.52)
    .to(defender,{x:defenderHome.x+7,duration:.055,repeat:3,yoyo:true},.52)
    .call(()=>{defender.tint=0xffffff},[],.75)
}
