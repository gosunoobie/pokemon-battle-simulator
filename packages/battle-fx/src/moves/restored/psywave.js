import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function psywave(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g,p,r) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/r)) }
  const root=make('psywave-root'),sheets=make('psywave-wave-sheets'),tip=make('psywave-tip'),impact=make('psywave-impact')
  const motes=Array.from({length:19},(_,i)=>({g:make(`psywave-mote-${i}`),phase:i*Math.PI*2/19,size:2+random()*2}))
  let struck=false
  function update(time) {
    const a=socket('emission',true),b=targetSocket('center',true),dx=b.x-a.x,dy=b.y-a.y,length=Math.max(1,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length
    const u=clamp((time-.3)/.6),tail=clamp((time-1.04)/.36)
    root.clear();fit(root,a,39);root.alpha=time>=.035&&time<1.23?Math.min(1,(time-.035)/.15,(1.23-time)/.25):0
    for(let lane=0;lane<3;lane++){
      for(let j=0;j<=26;j++){const x=-25+j*50/26,y=Math.sin(x*.11-time*7+lane*1.6)*(7+lane*4);j?root.lineTo(x,y):root.moveTo(x,y)}
      root.stroke({color:lane===1?0xe5dafc:0x998bd0,width:lane===1?1.9:1.3,alpha:.66})
    }
    const path=(v,lane)=>{
      const p={x:a.x+dx*v,y:a.y+dy*v},amplitude=Math.min(42,length*.12,room(p)*.62)
      const wave=Math.sin(v*Math.PI)*Math.sin(v*Math.PI*5-time*8+lane*1.9)*amplitude
      return{x:p.x+nx*wave,y:p.y+ny*wave}
    }
    sheets.clear();sheets.alpha=time>=.3&&time<1.52?Math.min(1,(time-.3)/.08,(1.52-time)/.23):0
    if(u>tail)for(let lane=0;lane<3;lane++){
      const upper=[],lower=[]
      for(let j=0;j<=58;j++){
        const v=tail+(u-tail)*j/58,p=path(v,lane),width=Math.min(4.5+lane,room(p)*.23)*Math.sin(j/58*Math.PI)
        upper.push(p.x+nx*width,p.y+ny*width);lower.unshift(p.x-nx*width,p.y-ny*width)
      }
      sheets.poly([...upper,...lower]).fill({color:lane===1?0xc9b5f1:0x786db6,alpha:lane===1?.24:.14})
      for(let j=0;j<=58;j++){const p=path(tail+(u-tail)*j/58,lane);j?sheets.lineTo(p.x,p.y):sheets.moveTo(p.x,p.y)}
      sheets.stroke({color:lane===1?0xded1ff:0xa896dc,width:lane===1?2:1.5,alpha:.74,cap:'round'})
    }
    const front={x:a.x+dx*u,y:a.y+dy*u};tip.clear();fit(tip,front,34);tip.rotation=Math.atan2(dy,dx)
    tip.alpha=time>=.3&&time<1.17?Math.min(1,.93+(time-.3),(1.17-time)/.27):0
    tip.moveTo(0,0).quadraticCurveTo(-19,-25,-25,-16).quadraticCurveTo(-11,-9,-10,0)
      .quadraticCurveTo(-11,9,-25,16).quadraticCurveTo(-19,25,0,0).fill({color:0xb9a5eb,alpha:.55})
      .moveTo(0,0).quadraticCurveTo(-14,-19,-21,-17).moveTo(0,0).quadraticCurveTo(-14,19,-21,17)
      .stroke({color:0xe7dfff,width:2.1,alpha:.9})
    const age=time-.9,fade=struck&&age>=0?1-clamp((age-.46)/.69):0
    impact.clear();fit(impact,b,91);impact.alpha=fade
    for(let j=0;j<4;j++){
      const phase=(Math.max(0,age)*.78+j/4)%1,r=20+phase*49
      for(let k=0;k<=40;k++){const q=k*Math.PI*2/40,w=1+Math.sin(q*3-time*6)*.1,x=Math.cos(q)*r*w,y=Math.sin(q)*r*.74;k?impact.lineTo(x,y):impact.moveTo(x,y)}
      impact.closePath().stroke({color:j%2?0xb19bdd:0xd7c7f6,width:1.9-phase,alpha:(1-phase)*.59})
    }
    for(const mote of motes){
      const phase=mote.phase+age*1.4,reach=Math.min(66,room(b)*.77),p={x:b.x+Math.cos(phase)*reach*(.39+.35*Math.sin(age*2+mote.phase)**2),y:b.y+Math.sin(phase)*reach*.7}
      const g=mote.g,r=mote.size;g.clear();fit(g,p,r*2);g.rotation=phase
      g.alpha=fade*(.25+.38*Math.sin(age*4+mote.phase)**2)
      g.moveTo(-r,0).quadraticCurveTo(0,-r,r,0).quadraticCurveTo(0,r,-r,0).fill(0xc1b0e8)
    }
  }
  onFrame(update)
  tl.call(()=>{struck=true;update(.9);onCue({type:'impact'})},[],.9).to({},{duration:2.15},0)
}
