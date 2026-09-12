import { Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function hiddenPower(context) {
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

  const palette=[0xf0d397,0xbcdaf5,0xd1b4ea,0xa6e1d2,0xf0b5cc,0xd6e7a0]
  const r=Math.min(48,Math.max(32,context.source.metrics.height/unit*.21))
  const lattice=new Graphics();lattice.label='hidden-power-charge';lattice.alpha=0;temporary.addChild(lattice)
  const beads=palette.map((color,i)=>{
    const g=new Graphics();g.label=`hidden-power-orb-${i}`;g.alpha=0;temporary.addChild(g)
    const halo=new Sprite(glowTexture);halo.anchor.set(.5);halo.tint=color;halo.blendMode='add';halo.alpha=0;temporary.addChildAt(halo,0)
    const trail=new Graphics();trail.alpha=0;temporary.addChild(trail)
    const burst=new Graphics();burst.label=`hidden-power-impact-${i}`;burst.alpha=0;temporary.addChild(burst)
    return{g,halo,trail,burst,color,i,at:.48+i*.07,start:null,hit:null}
  })
  function flight(p,time){
    const from=p.start??socket('emission',true),to=p.hit??targetSocket('center',true),u=clamp((time-p.at)/.52),radius=Math.min(r*.48,room(from)*.5,room(to)*.5)
    return{x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u+Math.sin(Math.PI*u)*Math.sin(u*Math.PI*2+p.i*Math.PI/3)*radius}
  }
  function update(time){
    const mouth=socket('emission',true),chargeRadius=Math.min(r,room(mouth)/1.35)
    lattice.clear();lattice.position.copyFrom(mouth);lattice.alpha=time>=.08&&time<.91?Math.min(1,(time-.08)*7)*Math.min(1,(.91-time)*7)*.65:0
    for(let j=0;j<6;j++){const a=j*Math.PI/3+time*2.8,b=a+.52;lattice.moveTo(Math.cos(a)*chargeRadius,Math.sin(a)*chargeRadius*.7).lineTo(Math.cos(b)*chargeRadius,Math.sin(b)*chargeRadius*.7).stroke({color:palette[j],width:2,alpha:.7})}
    for(const p of beads){
      const age=time-p.at,u=clamp(age/.52),charged=time<p.at,phase=p.i*Math.PI/3+time*3.8,orbit=chargeRadius*(1-clamp((time-p.at+.17)/.17))
      const point=charged?{x:mouth.x+Math.cos(phase)*orbit,y:mouth.y+Math.sin(phase)*orbit*.7}:flight(p,time)
      const size=Math.min(10.5,Math.max(7,context.source.metrics.height/unit*.045),room(point)/1.65)
      p.g.position.copyFrom(point);p.g.alpha=time>=.07&&age<.56?Math.min(1,(time-.07)*8)*Math.min(1,Math.max(0,.56-age)*25):0
      p.g.clear().circle(0,0,size).fill(p.color).circle(-size*.2,-size*.2,size*.56).fill(0xfffbed)
      p.halo.position.copyFrom(point);p.halo.width=p.halo.height=size*3.2;p.halo.alpha=p.g.alpha*.55
      p.trail.clear();p.trail.alpha=age>=0&&age<.56?p.g.alpha*.6:0
      for(let j=1;j<=4;j++){const a=flight(p,Math.max(p.at,time-j*.026)),b=flight(p,Math.max(p.at,time-(j-1)*.026)),width=Math.min(size*.6,room(a),room(b));p.trail.moveTo(a.x,a.y).lineTo(b.x,b.y).stroke({color:p.color,width,alpha:1-j*.18,cap:'round'})}
      const since=age-.52,q=clamp(since/.5);p.burst.clear();p.burst.alpha=p.hit&&since>=0&&since<.5?1-q:0
      if(p.hit){const radius=Math.min(r*.7,room(p.hit)/1.6);p.burst.position.copyFrom(p.hit)
        p.burst.circle(0,0,radius*(.18+q)).stroke({color:p.color,width:2*(1-q)+.5,alpha:.8})
        for(let j=0;j<4;j++){const a=j*Math.PI/2+p.i*.7+q*.8,d=radius*(.3+q*.9);p.burst.circle(Math.cos(a)*d,Math.sin(a)*d,Math.min(2.5,room(p.hit)/8)*(1-q*.6)).fill(p.color)}}
    }
  }
  onFrame(update)
  tl.to(attacker,{x:home.x-back,duration:.2},0).to(attacker,{x:home.x+thrust,duration:.18},.25)
  for(const p of beads){tl.call(()=>{p.start=socket('emission',true);update(p.at)},[],p.at)
    .call(()=>{p.hit=targetSocket('center',true);update(p.at+.52);if(p.i===5)onCue({type:'impact'});defender.tint=p.color},[],p.at+.52)
    .to(defender,{x:defenderHome.x+recoil*.55,duration:.025,repeat:1,yoyo:true},p.at+.52)
    .call(()=>{defender.tint=0xffffff},[],p.at+.58)}
  tl.to(attacker,{x:home.x,duration:.35,ease:'power2.inOut'},1.43)

}
