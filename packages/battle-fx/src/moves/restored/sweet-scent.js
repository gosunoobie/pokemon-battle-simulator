import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function sweetScent(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(49,Math.max(32,context.target.metrics.height/unit*.23)),petals=Array.from({length:9},(_,i)=>({g:make(`sweet-scent-petal-${i}`),at:.16+i*.055,i})),perfume=make('sweet-scent-cloud'),drops=make('sweet-scent-result')
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true)
    for(const p of petals){const u=clamp((time-p.at)/.66),bow=Math.min(r*.65,room(a)/2,room(b)/2),point={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u+Math.sin(Math.PI*u)*Math.sin(u*7+p.i)*bow};fit(p.g,point,15);p.g.rotation=time*2+p.i;p.g.clear();p.g.alpha=show(time,p.at,p.at+.91)
      p.g.moveTo(-8,0).quadraticCurveTo(-3,-7,8,0).quadraticCurveTo(-3,7,-8,0).fill(p.i%2?0xeab5c4:0xf1d2cb)}
    fit(perfume,b,r*1.6);perfume.clear();perfume.alpha=show(time,.82,1.88)*.55
    for(let i=0;i<5;i++){const q=time*1.4+i*Math.PI*2/5,d=r*.4;perfume.ellipse(Math.cos(q)*d,Math.sin(q)*d*.7,r*.38,r*.26).fill({color:i%2?0xecc4d7:0xd6b2c8,alpha:.32})}
    fit(drops,b,r*1.5);drops.clear();drops.alpha=show(time,1.01,1.93);const v=clamp((time-1.01)/.8);for(let i=0;i<2;i++){const y=r*(v*.5+i*.24-.2);drops.moveTo(-r*.25,y-6).lineTo(0,y).lineTo(r*.25,y-6).stroke({color:0xf0ccce,width:2,alpha:1-v*.6})}
  }
  onFrame(update);tl.call(()=>{update(.82);onCue({type:'impact'})},[],.82)

}
