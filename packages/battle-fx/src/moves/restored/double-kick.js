import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function doubleKick(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const r = Math.min(34, Math.max(21, context.source.metrics.height / unit * .135))
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

  const hits=[contact(.05,.56),contact(-.045,.18)],times=[.52,.94]
  const foot=new Container();foot.label='double-kick-foot';foot.alpha=0;temporary.addChild(foot)
  foot.addChild(new Graphics().poly([-r*.6,-r*.43,-r*.19,-r*.47,-r*.03,-r*.17,r*.75,-r*.18,r,-r*.05,r,r*.17,r*.64,r*.28,-r*.56,r*.22])
    .fill(0xe0c09e).stroke({color:0xf6dfbd,width:1.8,join:'round'})
    .moveTo(-r*.43,r*.09).lineTo(r*.81,r*.09).moveTo(r*.65,-r*.13).lineTo(r*.66,r*.02).stroke({color:0xad896b,width:1.5}))
  const stamps=hits.map((hit,i)=>{const g=new Graphics().ellipse(0,0,r*.38,r*(.6+i*.13)).stroke({color:i?0xffeac5:0xd9b991,width:3})
    .moveTo(r*.16,-r*.6).lineTo(r*.6,-r*.78).moveTo(r*.21,r*.59).lineTo(r*.64,r*.77).stroke({color:0xf2d7ac,width:2});g.label=`double-kick-impact-${i}`;g.position.copyFrom(hit.point);g.alpha=0;temporary.addChild(g);return g})
  const specks=hits.flatMap((hit,i)=>Array.from({length:9},()=>{const g=new Graphics().circle(0,0,2+random()).fill(i?0xffe5b9:0xc5a583);g.alpha=0;temporary.addChild(g);return{g,point:hit.point,at:times[i],a:(random()-.5)*2.8,v:60+random()*60,life:.25+random()*.15}}))
  const update=time=>{follow(foot);for(const p of specks){const age=time-p.at,t=age/p.life;p.g.alpha=t>=0&&t<1?Math.sin(t*Math.PI)*.8:0;if(age>=0)p.g.position.set(p.point.x+Math.cos(p.a)*p.v*age,p.point.y+Math.sin(p.a)*p.v*age+30*age*age)}}
  onFrame(update)
  tl.to(attacker,{x:home.x-7,rotation:-.05,duration:.16},0).to(attacker,{...hits[0].pose,duration:.36,ease:'power3.in'},.16)
    .to(attacker,{x:hits[0].pose.x-r*.75,y:hits[0].pose.y+4,rotation:-.09,duration:.16},.56)
    .to(attacker,{...hits[1].pose,duration:.22,ease:'power3.in'},.72)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.5,ease:'power2.inOut'},1.14)
    .to(foot,{alpha:1,duration:.1},.2).to(foot,{alpha:0,duration:.2},1.08)
  hits.forEach((hit,i)=>{const at=times[i],g=stamps[i];tl.to(g,{alpha:1,duration:.025},at).to(g.scale,{x:1.25,y:1.13,duration:.16},at).to(g,{alpha:0,duration:.18},at+.055)
    .call(()=>{update(at);if(i===1)onCue({type:'impact'});defender.tint=i?0xf5ddbc:0xe3c29a},[],at)
    .to(defender,{x:defenderHome.x+Math.min(i?11:7,room),duration:.055,repeat:1,yoyo:true},at)
    .call(()=>{defender.tint=0xffffff},[],at+.14)})

}
