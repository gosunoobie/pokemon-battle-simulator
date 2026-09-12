import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function dragonDance(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, attacker, home, unit } = bindEffectSpace(context)
  const rx=Math.min(108,Math.max(45,context.source.metrics.width/unit*.54))
  const ry=Math.min(112,Math.max(48,context.source.metrics.height/unit*.48))
  const baseCenter=socket('center')
  const aura=new Container();aura.label='dragon-dance-aura';aura.alpha=0;temporary.addChild(aura)
  const ribbons=[new Graphics(),new Graphics()];aura.addChild(...ribbons)
  const scales=[]
  for(let i=0;i<16;i++){
    const g=new Graphics().poly([0,-5,3,0,0,5,-3,0]).fill(i%2?0xa9e2e8:0xd6b8ef)
    aura.addChild(g);scales.push(g)
  }
  const update=time=>{
    // Rotate around the supplied visible center, keeping a wide/tall actor's feet pivot from swinging it sideways.
    const u=Math.max(0,Math.min(1,(time-.2)/1.65)),active=u>0&&u<1,weight=active?Math.sin(Math.PI*u):0
    const angle=Math.sin(u*Math.PI*4)*.055*weight,cos=Math.cos(angle),sin=Math.sin(angle)
    const dx=Math.sin(u*Math.PI*4)*Math.min(10,rx*.1)*weight,dy=-(Math.sin(u*Math.PI*2)**2)*5*weight
    attacker.rotation=angle;attacker.x=weight?home.x+dx+baseCenter.x-(baseCenter.x*cos-baseCenter.y*sin):home.x
    attacker.y=weight?home.y+dy+baseCenter.y-(baseCenter.x*sin+baseCenter.y*cos):home.y
    aura.position.copyFrom(socket('center',true))
    ribbons.forEach((g,i)=>{
      g.clear()
      for(let j=0;j<=36;j++){
        const v=j/36,a=v*Math.PI*1.7+time*3.8+i*Math.PI
        const x=Math.cos(a)*rx*(.78-v*.2),y=ry*(.78-v*1.5)+Math.sin(a)*12
        if(j===0)g.moveTo(x,y);else g.lineTo(x,y)
      }
      g.stroke({color:i?0xd3b5ee:0xa3dfe8,width:3,alpha:.65})
    })
    scales.forEach((g,i)=>{
      const a=i*Math.PI/8+time*3.8,v=(i/16+time*.32)%1
      g.position.set(Math.cos(a)*rx*.76,ry*(.8-v*1.6)+Math.sin(a)*10)
      g.rotation=a;g.scale.set(.65+Math.sin(a)**2*.3);g.alpha=Math.sin(Math.PI*v)*.8
    })
  }
  onFrame(update)
  tl.to(aura,{alpha:1,duration:.32},.12).to(aura,{alpha:0,duration:.43},1.77)
    .call(()=>{update(.92);onCue({type:'impact'})},[],.92)
}
