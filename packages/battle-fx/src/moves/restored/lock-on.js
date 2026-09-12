import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function lockOn(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(62,Math.max(37,context.target.metrics.height/unit*.28)),brackets=make('lock-on-brackets'),dial=make('lock-on-reticle'),flash=make('lock-on-source')
  function update(time){
    const a=socket(context.source.hasAnchor?.('eyes')?'eyes':'emission',true),b=targetSocket('center',true),u=clamp((time-.18)/.7)
    fit(flash,a,22);flash.clear();flash.alpha=show(time,.08,.72);flash.poly([0,-12,2,-2,12,0,2,2,0,12,-2,2,-12,0,-2,-2]).fill(0xf0b388)
    fit(brackets,b,r*1.9);brackets.clear();brackets.alpha=show(time,.17,1.4);const d=r*(1.3-u*.5)
    for(const x of[-1,1])for(const y of[-1,1])brackets.moveTo(x*(d-r*.22),y*d).lineTo(x*d,y*d).lineTo(x*d,y*(d-r*.22)).stroke({color:0xe8a28c,width:3,cap:'round'})
    fit(dial,b,r*1.6);dial.clear();dial.alpha=show(time,.32,1.43);dial.rotation=(1-u)*Math.PI*.75;const radius=r*(.25+.25*u)
    for(let j=0;j<4;j++){const q=j*Math.PI/2;dial.moveTo(Math.cos(q)*radius,Math.sin(q)*radius).arc(0,0,radius,q,q+.84).stroke({color:0xf3c296,width:1.8})}
    dial.moveTo(-r*.15,0).lineTo(r*.15,0).moveTo(0,-r*.15).lineTo(0,r*.15).stroke({color:0xffdfb2,width:2})
  }
  onFrame(update);tl.call(()=>{update(.88);onCue({type:'impact'})},[],.88)

}
