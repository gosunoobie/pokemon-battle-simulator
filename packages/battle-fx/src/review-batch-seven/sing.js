import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

export const timing = Object.freeze({ contact: .96, duration: 4.19, markers: Object.freeze([
  { id: 'last-note-release', label: 'Final continuing note release', timeSeconds: 3.20 },
  { id: 'lullaby-fade', label: 'Final moving lullaby fade', timeSeconds: 3.81 },
]) })

export default function sing(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const notes=Array.from({length:26},(_,i)=>{
    const g=new Graphics().ellipse(-2,5,4.5,3).fill(i%2?0xe7c4f3:0xb8dced).moveTo(2,5).lineTo(2,-10).quadraticCurveTo(11,-10,9,-3).stroke({color:i%2?0xe7c4f3:0xb8dced,width:2,cap:'round'})
    g.label=`sing-note-${i}`;g.alpha=0;temporary.addChild(g);return g
  })
  const lull=new Graphics();lull.label='sing-lullaby';lull.alpha=0;temporary.addChild(lull)
  const r=Math.min(43,Math.max(28,context.target.metrics.height/unit*.22))
  function update(time){
    const from=socket('emission',true),to=targetSocket('center',true),bow=Math.min(26,room(from)/2,room(to)/2)
    notes.forEach((g,i)=>{const age=time-.2-i*.12,u=clamp(age/.76),p={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u+Math.sin(Math.PI*u)*Math.sin(u*5-time*3+i)*bow}
      fit(g,p,15);g.scale.x*=Math.sign(temporary.scale.x);g.rotation=Math.sin(time*4+i)*.13*Math.sign(temporary.scale.x);g.alpha=age>=0&&age<1.02?Math.min(1,age*12)*Math.min(1,(1.02-age)*5)*clamp((timing.duration-time)/.38):0})
    fit(lull,to,r*1.5);lull.clear()
    for(let i=0;i<3;i++){const u=(Math.max(0,time-.96)*.7+i/3)%1,y=(.35-u)*r
      lull.moveTo(-r*.8,y).quadraticCurveTo(0,y+r*.33,r*.8,y).stroke({color:i%2?0xeacbf1:0xc3e1f4,width:2,alpha:Math.sin(Math.PI*u)*.65,cap:'round'})}
  }
  onFrame(update)
  tl.to(lull,{alpha:1,duration:.25},.88).to(lull,{alpha:0,duration:.38},3.81)
    .call(()=>{update(.96);onCue({type:'impact'})},[],.96)

}
