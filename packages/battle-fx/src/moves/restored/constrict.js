import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function constrict(context){
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('constrict-root'),tip=make('constrict-tip'),impact=make('constrict-impact'),tension=make('constrict-tension')
  root.attachmentSocket='emission';tip.contactPoint={x:0,y:0}
  const flecks=Array.from({length:18},(_,i)=>({g:make(`constrict-fleck-${i}`),angle:i*Math.PI/9,spin:random()*2,start:.76+i*.01}))
  let squeezed=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),u=clamp((time-.28)/.48),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}
    root.clear();fit(root,a,31);root.alpha=time>.04&&time<.89?clamp((time-.04)/.12)*(1-clamp((time-.48)/.41)):0
    root.ellipse(0,0,15,7).stroke({color:0xbda3b2,width:5,alpha:.74}).ellipse(1,-7,12,5).stroke({color:0xe2c5d0,width:3,alpha:.64})
    tip.clear();fit(tip,p,66);tip.rotation=Math.atan2(b.y-a.y,b.x-a.x);tip.alpha=time>=.28&&time<1.07?1-clamp((time-.82)/.25):0
    for(const[w,color]of[[6,0x876b7b],[3.2,0xcab0bd]]){
      for(let j=0;j<=56;j++){const v=j/56,x=-v*43,y=Math.sin(v*Math.PI*6-time*5)*12*Math.sin(v*Math.PI);j?tip.lineTo(x,y):tip.moveTo(x,y)}
      tip.stroke({color,width:w,alpha:.87,cap:'round'})
    }
    const age=time-.76,pulse=Math.sin(clamp(age/.73)*Math.PI),radius=75-pulse*31,relax=clamp((age-.65)/.41)
    impact.clear();fit(impact,b,98);impact.alpha=squeezed&&age>=0&&age<1.06?1-clamp((age-.59)/.47):0
    // The close, stacked coils squeeze inward twice without scaling or obscuring the target sprite.
    for(let i=0;i<4;i++){
      const y=(i-1.5)*18,r=radius+i%2*5+relax*12,tilt=Math.sin(time*8+i)*3*pulse
      impact.ellipse(0,y+tilt,r,12+i%2*3).stroke({color:0x826776,width:5.8,alpha:.83})
        .ellipse(0,y-1+tilt,r,12+i%2*3).stroke({color:0xc5a5b5,width:3.3,alpha:.86})
    }
    tension.clear();fit(tension,b,110);tension.alpha=squeezed&&age>=0&&age<.65?Math.sin(clamp(age/.65)*Math.PI)*.8:0
    for(const side of[-1,1])for(const y of[-23,20])tension.moveTo(side*92,y-5).lineTo(side*74,y).lineTo(side*89,y+6).stroke({color:0xe8cbd6,width:2,alpha:.9,cap:'round'})
    flecks.forEach(f=>{const age=time-f.start,v=clamp(age/1.02),r=Math.min(91,room(b)*.74),at={x:b.x+Math.cos(f.angle+v*.2)*r*(.42+v*.35),y:b.y+Math.sin(f.angle)*r*.3+r*v*v*.4},g=f.g
      g.clear();fit(g,at,12);g.rotation=f.angle+v*f.spin;g.alpha=squeezed&&age>=0&&age<1.02?clamp(age/.11)*(1-clamp((v-.51)/.49))*.8:0
      g.moveTo(-4,-2).quadraticCurveTo(0,-5,4,2).stroke({color:0xd6b7c8,width:1.7,alpha:.8})})
  }
  onFrame(update)
  tl.call(()=>update(.28),[],.28).call(()=>{squeezed=true;update(.76);onCue({type:'impact'})},[],.76).to({}, {duration:1.95},0)
}
