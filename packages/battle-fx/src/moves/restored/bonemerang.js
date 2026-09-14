import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function bonemerang(context) {
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

  const attachment=context.source.hasAnchor?.('bone')?'bone':'hand'
  const root=make('bonemerang-root');root.attachmentSocket=attachment
  const tip=make('bonemerang-tip'),outgoing=make('bonemerang-contact-0'),impact=make('bonemerang-impact'),catchRing=make('bonemerang-catch')
  const wake=Array.from({length:9},(_,i)=>make(`bonemerang-wake-${i}`))
  const dust=Array.from({length:17},(_,i)=>({g:make(`bonemerang-grain-${i}`),side:i%2?1:-1,reach:.24+random()*.71}))
  let firstContact,contact
  function path(time,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,n={x:-dy/d,y:dx/d}
    if(time<=.28)return{...a,angle:Math.atan2(dy,dx)}
    if(time<=.70){const v=clamp((time-.28)/.42),q={x:a.x+dx*v,y:a.y+dy*v},bow=Math.min(32,room(q)*.42)*Math.sin(v*Math.PI);return{x:q.x-n.x*bow,y:q.y-n.y*bow,angle:Math.atan2(dy,dx)}}
    if(time<=1.35){const v=clamp((time-.70)/.65),span=Math.min(55,room(b)*.43),forward=span*Math.sin(v*Math.PI),cross=span*.66*Math.sin(v*Math.PI*2);return{x:b.x+dx/d*forward+n.x*cross,y:b.y+dy/d*forward+n.y*cross,angle:Math.atan2(dy,dx)+v*Math.PI}}
    const v=clamp((time-1.35)/.58),q={x:b.x-dx*v,y:b.y-dy*v},bow=Math.min(35,room(q)*.4)*Math.sin(v*Math.PI)
    return{x:q.x+n.x*bow,y:q.y+n.y*bow,angle:Math.atan2(-dy,-dx)}
  }
  function bone(g,time){
    // A rotating dumbbell keeps its real foremost cap at local zero.
    const phase=time*16,c=Math.cos(phase),s=Math.sin(phase),r=22,cap=7,side=c>=0?1:-1,front={x:Math.abs(c*r)+cap,y:side*s*r}
    const a={x:-c*r-front.x,y:-s*r-front.y},b={x:c*r-front.x,y:s*r-front.y},nx=-s*4.5,ny=c*4.5
    g.clear().poly([a.x+nx,a.y+ny,b.x+nx,b.y+ny,b.x-nx,b.y-ny,a.x-nx,a.y-ny]).fill(0xd4bd94)
      .circle(a.x,a.y,cap).circle(b.x,b.y,cap).fill(0xe5d2a8)
      .moveTo(a.x-s*2,a.y+c*2).lineTo(b.x-s*2,b.y+c*2).stroke({color:0xffedc8,width:2.2,alpha:.9,cap:'round'})
      .circle(a.x-1.3,a.y-1.3,2.2).circle(b.x-1.3,b.y-1.3,2.2).fill({color:0xfff0d0,alpha:.8})
  }
  function update(time){
    const a=socket(attachment,true),b=targetSocket('center',true),front=path(time,a,b)
    root.clear();fitArt(root,a,22);root.alpha=time>=.1&&time<2.13?Math.min(.8,(time-.1)/.12,(2.13-time)/.2):0
    root.moveTo(-11,8).quadraticCurveTo(0,14,11,4).stroke({color:0xd9c8a3,width:2,alpha:time<.3||time>1.8?.7:.25,cap:'round'})
    bone(tip,time);fitArt(tip,front,64);tip.rotation=front.angle;tip.alpha=time>=.12&&time<2.13?Math.min(1,(time-.12)/.12,(2.13-time)/.2):0
    wake.forEach((g,i)=>{const q=path(Math.max(.28,time-(i+1)*.023),a,b);g.clear();fitArt(g,q,12);g.rotation=q.angle;g.alpha=time>.3&&time<1.93?(1-i/10)*.32:0;g.moveTo(-8,-2).quadraticCurveTo(-3,0,0,1).stroke({color:i%2?0xc1aa81:0xe5d2ad,width:2.3-i*.15,alpha:.72,cap:'round'})})
    const hit=(g,point,age)=>{const v=clamp(age/.49);g.clear();fitArt(g,point??b,65);g.alpha=point&&age>=0&&age<.49?(1-v)*.85:0;for(let j=0;j<6;j++){const z=j*Math.PI/3,r=12+v*31;g.moveTo(Math.cos(z)*r*.45,Math.sin(z)*r*.45).lineTo(Math.cos(z+.14)*r,Math.sin(z+.14)*r).stroke({color:j%2?0xd0b88d:0xf4e2bc,width:2.8-v*1.4,alpha:.8,cap:'round'})}}
    hit(outgoing,firstContact,time-.70);hit(impact,contact,time-1.35)
    const caught=clamp((time-1.93)/.24);catchRing.clear();fitArt(catchRing,a,36);catchRing.alpha=time>=1.93&&time<2.17?1-caught:0;catchRing.ellipse(0,0,13+caught*14,8+caught*9).stroke({color:0xf1dfb7,width:1.8,alpha:.67})
    dust.forEach((f,i)=>{const age=time-1.35,v=clamp(age/.84),span=contact?Math.min(60,room(contact)*.46):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)-span*.18*v+span*1.16*v*v},g=f.g;g.clear();fitArt(g,q,7);g.rotation=time*2+i;g.alpha=contact&&age>=0&&age<.84?(1-v)*.75:0;g.poly([-2,-1,2,-2,3,1,-1,2]).fill(i%2?0xc7ad81:0xe7d1a7)})
  }
  onFrame(update)
  tl.call(()=>{firstContact=targetSocket('center',true);update(.70)},[],.70)
    .call(()=>{contact=targetSocket('center',true);update(1.35);onCue({type:'impact'})},[],1.35)
    .to({}, {duration:2.25},0)
}
