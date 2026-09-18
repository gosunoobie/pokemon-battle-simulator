import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Keep the reviewed three-orb opening, then unfold its three materials at the
// native recording's successive energy accents. Later phases remain cosmetic.
export const timing = Object.freeze({ contact: 1.06, duration: 4.90, markers: Object.freeze([
  { id: 'formation', label: 'Three elemental orbs form', timeSeconds: .10 },
  { id: 'launch', label: 'Triangle launches', timeSeconds: .48 },
  { id: 'burn', label: 'Burning aftermath begins', timeSeconds: 1.06 },
  { id: 'burn-crest', label: 'Flames flare at the first sound accent', timeSeconds: 1.42 },
  { id: 'spark', label: 'Electrical aftermath begins', timeSeconds: 1.84 },
  { id: 'spark-crest', label: 'Electrical impact crest', timeSeconds: 1.96 },
  { id: 'crackle', label: 'Later electrical crackle', timeSeconds: 2.17 },
  { id: 'freeze', label: 'Upright ice begins growing', timeSeconds: 2.67 },
  { id: 'ice-shatter', label: 'First ice shatter accent', timeSeconds: 3.73 },
  { id: 'last-shatter', label: 'Final crystal breaks', timeSeconds: 4.39 },
  { id: 'aftermath-end', label: 'Last ice fragments clear', timeSeconds: 4.80 },
]) })

