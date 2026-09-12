import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function batonPass(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(46,Math.max(31,context.source.metrics.height/unit*.21)),baton=make('baton-pass-baton'),loop=make('baton-pass-loop'),stars=make('baton-pass-arrival')
  function update(time){
    const a=socket('hand',true),b=socket('aura',true),u=clamp((time-.3)/.66),bow=Math.min(20,room(a)/3,room(b)/3),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u-Math.sin(Math.PI*u)*bow}
    fit(baton,p,28);baton.rotation=time<.96?-.7+u*Math.PI*2:-.7;baton.clear();baton.alpha=show(time,.12,1.24)
    baton.roundRect(-5,-22,10,44,4).fill(0xe6ba78).roundRect(-5,-22,10,9,3).fill(0xffedb7).roundRect(-5,13,10,9,3).fill(0xffedb7).moveTo(-2,-10).lineTo(-2,10).stroke({color:0xffe4a4,width:1.5})
    fit(loop,b,r*1.65);loop.clear();loop.alpha=show(time,.34,1.57)*.75
    for(let j=0;j<3;j++){const angle=time*3+j*Math.PI*2/3,d=r*(1-.32*u);loop.moveTo(Math.cos(angle)*d,Math.sin(angle)*d*.65).quadraticCurveTo(Math.cos(angle+.55)*d*1.3,Math.sin(angle+.55)*d,Math.cos(angle+1.1)*d,Math.sin(angle+1.1)*d*.65).stroke({color:j%2?0xe9c585:0xf4e6b0,width:2})}
    fit(stars,b,r*1.7);stars.clear();stars.alpha=show(time,.96,1.68)
    const v=clamp((time-.96)/.62);for(let j=0;j<7;j++){const q=j*Math.PI*2/7,d=r*(.2+v*.8);stars.circle(Math.cos(q)*d,Math.sin(q)*d,3*(1-v)+.5).fill(0xf4db9f)}
  }
  onFrame(update);tl.call(()=>{update(.96);onCue({type:'impact'})},[],.96)

}
