import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function gigaDrain(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, unit } = bindEffectSpace(context)
  const radius=Math.min(64,Math.max(38,context.target.metrics.height/unit*.34)),leaves=[]
  const gather=new Graphics();gather.label='giga-drain-gather';gather.position.copyFrom(focus);temporary.addChild(gather)
  const ribbons=new Graphics();temporary.addChild(ribbons)
  for(let i=0;i<18;i++){
    const r=6+random()*3,g=new Graphics().moveTo(-r,0).quadraticCurveTo(0,-r*.8,r,0).quadraticCurveTo(0,r*.8,-r,0).closePath().fill(i%3?0xb3eb7a:0xe0f9ac)
      .moveTo(-r,0).lineTo(r,0).stroke({color:0xf3ffe1,width:1})
    g.label='giga-drain-leaf-'+i;g.alpha=0;temporary.addChild(g);leaves.push({g,start:.68+i*.034,phase:i*Math.PI*2/3})
  }
  const receive=new Container();receive.label='giga-drain-receive';receive.alpha=0;temporary.addChild(receive)
  receive.addChild(new Graphics().ellipse(0,0,43,32).stroke({color:0xc9f297,width:3}).ellipse(0,0,29,43).stroke({color:0xf0ffcf,width:1.8}).ellipse(0,0,34,25).fill({color:0xa4d965,alpha:.12}))
  const path=(u,phase,time,from,to)=>{
    const r=Math.sin(Math.PI*u)*32,a=phase+u*Math.PI*5-time*5
    return {x:from.x+(to.x-from.x)*u+Math.sin(a)*r*.25,y:from.y+(to.y-from.y)*u+Math.cos(a)*r}
  }
  const update=time=>{
    const from=targetSocket('center',true),to=socket('aura',true);receive.position.copyFrom(to);gather.position.copyFrom(from);gather.clear();ribbons.clear()
    gather.alpha=Math.min(1,Math.max(0,(time-.18)/.35))*Math.max(0,1-Math.max(0,time-1.25)/.5)
    if(gather.alpha)for(let i=0;i<3;i++){
      for(let j=0;j<=32;j++){
        const a=time*3+i*Math.PI*2/3+j/32*Math.PI*1.5,r=radius*(.62+.26*Math.sin(a*3-time*2))
        if(j===0)gather.moveTo(Math.cos(a)*r,Math.sin(a)*r);else gather.lineTo(Math.cos(a)*r,Math.sin(a)*r)
      }
      gather.stroke({color:i===0?0xe0fab6:0x91cf67,width:i===0?2.8:1.8,alpha:.68,cap:'round'})
    }
    ribbons.alpha=time>=.68&&time<2.24?Math.min(1,(time-.68)/.15)*Math.max(0,1-Math.max(0,time-1.9)/.34):0
    if(ribbons.alpha)for(let i=0;i<3;i++){
      for(let j=0;j<=50;j++){
        const p=path(j/50,i*Math.PI*2/3,time,from,to)
        if(j===0)ribbons.moveTo(p.x,p.y);else ribbons.lineTo(p.x,p.y)
      }
      ribbons.stroke({color:i===1?0xe3ffb0:0x8bd572,width:i===1?2.4:1.5,alpha:.42,cap:'round'})
    }
    for(const p of leaves){const age=time-p.start;if(age<0||age>.9){p.g.alpha=0;continue}const u=Math.min(1,age/.78),point=path(u,p.phase,time,from,to);p.g.position.copyFrom(point);p.g.rotation=p.phase+age*9;p.g.scale.y=.5+.5*Math.abs(Math.cos(age*8));p.g.alpha=Math.min(1,age/.07)*Math.max(0,1-Math.max(0,age-.78)/.12)}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-7,rotation:-.02,duration:.3},0).to(attacker,{x:home.x,rotation:0,duration:.5},1.55)
    .call(()=>{update(.68);onCue({type:'impact'});defender.tint=0xbede94},[],.68)
    .to(defender,{x:defenderHome.x+5,duration:.075,repeat:3,yoyo:true},.68).call(()=>{defender.tint=0xffffff},[],1)
    .to(receive,{alpha:.9,duration:.15},1.46).to(receive.scale,{x:1.35,y:1.35,duration:.5},1.46).to(receive,{alpha:0,duration:.4},1.96)
    .call(()=>{update(1.46);onCue({type:'recovery'})},[],1.46)
}
