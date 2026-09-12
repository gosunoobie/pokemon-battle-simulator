import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function stomp(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, solveContact, unit } = bindEffectSpace(context)
  const r=Math.min(54,Math.max(30,context.source.metrics.height/unit*.25))
  const point={x:focus.x,y:focus.y+(floor.y-focus.y)*.45},pose=solveContact('foot',.045,point)
  const center=context.target.base('center'),ground=context.target.base('floor')
  const contactY=center.y+(ground.y-center.y)*.45
  // Keep the lifted actor inside the available headroom, even when its foot is near the target.
  const lift=Math.min(r*.85,Math.max(0,(contactY-context.source.metrics.height-context.source.metrics.width*.08-8*context.scene.unit)/unit))
  const sole=new Graphics();sole.label='stomp-foot';sole.alpha=0;temporary.addChild(sole)
  sole.ellipse(0,-r*.28,r*.25,r*.28).fill({color:0xe6d2ad,alpha:.6}).stroke({color:0xffedc8,width:2.2})
  for(let i=-1;i<=1;i++)sole.ellipse(i*r*.19,-r*(i===0?.72:.65),r*.095,r*.12).fill(0xf8e5bd)
  const fall=new Graphics();fall.alpha=0;temporary.addChild(fall)
  for(const side of [-1,1])fall.moveTo(side*r*.36,-r*.95).lineTo(side*r*.36,-r*.25).stroke({color:0xe9dbbc,width:1.8,alpha:.75,cap:'round'})
  const ring=new Graphics().ellipse(0,0,r*.58,r*.15).stroke({color:0xf3dfb5,width:3})
  ring.label='stomp-pressure';ring.position.copyFrom(point);ring.alpha=0;temporary.addChild(ring)
  const dust=Array.from({length:15},(_,i)=>{
    const g=new Graphics().ellipse(0,0,3+random()*3,2).fill(i%2?0xc3b18c:0xe5d4b4);g.alpha=0;temporary.addChild(g)
    return{g,side:i%2?1:-1,dx:r*(.3+random()*.8),dy:9+random()*18,life:.3+random()*.18}
  })
  const follow=()=>{sole.position.copyFrom(socket('foot',true));sole.rotation=attacker.rotation;fall.position.copyFrom(sole.position)}
  onFrame(time=>{
    follow()
    for(const p of dust){const u=(time-.66)/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.65:0;if(u>=0){p.g.position.set(floor.x+p.side*p.dx*u,floor.y-p.dy*Math.sin(Math.PI*u));p.g.scale.set(1+u*.3)}}
  })
  tl.to(attacker,{x:home.x-5,y:home.y+3,rotation:-.035,duration:.2},0)
    .to(attacker,{x:pose.x,y:pose.y-lift,rotation:-.065,duration:.28,ease:'power2.out'},.2)
    .to(attacker,{...pose,duration:.18,ease:'power3.in'},.48)
    .to(attacker,{x:pose.x-r*.2,y:pose.y-Math.min(r*.2,lift),rotation:-.03,duration:.17,ease:'power2.out'},.76)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.4,ease:'power2.inOut'},1)
    .to(sole,{alpha:1,duration:.1},.28).to(sole,{alpha:0,duration:.18},.78)
    .to(fall,{alpha:.8,duration:.045},.49).to(fall,{alpha:0,duration:.15},.69)
    .to(ring,{alpha:.95,duration:.03},.66).to(ring.scale,{x:1.55,y:1.3,duration:.23},.66).to(ring,{alpha:0,duration:.23},.72)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xe8d8b8},[],.66)
    .to(defender,{y:defenderHome.y+8,duration:.065},.66).to(defender,{y:defenderHome.y,duration:.27},.78)
    .call(()=>{defender.tint=0xffffff},[],.9)
}
