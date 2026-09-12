import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function leafBlade(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('blade')?'blade':'hand'
  const length=Math.min(86,Math.max(40,context.source.metrics.height/unit*.34))
  const point={x:focus.x,y:focus.y+6},angle=.35,rotation=.07
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(angle+rotation)*length,y:point.y-Math.sin(angle+rotation)*length})
  const swing={angle:-1.3},blade=new Container();blade.label='leaf-blade-leaf';blade.alpha=0;temporary.addChild(blade)
  const ribbon=new Graphics();blade.addChild(ribbon)
  const leaf=new Graphics().moveTo(0,0).bezierCurveTo(length*.14,-length*.32,length*.67,-length*.3,length,0)
    .bezierCurveTo(length*.57,length*.27,length*.18,length*.19,0,0).closePath().fill(0x83bd59)
    .moveTo(0,0).bezierCurveTo(length*.14,-length*.32,length*.67,-length*.3,length,0).stroke({color:0xe3ffa5,width:2.7,cap:'round'})
    .moveTo(0,0).quadraticCurveTo(length*.52,length*.02,length,0).stroke({color:0xd5ef8a,width:2.2})
  for(let i=1;i<=4;i++){
    const x=length*(.13+i*.14),span=length*(.2-i*.025)
    leaf.moveTo(x,0).lineTo(x-length*.11,-span).moveTo(x,0).lineTo(x-length*.1,span*.7).stroke({color:0xb3d980,width:1.2,alpha:.85})
  }
  blade.addChild(leaf)
  const follow=()=>{blade.position.copyFrom(socket(attachment,true));blade.rotation=swing.angle+attacker.rotation}
  const fragments=[]
  for(let i=0;i<12;i++){
    const size=5+random()*6,g=new Graphics().moveTo(-size,0).quadraticCurveTo(0,-size*.7,size,0)
      .quadraticCurveTo(0,size*.6,-size,0).closePath().fill(i%2?0xbce580:0x6fab50)
      .moveTo(-size,0).lineTo(size,0).stroke({color:0xe4f5b1,width:.8})
    g.alpha=0;temporary.addChild(g);fragments.push({g,angle:(random()-.5)*Math.PI*1.5,speed:65+random()*85,life:.34+random()*.17,spin:(random()-.5)*13})
  }
  onFrame(time=>{
    follow();ribbon.clear()
    if(time>=.44&&time<1.13){
      const strength=Math.min(1,(time-.44)/.16)*Math.max(0,1-(time-.82)/.31)
      // Tapered fan follows the physical leaf sweep, within one blade length of the hand.
      const span=.92*Math.min(1,(time-.44)/.2)
      for(let j=0;j<=22;j++){
        const a=-span+j*span/22,r=length*(.94+.1*j/22)
        if(j===0)ribbon.moveTo(Math.cos(a)*r,Math.sin(a)*r);else ribbon.lineTo(Math.cos(a)*r,Math.sin(a)*r)
      }
      for(let j=22;j>=0;j--){const a=-span+j*span/22,r=length*(.94-.29*Math.sin(j/22*Math.PI));ribbon.lineTo(Math.cos(a)*r,Math.sin(a)*r)}
      ribbon.closePath().fill({color:0xb7ea77,alpha:strength*.55})
    }
    for(const p of fragments){const age=time-.82;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(point.x+Math.cos(p.angle)*p.speed*age,point.y+Math.sin(p.angle)*p.speed*age+45*age*age);p.g.rotation=p.angle+age*p.spin;p.g.scale.y=.4+.6*Math.abs(Math.cos(age*10));p.g.alpha=Math.sin(Math.PI*age/p.life)}
  })
  const flash=new Graphics().poly([-48,-2,-5,-5,0,-18,5,-4,51,1,5,5,0,18,-5,4]).fill(0xf0ffd0)
  flash.position.copyFrom(point);flash.rotation=.45;flash.alpha=0;temporary.addChild(flash)
  tl.to(attacker,{x:home.x-14,rotation:-.075,duration:.28},0)
    .to(attacker,{...pose,duration:.54,ease:'power3.in'},.28)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.62,ease:'power2.inOut'},1.03)
    .to(swing,{angle,duration:.38,ease:'power2.in'},.44)
    .to(blade,{alpha:1,duration:.2},.18).to(blade,{alpha:0,duration:.27},1.05)
    .to(flash,{alpha:1,duration:.025},.82).to(flash,{alpha:0,duration:.21},.88)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xd0edb3},[],.82)
    .to(defender,{x:defenderHome.x+12,duration:.07,repeat:3,yoyo:true},.82)
    .call(()=>{defender.tint=0xffffff},[],1.1)
}
