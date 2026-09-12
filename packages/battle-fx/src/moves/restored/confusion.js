import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function confusion(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('eyes')?'eyes':'emission'
  const rx=Math.min(70,Math.max(34,context.target.metrics.width/unit*.3)),ry=Math.min(62,Math.max(30,context.target.metrics.height/unit*.29))
  const glint=new Graphics().poly([-10,0,-2,-2,0,-10,2,-2,10,0,2,2,0,10,-2,2]).fill(0xf2b4de)
  glint.label='confusion-source';glint.alpha=0;temporary.addChild(glint)
  const field=new Container();field.label='confusion-field';field.alpha=0;temporary.addChild(field)
  field.addChild(new Graphics().ellipse(0,0,rx*.8,ry*.85).fill({color:0xb873cf,alpha:.08}))
  const bands=Array.from({length:3},(_,i)=>{
    const g=new Graphics().ellipse(0,0,rx*(.82+i*.1),ry*(.3+i*.1)).stroke({color:[0xefb0d8,0xc899e4,0xf7cae6][i],width:i===1?2.6:1.8,alpha:.85})
    field.addChild(g);return g
  })
  const pressure=new Graphics();pressure.label='confusion-pressure';pressure.alpha=0;temporary.addChild(pressure)
  const flecks=Array.from({length:14},(_,i)=>{const g=new Graphics().poly([0,-3,2,0,0,3,-2,0]).fill(i%2?0xf0bedf:0xc7a2e4);g.alpha=0;temporary.addChild(g);return{g,a:i*Math.PI/7,v:30+random()*55,life:.34+random()*.17}})
  const update=time=>{
    glint.position.copyFrom(socket(attachment,true));glint.rotation=time*.5
    const center=targetSocket('center',true);field.position.copyFrom(center);pressure.position.copyFrom(center)
    bands.forEach((g,i)=>{g.rotation=i*Math.PI/3+time*(i%2?-1:1)*1.5;g.scale.set(1+Math.sin(time*10+i)*.035)})
    pressure.clear()
    for(let i=0;i<8;i++){const a=i*Math.PI/4+time*.5,k=1.03+Math.max(0,time-.66)*.9
      pressure.moveTo(Math.cos(a)*rx*k,Math.sin(a)*ry*k).lineTo(Math.cos(a)*rx*(k+.15),Math.sin(a)*ry*(k+.15)).stroke({color:0xf2c0e4,width:1.7,cap:'round'})}
    for(const p of flecks){const age=time-.66,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.85:0;if(age>=0){p.g.position.set(center.x+Math.cos(p.a)*(rx*.4+p.v*age),center.y+Math.sin(p.a)*(ry*.4+p.v*age));p.g.rotation=age*2}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x+3,rotation:.012,duration:.2},0).to(attacker,{x:home.x,rotation:0,duration:.3},.72)
    .to(glint,{alpha:1,duration:.09},.14).to(glint,{alpha:0,duration:.25},.44)
    .to(field,{alpha:1,duration:.3},.27).fromTo(field.scale,{x:.72,y:.72},{x:1,y:1,duration:.25},.27)
    .to(field.scale,{x:.67,y:.67,duration:.14,ease:'power2.in'},.52).to(field.scale,{x:1.14,y:1.14,duration:.2,ease:'power2.out'},.66)
    .to(field,{alpha:0,duration:.35},.91)
    .to(pressure,{alpha:.9,duration:.04},.66).to(pressure,{alpha:0,duration:.27},.74)
    .call(()=>{update(.66);onCue({type:'impact'});defender.tint=0xe7b5dd},[],.66)
    .to(defender,{x:defenderHome.x+6,duration:.055,repeat:3,yoyo:true},.66).call(()=>{defender.tint=0xffffff},[],.92)
}
