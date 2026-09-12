import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function spitUp(context) {
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

  const charge=make('spit-up-charge'),trail=make('spit-up-trail'),packet=make('spit-up-tip'),burst=make('spit-up-impact')
  const exhale=make('spit-up-exhale')
  const r=Math.min(23,Math.max(16,context.source.metrics.height/unit*.1))
  const pieces=Array.from({length:16},(_,i)=>({g:make(`spit-up-piece-${i}`),angle:Math.PI*2*i/16,reach:r*(1.4+random()),life:.4+random()*.2}))
  let launch,impact
  const point=time=>{const a=launch??socket('emission',true),b=impact??targetSocket('center',true),u=clamp((time-.54)/.36),arc=Math.min(12,room(a)*.3,room(b)*.3);return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u-Math.sin(u*Math.PI)*arc}}
  function update(time){
    const a=socket('emission',true),p=point(time),b=impact??targetSocket('center',true),angle=Math.atan2(b.y-a.y,b.x-a.x),q=clamp((time-.06)/.45)
    // One stockpiled sample gathers as soft, uneven lobes of warm energy.
    charge.clear();fit(charge,a,r*1.8);charge.rotation=angle;charge.alpha=show(time,.06,.6,.06)
    for(let j=0;j<5;j++){
      const t=j*Math.PI*.4+time*2.2,d=r*(1.25-q*.8),size=r*(.1+q*.1)
      charge.circle(Math.cos(t)*d,Math.sin(t)*d,size).fill({color:0xf8df9d,alpha:.35+q*.5})
        .circle(Math.cos(t)*d-size*.2,Math.sin(t)*d-size*.2,size*.42).fill(0xfff9df)
    }
    charge.ellipse(-r*.2,0,r*(.32+q*.16),r*(.24+q*.19)).fill(0xe6bf7b)
      .ellipse(-r*.12,-r*.04,r*(.2+q*.13),r*(.16+q*.12)).fill(0xfff4c9)
    for(let j=0;j<3;j++){
      const y=(j-1)*r*.5
      charge.moveTo(-r*1.3,y).quadraticCurveTo(-r*.8,y*(1-q),-r*.5,0).stroke({color:0xffedb5,width:2.2,alpha:q*.8})
    }
    // The front lobe touches at zero. Two smaller lobes tumble in its wake.
    packet.clear();fit(packet,p,r*2.5);packet.rotation=angle;packet.alpha=show(time,.54,.98,.08)
    const wobble=Math.sin((time-.54)*34)*.07
    packet.ellipse(-r*.56,0,r*.56,r*(.61+wobble)).fill(0xc9a86a)
      .ellipse(-r*.49,-r*.04,r*.48,r*(.49+wobble)).fill(0xffdf9e)
      .ellipse(-r*.39,-r*.1,r*.31,r*.3).fill(0xfff8d9)
    for(let j=0;j<2;j++){
      const x=-r*(1.13+j*.51),y=r*(j%2?-.22:.25)+Math.sin(time*24+j*2)*r*.08,rad=r*(.43-j*.09)
      packet.circle(x,y,rad).fill(j?0xe9c47e:0xf5d58e)
        .ellipse(x+rad*.15,y-rad*.18,rad*.7,rad*.64).fill(0xffedbd)
        .circle(x+rad*.2,y-rad*.27,rad*.24).fill(0xfffbed)
    }
    for(let j=0;j<5;j++){
      const u=(time*3+j/5)%1,x=-r*(.6+u*1.45),y=Math.sin(u*9+j)*r*.45
      packet.circle(x,y,1.1+(j%2)*.6).fill({color:0xba8b45,alpha:.55})
    }
    trail.clear();trail.alpha=show(time,.56,1.08,.22)
    for(let j=0;j<6;j++){
      const t=point(Math.max(.54,time-.02*(j+1))),phase=time*12+j*1.7
      const extent=Math.min(r*.25,room(t)*.65),x=t.x+Math.cos(phase)*extent*.65,y=t.y+Math.sin(phase)*extent*.65
      const radius=extent*(.65-j*.065)
      trail.circle(x,y,radius).fill({color:j%2?0xffe8b2:0xdfbd7d,alpha:.58-j*.065})
    }
    exhale.clear();fit(exhale,a,r*1.9);exhale.rotation=angle;exhale.alpha=show(time,.54,.91,.22)
    const breath=clamp((time-.54)/.37)
    for(let j=0;j<3;j++){
      const side=j-1,x=r*(.2+breath*.8),y=side*r*(.15+breath*.7)
      exhale.ellipse(x,y,r*(.1+breath*.17),r*(.12+breath*.11)).fill({color:0xffedc2,alpha:(1-breath)*.6})
    }
    const age=time-.9,u=clamp(age/.66);burst.clear();burst.alpha=impact&&age>=0&&age<.66?1-u:0
    if(impact){
      fit(burst,impact,r*2.5)
      for(let j=0;j<7;j++){
        const theta=j*Math.PI*2/7+Math.sin(j*3)*.22,d=r*(.28+u*(1.15+(j%3)*.15))
        const size=r*(.24+(j%3)*.065)*(1+u*.28),x=Math.cos(theta)*d,y=Math.sin(theta)*d+r*u*u*.24
        burst.ellipse(x,y,size,size*.78).fill({color:j%2?0xffeac0:0xe1c18b,alpha:.8})
          .ellipse(x-size*.15,y-size*.2,size*.54,size*.35).fill({color:0xfff9df,alpha:.65})
      }
      burst.circle(0,0,r*(.4+u*.34)).fill({color:0xfff6d2,alpha:(1-u)*.65})
      for(let j=0;j<5;j++){
        const theta=j*Math.PI*.4+.2,inner=r*(.55+u),outer=inner+r*.3*(1-u)
        burst.moveTo(Math.cos(theta)*inner,Math.sin(theta)*inner)
          .lineTo(Math.cos(theta)*outer,Math.sin(theta)*outer)
          .stroke({color:0xffe8aa,width:2.5*(1-u)+.4,alpha:1-u,cap:'round'})
      }
    }
    for(const d of pieces){const u=clamp(age/d.life);d.g.clear();d.g.alpha=impact&&age>=0&&age<d.life?1-u:0;if(impact){const distance=Math.min(d.reach,room(impact)/1.4),p={x:impact.x+Math.cos(d.angle)*distance*u,y:impact.y+Math.sin(d.angle)*distance*u+distance*.28*u*u};fit(d.g,p,4);d.g.rotation=d.angle+u*2;d.g.poly([-3,0,0,-1.5,3,0,0,1.5]).fill(0xf2d99d)}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back*.6,duration:.23},0).to(attacker,{x:home.x+thrust,duration:.15},.36)
    .call(()=>{launch=socket('emission',true);update(.54)},[],.54)
    .call(()=>{impact=targetSocket('center',true);update(.9);onCue({type:'impact'})},[],.9)
    .to(defender,{x:defenderHome.x+recoil*.7,duration:.07,repeat:3,yoyo:true},.9)
    .to(attacker,{x:home.x,duration:.3},1.17)

}
