import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function sharpen(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const shell = new Container(); shell.label = 'sharpen-facets'; temporary.addChild(shell)
  const planes = new Graphics(); shell.addChild(planes)
  const tip = make('sharpen-tip'), impact = make('sharpen-impact')
  const rx = Math.max(36, context.source.metrics.width / unit * .57), ry = Math.max(42, context.source.metrics.height / unit * .56)
  const glints = Array.from({ length: 20 }, (_, i) => ({
    g: make(`sharpen-glint-${i}`), start: .58+i*.021, phase: random()*Math.PI*2,
    radius: .48+random()*.43, rise: 19+random()*22, size: 3+random()*4, life: .48+random()*.2,
  }))
  let polished = false
  function update(time) {
    const center = socket('center', true), body = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center', true)
    const fit = Math.max(0, Math.min(1, (body.x-left-4)/(rx+8), (right-body.x-4)/(rx+8), (body.y-top-4)/(ry+8), (bottom-body.y-4)/(ry+8)))
    shell.position.copyFrom(body); shell.scale.set(fit)
    const tighten = clamp((time-.08)/.62), fade = clamp((time-1.18)/.42)
    shell.alpha = time>=.08 && time<1.6 ? Math.min(1,(time-.08)/.14)*(1-fade) : 0
    planes.clear()
    const vertices = [[-.58,-1],[.58,-1],[1,-.5],[1,.5],[.58,1],[-.58,1],[-1,.5],[-1,-.5]]
    for(let i=0;i<vertices.length;i++) {
      const a=vertices[i], b=vertices[(i+1)%8], inset=.77+tighten*.11
      const ax=a[0]*rx,ay=a[1]*ry,bx=b[0]*rx,by=b[1]*ry
      // Separate angular faces polish inward toward the actor without filling its silhouette.
      planes.poly([ax,ay,bx,by,bx*inset,by*inset,ax*inset,ay*inset])
        .fill({color:i%2?0xb9cbd2:0x87a9b3,alpha:.07+tighten*.06})
        .moveTo(ax,ay).lineTo(bx,by).lineTo(bx*inset,by*inset)
        .stroke({color:i%2?0xd7e5e7:0x91b1bd,width:1.3,alpha:.65})
      const sweep=clamp((time-.13-i*.035)/.42), length=.2
      const start=Math.max(0,sweep-length), end=Math.min(1,sweep+.02)
      planes.moveTo(ax+(bx-ax)*start,ay+(by-ay)*start).lineTo(ax+(bx-ax)*end,ay+(by-ay)*end)
        .stroke({color:0xf8ffed,width:2.8,alpha:Math.sin(sweep*Math.PI)*.96})
    }
    tip.clear(); tip.position.copyFrom(center); tip.scale.set(Math.min(1,room(center)/23))
    tip.alpha=time>=.46&&time<1.05?Math.min(1,(time-.46)/.12,(1.05-time)/.25):0
    tip.poly([0,-15,2.4,-2.4,19,0,2.4,2.4,0,15,-2.4,2.4,-19,0,-2.4,-2.4]).fill({color:0xf6ffdf,alpha:.81})
    impact.clear();impact.position.copyFrom(center);impact.scale.set(Math.min(1,room(center)/41))
    const age=time-.7,u=clamp(age/.5)
    impact.alpha=polished&&age>=0&&age<.5?1-u:0
    impact.poly([0,-25,3,-3,34,0,3,3,0,25,-3,3,-34,0,-3,-3]).fill({color:0xf7ffe9,alpha:.88})
    for(const glint of glints) {
      const age=time-glint.start,u=clamp(age/glint.life)
      const start={x:body.x+Math.cos(glint.phase)*rx*glint.radius*fit,y:body.y+Math.sin(glint.phase)*ry*glint.radius*fit}
      const p={x:start.x+Math.sin(glint.phase+u*2)*Math.min(7,room(start)*.14)*u,y:start.y-Math.min(glint.rise,room(start)*.67)*u}
      const g=glint.g,r=glint.size;g.clear();g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/(r*1.8)))
      g.alpha=age>=0&&age<glint.life?Math.sin(u*Math.PI)*.9:0
      g.poly([0,-r,1,-1,r*.7,0,1,1,0,r,-1,1,-r*.7,0,-1,-1]).fill(glint.phase<Math.PI?0xf4ffe9:0xd0e6df)
    }
  }
  onFrame(update)
  tl.call(()=>{polished=true;update(.7);onCue({type:'impact'})},[],.7).call(()=>{},[],1.8)
}
