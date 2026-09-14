import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function flail(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'), w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
  const clamp = n => Math.max(0, Math.min(1, n)), room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 5)
  function fit(p) {
    let rotation = p.rotation ?? 0, c, s, rx, ry
    for (let j = 0; j < 14; j++) { c = Math.cos(rotation); s = Math.sin(rotation); rx = (w * Math.abs(c) + h * Math.abs(s)) / 2; ry = (h * Math.abs(c) + w * Math.abs(s)) / 2; if (rx * 2 <= right - left && ry * 2 <= bottom - top) break; rotation *= .5 }
    const x = p.x + center.x * c - center.y * s, y = p.y + center.x * s + center.y * c
    return { x: p.x + Math.max(left + rx, Math.min(right - rx, x)) - x, y: p.y + Math.max(top + ry, Math.min(bottom - ry, y)) - y, rotation }
  }
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fitArt = (g,p,r) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/r)) }
  function rayRoom(p, angle) {
    const x = Math.cos(angle), y = Math.sin(angle), limits = []
    if (x > 1e-6) limits.push((right - p.x - 3) / x); if (x < -1e-6) limits.push((left - p.x + 3) / x)
    if (y > 1e-6) limits.push((bottom - p.y - 3) / y); if (y < -1e-6) limits.push((top - p.y + 3) / y)
    return Math.max(0,Math.min(...limits))
  }


  const attachment='tackle',base=socket(attachment),receiver=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center'),tw=context.target.metrics.width/unit,th=context.target.metrics.height/unit
  const offset={x:focus.x-receiver.x,y:focus.y-receiver.y}
  const lo={x:Math.max(left+w/2+base.x-center.x,left+tw/2+offset.x),y:Math.max(top+h/2+base.y-center.y,top+th/2+offset.y)}
  const hi={x:Math.min(right-w/2+base.x-center.x,right-tw/2+offset.x),y:Math.min(bottom-h/2+base.y-center.y,bottom-th/2+offset.y)}
  const point={x:Math.max(lo.x,Math.min(hi.x,focus.x)),y:Math.max(lo.y,Math.min(hi.y,focus.y))},pose=fit(solveContact(attachment,0,point)),targetPose={x:defenderHome.x+point.x-focus.x,y:defenderHome.y+point.y-focus.y}
  const root=new Container();root.label='flail-root';root.attachmentSocket=attachment;temporary.addChild(root)
  const tip=new Graphics();tip.label='flail-tip';root.addChild(tip)
  const impact=make('flail-impact'),wobble=make('flail-wobble'),scramble=make('flail-scramble')
  const dust=Array.from({length:17},(_,i)=>({g:make(`flail-dust-${i}`),side:i%2?1:-1,reach:.23+random()*.67,size:2+random()*2,life:1.15}))
  let contact
  function update(time){
    if(Math.abs(time-.82)<.00001){const b=targetSocket('center',true),p={x:Math.max(lo.x,Math.min(hi.x,b.x)),y:Math.max(lo.y,Math.min(hi.y,b.y))};attacker.position.copyFrom(solveContact(attachment,0,p));attacker.rotation=0;defender.x+=p.x-b.x;defender.y+=p.y-b.y}
    const fitted=fit(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const a=socket(attachment,true),c=socket('center',true),b=targetSocket('center',true);root.position.copyFrom(a);root.alpha=time>=.57&&time<1.18?Math.min(1,(time-.57)/.12,(1.18-time)/.23):0
    tip.clear();const r=Math.min(33,room(a));tip.moveTo(0,0).quadraticCurveTo(-r*.6,-r*.65,-r,-r*.25).lineTo(-r*.74,r*.25).quadraticCurveTo(-r*.4,r*.57,0,0).fill({color:0xf1d8b7,alpha:.62})
      .moveTo(-r*.71,-r*.48).lineTo(-r*.15,-r*.18).lineTo(0,0).lineTo(-r*.23,r*.2).stroke({color:0xf9e6c7,width:2.2,alpha:.76,cap:'round'})
    wobble.clear();fitArt(wobble,c,98);wobble.alpha=time>=.08&&time<.72?Math.min(1,(time-.08)/.14,(.72-time)/.16)*.7:0
    const rock=Math.sin(time*23)*8;for(const side of[-1,1]){wobble.moveTo(side*58,-20+rock).quadraticCurveTo(side*75,2,side*56,24-rock).stroke({color:0xdcc3a3,width:2,alpha:.7,cap:'round'});wobble.moveTo(side*67,-12-rock).quadraticCurveTo(side*79,6,side*68,16+rock).stroke({color:0xb99d80,width:1.2,alpha:.6,cap:'round'})}
    scramble.clear();fitArt(scramble,c,89);scramble.alpha=time>=.59&&time<1.35?Math.sin(clamp((time-.59)/.76)*Math.PI)*.55:0
    for(let j=0;j<3;j++){const q=time*11+j*2.09,x=Math.cos(q)*49,y=Math.sin(q)*32;scramble.moveTo(x-8,y+3).lineTo(x+7,y-4).stroke({color:j%2?0xc6aa8d:0xe9ceb0,width:2.4,alpha:.7,cap:'round'})}
    const age=time-.82,u=clamp(age/.71);impact.clear();fitArt(impact,contact??b,72);impact.alpha=contact&&age>=0&&age<.71?1-u:0
    for(let j=0;j<7;j++){const q=j*Math.PI*2/7+Math.sin(time*6)*.1,inner=10+u*16,outer=inner+13*(1-u);impact.moveTo(Math.cos(q)*inner,Math.sin(q)*inner).quadraticCurveTo(Math.cos(q+.2)*outer,Math.sin(q+.2)*outer,Math.cos(q)*outer*1.3,Math.sin(q)*outer*1.3).stroke({color:j%2?0xeacbad:0xc6a586,width:3-u,alpha:.78,cap:'round'})}
    dust.forEach((f,i)=>{const v=clamp(age/f.life),span=contact?Math.min(70,room(contact)*.46):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)-span*.18*v+span*1.18*v*v},g=f.g;g.clear();fitArt(g,q,10);g.rotation=time*1.6+i;g.alpha=contact&&age>=0&&age<f.life?(1-v)*.71:0;g.ellipse(0,0,f.size*(1+v*.6),f.size*.72).fill({color:i%2?0xcdb797:0xa88e75,alpha:.74})})
  }
  onFrame(update)
  tl.to(attacker,{...fit({x:home.x-9,y:home.y+2,rotation:-.12}),duration:.16},0)
    .to(attacker,{...fit({x:home.x+8,y:home.y-3,rotation:.13}),duration:.16},.16)
    .to(attacker,{...fit({x:home.x-13,y:home.y+4,rotation:-.15}),duration:.18},.32)
    .to(attacker,{...pose,duration:.32,ease:'power3.in'},.5).to(defender,{...targetPose,duration:.28,ease:'power2.inOut'},.54)
    .call(()=>{update(.82);contact=targetSocket('center',true);update(.82);onCue({type:'impact'})},[],.82)
    .to(attacker,{...fit({x:pose.x-14,y:pose.y+9,rotation:.08}),duration:.19},.84)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.69,ease:'power2.inOut'},1.08)
    .to(defender,{x:defenderHome.x,y:defenderHome.y,duration:.55,ease:'power2.inOut'},1.12).to({}, {duration:2.15},0)
}
