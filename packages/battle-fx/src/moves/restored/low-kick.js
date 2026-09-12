import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function lowKick(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, socket, targetSocket, solveContact, unit } = bindEffectSpace(context)
  const r = Math.min(35, Math.max(21, context.source.metrics.height / unit * .14))
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

  const hit=contact(-.035,.78),swing={angle:-.3}
  const sole=new Container();sole.label='low-kick-foot';sole.alpha=0;temporary.addChild(sole)
  sole.addChild(new Graphics().moveTo(-r*.58,-r*.21).quadraticCurveTo(r*.36,-r*.29,r,-r*.06).lineTo(r,r*.11)
    .quadraticCurveTo(r*.27,r*.28,-r*.62,r*.13).closePath().fill(0xd0bb92).stroke({color:0xf1dfba,width:1.8,join:'round'})
    .moveTo(-r*.39,r*.06).lineTo(r*.73,r*.06).stroke({color:0x9d8b67,width:1.5}))
  const crescent=new Graphics();crescent.label='low-kick-impact';crescent.position.copyFrom(hit.point);crescent.alpha=0;temporary.addChild(crescent)
  crescent.moveTo(-r*1.8,-r*.12).quadraticCurveTo(-r*.5,r*.6,r*.88,r*.05).stroke({color:0xe9d5ae,width:5,alpha:.8,cap:'round'})
    .moveTo(-r*1.48,-r*.27).quadraticCurveTo(-r*.4,r*.25,r*.7,-r*.1).stroke({color:0xffedc9,width:1.6,cap:'round'})
  const grit=Array.from({length:16},()=>{const g=new Graphics().ellipse(0,0,2+random()*2,1.4).fill(0xc5b58f);g.alpha=0;temporary.addChild(g);return{g,dx:20+random()*67,hop:5+random()*10,life:.27+random()*.18}})
  const update=time=>{follow(sole,swing.angle);for(const p of grit){const t=(time-.56)/p.life;p.g.alpha=t>=0&&t<1?Math.sin(t*Math.PI)*.68:0;if(t>=0)p.g.position.set(hit.point.x+p.dx*t,hit.point.y+7-p.hop*Math.sin(Math.min(1,t)*Math.PI))}}
  onFrame(update)
  tl.to(attacker,{x:home.x-6,y:home.y+5,rotation:-.055,duration:.18},0)
    .to(attacker,{x:hit.pose.x-r*.7,y:hit.pose.y+3,rotation:-.07,duration:.2},.18)
    .to(attacker,{...hit.pose,duration:.18,ease:'power2.in'},.38)
    .to(swing,{angle:0,duration:.18},.38)
    .to(attacker,{x:home.x,y:home.y,rotation:0,duration:.43,ease:'power2.inOut'},.75)
    .to(sole,{alpha:1,duration:.1},.24).to(sole,{alpha:0,duration:.18},.68)
    .to(crescent,{alpha:1,duration:.035},.49).to(crescent.scale,{x:1.2,y:1.1,duration:.2},.56).to(crescent,{alpha:0,duration:.22},.65)
    .call(()=>{update(.56);onCue({type:'impact'});defender.tint=0xe1d0aa},[],.56)
    .to(defender,{x:defenderHome.x+Math.min(7,room),duration:.07},.56).to(defender,{x:defenderHome.x,duration:.26},.68)
    .call(()=>{defender.tint=0xffffff},[],.85)

}
