import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function ironDefense(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(70,Math.max(42,context.source.metrics.height/unit*.32))
  const armor=new Container();armor.label='iron-defense-armor';armor.alpha=0;temporary.addChild(armor)
  const plates=Array.from({length:4},(_,i)=>{const g=new Graphics().poly([-20,-12,14,-12,22,-4,16,12,-20,12,-25,4]).fill({color:0x8caabf,alpha:.3}).stroke({color:0xe0edf3,width:1.7,alpha:.9}).moveTo(-19,-8).lineTo(12,-8).lineTo(17,-3).stroke({color:0xc4dce9,width:2,alpha:.65});armor.addChild(g);return g})
  const glints=new Graphics();armor.addChild(glints)
  function update(time){
    fit(armor,socket('aura',true),r*1.6)
    plates.forEach((g,i)=>{const a=i*Math.PI/2,u=clamp((time-.12-i*.1)/.58),rad=r*(1.04-u*.31);g.position.set(Math.cos(a)*rad,Math.sin(a)*rad*.83);g.rotation=a+(1-u)*Math.PI/2;g.scale.set(r/70)})
    glints.clear()
    for(let i=0;i<2;i++){const a=time*2.5+i*Math.PI,x=Math.cos(a)*r*.73,y=Math.sin(a)*r*.61,s=r*.1;glints.moveTo(x-s,y).lineTo(x+s,y).moveTo(x,y-s).lineTo(x,y+s).stroke({color:0xf4fcff,width:2,alpha:.85,cap:'round'})}
  }
  onFrame(update)
  tl.to(armor,{alpha:1,duration:.25},.08).to(armor,{alpha:0,duration:.38},1.74).call(()=>{update(1);onCue({type:'impact'})},[],1)

}
