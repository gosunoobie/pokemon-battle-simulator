import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function rockSmash(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const r=Math.min(48,Math.max(28,context.target.metrics.height/unit*.23)),point={x:focus.x,y:focus.y+12}
  const pose=solveContact('hand',.065,point)
  const stone=new Container();stone.label='rock-smash-stone';stone.position.copyFrom(point);temporary.addChild(stone)
  const chunks=[],radii=Array.from({length:8},()=>r*(.8+random()*.2))
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,b=(i+1)*Math.PI/4,m=(a+b)/2
    const chunk=new Graphics().poly([0,0,Math.cos(a)*radii[i],Math.sin(a)*radii[i],Math.cos(b)*radii[(i+1)%8],Math.sin(b)*radii[(i+1)%8]])
      .fill([0xb6a48b,0x93836e,0xcebaa0,0xa38c70][i%4]).stroke({color:0x776b5c,width:1,alpha:.45})
    chunk.alpha=0;stone.addChild(chunk)
    chunks.push({chunk,vx:Math.cos(m)*(45+random()*40),vy:Math.sin(m)*(35+random()*35)-25,spin:(random()-.5)*5,life:.58+random()*.15})
  }
  const cracks=new Graphics()
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cracks.moveTo(0,0).lineTo(Math.cos(a+.17)*r*.38,Math.sin(a+.17)*r*.38).lineTo(Math.cos(a)*r*.9,Math.sin(a)*r*.9)}
  cracks.stroke({color:0xffe7ba,width:2.2,alpha:.95});cracks.alpha=0;stone.addChild(cracks)
  const fist=new Graphics().poly([-17,-8,-10,-20,4,-20,15,-10,17,5,7,17,-9,15,-18,4])
    .fill(0xeec18c).stroke({color:0xad7953,width:1.8,join:'round'})
    .moveTo(-9,-10).lineTo(-4,-4).moveTo(-2,-14).lineTo(3,-8).moveTo(5,-13).lineTo(10,-7)
    .stroke({color:0xa56e4b,width:1.4,cap:'round'})
  fist.label='rock-smash-hand';fist.alpha=0;fist.scale.set(r/38);temporary.addChild(fist)
  const follow=()=>{fist.position.copyFrom(socket('hand',true));fist.rotation=attacker.rotation+.25}
  const dust=[]
  for(let i=0;i<18;i++){
    const puff=new Graphics().ellipse(0,0,3+random()*5,2+random()*3).fill(i%2?0xd8c4a5:0x9a8c76)
    puff.alpha=0;temporary.addChild(puff)
    dust.push({puff,at:.7+i*.009,vx:(random()-.5)*130,vy:-15-random()*55,life:.4+random()*.18})
  }
  onFrame(time=>{
    follow();const age=Math.max(0,time-.73)
    for(const p of chunks){p.chunk.position.set(p.vx*age,p.vy*age+100*age*age);p.chunk.rotation=p.spin*age;p.chunk.alpha=Math.min(1,Math.max(0,(time-.3)/.2))*Math.max(0,1-age/p.life)*.78}
    for(const p of dust){const age=time-p.at;if(age<0||age>p.life){p.puff.alpha=0;continue}p.puff.position.set(point.x+p.vx*age,point.y+p.vy*age+60*age*age);p.puff.scale.set(1+age*1.4);p.puff.alpha=Math.sin(Math.PI*age/p.life)*.44}
  })
  const hit=new Graphics().circle(0,0,r*.35).stroke({color:0xffe4b3,width:3})
  hit.position.copyFrom(point);hit.alpha=0;temporary.addChild(hit)
  tl.to(attacker,{x:home.x-13,rotation:-.06,duration:.24},0)
    .to(attacker,{...pose,duration:.46,ease:'power3.in'},.24)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.45,ease:'power2.inOut'},.92)
    .to(fist,{alpha:.95,duration:.12},.39).to(fist,{alpha:0,duration:.2},.86)
    .to(cracks,{alpha:1,duration:.03},.7).to(cracks,{alpha:0,duration:.18},.78)
    .to(hit,{alpha:.9,duration:.03},.7).to(hit.scale,{x:2,y:1.6,duration:.26},.7).to(hit,{alpha:0,duration:.2},.77)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xe6d0ab},[],.7)
    .to(defender,{x:defenderHome.x+10,duration:.065,repeat:5,yoyo:true},.7)
    .call(()=>{defender.tint=0xffffff},[],.96)
}
