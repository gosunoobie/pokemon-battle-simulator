import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function megaKick(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const r = Math.min(43, Math.max(26, context.source.metrics.height / unit * .17))
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

  const hit = contact(.1, .24)
  const boot = new Container(); boot.label = 'mega-kick-foot'; boot.alpha = 0; temporary.addChild(boot)
  boot.addChild(new Graphics().poly([-r*.62,-r*.58,-r*.15,-r*.6,r*.05,-r*.2,r*.79,-r*.2,r,-r*.04,r,r*.18,r*.72,r*.29,-r*.51,r*.25])
    .fill(0xe8c59b).stroke({color:0xffeac4,width:2,join:'round'})
    .moveTo(-r*.45,r*.12).lineTo(r*.82,r*.12).moveTo(-r*.09,-r*.36).lineTo(-r*.25,-r*.05).stroke({color:0xa88462,width:2,cap:'round'}))
  const wake = new Graphics().moveTo(-r*2,-r*.2).lineTo(-r*.65,-r*.08).moveTo(-r*2.2,r*.24).lineTo(-r*.65,r*.16)
    .stroke({color:0xf4dcaf,width:2.2,alpha:.8,cap:'round'});boot.addChildAt(wake,0)
  const impact = new Graphics(); impact.label='mega-kick-impact';impact.position.copyFrom(hit.point);impact.alpha=0;temporary.addChild(impact)
  impact.poly([-r*.4,0,r*.15,-r*.2,r*.25,-r*.93,r*.45,-r*.28,r*1.4,-r*.1,r*.51,r*.13,r*.38,r*.83,r*.11,r*.24]).fill(0xffe6b0)
    .ellipse(0,0,r*.25,r*.64).stroke({color:0xe2bc86,width:3})
  const chips=Array.from({length:18},()=>{const g=new Graphics().poly([-3,-2,6,0,-2,3]).fill(random()<.5?0xd3b388:0xf5ddb1);g.alpha=0;temporary.addChild(g);return{g,a:(random()-.5)*2.8,v:75+random()*95,life:.3+random()*.24}})
  const update=time=>{follow(boot);for(const p of chips){const age=time-.82,t=age/p.life;p.g.alpha=t>=0&&t<1?Math.sin(t*Math.PI)*.85:0;if(age>=0){p.g.position.set(hit.point.x+Math.cos(p.a)*p.v*age,hit.point.y+Math.sin(p.a)*p.v*age+45*age*age);p.g.rotation=p.a+age*2}}}
  onFrame(update)
  tl.to(attacker,{x:home.x-15,y:home.y+3,rotation:-.1,duration:.3},0)
    .to(attacker,{x:hit.pose.x-r*.65,y:hit.pose.y+8,rotation:-.08,duration:.28},.3)
    .to(attacker,{...hit.pose,duration:.24,ease:'power4.in'},.58)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.6,ease:'power2.inOut'},1.08)
    .to(boot,{alpha:1,duration:.15},.3).to(boot,{alpha:0,duration:.22},1.02)
    .to(impact,{alpha:1,duration:.025},.82).to(impact.scale,{x:1.3,y:1.12,duration:.22},.82).to(impact,{alpha:0,duration:.28},.92)
    .call(()=>{update(.82);onCue({type:'impact'});defender.tint=0xefcea4},[],.82)
    .to(defender,{x:defenderHome.x+Math.min(16,room),duration:.085,repeat:3,yoyo:true},.82)
    .call(()=>{defender.tint=0xffffff},[],1.17)

}
