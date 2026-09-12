import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function jumpKick(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const r = Math.min(39, Math.max(24, context.source.metrics.height / unit * .155))
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

  const hit=contact(.065,.28)
  const a=hit.pose.rotation,hitCenter={x:hit.pose.x+center.x*Math.cos(a)-center.y*Math.sin(a),y:hit.pose.y+center.x*Math.sin(a)+center.y*Math.cos(a)}
  const peakAngle=-.035,c=Math.cos(peakAngle),s=Math.sin(peakAngle)
  const ceiling=top+(context.source.metrics.height*Math.abs(c)+context.source.metrics.width*Math.abs(s))/(2*unit)+2
  const peakCenter={x:center.x+(hitCenter.x-center.x)*.48,y:Math.max(ceiling,Math.min(center.y,hitCenter.y)-r*.6)}
  const apex=fit({x:peakCenter.x-center.x*c+center.y*s,y:peakCenter.y-center.x*s-center.y*c,rotation:peakAngle})
  const lift=Math.max(0,hitCenter.y-peakCenter.y)
  const foot=new Container();foot.label='jump-kick-foot';foot.alpha=0;temporary.addChild(foot)
  foot.addChild(new Graphics().poly([-r*.7,-r*.35,-r*.28,-r*.39,-r*.1,-r*.15,r*.77,-r*.16,r,-r*.04,r,r*.16,r*.79,r*.27,-r*.61,r*.23])
    .fill(0xe4c6a6).stroke({color:0xffe9c8,width:1.8,join:'round'})
    .moveTo(-r*.5,r*.12).lineTo(r*.83,r*.12).stroke({color:0xae8e73,width:1.8,cap:'round'}))
  const rails=new Graphics();rails.label='jump-kick-rails';rails.alpha=0;foot.addChildAt(rails,0)
  rails.moveTo(-r*2.1,r*.6).lineTo(-r*.73,r*.21).moveTo(-r*1.9,r*.08).lineTo(-r*.76,-r*.12).stroke({color:0xdadfda,width:2,alpha:.75,cap:'round'})
  const flash=new Graphics().poly([-r*.6,0,-r*.08,-r*.11,r*.05,-r*.67,r*.24,-r*.12,r*1.5,0,r*.22,r*.13,r*.06,r*.67,-r*.08,r*.11]).fill(0xffe5be)
  flash.label='jump-kick-impact';flash.position.copyFrom(hit.point);flash.alpha=0;temporary.addChild(flash)
  const chips=Array.from({length:14},()=>{const g=new Graphics().poly([0,-1.5,8,0,0,1.5]).fill(random()<.5?0xe3c6a5:0xffe8c3);g.alpha=0;temporary.addChild(g);return{g,a:(random()-.5)*2.1,v:75+random()*90,life:.3+random()*.17}})
  const update=time=>{follow(foot);for(const p of chips){const age=time-.84,t=age/p.life;p.g.alpha=t>=0&&t<1?Math.sin(t*Math.PI)*.85:0;if(age>=0){p.g.position.set(hit.point.x+Math.cos(p.a)*p.v*age,hit.point.y+Math.sin(p.a)*p.v*age+45*age*age);p.g.rotation=p.a}}}
  onFrame(update)
  tl.to(attacker,{x:home.x-8,y:home.y+5,rotation:-.06,duration:.2},0)
    .to(attacker,{...apex,duration:.31,ease:'power2.out'},.2)
    .to(attacker,{...hit.pose,duration:.33,ease:'power2.in'},.51)
    .to(attacker,{x:hit.pose.x-r*.5,y:hit.pose.y-lift*.32,rotation:-.035,duration:.18},.97)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.52,ease:'power2.inOut'},1.15)
    .to(foot,{alpha:1,duration:.12},.3).to(foot,{alpha:0,duration:.2},1.05).to(rails,{alpha:1,duration:.13},.4)
    .to(flash,{alpha:1,duration:.03},.84).to(flash.scale,{x:1.22,y:1.12,duration:.18},.84).to(flash,{alpha:0,duration:.22},.92)
    .call(()=>{update(.84);onCue({type:'impact'});defender.tint=0xf0d4b3},[],.84)
    .to(defender,{x:defenderHome.x+Math.min(13,room),duration:.085,repeat:3,yoyo:true},.84)
    .call(()=>{defender.tint=0xffffff},[],1.19)

}
