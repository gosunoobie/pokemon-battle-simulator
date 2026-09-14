import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function psychoBoost(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('psycho-boost-root'),bands=make('psycho-boost-charge-bands'),wake=make('psycho-boost-flare-wake'),tip=make('psycho-boost-tip'),impact=make('psycho-boost-impact')
  const fragments=Array.from({length:28},(_,i)=>({g:make(`psycho-boost-fragment-${i}`),phase:i*Math.PI/14,start:1.34+i%4*.08,life:.75+random()*.21,r:3+random()*3,reach:44+random()*34}))
  let struck=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy,dx),nx=-Math.sin(angle),ny=Math.cos(angle)
    const charge=clamp((time-.04)/.92),release=clamp((time-.96)/.34),late=clamp((time-1.17)/.22)
    root.clear();fit(root,a,82);root.alpha=time>=.04&&time<1.31?Math.min(1,(time-.04)/.18,(1.31-time)/.23):0
    const r=12+charge*23,pulse=1+Math.sin(time*18)*.035
    for(let j=0;j<8;j++){
      const theta=j*Math.PI/4+time*.37,far=r*(1.1+.42*Math.sin(charge*Math.PI)),x=Math.cos(theta)*far,y=Math.sin(theta)*far
      root.poly([0,0,x-Math.sin(theta)*6,y+Math.cos(theta)*6,Math.cos(theta)*(far+12),Math.sin(theta)*(far+12),x+Math.sin(theta)*6,y-Math.cos(theta)*6]).fill({color:j%2?0xc263b9:0x9253b1,alpha:.31})
    }
    root.circle(0,0,r*pulse).fill({color:0xcb65be,alpha:.13}).stroke({color:0xeab4ed,width:2,alpha:.81})
      .poly([0,-r*.76,r*.52,-r*.19,r*.63,r*.45,0,r*.72,-r*.64,r*.4,-r*.51,-r*.25]).fill({color:0xf1c3f0,alpha:.27})
      .circle(0,0,5+charge*7).fill({color:0xffdef9,alpha:.76})
    bands.clear();fit(bands,a,93);bands.alpha=root.alpha
    for(let j=0;j<4;j++){
      const phase=(time*.85+j/4)%1,rad=27+(1-phase)*54,rotation=j*Math.PI/4-time*.6
      for(let k=0;k<=28;k++){
        const q=k*Math.PI*2/28,x=Math.cos(q)*rad,y=Math.sin(q)*rad*.3,px=x*Math.cos(rotation)-y*Math.sin(rotation),py=x*Math.sin(rotation)+y*Math.cos(rotation)
        k?bands.lineTo(px,py):bands.moveTo(px,py)
      }
      bands.closePath().stroke({color:j%2?0xd69ce9:0xf0b8da,width:1.2+phase,alpha:phase*.52})
    }
    const p={x:a.x+dx*release,y:a.y+dy*release};tip.clear();fit(tip,p,70);tip.rotation=angle
    tip.alpha=time>=.96&&time<1.49?Math.min(1,.95+(time-.96),(1.49-time)/.19):0
    tip.poly([0,0,-19,-22,-37,-14,-59,-22,-47,0,-59,22,-37,14,-19,22]).fill({color:0xac4eab,alpha:.76})
      .poly([0,0,-21,-12,-44,0,-21,12]).fill({color:0xedb3ed,alpha:.98})
      .poly([0,0,-20,-4,-35,0,-20,4]).fill(0xffe1fb)
    wake.clear();wake.alpha=time>=.96&&time<1.61?Math.min(1,(time-.96)/.045,(1.61-time)/.2):0
    if(release>late)for(let lane=0;lane<4;lane++){
      const upper=[],lower=[]
      for(let j=0;j<=38;j++){
        const u=late+(release-late)*j/38,at={x:a.x+dx*u,y:a.y+dy*u},envelope=Math.sin(j/38*Math.PI),r=Math.min(19,room(at)*.47)*envelope,off=Math.sin(u*15-time*12+lane*Math.PI/2)*r
        const thick=r*.17;upper.push(at.x+nx*(off+thick),at.y+ny*(off+thick));lower.unshift(at.x+nx*(off-thick),at.y+ny*(off-thick))
      }
      wake.poly([...upper,...lower]).fill({color:lane%2?0xdf96da:0xa975cf,alpha:.6})
    }
    const age=time-1.3,burst=clamp(age/.43),fade=struck&&age>=0?1-clamp((age-.38)/.71):0
    impact.clear();fit(impact,b,103);impact.alpha=fade
    for(let j=0;j<10;j++){
      const theta=j*Math.PI/5+age*.31,r=20+burst*54,inner=r*.25
      impact.poly([Math.cos(theta)*inner,Math.sin(theta)*inner,Math.cos(theta+.11)*r*.56,Math.sin(theta+.11)*r*.56,Math.cos(theta)*r,Math.sin(theta)*r,Math.cos(theta-.11)*r*.56,Math.sin(theta-.11)*r*.56])
        .fill({color:j%2?0xe4acec:0xb870cc,alpha:(1-burst)*.62+.08})
    }
    for(let j=0;j<3;j++){const r=19+(burst+j*.12)*43;impact.arc(0,0,r,age+j*2.1,age+j*2.1+1.2).stroke({color:0xf0caef,width:2.7-burst,alpha:(1-burst)*.72})}
    for(const fragment of fragments){
      const age=time-fragment.start,u=clamp(age/fragment.life),d=Math.min(fragment.reach,room(b)*.7),theta=fragment.phase+u*.2,p={x:b.x+Math.cos(theta)*d*u,y:b.y+Math.sin(theta)*d*u+d*.17*u*u},g=fragment.g,r=fragment.r
      g.clear();fit(g,p,r*2);g.rotation=theta+age*2;g.alpha=struck&&age>=0&&age<fragment.life?Math.min(1,age/.05,(fragment.life-age)/.28)*.87:0
      g.poly([-r*.35,-r,r*.59,0,r*.25,r*1.2,-r*.64,0]).fill(fragment.phase<Math.PI?0xe2a4e0:0xba88d6)
        .moveTo(0,-r*.66).lineTo(0,r*.71).stroke({color:0xffddf6,width:.8,alpha:.87})
    }
  }
  onFrame(update)
  tl.call(()=>{struck=true;update(1.3);onCue({type:'impact'})},[],1.3).to({},{duration:2.65},0)
}
