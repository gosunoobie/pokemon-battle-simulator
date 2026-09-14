import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function curse(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }
  const fit = (g,p,r) => {g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root = new Container();root.label='curse-root';root.attachmentSocket='emission';temporary.addChild(root)
  const charm = new Graphics();charm.label='curse-ritual-nail';root.addChild(charm)
  const sourceSeal = new Graphics();sourceSeal.label='curse-source-seal';root.addChild(sourceSeal)
  const trail = make('curse-travel-thread'), tip = make('curse-tip')
  const impact = new Container();impact.label='curse-impact';impact.alpha=0;temporary.addChild(impact)
  const sigil = new Graphics();sigil.label='curse-thorn-sigil';impact.addChild(sigil)
  const rx = Math.max(33,context.target.metrics.width/unit*.56), ry = Math.max(39,context.target.metrics.height/unit*.52)
  const fragments = Array.from({length:30},(_,i)=>({
    g:make(`curse-fragment-${i}`),start:1.56+i%5*.04,angle:i*Math.PI/15+random()*.1,
    drift:(random()-.5)*34,fall:20+random()*27,size:3+random()*5,life:.52+random()*.14,
  }))
  let struck=false
  function update(time) {
    const a=socket('emission',true),body=socket(context.source.hasAnchor?.('body')?'body':'center',true)
    const b=targetSocket('center',true),v=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',true)
    const dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy,dx),nx=-Math.sin(angle),ny=Math.cos(angle)
    root.position.copyFrom(a)
    root.alpha=time>=.07&&time<.92?Math.min(1,(time-.07)/.14,(.92-time)/.3):0
    charm.clear();charm.position.set(body.x-a.x,body.y-a.y);charm.scale.set(Math.min(1,room(body)/58));charm.rotation=-.21+Math.sin(time*3)*.04
    const gather=clamp((time-.07)/.43)
    // A floating ceremonial nail and its shadow charm establish the ritual without piercing the actor.
    charm.poly([0,-37,13,-29,11,-19,4,-16,4,21,0,35,-4,21,-4,-16,-11,-19,-13,-29]).fill({color:0x322a3d,alpha:.9})
      .poly([0,-34,9,-28,7,-22,0,-18,-7,-22,-9,-28]).fill(0x8d647f)
      .poly([0,-18,4,-16,4,21,0,35]).fill(0x9b708b)
      .moveTo(-8,-28).lineTo(0,-32).lineTo(8,-27).moveTo(1,-14).lineTo(1,23)
      .stroke({color:0xd9a5bc,width:1.2,alpha:.88})
    for(let j=0;j<4;j++) {
      const theta=j*Math.PI/2+time*.7,r=39-gather*6
      charm.poly([Math.cos(theta)*r,Math.sin(theta)*r,Math.cos(theta+.1)*(r-7),Math.sin(theta+.1)*(r-7),Math.cos(theta+.21)*r,Math.sin(theta+.21)*r])
        .fill({color:j%2?0xb56588:0x8f6caf,alpha:.66})
    }
    sourceSeal.clear();sourceSeal.scale.set(Math.min(1,room(a)/37));sourceSeal.rotation=-time
    for(let j=0;j<4;j++) {
      const theta=j*Math.PI/2,r=11+gather*13
      sourceSeal.moveTo(Math.cos(theta)*r,Math.sin(theta)*r).lineTo(Math.cos(theta+.46)*r*.52,Math.sin(theta+.46)*r*.52)
        .lineTo(Math.cos(theta+.77)*r,Math.sin(theta+.77)*r).stroke({color:j%2?0xae668f:0x856bb0,width:1.5,alpha:.74})
    }
    const front=clamp((time-.5)/.54),head={x:a.x+dx*front,y:a.y+dy*front}
    tip.clear();fit(tip,head,34);tip.rotation=time*1.25
    tip.alpha=time>=.5&&time<1.33?Math.min(1,.91+(time-.5)*2,(1.33-time)/.23):0
    tip.circle(0,0,22).fill({color:0x3f233e,alpha:.12})
    for(let j=0;j<2;j++) {
      const points=[]
      for(let k=0;k<3;k++){const theta=k*Math.PI*2/3+j*Math.PI;points.push(Math.cos(theta)*21,Math.sin(theta)*21)}
      tip.poly(points).stroke({color:j?0xbd719d:0x9d84c6,width:1.8,alpha:.9})
    }
    tip.poly([0,-9,4,0,0,9,-4,0]).fill(0xe1aecb)
    trail.clear();trail.alpha=time>=.5&&time<1.29?Math.min(1,(1.29-time)/.24)*.62:0
    if(front>0)for(let side of[-1,1]) {
      for(let j=0;j<=35;j++) {
        const u=front*j/35,p={x:a.x+dx*u,y:a.y+dy*u},wave=Math.sin(u*17-time*8)*Math.min(8,room(p)*.32)*Math.sin(j/35*Math.PI)*side
        if(j===0)trail.moveTo(p.x+nx*wave,p.y+ny*wave);else trail.lineTo(p.x+nx*wave,p.y+ny*wave)
      }
      trail.stroke({color:side>0?0x865e9e:0xa65880,width:1.15,alpha:.72})
    }
    const age=time-1.04,grow=.27+clamp(age/.3)*.73,fade=clamp((time-1.78)/.46)
    const sigilFit=Math.max(0,Math.min(1,(v.x-left-4)/(rx+8),(right-v.x-4)/(rx+8),(v.y-top-4)/(ry+8),(bottom-v.y-4)/(ry+8)))
    impact.position.copyFrom(b);impact.alpha=struck&&age>=0&&time<2.24?1-fade:0
    sigil.clear();sigil.position.set(v.x-b.x,v.y-b.y);sigil.scale.set(sigilFit*grow)
    // Two interlocking thorn seals surround the body, leaving open space through its silhouette.
    for(let j=0;j<2;j++) {
      const points=[]
      for(let k=0;k<3;k++){const theta=k*Math.PI*2/3+j*Math.PI-Math.PI/2;points.push(Math.cos(theta)*rx*.91,Math.sin(theta)*ry*.91)}
      sigil.poly(points).stroke({color:0x312039,width:5,alpha:.49})
        .poly(points).stroke({color:j?0xb7638b:0x9273ba,width:2,alpha:.93})
    }
    for(let j=0;j<8;j++) {
      const theta=j*Math.PI/4+Math.sin(age*2)*.045,x=Math.cos(theta)*rx*.93,y=Math.sin(theta)*ry*.93
      const ix=Math.cos(theta)*rx*.69,iy=Math.sin(theta)*ry*.69
      sigil.moveTo(ix,iy).lineTo(x,y).lineTo(x-Math.sin(theta)*7,y+Math.cos(theta)*7)
        .stroke({color:j%2?0xc680a2:0xaa90c7,width:1.5,alpha:.84})
      sigil.poly([x,y,x-Math.cos(theta)*9-Math.sin(theta)*4,y-Math.sin(theta)*9+Math.cos(theta)*4,
        x-Math.cos(theta)*5+Math.sin(theta)*3,y-Math.sin(theta)*5-Math.cos(theta)*3]).fill(j%2?0xb56688:0x9d7bc0)
    }
    for(const fragment of fragments) {
      const age=time-fragment.start,u=clamp(age/fragment.life)
      const base={x:v.x+Math.cos(fragment.angle)*rx*.77*sigilFit,y:v.y+Math.sin(fragment.angle)*ry*.77*sigilFit},clearance=room(base)
      const p={x:base.x+fragment.drift*u*Math.min(1,clearance/42),y:base.y+Math.min(fragment.fall,clearance*.61)*(u*.25+u*u*.75)}
      const g=fragment.g,r=fragment.size;g.clear();fit(g,p,r*1.8);g.rotation=fragment.angle+u*1.6
      g.alpha=struck&&age>=0&&age<fragment.life?Math.min(1,age/.07,(fragment.life-age)/.21)*.84:0
      g.poly([-r*.6,-r,r*.57,-r*.42,r*.2,r,-r*.38,r*.36]).fill({color:fragment.angle<Math.PI?0xb4769f:0x8e72ae,alpha:.72})
        .moveTo(-r*.25,-r*.66).lineTo(r*.18,0).lineTo(-r*.08,r*.57).stroke({color:0xd7abc9,width:.9,alpha:.68})
    }
  }
  onFrame(update)
  tl.call(()=>update(.5),[],.5)
    .call(()=>{struck=true;update(1.04);onCue({type:'impact'})},[],1.04)
    .call(()=>{},[],2.45)
}
