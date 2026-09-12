import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function sandTomb(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, floor, unit } = bindEffectSpace(context)
  const rx=Math.min(95,Math.max(48,context.target.metrics.width/unit*.53)),ry=rx*.29
  const sink=Math.min(10,context.target.metrics.height/unit*.07)
  const pit=new Container();pit.label='sand-tomb-pit';pit.position.copyFrom(floor);pit.alpha=0;temporary.addChild(pit)
  const sand=new Graphics();pit.addChild(sand)
  const grains=[],dust=[]
  for(let i=0;i<52;i++){
    const s=1.2+random()*2,g=new Graphics().poly([-s,0,0,-s*.65,s*.85,0,0,s*.7]).fill([0xe5cd94,0xc09c62,0xf6dfab][i%3])
    pit.addChild(g);grains.push({g,phase:i/52,offset:random()*6})
  }
  for(let i=0;i<8;i++){
    const g=new Graphics().ellipse(0,0,rx*.2,rx*.105).fill({color:i%2?0xd3b783:0xa88757,alpha:.2})
      .ellipse(-rx*.08,-rx*.06,rx*.12,rx*.08).fill({color:0xe2c894,alpha:.1})
    pit.addChild(g);dust.push({g,phase:i/8})
  }
  const clamp=u=>Math.max(0,Math.min(1,u))
  const update=time=>{
    const grow=clamp((time-.16)/.54),fade=1-clamp((time-1.75)/.5)
    pit.alpha=grow*fade;sand.clear()
    if(pit.alpha<=0)return
    sand.ellipse(0,0,rx*grow,ry*grow).fill({color:0x967a52,alpha:.26})
      .ellipse(0,1,rx*.27,ry*.31).fill({color:0x3f3629,alpha:.32})
    for(let arm=0;arm<3;arm++){
      for(let j=0;j<=40;j++){
        const u=j/40,a=arm*Math.PI*2/3+u*Math.PI*2-time*3,r=(.12+.88*u)*grow
        const x=Math.cos(a)*rx*r,y=Math.sin(a)*ry*r
        if(j===0)sand.moveTo(x,y);else sand.lineTo(x,y)
      }
      sand.stroke({color:arm===1?0xf0d9a2:0xcbb17a,width:arm===1?2.8:4,alpha:.65,cap:'round'})
    }
    for(const p of grains){
      const u=(p.phase+time*.78)%1,r=(1-u)**1.3*grow,a=p.offset+u*Math.PI*3+time*1.6
      p.g.position.set(Math.cos(a)*rx*r,Math.sin(a)*ry*r-6*Math.sin(Math.PI*u))
      p.g.rotation=a;p.g.alpha=Math.sin(Math.PI*u)*.9;p.g.scale.set(1-u*.5)
    }
    for(const p of dust){
      const u=(p.phase+time*.48)%1,a=time*2+p.phase*6
      p.g.position.set(Math.cos(a)*rx*.75,Math.sin(a)*ry*.55-u*rx*.42)
      p.g.alpha=Math.sin(Math.PI*u)*.8;p.g.scale.set(.7+u*.8);p.g.rotation=Math.sin(a)*.2
    }
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-4,y:home.y+2,duration:.16},0).to(attacker,{x:home.x+3,y:home.y,duration:.16},.16)
    .to(attacker,{x:home.x,duration:.35},.7)
    .call(()=>{update(.7);onCue({type:'impact'});defender.tint=0xdbc3a0},[],.7)
    .to(defender,{y:defenderHome.y+sink,duration:.26,ease:'power2.out'},.7)
    .to(defender,{x:defenderHome.x+4,duration:.08,repeat:3,yoyo:true},.7)
    .to(defender,{y:defenderHome.y,duration:.5,ease:'power2.inOut'},1.65)
    .call(()=>{defender.tint=0xffffff},[],.94)
}
