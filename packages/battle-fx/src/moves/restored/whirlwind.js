import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function whirlwind(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, unit } = bindEffectSpace(context)
  const rx=Math.min(66,Math.max(30,context.target.metrics.width/unit*.34)),height=Math.min(164,Math.max(100,context.target.metrics.height/unit*.92))
  const targetCenter=context.target.base(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center'),sign=targetCenter.x<context.source.base('center').x?-1:1
  const pivot=context.target.base('origin'),metrics=context.target.metrics
  // Fit the rotated visible-art rectangle, including profiles whose pivot is off-center.
  const boundsAt=lean=>{
    const c=Math.cos(lean*sign),s=Math.sin(lean*sign),dx=targetCenter.x-pivot.x,dy=targetCenter.y-pivot.y
    const x=pivot.x+dx*c-dy*s,y=pivot.y+dx*s+dy*c
    const halfW=(Math.abs(c)*metrics.width+Math.abs(s)*metrics.height)/2,halfH=(Math.abs(s)*metrics.width+Math.abs(c)*metrics.height)/2
    return {left:x-halfW,right:x+halfW,top:y-halfH,bottom:y+halfH}
  }
  let lean=0,bounds=boundsAt(0)
  for(const candidate of [.1,.05,0]){
    const b=boundsAt(candidate)
    if(b.left>=0&&b.right<=context.scene.width&&b.top>=0&&b.bottom<=context.scene.height){lean=candidate;bounds=b;break}
  }
  const room=sign>0?context.scene.width-bounds.right:bounds.left
  const push=Math.max(0,Math.min(34,metrics.width/unit*.18,room/unit-8)),lift=Math.max(0,Math.min(22,metrics.height/unit*.12,bounds.top/unit-8))
  const funnel=new Container();funnel.label='whirlwind-funnel';funnel.alpha=0;temporary.addChild(funnel)
  const wind=new Graphics();funnel.addChild(wind)
  const debris=[]
  for(let i=0;i<16;i++){
    const g=new Graphics().moveTo(-3,0).quadraticCurveTo(0,-2,6,0).stroke({color:i%3?0xd5e9e9:0xd8d5b7,width:1.3,cap:'round'})
    funnel.addChild(g);debris.push({g,phase:i/16,offset:random()*6})
  }
  const clamp=u=>Math.max(0,Math.min(1,u))
  const update=time=>{
    const u=clamp((time-.22)/.62),grow=.35+.65*u,fade=1-clamp((time-1.2)/.55)
    const from=socket('emission',true),to=time>=.84?targetSocket('center',true):focus
    funnel.position.set(from.x+(to.x-from.x)*u,from.y+(to.y-from.y)*u-12*Math.sin(Math.PI*u))
    funnel.alpha=clamp((time-.22)/.14)*fade;wind.clear()
    if(funnel.alpha<=0)return
    for(let band=0;band<7;band++){
      const v=band/6,r=rx*(.23+.77*v)*grow,phase=time*11-band*.8
      for(let j=0;j<=28;j++){
        const a=phase+j/28*Math.PI*1.55,x=Math.cos(a)*r,y=(.48-v)*height*grow+Math.sin(a)*r*.2
        if(j===0)wind.moveTo(x,y);else wind.lineTo(x,y)
      }
      wind.stroke({color:band%2?0xf1ffff:0xafced5,width:band%2?2.4:1.4,alpha:band%2?.85:.6,cap:'round'})
    }
    for(const p of debris){
      const v=(p.phase+time*.62)%1,a=time*11-v*5+p.offset,r=rx*(.23+.77*v)*grow
      p.g.position.set(Math.cos(a)*r,(.48-v)*height*grow+Math.sin(a)*r*.2);p.g.rotation=a+.5
      p.g.alpha=Math.sin(Math.PI*v)*.8
    }
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-5,rotation:-.03,duration:.18},0)
    .to(attacker,{x:home.x+6,rotation:.02,duration:.12},.18)
    .to(attacker,{x:home.x,rotation:0,duration:.48},.52)
    .call(()=>{update(.84);onCue({type:'impact'});defender.tint=0xd8ebe7},[],.84)
    .to(defender,{x:defenderHome.x+push,y:defenderHome.y-lift,rotation:lean,duration:.42,ease:'power2.out'},.86)
    .to(defender,{x:defenderHome.x,y:defenderHome.y,rotation:0,duration:.6,ease:'power2.inOut'},1.38)
    .call(()=>{defender.tint=0xffffff},[],1.09)
}
