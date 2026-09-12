import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function outrage(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const r=Math.min(65,Math.max(35,context.source.metrics.height/unit*.3)),pose=solveContact('tackle',.11)
  const mantle=new Container();mantle.label='outrage-mantle';mantle.alpha=0;temporary.addChild(mantle)
  const ribbons=new Graphics();mantle.addChild(ribbons)
  const scales=Array.from({length:12},(_,i)=>{
    const g=new Graphics().poly([-4,0,0,-6,5,0,0,3]).fill(i%2?0xa69cec:0xc8e7ff);g.alpha=0;temporary.addChild(g)
    return{g,phase:i/12,side:i%2?1:-1}
  })
  const follow=time=>{
    mantle.position.copyFrom(socket('center',true));mantle.rotation=attacker.rotation
    ribbons.clear()
    for(let i=0;i<3;i++){
      const y=(i-1)*r*.38,wave=Math.sin(time*15+i*1.8)*r*.1
      ribbons.moveTo(-r*1.12,y+wave).bezierCurveTo(-r*.5,y-r*.42-wave,r*.62,y-r*.25,r*.67,y+r*.17)
        .stroke({color:[0x7965c9,0xbca1f4,0xd8eeff][i],width:[7,4,2][i],alpha:.85,cap:'round'})
    }
    const c=socket('center',true)
    for(const p of scales){const t=(time*1.7+p.phase)%1;p.g.position.set(c.x+r*(.45-t*1.8),c.y+p.side*r*(.24+Math.sin(t*Math.PI)*.25));p.g.rotation=p.side*(.5+t);p.g.alpha=time>.23&&time<1.15?Math.sin(t*Math.PI)*Math.min(1,(time-.23)/.15,(1.15-time)/.24)*.8:0}
  }
  onFrame(follow)
  const crash=new Graphics();crash.label='outrage-crash';crash.position.copyFrom(focus);crash.alpha=0
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5,dx=Math.cos(a),dy=Math.sin(a),reach=r*(i%2?.55:.92)
    crash.poly([dx*8-dy*4,dy*8+dx*4,dx*reach,dy*reach,dx*8+dy*4,dy*8-dx*4]).fill(i%2?0xa797e9:0xe9edff)
  }
  temporary.addChild(crash)
  const ring=new Graphics().ellipse(0,0,r*.29,r*.54).stroke({color:0xb7a2ef,width:3})
  ring.position.copyFrom(focus);ring.alpha=0;temporary.addChild(ring)
  const fragments=Array.from({length:20},()=>{
    const g=new Graphics().poly([-2,-3,4,0,-2,3]).fill(random()<.5?0xc4aaf1:0xcfe7fc);g.alpha=0;temporary.addChild(g)
    return{g,a:random()*Math.PI*2,v:r*(.9+random()*1.5),life:.35+random()*.25}
  })
  onFrame(time=>{for(const p of fragments){const age=time-.86,t=age/p.life;p.g.alpha=t>=0&&t<1?Math.sin(Math.PI*t)*.85:0;if(age>=0){p.g.position.set(focus.x+Math.cos(p.a)*p.v*age,focus.y+Math.sin(p.a)*p.v*age+35*age*age);p.g.rotation=p.a+age*3}}})
  tl.to(attacker,{x:home.x-r*.18,y:home.y+3,rotation:-.07,duration:.34},0)
    .to(attacker,{x:home.x-r*.12,y:home.y-3,rotation:-.025,duration:.2},.34)
    .to(attacker,{...pose,duration:.32,ease:'power3.in'},.54)
    .to(attacker,{x:pose.x-r*.25,y:pose.y-r*.09,rotation:-.025,duration:.17},.99)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.58,ease:'power2.inOut'},1.2)
    .to(mantle,{alpha:.9,duration:.3},.16).to(mantle,{alpha:0,duration:.35},.92)
    .to(crash,{alpha:1,duration:.025},.86).to(crash.scale,{x:1.2,y:1.2,duration:.2},.86).to(crash,{alpha:0,duration:.25},.92)
    .to(ring,{alpha:.8,duration:.04},.88).to(ring.scale,{x:1.6,y:1.3,duration:.34},.88).to(ring,{alpha:0,duration:.26},.98)
    .call(()=>{follow(.86);onCue({type:'impact'});defender.tint=0xc6b4ee},[],.86)
    .to(defender,{x:defenderHome.x+13,duration:.07,repeat:5,yoyo:true},.86)
    .call(()=>{defender.tint=0xffffff},[],1.12)
}
