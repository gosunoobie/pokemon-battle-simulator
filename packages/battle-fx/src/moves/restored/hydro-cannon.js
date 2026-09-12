import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function hydroCannon(context) {
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

  const charge=make('hydro-cannon-charge'),trail=make('hydro-cannon-tail'),shot=make('hydro-cannon-tip'),crash=make('hydro-cannon-impact')
  const intake=make('hydro-cannon-intake'),wake=make('hydro-cannon-wake'),wash=make('hydro-cannon-wash')
  const r=Math.min(42,Math.max(34,context.source.metrics.height/unit*.2))
  const drops=Array.from({length:26},(_,i)=>({g:make(`hydro-cannon-drop-${i}`),angle:-Math.PI*.75+random()*Math.PI*1.5,reach:35+random()*40,life:.5+random()*.2}))
  let launch,impact
  const point=time=>{const a=launch??socket('emission',true),b=impact??targetSocket('center',true),u=clamp((time-.82)/.34)**1.8;return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}}
  function update(time){
    const a=socket('emission',true),b=impact??targetSocket('center',true),p=point(time),angle=Math.atan2(b.y-a.y,b.x-a.x),build=clamp((time-.08)/.7)
    // The chamber fills first; rotating sheets then collapse into the shot.
    charge.clear();fit(charge,a,r*1.9);charge.rotation=angle;charge.alpha=show(time,.08,.9,.08)
    const radius=r*(.24+.7*build),pressure=1+.035*Math.sin(time*45)*build
    charge.circle(0,0,radius*pressure).fill(0x086aab)
      .ellipse(-radius*.08,-radius*.08,radius*.81,radius*.85).fill(0x24bcdf)
      .ellipse(radius*.13,-radius*.14,radius*.48,radius*.57).fill(0xa1f5ff)
      .ellipse(radius*.25,-radius*.22,radius*.19,radius*.29).fill(0xf2ffff)
    for(let j=0;j<4;j++){
      const q=(time*1.8+j*.25)%1,rad=r*(1.65-q*.72),spin=time*4+j*Math.PI/2
      for(let k=0;k<14;k++){
        const t=spin+k*.13,z=spin+(k+1)*.13
        charge.moveTo(Math.cos(t)*rad,Math.sin(t)*rad*.56)
          .lineTo(Math.cos(z)*rad,Math.sin(z)*rad*.56)
          .stroke({color:j%2?0xdbffff:0x6ae7ff,width:2.5,alpha:(1-q)*.8})
      }
    }
    intake.clear();fit(intake,a,r*2.1);intake.alpha=show(time,.12,.84,.1)
    for(let j=0;j<12;j++){
      const q=(time*1.7+j/12)%1,t=j*Math.PI/6+time*2,rad=r*(1.9-q*1.3)
      intake.ellipse(Math.cos(t)*rad,Math.sin(t)*rad,1.8+q,3.5-q).fill({color:0xa2f2ff,alpha:Math.sin(q*Math.PI)*.9})
    }
    // The rounded pressure cap stays at local zero, including the contact frame.
    shot.clear();fit(shot,p,r*2.9);shot.rotation=angle;shot.alpha=show(time,.82,1.23,.07)
    shot.moveTo(0,0).bezierCurveTo(0,-r*.95,-r*1.4,-r*1.12,-r*2.65,0)
      .bezierCurveTo(-r*1.4,r*1.12,0,r*.95,0,0).fill(0x09649c)
      .moveTo(-r*.03,0).bezierCurveTo(-r*.04,-r*.78,-r*1.2,-r*.86,-r*2.25,0)
      .bezierCurveTo(-r*1.1,r*.8,-r*.04,r*.78,-r*.03,0).fill(0x25c0e2)
      .moveTo(-r*.09,0).bezierCurveTo(-r*.1,-r*.52,-r*.8,-r*.67,-r*1.85,0)
      .bezierCurveTo(-r*.65,r*.47,-r*.1,r*.52,-r*.09,0).fill(0xabf7ff)
      .moveTo(-r*.18,0).quadraticCurveTo(-r*.5,-r*.36,-r*1.3,-r*.04)
      .quadraticCurveTo(-r*.5,r*.18,-r*.18,0).fill(0xf3ffff)
    for(let j=0;j<6;j++){
      const q=(time*4+j/6)%1,x=-r*(.2+q*2.1),span=r*Math.sin(q*Math.PI)*.65
      shot.moveTo(x-r*.16,-span).quadraticCurveTo(Math.min(-1,x+r*.3),0,x-r*.16,span)
        .stroke({color:j%2?0xe9ffff:0x67e8ff,width:2.2,alpha:.7*(1-q),cap:'round'})
    }
    trail.clear();trail.alpha=show(time,.82,1.32,.2)
    for(let j=0;j<5;j++){const q=point(Math.max(.82,time-j*.02)),z=point(Math.max(.82,time-(j+1)*.02)),w=Math.min(r*(.8-j*.12),room(q),room(z));trail.moveTo(q.x,q.y).lineTo(z.x,z.y).stroke({color:j%2?0x8aebf5:0x2ebada,width:w,alpha:.6-j*.08,cap:'round'})}
    wake.clear();fit(wake,a,r*2.3);wake.rotation=angle;wake.alpha=show(time,.82,1.2,.28)
    const release=clamp((time-.82)/.38)
    for(let j=0;j<2;j++){
      const radius=r*(.6+release*1.35+j*.18)
      wake.ellipse(-r*release*.4,0,radius*.32,radius).stroke({color:0xc3faff,width:3*(1-release)+.5,alpha:(1-release)*.7})
    }
    const age=time-1.16,u=clamp(age/.88);crash.clear();crash.alpha=impact&&age>=0&&age<.88?1-u:0
    if(impact){
      fit(crash,impact,r*2.8);crash.rotation=angle
      crash.ellipse(r*.08,0,r*(.3+u*.5),r*(.6+u*.9)).fill({color:0xdfffff,alpha:(1-u)*.72})
      for(let j=0;j<4;j++){
        const q=clamp((age-j*.055)/.57),span=r*(.35+q*1.9)
        crash.moveTo(-r*.55*q,-span).quadraticCurveTo(r*(.95+q*.15),0,-r*.55*q,span)
          .stroke({color:j%2?0xeaffff:0x55d8ef,width:11*(1-q)+1,alpha:1-q,cap:'round'})
      }
      for(let j=0;j<10;j++){
        const side=j%2?-1:1,q=clamp((age-(j%5)*.025)/.65),span=r*(.4+q*1.85),x=r*(.2+(j%5)*.16)
        crash.moveTo(-r*.2,side*r*.1).quadraticCurveTo(x+q*r*.3,side*span,-r*(.3+q*.6),side*span)
          .stroke({color:j%3?0xa6f5ff:0xffffff,width:4*(1-q)+.8,alpha:(1-q)*.8,cap:'round'})
      }
    }
    wash.clear();fit(wash,targetSocket('floor'),r*2.6);wash.alpha=show(time,1.3,2.18,.4)
    for(let j=0;j<3;j++){
      const q=clamp((time-1.3-j*.08)/.66)
      wash.ellipse(0,0,r*(.4+q*1.9),r*(.08+q*.32)).stroke({color:0x8ce7f9,width:2.4*(1-q)+.4,alpha:(1-q)*.65})
    }
    for(const d of drops){const q=clamp(age/d.life);d.g.clear();d.g.alpha=impact&&age>=0&&age<d.life?(1-q)*.9:0;if(impact){const distance=Math.min(d.reach,room(impact)/1.55),a=d.angle+angle,p={x:impact.x+Math.cos(a)*distance*q,y:impact.y+Math.sin(a)*distance*q+distance*.4*q*q};fit(d.g,p,5);d.g.rotation=a+Math.PI/2;d.g.ellipse(0,0,2,4.8).fill(0xc1f6ff)}}
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.32},0).to(attacker,{x:home.x+thrust,duration:.14,ease:'power2.in'},.65)
    .call(()=>{launch=socket('emission',true);update(.82)},[],.82)
    .call(()=>{impact=targetSocket('center',true);update(1.16);onCue({type:'impact'});defender.tint=0xc7f8ff},[],1.16)
    .to(defender,{x:defenderHome.x+recoil,duration:.07,repeat:5,yoyo:true},1.16).call(()=>{defender.tint=0xffffff},[],1.56)
    .to(attacker,{x:home.x,duration:.4},1.65)

}