export default function triAttack(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const bounds = { left: Math.min(...edges) + 4, right: Math.max(...edges) - 4,
    top: -temporary.y / unit + 4, bottom: (context.scene.height - temporary.y) / unit - 4 }
  const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n))
  const room = p => Math.max(0, Math.min(p.x - bounds.left, bounds.right - p.x, p.y - bounds.top, bounds.bottom - p.y))
  const fit = (g, p, radius, scale = 1) => { g.position.copyFrom(p); g.scale.set(Math.min(scale, room(p) / radius)) }
  const keep = (p, margin = 3) => ({ x: clamp(p.x, bounds.left + margin, bounds.right - margin), y: clamp(p.y, bounds.top + margin, bounds.bottom - margin) })
  const sourceCenter = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiverCenter = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const sourceHalf = context.source.metrics.width / (2 * unit), targetHalf = context.target.metrics.width / (2 * unit)
  const back = Math.max(0, Math.min(7, sourceCenter.x - sourceHalf - bounds.left))
  const thrust = Math.max(0, Math.min(8, bounds.right - sourceCenter.x - sourceHalf))
  const recoil = Math.max(0, Math.min(10, bounds.right - receiverCenter.x - targetHalf))
  const radius=Math.min(16,Math.max(10,context.target.metrics.height/unit*.08)),formation=radius*2.4
  const base=socket('emission'),origin={x:base.x+thrust,y:base.y},palette=[0xffa55e,0xffe77b,0x9ce4ff]
  let openingImpact = null
  const link=new Graphics();link.label='tri-attack-link';temporary.addChild(link)
  const orbs=[],pieces=[]
  for(let i=0;i<3;i++){
    const trail=new Graphics();trail.label='tri-attack-trail-'+i;temporary.addChild(trail)
    const orb=new Container();orb.label='tri-attack-orb-'+i;orb.alpha=0;temporary.addChild(orb)
    orb.addChild(new Graphics().circle(0,0,radius*1.35).fill({color:palette[i],alpha:.13})
      .circle(0,0,radius).fill({color:palette[i],alpha:.74}).circle(0,0,radius*.65).stroke({color:0xfff9ee,width:1.3,alpha:.75}))
    const motif=new Graphics()
    if(i===0)motif.moveTo(0,radius*.5).quadraticCurveTo(-radius*.65,0,0,-radius*.7).lineTo(radius*.13,-radius*.13)
      .lineTo(radius*.42,-radius*.4).quadraticCurveTo(radius*.65,radius*.35,0,radius*.5).closePath().fill(0xfff2c2)
    else if(i===1)motif.poly([2,-radius*.7,-radius*.4,1,0,1,-2,radius*.65,radius*.4,-2,0,-2]).fill(0xffffda)
    else for(let j=0;j<3;j++){const a=j*Math.PI/3;motif.moveTo(-Math.cos(a)*radius*.6,-Math.sin(a)*radius*.6).lineTo(Math.cos(a)*radius*.6,Math.sin(a)*radius*.6).stroke({color:0xf0ffff,width:1.8,cap:'round'})}
    orb.addChild(motif);orbs.push({orb,trail,phase:-Math.PI/2+i*Math.PI*2/3,color:palette[i]})
    for(let j=0;j<6;j++){
      const g=new Graphics(),size=4+random()*4
      if(i===0)g.moveTo(0,-size).quadraticCurveTo(-size,size*.6,0,size).quadraticCurveTo(size,0,0,-size).closePath().fill(palette[i])
      else if(i===1)g.poly([-size,-3,0,0,-2,3,size,5]).stroke({color:palette[i],width:1.8})
      else g.poly([0,-size,size*.4,0,0,size,-size*.4,0]).fill(palette[i])
      g.label=`tri-attack-piece-${i}-${j}`;g.alpha=0;temporary.addChild(g);pieces.push({g,size,angle:i*Math.PI*2/3+(random()-.5)*1.7,speed:60+random()*95,life:.3+random()*.2})
    }
  }
  const flightPoint=(p,u,time)=>{
    const a=p.phase+time*3+u*Math.PI*1.5,center={x:origin.x+(focus.x-origin.x)*u,y:origin.y+(focus.y-origin.y)*u}
    const r=Math.min(formation*(1-u),Math.max(0,room(center)-radius*1.35-2))
    return {x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r}
  }
  const update=time=>{
    Object.assign(focus, openingImpact ?? targetSocket('center',true))
    link.clear();link.alpha=time>=.12&&time<.56?1:0
    const u=Math.max(0,Math.min(1,(time-.48)/.58)),fade=Math.max(0,1-Math.max(0,time-1.06)/.17)
    for(const p of orbs){
      p.trail.clear();p.trail.alpha=time>=.48&&time<1.23?1:0
      if(time<.1||time>=1.23){p.orb.alpha=0;continue}
      const point=time<.48?socket('emission',true):flightPoint(p,u,time)
      if(time<.48){const grow=Math.min(1,(time-.1)/.23),span=Math.min(formation,Math.max(0,room(point)-radius*1.35-2));point.x+=Math.cos(p.phase+time*3)*span*grow;point.y+=Math.sin(p.phase+time*3)*span*grow}
      fit(p.orb,point,radius*1.35+1,1-u*.4);p.orb.alpha=Math.min(1,(time-.1)/.15)*fade
      if(time>=.48){
        for(let j=0;j<=14;j++){
          const v=Math.max(0,u-.18)+Math.min(u,.18)*j/14,q=flightPoint(p,v,time-(u-v)*.58)
          if(j===0)p.trail.moveTo(q.x,q.y);else p.trail.lineTo(q.x,q.y)
        }
        p.trail.stroke({color:p.color,width:2.6,alpha:.6*fade,cap:'round',join:'round'})
      }
    }
    if(time>=.12&&time<.56){
      orbs.forEach((p,i)=>i===0?link.moveTo(p.orb.x,p.orb.y):link.lineTo(p.orb.x,p.orb.y))
      link.closePath().stroke({color:0xe9ece4,width:1.2,alpha:Math.min(1,(time-.12)/.15)*Math.max(0,1-Math.max(0,time-.44)/.12)*.55})
    }
    for(const p of pieces){const age=time-1.06;if(age<0||age>p.life){p.g.alpha=0;continue}const point=keep({x:focus.x+Math.cos(p.angle)*p.speed*age,y:focus.y+Math.sin(p.angle)*p.speed*age},p.size+2);fit(p.g,point,p.size+2);p.g.rotation=p.angle+age*4;p.g.alpha=Math.sin(Math.PI*age/p.life)}
    fit(ringFit,focus,52);fit(flash,focus,26)
  }
  onFrame(update)
  const ring=new Graphics();for(let i=0;i<3;i++)ring.arc(0,0,23,i*Math.PI*2/3,i*Math.PI*2/3+1.8).stroke({color:palette[i],width:3.1,cap:'round'})
  const ringFit=new Container();ringFit.label='tri-attack-ring';temporary.addChild(ringFit);ringFit.addChild(ring);ring.alpha=0
  const flash=new Graphics().poly([-25,0,-5,-5,0,-25,5,-5,25,0,5,5,0,25,-5,5]).fill(0xfffbe2)
  flash.label='tri-attack-flash';flash.position.copyFrom(focus);flash.alpha=0;temporary.addChild(flash)
  tl.to(attacker,{x:home.x-back,duration:.2},0).to(attacker,{x:home.x+thrust,duration:.22},.2)
    .call(()=>{Object.assign(origin,socket('emission',true))},[],.48)
    .to(attacker,{x:home.x,duration:.42,ease:'power2.inOut'},1.14)
    .to(flash,{alpha:1,duration:.025},1.06).to(flash,{alpha:0,duration:.19},1.12)
    .to(ring,{alpha:1,duration:.025},1.06).to(ring.scale,{x:2.1,y:2.1,duration:.4},1.06).to(ring,{alpha:0,duration:.32},1.14)
    .call(()=>{openingImpact={...targetSocket('center',true)};update(1.06);onCue({type:'impact'});defender.tint=0xffefd0},[],1.06)
    .to(defender,{x:defenderHome.x+recoil,duration:.065,repeat:3,yoyo:true},1.06)
    .call(()=>{defender.tint=0xffffff},[],1.32)
    .call(()=>{},[],timing.duration)

  const fire=new Graphics();fire.label='tri-attack-burning';temporary.addChild(fire)
  const electric=new Graphics();electric.label='tri-attack-electric';electric.blendMode='add';temporary.addChild(electric)
  const electricSparks=new Graphics();electricSparks.label='tri-attack-electric-sparks';temporary.addChild(electricSparks)
  const frost=new Graphics();frost.label='tri-attack-frost';temporary.addChild(frost)
  const attachments=[[-.23,-.18],[.22,.18],[-.04,-.29],[-.25,.23],[.27,-.04],[.025,.28],[.135,-.19]]
  const ice=attachments.map((attachment,i)=>{
    const crystal=new Graphics();crystal.label=`tri-attack-ice-${i}`;crystal.alpha=0;temporary.addChild(crystal)
    const shards=Array.from({length:7},(_,j)=>{
      const shard=new Graphics().poly([0,-4,2.8,1,-1.6,4]).fill({color:j%2?0xc2f1ff:0x89cbe9,alpha:.72})
        .stroke({width:.8,color:0xffffff,alpha:.72,join:'round'})
      shard.label=`tri-attack-ice-shard-${i}-${j}`;shard.alpha=0;temporary.addChild(shard);return shard
    })
    const flash=new Graphics();flash.label=`tri-attack-ice-flash-${i}`;temporary.addChild(flash)
    return{crystal,shards,flash,attachment,start:2.67+i*.1,shatter:Number((3.73+i*.11).toFixed(2)),collision:null}
  })
  onFrame(time=>{
    const center=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',true)
    const width=context.target.metrics.width/unit,height=context.target.metrics.height/unit
    const ground=keep({x:center.x,y:center.y+height/2},8)
    const rx=Math.max(1,Math.min(155,width*.72,ground.x-bounds.left-4,bounds.right-ground.x-4))
    const ry=Math.max(1,Math.min(185,height*1.03,ground.y-bounds.top-4))
    fire.position.copyFrom(ground);fire.clear();fire.alpha=time>=1.06&&time<1.94?1:0
    if(fire.alpha){
      const age=time-1.06,fade=clamp((1.94-time)/.15),surge=.64+.36*Math.exp(-(((time-1.42)/.095)**2))
      for(let i=0;i<8;i++){
        const size=1-i*.095
        fire.ellipse(0,-ry*.28,rx*.61*size,ry*.30*size).fill({color:i<4?0xff682b:0xffd37b,alpha:.025*surge*fade})
      }
      for(let i=0;i<7;i++){
        const x=(i/6-.5)*rx*1.45,h=ry*(.34+.14*(i%3)+.09*Math.sin(time*15+i*1.9))*Math.min(1,age/.16)
        const w=rx*(.055+.012*(i%3)),bend=Math.sin(time*13+i*2.1)*w*.9
        for(const [scale,color,opacity]of [[1,0xf1672c,.84],[.65,0xffb64c,.9],[.3,0xfff0b7,.95]]){
          const hh=h*scale,ww=w*scale
          fire.moveTo(x-ww,-4).bezierCurveTo(x-ww*1.8,-hh*.34,x+bend-ww,-hh*.72,x+bend,-hh)
            .bezierCurveTo(x+bend+ww*.25,-hh*.54,x+ww*1.8,-hh*.30,x+ww,-4).closePath()
            .fill({color,alpha:opacity*surge*fade})
        }
      }
      for(let i=0;i<24;i++){
        const p=(age*(1.8+i%3*.22)+i*.137)%1,x=Math.sin(i*2.4)*rx*.66+Math.sin(time*13+i)*rx*.025
        fire.ellipse(x,-8-p*Math.max(0,ry-14),1.5+i%2,2.4+i%3).fill({color:i%3?0xffb85a:0xffefae,alpha:Math.sin(p*Math.PI)*fade*.78})
      }
    }
    electric.position.copyFrom(ground);electricSparks.position.copyFrom(ground);electric.clear();electricSparks.clear()
    electric.alpha=electricSparks.alpha=time>=1.84&&time<2.58?1:0
    if(electric.alpha){
      const age=time-1.84,rise=clamp(age/.12),fade=clamp((2.58-time)/.16)
      const crest=.52+.48*Math.exp(-(((time-1.96)/.07)**2))+.15*Math.exp(-(((time-2.17)/.045)**2)),intensity=rise*fade*crest
      const dome=(x,y,color,alpha)=>electric.moveTo(-x,-3).bezierCurveTo(-x,-y*.56,-x*.56,-y,0,-y)
        .bezierCurveTo(x*.56,-y,x,-y*.56,x,-3).closePath().fill({color,alpha})
      for(let i=0;i<14;i++){const size=.96-i*.05;dome(rx*size,ry*size,i<6?0xffbd36:0xffec9a,intensity*(.015+i*.0019))}
      dome(rx*.24,ry*.3,0xfff1a8,intensity*.4);dome(rx*.10,ry*.14,0xffffdf,intensity*.86)
      const lengths=[.53,.86,.62,.98,.72,.91,.57,.8,.66,1,.49],weights=[1,2.5,1.25,4,1.5,3.1,1.1,2.8,1.4,3.7,1.05]
      for(let i=0;i<lengths.length;i++){
        const a=-Math.PI+.16+i/10*(Math.PI-.32),weight=weights[i],margin=weight*2.3+1.5
        const xRoom=Math.max(margin,rx),yRoom=Math.max(margin,ry),flicker=.7+.3*Math.sin(time*26+i*2.1)**2
        const points=[0,.27,.46,.68,.94].map((p,j)=>({x:clamp(Math.cos(a)*rx*lengths[i]*p+Math.sin(a)*rx*Math.sin(j*3+time*24+i)*.026,-xRoom+margin,xRoom-margin),
          y:clamp(-margin+Math.sin(a)*ry*lengths[i]*p,-yRoom+margin,-margin)}))
        for(const [w,color,alpha]of [[weight*4.6,0xffbd33,.16],[weight*2,0xffdf70,.8],[weight,0xffffe8,1]]){
          electric.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>electric.lineTo(p.x,p.y))
          electric.stroke({width:w,color,alpha:alpha*flicker*intensity,cap:'round',join:'round'})
        }
      }
      for(let i=0;i<30;i++){
        const birth=1.84+i/29*.46,p=(time-birth)/.28;if(p<0||p>=1)continue
        const a=-Math.PI+.12+((i*.61803398875)%1)*(Math.PI-.24),x=Math.cos(a)*rx*p*.8,y=Math.sin(a)*ry*p*.76+ry*.3*p*p
        if(y+2>=-3)continue
        electricSparks.circle(x,y,1.4+i%3*.3).fill({color:i%2?0xfffff2:0xffd85f,alpha:(1-p)*fade*.92})
      }
    }
    frost.position.copyFrom(center);frost.clear()
    const cold=clamp((time-2.67)/.2)*clamp((4.80-time)/.25)
    if(cold>0){
      const spanX=Math.min(width*.47,room(center)*.8),spanY=Math.min(height*.47,room(center)*.8)
      for(let i=0;i<20;i++){
        const p=((time-2.67)*(1.3+i%3*.1)+i*.137)%1,x=Math.sin(i*2.4)*spanX,y=-spanY+p*spanY*2
        frost.circle(x,y,1+i%3*.45).fill({color:0xdff7ff,alpha:Math.sin(p*Math.PI)*cold*.7})
      }
    }
    for(const [i,p]of ice.entries()){
      const destination=keep({x:center.x+p.attachment[0]*width,y:center.y+p.attachment[1]*height},7)
      p.crystal.clear();p.flash.clear();p.crystal.alpha=0
      const age=time-p.start,growth=clamp(age/.36),smooth=growth*growth*(3-2*growth)
      const length=(32+i%3*7),w=8.5+i%2*3,scale=Math.min(1,(destination.y-bounds.top-2)/(length+1),room(destination)/(w+1))
      p.crystal.position.copyFrom(destination);p.crystal.rotation=0;p.crystal.scale.set(scale*(.2+.8*smooth))
      if(age>=0&&time<p.shatter){
        p.crystal.poly([0,0,-w,-length*.54,0,-length,w,-length*.54]).fill({color:i%2?0xb4eaff:0x99d6ee,alpha:.66-smooth*.18})
          .stroke({width:.85,color:0xf3fdff,alpha:.94,join:'round'})
          .moveTo(0,0).lineTo(0,-length).moveTo(-w,-length*.54).lineTo(w,-length*.54).stroke({width:.55,color:0xffffff,alpha:.65})
        p.crystal.alpha=clamp(age/.045)*clamp((p.shatter-time)/.06)
      }
      if(time>=p.shatter)p.collision??={...destination}
      const broken=time-p.shatter,life=.41
      if(broken>=0&&broken<life){
        const size=Math.min(38,room(p.collision)-2)
        p.flash.position.copyFrom(p.collision)
        p.flash.circle(0,0,Math.max(1,size*(.15+.8*clamp(broken/.2)))).stroke({width:1.7,color:0xcaf3ff,alpha:(1-broken/life)**2*.78})
          .circle(0,0,Math.max(1,size*.12)).fill({color:0xf6feff,alpha:Math.exp(-broken*20)*.66})
      }
      p.shards.forEach((shard,j)=>{
        shard.alpha=0;if(broken<0||broken>=life)return
        const a=j*Math.PI*2/7,speed=65+j%3*18,point=keep({x:p.collision.x+Math.cos(a)*speed*broken,
          y:p.collision.y+Math.sin(a)*speed*broken*.65+135*broken*broken},6)
        shard.position.copyFrom(point);shard.rotation=a+broken*(j%2?3:-3)
        shard.alpha=.82*clamp(broken/.025)*(1-broken/life)**.8
      })
    }
  })
}
