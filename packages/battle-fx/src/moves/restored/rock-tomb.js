import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function rockTomb(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, unit, gridOrigin } = bindEffectSpace(context)
  const r=Math.min(36,Math.max(20,context.target.metrics.height/unit*.15)),span=Math.min(92,Math.max(r*1.5,context.target.metrics.width/unit*.3))
  const top=12*context.scene.unit/unit-gridOrigin.y,stones=[],dust=[]
  for(let i=0;i<4;i++){
    const side=i%2?1:-1,back=i<2,land=.7+i*.1,start=land-.42
    const end={x:floor.x+side*span*(back?.82:1),y:floor.y-r*.48+(back?-r*.52:r*.18)}
    const rock=new Container();rock.label='rock-tomb-stone-'+i;rock.alpha=0;temporary.addChild(rock)
    rock.addChild(new Graphics().poly([-r*.88,r*.49,-r*.67,-r*.43,-r*.14,-r*1.12,r*.45,-r*.85,r*.86,-r*.12,r*.74,r*.52])
      .fill(back?0x95816a:0xb49c7b).stroke({color:0x75664f,width:1.5,join:'round'})
      .poly([-r*.67,-r*.43,-r*.14,-r*1.12,r*.15,-r*.24,-r*.3,r*.5,-r*.88,r*.49]).fill(back?0xaf9a7e:0xcfb795)
      .poly([r*.15,-r*.24,r*.45,-r*.85,r*.86,-r*.12,r*.74,r*.52,-r*.3,r*.5]).fill(back?0x7f705e:0x948068)
      .moveTo(-r*.24,-r*.31).lineTo(r*.12,-r*.02).lineTo(-r*.07,r*.27).stroke({color:0x71634f,width:1.3}))
    const startY=Math.max(top+r*1.15,focus.y-r*(1.05+i*.12)),outer=end.x+side*r*.75
    stones.push({rock,start,land,end,startY,outer,side})
    for(let j=0;j<7;j++){const g=new Graphics().ellipse(0,0,4+random()*5,2+random()*2).fill(j%2?0xc9b99b:0xa6957a);g.alpha=0;temporary.addChild(g);dust.push({g,start:land,x:end.x,y:floor.y+(back?-r*.25:r*.42),vx:(random()-.5)*100,vy:20+random()*35,life:.45+random()*.18})}
  }
  const ring=new Graphics().ellipse(0,0,span+r*.3,r*.3).stroke({color:0xc4b18d,width:2});ring.label='rock-tomb-pressure';ring.position.set(floor.x,floor.y+3);ring.alpha=0;temporary.addChildAt(ring,0)
  const gravel=Array.from({length:16},()=>{const g=new Graphics().poly([-2,-2,3,-1,2,3,-2,2]).fill(0xb9a181);g.alpha=0;temporary.addChild(g);return{g,x:floor.x+(random()-.5)*(span*2+r),y:floor.y-r*.25,vx:(random()-.5)*55,vy:20+random()*30,life:.35+random()*.2}})
  const update=time=>{
    for(const p of stones){
      const age=time-p.start,fall=Math.max(0,Math.min(1,age/.42)),close=Math.max(0,Math.min(1,(time-p.land)/.22)),crumble=Math.max(0,Math.min(1,(time-1.5)/.45))
      p.rock.alpha=age>=0?Math.min(1,age/.05)*(1-crumble):0
      p.rock.position.set(p.outer+(p.end.x-p.outer)*fall-p.side*r*.32*close,p.startY+(p.end.y-p.startY)*fall*fall+crumble*r*.3)
      p.rock.rotation=-p.side*(.1*close+.05*crumble)
    }
    for(const p of dust){const age=time-p.start,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.3:0;if(age>=0){p.g.position.set(p.x+p.vx*age,p.y-p.vy*age);p.g.scale.set(1+age*1.4)}}
    for(const p of gravel){const age=time-1.5,u=age/p.life;p.g.alpha=u>=0&&u<1?Math.sin(u*Math.PI)*.75:0;if(age>=0){p.g.position.set(p.x+p.vx*age,p.y-p.vy*age+85*age*age);p.g.rotation=age*3}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-6,rotation:-.028,duration:.22},0).to(attacker,{x:home.x+4,rotation:.018,duration:.2},.22)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.36},.9)
    .to(ring,{alpha:.65,duration:.08},.7).to(ring.scale,{x:1.18,y:1.22,duration:.38},.7).to(ring,{alpha:0,duration:.32},1.08)
    .call(()=>{update(.7);onCue({type:'impact'});defender.tint=0xd8c29f},[],.7)
    .to(defender,{x:defenderHome.x+5,duration:.05,repeat:7,yoyo:true},.7).call(()=>{defender.tint=0xffffff},[],1.13)
}
