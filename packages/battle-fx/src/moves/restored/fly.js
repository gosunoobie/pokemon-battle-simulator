import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function fly(context) {
  const { tl, random, onFrame, onCue } = context
  const space = bindEffectSpace(context)
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, solveContact, captureActor, unit } = space
  const visual = context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'
  const center = socket(visual), ground = socket('ground')
  const width = context.source.metrics.width / unit, height = context.source.metrics.height / unit
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit

  const desired=solveContact('tackle',0,targetSocket('center'))
  const landing={x:Math.max(left+width/2-center.x,Math.min(right-width/2-center.x,desired.x)),y:Math.max(top+height/2-center.y,Math.min(bottom-height/2-center.y,desired.y))}
  const motion={x:Math.max(left+width/2-center.x,landing.x-Math.min(130,Math.abs(landing.x)*.32)),y:top-center.y-height*.65}
  const radius=Math.min(52,Math.max(30,context.target.metrics.width/unit*.2))
  const trails=new Graphics();trails.label='fly-swoop-trails';trails.alpha=0;temporary.addChild(trails)
  const gust=new Graphics();gust.label='fly-impact';gust.alpha=0;temporary.addChild(gust)
  const feathers=[]
  for(let i=0;i<18;i++){const g=new Graphics().moveTo(-5,0).quadraticCurveTo(0,-2,8,0).stroke({color:i%2?0xd8edf1:0xa9d0dd,width:1.8});g.alpha=0;temporary.addChild(g);feathers.push({g,a:random()*Math.PI*2,v:60+random()*115,life:.3+random()*.28})}
  let impact
  function update(t){
    attacker.position.copyFrom(motion);attacker.alpha=t<.08?0:Math.min(1,(t-.08)*12)
    const p=socket('trail',true),a=Math.atan2(landing.y-(top-center.y-height*.65),landing.x-(landing.x-Math.min(130,Math.abs(landing.x)*.32)))
    trails.clear();trails.alpha=t>.12&&t<.79?Math.min(1,(t-.12)*6)*Math.min(1,(.79-t)*8)*.68:0
    for(let i=0;i<3;i++){const d=(i-1)*radius*.34,len=38+i*17,x=p.x-Math.sin(a)*d,y=p.y+Math.cos(a)*d;trails.moveTo(x,y).quadraticCurveTo(x-Math.cos(a)*len*.6-d*.1,y-Math.sin(a)*len*.6,x-Math.cos(a)*len,y-Math.sin(a)*len).stroke({color:0xd6e9ef,width:2.4-i*.45,cap:'round'})}
    const b=impact??socket('tackle',true);gust.position.copyFrom(b);gust.clear()
    const u=Math.max(0,Math.min(1,(t-.68)/.32))
    for(const sign of [-1,1])gust.moveTo(-radius*.6,sign*radius*.48).quadraticCurveTo(radius*.05,-sign*radius*.2,radius*(.9+u*.55),-sign*radius*(.4+u*.5)).stroke({color:0xe4f1f2,width:3-u*1.5,cap:'round'})
    for(const p of feathers){const age=t-.68,u=age/p.life;p.g.alpha=impact&&u>=0&&u<1?Math.sin(u*Math.PI)*.8:0;if(impact){p.g.position.set(impact.x+Math.cos(p.a)*p.v*Math.max(0,age),impact.y+Math.sin(p.a)*p.v*Math.max(0,age));p.g.rotation=p.a}}
  }
  update(0);onFrame(update)
  const targetCenter=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center'),recoil=Math.max(0,Math.min(8,right-targetCenter.x-context.target.metrics.width/(2*unit)))
  const rebound=Math.min(35,Math.max(0,center.y+landing.y-height/2-top))
  tl.to(motion,{x:landing.x,y:landing.y,duration:.58,ease:'power2.in'},.1)
    .call(()=>{update(.68);impact=socket('tackle',true);gust.position.copyFrom(impact);onCue({type:'impact'});defender.tint=0xd8eaf0},[],.68)
    .to(gust,{alpha:1,duration:.025},.68).to(gust,{alpha:0,duration:.3},.73)
    .to(defender,{x:defenderHome.x+recoil,duration:.055,repeat:3,yoyo:true},.68).call(()=>{defender.tint=0xffffff},[],.96)
    .to(motion,{x:landing.x*.75,y:landing.y-rebound,duration:.22,ease:'power1.out'},.8)
    .to(motion,{x:home.x,y:home.y,duration:.58,ease:'power2.inOut'},1.04)

}
