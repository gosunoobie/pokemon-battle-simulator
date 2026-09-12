import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function glare(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('eyes')?'eyes':'emission'
  const r=Math.min(35,Math.max(20,context.source.metrics.width/unit*.15))
  const reach=Math.min(78,Math.max(38,context.target.metrics.width/unit*.4))
  const eyes=new Container();eyes.label='glare-eyes';eyes.alpha=0;temporary.addChild(eyes)
  for(const side of [-1,1]){
    const g=new Graphics().moveTo(-r*.4,0).quadraticCurveTo(0,-r*.3,r*.4,0).quadraticCurveTo(0,r*.3,-r*.4,0)
      .fill({color:0xffd878,alpha:.9}).stroke({color:0xffedb4,width:1.5})
      .poly([0,-r*.22,r*.055,0,0,r*.22,-r*.055,0]).fill(0x966048)
    g.x=side*r*.48;eyes.addChild(g)
  }
  const gaze=new Graphics();gaze.alpha=0;temporary.addChild(gaze)
  const tip=new Graphics().poly([-7,0,0,-3,7,0,0,3]).fill(0xffedb7);tip.label='glare-tip';tip.alpha=0;temporary.addChild(tip)
  const flight={progress:0},tension={amount:0}
  const arcs=new Graphics();arcs.label='glare-paralysis';temporary.addChild(arcs)
  const update=time=>{
    const from=socket(attachment,true),to=targetSocket('center',true),p=flight.progress
    eyes.position.copyFrom(from);eyes.rotation=attacker.rotation
    tip.position.set(from.x+(to.x-from.x)*p,from.y+(to.y-from.y)*p)
    tip.rotation=Math.atan2(to.y-from.y,to.x-from.x)
    gaze.clear().moveTo(from.x,from.y-r*.12).lineTo(tip.x,tip.y).lineTo(from.x,from.y+r*.12)
      .stroke({color:0xf4d98b,width:1.3,alpha:.55,cap:'round'})
    arcs.clear();arcs.position.copyFrom(to)
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5+time*.38,x=Math.cos(a)*reach,y=Math.sin(a)*reach*.72,w=Math.sin(time*25+i)*4
      arcs.moveTo(x*.72,y*.72).lineTo(x*.91-w,y*.91+3).lineTo(x*.83+3,y*.83-4).lineTo(x*1.04+w,y*1.04)
        .stroke({color:i%2?0xe9bc66:0xffedac,width:2,alpha:tension.amount*(.62+Math.sin(time*18+i)**2*.3),cap:'round',join:'round'})
    }
    arcs.alpha=tension.amount
  }
  onFrame(update)
  tl.to(attacker,{x:home.x+3,rotation:.015,duration:.22},0).to(attacker,{x:home.x,rotation:0,duration:.3},.8)
    .to(eyes,{alpha:1,duration:.18},.1).to(eyes,{alpha:0,duration:.3},.75)
    .to(gaze,{alpha:.8,duration:.08},.38).to(gaze,{alpha:0,duration:.17},.73)
    .to(tip,{alpha:1,duration:.06},.38).to(tip,{alpha:0,duration:.12},.73)
    .to(flight,{progress:1,duration:.34,ease:'power2.in'},.38)
    .to(tension,{amount:1,duration:.06},.72).to(tension,{amount:0,duration:.36},1.42)
    .call(()=>{update(.72);onCue({type:'impact'});defender.tint=0xf1d995},[],.72)
    .to(defender,{x:defenderHome.x+2.5,duration:.055,repeat:7,yoyo:true},.72)
    .call(()=>{defender.tint=0xffffff},[],1.16)
}
