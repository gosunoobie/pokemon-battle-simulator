import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function airCutter(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('wing')?'wing':'emission'
  const base=socket(attachment),release={x:home.x+6,y:home.y,rotation:.03}
  const origin={x:release.x+base.x*Math.cos(release.rotation)-base.y*Math.sin(release.rotation),y:release.y+base.x*Math.sin(release.rotation)+base.y*Math.cos(release.rotation)}
  const radius=Math.min(34,Math.max(18,context.target.metrics.height/unit*.16))
  const distance=Math.hypot(focus.x-origin.x,focus.y-origin.y),bow=Math.min(48,distance*.13),blades=[]
  for(let i=0;i<2;i++){
    const r=radius*(i===0?1:.83),blade=new Container();blade.label='air-cutter-crescent-'+i;blade.alpha=0;temporary.addChild(blade)
    const wake=new Graphics();blade.addChild(wake)
    // The forward edge is exactly (0, 0); every crescent path ends on that edge.
    blade.addChild(new Graphics().moveTo(-r*.65,-r).quadraticCurveTo(-r*.1,-r*.6,0,0)
      .quadraticCurveTo(-r*.1,r*.6,-r*.65,r).quadraticCurveTo(-r*.36,0,-r*.65,-r).closePath().fill({color:0xb7e6f2,alpha:.62})
      .moveTo(-r*.65,-r).quadraticCurveTo(-r*.1,-r*.6,0,0).quadraticCurveTo(-r*.1,r*.6,-r*.65,r)
      .stroke({color:0xf1fdff,width:2.5,cap:'round'}))
    blades.push({blade,wake,r,start:.32+i*.08,end:{x:focus.x,y:focus.y+i*radius*.4},bow:(i===0?-1:1)*bow})
  }
  const motes=[]
  for(let i=0;i<18;i++){
    const g=new Graphics().moveTo(-4,0).quadraticCurveTo(0,-3,7,0).stroke({color:i%3?0xe6fbff:0x99d6e6,width:1.5,cap:'round'})
    g.alpha=0;temporary.addChild(g);motes.push({g,start:.82+(i%2)*.08,angle:random()*Math.PI*2,speed:50+random()*75,life:.23+random()*.16,lane:i%2})
  }
  const update=time=>{
    for(const p of blades){
      const age=time-p.start;if(age<0||age>.65){p.blade.alpha=0;continue}
      const u=Math.min(1,age/.5),x=origin.x+(p.end.x-origin.x)*u,y=origin.y+(p.end.y-origin.y)*u+Math.sin(u*Math.PI)*p.bow
      p.blade.position.set(x,y);p.blade.rotation=Math.atan2(p.end.y-origin.y+Math.cos(u*Math.PI)*Math.PI*p.bow,p.end.x-origin.x)
      p.blade.alpha=Math.min(1,age/.055)*Math.max(0,1-(age-.5)/.15)
      p.wake.clear()
      for(let j=0;j<3;j++){
        const y=(j-1)*p.r*.43
        p.wake.moveTo(-p.r*.45,y).quadraticCurveTo(-p.r*1.15,y+(j-1)*3,-p.r*(1.65+j*.15),y+(j-1)*6)
          .stroke({color:0xc9edf7,width:j===1?1.7:1,alpha:.5*Math.sin(u*Math.PI),cap:'round'})
      }
    }
    for(const p of motes){const age=time-p.start;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(focus.x+Math.cos(p.angle)*p.speed*age,focus.y+p.lane*radius*.4+Math.sin(p.angle)*p.speed*age);p.g.rotation=p.angle+age*3;p.g.alpha=Math.sin(Math.PI*age/p.life)*.85}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-6,rotation:-.035,duration:.18},0)
    .to(attacker,{...release,duration:.12,ease:'power2.out'},.18)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.4,ease:'power2.inOut'},.52)
    .call(()=>{update(.82);onCue({type:'impact'});defender.tint=0xd2edf5},[],.82)
    .to(defender,{x:defenderHome.x+8,duration:.06,repeat:3,yoyo:true},.82)
    .call(()=>{defender.tint=0xffffff},[],1.06)
}
