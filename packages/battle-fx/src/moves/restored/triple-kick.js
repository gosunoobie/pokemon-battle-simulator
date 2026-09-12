import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function tripleKick(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const r = Math.min(29, Math.max(18, context.source.metrics.height / unit * .115))
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

  const stretch={value:1},scales=[1,1.15,1.3],times=[.5,.84,1.2]
  const hits=[contact(.03,.72,1),contact(-.035,.4,1.15),contact(.07,.08,1.3)]
  const foot=new Container();foot.label='triple-kick-foot';foot.alpha=0;temporary.addChild(foot)
  foot.addChild(new Graphics().moveTo(-r*.56,-r*.43).lineTo(-r*.19,-r*.45).lineTo(-r*.01,-r*.14).lineTo(r*.75,-r*.19)
    .quadraticCurveTo(r,-r*.14,r,0).lineTo(r,r*.14).lineTo(r*.48,r*.28).lineTo(-r*.54,r*.21).closePath().fill(0xdfbba0).stroke({color:0xffe4cb,width:1.7,join:'round'})
    .moveTo(-r*.39,r*.1).lineTo(r*.75,r*.1).stroke({color:0xa7826a,width:1.4}))
  const bursts=hits.map((hit,i)=>{const g=new Graphics(),points=[];for(let j=0;j<14;j++){const a=j*Math.PI/7,d=r*(j%2?.24:.95+i*.22);points.push(Math.cos(a)*d,Math.sin(a)*d)}
    g.poly(points).fill(i===2?0xffe8c2:0xe5c1a0).ellipse(0,0,r*.24,r*.52).stroke({color:0xfff0d5,width:1.8});g.label=`triple-kick-impact-${i}`;g.position.copyFrom(hit.point);g.alpha=0;temporary.addChild(g);return g})
  const arcs=new Graphics();arcs.label='triple-kick-arcs';arcs.alpha=0;foot.addChildAt(arcs,0)
  const splinters=hits.flatMap((hit,i)=>Array.from({length:8+i*3},()=>{const g=new Graphics().poly([0,-1.5,6,0,0,1.5]).fill(i===2?0xffe9bf:0xd1b095);g.alpha=0;temporary.addChild(g);return{g,point:hit.point,at:times[i],a:random()*Math.PI*2,v:45+random()*(50+i*18),life:.26+random()*.15}}))
  const update=time=>{follow(foot,0,stretch.value);arcs.clear();for(let i=0;i<2;i++)arcs.arc(0,0,r*(.85+i*.25),1.9+Math.sin(time*8)*.18,4.1).stroke({color:i?0xf0d4b5:0xc9a486,width:1.7,alpha:.8});for(const p of splinters){const age=time-p.at,t=age/p.life;p.g.alpha=t>=0&&t<1?Math.sin(t*Math.PI)*.83:0;if(age>=0){p.g.position.set(p.point.x+Math.cos(p.a)*p.v*age,p.point.y+Math.sin(p.a)*p.v*age+35*age*age);p.g.rotation=p.a}}}
  onFrame(update)
  tl.to(attacker,{x:home.x-8,rotation:-.06,duration:.16},0).to(attacker,{...hits[0].pose,duration:.34,ease:'power3.in'},.16)
    .to(attacker,{x:hits[0].pose.x-r*.65,y:hits[0].pose.y+3,rotation:-.08,duration:.12},.54).to(attacker,{...hits[1].pose,duration:.18,ease:'power3.in'},.66)
    .to(attacker,{x:hits[1].pose.x-r*.75,y:hits[1].pose.y+4,rotation:-.09,duration:.13},.88).to(attacker,{...hits[2].pose,duration:.19,ease:'power3.in'},1.01)
    .to(stretch,{value:scales[1],duration:.12},.54).to(stretch,{value:scales[2],duration:.13},.88)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.55,ease:'power2.inOut'},1.45)
    .to(foot,{alpha:1,duration:.12},.2).to(foot,{alpha:0,duration:.25},1.38).to(arcs,{alpha:.7,duration:.12},.22)
  hits.forEach((hit,i)=>{const at=times[i],g=bursts[i];tl.to(g,{alpha:1,duration:.025},at).to(g.scale,{x:1.2,y:1.2,duration:.18},at).to(g,{alpha:0,duration:.19},at+.06)
    .call(()=>{update(at);if(i===2)onCue({type:'impact'});defender.tint=i===2?0xf2d0ac:0xe5c0a0},[],at)
    .to(defender,{x:defenderHome.x+Math.min(6+i*3,room),duration:.055,repeat:1,yoyo:true},at)
    .call(()=>{defender.tint=0xffffff},[],at+.15)})

}
