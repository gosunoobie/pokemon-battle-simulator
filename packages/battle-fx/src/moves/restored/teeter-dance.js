import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function teeterDance(context){
  const {tl,random,onFrame,onCue}=context
  const {temporary,socket,targetSocket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const facing=Math.sign(temporary.scale.x)
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const root=make('teeter-dance-root'),tip=make('teeter-dance-tip'),impact=make('teeter-dance-impact'),steps=make('teeter-dance-steps')
  root.attachmentSocket='emission';tip.contactPoint={x:0,y:0}
  const rhythm=Array.from({length:7},(_,i)=>({g:make(`teeter-dance-rhythm-${i}`),start:.48+i*.053,side:i%2?-1:1}))
  const motes=Array.from({length:20},(_,i)=>({g:make(`teeter-dance-mote-${i}`),phase:random()*6.28,start:1.02+i*.024,size:3+random()*3}))
  let dizzy=false
  function route(u,time,a,b){
    const p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u}
    p.y+=Math.sin(u*Math.PI)*Math.sin(u*9-time*2)*Math.min(29,room(p)*.29)
    return p
  }
  function update(time){
    // The sway pivots around visible art, then clamps the full rotated silhouette.
    const actor=context.source,v=clamp((time-.1)/1.58),weight=Math.sin(v*Math.PI),angle=Math.sin(v*Math.PI*6)*.055*weight*facing
    actor.pose.position.set(0,0);actor.pose.rotation=angle
    const rest=actor.base('visualCenter'),posed=actor.anchor('visualCenter'),dx=Math.sin(v*Math.PI*6)*7*unit*weight*facing
    actor.pose.x=rest.x-posed.x+dx;actor.pose.y=rest.y-posed.y
    const center=actor.anchor('visualCenter'),cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle))
    const rx=(actor.metrics.width*cos+actor.metrics.height*sin)/2,ry=(actor.metrics.height*cos+actor.metrics.width*sin)/2
    actor.pose.x+=Math.max(rx+1,Math.min(context.scene.width-rx-1,center.x))-center.x
    actor.pose.y+=Math.max(ry+1,Math.min(context.scene.height-ry-1,center.y))-center.y
    const a=socket('emission',true),b=targetSocket('center',true),c=socket('center',true),u=clamp((time-.44)/.58)
    const front=route(u,time,a,b),before=route(Math.max(0,u-.004),time,a,b),after=route(Math.min(1,u+.004),time,a,b)
    root.clear();fit(root,a,40);root.alpha=time>=.07&&time<1.29?clamp((time-.07)/.18)*(1-clamp((time-.95)/.34)):0
    for(const side of[-1,1])root.moveTo(side*8,-23).quadraticCurveTo(side*31,-6,side*17,14).quadraticCurveTo(side*5,26,side*11,29)
      .stroke({color:side<0?0xf1cf8f:0xdb9fcf,width:2.4,alpha:.7,cap:'round'})
    steps.clear();fit(steps,c,109);steps.alpha=time>=.1&&time<1.77?clamp((time-.1)/.18)*(1-clamp((time-1.39)/.38))*.66:0
    for(let i=0;i<4;i++){
      const side=i%2?1:-1,x=side*(46+i*6),y=44+(i%2)*8+Math.sin(time*6+i)*4
      steps.ellipse(x,y,10,4.2).fill({color:i%2?0xe5bddc:0xe6d399,alpha:.36+.2*Math.sin(time*7+i)**2})
        .circle(x+side*10,y-5,2.3).fill({color:0xf2d9eb,alpha:.6})
    }
    tip.clear();fit(tip,front,47);tip.rotation=Math.atan2(after.y-before.y,after.x-before.x)
    tip.alpha=time>=.44&&time<1.36?1-clamp((time-1.08)/.28):0
    // A crooked ribbon knot leads the dance; its front vertex is local zero.
    tip.moveTo(0,0).lineTo(-21,-19).quadraticCurveTo(-43,-23,-38,-3).quadraticCurveTo(-28,7,-20,-1)
      .quadraticCurveTo(-30,-13,-33,-3).lineTo(-9,7).lineTo(-27,22).lineTo(-16,27).closePath()
      .fill({color:0xe6a7d6,alpha:.72}).stroke({color:0xf8d3e9,width:1.4,alpha:.77})
      .moveTo(-31,12).lineTo(-17,7).lineTo(-8,10).stroke({color:0xf2d290,width:2.2,alpha:.86})
    rhythm.forEach(p=>{
      const age=time-p.start,u=clamp(age/.62),at=route(u,time,a,b);at.y+=p.side*Math.min(13,room(at)*.17)*Math.sin(u*Math.PI)
      const g=p.g;g.clear();fit(g,at,22);g.rotation=Math.sin(time*7+p.start)*.26
      g.alpha=age>=0&&age<.91?clamp(age/.08)*(1-clamp((age-.49)/.42))*.68:0
      g.moveTo(-12,9).lineTo(-4,-13).lineTo(6,-3).lineTo(12,-15).stroke({color:p.side<0?0xf2ce8f:0xe3a6d5,width:3.2,alpha:.78,cap:'round',join:'round'})
    })
    const age=time-1.02,settle=clamp(age/1.04)
    impact.clear();fit(impact,b,76);impact.alpha=dizzy&&age>=0&&age<1.04?1-clamp((age-.3)/.74):0
    for(let i=0;i<2;i++){
      for(let j=0;j<=40;j++){const q=j/40*Math.PI*2.7+time*(i?2.8:-3),r=(14+j*.74)*(1+settle*.2),x=Math.cos(q)*r,y=Math.sin(q)*r*.6;if(j===0)impact.moveTo(x,y);else impact.lineTo(x,y)}
      impact.stroke({color:i?0xe5b3d9:0xf0d496,width:2-i*.4,alpha:.57})
    }
    motes.forEach(p=>{
      const age=time-p.start,u=clamp(age/1.08),r=Math.min(86,room(b)*.75),q=p.phase+u*2.4,at={x:b.x+Math.cos(q)*r*(.29+u*.43),y:b.y+Math.sin(q)*r*.37+r*u*.21}
      const g=p.g;g.clear();fit(g,at,16);g.rotation=q+Math.sin(time*4)*.2
      g.alpha=dizzy&&age>=0&&age<1.08?clamp(age/.13)*(1-clamp((u-.58)/.42))*.77:0
      const s=p.size;g.moveTo(-s,0).quadraticCurveTo(0,-s*1.8,s,0).quadraticCurveTo(0,s*1.3,-s,0).stroke({color:p.phase>3?0xf0d393:0xe5b4db,width:1.7,alpha:.8})
    })
  }
  onFrame(update)
  tl.call(()=>update(.44),[],.44).call(()=>{dizzy=true;update(1.02);onCue({type:'impact'})},[],1.02).to({}, {duration:2.4},0)
}
