import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function megaDrain(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, unit } = bindEffectSpace(context)
  const radius=Math.min(8,Math.max(5,context.target.metrics.height/unit*.037)),beads=[]
  const tether=new Graphics();temporary.addChild(tether)
  for(let i=0;i<12;i++){
    const r=radius*(.85+random()*.25),g=new Graphics().poly([r,0,r*.5,r*.86,-r*.5,r*.86,-r,0,-r*.5,-r*.86,r*.5,-r*.86]).fill(0xc1e880)
      .circle(0,0,r*.52).fill(0xf0fbc1).circle(0,0,r*1.6).stroke({color:0x9ddc79,width:1,alpha:.32})
    g.label='mega-drain-bead-'+i;g.alpha=0;temporary.addChild(g);beads.push({g,start:.52+i*.06,bow:Math.sin(i*2.1)*30})
  }
  const gather=new Graphics().ellipse(0,0,32,39).stroke({color:0xc0e681,width:2.7}).ellipse(0,0,42,28).stroke({color:0x7bbd69,width:1.6,alpha:.65})
  gather.position.copyFrom(focus);gather.alpha=0;temporary.addChild(gather)
  const receive=new Container();receive.label='mega-drain-receive';receive.alpha=0;temporary.addChild(receive)
  receive.addChild(new Graphics().ellipse(0,0,35,24).stroke({color:0xc5ec91,width:3}).ellipse(0,0,24,34).stroke({color:0xebfbb9,width:1.7,alpha:.8}))
  const update=time=>{
    const from=targetSocket('center',true),to=socket('aura',true);receive.position.copyFrom(to);tether.clear()
    tether.alpha=time>=.52&&time<2.05?Math.min(1,(time-.52)/.12)*Math.max(0,1-Math.max(0,time-1.7)/.35):0
    if(tether.alpha)for(let strand=0;strand<2;strand++){
      for(let j=0;j<=32;j++){
        const u=j/32,x=from.x+(to.x-from.x)*u,y=from.y+(to.y-from.y)*u+Math.sin(Math.PI*u)*Math.sin(u*8-time*13+strand*Math.PI)*12
        if(j===0)tether.moveTo(x,y);else tether.lineTo(x,y)
      }
      tether.stroke({color:strand?0xd5f29f:0x82c675,width:1.6,alpha:.42,cap:'round'})
    }
    for(const p of beads){const age=time-p.start;if(age<0||age>.8){p.g.alpha=0;continue}const u=Math.min(1,age/.68);p.g.position.set(from.x+(to.x-from.x)*u,from.y+(to.y-from.y)*u+Math.sin(Math.PI*u)*p.bow);p.g.rotation=age*5;p.g.scale.set(.85+.18*Math.sin(age*18));p.g.alpha=Math.min(1,age/.07)*Math.max(0,1-Math.max(0,age-.68)/.12)}
  }
  onFrame(update)
  tl.to(attacker,{y:home.y-3,duration:.25},0).to(attacker,{y:home.y,duration:.4},1.55)
    .to(gather,{alpha:.8,duration:.18},.22).to(gather.scale,{x:.6,y:.6,duration:.3},.4).to(gather,{alpha:0,duration:.45},.75)
    .call(()=>{update(.52);onCue({type:'impact'});defender.tint=0xd4eab0},[],.52)
    .to(defender,{x:defenderHome.x+4,duration:.07,repeat:3,yoyo:true},.52).call(()=>{defender.tint=0xffffff},[],.82)
    .to(receive,{alpha:.9,duration:.12},1.2).to(receive.scale,{x:1.25,y:1.25,duration:.13,repeat:3,yoyo:true},1.2).to(receive,{alpha:0,duration:.35},1.75)
    .call(()=>{update(1.2);onCue({type:'recovery'})},[],1.2)
}
