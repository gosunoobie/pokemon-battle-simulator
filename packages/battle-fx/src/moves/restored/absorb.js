import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function absorb(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, unit } = bindEffectSpace(context)
  const size=Math.min(5,Math.max(3,context.target.metrics.height/unit*.023)),motes=[]
  for(let i=0;i<8;i++){
    const g=new Graphics().circle(0,0,size*1.8).fill({color:0x98d995,alpha:.12}).circle(0,0,size).fill(0xbce5a3).circle(0,0,size*.4).fill(0xf0ffd8)
    g.label='absorb-mote-'+i;g.alpha=0;temporary.addChild(g);motes.push({g,start:.4+i*.045,bow:i===0?-14:(random()-.5)*38})
  }
  const targetRing=new Graphics().ellipse(0,0,20,26).stroke({color:0xb4d995,width:1.8})
  targetRing.position.copyFrom(focus);targetRing.alpha=0;temporary.addChild(targetRing)
  const receive=new Container();receive.label='absorb-receive';receive.alpha=0;temporary.addChild(receive)
  receive.addChild(new Graphics().ellipse(0,0,24,18).stroke({color:0xc7edaa,width:2}).circle(0,0,15).fill({color:0xb0e596,alpha:.12}))
  const update=time=>{
    const from=targetSocket('center',true),to=socket('aura',true);receive.position.copyFrom(to)
    for(const p of motes){
      const age=time-p.start;if(age<0||age>.68){p.g.alpha=0;continue}
      const u=Math.min(1,age/.58);p.g.position.set(from.x+(to.x-from.x)*u,from.y+(to.y-from.y)*u+Math.sin(Math.PI*u)*p.bow)
      p.g.alpha=Math.min(1,age/.06)*Math.max(0,1-Math.max(0,age-.58)/.1);p.g.scale.set(.8+.25*Math.sin(Math.PI*u))
    }
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-3,y:home.y-2,duration:.2},0).to(attacker,{x:home.x,y:home.y,duration:.2},.4)
    .to(targetRing,{alpha:.8,duration:.12},.28).to(targetRing.scale,{x:.55,y:.55,duration:.3},.4).to(targetRing,{alpha:0,duration:.28},.52)
    .call(()=>{update(.4);onCue({type:'impact'});defender.tint=0xcbe4b7},[],.4)
    .to(defender,{x:defenderHome.x+3,duration:.07,repeat:3,yoyo:true},.4).call(()=>{defender.tint=0xffffff},[],.68)
    .to(receive,{alpha:.8,duration:.1},.98).to(receive.scale,{x:1.35,y:1.35,duration:.34},.98).to(receive,{alpha:0,duration:.35},1.21)
    .call(()=>{update(.98);onCue({type:'recovery'})},[],.98)
}
