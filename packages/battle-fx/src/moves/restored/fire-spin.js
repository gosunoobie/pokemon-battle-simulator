import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function fireSpin(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, unit } = bindEffectSpace(context)
  const rx=Math.min(78,Math.max(40,context.target.metrics.width/unit*.44)),height=Math.min(172,Math.max(95,context.target.metrics.height/unit*.85))
  const coil=new Container();coil.label='fire-spin-coil';coil.position.copyFrom(floor);coil.alpha=0;temporary.addChild(coil)
  const ribbons=new Graphics();coil.addChild(ribbons)
  const tongues=[],embers=[]
  for(let i=0;i<24;i++){
    const s=6+random()*4,g=new Graphics().moveTo(0,s).quadraticCurveTo(-s*1.2,0,0,-s*1.7)
      .lineTo(s*.2,-s*.25).lineTo(s*.65,-s*.7).quadraticCurveTo(s, s*.5,0,s).closePath().fill(i%3?0xffa147:0xf07830)
      .moveTo(0,s*.5).quadraticCurveTo(-s*.4,0,0,-s*.65).quadraticCurveTo(s*.6,s*.1,0,s*.5).fill(0xffe59a)
    coil.addChild(g);tongues.push({g,phase:i/24})
  }
  for(let i=0;i<18;i++){
    const g=new Graphics().ellipse(0,0,1.5+random()*1.5,3).fill(i%2?0xffd47b:0xfca75d)
    coil.addChild(g);embers.push({g,phase:i/18,offset:random()*Math.PI*2})
  }
  const seed=new Graphics().ellipse(0,0,8,5).fill(0xffc65f).ellipse(1,0,3,2).fill(0xfff0b4)
  seed.label='fire-spin-seed';seed.alpha=0;temporary.addChild(seed)
  const clamp=u=>Math.max(0,Math.min(1,u))
  const update=time=>{
    const grow=clamp((time-.58)/.42),fade=1-clamp((time-1.8)/.65)
    coil.alpha=grow*fade;ribbons.clear()
    if(time>=.24&&time<.88){
      const u=clamp((time-.24)/.52),from=socket('emission',true)
      seed.position.set(from.x+(focus.x-from.x)*u,from.y+(focus.y-from.y)*u+Math.sin(u*Math.PI*4)*14*Math.sin(u*Math.PI))
      seed.rotation=time*13;seed.alpha=clamp((time-.24)/.06)*(1-clamp((time-.76)/.12))
    }else seed.alpha=0
    if(coil.alpha<=0)return
    for(let strand=0;strand<2;strand++){
      for(const [width,color,alpha] of [[9,0xf67228,.17],[3.7,0xffa14b,.8],[1.1,0xffe5a1,.95]]){
        for(let j=0;j<=70;j++){
          const u=j/70,a=time*8-u*Math.PI*4.8+strand*Math.PI,r=rx*(.8+.12*Math.sin(Math.PI*u))
          const x=Math.cos(a)*r,y=-height*u*grow+Math.sin(a)*rx*.19
          if(j===0)ribbons.moveTo(x,y);else ribbons.lineTo(x,y)
        }
        ribbons.stroke({color,width,alpha,cap:'round',join:'round'})
      }
    }
    for(const p of tongues){
      const u=(p.phase+time*.53)%1,a=time*8-u*Math.PI*4.8,r=rx*(.8+.12*Math.sin(Math.PI*u))
      p.g.position.set(Math.cos(a)*r,-height*u*grow+Math.sin(a)*rx*.19)
      p.g.rotation=Math.cos(a)*.25;p.g.scale.set(.75+.25*Math.sin(Math.PI*u),.9+Math.sin(time*27+p.phase*6)*.16)
      p.g.alpha=Math.sin(Math.PI*u)*(.45+.55*(.5+.5*Math.sin(a)))
    }
    for(const p of embers){const u=(p.phase+time*.45)%1,a=p.offset+time*3;p.g.position.set(Math.cos(a)*rx*(.5+.5*u),-height*u*1.13);p.g.alpha=Math.sin(Math.PI*u)*.7;p.g.rotation=Math.sin(a)*.5}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-6,duration:.18},0).to(attacker,{x:home.x+6,duration:.18},.18)
    .to(attacker,{x:home.x,duration:.35},.82)
    .call(()=>{update(.76);onCue({type:'impact'});defender.tint=0xffc697},[],.76)
    .to(defender,{x:defenderHome.x+5,duration:.065,repeat:3,yoyo:true},.76)
    .call(()=>{defender.tint=0xffffff},[],1.03)
}
