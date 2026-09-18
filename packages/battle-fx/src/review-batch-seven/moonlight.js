import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Retain the independent crescent, falling curtain and moving reflection.
// Silver/mint healing light rises during the verified suffix of the full sound.
const HEAL = 193089 / 44100
export const timing = Object.freeze({ contact: 1.15, duration: 5.57, markers: Object.freeze([
  { id: 'moon-rise', label: 'Moonlight curtain appears', timeSeconds: .08 },
  { id: 'heal', label: 'Silver healing aura begins', timeSeconds: HEAL },
  { id: 'heal-crest', label: 'Healing light brightens', timeSeconds: 4.53 },
  { id: 'heal-fade', label: 'Rising healing light fades', timeSeconds: 5.25 },
]) })

export default function moonlight(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(65,Math.max(40,context.source.metrics.height/unit*.3))
  const night=new Container();night.label='moonlight-curtain';night.alpha=0;temporary.addChild(night)
  const moon=new Graphics(),curtain=new Graphics(),reflection=new Graphics();night.addChild(curtain,moon,reflection)
  const streaks=Array.from({length:14},(_,i)=>{const g=new Graphics().moveTo(0,-4).lineTo(0,4).stroke({color:i%2?0xe5e6ff:0xc2d8ef,width:1.2,alpha:.75});night.addChild(g);return g})
  const healing = new Container(); healing.label = 'moonlight-healing'; healing.alpha = 0; temporary.addChild(healing)
  const aura = new Graphics(); aura.label = 'moonlight-healing-aura'; healing.addChild(aura)
  const ribbons = new Graphics(); ribbons.label = 'moonlight-healing-ribbons'; healing.addChild(ribbons)
  const core = new Graphics(); core.label = 'moonlight-healing-core'; healing.addChild(core)
  const glints = Array.from({ length: 14 }, (_, i) => {
    const g = new Graphics().poly([0,-5.5,1.4,-1.4,4,0,1.4,1.4,0,5.5,-1.4,1.4,-4,0,-1.4,-1.4])
      .fill(i % 3 ? 0xdcfcec : 0xf5f2ff)
    g.label = `moonlight-healing-glint-${i}`; healing.addChild(g); return g
  })
  function update(time){
    fit(night,socket('aura',true),r*1.6);moon.clear();curtain.clear();reflection.clear()
    const y=-r*.83,s=r*.26
    moon.moveTo(s*.45,y-s).bezierCurveTo(-s*1.5,y-s,-s*1.5,y+s,s*.45,y+s).bezierCurveTo(-s*.5,y+s*.38,-s*.5,y-s*.38,s*.45,y-s).fill(0xe6e5ff)
    curtain.poly([-r*.13,y+s,r*.13,y+s,r*.34,r*.46,-r*.34,r*.46]).fill({color:0xbabfe8,alpha:.09})
    streaks.forEach((g,i)=>{const u=(time*.58+i/14)%1;g.position.set(Math.sin(i*2.4)*r*(.12+u*.2),y+s+u*r*1.04);g.alpha=Math.sin(Math.PI*u)*.75;g.scale.set(r/65)})
    for(let i=0;i<3;i++){const u=(time*.5+i/3)%1;reflection.ellipse(0,r*.48,r*(.18+u*.35),r*(.04+u*.07)).stroke({color:0xc7e0f0,width:1.3,alpha:Math.sin(Math.PI*u)*.5})}
    fit(healing,socket('aura',true),r*1.6)
    const age=time-HEAL, life=timing.duration-HEAL
    healing.alpha=age>=0&&age<life?clamp(age/.15)*clamp((life-age)/.32):0
    const crest=Math.max(0,1-Math.abs(time-4.53)/.18)
    aura.clear().ellipse(0,r*.04,r*(.48+crest*.045),r*.88).fill({color:0xc7f6e9,alpha:.055+crest*.025})
      .ellipse(0,r*.04,r*.29,r*.71).fill({color:0xe5e9ff,alpha:.08})
    core.clear().moveTo(-r*.085,0).lineTo(r*.085,0).moveTo(0,-r*.11).lineTo(0,r*.11)
      .stroke({color:0xedfff5,width:2.1,alpha:.42+crest*.32,cap:'round'})
    ribbons.clear()
    for(let i=0;i<2;i++) {
      const q=(Math.max(0,age)*.9+i*.5)%1,y=r*(.65-q*1.48),w=r*(.32+Math.sin(q*Math.PI)*.18)
      ribbons.moveTo(-w,y).bezierCurveTo(-w*.45,y+r*.14,w*.5,y+r*.14,w,y)
        .stroke({color:i?0xd3f9e6:0xdddfff,width:1.5,alpha:Math.sin(q*Math.PI)*.34,cap:'round'})
    }
    glints.forEach((g,i)=>{
      const q=(Math.max(0,age)*.98+i/14)%1,a=i*Math.PI*.76+q*.7
      g.position.set(Math.cos(a)*r*(.24+Math.sin(q*Math.PI)*.24),r*(.69-q*1.62))
      g.rotation=Math.sin(time*1.8+i)*.12;g.scale.set(r/65*(.55+Math.sin(q*Math.PI)*.4))
      g.alpha=Math.sin(q*Math.PI)**1.1*(.65+crest*.22)
    })
  }
  onFrame(update)
  tl.to(night,{alpha:1,duration:.5},.08).to(night,{alpha:0,duration:.48},5.09).call(()=>{update(1.15);onCue({type:'impact'})},[],1.15)
    .call(()=>{},[],timing.duration)

}
