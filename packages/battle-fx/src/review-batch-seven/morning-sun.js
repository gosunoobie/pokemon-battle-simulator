import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// The source charge is the original recipe; only its hold/fade is extended.
// The healing finish follows the measured matching suffix of the full recording.
const HEAL = 148595 / 44100
export const timing = Object.freeze({ contact: 1.15, duration: 4.57, markers: Object.freeze([
  { id: 'sun-rise', label: 'Sun rises', timeSeconds: .06 },
  { id: 'sun-high', label: 'Sun reaches its height', timeSeconds: .76 },
  { id: 'heal', label: 'Golden healing aura begins', timeSeconds: HEAL },
  { id: 'heal-crest', label: 'Healing glints brighten', timeSeconds: 3.49 },
  { id: 'heal-fade', label: 'Rising healing light fades', timeSeconds: 4.25 },
]) })

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
  const healing = new Container(); healing.label = 'morning-sun-healing'; healing.alpha = 0; temporary.addChild(healing)
  const aura = new Graphics(); aura.label = 'morning-sun-healing-aura'; healing.addChild(aura)
  const rings = new Graphics(); rings.label = 'morning-sun-healing-rings'; healing.addChild(rings)
  const core = new Graphics(); core.label = 'morning-sun-healing-core'; healing.addChild(core)
  const glints = Array.from({ length: 15 }, (_, i) => {
    const g = new Graphics().poly([0,-5,1.25,-1.25,5,0,1.25,1.25,0,5,-1.25,1.25,-5,0,-1.25,-1.25])
      .fill(i % 3 ? 0xeaffc4 : 0xfff9d6)
    g.label = `morning-sun-healing-glint-${i}`; healing.addChild(g); return g
  })
  function update(time){
    fit(dawn,socket('aura',true),r*1.65);sun.clear();shafts.clear()
    const rise=clamp((time-.06)/.7),sy=-r*(.48+rise*.32),rad=r*.23
    sun.circle(0,sy,rad).fill({color:0xffcc74,alpha:.3}).circle(0,sy,rad*.72).fill(0xffe8ad)
    for(let i=0;i<10;i++){const a=time*.4+i*Math.PI/5;sun.moveTo(Math.cos(a)*rad*1.15,sy+Math.sin(a)*rad*1.15).lineTo(Math.cos(a)*rad*1.5,sy+Math.sin(a)*rad*1.5).stroke({color:0xffd483,width:1.8,alpha:.8,cap:'round'})}
    for(let i=0;i<5;i++){const x=(i-2)*r*.24;shafts.moveTo(x*.3,sy+rad).lineTo(x,r*.46).stroke({color:0xffd58c,width:4,alpha:.09}).moveTo(x*.3,sy+rad).lineTo(x,r*.46).stroke({color:0xffedb8,width:1,alpha:.3})}
    motes.forEach((g,i)=>{const u=(time*.7+i/15)%1,lane=i%5,x=(lane-2)*r*.24;g.position.set(x*(.3+u*.7),sy+rad+(r*.46-sy-rad)*u);g.alpha=Math.sin(Math.PI*u)*.75;g.scale.set(r/64)})
    fit(healing,socket('aura',true),r*1.6)
    const age = time - HEAL, life = timing.duration - HEAL
    healing.alpha = age >= 0 && age < life ? clamp(age / .12) * clamp((life - age) / .32) : 0
    const crest = Math.max(0, 1 - Math.abs(time - 3.49) / .18)
    aura.clear().ellipse(0,r*.08,r*(.53+crest*.055),r*.82).fill({color:0xebffc6,alpha:.055+crest*.025})
      .ellipse(0,r*.06,r*.34,r*.65).fill({color:0xfff4c4,alpha:.075})
    core.clear().moveTo(-r*.105,0).lineTo(r*.105,0).moveTo(0,-r*.105).lineTo(0,r*.105)
      .stroke({color:0xf2ffd6,width:2.4,alpha:.45+crest*.3,cap:'round'})
    rings.clear()
    for(let i=0;i<3;i++) {
      const q=(Math.max(0,age)*1.15+i/3)%1, y=r*(.6-q*1.32)
      rings.ellipse(0,y,r*(.24+Math.sin(q*Math.PI)*.26),r*.075)
        .stroke({color:i%2?0xd8f6ba:0xffe6ab,width:1.3,alpha:Math.sin(q*Math.PI)*.28})
    }
    glints.forEach((g,i)=>{
      const q=(Math.max(0,age)*1.05+i/15)%1, lane=i%5-2
      g.position.set(lane*r*.245+Math.sin(q*Math.PI*2+i)*r*.025,r*(.67-q*1.58))
      g.rotation=Math.sin(time*2+i)*.13;g.scale.set(r/64*(.58+Math.sin(q*Math.PI)*.38))
      g.alpha=Math.sin(q*Math.PI)**1.2*(.68+crest*.2)
    })
  }
  onFrame(update)
  tl.to(dawn,{alpha:1,duration:.45},.05).to(dawn,{alpha:0,duration:.5},4.07).call(()=>{update(1.15);onCue({type:'impact'})},[],1.15)
    .call(()=>{},[],timing.duration)

}
