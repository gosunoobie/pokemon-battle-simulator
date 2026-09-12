import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function fakeOut(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const palms=[make('fake-out-palm-0'),make('fake-out-palm-1')],impact=make('fake-out-impact'),r=Math.min(30,Math.max(21,context.target.metrics.height/unit*.14))
  const v=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center'),recoil=Math.max(0,Math.min(7,right-v.x-context.target.metrics.width/unit/2))
  let contact
  function update(time){
    const a=socket('hand',true),b=contact??targetSocket('center',true),u=clamp((time-.12)/.26),bow=Math.min(r,room(a)/2,room(b)/2)
    palms.forEach((g,i)=>{const side=i?1:-1,p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u+Math.sin(Math.PI*u)*bow*side};fit(g,p,r*1.6);g.clear();g.alpha=show(time,.09,.64,.2);g.rotation=side*(1-u)*.7
      g.roundRect(-r*.8,side<0?-r*.56:0,r*.8,r*.56,r*.13).fill(i?0xf1d7ab:0xe7c695).stroke({color:0xffeac7,width:1.4});for(let j=0;j<3;j++)g.moveTo(-r*.08,side*r*(.1+j*.13)).lineTo(-r*.43,side*r*(.1+j*.13)).stroke({color:0xb49a73,width:1})})
    fit(impact,b,r*1.7);impact.clear();const q=clamp((time-.38)/.44);impact.alpha=time>=.38&&time<.82?1-q:0
    const s=r*(.65+q*.55);impact.poly([0,-s,s*.17,-s*.23,s*.8,-s*.5,s*.32,0,s,s*.32,s*.2,s*.28,0,s,-s*.2,s*.28,-s,s*.32,-s*.32,0,-s*.8,-s*.5,-s*.17,-s*.23]).fill({color:0xffe5a9,alpha:.6}).stroke({color:0xfff1cc,width:1.7})
  }
  onFrame(update);tl.call(()=>{contact=targetSocket('center',true);update(.38);onCue({type:'impact'});defender.tint=0xf4e1bd},[],.38).to(defender,{x:defenderHome.x+recoil,duration:.045,repeat:1,yoyo:true},.38).call(()=>{defender.tint=0xffffff},[],.52)

}
