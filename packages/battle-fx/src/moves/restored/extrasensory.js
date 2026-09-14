import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function extrasensory(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const attachment=context.source.hasAnchor?.('eyes')?'eyes':'emission'
  const root=make('extrasensory-root'),trail=make('extrasensory-refraction'),tip=make('extrasensory-tip'),impact=make('extrasensory-impact'),pressure=make('extrasensory-pressure')
  const glints=Array.from({length:16},(_,i)=>({g:make(`extrasensory-glint-${i}`),phase:i*Math.PI/8}))
  let struck=false
  function update(time){
    const a=socket(attachment,true),b=targetSocket('center',true),dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy,dx),nx=-Math.sin(angle),ny=Math.cos(angle)
    root.clear();fit(root,a,45);root.alpha=time>=.04&&time<1.21?Math.min(1,(time-.04)/.2,(1.21-time)/.22):0
    const opening=9+clamp(time/.42)*9
    root.moveTo(-30,0).quadraticCurveTo(0,-opening,30,0).quadraticCurveTo(0,opening,-30,0).stroke({color:0xf1c48d,width:2,alpha:.86})
      .ellipse(0,0,5,12).fill({color:0xe6a8c8,alpha:.79}).circle(0,0,2.2).fill(0xffead9)
    for(const side of[-1,1])root.moveTo(side*34,-6).lineTo(side*39,0).lineTo(side*34,6).stroke({color:0xd5a6d1,width:1.3,alpha:.65})
    const u=clamp((time-.42)/.62),at=v=>({x:a.x+dx*v,y:a.y+dy*v}),front=at(u)
    tip.clear();fit(tip,front,46);tip.rotation=angle;tip.alpha=time>=.42&&time<1.24?Math.min(1,.92+(time-.42),(1.24-time)/.2):0
    tip.moveTo(0,0).quadraticCurveTo(-13,-28,-28,-21).quadraticCurveTo(-40,0,-28,21).quadraticCurveTo(-13,28,0,0)
      .fill({color:0xeab0c3,alpha:.13}).stroke({color:0xf0cf9f,width:1.7,alpha:.86})
      .moveTo(-7,0).quadraticCurveTo(-23,-16,-32,0).quadraticCurveTo(-23,16,-7,0).stroke({color:0xe5aed5,width:1.5,alpha:.76})
      .ellipse(-1,0,1,2).fill(0xffe9c6)
    trail.clear();trail.alpha=time>=.42&&time<1.42?Math.min(1,(time-.42)/.09,(1.42-time)/.29)*.67:0
    for(let j=0;j<7;j++){
      const v=Math.max(0,u-j*.069),p=at(v),r=Math.min(23,room(p)*.6)*(1-j/10),spin=time*2.3+j
      const x=nx*r,y=ny*r,ax=Math.cos(angle)*4,ay=Math.sin(angle)*4
      trail.moveTo(p.x-x,p.y-y).quadraticCurveTo(p.x+ax,p.y+ay,p.x+x,p.y+y).stroke({color:j%2?0xeac29b:0xd3a6d1,width:1.5,alpha:.7-j*.065})
      trail.circle(p.x+nx*Math.sin(spin)*r,p.y+ny*Math.sin(spin)*r,1.1).fill({color:0xffdfba,alpha:.6})
    }
    const age=time-1.04,fade=struck&&age>=0?1-clamp((time-1.81)/.46):0
    impact.clear();fit(impact,b,78);impact.alpha=age>=0&&struck?Math.max(0,1-age/.48):0
    for(const side of[-1,1]){
      const x=side*(34-clamp(age/.26)*26)
      impact.moveTo(x,-39).quadraticCurveTo(x-side*28,0,x,39).stroke({color:side>0?0xf9dbad:0xf4c5e0,width:3.5,alpha:.8})
    }
    pressure.clear();fit(pressure,b,98);pressure.alpha=fade*.8
    for(let j=0;j<7;j++){
      const y=(j-3)*18,phase=age*5+j*.9,pinch=.22+.15*Math.sin(phase)
      for(let k=0;k<=32;k++){
        const u=k/32,x=(u-.5)*142,w=Math.sin(u*Math.PI),py=y*(1-w*pinch)+Math.sin(u*Math.PI*2+phase)*w*6
        k?pressure.lineTo(x,py):pressure.moveTo(x,py)
      }
      pressure.stroke({color:j%2?0xd1a1cc:0xe8bf93,width:j===3?2:1.2,alpha:j===3?.63:.36})
    }
    for(const glint of glints){
      const theta=glint.phase+age*.95,reach=Math.min(70,room(b)*.78),p={x:b.x+Math.cos(theta)*reach*(.7+Math.sin(age*3)*.08),y:b.y+Math.sin(theta)*reach*.76}
      const g=glint.g;g.clear();fit(g,p,7);g.rotation=theta;g.alpha=fade*(.29+.27*Math.sin(age*4+glint.phase)**2)
      g.poly([0,-5,2,0,0,5,-2,0]).fill(glint.phase<Math.PI?0xf2cda1:0xe5bbdc)
    }
  }
  onFrame(update)
  tl.call(()=>{struck=true;update(1.04);onCue({type:'impact'})},[],1.04).to({},{duration:2.35},0)
}
