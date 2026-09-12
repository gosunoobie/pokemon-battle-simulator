import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function highJumpKick(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const r = Math.min(41, Math.max(25, context.source.metrics.height / unit * .16))
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

  const hit=contact(.14,.32),a=hit.pose.rotation
  const hitCenter={x:hit.pose.x+center.x*Math.cos(a)-center.y*Math.sin(a),y:hit.pose.y+center.x*Math.sin(a)+center.y*Math.cos(a)}
  const peakAngle=-.015,c=Math.cos(peakAngle),s=Math.sin(peakAngle)
  const ceiling=top+(context.source.metrics.height*Math.abs(c)+context.source.metrics.width*Math.abs(s))/(2*unit)+2
  const peakCenter={x:center.x+(hitCenter.x-center.x)*.3,y:Math.max(ceiling,Math.min(center.y,hitCenter.y)-r*1.8)}
  const apex=fit({x:peakCenter.x-center.x*c+center.y*s,y:peakCenter.y-center.x*s-center.y*c,rotation:peakAngle})
  const lift=Math.max(0,hitCenter.y-peakCenter.y)
  const foot=new Container();foot.label='high-jump-kick-foot';foot.alpha=0;temporary.addChild(foot)
  foot.addChild(new Graphics().moveTo(-r*.55,-r*.72).lineTo(-r*.13,-r*.7).lineTo(-r*.15,-r*.22).lineTo(r*.75,-r*.13)
    .quadraticCurveTo(r,-r*.12,r,0).lineTo(r,r*.19).quadraticCurveTo(r*.44,r*.43,-r*.61,r*.2).closePath().fill(0xdcb99c).stroke({color:0xffe4c0,width:2,join:'round'})
    .moveTo(-r*.42,r*.1).quadraticCurveTo(r*.28,r*.3,r*.81,r*.12).stroke({color:0xa68167,width:1.7,cap:'round'}))
  const descent=new Graphics();descent.label='high-jump-kick-descent';descent.alpha=0;foot.addChildAt(descent,0)
  descent.moveTo(-r*.6,-r*2).lineTo(-r*.3,-r*.4).moveTo(-r*1.03,-r*1.7).lineTo(-r*.66,-r*.31).stroke({color:0xf6dfbd,width:2,alpha:.75,cap:'round'})
  const wedge=new Graphics().poly([-r*.46,-r*.75,-r*.11,-r*.14,0,-r*1.4,r*.14,-r*.13,r*.52,-r*.55,r*.23,r*.16,r*.1,r*1.08,-r*.09,r*.18]).fill(0xffe3b5)
  wedge.label='high-jump-kick-impact';wedge.position.copyFrom(hit.point);wedge.alpha=0;temporary.addChild(wedge)
  const rays=Array.from({length:18},()=>{const g=new Graphics().moveTo(0,-5).lineTo(0,3).stroke({color:random()<.5?0xe7c098:0xffe8bf,width:1.8,cap:'round'});g.alpha=0;temporary.addChild(g);return{g,vx:(random()-.5)*105,vy:45+random()*105,life:.3+random()*.23}})
  const update=time=>{follow(foot);for(const p of rays){const age=time-1.08,t=age/p.life;p.g.alpha=t>=0&&t<1?Math.sin(t*Math.PI)*.8:0;if(age>=0)p.g.position.set(hit.point.x+p.vx*age,hit.point.y+p.vy*age+35*age*age)}}
  onFrame(update)
  tl.to(attacker,{x:home.x-7,y:home.y+6,rotation:-.06,duration:.22},0)
    .to(attacker,{...apex,duration:.36,ease:'power3.out'},.22)
    .to(attacker,{x:apex.x+(hit.pose.x-apex.x)*.16,y:apex.y,rotation:peakAngle,duration:.2,ease:'none'},.58)
    .to(attacker,{...hit.pose,duration:.3,ease:'power3.in'},.78)
    .to(attacker,{x:hit.pose.x-r*.5,y:hit.pose.y-Math.min(r*.35,lift*.3),rotation:.02,duration:.18},1.2)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.62,ease:'power2.inOut'},1.38)
    .to(foot,{alpha:1,duration:.16},.36).to(foot,{alpha:0,duration:.23},1.28)
    .to(descent,{alpha:.85,duration:.12},.78).to(descent,{alpha:0,duration:.2},1.16)
    .to(wedge,{alpha:1,duration:.03},1.08).to(wedge.scale,{x:1.18,y:1.25,duration:.22},1.08).to(wedge,{alpha:0,duration:.27},1.17)
    .call(()=>{update(1.08);onCue({type:'impact'});defender.tint=0xefcda7},[],1.08)
    .to(defender,{x:defenderHome.x+Math.min(15,room),duration:.09,repeat:3,yoyo:true},1.08)
    .call(()=>{defender.tint=0xffffff},[],1.45)

}
