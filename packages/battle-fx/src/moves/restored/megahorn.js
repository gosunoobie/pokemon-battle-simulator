import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function megahorn(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('horn')?'horn':'emission'
  const base=socket(attachment),length=Math.min(96,Math.max(52,context.source.metrics.height/unit*.38))
  const point={x:focus.x,y:focus.y+8},aim=Math.atan2(point.y-base.y,point.x-base.x),rotation=.075
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(aim+rotation)*length,y:point.y-Math.sin(aim+rotation)*length})
  const horn=new Container();horn.label='megahorn-horn';horn.alpha=0;temporary.addChild(horn)
  const shape=new Graphics().moveTo(0,-length*.24).bezierCurveTo(length*.35,-length*.35,length*.75,-length*.1,length,0)
    .quadraticCurveTo(length*.48,length*.05,0,length*.21).closePath().fill(0xb5d871).stroke({color:0x527544,width:1.8,join:'round'})
    .moveTo(0,-length*.02).quadraticCurveTo(length*.55,-length*.08,length,0)
    .quadraticCurveTo(length*.48,length*.05,0,length*.21).closePath().fill(0x729951)
    .moveTo(length*.08,-length*.21).quadraticCurveTo(length*.42,-length*.24,length*.88,-length*.025).stroke({color:0xe4f5b4,width:3.2,cap:'round'})
  for(let i=1;i<=4;i++){
    const x=length*i*.13,spread=length*.2*(1-i*.16)
    shape.moveTo(x,-spread).quadraticCurveTo(x-length*.035,0,x-length*.06,spread*.7).stroke({color:0x628c47,width:1.6,alpha:.8})
  }
  const collar=new Graphics().ellipse(0,0,length*.09,length*.3).stroke({color:0xdff69f,width:3.5,alpha:.8})
  const charge=new Graphics();horn.addChild(collar,shape,charge)
  const follow=()=>{horn.position.copyFrom(socket(attachment,true));horn.rotation=aim+attacker.rotation}
  const splinters=[]
  for(let i=0;i<18;i++){
    const size=5+random()*7,g=new Graphics().poly([-size*.45,-1.7,size,0,-size*.45,1.7]).fill(i%3?0xdcf5a1:0x9bc85b)
    g.alpha=0;temporary.addChild(g)
    splinters.push({g,angle:(random()-.5)*Math.PI*1.65,speed:70+random()*95,life:.32+random()*.17})
  }
  onFrame(time=>{
    follow();charge.clear()
    const strength=Math.min(1,Math.max(0,(time-.1)/.22))*(1-Math.min(1,Math.max(0,(time-.88)/.24)))
    collar.alpha=strength*(.65+Math.sin(time*23)*.2)
    for(let i=0;i<8;i++){
      const phase=(time*1.7+i/8)%1,angle=i*Math.PI*.25+time*5,r=length*(.48-.3*phase)
      charge.circle(-length*.12+Math.cos(angle)*r*.55,Math.sin(angle)*r,1.4+phase*1.7).fill({color:0xe6fdb6,alpha:strength*Math.sin(phase*Math.PI)*.8})
    }
    for(const p of splinters){const age=time-.88;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(point.x+Math.cos(p.angle)*p.speed*age,point.y+Math.sin(p.angle)*p.speed*age+50*age*age);p.g.rotation=p.angle+age*2;p.g.alpha=Math.sin(Math.PI*age/p.life)}
  })
  const shock=new Graphics().ellipse(0,0,15,29).stroke({color:0xd6f49b,width:3.8})
    .ellipse(-5,0,10,21).stroke({color:0xf4ffd4,width:1.7,alpha:.9})
  shock.position.copyFrom(point);shock.rotation=aim;shock.alpha=0;temporary.addChild(shock)
  const flash=new Graphics().poly([-7,-6,0,-26,7,-6,28,0,7,6,0,26,-7,6,-21,0]).fill(0xf1ffc4)
  flash.position.copyFrom(point);flash.rotation=aim;flash.alpha=0;temporary.addChild(flash)
  tl.to(attacker,{x:home.x-18,rotation:-.09,duration:.38},0)
    .to(attacker,{...pose,duration:.5,ease:'power3.in'},.38)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.58,ease:'power2.inOut'},1.12)
    .to(horn,{alpha:1,duration:.22},.1).to(horn,{alpha:0,duration:.3},1.1)
    .to(shock,{alpha:1,duration:.025},.88).to(shock.scale,{x:2.15,y:1.85,duration:.4},.88).to(shock,{alpha:0,duration:.32},.96)
    .to(flash,{alpha:1,duration:.025},.88).to(flash,{alpha:0,duration:.15},.94)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xd1eaa0},[],.88)
    .to(defender,{x:defenderHome.x+14,duration:.075,repeat:3,yoyo:true},.88)
    .call(()=>{defender.tint=0xffffff},[],1.18)
}
