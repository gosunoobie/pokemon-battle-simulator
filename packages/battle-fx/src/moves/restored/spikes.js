import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function spikes(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=22,points=Array.from({length:8},(_,i)=>({g:make(`spikes-point-${i}`),dust:make(`spikes-dust-${i}`),at:.22+i*.08,start:null,hit:null,i}))
  function landing(i){const c=targetSocket(context.target.hasAnchor?.('visualCenter')?'visualCenter':'center',true),floor={x:c.x,y:c.y+context.target.metrics.height/unit/2},spread=Math.min(70,room(floor)/1.7);return{x:floor.x+((i%4)-1.5)*spread*.4,y:floor.y+(i<4?-1:1)*spread*.09}}
  function update(time){
    for(const p of points){const a=p.start??socket('hand',true),b=p.hit??landing(p.i),u=clamp((time-p.at)/.66),bow=Math.min(54,room(a)*.6,room(b)*.6),pos={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u-Math.sin(Math.PI*u)*bow}
      fit(p.g,pos,r*1.4);p.g.rotation=(1-u)*Math.PI*(p.i%2?2:-2);p.g.clear();p.g.alpha=show(time,p.at,2.04,.34)
      p.g.poly([0,-16,4,-3,16,5,4,6,-6,14,-5,2,-15,-6,-3,-4]).fill(p.i%2?0x9e947e:0xc3b59a).stroke({color:0xe1d6b7,width:1.2})
      const q=clamp((time-p.at-.66)/.35);fit(p.dust,b,32);p.dust.clear();p.dust.alpha=time>=p.at+.66&&time<p.at+1.01?(1-q)*.55:0
      for(let j=0;j<5;j++){const a=j*Math.PI*2/5,d=7+q*16;p.dust.circle(Math.cos(a)*d,Math.sin(a)*d*.25,2.2).fill(0xc6b491)}}
  }
  onFrame(update)
  for(const p of points)tl.call(()=>{p.start=socket('hand',true);update(p.at)},[],p.at).call(()=>{p.hit=landing(p.i);update(p.at+.66);if(p.i===7)onCue({type:'impact'})},[],p.at+.66)

}
