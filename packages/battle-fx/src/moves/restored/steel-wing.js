import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function steelWing(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  function fitPose(p) {
    let angle=p.rotation??0,c,s,rx,ry
    for(let i=0;i<12;i++){c=Math.cos(angle);s=Math.sin(angle);rx=(w*Math.abs(c)+h*Math.abs(s))/2;ry=(h*Math.abs(c)+w*Math.abs(s))/2;if(rx*2<=right-left&&ry*2<=bottom-top)break;angle*=.5}
    const x=p.x+center.x*c-center.y*s,y=p.y+center.x*s+center.y*c
    return{x:p.x+Math.max(left+rx,Math.min(right-rx,x))-x,y:p.y+Math.max(top+ry,Math.min(bottom-ry,y))-y,rotation:angle}
  }
  const fitActor=()=>{const p=fitPose(attacker);attacker.position.set(p.x,p.y);attacker.rotation=p.rotation}
  const room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const fitArt=(g,p,extent)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/extent))}
  const clamp=x=>Math.max(0,Math.min(1,x))
  const receiver=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center')
  const recoil=Math.max(0,Math.min(9,right-receiver.x-context.target.metrics.width/(2*unit)))

  const wingSocket=context.source.hasAnchor?.('wing')?'wing':'hand',r=Math.min(46,Math.max(31,h*.2)),pose=fitPose(solveContact(wingSocket,.06))
  const wing=new Graphics();wing.label='steel-wing-tip';wing.alpha=0;temporary.addChild(wing)
  const ribbon=new Graphics();ribbon.alpha=0;temporary.addChild(ribbon)
  const cut=new Graphics();cut.label='steel-wing-impact';cut.alpha=0;temporary.addChild(cut)
  const sparks=Array.from({length:12},(_,i)=>{const g=new Graphics().poly([-3,0,0,-1.5,5,0,0,1.5]).fill(i%2?0xf2fbff:0xadcbd9);g.alpha=0;temporary.addChild(g);return{g,a:random()*Math.PI*2,delay:random()*.07}})
  let contact
  function update(time){
    fitActor();const u=clamp((time-.4)/.36),retract=clamp((time-.81)/.27),reach=u*(1-retract),from=socket(wingSocket,true),to=contact??targetSocket('center',true)
    const p={x:from.x+(to.x-from.x)*reach,y:from.y+(to.y-from.y)*reach},swing=-.55*(1-u)+.45*retract
    fitArt(wing,p,r*1.95);wing.rotation=swing;wing.alpha=time>=.18&&time<1.12?Math.min(1,(time-.18)*6)*Math.min(1,(1.12-time)*7):0;wing.clear()
    wing.poly([0,0,-r*.45,-r*.3,-r*1.5,-r*.35,-r*1.6,r*.08,-r*.72,r*.58]).fill(0x718d9e).stroke({color:0xddeff6,width:1.5})
    for(let j=0;j<5;j++){const x=-r*(.16+j*.24),y=r*(.13+j*.08);wing.poly([x,-r*.14,x-r*.38,-r*.26,x-r*.28,y,x+r*.18,r*.03]).fill(j%2?0xb9cfda:0xdce9ef).stroke({color:0x8caaba,width:.8})}
    const shine=((time-.18)*1.6)%1;wing.moveTo(-r*1.4+r*1.2*shine,-r*.24).lineTo(-r*1.24+r*1.2*shine,r*.2).stroke({color:0xffffff,width:2.5,alpha:.8})
    ribbon.clear();ribbon.alpha=wing.alpha*.55;ribbon.moveTo(from.x,from.y).lineTo(p.x,p.y).stroke({color:0xc1dae7,width:2,alpha:.5,cap:'round'})
    const age=time-.76,v=clamp(age/.48);cut.clear();cut.alpha=contact&&age>=0&&age<.48?1-v:0
    if(contact){fitArt(cut,contact,r*1.5);cut.moveTo(-r*(.35+v*.4),r*(.5+v*.45)).lineTo(r*(.35+v*.4),-r*(.5+v*.45)).stroke({color:0xf2fbff,width:5*(1-v)+.5,cap:'round'})}
    sparks.forEach(({g,a,delay})=>{const t=age-delay,q=clamp(t/.52),d=contact?Math.max(0,Math.min(r*1.7,room(contact)-6)):0;g.alpha=contact&&t>=0&&t<.52?1-q:0;if(contact){g.position.set(contact.x+Math.cos(a)*d*q,contact.y+Math.sin(a)*d*q);g.rotation=a;g.scale.set(Math.min(1,room(contact)/10))}})
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:-10,y:2,rotation:-.04}),duration:.23},0).to(attacker,{...pose,duration:.34,ease:'power3.in'},.39)
    .call(()=>{contact=targetSocket('center',true);update(.76);onCue({type:'impact'});defender.tint=0xd3e7f0},[],.76)
    .to(defender,{x:defenderHome.x+recoil,duration:.075,repeat:1,yoyo:true},.76).call(()=>{defender.tint=0xffffff},[],.98)
    .to(attacker,{x:0,y:0,rotation:0,duration:.5,ease:'power2.inOut'},1.1)

}
