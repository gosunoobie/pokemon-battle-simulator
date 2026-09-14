import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function needleArm(context){
  const{tl,random,onFrame,onCue}=context
  const{temporary,attacker,defender,home,defenderHome,focus,socket,targetSocket,solveContact,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const center=socket(context.source.hasAnchor?.('visualCenter')?'visualCenter':'center'),w=context.source.metrics.width/unit,h=context.source.metrics.height/unit
  const attachment=context.source.hasAnchor?.('claw')?'claw':'hand',hand=socket(attachment)
  function fitPose(p){
    let rotation=p.rotation??0,c,s,rx,ry
    for(let i=0;i<14;i++){
      c=Math.cos(rotation);s=Math.sin(rotation);rx=(w*Math.abs(c)+h*Math.abs(s))/2;ry=(h*Math.abs(c)+w*Math.abs(s))/2
      if(rx*2<=right-left&&ry*2<=bottom-top)break;rotation*=.5
    }
    const x=p.x+center.x*c-center.y*s,y=p.y+center.x*s+center.y*c
    return{x:p.x+Math.max(left+rx,Math.min(right-rx,x))-x,y:p.y+Math.max(top+ry,Math.min(bottom-ry,y))-y,rotation}
  }
  const aim=Math.atan2(focus.y-hand.y,focus.x-hand.x),authoredLength=Math.min(87,Math.max(55,h*.34))
  const pose=fitPose(solveContact(attachment,.035,{x:focus.x-Math.cos(aim)*authoredLength,y:focus.y-Math.sin(aim)*authoredLength}))
  const c=Math.cos(pose.rotation),s=Math.sin(pose.rotation),strikeRoot={x:pose.x+hand.x*c-hand.y*s,y:pose.y+hand.x*s+hand.y*c}
  const length=Math.hypot(focus.x-strikeRoot.x,focus.y-strikeRoot.y),strikeAngle=Math.atan2(focus.y-strikeRoot.y,focus.x-strikeRoot.x)-pose.rotation
  const swing={angle:strikeAngle-.43},receiver=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center')
  const recoil=Math.max(0,Math.min(8,right-receiver.x-context.target.metrics.width/(2*unit)))
  const root=new Container();root.label='needle-arm-root';root.alpha=0;temporary.addChild(root)
  const arm=new Graphics();arm.label='needle-arm-tip';arm.attachmentSocket=attachment;root.addChild(arm)
  const impact=new Graphics();impact.label='needle-arm-impact';impact.alpha=0;temporary.addChild(impact)
  const spines=Array.from({length:20},(_,i)=>{const g=new Graphics();g.label=`needle-arm-spine-${i}`;g.alpha=0;temporary.addChild(g);return{g,angle:i*Math.PI/10+random()*.14,reach:28+random()*39,life:.48+random()*.22,size:6+random()*7}})
  let contact
  function rayRoom(p,theta){
    const x=Math.cos(theta),y=Math.sin(theta),limits=[]
    if(x>1e-6)limits.push((right-p.x-.5)/x);if(x< -1e-6)limits.push((left-p.x+.5)/x)
    if(y>1e-6)limits.push((bottom-p.y-.5)/y);if(y< -1e-6)limits.push((top-p.y+.5)/y)
    return Math.max(0,Math.min(...limits))
  }
  function update(time){
    const fitted=fitPose(attacker);attacker.position.copyFrom(fitted);attacker.rotation=fitted.rotation
    const from=socket(attachment,true),angle=swing.angle+attacker.rotation,cos=Math.cos(angle),sin=Math.sin(angle)
    const growth=clamp((time-.08)/.24),fold=clamp((time-1.01)/.36),reach=Math.min(length*(.64+growth*.36)*(1-fold*.28),rayRoom(from,angle))
    root.position.copyFrom(from);root.alpha=time>=.08&&time<1.42?Math.min(1,(time-.08)/.13,(1.42-time)/.24):0
    arm.position.set(cos*reach,sin*reach);arm.clear()
    const point=(u,v)=>{
      const axis={x:from.x+cos*reach*u,y:from.y+sin*reach*u}
      const spread=Math.sign(v)*Math.min(Math.abs(v)*Math.min(78,reach)*(.56+growth*.44),room(axis)*.83)
      return[cos*reach*(u-1)-sin*spread,sin*reach*(u-1)+cos*spread]
    }
    const poly=points=>points.flatMap(([u,v])=>point(u,v))
    // Thick ribbed cactus pads grow from the actual wrist; the longest golden spine is the front.
    arm.poly(poly([[0,0],[.15,-.12],[.36,-.13],[.49,-.27],[.73,-.34],[.87,-.19],[.88,.17],[.71,.33],[.49,.29],[.35,.12],[.12,.13]])).fill(0x3c7040)
      .poly(poly([[.07,-.015],[.19,-.08],[.39,-.06],[.52,-.19],[.73,-.24],[.83,-.13],[.79,.025],[.61,.12],[.41,.065],[.18,.075]])).fill(0x79ae59)
      .poly(poly([[.4,.08],[.56,.2],[.72,.22],[.84,.12],[.8,.25],[.66,.33],[.47,.23]])).fill(0x4f8745)
    for(let j=0;j<3;j++){
      const v=(j-1)*.11
      arm.moveTo(...point(.43,v)).quadraticCurveTo(...point(.64,v-.04),...point(.83,v*.8)).stroke({color:0xb4cd7b,width:1.5,alpha:.7})
    }
    for(let j=0;j<13;j++){
      const u=.24+(j%5)*.125,side=j%2?-1:1,v=side*(j<5?.12:.2)
      const endU=Math.min(.93,u+.065),endV=v+side*(.09+(j%3)*.025)
      arm.poly(poly([[u-.025,v],[endU,endV],[u+.028,v+.016*side]])).fill(j%2?0xe7d18a:0xf6e3a4)
      arm.moveTo(...point(u,v)).lineTo(...point(endU,endV)).stroke({color:0xfff1bd,width:.8,alpha:.9})
    }
    arm.poly(poly([[.83,-.07],[1,0],[.83,.045],[.89,-.005]])).fill(0xf2dda0)
      .moveTo(...point(.85,-.035)).lineTo(...point(1,0)).stroke({color:0xffffd0,width:1.2,alpha:.95})
    for(let j=0;j<7;j++){
      const u=.35+j*.065,v=Math.sin(j*2.1)*.105
      const p=point(u,v),r=Math.min(1.5,room({x:from.x+cos*reach*u,y:from.y+sin*reach*u})*.1)
      arm.circle(p[0],p[1],r).fill({color:0xd9dda5,alpha:.7})
    }
    const age=time-.82,u=clamp(age/.54)
    impact.clear();impact.alpha=contact&&age>=0&&age<.54?1-u:0
    if(contact){
      impact.position.copyFrom(contact);impact.scale.set(Math.min(1,room(contact)/61));impact.rotation=angle
      const r=17+u*23
      for(let j=0;j<9;j++){
        const theta=j*Math.PI*2/9,x=Math.cos(theta),y=Math.sin(theta)
        impact.poly([x*5-y*2,y*5+x*2,x*r,y*r,x*9+y*2,y*9-x*2]).fill(j%2?0xd6dfa1:0xf9e8ad)
      }
      impact.circle(0,0,7*(1-u)+1).fill(0xedf5c1)
    }
    for(const spine of spines){
      const u=clamp(age/spine.life),g=spine.g;g.clear();g.alpha=contact&&age>=0&&age<spine.life?Math.sin(u*Math.PI)*.91:0
      if(!contact)continue
      const reach=Math.min(spine.reach,room(contact)*.61),p={x:contact.x+Math.cos(spine.angle)*reach*u,y:contact.y+Math.sin(spine.angle)*reach*u+reach*.24*u*u}
      g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/(spine.size*1.6)));g.rotation=spine.angle+u*.8
      g.poly([-spine.size,0,spine.size*.63,-1.4,spine.size,0,spine.size*.63,1.4]).fill(0xf4df9f)
    }
  }
  onFrame(update)
  tl.to(attacker,{...fitPose({x:home.x-9,y:home.y+2,rotation:-.05}),duration:.25},0)
    .to(attacker,{...pose,duration:.29,ease:'power3.in'},.51)
    .to(swing,{angle:strikeAngle,duration:.3,ease:'power2.in'},.52)
    .call(()=>{contact=targetSocket('center',true);update(.82);onCue({type:'impact'});defender.tint=0xd6e5ad},[],.82)
    .to(defender,{x:defenderHome.x+recoil,duration:.065,repeat:3,yoyo:true},.82)
    .to(swing,{angle:strikeAngle+.32,duration:.22},.91)
    .call(()=>{defender.tint=0xffffff},[],1.09)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.48,ease:'power2.inOut'},1.12)
    .call(()=>{},[],2.05)
}
