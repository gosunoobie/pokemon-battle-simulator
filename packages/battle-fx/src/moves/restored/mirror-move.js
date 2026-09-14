import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function mirrorMove(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const e=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x],left=Math.min(...e),right=Math.max(...e),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g},fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('mirror-move-root'),tip=make('mirror-move-tip'),reflection=make('mirror-move-reflection'),impact=make('mirror-move-impact')
  const shards=Array.from({length:14},(_,i)=>({g:make(`mirror-move-shard-${i}`),angle:i*Math.PI/7,start:1.0+i%4*.06,life:.79+random()*.12,size:4+random()*4}))
  let struck=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy,dx)
    root.clear();fit(root,a,55);root.alpha=time>.025&&time<.78?Math.min(1,(time-.025)/.16,(.78-time)/.24):0
    const open=clamp(time/.32),w=8+open*23
    root.poly([0,-39,w,0,0,39,-w,0]).fill({color:0xafd4ec,alpha:.13}).stroke({color:0xcce5f1,width:2,alpha:.85})
      .poly([0,-29,w*.71,0,0,29,-w*.71,0]).stroke({color:0x6e97b8,width:1,alpha:.56})
    const glint=Math.sin(time*6)*20
    root.moveTo(-13,glint-7).lineTo(13,glint+7).stroke({color:0xffffff,width:2.5,alpha:.72})
    const u=clamp((time-.36)/.62),p={x:a.x+dx*u,y:a.y+dy*u};tip.clear();fit(tip,p,47);tip.rotation=angle
    tip.alpha=time>=.36&&time<1.21?Math.min(1,(1.21-time)/.23):0
    tip.poly([0,0,-20,-18,-40,0,-20,18]).fill({color:0xc4e5f5,alpha:.25}).stroke({color:0xe9f6ff,width:2})
      .poly([0,0,-20,-9,-33,0,-20,9]).fill({color:0xf8fdff,alpha:.6})
      .moveTo(-20,-17).lineTo(-20,17).stroke({color:0x709cbf,width:1,alpha:.8})
    reflection.clear();fit(reflection,b,106)
    const age=time-.98,v=clamp(age/.36),close=clamp((time-1.65)/.46)
    reflection.alpha=struck&&age>=0&&time<2.11?(1-close)*.9:0
    for(let j=0;j<2;j++){
      const side=j?1:-1,x=side*(13+v*31),width=15+Math.sin(time*3+j)*6
      reflection.poly([x,-57,x+side*width,-36,x+side*width,38,x,60]).fill({color:j?0xc7e5fa:0xa7c3df,alpha:.12})
        .stroke({color:0xcbe8f8,width:1.6,alpha:.7})
        .moveTo(x+side*3,-24+Math.sin(time*5+j)*12).lineTo(x+side*(width-3),-40+Math.sin(time*5+j)*12)
        .stroke({color:0xffffff,width:2,alpha:.68})
    }
    impact.clear();fit(impact,b,79);impact.alpha=struck&&age>=0&&age<.68?1-age/.68:0
    const r=16+clamp(age/.52)*39
    impact.poly([0,-r,r*.63,0,0,r,-r*.63,0]).stroke({color:0xf0fbff,width:2,alpha:.8})
      .moveTo(-13,0).lineTo(13,0).moveTo(0,-17).lineTo(0,17).stroke({color:0xffffff,width:2.5,alpha:1-clamp(age/.34)})
    for(const f of shards){
      const age=time-f.start,u=clamp(age/f.life),d=Math.min(66,room(b)*.7),p={x:b.x+Math.cos(f.angle)*d*(.3+u*.7),y:b.y+Math.sin(f.angle)*d*(.3+u*.7)-d*.12*u},g=f.g,r=f.size
      g.clear();fit(g,p,r*2);g.rotation=f.angle+u*2.8;g.alpha=struck&&age>=0&&age<f.life?Math.min(1,age/.06,(f.life-age)/.28)*.82:0
      g.poly([0,-r,r*.45,0,0,r,-r*.45,0]).fill({color:0xdbf2fc,alpha:.38}).stroke({color:0xecfbff,width:1,alpha:.85})
    }
  }
  onFrame(update);tl.call(()=>{struck=true;update(.98);onCue({type:'impact'})},[],.98).to({},{duration:2.15},0)
}
