import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function odorSleuth(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(40,Math.max(27,context.target.metrics.height/unit*.19)),scents=[0,1,2].map(i=>make(`odor-sleuth-scent-${i}`)),sniff=make('odor-sleuth-sniff'),mark=make('odor-sleuth-result')
  function update(time){
    const a=targetSocket('center',true),b=socket('emission',true)
    scents.forEach((g,i)=>{const at=.2+i*.12,u=clamp((time-at)/.62),bend=Math.min(r*.42,room(a)/2,room(b)/2),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u+Math.sin(Math.PI*u)*bend*(i-1)};fit(g,p,28);g.clear();g.alpha=show(time,at,at+.88)
      const s=1-u*.55;g.scale.set(g.scale.x*s);g.moveTo(-12,5).bezierCurveTo(-17,-6,6,-10,8,-1).bezierCurveTo(12,9,-5,11,-5,2).stroke({color:i%2?0xe2bd86:0xc3a173,width:2,cap:'round'})})
    fit(sniff,b,r*1.4);sniff.clear();sniff.alpha=show(time,.37,1.44);const q=.25+.07*Math.sin(time*18);for(let j=0;j<2;j++)sniff.ellipse(0,0,r*(q+j*.17),r*(q*.7+j*.1)).stroke({color:0xdcc38e,width:1.6,alpha:.6})
    fit(mark,a,r*1.7);mark.clear();mark.alpha=show(time,1.06,1.72);const v=clamp((time-1.06)/.55);mark.circle(0,0,r*(.4+v*.35)).stroke({color:0xe8cc98,width:2}).moveTo(-r*.16,0).lineTo(-r*.02,r*.15).lineTo(r*.28,-r*.2).stroke({color:0xf4ddb1,width:2,cap:'round'})
  }
  onFrame(update);tl.call(()=>{update(1.06);onCue({type:'impact'})},[],1.06)

}
