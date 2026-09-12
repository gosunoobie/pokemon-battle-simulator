import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function cut(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const length=Math.min(50,Math.max(26,context.source.metrics.height/unit*.22))
  const point={x:focus.x,y:focus.y+6},angle=.55,rotation=.045
  const pose=solveContact('hand',rotation,{x:point.x-Math.cos(angle+rotation)*length,y:point.y-Math.sin(angle+rotation)*length})
  const swing={angle:-.85},blade=new Container();blade.label='cut-blade';blade.alpha=0;temporary.addChild(blade)
  const trail=new Graphics();blade.addChild(trail)
  blade.addChild(new Graphics().moveTo(0,-3).quadraticCurveTo(length*.42,-length*.15,length,0)
    .quadraticCurveTo(length*.48,length*.025,0,5).closePath().fill(0xd7e6ec)
    .moveTo(0,-3).quadraticCurveTo(length*.42,-length*.15,length,0).stroke({color:0xffffff,width:2,cap:'round'})
    .moveTo(0,3).lineTo(length*.55,0).stroke({color:0x8bafb9,width:1.3}))
  const follow=()=>{blade.position.copyFrom(socket('hand',true));blade.rotation=swing.angle+attacker.rotation}
  const flecks=[]
  for(let i=0;i<10;i++){
    const g=new Graphics().poly([0,-1,7+random()*8,0,0,1]).fill(i%3?0xf6fffc:0xb9d5df)
    g.alpha=0;temporary.addChild(g);flecks.push({g,angle:.55+(random()-.5)*1.5,speed:55+random()*80,life:.22+random()*.13})
  }
  onFrame(time=>{
    follow();trail.clear()
    if(time>=.26&&time<.68){
      const strength=Math.min(1,(time-.26)/.12)*Math.max(0,1-(time-.5)/.18)
      for(let j=0;j<=20;j++){
        const a=-.65+j*.65/20,x=Math.cos(a)*length,y=Math.sin(a)*length
        if(j===0)trail.moveTo(x,y);else trail.lineTo(x,y)
      }
      trail.stroke({color:0xc9e9f3,width:7,alpha:strength*.36,cap:'round'})
        .moveTo(length*.55,-length*.21).lineTo(length*.95,0).stroke({color:0xffffff,width:1.3,alpha:strength*.9})
    }
    for(const p of flecks){const age=time-.5;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(point.x+Math.cos(p.angle)*p.speed*age,point.y+Math.sin(p.angle)*p.speed*age);p.g.rotation=p.angle;p.g.alpha=Math.sin(Math.PI*age/p.life)}
  })
  const nick=new Graphics().poly([-36,-3,0,-1,40,0,0,3]).fill(0xf8fffe)
  nick.position.copyFrom(point);nick.rotation=.7;nick.alpha=0;temporary.addChild(nick)
  tl.to(attacker,{x:home.x-8,rotation:-.04,duration:.18},0)
    .to(attacker,{...pose,duration:.32,ease:'power3.in'},.18)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.4,ease:'power2.inOut'},.7)
    .to(swing,{angle,duration:.24,ease:'power2.in'},.26)
    .to(blade,{alpha:1,duration:.08},.22).to(blade,{alpha:0,duration:.18},.55)
    .to(nick,{alpha:1,duration:.02},.5).to(nick,{alpha:0,duration:.17},.54)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xe1edf0},[],.5)
    .to(defender,{x:defenderHome.x+7,duration:.055,repeat:3,yoyo:true},.5)
    .call(()=>{defender.tint=0xffffff},[],.73)
}
