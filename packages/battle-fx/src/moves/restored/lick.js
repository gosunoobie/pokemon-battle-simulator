import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function lick(context) {
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


  const attachment=context.source.hasAnchor?.('tongue')?'tongue':context.source.hasAnchor?.('mouth')?'mouth':'emission'
  const root=new Container();root.label='lick-root';root.attachmentSocket=attachment;root.alpha=0;temporary.addChild(root)
  const tip=new Graphics();tip.label='lick-tip';root.addChild(tip)
  const impact=make('lick-impact'),beads=Array.from({length:15},(_,i)=>({g:make(`lick-bead-${i}`),side:i%2?1:-1,reach:.2+random()*.65,size:1.6+random()*1.5}))
  let contact
  function update(time){
    const a=socket(attachment,true),b=targetSocket('center',true),extend=clamp((time-.16)/.5),retract=clamp((time-.78)/.38),reach=extend*(1-retract)
    const front={x:a.x+(b.x-a.x)*reach,y:a.y+(b.y-a.y)*reach},angle=Math.atan2(b.y-a.y,b.x-a.x),nx=-Math.sin(angle),ny=Math.cos(angle)
    root.position.copyFrom(a);root.alpha=time>=.08&&time<1.22?Math.min(1,(time-.08)/.13,(1.22-time)/.17):0
    tip.position.set(front.x-a.x,front.y-a.y);tip.clear()
    const path=u=>{const p={x:a.x+(front.x-a.x)*u,y:a.y+(front.y-a.y)*u},sag=Math.sin(u*Math.PI)*Math.min(28,room(p)*.32)*(.32+Math.sin(time*7)*.11);p.y+=sag;return p}
    const topEdge=[],lower=[]
    for(let j=0;j<=48;j++){const u=j/48,p=path(u),width=Math.min((5+Math.sin(u*Math.PI)*8)*(1-Math.pow(u,9)),room(p)*.7);topEdge.push(p.x-front.x+nx*width,p.y-front.y+ny*width);lower.unshift(p.x-front.x-nx*width,p.y-front.y-ny*width)}
    // A continuous pink tongue flexes from the mouth, with a broad wet tip and central groove.
    tip.poly([...topEdge,...lower]).fill(0xd88ea8)
    for(let j=0;j<=36;j++){const u=j/36*.965,p=path(u);j?tip.lineTo(p.x-front.x,p.y-front.y):tip.moveTo(p.x-front.x,p.y-front.y)}tip.stroke({color:0xaa5f84,width:1.35,alpha:.68,cap:'round'})
    for(let j=0;j<=24;j++){const u=.56+j/24*.37,p=path(u),offset=Math.min(3,room(p)*.16)*Math.sin(u*Math.PI);j?tip.lineTo(p.x-front.x+nx*offset,p.y-front.y+ny*offset):tip.moveTo(p.x-front.x+nx*offset,p.y-front.y+ny*offset)}tip.stroke({color:0xffc7d6,width:2.7,alpha:.75,cap:'round'})
    const age=time-.66,u=clamp(age/.57);impact.clear();fitArt(impact,contact??b,54);impact.alpha=contact&&age>=0&&age<.57?1-u:0
    impact.moveTo(-18,-21+u*13).quadraticCurveTo(12,-3,3,25+u*10).stroke({color:0xeeb4ce,width:4-u*2,alpha:.58,cap:'round'})
      .ellipse(6,-8+u*15,8+u*4,15+u*8).stroke({color:0xf6cfdd,width:1.4,alpha:.51})
    beads.forEach((f,i)=>{const v=clamp(age/1.02),span=contact?Math.min(51,room(contact)*.49):0,q={x:(contact?.x??b.x)+f.side*span*f.reach*v,y:(contact?.y??b.y)+span*(v*.13+v*v*.85)},g=f.g;g.clear();fitArt(g,q,8);g.alpha=contact&&age>=0&&age<1.02?(1-v)*.7:0;g.ellipse(0,0,f.size*.68,f.size*(1+v*.4)).fill({color:i%2?0xd79abc:0xf2c4d5,alpha:.78})})
  }
  onFrame(update)
  tl.call(()=>{contact=targetSocket('center',true);update(.66);onCue({type:'impact'})},[],.66).to({}, {duration:1.85},0)
}
