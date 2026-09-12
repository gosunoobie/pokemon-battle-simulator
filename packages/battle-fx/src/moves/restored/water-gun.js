import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function waterGun(context) {
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

  const stream=make('water-gun-stream'), tip=make('water-gun-tip'), muzzle=make('water-gun-muzzle'), splash=make('water-gun-impact')
  const r=Math.min(8,Math.max(5.6,context.source.metrics.height/unit*.035))
  const beads=Array.from({length:12},(_,i)=>({g:make(`water-gun-bead-${i}`),start:.25+i*.039,side:i%2?-1:1,size:1.6+random()*1.1}))
  const drops=Array.from({length:20},(_,i)=>({g:make(`water-gun-drop-${i}`),start:.48+Math.floor(i/5)*.11,a:-Math.PI*.85+random()*Math.PI*1.7,speed:21+random()*25,point:null,direction:0}))

  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),reach=clamp((time-.24)/.24),tail=clamp((time-.72)/.2)
    const dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy,dx),nx=-Math.sin(angle),ny=Math.cos(angle)
    const at=p=>({x:a.x+dx*p,y:a.y+dy*p}),head=at(reach),active=show(time,.24,.95,.12)
    stream.clear();stream.alpha=active
    if(reach>tail){
      // Rolling bulges pinch into a fine connecting thread between water packets.
      for(const [scale,color]of [[1,0x237fac],[.69,0x62d9f1],[.24,0xe6ffff]]){
        const upper=[],lower=[]
        for(let j=0;j<=48;j++){
          const p=tail+(reach-tail)*j/48,q=at(p),pulse=.36+.64*((Math.sin(p*Math.PI*8-time*38)+1)/2)**2
          const w=Math.min(r*(.76+.24*p)*pulse*scale,room(q)*.76),ripple=Math.sin(p*35-time*44)*w*.12
          upper.push(q.x+nx*(w+ripple),q.y+ny*(w+ripple));lower.unshift(q.x+nx*(-w+ripple),q.y+ny*(-w+ripple))
        }
        stream.poly([...upper,...lower]).fill(color)
      }
      for(let j=0;j<8;j++){
        const p=(j/8+time*2.8)%1;if(p<tail||p>reach)continue
        const q=at(p),end=at(Math.min(reach,p+.018)),w=Math.min(2.1,room(q),room(end))
        if(w>0)stream.moveTo(q.x,q.y).lineTo(end.x,end.y).stroke({color:0xffffff,width:w,alpha:.9,cap:'round'})
      }
    }
    tip.clear().ellipse(-r*.6,0,r*.6,r*.75).fill(0xb6f5ff)
      .ellipse(-r*.39,-r*.15,r*.28,r*.22).fill(0xf3ffff)
    fit(tip,head,r*1.45);tip.rotation=angle;tip.alpha=active

    muzzle.clear();fit(muzzle,a,r*1.55);muzzle.rotation=angle;muzzle.alpha=show(time,.1,.81,.15)
    const pressure=.8+.17*Math.sin(time*38)
    muzzle.ellipse(-r*.14,0,r*.35,r*pressure).stroke({color:0xa9f3ff,width:1.5})
    muzzle.ellipse(0,0,r*.22,r*.4).fill({color:0xd8ffff,alpha:.75})

    // Detached beads give the small attack a wet silhouette without widening its jet.
    for(const bead of beads){
      const age=time-bead.start,u=clamp(age/.25),p=at(u),offset=bead.side*Math.sin(u*Math.PI)*r*1.8
      const q={x:p.x+nx*offset,y:p.y+ny*offset+4*u*u}
      bead.g.clear();fit(bead.g,q,bead.size*2);bead.g.rotation=angle;bead.g.alpha=age>0&&age<.25?Math.sin(u*Math.PI)*.9:0
      bead.g.ellipse(0,0,bead.size*1.6,bead.size*.75).fill(0x7de5fb)
        .ellipse(-bead.size*.3,-bead.size*.18,bead.size*.62,bead.size*.26).fill(0xecffff)
    }

    splash.clear();fit(splash,b,35);splash.rotation=angle;splash.alpha=show(time,.48,1.2,.36)
    const splashPulse=.7+.3*Math.sin(time*38)**2
    splash.ellipse(-2,0,3.2,8*splashPulse).fill({color:0xe6ffff,alpha:.85})
    for(let j=0;j<6;j++){
      const phase=(time*3.9+j/6)%1,side=j%2?-1:1
      splash.moveTo(1,side*2).quadraticCurveTo(-3,side*(11+phase*8),-10-phase*12,side*(13+phase*8))
        .stroke({color:j%2?0x7fdbf5:0xedffff,width:2.5*(1-phase)+.7,alpha:(1-phase)*.85,cap:'round'})
    }
    for(const p of drops){
      const age=time-p.start,u=clamp(age/.46);p.g.clear();p.g.alpha=p.point&&age>=0&&age<.46?(1-u)*.85:0
      if(p.point){
        const distance=Math.min(p.speed,room(p.point)/1.6),direction=p.a+p.direction
        const q={x:p.point.x+Math.cos(direction)*distance*u,y:p.point.y+Math.sin(direction)*distance*u+distance*.38*u*u}
        fit(p.g,q,4.5);p.g.rotation=direction+Math.PI/2;p.g.ellipse(0,0,1.7,3.5).fill(0x73dafa)
          .ellipse(-.3,-.7,.65,1.45).fill(0xebffff)
      }
    }
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back*.35,duration:.13},0).to(attacker,{x:home.x+thrust*.6,duration:.1},.13)
    .call(()=>{update(.48);onCue({type:'impact'})},[],.48)
    .to(defender,{x:defenderHome.x+recoil*.45,duration:.055,repeat:3,yoyo:true},.48)
    .to(attacker,{x:home.x,duration:.22},.99)
  for(const p of drops)tl.call(()=>{p.point=targetSocket('center',true);const a=socket('emission',true);p.direction=Math.atan2(p.point.y-a.y,p.point.x-a.x);update(p.start)},[],p.start)
}
