import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function magicCoat(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x-left, right-p.x, p.y-top, bottom-p.y)-4)
  const fit = (g,p,extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1,room(p)/extent)) }
  const clamp = x => Math.max(0,Math.min(1,x))

  const r=Math.min(73,Math.max(43,context.source.metrics.height/unit*.32))
  const coat=new Container();coat.label='magic-coat-veil';coat.alpha=0;temporary.addChild(coat)
  const veil=new Graphics(),mesh=new Graphics();coat.addChild(veil,mesh)
  const sparks=Array.from({length:8},(_,i)=>{const g=new Graphics().poly([0,-3,1,-1,3,0,1,1,0,3,-1,1,-3,0,-1,-1]).fill(i%2?0xffd1e9:0xdbc7f6);coat.addChild(g);return g})
  function update(time){
    fit(coat,socket('aura',true),r*1.6);veil.clear();mesh.clear();const sweep=clamp((time-.1)/.65)
    for(const side of [-1,1]){
      veil.moveTo(side*r*.26,-r*.8).bezierCurveTo(side*r*.94,-r*.35,side*r*.8,r*.38,side*r*.6,r*.76*sweep).stroke({color:0xd29bcf,width:5,alpha:.13,cap:'round'})
        .moveTo(side*r*.26,-r*.8).bezierCurveTo(side*r*.94,-r*.35,side*r*.8,r*.38,side*r*.6,r*.76*sweep).stroke({color:0xf4c2e3,width:1.5,alpha:.72,cap:'round'})
    }
    for(let i=0;i<5;i++){const y=r*(-.5+i*.25),w=r*(.42-Math.abs(i-2)*.055);mesh.moveTo(-w,y).lineTo(0,y-r*.12).lineTo(w,y).lineTo(0,y+r*.12).closePath().stroke({color:i%2?0xdcb6ee:0xf2c7e6,width:1.1,alpha:.23+Math.sin(time*3+i)**2*.2})}
    sparks.forEach((g,i)=>{const age=time-.4-i*.09,u=clamp(age/.85),side=i%2?1:-1;const distance=u<.5?1.2-u:.7+(u-.5)*.9;g.position.set(side*r*distance,r*((i%4-1.5)*.28+Math.sin(u*Math.PI)*.04));g.alpha=age>=0&&age<.85?Math.sin(Math.PI*u)*.9:0;g.scale.set(r/73);g.rotation=time})
  }
  onFrame(update)
  tl.to(coat,{alpha:1,duration:.35},.06).to(coat,{alpha:0,duration:.45},1.82).call(()=>{update(1.05);onCue({type:'impact'})},[],1.05)

}
