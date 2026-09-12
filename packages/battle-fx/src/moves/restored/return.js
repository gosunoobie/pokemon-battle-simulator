import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function returnMove(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const r=Math.min(59,Math.max(32,context.source.metrics.height/unit*.27)),pose=solveContact('tackle',.065)
  const warmth=new Container();warmth.label='return-warmth';warmth.alpha=0;temporary.addChild(warmth)
  const halo=new Graphics().ellipse(0,0,r*.65,r*.75).stroke({color:0xf0c796,width:2,alpha:.6});warmth.addChild(halo)
  const hearts=Array.from({length:3},(_,i)=>{
    const size=5+i,g=new Graphics().moveTo(0,size*.8).bezierCurveTo(-size*1.7,-size*.2,-size*.65,-size*1.35,0,-size*.45)
      .bezierCurveTo(size*.65,-size*1.35,size*1.7,-size*.2,0,size*.8).fill(i%2?0xf3bfbb:0xf6d7ae)
    g.alpha=0;warmth.addChild(g);return g
  })
  const stars=Array.from({length:12},(_,i)=>{
    const size=3+random()*3,g=new Graphics().poly([-size,0,-size*.2,-size*.2,0,-size,size*.2,-size*.2,size,0,size*.2,size*.2,0,size,-size*.2,size*.2]).fill(i%3?0xffe9bd:0xf6c8c0)
    g.alpha=0;temporary.addChild(g);return{g,a:i*Math.PI/6,v:r*(.9+random()),life:.35+random()*.18}
  })
  const bloom=new Graphics();bloom.label='return-impact';bloom.position.copyFrom(focus);bloom.alpha=0
  for(let i=0;i<6;i++){const a=i*Math.PI/3,x=Math.cos(a),y=Math.sin(a);bloom.poly([x*r*.13-y*3,y*r*.13+x*3,x*r*.7,y*r*.7,x*r*.13+y*3,y*r*.13-x*3]).fill(i%2?0xffebbd:0xf5cfc0)}
  bloom.circle(0,0,r*.12).fill(0xfff5dc);temporary.addChild(bloom)
  const follow=time=>{
    warmth.position.copyFrom(socket('center',true));halo.scale.set(1+Math.sin(time*10)*.035)
    hearts.forEach((g,i)=>{const age=time-.1-i*.075,u=age/.52;g.position.set((i-1)*r*.53,-r*(.43+Math.max(0,u)*.36));g.rotation=(i-1)*.15;g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.9:0})
  }
  onFrame(time=>{
    follow(time)
    for(const p of stars){const age=time-.78,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(Math.PI*u)*.9:0;if(age>=0){p.g.position.set(focus.x+Math.cos(p.a)*p.v*age,focus.y+Math.sin(p.a)*p.v*age-15*age);p.g.rotation=age*1.2}}
  })
  tl.to(attacker,{x:home.x-6,y:home.y+3,rotation:-.035,duration:.24},0)
    .to(attacker,{x:pose.x*.56,y:pose.y*.56-r*.5,rotation:-.025,duration:.27,ease:'sine.out'},.24)
    .to(attacker,{...pose,duration:.27,ease:'power2.in'},.51)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.58,ease:'power2.inOut'},.98)
    .to(warmth,{alpha:.85,duration:.18},.06).to(warmth,{alpha:0,duration:.25},.78)
    .to(bloom,{alpha:1,duration:.03},.78).to(bloom.scale,{x:1.25,y:1.25,duration:.18},.78).to(bloom,{alpha:0,duration:.23},.85)
    .call(()=>{follow(.78);onCue({type:'impact'});defender.tint=0xf3dfc3},[],.78)
    .to(defender,{x:defenderHome.x+10,duration:.075,repeat:3,yoyo:true},.78)
    .call(()=>{defender.tint=0xffffff},[],1.04)
}
