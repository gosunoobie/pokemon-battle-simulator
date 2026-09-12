import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function amnesia(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const rx=Math.min(105,Math.max(42,context.source.metrics.width/unit*.49))
  const ry=Math.min(108,Math.max(48,context.source.metrics.height/unit*.47))
  const aura=new Container();aura.label='amnesia-aura';temporary.addChild(aura)
  const cloud=new Container();cloud.alpha=0;aura.addChild(cloud)
  const outline=new Graphics().moveTo(-23,8).bezierCurveTo(-39,5,-36,-15,-20,-15)
    .bezierCurveTo(-16,-35,10,-32,15,-19).bezierCurveTo(37,-22,45,1,29,10)
    .bezierCurveTo(18,22,3,17,-1,16).bezierCurveTo(-14,23,-26,20,-23,8)
    .fill({color:0xe6d4ef,alpha:.19}).stroke({color:0xe9d5f4,width:1.8,alpha:.8})
  cloud.addChild(outline)
  const question=new Graphics().moveTo(-7,-10).bezierCurveTo(-7,-24,18,-20,8,-8)
    .quadraticCurveTo(0,-3,2,2).stroke({color:0xf9eaff,width:2.8,cap:'round'}).circle(2,9,1.8).fill(0xf9eaff)
  question.scale.x=context.source.facing<0?-1:1;cloud.addChild(question)
  const links=new Graphics().circle(-23,32,5).fill({color:0xe5cfef,alpha:.17}).stroke({color:0xdcc5ef,width:1.2})
    .circle(-35,45,2.7).fill({color:0xe5cfef,alpha:.2});cloud.addChild(links)
  const bubbles=[]
  for(let i=0;i<11;i++){
    const radius=3+i%4*1.5,g=new Graphics().circle(0,0,radius).stroke({color:i%2?0xe9d4ef:0xc6dafa,width:1.2,alpha:.8})
    g.alpha=0;aura.addChild(g);bubbles.push(g)
  }
  const update=time=>{
    aura.position.copyFrom(socket('center',true));cloud.position.set(rx*.32,-ry*.43)
    bubbles.forEach((g,i)=>{
      const age=time-.84-i*.065,u=Math.max(0,Math.min(1,age/.92)),a=i*2.4
      g.position.set(rx*.32+Math.cos(a)*(10+u*rx*.6),-ry*.43+Math.sin(a)*18-u*ry*.48)
      g.scale.set(.5+u*.65);g.alpha=age>=0&&age<=.92?Math.sin(Math.PI*u)*.8:0
    })
  }
  onFrame(update)
  tl.to(cloud,{alpha:1,duration:.3},.12).to(question,{alpha:0,duration:.18},.62)
    .to(cloud.scale,{x:1.06,y:1.06,duration:.26,ease:'sine.out'},.62)
    .to(cloud,{alpha:0,duration:.48},.9)
    .call(()=>{update(.84);onCue({type:'impact'})},[],.84)
}
