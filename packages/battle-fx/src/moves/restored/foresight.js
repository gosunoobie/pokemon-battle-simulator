import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function foresight(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(66,Math.max(39,context.target.metrics.height/unit*.3)),scan=make('foresight-scan'),halo=make('foresight-result'),eye=make('foresight-source')
  function update(time){
    const a=socket(context.source.hasAnchor?.('eyes')?'eyes':'emission',true),b=targetSocket('center',true),u=clamp((time-.2)/.75)
    fit(eye,a,23);eye.clear();eye.alpha=show(time,.07,.9);eye.moveTo(-12,0).quadraticCurveTo(0,-7,12,0).stroke({color:0xefd9a3,width:2}).circle(0,0,3).fill(0xffeec2)
    fit(scan,b,r*1.65);scan.clear();scan.alpha=show(time,.2,1.43);const y=time<.95?r*(-.9+u*.9):r*.42*Math.sin(clamp((time-.95)/.4)*Math.PI)
    scan.moveTo(-r*.65,y).lineTo(r*.65,y).stroke({color:0xfff0bf,width:2.4,cap:'round'}).rect(-r*.65,y-5,r*1.3,10).fill({color:0xe4d1a0,alpha:.1})
    for(const side of[-1,1])scan.moveTo(side*r*.75,-r*.8).lineTo(side*r*.75,r*.8).stroke({color:0xc4b693,width:1,alpha:.45})
    fit(halo,b,r*1.6);halo.clear();halo.alpha=show(time,.95,1.54);const q=clamp((time-.95)/.5)
    halo.ellipse(0,0,r*(.45+q*.2),r*(.68+q*.2)).stroke({color:0xf2e6bf,width:1.8,alpha:1-q*.6})
    for(let j=0;j<4;j++){const x=(j-1.5)*r*.3;halo.circle(x,0,2).fill(0xffedb8)}
  }
  onFrame(update);tl.call(()=>{update(.95);onCue({type:'impact'})},[],.95)

}
