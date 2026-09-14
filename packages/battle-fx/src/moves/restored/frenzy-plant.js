import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function frenzyPlant(context){
  const{tl,random,onFrame,onCue}=context
  const{temporary,attacker,defender,home,defenderHome,socket,targetSocket,unit}=bindEffectSpace(context)
  const edges=[-temporary.x/temporary.scale.x,(context.scene.width-temporary.x)/temporary.scale.x]
  const left=Math.min(...edges),right=Math.max(...edges),top=-temporary.y/unit,bottom=(context.scene.height-temporary.y)/unit
  const clamp=n=>Math.max(0,Math.min(1,n)),room=p=>Math.max(0,Math.min(p.x-left,right-p.x,p.y-top,bottom-p.y)-4)
  const make=label=>{const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g}
  const fit=(g,p,r)=>{g.position.copyFrom(p);g.scale.set(Math.min(1,room(p)/r))}
  const sourceCenter=socket(context.source.hasAnchor?.('visualCenter')?'visualCenter':'center')
  const receiver=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center')
  const lift=Math.max(0,Math.min(6,sourceCenter.y-context.source.metrics.height/(2*unit)-top))
  const recoil=Math.max(0,Math.min(7,right-receiver.x-context.target.metrics.width/(2*unit)))
  const jolt=Math.max(0,Math.min(5,receiver.y-context.target.metrics.height/(2*unit)-top))
  const tendrils=make('frenzy-plant-travel-roots'),tip=make('frenzy-plant-tip'),crown=make('frenzy-plant-impact')
  const chips=Array.from({length:30},(_,i)=>({g:make(`frenzy-plant-chip-${i}`),start:1.2+i%6*.04,angle:random()*Math.PI*2,reach:28+random()*40,life:.72+random()*.3,size:4+random()*7}))
  const dust=Array.from({length:14},(_,i)=>({g:make(`frenzy-plant-dust-${i}`),start:1.28+i*.038,side:i%2?-1:1,reach:15+random()*26,life:.5+random()*.16}))
  let struck=false
  function update(time){
    const a=socket('ground',true),b=targetSocket('floor'),dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy,dx),nx=-Math.sin(angle),ny=Math.cos(angle)
    const front=clamp((time-.48)/.72),wither=clamp((time-2.05)/.52)
    const route=(u,lane)=>{const p={x:a.x+dx*u,y:a.y+dy*u},offset=Math.sin(u*Math.PI)*(lane*12+Math.sin(u*18+lane*1.7)*6)*Math.min(1,room(p)/52);return{x:p.x+nx*offset,y:p.y+ny*offset}}
    tendrils.clear();tendrils.alpha=time>=.48&&time<2.57?Math.min(1,.86+(time-.48)*4)*(1-wither):0
    if(front>0)for(let lane=-1;lane<=1;lane++){
      const outer=[],inner=[]
      for(let j=0;j<=52;j++){
        const u=front*j/52,p=route(u,lane),radius=Math.min((5+u*8)*Math.sin(j/52*Math.PI)**.4,room(p)*.6)
        outer.push(p.x+nx*radius,p.y+ny*radius);inner.unshift(p.y-ny*radius);inner.unshift(p.x-nx*radius)
      }
      tendrils.poly([...outer,...inner]).fill(lane===0?0x79673d:0x586335)
      for(let j=0;j<=48;j++){
        const p=route(front*j/48,lane);if(j===0)tendrils.moveTo(p.x,p.y);else tendrils.lineTo(p.x,p.y)
      }
      tendrils.stroke({color:lane===0?0xb5a262:0x9ab067,width:2.5,alpha:.7})
      for(let j=1;j<10;j++){
        const u=j/10;if(u>=front)continue
        const p=route(u,lane),side=j%2?-1:1,r=Math.min(9+u*7,room(p)*.42)
        tendrils.poly([p.x-Math.cos(angle)*5,p.y-Math.sin(angle)*5,p.x+nx*r*side,p.y+ny*r*side,p.x+Math.cos(angle)*5,p.y+Math.sin(angle)*5]).fill(0xc6bc76)
      }
    }
    const head=route(front,0);tip.clear();fit(tip,head,35);tip.rotation=angle
    tip.alpha=time>=.48&&time<1.5?Math.min(1,.9+(time-.48)*3,(1.5-time)/.2):0
    tip.poly([0,0,-12,-10,-27,-8,-21,0,-27,8,-12,10]).fill(0x81954a)
      .moveTo(-25,-6).quadraticCurveTo(-13,-9,0,0).stroke({color:0xcbd187,width:2,alpha:.87})
    const age=time-1.2,grow=clamp(age/.38),span=Math.min(99,Math.max(55,context.target.metrics.width/unit*.44)),height=Math.min(151,Math.max(77,context.target.metrics.height/unit*.91))
    const crownFit=Math.max(0,Math.min(1,(b.x-left-4)/(span+22),(right-b.x-4)/(span+22),(b.y-top-4)/(height+23),(bottom-b.y-4)/25))
    crown.clear();crown.position.copyFrom(b);crown.scale.set(crownFit)
    crown.alpha=struck&&age>=0&&time<2.57?(1-wither):0
    // Five heavy roots curl over the ground in a thorny, interlocking crown.
    for(let lane=-2;lane<=2;lane++){
      const side=lane<0?-1:1,x0=lane*9,reach=span*(Math.abs(lane)*.22+.31),h=height*(lane===0?.95:.66+(Math.abs(lane)%2)*.19)
      const path=[]
      for(let j=0;j<=36;j++){
        const u=grow*j/36,theta=u*Math.PI*1.26
        const x=x0+side*reach*Math.sin(theta)*(.77+u*.23)
        const y=-h*Math.sin(u*Math.PI*.68)
        path.push({x,y})
      }
      for(const[width,color]of[[13,0x394725],[9,lane%2?0x698047:0x827447],[3,lane%2?0xa4b775:0xb3a16c]]){
        path.forEach((p,j)=>j===0?crown.moveTo(p.x,p.y):crown.lineTo(p.x,p.y));crown.stroke({color,width,alpha:.94,cap:'round'})
      }
      for(let j=6;j<path.length;j+=6){
        const p=path[j],q=path[j-1],theta=Math.atan2(p.y-q.y,p.x-q.x),r=7+Math.abs(lane)*2
        crown.poly([p.x-Math.cos(theta)*4,p.y-Math.sin(theta)*4,p.x-Math.sin(theta)*r*side,p.y+Math.cos(theta)*r*side,p.x+Math.cos(theta)*4,p.y+Math.sin(theta)*4]).fill(0xd2c68c)
      }
    }
    for(const chip of chips){
      const age=time-chip.start,u=clamp(age/chip.life),clearance=room(b),r=Math.min(chip.reach,clearance*.62)
      const p={x:b.x+Math.cos(chip.angle)*r*u,y:b.y-Math.min(47,clearance*.61)*Math.sin(u*Math.PI)+Math.min(12,clearance*.12)*u*u}
      const g=chip.g,s=chip.size;g.clear();fit(g,p,s*1.8);g.rotation=chip.angle+u*3
      g.alpha=struck&&age>=0&&age<chip.life?Math.min(1,age/.05,(chip.life-age)/.2)*.9:0
      g.poly([-s,-s*.24,s*.42,-s*.5,s,s*.14,-s*.25,s*.54]).fill(chip.angle<Math.PI?0xb6a171:0x738353)
        .moveTo(-s*.64,-s*.07).lineTo(s*.57,s*.05).stroke({color:0xddc99b,width:.9,alpha:.7})
    }
    for(const puff of dust){
      const age=time-puff.start,u=clamp(age/puff.life),reach=Math.min(puff.reach,room(b)*.49),p={x:b.x+puff.side*reach*u,y:b.y-Math.min(17,room(b)*.2)*u}
      const g=puff.g;g.clear();fit(g,p,41);g.alpha=struck&&age>=0&&age<puff.life?Math.sin(u*Math.PI)*.34:0
      g.ellipse(-8,0,15+u*6,6+u*3).fill({color:0xb2b08a,alpha:.35}).ellipse(12,-3,13+u*4,5+u*2).fill({color:0xc5bc91,alpha:.25})
    }
  }
  onFrame(update)
  tl.to(attacker,{y:home.y-lift,duration:.26},0).to(attacker,{y:home.y,duration:.2,ease:'power2.in'},.26)
    .call(()=>update(.48),[],.48)
    .call(()=>{struck=true;update(1.2);onCue({type:'impact'});defender.tint=0xd1dca0},[],1.2)
    .to(defender,{x:defenderHome.x+recoil,y:defenderHome.y-jolt,duration:.08,repeat:5,yoyo:true},1.2)
    .call(()=>{defender.tint=0xffffff},[],1.69).call(()=>{},[],2.8)
}
