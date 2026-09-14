import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function followMe(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n)), room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g,p,r) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/r)) }
  const root = make('follow-me-root'), tip = make('follow-me-tip'), impact = make('follow-me-impact'), finger = make('follow-me-finger')
  root.attachmentSocket = 'center'
  const rays = Array.from({length:12},(_,i)=>({g:make(`follow-me-ray-${i}`),angle:i*Math.PI/6,phase:random()*.32}))
  const sparks = Array.from({length:14},(_,i)=>({g:make(`follow-me-spark-${i}`),phase:random()*Math.PI*2,start:.72+i*.026,size:1.8+random()*1.7}))
  let noticed = false
  function update(time) {
    const c = socket('center',true), range = Math.min(94,room(c)*.79), fade = 1-clamp((time-1.51)/.34)
    root.clear();fit(root,c,99);root.alpha=time>.07&&time<1.85?clamp((time-.07)/.15)*fade:0
    for(const side of [-1,1]) root.moveTo(side*54,-8).quadraticCurveTo(side*75,-21,side*68,-44)
      .stroke({color:0xe7b77c,width:2,alpha:.6}).moveTo(side*57,-14).quadraticCurveTo(side*64,-22,side*60,-33)
      .stroke({color:0xffe9b4,width:1.1,alpha:.8})
    const lift = Math.min(38,room(c)*.35), beckon = Math.sin(time*9)*.13*(1-clamp((time-1.3)/.4))
    fit(finger,{x:c.x,y:c.y-lift},64);finger.clear();finger.rotation=beckon
    finger.alpha=root.alpha
    // One upright index finger curls toward the user; the other fingers form a soft mitten.
    const curl = 3+Math.sin(time*9)*3
    finger.moveTo(-17,31).lineTo(-19,13).quadraticCurveTo(-30,5,-25,-3).quadraticCurveTo(-22,-7,-15,0)
      .lineTo(-10,6).lineTo(-10,-30).quadraticCurveTo(-10,-43,-2,-43).quadraticCurveTo(6,-43,6,-32)
      .lineTo(6,-12+curl).quadraticCurveTo(15,-22+curl,21,-12).quadraticCurveTo(33,-12,32,0)
      .quadraticCurveTo(41,8,33,21).lineTo(22,34).closePath().fill({color:0xffe6b7,alpha:.92})
      .stroke({color:0xbe8e65,width:1.8,alpha:.8,join:'round'})
      .moveTo(6,-12+curl).lineTo(6,7).moveTo(18,-7).lineTo(16,10).moveTo(29,1).lineTo(26,15)
      .stroke({color:0xd0a276,width:1.5,alpha:.7,cap:'round'})
      .poly([-18,28,23,30,20,39,-17,38]).fill({color:0xe99c65,alpha:.92})
    tip.clear();fit(tip,c,22);tip.alpha=time>=.5&&time<1.16?1-clamp((time-.84)/.32):0
    tip.poly([0,-17,4,-4,18,0,4,4,0,17,-4,4,-18,0,-4,-4]).fill({color:0xffdf94,alpha:.83})
    const age=time-.72,u=clamp(age/.65)
    impact.clear();fit(impact,c,75);impact.alpha=noticed&&age>=0&&age<.65?1-u:0
    for(let i=0;i<6;i++){const a=i*Math.PI/3,r=19+u*43;impact.moveTo(Math.cos(a)*r,Math.sin(a)*r).lineTo(Math.cos(a)*(r+8),Math.sin(a)*(r+8)).stroke({color:0xffe2a4,width:2.5,alpha:.8})}
    rays.forEach(p=>{
      const v=(time*.82+p.phase)%1, radius=range*(1-v*.57), at={x:c.x+Math.cos(p.angle)*radius,y:c.y+Math.sin(p.angle)*radius*.82}
      const g=p.g;g.clear();fit(g,at,14);g.rotation=p.angle+Math.PI;g.alpha=root.alpha*Math.sin(v*Math.PI)*.73
      g.poly([-8,-3,5,-3,5,-7,12,0,5,7,5,3,-8,3]).fill(p.phase>.15?0xffd78e:0xe8b184)
    })
    sparks.forEach(p=>{
      const age=time-p.start,v=clamp(age/1.02),r=Math.min(75,room(c)*.64),at={x:c.x+Math.cos(p.phase+v*.5)*r*(.3+v*.55),y:c.y+Math.sin(p.phase)*r*.23-r*v*.45}
      const g=p.g;g.clear();fit(g,at,9);g.rotation=time*1.4+p.phase;g.alpha=noticed&&age>=0&&age<1.02?clamp(age/.12)*(1-clamp((v-.55)/.45))*.8:0
      g.poly([0,-p.size*2,p.size*.5,-p.size*.4,p.size*2,0,p.size*.5,p.size*.4,0,p.size*2,-p.size*.5,p.size*.4,-p.size*2,0,-p.size*.5,-p.size*.4]).fill(0xffdfaa)
    })
  }
  onFrame(update)
  tl.call(()=>{noticed=true;update(.72);onCue({type:'impact'})},[],.72).to({}, {duration:1.95},0)
}
