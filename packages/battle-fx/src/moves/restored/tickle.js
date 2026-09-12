import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function tickle(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(37,Math.max(25,context.target.metrics.height/unit*.17)),hands=[make('tickle-hand-0'),make('tickle-hand-1')],curl=make('tickle-impact'),down=make('tickle-result')
  function update(time){
    const a=socket('hand',true),b=targetSocket('center',true),u=clamp((time-.2)/.61),spread=Math.min(r*.57,room(b)/2)
    hands.forEach((g,i)=>{const side=i?1:-1,p={x:a.x+(b.x-a.x)*u+side*spread*u,y:a.y+(b.y-a.y)*u};fit(g,p,r*1.25);g.clear();g.alpha=show(time,.14,1.34);g.rotation=side*.24+Math.sin(time*38+i)*.09
      g.roundRect(-r*.23,0,r*.46,r*.48,r*.1).fill(0xf0d9b4);for(let j=0;j<3;j++){const x=(j-1)*r*.17,w=Math.sin(time*29+j+i)*r*.035;g.moveTo(x,r*.03).quadraticCurveTo(x+side*r*.08,-r*.19,x+w,-r*(.38+j*.055)).stroke({color:0xfbe5c3,width:4,cap:'round'})}})
    fit(curl,b,r*1.65);curl.clear();curl.alpha=show(time,.81,1.59)
    for(let i=0;i<3;i++){const a=time*3+i*Math.PI*2/3,d=r*.76;curl.moveTo(Math.cos(a)*d,Math.sin(a)*d).quadraticCurveTo(Math.cos(a+.5)*d*1.2,Math.sin(a+.5)*d*1.2,Math.cos(a+1)*d,Math.sin(a+1)*d).stroke({color:0xe6c3be,width:2})}
    fit(down,b,r*1.6);down.clear();down.alpha=show(time,1.05,1.83);const v=clamp((time-1.05)/.64);for(const side of[-1,1]){const x=side*r*.28,y=r*(v*.55-.1);down.moveTo(x-5,y-5).lineTo(x,y).lineTo(x+5,y-5).stroke({color:side<0?0xe2b2a8:0xc8bddb,width:2})}
  }
  onFrame(update);tl.call(()=>{update(.81);onCue({type:'impact'})},[],.81)

}
