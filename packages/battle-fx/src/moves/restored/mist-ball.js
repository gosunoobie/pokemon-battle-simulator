import { Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function mistBall(context) {
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

  const r=Math.min(31,Math.max(22,context.source.metrics.height/unit*.14))
  const orb=new Graphics();orb.label='mist-ball-orb';orb.alpha=0;temporary.addChild(orb)
  const halo=new Sprite(glowTexture);halo.anchor.set(.5);halo.tint=0xe8b7dc;halo.alpha=0;temporary.addChildAt(halo,0)
  const wisps=Array.from({length:11},(_,i)=>{const g=new Graphics();g.label=`mist-ball-wisp-${i}`;g.alpha=0;temporary.addChild(g);return{g,at:.55+i*.045,start:null,side:i%2?1:-1}})
  const bloom=new Graphics();bloom.label='mist-ball-impact';bloom.alpha=0;temporary.addChild(bloom)
  const feathers=Array.from({length:10},(_,i)=>{const g=new Graphics();g.alpha=0;temporary.addChild(g);return{g,a:i*Math.PI/5+random()*.2,d:.6+random()*.4}})
  let launch,impact
  function point(time){const a=launch??socket('emission',true),b=impact??targetSocket('center',true),u=clamp((time-.52)/.58),arc=Math.min(18,room(a)*.4,room(b)*.4);return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u+Math.sin(Math.PI*u)*Math.sin(u*Math.PI*1.5)*arc}}
  function update(time){
    const p=time<.52?socket('emission',true):point(time),growth=clamp((time-.08)/.44),radius=Math.min(r*(.28+.72*growth),room(p)/1.9)
    orb.position.copyFrom(p);orb.clear();orb.alpha=time>=.08&&time<1.14?Math.min(1,(time-.08)*7)*Math.min(1,(1.14-time)*25):0
    for(let j=0;j<5;j++){const a=j*Math.PI*2/5+time*2.8;orb.ellipse(Math.cos(a)*radius*.48,Math.sin(a)*radius*.32,radius*.62,radius*.5).fill({color:j%2?0xf2dee9:0xc6b4d5,alpha:.58})}
    orb.circle(-radius*.1,-radius*.03,radius*.58).fill({color:0xfff0eb,alpha:.86})
    for(let j=0;j<3;j++){const a=time*3.1+j*Math.PI*2/3;orb.moveTo(Math.cos(a)*radius*.7,Math.sin(a)*radius*.7).quadraticCurveTo(Math.cos(a+.65)*radius*.98,Math.sin(a+.65)*radius*.98,Math.cos(a+1.1)*radius*.48,Math.sin(a+1.1)*radius*.48).stroke({color:0xfdf3f5,width:1.8,alpha:.8})}
    halo.position.copyFrom(p);halo.width=halo.height=radius*3.6;halo.alpha=orb.alpha*.42
    for(const w of wisps){const age=time-w.at,u=clamp(age/.66);w.g.clear();w.g.alpha=w.start&&age>=0&&age<.66?Math.sin(Math.PI*u)*.28:0;if(w.start){const radius=Math.min(r*.85,room(w.start)/1.7);w.g.position.set(w.start.x-radius*u*.32,w.start.y+w.side*Math.sin(u*2.2)*radius*.23-radius*u*.18);w.g.rotation=w.side*u*.9
      w.g.ellipse(0,0,radius*(.45+u*.48),radius*(.27+u*.24)).fill(0xdbc6e0).moveTo(-radius*.5,0).quadraticCurveTo(0,-radius*.36,radius*.45,0).stroke({color:0xf3e8ed,width:1.5,alpha:.5})}}
    const age=time-1.1,q=clamp(age/.84);bloom.clear();bloom.alpha=impact&&age>=0&&age<.84?(1-q)*.62:0
    if(impact){const radius=Math.min(r*1.85,room(impact)/1.4);bloom.position.copyFrom(impact)
      for(let j=0;j<6;j++){const a=j*Math.PI/3+(j%2?1:-1)*q*.9,d=radius*(.13+q*.38),size=radius*(.24+q*.18);bloom.ellipse(Math.cos(a)*d,Math.sin(a)*d*.7-size*q*.22,size,size*.7).fill({color:j%2?0xf2e0eb:0xc9b6d8,alpha:.65})
        bloom.moveTo(Math.cos(a)*d,Math.sin(a)*d).quadraticCurveTo(Math.cos(a+.4)*d*1.4,Math.sin(a+.4)*d*1.4,Math.cos(a+.8)*d,Math.sin(a+.8)*d).stroke({color:0xfff3f5,width:1.6,alpha:.65})}}
    feathers.forEach(({g,a,d},i)=>{const u=clamp(age/.79),travel=impact?Math.max(0,Math.min(r*1.8,room(impact)-9)):0;g.clear();g.alpha=impact&&age>=0&&age<.79?Math.sin(Math.PI*u)*.8:0;if(impact){g.position.set(impact.x+Math.cos(a)*travel*u*d*.7,impact.y+Math.sin(a)*travel*u*d*.5+travel*u*u*.18);g.rotation=a+Math.sin(u*5+i)*.5;g.scale.set(Math.min(1,room(impact)/12))
      g.moveTo(-7,0).quadraticCurveTo(-1,-4,6,0).quadraticCurveTo(-1,4,-7,0).fill(i%2?0xf4e7f0:0xd3beda).moveTo(-6,0).lineTo(5,0).stroke({color:0xfff5f7,width:.8})}})
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back*.7,duration:.22},0).to(attacker,{x:home.x+thrust*.7,duration:.19},.29)
    .call(()=>{launch=socket('emission',true);update(.52)},[],.52)
    .call(()=>{impact=targetSocket('center',true);update(1.1);onCue({type:'impact'});defender.tint=0xe4cbe6},[],1.1)
    .to(defender,{x:defenderHome.x+recoil*.8,duration:.07,repeat:3,yoyo:true},1.1).call(()=>{defender.tint=0xffffff},[],1.43)
    .to(attacker,{x:home.x,duration:.37,ease:'power2.inOut'},1.48)
  for(const w of wisps)tl.call(()=>{w.start=point(w.at);update(w.at)},[],w.at)

}
