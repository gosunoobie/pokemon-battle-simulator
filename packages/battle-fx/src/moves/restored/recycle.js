import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function recycle(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))
  const show = (time,start,end,fade=.24) => time>=start&&time<end ? Math.min(1,(time-start)/.12)*Math.min(1,(end-time)/fade) : 0
  const make = label => { const g=new Graphics();g.label=label;g.alpha=0;temporary.addChild(g);return g }

  const r=Math.min(43,Math.max(30,context.source.metrics.height/unit*.2)),arrows=make('recycle-arrows'),berry=make('recycle-item'),bits=make('recycle-fragments')
  function update(time){
    const c=socket('hand',true),u=clamp((time-.15)/.85)
    fit(arrows,c,r*1.55);arrows.clear();arrows.alpha=show(time,.1,1.6);arrows.rotation=time*.8
    for(let j=0;j<3;j++){const a=j*Math.PI*2/3-.5,d=r*(1-u*.12);arrows.moveTo(Math.cos(a)*d,Math.sin(a)*d).arc(0,0,d,a,a+1.2).stroke({color:j%2?0xa5d784:0xc7e9a3,width:4,cap:'round'});const b=a+1.2,x=Math.cos(b)*d,y=Math.sin(b)*d;arrows.poly([x,y,x+Math.cos(b-.8)*9,y+Math.sin(b-.8)*9,x+Math.cos(b+1.1)*9,y+Math.sin(b+1.1)*9]).fill(0xc7e9a3)}
    fit(berry,c,r*1.5);berry.clear();berry.alpha=show(time,.48,1.77)
    const s=.2+.8*clamp((time-.48)/.52);berry.scale.set(berry.scale.x*s);berry.ellipse(0,3,12,13).fill(0xe7b589).circle(-4,-1,4).fill(0xfbe0ad).moveTo(0,-9).quadraticCurveTo(4,-20,13,-15).quadraticCurveTo(7,-8,0,-9).fill(0xa7d082)
    fit(bits,c,r*1.65);bits.clear();bits.alpha=show(time,.14,1.27)
    for(let j=0;j<9;j++){const a=j*Math.PI*2/9+u,d=r*(1-u),x=Math.cos(a)*d,y=Math.sin(a)*d;bits.rect(x-2,y-2,4,4).fill(j%2?0xbad89a:0xebd8a4)}
  }
  onFrame(update);tl.call(()=>{update(1);onCue({type:'impact'})},[],1)

}
