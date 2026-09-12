import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function divePrepare(context) {
  const { tl, random, onFrame, onCue } = context
  const space = bindEffectSpace(context)
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, solveContact, captureActor, unit } = space
  const visual = context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'
  const center = socket(visual), ground = socket('ground')
  const width = context.source.metrics.width / unit, height = context.source.metrics.height / unit
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit

  const radius=Math.min(88,Math.max(42,width*.49)),motion={sink:0},depth=height+22
  const pool=new Graphics().ellipse(0,0,radius,radius*.24).fill({color:0x276b91,alpha:.8}).ellipse(0,0,radius*.72,radius*.15).fill(0x184f70)
  pool.label='dive-pool';pool.position.copyFrom(ground);pool.alpha=0;temporary.addChild(pool)
  const copy=captureActor(),hasCopy=copy.children.length>0;copy.label='dive-preparation-copy';temporary.addChild(copy)
  const clip=new Graphics().rect(left-50,top-50,right-left+100,Math.max(1,ground.y-top+50)).fill(0xffffff)
  clip.label='dive-preparation-clip';temporary.addChild(clip);copy.mask=clip
  const surface=new Graphics();surface.alpha=0;temporary.addChild(surface)
  const beads=[]
  for(let i=0;i<23;i++){const s=2+random()*3,g=i<9?new Graphics().circle(0,0,s).stroke({color:0xbae5ec,width:1.2}):new Graphics().ellipse(0,0,s*.7,s*1.2).fill(0xa4dbeb);g.alpha=0;temporary.addChild(g);beads.push({g,bubble:i<9,delay:.21+random()*.56,life:.33+random()*.29,x:(random()-.5)*radius*1.55,v:(random()-.5)*70,up:40+random()*70})}
  if(hasCopy)attacker.alpha=0
  function update(t){
    const y=depth*motion.sink
    if(hasCopy){copy.y=y;copy.alpha=t<1.2?1:0;attacker.alpha=0}else{attacker.y=y;attacker.alpha=Math.max(0,1-motion.sink*1.5)}
    clip.alpha=t<1.2?1:0;surface.clear();surface.alpha=t>.1&&t<1.49?Math.min(1,(t-.1)*6)*Math.min(1,(1.49-t)*3.5):0
    for(let j=0;j<3;j++){const q=((t*.75+j/3)%1+1)%1,r=radius*(.35+q*.9);surface.ellipse(ground.x,ground.y,r,r*.24).stroke({color:j===0?0xd2eff1:0x76bfd8,width:1.8,alpha:(1-q)*.8})}
    for(const p of beads){const age=t-p.delay,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.85:0;p.g.position.set(ground.x+p.x+p.v*Math.max(0,age),ground.y-p.up*Math.max(0,age)+(p.bubble?0:120)*Math.max(0,age)**2);p.g.scale.set(Math.max(.1,1-u*.25))}
  }
  onFrame(update)
  tl.to(pool,{alpha:.95,duration:.21},.04).to(motion,{sink:1,duration:.73,ease:'power1.in'},.3)
    .call(()=>{update(1.06);onCue({type:'prepared'})},[],1.06)
    .to(pool.scale,{x:.75,y:.7,duration:.4},1.04).to(pool,{alpha:0,duration:.42},1.05)

}
