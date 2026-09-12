import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function mindReader(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(48,Math.max(31,context.target.metrics.height/unit*.23)),eye=make('mind-reader-source-eye'),links=make('mind-reader-links'),thought=make('mind-reader-target-eye')
  function update(time){
    const a=socket(context.source.hasAnchor?.('eyes')?'eyes':'emission',true),b=targetSocket('center',true),u=clamp((time-.28)/.8)
    fit(eye,a,37);eye.clear();eye.alpha=show(time,.1,1.3);eye.moveTo(-23,0).quadraticCurveTo(0,-17,23,0).quadraticCurveTo(0,17,-23,0).stroke({color:0xc9abeb,width:2}).ellipse(0,0,5,9).fill(0xead5fa)
    links.clear();links.alpha=show(time,.28,1.44)*.6;const bow=Math.min(r*.7,room(a)/2,room(b)/2)
    for(let lane=0;lane<3;lane++){for(let j=0;j<=40;j++){const q=u*j/40,x=a.x+(b.x-a.x)*q,y=a.y+(b.y-a.y)*q+Math.sin(Math.PI*q)*bow*(lane-1)+Math.sin(q*14-time*7)*bow*.08*Math.sin(Math.PI*q);j?links.lineTo(x,y):links.moveTo(x,y)}links.stroke({color:lane%2?0xdbbef3:0xab91cd,width:1.3,alpha:.55})}
    const p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};fit(thought,p,r*1.5);thought.clear();thought.alpha=show(time,.55,1.73)
    const open=.3+.7*Math.sin(Math.PI*.5*u),s=r*.65;thought.moveTo(-s,0).quadraticCurveTo(0,-s*.7*open,s,0).quadraticCurveTo(0,s*.7*open,-s,0).fill({color:0x876aaf,alpha:.2}).stroke({color:0xdfc8ef,width:2}).ellipse(0,0,s*.14,s*.3*open).fill(0xf1e4f9)
    thought.circle(0,0,s*(1.05+.05*Math.sin(time*5))).stroke({color:0xac91c7,width:1,alpha:.5})
  }
  onFrame(update);tl.call(()=>{update(1.08);onCue({type:'impact'})},[],1.08)

}
