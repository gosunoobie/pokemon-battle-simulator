import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function morningSun(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(64,Math.max(40,context.source.metrics.height/unit*.3))
  const dawn=new Container();dawn.label='morning-sun-dawn';dawn.alpha=0;temporary.addChild(dawn)
  const sun=new Graphics(),shafts=new Graphics();dawn.addChild(shafts,sun)
  const motes=Array.from({length:15},(_,i)=>{const g=new Graphics().circle(0,0,1.5+i%2).fill(i%2?0xffe7a9:0xfff6cd);dawn.addChild(g);return g})
  function update(time){
    fit(dawn,socket('aura',true),r*1.65);sun.clear();shafts.clear()
    const rise=clamp((time-.06)/.7),sy=-r*(.48+rise*.32),rad=r*.23
    sun.circle(0,sy,rad).fill({color:0xffcc74,alpha:.3}).circle(0,sy,rad*.72).fill(0xffe8ad)
    for(let i=0;i<10;i++){const a=time*.4+i*Math.PI/5;sun.moveTo(Math.cos(a)*rad*1.15,sy+Math.sin(a)*rad*1.15).lineTo(Math.cos(a)*rad*1.5,sy+Math.sin(a)*rad*1.5).stroke({color:0xffd483,width:1.8,alpha:.8,cap:'round'})}
    for(let i=0;i<5;i++){const x=(i-2)*r*.24;shafts.moveTo(x*.3,sy+rad).lineTo(x,r*.46).stroke({color:0xffd58c,width:4,alpha:.09}).moveTo(x*.3,sy+rad).lineTo(x,r*.46).stroke({color:0xffedb8,width:1,alpha:.3})}
    motes.forEach((g,i)=>{const u=(time*.7+i/15)%1,lane=i%5,x=(lane-2)*r*.24;g.position.set(x*(.3+u*.7),sy+rad+(r*.46-sy-rad)*u);g.alpha=Math.sin(Math.PI*u)*.75;g.scale.set(r/64)})
  }
  onFrame(update)
  tl.to(dawn,{alpha:1,duration:.45},.05).to(dawn,{alpha:0,duration:.5},1.82).call(()=>{update(1.15);onCue({type:'impact'})},[],1.15)

}
