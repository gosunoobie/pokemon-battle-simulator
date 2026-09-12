import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function crossChop(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const size=Math.min(1.2,Math.max(.72,context.target.metrics.height/unit/170)),point={x:focus.x,y:focus.y+6}
  const pose=solveContact('hand',.085,point)
  const arms=new Container();arms.label='cross-chop-hands';arms.scale.set(size);arms.alpha=0;temporary.addChild(arms)
  const palms=[]
  for(const side of [-1,1]){
    const palm=new Graphics().roundRect(-7,-29,14,47,4).fill(side<0?0xf3c495:0xffdfb3)
      .stroke({color:0xb77855,width:1.5}).moveTo(-3,-22).lineTo(-3,-9).moveTo(2,-22).lineTo(2,-9)
      .stroke({color:0xbf8b63,width:1.2,alpha:.8})
    palm.x=side*22;palm.rotation=side*.15;arms.addChild(palm);palms.push({palm,side})
  }
  const follow=()=>arms.position.copyFrom(socket('hand',true))
  const slashes=[new Graphics(),new Graphics()];slashes.forEach(g=>temporary.addChild(g))
  const sparks=[]
  for(let i=0;i<20;i++){
    const g=new Graphics().poly([0,-2,9+random()*8,0,0,2]).fill(i%3?0xffe4b5:0xd48e6c)
    g.alpha=0;temporary.addChild(g)
    const angle=(i%4)*Math.PI/2+Math.PI/4+(random()-.5)*.3
    sparks.push({g,angle,speed:45+random()*75,life:.3+random()*.15})
  }
  onFrame(time=>{
    follow();const close=Math.max(0,Math.min(1,(time-.53)/.23))
    for(const p of palms){p.palm.x=p.side*(22-17*close);p.palm.rotation=p.side*(.15+.58*close)}
    for(let i=0;i<2;i++){
      const g=slashes[i],side=i?1:-1,u=Math.max(0,Math.min(1,(time-.58)/.18));g.clear()
      if(time<.58||time>1.08){g.alpha=0;continue}
      for(const [width,color,alpha] of [[19,0xbc6949,.2],[7,0xf7bd86,.9],[2,0xfff6de,1]]){
        const span=51*size
        g.moveTo(point.x-side*span,point.y-span)
          .quadraticCurveTo(point.x-side*span*(1-u),point.y-span*(1-u),point.x+side*span*(u*1.65-1),point.y+span*(u*1.65-1))
          .stroke({color,width:width*size,alpha,cap:'round',join:'round'})
      }
      g.alpha=1-Math.max(0,(time-.8)/.28)
    }
    for(const p of sparks){const age=time-.76;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(point.x+Math.cos(p.angle)*p.speed*age,point.y+Math.sin(p.angle)*p.speed*age);p.g.rotation=p.angle;p.g.alpha=Math.sin(Math.PI*age/p.life)*.85}
  })
  const flash=new Graphics().poly([-6,-6,0,-29,6,-6,29,0,6,6,0,29,-6,6,-29,0]).fill(0xffebc7)
  flash.position.copyFrom(point);flash.rotation=Math.PI/4;flash.scale.set(size);flash.alpha=0;temporary.addChild(flash)
  tl.to(attacker,{x:home.x-12,rotation:-.09,duration:.26},0)
    .to(attacker,{...pose,duration:.5,ease:'power3.in'},.26)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.49,ease:'power2.inOut'},1.0)
    .to(arms,{alpha:.9,duration:.14},.39).to(arms,{alpha:0,duration:.23},.94)
    .to(flash,{alpha:1,duration:.025},.76).to(flash,{alpha:0,duration:.23},.82)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xf7c79e},[],.76)
    .to(defender,{x:defenderHome.x+13,duration:.06,repeat:5,yoyo:true},.76)
    .call(()=>{defender.tint=0xffffff},[],1.02)
}
