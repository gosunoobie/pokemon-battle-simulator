import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function psychUp(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(48,Math.max(31,context.source.metrics.height/unit*.22)),ribbons=make('psych-up-ribbons'),beads=[0,1,2].map(i=>make(`psych-up-transfer-${i}`)),boost=make('psych-up-result'),colors=[0xcab5eb,0xedc29f,0xa9d9cf]
  function update(time){
    const a=targetSocket('aura',true),b=socket('aura',true),u=clamp((time-.3)/.9),bow=Math.min(r*.75,room(a)/2,room(b)/2);ribbons.clear();ribbons.alpha=show(time,.2,1.54)*.55
    for(let lane=0;lane<3;lane++){for(let j=0;j<=40;j++){const q=u*j/40,x=a.x+(b.x-a.x)*q,y=a.y+(b.y-a.y)*q+Math.sin(Math.PI*q)*Math.sin(q*6+lane*2)*bow;j?ribbons.lineTo(x,y):ribbons.moveTo(x,y)}ribbons.stroke({color:colors[lane],width:1.7,alpha:.7})
      const p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u+Math.sin(Math.PI*u)*Math.sin(u*6+lane*2)*bow};fit(beads[lane],p,15);beads[lane].clear();beads[lane].alpha=show(time,.22,1.44);beads[lane].poly([0,-8,5,0,0,8,-5,0]).fill(colors[lane])}
    fit(boost,b,r*1.7);boost.clear();boost.alpha=show(time,1.2,1.91);const v=clamp((time-1.2)/.6)
    for(let j=0;j<3;j++){const x=(j-1)*r*.44,y=r*(.25-v*.7);boost.moveTo(x-6,y+6).lineTo(x,y).lineTo(x+6,y+6).stroke({color:colors[j],width:2.4,cap:'round'})}
    boost.ellipse(0,r*.42,r*(.5+v*.28),r*.12).stroke({color:0xd9c9e9,width:1.4,alpha:.6})
  }
  onFrame(update);tl.call(()=>{update(1.2);onCue({type:'impact'})},[],1.2)

}
