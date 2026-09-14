import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function transform(context) {
  const { tl, random, onFrame, onCue }=context
  const { temporary, socket, targetSocket, unit }=bindEffectSpace(context)
  const e=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x],left=Math.min(...e),right=Math.max(...e),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g},fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('transform-root'),scan=make('transform-scan-tip'),scanField=make('transform-scan-field')
  const copy=new Container();copy.label='transform-copy';copy.alpha=0;temporary.addChild(copy)
  // Snapshot display objects are owned here; their shared textures remain owned by the host.
  const image=context.target.snapshot?.()
  let copyWidth,copyHeight
  if(image){
    image.label='transform-supplied-silhouette';image.position.set(0,0);image.rotation=0;image.scale.set(1)
    const b=image.getLocalBounds();image.pivot.set(b.x+b.width/2,b.y+b.height/2)
    image.scale.set((temporary.scale.x<0?-1:1)/unit,1/unit);image.tint=0xc9a5e6
    copyWidth=Math.max(1,b.width/unit);copyHeight=Math.max(1,b.height/unit);copy.addChild(image)
  }else{
    copyWidth=Math.min(138,context.target.metrics.width/unit);copyHeight=Math.min(160,context.target.metrics.height/unit)
    const w=copyWidth*.45,h=copyHeight*.46,outline=new Graphics();outline.label='transform-outline'
    outline.moveTo(-w*.65,h).quadraticCurveTo(-w*1.08,h*.25,-w*.73,-h*.11)
      .quadraticCurveTo(-w*.84,-h*.57,-w*.32,-h*.74).quadraticCurveTo(0,-h*1.03,w*.33,-h*.74)
      .quadraticCurveTo(w*.86,-h*.55,w*.72,-h*.09).quadraticCurveTo(w*1.07,h*.34,w*.66,h)
      .quadraticCurveTo(0,h*.74,-w*.65,h).stroke({color:0xdbc0ed,width:2.2,alpha:.8})
    copy.addChild(outline)
  }
  const copyRadius=Math.hypot(copyWidth,copyHeight)/2+4
  const copyScale=Math.min(1.05,context.source.metrics.width/unit*1.15/copyWidth,context.source.metrics.height/unit*1.15/copyHeight)
  const tip=make('transform-tip'),imprint=make('transform-imprint'),impact=make('transform-impact')
  const motes=Array.from({length:20},(_,i)=>({g:make(`transform-mote-${i}`),angle:i*Math.PI/10,start:1.40+i%4*.12,life:.71+random()*.13,size:2.5+random()*2.5}))
  let struck=false
  function update(time){
    const a=socket('emission',true),b=targetSocket('center',true),sourceCenter=socket('center',true),sourceVisual=socket('visualCenter',true),targetVisual=targetSocket('visualCenter',true)
    root.clear();fit(root,a,38);root.alpha=time>.025&&time<1.58?Math.min(1,(time-.025)/.16,(1.58-time)/.32)*.8:0
    for(let j=0;j<3;j++){const t=time*3.5+j*Math.PI*2/3;root.arc(0,0,14+j*5,t,t+1.1).stroke({color:j===1?0xecdbfa:0xb995d9,width:2,alpha:.7})}
    const outbound=clamp((time-.24)/.48),q={x:a.x+(b.x-a.x)*outbound,y:a.y+(b.y-a.y)*outbound}
    scan.clear();fit(scan,q,30);scan.rotation=Math.atan2(b.y-a.y,b.x-a.x);scan.alpha=time>=.24&&time<.85?Math.min(1,(.85-time)/.13):0
    scan.poly([0,0,-14,-12,-24,0,-14,12]).stroke({color:0xd5bbef,width:1.6}).circle(-13,0,4).fill({color:0xf4e2ff,alpha:.7})
    scanField.clear();fit(scanField,b,103);scanField.alpha=time>=.48&&time<1.20?Math.min(1,(time-.48)/.16,(1.20-time)/.32)*.73:0
    const band=Math.sin((time-.48)*5)*38
    for(const side of [-1,1])scanField.moveTo(side*45,-43).lineTo(side*56,-43).lineTo(side*56,43).lineTo(side*45,43).stroke({color:0xceace6,width:1.3,alpha:.62})
    scanField.moveTo(-46,band).lineTo(46,band).stroke({color:0xf3dfff,width:1.5,alpha:.85})
    const u=clamp((time-.78)/.58),p={x:b.x+(sourceCenter.x-b.x)*u,y:b.y+(sourceCenter.y-b.y)*u}
    tip.clear();fit(tip,p,32);tip.rotation=Math.atan2(sourceCenter.y-b.y,sourceCenter.x-b.x)
    tip.alpha=time>=.78&&time<1.59?Math.min(1,(1.59-time)/.23):0
    tip.poly([0,0,-12,-9,-25,0,-12,9]).fill({color:0xd9b3ed,alpha:.63}).stroke({color:0xf7e9ff,width:1.5})
      .poly([-3,0,-12,-4,-20,0,-12,4]).fill({color:0xfff6ff,alpha:.8})
    const center={x:targetVisual.x+(sourceVisual.x-targetVisual.x)*u,y:targetVisual.y+(sourceVisual.y-targetVisual.y)*u}
    copy.position.copyFrom(center);copy.scale.set(Math.min(copyScale,room(center)/copyRadius))
    copy.alpha=time>=.58&&time<2.47?Math.min(1,(time-.58)/.22,(2.47-time)/.58)*(.30+.04*Math.sin(time*8)):0
    imprint.clear();fit(imprint,sourceCenter,106)
    const age=time-1.36,v=clamp(age/.44),fade=clamp((time-1.96)/.52)
    imprint.alpha=struck&&age>=0&&time<2.48?(1-fade)*.8:0
    for(let j=0;j<3;j++){const y=-36+j*36+Math.sin(time*6+j)*4,w=(25+j*7)*(1+v*.35);imprint.ellipse(0,y,w,7).stroke({color:j===1?0xf0d6fa:0xc3a2dd,width:1.4,alpha:.5})}
    impact.clear();fit(impact,sourceCenter,78);impact.alpha=struck&&age>=0&&age<.56?1-age/.56:0
    impact.ellipse(0,0,18+v*24,28+v*30).stroke({color:0xf0d8ff,width:2,alpha:.65})
    for(let j=0;j<6;j++){const t=j*Math.PI/3,r=10+v*42;impact.circle(Math.cos(t)*r,Math.sin(t)*r,2.5).fill({color:0xfbedff,alpha:1-v})}
    for(const f of motes){
      const age=time-f.start,u=clamp(age/f.life),d=Math.min(65,room(sourceCenter)*.68),p={x:sourceCenter.x+Math.cos(f.angle+u*.7)*d*(.3+.7*u),y:sourceCenter.y+Math.sin(f.angle+u*.7)*d*(.3+.7*u)},g=f.g,r=f.size
      g.clear();fit(g,p,r*2);g.rotation=f.angle+u*3;g.alpha=struck&&age>=0&&age<f.life?Math.min(1,age/.06,(f.life-age)/.3)*.7:0
      g.poly([0,-r,r*.62,0,0,r,-r*.62,0]).fill({color:0xe9cdf6,alpha:.78})
    }
  }
  onFrame(update);tl.call(()=>{struck=true;update(1.36);onCue({type:'impact'})},[],1.36).to({},{duration:2.60},0)
}
