import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function astonish(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(42,Math.max(28,context.target.metrics.height/unit*.2)),mask=make('astonish-mask'),rays=make('astonish-impact'),echo=make('astonish-echo')
  let contact
  function update(time){
    const a=socket('emission',true),b=contact??targetSocket('center',true),u=clamp((time-.18)/.42),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u-Math.sin(Math.PI*u)*Math.min(18,room(a)/3,room(b)/3)}
    fit(mask,p,r*1.6);mask.clear();mask.alpha=show(time,.08,1.02);const s=r*(.42+.42*u)
    mask.moveTo(-s*.7,s*.55).bezierCurveTo(-s*1.1,-s*.6,-s*.55,-s,0,-s).bezierCurveTo(s*.65,-s,s*1.05,-s*.3,s*.72,s*.65).lineTo(s*.24,s*.4).lineTo(0,s*.75).lineTo(-s*.25,s*.39).closePath().fill({color:0x9f80b4,alpha:.48}).stroke({color:0xd8bae9,width:2})
      .ellipse(-s*.28,-s*.21,s*.13,s*.23).fill(0xf3e3ed).ellipse(s*.28,-s*.21,s*.13,s*.23).fill(0xf3e3ed).ellipse(0,s*.27,s*.12,s*.17).fill(0x573f73)
    fit(rays,b,r*1.65);rays.clear();rays.alpha=show(time,.6,1.24);const q=clamp((time-.6)/.56)
    for(let j=0;j<8;j++){const a=j*Math.PI/4,d=r*(.6+q*.55);rays.moveTo(Math.cos(a)*d,Math.sin(a)*d).lineTo(Math.cos(a+.06)*(d+8),Math.sin(a+.06)*(d+8)).stroke({color:j%2?0xeccde7:0xbda0d8,width:2,alpha:1-q})}
    fit(echo,b,r*1.7);echo.clear();echo.alpha=show(time,.72,1.35)*.6;echo.ellipse(0,0,r*(.7+q*.5),r*(.4+q*.35)).stroke({color:0xbc9bd6,width:1.5,alpha:1-q})
  }
  onFrame(update);tl.call(()=>{contact=targetSocket('center',true);update(.6);onCue({type:'impact'});defender.tint=0xd9c2e8},[],.6).call(()=>{defender.tint=0xffffff},[],.76)

}
