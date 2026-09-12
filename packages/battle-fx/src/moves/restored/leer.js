import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function leer(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('eyes')?'eyes':'emission'
  const r=Math.min(34,Math.max(19,context.source.metrics.width/unit*.14))
  const stare=new Container();stare.label='leer-stare';stare.alpha=0;temporary.addChild(stare)
  for(const side of [-1,1]){
    const eye=new Graphics().moveTo(-r*.42,-r*.17).quadraticCurveTo(0,r*.25,r*.42,-r*.02)
      .lineTo(-r*.42,-r*.17).fill(0xffecc0)
      .moveTo(-r*.48,-r*.25).lineTo(r*.45,-r*.08).stroke({color:0xc78759,width:2.8,cap:'round'})
      .ellipse(r*.07,r*.015,r*.055,r*.14).fill(0x9b563c)
    eye.position.x=side*r*.52;eye.scale.x=-side;stare.addChild(eye)
  }
  const glint=new Graphics().poly([-r*.32,0,-r*.055,-r*.06,0,-r*.35,r*.055,-r*.06,r*.32,0,r*.055,r*.06,0,r*.35,-r*.055,r*.06]).fill(0xfff5d8)
  glint.position.set(r*.54,-r*.1);glint.alpha=0;stare.addChild(glint)
  const pressures=Array.from({length:3},(_,i)=>{
    const g=new Graphics().moveTo(0,-r*.4).quadraticCurveTo(r*.22,0,0,r*.4).stroke({color:i?0xe6ba86:0xffedbb,width:i?1.4:2.6,cap:'round'})
    g.label=`leer-pressure-${i}`;g.alpha=0;temporary.addChild(g);return g
  })
  const drops=Array.from({length:3},(_,i)=>{
    const g=new Graphics().moveTo(-7,-4).lineTo(0,3).lineTo(7,-4).stroke({color:0xd2ae85,width:2,cap:'round',join:'round'})
    g.alpha=0;temporary.addChild(g);return g
  })
  const update=time=>{
    const from=socket(attachment,true),to=targetSocket('center',true)
    stare.position.copyFrom(from);stare.rotation=attacker.rotation
    pressures.forEach((g,i)=>{
      const age=time-.28-i*.075,p=Math.max(0,Math.min(1,age/.36)),fade=Math.max(0,age-.36)/.18
      g.position.set(from.x+(to.x-from.x)*p,from.y+(to.y-from.y)*p)
      g.rotation=Math.atan2(to.y-from.y,to.x-from.x);g.scale.set(.65+p*.55)
      g.alpha=age>=0?Math.min(1,age/.055)*Math.max(0,1-fade)*.85:0
    })
    drops.forEach((g,i)=>{const age=time-.65-i*.1,p=age/.55;g.position.set(to.x+(i-1)*r*.6,to.y+r*.45+p*r*.65);g.alpha=p>=0&&p<1?Math.sin(p*Math.PI)*.8:0})
  }
  onFrame(update)
  tl.to(attacker,{rotation:.018,x:home.x+3,duration:.2},0)
    .to(attacker,{rotation:0,x:home.x,duration:.3},.78)
    .to(stare,{alpha:1,duration:.15},.08).to(stare,{alpha:0,duration:.24},.63)
    .to(glint,{alpha:1,duration:.04},.23).to(glint,{alpha:0,duration:.19},.3)
    .call(()=>{update(.64);onCue({type:'impact'});defender.tint=0xddc7ac},[],.64)
    .to(defender,{x:defenderHome.x+5,duration:.1},.64).to(defender,{x:defenderHome.x,duration:.24},.83)
    .call(()=>{defender.tint=0xffffff},[],.89)
}
