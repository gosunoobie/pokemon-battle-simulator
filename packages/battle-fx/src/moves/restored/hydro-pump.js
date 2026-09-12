import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function hydroPump(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const sourceHalf = context.source.metrics.width / (2 * unit), targetHalf = context.target.metrics.width / (2 * unit)
  const back = Math.max(0, Math.min(8, center.x - sourceHalf - left))
  const thrust = Math.max(0, Math.min(5, right - center.x - sourceHalf))
  const recoil = Math.max(0, Math.min(11, right - receiver.x - targetHalf))
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const clamp = x => Math.max(0, Math.min(1, x))
  const show = (time, start, end, fade=.2) => time < start || time >= end ? 0 : Math.min(1, (time-start)/.06, (end-time)/fade)
  const make = label => { const g=new Graphics(); g.label=label; g.alpha=0; temporary.addChild(g); return g }
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/Math.max(1,extent))) }

  const jet=make('hydro-jet'),tip=make('hydro-pump-tip'),muzzle=make('hydro-pump-charge'),impact=make('hydro-impact'),wash=make('hydro-pump-wash')
  const r=Math.min(30,Math.max(22,context.source.metrics.height/unit*.13))
  const spray=Array.from({length:56},(_,i)=>({g:make(`hydro-pump-spray-${i}`),start:.72+Math.floor(i/7)*.15,angle:(i%7)/6*Math.PI*1.5+Math.PI*.25,reach:36+random()*39,life:.35+random()*.13,point:null,direction:0}))
  let restingCrash

  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy,dx),nx=-Math.sin(angle),ny=Math.cos(angle)
    const reach=clamp((time-.5)/.22)**1.6,tail=clamp((time-1.66)/.26),at=p=>({x:a.x+dx*p,y:a.y+dy*p}),head=at(reach)
    const radius=(p,q)=>Math.min(r*(.62+.38*p),room(q)*.77)
    jet.clear();jet.alpha=show(time,.5,1.99,.1)
    if(reach>tail){
      // A heavy water body contains two broad strands winding around its axis.
      for(const [scale,color]of [[1,0x075983],[.86,0x099fcd],[.62,0x39c9eb]]){
        const upper=[],lower=[]
        for(let j=0;j<=64;j++){
          const p=tail+(reach-tail)*j/64,q=at(p),w=radius(p,q)*scale*(1+.075*Math.sin(p*39-time*46))
          upper.push(q.x+nx*w,q.y+ny*w);lower.unshift(q.x-nx*w,q.y-ny*w)
        }
        jet.poly([...upper,...lower]).fill(color)
      }
      for(const [phase,color]of [[0,0x8af0fa],[Math.PI,0xd7ffff]]){
        const upper=[],lower=[]
        for(let j=0;j<=64;j++){
          const p=tail+(reach-tail)*j/64,q=at(p),wave=p*Math.PI*7-time*31+phase,body=radius(p,q)
          const offset=Math.sin(wave)*body*.49,w=body*(.14+.085*(1+Math.cos(wave)))*(.78+.22*p)
          upper.push(q.x+nx*(offset+w),q.y+ny*(offset+w));lower.unshift(q.x+nx*(offset-w),q.y+ny*(offset-w))
        }
        jet.poly([...upper,...lower]).fill({color,alpha:.84})
      }
      // Short-lived pressure collars and streaks move throughout the sustained jet.
      for(let i=0;i<8;i++){
        const p=(i/8+time*2.7)%1;if(p<=tail||p>=reach)continue
        const q=at(p),w=radius(p,q)*.88
        jet.moveTo(q.x+nx*w,q.y+ny*w).quadraticCurveTo(q.x+Math.cos(angle)*6,q.y+Math.sin(angle)*6,q.x-nx*w,q.y-ny*w)
          .stroke({color:0xe5ffff,width:Math.min(2.3,room(q)),alpha:.65})
      }
      for(let i=0;i<26;i++){
        const p=(i*.071+time*3.1)%1,end=Math.min(reach,p+.018+(i%3)*.018);if(p<tail||p>=reach)continue
        const q=at(p),z=at(end),offset=(i%7-3)*r*.2,envelope=Math.min(1,room(q)/(r+5),room(z)/(r+5))
        jet.moveTo(q.x+nx*offset*envelope,q.y+ny*offset*envelope).lineTo(z.x+nx*offset*envelope,z.y+ny*offset*envelope)
          .stroke({color:i%3?0xb3f3ff:0xffffff,width:Math.min(i%3?1.5:3,room(q),room(z)),alpha:.85,cap:'round'})
      }
    }
    tip.clear().ellipse(-r*.24,0,r*.24,r*.85).fill(0xd7fcff)
      .ellipse(-r*.2,0,r*.15,r*.54).fill(0xffffff)
    fit(tip,head,r*1.15);tip.rotation=angle;tip.alpha=jet.alpha

    muzzle.clear();fit(muzzle,a,r*1.55);muzzle.rotation=angle;muzzle.alpha=show(time,.1,1.82,.19)
    const build=clamp((time-.1)/.4)
    muzzle.ellipse(-r*.12,0,r*.24,r*(.16+.43*build)).fill({color:0xd6ffff,alpha:.8})
    for(let i=0;i<4;i++){
      const pulse=(time*3.7+i/4)%1,span=r*(.25+.43*build+.19*pulse)
      muzzle.ellipse(r*(pulse*.58-.34),0,r*(.15+.06*pulse),span)
        .stroke({color:i%2?0x58dff4:0xe6ffff,width:2.8-pulse,alpha:(1-pulse)*.8+.12})
    }

    const p=restingCrash??b;impact.clear();fit(impact,p,r*2.2);impact.rotation=angle;impact.alpha=show(time,.72,2.22,.34)
    impact.ellipse(-2,0,r*(.24+.035*Math.sin(time*43)),r*(.67+.06*Math.sin(time*37))).fill({color:0xe9ffff,alpha:.88})
    for(let j=0;j<10;j++){
      const q=(time*3.8+j*.103)%1,side=j%2?-1:1,span=r*(.75+.76*q),back=r*(.17+q*.81)
      impact.moveTo(2,side*r*.08).quadraticCurveTo(r*(.21+.1*Math.sin(time*17+j)),side*span,-back,side*span)
        .stroke({color:j%3?0x6be1f3:0xf0ffff,width:7*(1-q)+1,alpha:(1-q)*.88,cap:'round'})
      if(j%2===0)impact.ellipse(-back,side*span,1.7+q*1.8,1.7+q*.8).fill({color:0xdfffff,alpha:(1-q)*.8})
    }

    const floor=targetSocket('floor');wash.clear();fit(wash,floor,r*1.8);wash.alpha=show(time,.89,2.28,.35)
    for(let j=0;j<3;j++){
      const q=(time*1.9+j/3)%1
      wash.ellipse(0,0,r*(.5+q),r*(.12+q*.15)).stroke({color:0x9ce6f4,width:2*(1-q)+.4,alpha:(1-q)*.6})
    }
    for(const p of spray){
      const age=time-p.start,u=clamp(age/p.life);p.g.clear();p.g.alpha=p.point&&age>=0&&age<p.life?(1-u)*.9:0
      if(p.point){
        const d=Math.min(p.reach,room(p.point)/1.55),a=p.angle+p.direction,q={x:p.point.x+Math.cos(a)*d*u,y:p.point.y+Math.sin(a)*d*u+d*.42*u*u}
        fit(p.g,q,6);p.g.rotation=a+Math.PI/2
        p.g.ellipse(0,0,1.9+u,4.8*(1-u*.35)).fill(0x73daf4)
          .ellipse(-.3,-.7,.8+u*.3,2.4*(1-u*.3)).fill(0xe2ffff)
      }
    }
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.3,ease:'power2.out'},0).to(attacker,{x:home.x+thrust,duration:.17,ease:'power2.in'},.3)
    .call(()=>{update(.72);onCue({type:'impact'});defender.tint=0xc8f7ff},[],.72)
    .to(defender,{x:defenderHome.x+recoil,duration:.09,ease:'power2.out'},.72)
    .to(defender,{x:defenderHome.x+recoil*.7,duration:.1,repeat:5,yoyo:true,ease:'none'},.88)
    .call(()=>{defender.tint=0xffffff},[],1.13)
    .call(()=>{restingCrash=targetSocket('center',true)},[],1.93)
    .to(defender,{x:defenderHome.x,duration:.28},1.96)
    .to(attacker,{x:home.x,duration:.35,ease:'power2.inOut'},2.02)
  for(const p of spray)tl.call(()=>{p.point=targetSocket('center',true);const a=socket('emission',true);p.direction=Math.atan2(p.point.y-a.y,p.point.x-a.x);update(p.start)},[],p.start)
}
