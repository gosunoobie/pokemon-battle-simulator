import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function hypnosis(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('eyes')?'eyes':'emission'
  const r=Math.min(40,Math.max(22,context.target.metrics.height/unit*.18)),rings=[]
  const source=new Graphics().ellipse(0,0,r*.33,r*.19).stroke({color:0xe5b9ec,width:2}).circle(0,0,3).fill(0xf6d5ec)
  source.label='hypnosis-source';source.alpha=0;temporary.addChild(source)
  for(let i=0;i<5;i++){
    const g=new Graphics().ellipse(0,0,r*.39,r).stroke({color:i%2?0xe8c1e5:0xb8a0e6,width:2.3,alpha:.85})
      .ellipse(0,0,r*.29,r*.79).stroke({color:0xf4d7e9,width:1.1,alpha:.65})
    g.label='hypnosis-ring-'+i;g.alpha=0;temporary.addChild(g);rings.push({g,start:.24+i*.13})
  }
  const eyelids=new Graphics();eyelids.label='hypnosis-eyelids';eyelids.alpha=0;temporary.addChild(eyelids)
  for(const side of [-1,1])eyelids.moveTo(side*r*.43-r*.2,-r*.02).quadraticCurveTo(side*r*.43,r*.17,side*r*.43+r*.2,-r*.02).stroke({color:0xe8cee8,width:2,cap:'round'})
  const sleep=new Container();sleep.label='hypnosis-sleep';temporary.addChild(sleep)
  const sign=context.target.base('center').x<context.source.base('center').x?-1:1
  const symbols=Array.from({length:3},(_,i)=>{const size=r*(.13+i*.025),g=new Graphics().moveTo(-size,-size).lineTo(size,-size).lineTo(-size,size).lineTo(size,size).stroke({color:0xd7c3ee,width:1.8,cap:'round',join:'round'});g.scale.x=sign;g.alpha=0;sleep.addChild(g);return{g,start:1.02+i*.22,life:.78}})
  const update=time=>{
    const from=socket(attachment,true),to=targetSocket('center',true);source.position.copyFrom(from)
    for(const p of rings){
      const age=time-p.start,u=Math.max(0,Math.min(1,age/.68)),linger=Math.max(0,age-.68)
      p.g.position.set(from.x+(to.x-from.x)*u,from.y+(to.y-from.y)*u+Math.sin(Math.PI*u)*Math.sin(time*3+p.start)*r*.12)
      p.g.rotation=Math.atan2(to.y-from.y,to.x-from.x);p.g.scale.set(.25+u*.75+linger*.6)
      p.g.alpha=age>=0&&linger<.22?Math.min(1,age/.08)*(1-linger/.22):0
    }
    eyelids.position.set(to.x,to.y-r*.28);sleep.position.set(to.x+r*.45,to.y-r*.65)
    for(const p of symbols){const age=time-p.start,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.85:0;p.g.position.set(Math.sin(age*3)*r*.18,-Math.max(0,age)*r*.95)}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x+2,rotation:.012,duration:.22},0).to(attacker,{x:home.x,rotation:0,duration:.34},1.14)
    .to(source,{alpha:.85,duration:.15},.12).to(source,{alpha:0,duration:.28},.83)
    .to(eyelids,{alpha:.85,duration:.2},.92).to(eyelids,{alpha:0,duration:.4},1.52)
    .call(()=>{update(.92);onCue({type:'impact'});defender.tint=0xd6bbef},[],.92)
    .to(defender,{y:defenderHome.y+2,rotation:.012,duration:.35},.92)
    .to(defender,{y:defenderHome.y,rotation:0,duration:.55},1.36).call(()=>{defender.tint=0xffffff},[],1.4)
}
