import { Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function zapCannon(context) {
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

  const r=Math.min(33,Math.max(23,context.source.metrics.height/unit*.135))
  const orb=new Graphics();orb.label='zap-cannon-orb';orb.alpha=0;temporary.addChild(orb)
  const halo=new Sprite(glowTexture);halo.anchor.set(.5);halo.tint=0xffd643;halo.blendMode='add';halo.alpha=0;temporary.addChildAt(halo,0)
  const muzzle=new Graphics();muzzle.label='zap-cannon-charge';muzzle.alpha=0;temporary.addChild(muzzle)
  const trail=new Graphics();trail.alpha=0;temporary.addChild(trail)
  const crash=new Graphics();crash.label='zap-cannon-impact';crash.alpha=0;temporary.addChild(crash)
  const sparks=Array.from({length:18},(_,i)=>{const g=new Graphics();g.alpha=0;temporary.addChild(g);return{g,a:Math.PI*2*i/18+(random()-.5)*.15,d:.5+random()*.5}})
  let launch,impact
  function point(time){const from=launch??socket('emission',true),to=impact??targetSocket('center',true),u=clamp((time-.74)/.42),p=u*u;return{x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p}}
  function update(time){
    const from=socket('emission',true),p=time<.74?from:point(time),growth=clamp((time-.1)/.57),radius=Math.min(r*(.2+.8*growth),room(p)/1.85),age=time-1.16
    orb.position.copyFrom(p);orb.alpha=time>=.1&&time<1.2?Math.min(1,(time-.1)*9)*Math.min(1,(1.2-time)*25):0;orb.clear()
    orb.circle(0,0,radius).fill(0xe8b939).circle(-radius*.08,-radius*.05,radius*.79).fill(0xffe57c).circle(-radius*.18,-radius*.17,radius*.44).fill(0xffffd4)
    for(let j=0;j<5;j++){const start=j*Math.PI*.4+time*7.5;for(let k=0;k<=7;k++){const a=start+k*.11,d=radius*(1.07+.12*Math.sin(k*2.7+time*34+j));k?orb.lineTo(Math.cos(a)*d,Math.sin(a)*d):orb.moveTo(Math.cos(a)*d,Math.sin(a)*d)}orb.stroke({color:j%2?0xfff4a8:0xc0eafa,width:2,cap:'round'})}
    halo.position.copyFrom(p);halo.width=halo.height=radius*3.6;halo.alpha=orb.alpha*(.55+Math.sin(time*26)*.08)
    muzzle.clear();muzzle.position.copyFrom(from);muzzle.alpha=time>=.1&&time<.91?Math.min(1,(time-.1)*7)*Math.min(1,(.91-time)*8):0
    const mr=Math.min(r*1.55,room(from)/1.2);for(let j=0;j<8;j++){const a=j*Math.PI/4-time*2,d=mr*(1-clamp((time-.1)/.65)*.3);muzzle.moveTo(Math.cos(a)*d,Math.sin(a)*d).lineTo(Math.cos(a+.14)*d*.72,Math.sin(a+.14)*d*.72).lineTo(Math.cos(a-.04)*d*.52,Math.sin(a-.04)*d*.52).stroke({color:j%2?0xffec91:0xe1bd4f,width:1.8,alpha:.8})}
    trail.clear();trail.alpha=time>=.74&&time<1.25?Math.min(1,(1.25-time)*10)*.7:0
    for(let j=1;j<=5;j++){const a=point(Math.max(.74,time-j*.019)),b=point(Math.max(.74,time-(j-1)*.019)),width=Math.min(r*.48,room(a),room(b));trail.moveTo(a.x,a.y).lineTo(b.x,b.y).stroke({color:j%2?0xffdc66:0xfff5b2,width,alpha:1-j*.14,cap:'round'})}
    crash.clear();const q=clamp(age/.66);crash.alpha=impact&&age>=0&&age<.66?1-q:0
    if(impact){const radius=Math.min(r*2,room(impact)/1.15);crash.position.copyFrom(impact)
      crash.circle(0,0,radius*(.15+q*.58)).stroke({color:0xfff2a6,width:3*(1-q)+.6})
      for(let j=0;j<9;j++){const a=j*Math.PI*2/9,reach=radius*(.6+.25*Math.sin(time*39+j));crash.moveTo(Math.cos(a)*radius*.16,Math.sin(a)*radius*.16).lineTo(Math.cos(a+.16)*reach*.46,Math.sin(a+.16)*reach*.46).lineTo(Math.cos(a-.09)*reach*.68,Math.sin(a-.09)*reach*.68).lineTo(Math.cos(a)*reach,Math.sin(a)*reach).stroke({color:j%2?0xffe164:0xd8f4ff,width:j%2?2.5:1.5,alpha:.9,cap:'round'})}}
    sparks.forEach(({g,a,d},i)=>{const u=clamp(age/.64),travel=impact?Math.max(0,Math.min(r*2.25,room(impact)-7)):0;g.clear();g.alpha=impact&&age>=0&&age<.64?1-u:0;if(impact){g.position.set(impact.x+Math.cos(a)*travel*u*d,impact.y+Math.sin(a)*travel*u*d);g.rotation=a;g.scale.set(Math.min(1,room(impact)/10));g.moveTo(-3,0).lineTo(0,-2).lineTo(-.5,1).lineTo(4,0).stroke({color:i%2?0xffee9b:0xc6efff,width:1.5})}})
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.28},0).to(attacker,{x:home.x+thrust,duration:.13,ease:'power2.in'},.59)
    .call(()=>{launch=socket('emission',true);update(.74)},[],.74)
    .call(()=>{impact=targetSocket('center',true);update(1.16);onCue({type:'impact'});defender.tint=0xffe998},[],1.16)
    .to(defender,{x:defenderHome.x+recoil,duration:.045,repeat:5,yoyo:true},1.16).call(()=>{defender.tint=0xffffff},[],1.49)
    .to(attacker,{x:home.x,duration:.37,ease:'power2.inOut'},1.48)

}
