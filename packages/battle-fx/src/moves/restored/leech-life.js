import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function leechLife(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const size=Math.min(1.15,Math.max(.7,context.target.metrics.height/unit/170)),point={x:focus.x,y:focus.y+6}
  const pose=solveContact('emission',.04,point),jaws=new Container();jaws.label='leech-life-jaws';jaws.alpha=0;jaws.scale.set(size);temporary.addChild(jaws)
  const upper=new Graphics().moveTo(-23,-10).quadraticCurveTo(-9,-24,20,-12).lineTo(10,0).lineTo(7,-10).lineTo(-5,-8).lineTo(-10,1).lineTo(-14,-8).closePath().fill(0xf1d6b4).stroke({color:0xb8808e,width:1.3})
  const lower=new Graphics().moveTo(-23,10).quadraticCurveTo(-9,24,20,12).lineTo(10,0).lineTo(7,10).lineTo(-5,8).lineTo(-10,-1).lineTo(-14,8).closePath().fill(0xdcb39d)
  jaws.addChild(upper,lower)
  const thread=new Graphics();temporary.addChild(thread)
  const motes=[]
  for(let i=0;i<8;i++){
    const r=4+random()*2,g=new Graphics().circle(0,0,r*1.6).fill({color:0xd998bb,alpha:.14}).circle(0,0,r).fill(i%2?0xf0b7bd:0xd7da9c).circle(0,0,r*.4).fill(0xffedca)
    g.label='leech-life-mote-'+i;g.alpha=0;temporary.addChild(g);motes.push({g,start:.7+i*.055,bow:(i%2?1:-1)*(12+i*2)})
  }
  const receive=new Container();receive.label='leech-life-receive';receive.alpha=0;temporary.addChild(receive)
  receive.addChild(new Graphics().ellipse(0,0,29,22).stroke({color:0xe7dca0,width:2.6}).ellipse(0,0,19,28).stroke({color:0xf6c4c8,width:1.3,alpha:.8}))
  const update=time=>{
    jaws.position.copyFrom(socket('emission',true));jaws.rotation=attacker.rotation
    const from=targetSocket('center',true),to=socket('aura',true);receive.position.copyFrom(to);thread.clear()
    thread.alpha=time>=.7&&time<1.94?Math.min(1,(time-.7)/.1)*Math.max(0,1-Math.max(0,time-1.62)/.32):0
    if(thread.alpha)thread.moveTo(from.x,from.y).quadraticCurveTo((from.x+to.x)/2,(from.y+to.y)/2-21,to.x,to.y).stroke({color:0xeab4c2,width:1.4,alpha:.48})
    for(const p of motes){const age=time-p.start;if(age<0||age>.78){p.g.alpha=0;continue}const u=Math.min(1,age/.66);p.g.position.set(from.x+(to.x-from.x)*u,from.y+(to.y-from.y)*u+Math.sin(Math.PI*u)*p.bow);p.g.alpha=Math.min(1,age/.06)*Math.max(0,1-Math.max(0,age-.66)/.12)}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-7,rotation:-.035,duration:.2},0).to(attacker,{...pose,duration:.32,ease:'power3.in'},.2)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.37,ease:'power2.inOut'},.66)
    .to(jaws,{alpha:1,duration:.1},.23).to(upper,{y:-8,duration:.1},.23).to(lower,{y:8,duration:.1},.23)
    .to(upper,{y:0,duration:.11,ease:'power3.in'},.41).to(lower,{y:0,duration:.11,ease:'power3.in'},.41).to(jaws,{alpha:0,duration:.21},.68)
    .call(()=>{update(.52);onCue({type:'impact'});defender.tint=0xeac3c9},[],.52)
    .to(defender,{x:defenderHome.x+6,duration:.065,repeat:3,yoyo:true},.52).call(()=>{defender.tint=0xffffff},[],.8)
    .to(receive,{alpha:.85,duration:.12},1.36).to(receive.scale,{x:1.3,y:1.3,duration:.4},1.36).to(receive,{alpha:0,duration:.32},1.72)
    .call(()=>{update(1.36);onCue({type:'recovery'})},[],1.36)
}
