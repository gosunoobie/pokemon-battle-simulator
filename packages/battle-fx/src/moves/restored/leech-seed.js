import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function leechSeed(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, r) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p)/r)) }
  const seeds = Array.from({ length: 3 }, (_, i) => ({ g: make(i === 0 ? 'leech-seed-tip' : `leech-seed-seed-${i}`), start: .36+i*.04, size: 8+i*1.4, lane: i-1 }))
  const impact = make('leech-seed-impact'), sprouts = make('leech-seed-sprouts')
  const motes = Array.from({ length: 18 }, (_, i) => ({ g: make(`leech-seed-mote-${i}`), start: 1.02+i*.02, phase: random()*Math.PI*2, reach: 15+random()*21, life: .64+random()*.2 }))
  let struck = false
  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true), floor = targetSocket('floor')
    for (const seed of seeds) {
      const age = time-seed.start, u = clamp(age/.58), p = { x:a.x+(b.x-a.x)*u, y:a.y+(b.y-a.y)*u }
      p.y -= Math.sin(u*Math.PI)*Math.min(72, room(p)*.62)
      p.x += Math.sin(u*Math.PI)*seed.lane*Math.min(9, room(p)*.15)
      const g = seed.g, r = seed.size; g.clear(); fit(g,p,r*2.5)
      g.rotation = Math.atan2(b.y-a.y-Math.cos(u*Math.PI)*85,b.x-a.x)
      g.alpha = age>=0 && age<.75 ? Math.min(1,.86+age*4,(.75-age)/.17) : 0
      g.moveTo(0,0).quadraticCurveTo(-r*.55,-r*.65,-r*1.65,-r*.35).quadraticCurveTo(-r*2.05,r*.55,-r*.88,r*.63)
        .quadraticCurveTo(-r*.34,r*.44,0,0).fill(0xbba35b)
        .moveTo(-r*1.56,-r*.25).quadraticCurveTo(-r*.74,-r*.11,0,0).stroke({color:0xf0d889,width:1.5,alpha:.9})
        .moveTo(-r*1.62,-r*.31).quadraticCurveTo(-r*1.63,-r*1.05,-r*.87,-r*.85)
        .quadraticCurveTo(-r*.94,-r*.35,-r*1.62,-r*.31).fill(0x8dbb55)
    }
    const age = time-.94, grow = clamp(age/.43), fade = clamp((time-1.86)/.35)
    impact.clear(); fit(impact,b,37); impact.alpha = struck && age>=0 && age<.45 ? 1-age/.45 : 0
    for(let j=0;j<5;j++) {
      const theta=j*Math.PI*.4, r=8+grow*18
      impact.moveTo(0,0).quadraticCurveTo(Math.cos(theta-.3)*r*.7,Math.sin(theta-.3)*r*.7,Math.cos(theta)*r,Math.sin(theta)*r)
        .stroke({color:0xc5ed91,width:2,alpha:.8})
    }
    const span=Math.min(67,Math.max(36,context.target.metrics.width/unit*.35)), height=Math.min(65,context.target.metrics.height/unit*.42)
    const size=Math.max(0,Math.min(1,(floor.x-left-4)/(span+14),(right-floor.x-4)/(span+14),(floor.y-top-4)/(height+14),(bottom-floor.y-4)/15))
    sprouts.clear(); sprouts.position.copyFrom(floor); sprouts.scale.set(size)
    sprouts.alpha = struck && age>=0 && time<2.21 ? (1-fade)*.9 : 0
    for(let j=0;j<5;j++) {
      const lane=j-2, x=lane*span*.36, h=height*(.63+(j%2)*.27)*grow, sway=Math.sin(time*3.4+j)*4*grow
      sprouts.moveTo(x*.65,5).quadraticCurveTo(x+lane*9,-h*.32,x+sway,-h)
        .stroke({color:0x527d37,width:3,alpha:.9})
        .moveTo(x+sway,-h).quadraticCurveTo(x+sway+10,-h-8,x+sway+15,-h+1)
        .quadraticCurveTo(x+sway+7,-h+5,x+sway,-h).fill(0xa7cf66)
        .moveTo(x+sway,-h*.72).quadraticCurveTo(x+sway-13,-h*.72-8,x+sway-16,-h*.72+2)
        .quadraticCurveTo(x+sway-5,-h*.72+6,x+sway,-h*.72).fill(0x81b24e)
      for(let k=0;k<=22;k++) {
        const u=k/22, theta=u*Math.PI*2.1+j, r=(7-u*4)*grow
        const qx=x+sway+Math.cos(theta)*r, qy=-h+Math.sin(theta)*r
        if(k===0)sprouts.moveTo(qx,qy);else sprouts.lineTo(qx,qy)
      }
      sprouts.stroke({color:0xc4e993,width:1,alpha:.75})
    }
    for(const mote of motes) {
      const age=time-mote.start,u=clamp(age/mote.life),reach=Math.min(mote.reach,room(floor)*.48)
      const p={x:floor.x+Math.cos(mote.phase+u)*reach,y:floor.y-Math.min(50,room(floor)*.7)*u}
      const g=mote.g;g.clear();fit(g,p,5);g.rotation=mote.phase+u
      g.alpha=struck&&age>=0&&age<mote.life?Math.sin(u*Math.PI)*.65:0
      g.poly([0,-3,1,-1,3,0,1,1,0,3,-1,1,-3,0,-1,-1]).fill(0xd5ed9d)
    }
  }
  onFrame(update)
  tl.call(()=>update(.36),[],.36)
    .call(()=>{struck=true;update(.94);onCue({type:'impact'})},[],.94)
    .call(()=>{},[],2.3)
}
