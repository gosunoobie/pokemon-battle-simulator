import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function mimic(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const card=make('mimic-original'),copy=make('mimic-copy'),trail=make('mimic-folds'),pulse=make('mimic-arrival'),r=Math.min(44,Math.max(29,context.source.metrics.height/unit*.2))
  function update(time){
    const a=targetSocket('aura',true),b=socket('aura',true),u=clamp((time-.35)/.8),bow=Math.min(29,room(a)/2,room(b)/2),p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u-Math.sin(Math.PI*u)*bow}
    fit(card,a,31);card.clear();card.alpha=show(time,.1,1.56)*.7;card.roundRect(-15,-19,30,38,3).fill({color:0xcabde0,alpha:.3}).stroke({color:0xe3d3ef,width:1.5}).moveTo(-7,-7).lineTo(7,-7).moveTo(-7,0).lineTo(4,0).moveTo(-7,7).lineTo(7,7).stroke({color:0xc8afd9,width:1.5})
    fit(copy,p,32);copy.rotation=-Math.sin(Math.PI*u)*.85;copy.clear();copy.alpha=show(time,.31,1.65);const fold=Math.sin(Math.PI*u),wide=15*(1-fold*.55)
    copy.poly([-wide,-19,wide,-19,wide,19,-wide,19]).fill({color:0xdccfe9,alpha:.65}).stroke({color:0xf0e4f4,width:1.6}).moveTo(-wide,-19).lineTo(wide,0).lineTo(-wide,19).stroke({color:0xa88fbd,width:1.4})
    trail.clear();trail.alpha=show(time,.4,1.37)*.4;const d=Math.min(6,room(a)/3,room(b)/3);for(const side of[-1,1])trail.moveTo(a.x,a.y+side*d).quadraticCurveTo((a.x+p.x)/2,(a.y+p.y)/2-bow*.45,p.x,p.y).stroke({color:0xb8a8ce,width:1,alpha:.4})
    fit(pulse,b,r*1.5);pulse.clear();pulse.alpha=show(time,1.15,1.8);const v=clamp((time-1.15)/.56);for(let j=0;j<6;j++){const q=j*Math.PI/3,d=r*(.35+v*.6);pulse.rect(Math.cos(q)*d-2,Math.sin(q)*d-2,4,4).fill(0xe7d5eb)}
  }
  onFrame(update);tl.call(()=>{update(1.15);onCue({type:'impact'})},[],1.15)

}
