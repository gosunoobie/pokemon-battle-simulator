import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function drillPeck(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, solveContact, unit } = bindEffectSpace(context)
  const attachment=context.source.hasAnchor?.('beak')?'beak':'emission'
  const base=socket(attachment),length=Math.min(70,Math.max(34,context.source.metrics.height/unit*.25))
  const point={x:focus.x,y:focus.y+4},aim=Math.atan2(point.y-base.y,point.x-base.x),rotation=.04
  const pose=solveContact(attachment,rotation,{x:point.x-Math.cos(aim+rotation)*length,y:point.y-Math.sin(aim+rotation)*length})
  const drill=new Container();drill.label='drill-peck-beak';drill.alpha=0;temporary.addChild(drill)
  drill.addChild(new Graphics().poly([0,-length*.19,length,0,0,length*.19]).fill(0xc4e1e7)
    .poly([0,0,length,0,0,length*.19]).fill(0x79b4c4)
    .moveTo(0,-length*.14).lineTo(length,0).stroke({color:0xf6fcf4,width:2.4,cap:'round'}))
  const helix=new Graphics(),wake=new Graphics();drill.addChild(helix,wake)
  const follow=()=>{drill.position.copyFrom(socket(attachment,true));drill.rotation=aim+attacker.rotation}
  const curls=[]
  for(let i=0;i<16;i++){
    const g=new Graphics().arc(0,0,3+random()*3,-.6,1.8).stroke({color:i%2?0xc5f4ff:0xf4fffd,width:1.8,cap:'round'})
    g.alpha=0;temporary.addChild(g)
    curls.push({g,start:.76+i*.014,angle:random()*Math.PI*2,speed:48+random()*66,life:.25+random()*.12})
  }
  onFrame(time=>{
    follow();helix.clear();wake.clear()
    if(time>=.12&&time<1.4){
      // Bands revolve about the beak's long axis; the actor keeps its upright silhouette.
      for(let strand=0;strand<2;strand++){
        for(let j=0;j<=40;j++){
          const u=j/40,y=Math.sin(u*Math.PI*6-time*31+strand*Math.PI)*length*.2*(1-u)
          if(j===0)helix.moveTo(0,y);else helix.lineTo(u*length,y)
        }
        helix.stroke({color:strand?0xffffff:0x79e0fa,width:strand?1.6:2.8,alpha:.9,cap:'round'})
      }
      const speed=Math.min(1,Math.max(0,(time-.24)/.2))*(1-Math.min(1,Math.max(0,(time-1.08)/.22)))
      for(let strand=0;strand<2;strand++){
        for(let j=0;j<=30;j++){
          const u=j/30,x=-length*(.1+u*.95),y=Math.sin(time*26-u*10+strand*Math.PI)*length*.24*(1-u*.6)
          if(j===0)wake.moveTo(x,y);else wake.lineTo(x,y)
        }
        wake.stroke({color:0xc8f3ff,width:2,alpha:speed*.6,cap:'round'})
      }
    }
    for(const p of curls){const age=time-p.start;if(age<0||age>p.life){p.g.alpha=0;continue}p.g.position.set(point.x+Math.cos(p.angle)*p.speed*age,point.y+Math.sin(p.angle)*p.speed*age);p.g.rotation=p.angle+age*12;p.g.alpha=Math.sin(Math.PI*age/p.life)*.95}
  })
  const ring=new Graphics().ellipse(0,0,10,21).stroke({color:0xc6f7ff,width:2.5})
  ring.position.copyFrom(point);ring.rotation=aim;ring.alpha=0;temporary.addChild(ring)
  tl.to(attacker,{x:home.x-10,rotation:-.045,duration:.24},0)
    .to(attacker,{...pose,duration:.52,ease:'power3.in'},.24)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.45,ease:'power2.inOut'},1.1)
    .to(drill,{alpha:1,duration:.15},.12).to(drill,{alpha:0,duration:.28},1.12)
    .to(ring,{alpha:1,duration:.03},.76).to(ring.scale,{x:1.9,y:1.7,duration:.34},.76).to(ring,{alpha:0,duration:.28},.83)
    .call(()=>{follow();onCue({type:'impact'});defender.tint=0xc2eff9},[],.76)
    .to(defender,{x:defenderHome.x+7,duration:.04,repeat:7,yoyo:true},.76)
    .call(()=>{defender.tint=0xffffff},[],1.08)
}
