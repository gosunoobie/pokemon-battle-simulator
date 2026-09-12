import { Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function weatherBall(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const back = Math.max(0, Math.min(8, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(6, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(9, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const clamp = x => Math.max(0, Math.min(1, x))

  // Neutral-weather sample: a pearly pressure sphere, independent of battle weather state.
  const r=Math.min(28,Math.max(19,context.source.metrics.height/unit*.12))
  const orb=new Graphics();orb.label='weather-ball-orb';orb.alpha=0;temporary.addChild(orb)
  const halo=new Sprite(glowTexture);halo.anchor.set(.5);halo.tint=0xd8eef3;halo.alpha=0;temporary.addChildAt(halo,0)
  const eddies=Array.from({length:7},(_,i)=>{const g=new Graphics();g.label=`weather-ball-wake-${i}`;g.alpha=0;temporary.addChild(g);return{g,at:.43+i*.068,start:null}})
  const ripple=new Graphics();ripple.label='weather-ball-impact';ripple.alpha=0;temporary.addChild(ripple)
  const motes=Array.from({length:12},(_,i)=>{const g=new Graphics().circle(0,0,2+i%2).fill(i%2?0xe7f1dc:0xc1dee6);g.alpha=0;temporary.addChild(g);return{g,a:i*Math.PI/6,d:.7+random()*.3}})
  let launch,impact
  function point(time){const a=launch??socket('emission',true),b=impact??targetSocket('center',true),u=clamp((time-.4)/.6),arc=Math.min(26,room(a)*.55,room(b)*.55);return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u-Math.sin(Math.PI*u)*arc}}
  function update(time){
    const p=time<.4?socket('emission',true):point(time),radius=Math.min(r*(.35+.65*clamp((time-.07)/.33)),room(p)/1.65)
    orb.position.copyFrom(p);orb.clear();orb.alpha=time>=.07&&time<1.04?Math.min(1,(time-.07)*8)*Math.min(1,(1.04-time)*25):0
    orb.circle(0,0,radius).fill({color:0xc6dce2,alpha:.8}).circle(-radius*.13,-radius*.16,radius*.74).fill({color:0xf0f5e8,alpha:.9})
      .ellipse(-radius*.3,-radius*.36,radius*.35,radius*.2).fill(0xffffff)
    for(let j=0;j<3;j++){const a=time*5+j*Math.PI*2/3,d=radius*(.92+j*.09);orb.moveTo(Math.cos(a)*d,Math.sin(a)*d).arc(0,0,d,a,a+.85).stroke({color:j%2?0xf9fff6:0x98bdc9,width:1.5,alpha:.65})}
    halo.position.copyFrom(p);halo.width=halo.height=radius*3.2;halo.alpha=orb.alpha*.28
    for(const e of eddies){const age=time-e.at,u=clamp(age/.42);e.g.clear();e.g.alpha=e.start&&age>=0&&age<.42?(1-u)*.5:0;if(e.start){const radius=Math.min(r*.8,room(e.start)/1.6);e.g.position.set(e.start.x,e.start.y-radius*u*.18);e.g.rotation=.4+u*.6;e.g.ellipse(0,0,radius*(.45+u*.4),radius*(.2+u*.17)).stroke({color:0xe5f0df,width:2*(1-u)+.4})}}
    const age=time-1,q=clamp(age/.57);ripple.clear();ripple.alpha=impact&&age>=0&&age<.57?1-q:0
    if(impact){const radius=Math.min(r*1.7,room(impact)/1.25);ripple.position.copyFrom(impact);ripple.circle(0,0,radius*(.25+q*.62)).stroke({color:0xf1f7e8,width:3*(1-q)+.6})
      for(let j=0;j<4;j++){const a=j*Math.PI/2+q*.8,d=radius*(.4+q*.45);ripple.moveTo(Math.cos(a)*d,Math.sin(a)*d).arc(0,0,d,a,a+.65).stroke({color:0xc3e0e8,width:1.8,alpha:.7})}}
    motes.forEach(({g,a,d})=>{const u=clamp(age/.6),travel=impact?Math.max(0,Math.min(r*1.75,room(impact)-5)):0;g.alpha=impact&&age>=0&&age<.6?1-u:0;if(impact){g.position.set(impact.x+Math.cos(a)*travel*u*d*.8,impact.y+Math.sin(a)*travel*u*d*.7-travel*u*u*.12);g.scale.set(Math.min(1,room(impact)/8))}})
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back*.55,duration:.17},0).to(attacker,{x:home.x+thrust*.7,duration:.14},.23)
    .call(()=>{launch=socket('emission',true);update(.4)},[],.4)
    .call(()=>{impact=targetSocket('center',true);update(1);onCue({type:'impact'});defender.tint=0xe4ede4},[],1)
    .to(defender,{x:defenderHome.x+recoil*.7,duration:.065,repeat:1,yoyo:true},1).call(()=>{defender.tint=0xffffff},[],1.19)
    .to(attacker,{x:home.x,duration:.31,ease:'power2.inOut'},1.2)
  for(const e of eddies)tl.call(()=>{e.start=point(e.at);update(e.at)},[],e.at)

}
