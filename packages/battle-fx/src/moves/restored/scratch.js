import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function scratch(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('claw')?'claw':'hand'
  const length=Math.min(42,Math.max(24,context.source.metrics.height/unit*.18))
  const point={x:focus.x,y:focus.y+4},angle=.65,rotation=.035
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(angle+rotation)*length,y:point.y-Math.sin(angle+rotation)*length})
  const swing={angle:-.8},claws=new Container();claws.label='scratch-claws';claws.alpha=0;temporary.addChild(claws)
  for(let i=-1;i<=1;i++){
    const y=i*length*.2,reach=length*(1-Math.abs(i)*.12)
    claws.addChild(new Graphics().moveTo(0,y-2).quadraticCurveTo(reach*.6,y-length*.13,reach,y)
      .quadraticCurveTo(reach*.35,y+3,0,y+2).closePath().fill(0xebe4d1)
      .moveTo(0,y-2).quadraticCurveTo(reach*.6,y-length*.13,reach,y).stroke({color:0xfff9e9,width:1.5,cap:'round'}))
  }
  const marks=Array.from({length:3},(_,i)=>{
    const g=new Graphics().moveTo(-length*.46,-length*.57).quadraticCurveTo(-length*.1,-length*.08,length*.45,length*.65)
      .stroke({color:0xfff4dc,width:2.5,cap:'round'})
    g.position.set(point.x+(i-1)*length*.26,point.y);g.alpha=0;temporary.addChild(g);return g
  })
  const flecks=Array.from({length:8},()=>{
    const g=new Graphics().poly([-2,-1,5,0,-2,1]).fill(0xe9dfc8);g.alpha=0;temporary.addChild(g)
    return{g,a:.7+(random()-.5)*1.6,v:45+random()*55,life:.2+random()*.12}
  })
  const follow=()=>{claws.position.copyFrom(socket(attachment,true));claws.rotation=swing.angle+attacker.rotation}
  onFrame(time=>{
    follow()
    for(const p of flecks){const age=time-.38,t=age/p.life;p.g.alpha=t>=0&&t<1?Math.sin(t*Math.PI)*.8:0;if(age>=0){p.g.position.set(point.x+Math.cos(p.a)*p.v*age,point.y+Math.sin(p.a)*p.v*age);p.g.rotation=p.a}}
  })
  tl.to(attacker,{x:home.x-6,rotation:-.025,duration:.13},0)
    .to(attacker,{...pose,duration:.25,ease:'power3.in'},.13)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.38,ease:'power2.inOut'},.56)
    .to(swing,{angle,duration:.2,ease:'power2.in'},.18)
    .to(claws,{alpha:1,duration:.065},.14).to(claws,{alpha:0,duration:.16},.44)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xeee6cf},[],.38)
    .to(defender,{x:defenderHome.x+6,duration:.055,repeat:3,yoyo:true},.38)
    .call(()=>{defender.tint=0xffffff},[],.59)
  marks.forEach((g,i)=>{const at=.38+i*.025;tl.to(g,{alpha:1,duration:.02},at).fromTo(g.scale,{x:1,y:.18},{x:1,y:1,duration:.09},at).to(g,{alpha:0,duration:.17},at+.07)})
}
