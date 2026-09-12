import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function metalSound(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(43,Math.max(28,context.target.metrics.height/unit*.19)),fork=make('metal-sound-fork'),rings=[0,1,2,3].map(i=>make(`metal-sound-wave-${i}`)),spark=make('metal-sound-impact')
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true)
    fit(fork,a,35);fork.clear();fork.alpha=show(time,.05,.92);const x=Math.sin(time*75)*1.8;fork.moveTo(-10+x,-20).lineTo(-10+x,2).quadraticCurveTo(0,15,10+x,2).lineTo(10+x,-20).moveTo(0,10).lineTo(0,26).stroke({color:0xd3e3eb,width:4,cap:'round'})
    rings.forEach((g,i)=>{const at=.26+i*.105,u=clamp((time-at)/.5),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};fit(g,p,r*1.5);g.clear();g.alpha=show(time,at,at+.68,.17);g.rotation=(i%2?-1:1)*.2
      const s=r*(.3+u*.75);g.ellipse(0,0,s*.3,s*.85).stroke({color:i%2?0x93b7cb:0xd9e9f0,width:2.3}).moveTo(-s*.16,-s*.56).lineTo(s*.18,s*.55).stroke({color:0xf0fbff,width:1,alpha:.5})})
    fit(spark,b,r*1.65);spark.clear();spark.alpha=show(time,.76,1.62);const q=clamp((time-.76)/.7)
    for(let i=0;i<8;i++){const a=i*Math.PI/4+q*.25,d=r*(.25+q*.75);spark.moveTo(Math.cos(a)*d,Math.sin(a)*d).lineTo(Math.cos(a)*(d+8),Math.sin(a)*(d+8)).stroke({color:i%2?0xb3d1e1:0xebf5f5,width:1.7,alpha:1-q})}
  }
  onFrame(update);tl.call(()=>{update(.76);onCue({type:'impact'})},[],.76)

}
