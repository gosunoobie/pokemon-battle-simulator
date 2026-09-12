import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function rollingKick(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const r = Math.min(36, Math.max(22, context.source.metrics.height / unit * .145))
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const xs = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...xs), right = Math.max(...xs), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  function fit(p) {
    const w = context.source.metrics.width / unit, h = context.source.metrics.height / unit
    let angle = p.rotation, c, s, rx, ry
    for (let i = 0; i < 12; i++) {
      c = Math.cos(angle); s = Math.sin(angle); rx = (w * Math.abs(c) + h * Math.abs(s)) / 2; ry = (h * Math.abs(c) + w * Math.abs(s)) / 2
      if (rx * 2 <= right - left && ry * 2 <= bottom - top) break
      angle *= .5
    }
    const x = p.x + center.x * c - center.y * s, y = p.y + center.x * s + center.y * c
    return { x: p.x + Math.max(left + rx, Math.min(right - rx, x)) - x, y: p.y + Math.max(top + ry, Math.min(bottom - ry, y)) - y, rotation: angle }
  }
  function contact(angle, low = 0, stretch = 1, swing = 0) {
    const pose = fit(solveContact('foot', angle, { x: focus.x - Math.cos(angle + swing) * r * stretch, y: focus.y + (floor.y - focus.y) * low - Math.sin(angle + swing) * r * stretch }))
    const a = pose.rotation, foot = socket('foot')
    return { pose, point: { x: pose.x + foot.x * Math.cos(a) - foot.y * Math.sin(a) + r * stretch * Math.cos(a + swing), y: pose.y + foot.x * Math.sin(a) + foot.y * Math.cos(a) + r * stretch * Math.sin(a + swing) } }
  }
  function follow(foot, swing = 0, stretch = 1) {
    const p = fit({ x: attacker.x, y: attacker.y, rotation: attacker.rotation })
    attacker.position.set(p.x, p.y); attacker.rotation = p.rotation
    foot.position.copyFrom(socket('foot', true)); foot.rotation = attacker.rotation + swing; foot.scale.set(stretch)
  }
  const room = Math.max(0, right - targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center').x - context.target.metrics.width / (2 * unit))

  const hit=contact(.14,.3),motion={turn:0},swing={angle:-2.4}
  const boot=new Container();boot.label='rolling-kick-foot';boot.alpha=0;temporary.addChild(boot)
  boot.addChild(new Graphics().moveTo(-r*.52,-r*.57).lineTo(-r*.14,-r*.53).quadraticCurveTo(-r*.24,-r*.07,r*.7,-r*.22)
    .quadraticCurveTo(r,-r*.21,r,0).lineTo(r,r*.16).quadraticCurveTo(r*.21,r*.43,-r*.59,r*.2).closePath().fill(0xe0bd91).stroke({color:0xfbe3ba,width:2,join:'round'})
    .moveTo(-r*.37,r*.11).quadraticCurveTo(r*.4,r*.27,r*.82,r*.07).stroke({color:0xa78464,width:1.7,cap:'round'}))
  const arcs=new Graphics();arcs.label='rolling-kick-turn';arcs.alpha=0;temporary.addChild(arcs)
  const impact=new Graphics().ellipse(0,0,r*.65,r*.24).stroke({color:0xf7ddb0,width:4});impact.label='rolling-kick-impact';impact.position.copyFrom(hit.point);impact.alpha=0;temporary.addChild(impact)
  const flecks=Array.from({length:14},(_,i)=>{const g=new Graphics().poly([0,-2,9,0,0,2]).fill(i%2?0xe1c397:0xffe8bd);g.alpha=0;temporary.addChild(g);return{g,a:-1.25+random()*2.3,speed:60+random()*90,life:.3+random()*.2}})
  const update=time=>{
    follow(boot,swing.angle);arcs.clear();const c=socket(context.source.hasAnchor?.('visualCenter')?'visualCenter':'center',true);arcs.position.copyFrom(c)
    for(let i=0;i<3;i++){const a=motion.turn+i*2.1,rx=r*(1.25+i*.24),ry=r*(.52+i*.09);for(let j=0;j<=18;j++){const t=a+j/18*1.45,x=Math.cos(t)*rx,y=Math.sin(t)*ry;j?arcs.lineTo(x,y):arcs.moveTo(x,y)}arcs.stroke({color:i%2?0xf6ddb0:0xc5a883,width:i===0?3:1.7,alpha:.8,cap:'round'})}
    for(const p of flecks){const age=time-.86,t=age/p.life;p.g.alpha=t>=0&&t<1?Math.sin(t*Math.PI)*.85:0;if(age>=0){p.g.position.set(hit.point.x+Math.cos(p.a)*p.speed*age,hit.point.y+Math.sin(p.a)*p.speed*age+30*age*age);p.g.rotation=p.a+age*3}}
  }
  onFrame(update)
  // A bounded body pivot and a full circle in the moving arcs convey a roundhouse;
  // no Rollout ball, shrinking, or unbounded full-sprite somersault is used.
  tl.to(attacker,{x:home.x-8,rotation:-.16,duration:.22},0)
    .to(attacker,{x:hit.pose.x-r*.65,y:hit.pose.y+5,rotation:-.2,duration:.36},.22)
    .to(attacker,{...hit.pose,duration:.28,ease:'power2.in'},.58)
    .to(motion,{turn:Math.PI*2,duration:.7,ease:'power2.inOut'},.18)
    .to(swing,{angle:0,duration:.4,ease:'power2.in'},.46)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.57,ease:'power2.inOut'},1.03)
    .to(boot,{alpha:1,duration:.13},.24).to(boot,{alpha:0,duration:.22},.98)
    .to(arcs,{alpha:.8,duration:.13},.22).to(arcs,{alpha:0,duration:.24},.88)
    .to(impact,{alpha:1,duration:.035},.86).to(impact.scale,{x:1.35,y:1.8,duration:.24},.86).to(impact,{alpha:0,duration:.22},.94)
    .call(()=>{update(.86);onCue({type:'impact'});defender.tint=0xeaca9e},[],.86)
    .to(defender,{x:defenderHome.x+Math.min(11,room),duration:.07,repeat:3,yoyo:true},.86)
    .call(()=>{defender.tint=0xffffff},[],1.15)

}
