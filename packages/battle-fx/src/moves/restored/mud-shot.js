import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function mudShot(context) {
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const e=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x],left=Math.min(...e),right=Math.max(...e),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g},fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('mud-shot-root'),tip=make('mud-shot-tip'),wake=make('mud-shot-speed'),impact=make('mud-shot-impact')
  const flecks=Array.from({length:24},(_,i)=>({g:make(`mud-shot-fleck-${i}`),a:i*Math.PI/12,start:.61+i%4*.055,life:.69+random()*.17,size:2+random()*2}))
  let struck=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy,dx),nx=-Math.sin(angle),ny=Math.cos(angle)
    root.clear();fit(root,a,25);root.rotation=angle;root.alpha=time>=.025&&time<.55?Math.min(1,(time-.025)/.1,(.55-time)/.16):0
    root.ellipse(-2,0,5,15).stroke({color:0xb8a07c,width:2,alpha:.73}).ellipse(-3,0,3,9).fill({color:0x8a6948,alpha:.63})
    const u=clamp((time-.24)/.36),p={x:a.x+dx*u,y:a.y+dy*u};tip.clear();fit(tip,p,46);tip.rotation=angle
    tip.alpha=time>=.24&&time<.82?Math.min(1,.96+u,(.82-time)/.22):0
    tip.ellipse(-20,0,20,16).fill(0x70533b).ellipse(-17,-2,15,12).fill(0x9b7750)
      .moveTo(-32,-5).quadraticCurveTo(-19,-17,-5,-6).stroke({color:0xc3a06b,width:2.2,alpha:.86})
    for(let j=0;j<3;j++){const theta=time*16+j*2.1;tip.ellipse(-20+Math.cos(theta)*10,Math.sin(theta)*9,3,1.8).fill({color:0x4d4032,alpha:.53})}
    wake.clear();wake.alpha=tip.alpha*.73
    for(let j=1;j<7;j++){
      const v=Math.max(0,u-j*.026),q={x:a.x+dx*v,y:a.y+dy*v},z={x:a.x+dx*Math.max(0,v-.025),y:a.y+dy*Math.max(0,v-.025)},off=(j%3-1)*Math.min(9,room(q)*.25)
      wake.moveTo(q.x+nx*off,q.y+ny*off).lineTo(z.x+nx*off,z.y+ny*off).stroke({color:j%2?0xb49160:0x746044,width:2.7-j*.26,alpha:1-j/8,cap:'round'})
    }
    const age=time-.6,v=clamp(age/.48);impact.clear();fit(impact,b,77);impact.alpha=struck&&age>=0&&age<.76?1-age/.76:0
    impact.ellipse(0,0,14+v*22,10+v*12).fill({color:0x92724c,alpha:.3})
    for(let j=0;j<9;j++){const theta=j*Math.PI*2/9,r=14+v*35;impact.moveTo(Math.cos(theta)*7,Math.sin(theta)*7).lineTo(Math.cos(theta)*r,Math.sin(theta)*r*.76).stroke({color:j%2?0xb49668:0x705b42,width:4-v*2,alpha:(1-v)*.7,cap:'round'})}
    for(const f of flecks){
      const age=time-f.start,u=clamp(age/f.life),d=Math.min(59,room(b)*.48),p={x:b.x+Math.cos(f.a)*d*u,y:b.y+Math.sin(f.a)*d*.38*u+d*u*u},g=f.g,r=f.size
      g.clear();fit(g,p,r*2);g.rotation=f.a+u*3;g.alpha=struck&&age>=0&&age<f.life?Math.min(1,age/.04,(f.life-age)/.23)*.85:0
      g.poly([-r,-r*.6,r*.61,-r,r,r*.4,-r*.3,r]).fill(f.a<Math.PI?0xa58556:0x776044)
    }
  }
  onFrame(update);tl.call(()=>{struck=true;update(.6);onCue({type:'impact'})},[],.6).to({},{duration:1.9},0)
}
