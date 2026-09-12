import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function rolePlay(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(42,Math.max(29,context.source.metrics.height/unit*.2)),original=make('role-play-medallion'),copy=make('role-play-copy'),mask=make('role-play-result')
  function update(time){
    const a=targetSocket('aura',true),b=socket('aura',true),u=clamp((time-.34)/.84),bow=Math.min(31,room(a)/2,room(b)/2),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u-Math.sin(Math.PI*u)*bow}
    fit(original,a,31);original.clear();original.alpha=show(time,.12,1.62)*.65;original.circle(0,0,20).fill({color:0xb99575,alpha:.3}).stroke({color:0xe5c8a3,width:2}).poly([0,-12,9,-3,6,10,-6,10,-9,-3]).stroke({color:0xd2b7d8,width:1.6})
    fit(copy,p,31);copy.rotation=Math.sin(Math.PI*u)*Math.PI*2;copy.clear();copy.alpha=show(time,.29,1.43);copy.circle(0,0,18).fill({color:0xbca1d2,alpha:.45}).stroke({color:0xe7cbb4,width:1.8}).poly([0,-10,8,-2,5,9,-5,9,-8,-2]).fill(0xd9bbcf)
    fit(mask,b,r*1.55);mask.clear();mask.alpha=show(time,1.18,1.85)
    mask.moveTo(-r*.6,-r*.48).quadraticCurveTo(0,-r*.28,r*.6,-r*.48).quadraticCurveTo(r*.65,r*.45,0,r*.72).quadraticCurveTo(-r*.65,r*.45,-r*.6,-r*.48).fill({color:0xb897c4,alpha:.4}).stroke({color:0xe4c5d8,width:2})
      .moveTo(-r*.43,-r*.13).quadraticCurveTo(-r*.25,-r*.26,-r*.08,-r*.13).moveTo(r*.08,-r*.13).quadraticCurveTo(r*.25,-r*.26,r*.43,-r*.13).stroke({color:0xf2dddc,width:1.8})
  }
  onFrame(update);tl.call(()=>{update(1.18);onCue({type:'impact'})},[],1.18)

}
