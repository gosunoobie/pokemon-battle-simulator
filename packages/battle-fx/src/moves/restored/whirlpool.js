import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function whirlpool(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, floor, socket, unit } = bindEffectSpace(context)
  const rx=Math.min(88,Math.max(44,context.target.metrics.width/unit*.52)),height=Math.min(150,Math.max(70,context.target.metrics.height/unit*.78))
  const vortex=new Container();vortex.label='whirlpool-vortex';vortex.position.copyFrom(floor);vortex.alpha=0;temporary.addChild(vortex)
  const water=new Graphics();vortex.addChild(water)
  const drops=[]
  for(let i=0;i<32;i++){
    const g=new Graphics().ellipse(0,0,2+random()*2,1.5).fill(i%3?0xb2edfa:0xf3ffff)
    vortex.addChild(g);drops.push({g,phase:i/32,offset:random()*6})
  }
  const inlet=new Graphics();inlet.label='whirlpool-inlet';temporary.addChild(inlet)
  const clamp=u=>Math.max(0,Math.min(1,u))
  const update=time=>{
    const grow=clamp((time-.3)/.46),drain=clamp((time-1.65)/.65),h=height*grow*(1-drain*.85)
    vortex.alpha=grow*(1-drain);water.clear();inlet.clear();inlet.alpha=time>=.22&&time<.91?1:0
    if(inlet.alpha){
      const from=socket('emission',true),head=(time-.22)/.54
      for(let i=0;i<9;i++){
        const p=head-i*.025;if(p<0||p>1)continue
        const x=from.x+(floor.x-from.x)*p,y=from.y+(floor.y-from.y)*p-25*Math.sin(Math.PI*p)
        inlet.ellipse(x,y,5-i*.3,2.5).fill({color:i%2?0xa9efff:0x51bce7,alpha:(1-i/10)*.85})
      }
    }
    if(vortex.alpha<=0)return
    water.ellipse(0,0,rx*1.05,rx*.27).fill({color:0x247bae,alpha:.22})
      .moveTo(-rx*.48,0).quadraticCurveTo(-rx*.6,-h*.6,-rx,-h)
      .quadraticCurveTo(0,-h-rx*.2,rx,-h).quadraticCurveTo(rx*.6,-h*.6,rx*.48,0)
      .quadraticCurveTo(0,rx*.1,-rx*.48,0).closePath().fill({color:0x3cadd9,alpha:.13})
    for(let band=0;band<7;band++){
      const u=band/6,r=rx*(.48+.52*u),phase=time*7+band*.9
      for(let j=0;j<=26;j++){
        const a=phase+j/26*Math.PI*1.65,x=Math.cos(a)*r,y=-h*u+Math.sin(a)*r*.2
        if(j===0)water.moveTo(x,y);else water.lineTo(x,y)
      }
      water.stroke({color:band%2?0x92e3f4:0x4ebbe3,width:band===6?4:2.7,alpha:.7,cap:'round'})
    }
    for(let i=0;i<drops.length;i++){
      const p=drops[i],u=(p.phase+time*.57)%1,a=time*8-u*Math.PI*5+p.offset*.08,r=rx*(.48+.52*u)
      p.g.position.set(Math.cos(a)*r,-h*u+Math.sin(a)*r*.2);p.g.rotation=Math.atan2(-h*.57,Math.cos(a+Math.PI/2)*r*8)
      p.g.alpha=.35+.6*(.5+.5*Math.sin(a));p.g.scale.x=1+u*.9
    }
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-6,rotation:-.025,duration:.2},0)
    .to(attacker,{x:home.x+6,rotation:0,duration:.22},.2)
    .to(attacker,{x:home.x,duration:.35},.6)
    .call(()=>{update(.76);onCue({type:'impact'});defender.tint=0xbfe5ef},[],.76)
    .to(defender,{x:defenderHome.x+4,y:defenderHome.y+2,duration:.075,repeat:3,yoyo:true},.76)
    .call(()=>{defender.tint=0xffffff},[],1.08)
}
