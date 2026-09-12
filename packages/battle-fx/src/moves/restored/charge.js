import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function charge(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const aura = new Graphics(); aura.label = 'charge-aura'; temporary.addChild(aura)
  const climbs = new Graphics(); climbs.label = 'charge-climbing-arcs'; temporary.addChild(climbs)
  const tip = new Graphics().circle(0, 0, 2.5).fill(0xfff9bc); tip.label = 'charge-tip'; temporary.addChild(tip)
  const seal = new Graphics(); seal.label = 'charge-impact'; temporary.addChild(seal)
  const motes = Array.from({ length: 26 }, (_, i) => {
    const g = new Graphics().moveTo(-2, 1).lineTo(1, -1).lineTo(0, -3).stroke({ color: i % 3 ? 0xffe569 : 0xfaffd6, width: 1.5, cap: 'round' })
    g.label = 'charge-mote'; g.alpha = 0; temporary.addChild(g)
    return { g, angle: i * Math.PI * 2 / 26, start: random() * .34, speed: .4 + random() * .16 }
  })
  function update(time) {
    const c = socket('center', true), rx = Math.max(0, Math.min(context.source.metrics.width / unit * .61 + 10, c.x - left - 5, right - c.x - 5)), ry = Math.max(0, Math.min(context.source.metrics.height / unit * .56 + 9, c.y - top - 5, bottom - c.y - 5))
    const fade = clamp((time - .03) / .2) * (1 - clamp((time - 1.55) / .49)), stored = clamp((time - .7) / .25)
    aura.position.copyFrom(c); aura.clear(); aura.alpha = fade
    for (let i = 0; i < 3; i++) {
      const pulse = .62 + i * .145 + Math.sin(time * 9 - i) * .025
      aura.ellipse(0, 0, rx * pulse, ry * pulse).stroke({ color: i === 1 ? 0xfff4a3 : 0xf1c731, width: i === 1 ? 2.1 : 1.3, alpha: .28 + stored * .35 })
    }
    aura.ellipse(0, 0, rx * .8, ry * .8).fill({ color: 0xffda35, alpha: .035 + stored * .025 })
    climbs.position.copyFrom(c); climbs.clear(); climbs.alpha = fade
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1, phase = (time * 1.8 + i / 6) % 1, cy = ry * (.9 - phase * 1.8)
      for (let j = 0; j < 5; j++) {
        const y = Math.max(-ry * .96, Math.min(ry * .96, cy + (j - 2) * ry * .105)), shell = Math.sqrt(Math.max(0, 1 - (y / Math.max(1, ry)) ** 2)), x = side * rx * shell * (j % 2 ? .89 : .68)
        if (!j) climbs.moveTo(x, y); else climbs.lineTo(x, y)
      }
      climbs.stroke({ color: i % 3 ? 0xffe25c : 0xffffd4, width: 1.6 + stored * .6, alpha: .55 + .3 * Math.sin(phase * Math.PI), cap: 'round', join: 'round' })
    }
    motes.forEach(p => {
      const age = time - p.start, u = age / p.speed, orbit = p.angle + Math.max(0, u) * .48
      p.g.alpha = age >= 0 && u <= 1 && time < .95 ? Math.sin(clamp(u) * Math.PI) * fade : 0
      const radius = .98 - clamp(u) * .91
      p.g.position.set(c.x + Math.cos(orbit) * rx * radius, c.y + Math.sin(orbit) * ry * radius); p.g.rotation = orbit
    })
    tip.position.copyFrom(c); tip.alpha = fade * (.45 + stored * .55)
    seal.position.copyFrom(c); seal.clear(); const age = time - .95, u = clamp(age / .65)
    seal.alpha = age >= 0 && age < .65 ? 1 - u : 0
    seal.ellipse(0, 0, rx * (.25 + u * .64), ry * (.25 + u * .64)).stroke({ color: 0xfffabe, width: 2.8 - u, alpha: .9 })
  }
  onFrame(update)
  tl.call(() => { update(.95); onCue({ type: 'impact' }) }, [], .95)
    .to({}, { duration: 2.1 }, 0)
}
