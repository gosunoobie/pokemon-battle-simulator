import { Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Second local review: keep the thin thread, small translucent bubbles and
// alternating wavy lanes, with fresh bubbles and pops through the sound's end.
export const timing = Object.freeze({ contact: .78, duration: 2.48, markers: Object.freeze([
  { id: 'launch', label: 'Bubble stream begins', timeSeconds: .4 },
  { id: 'last-launch', label: 'Final fresh bubble launches', timeSeconds: 1.905 },
  { id: 'last-pop', label: 'Final bubble pops', timeSeconds: 2.285 },
  { id: 'splash-end', label: 'Last water droplets clear', timeSeconds: 2.445 },
]) })

export default function bubbleBeam(context) {
  const { tl, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, world, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges) + 5, right = Math.max(...edges) - 5
  const top = -temporary.y / unit + 5, bottom = (context.scene.height - temporary.y) / unit - 5
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y))
  const fit = (g, point, radius, scale = 1) => { g.position.copyFrom(point); g.scale.set(Math.min(scale, room(point) / radius)) }
  const sourceCenter = socket('visualCenter'), receiver = targetSocket('visualCenter')
  const sw = context.source.metrics.width / (2 * unit), tw = context.target.metrics.width / (2 * unit)
  const back = Math.max(0, Math.min(10, sourceCenter.x - sw - left)), thrust = Math.max(0, Math.min(8, right - sourceCenter.x - sw))
  const recoil = Math.max(0, Math.min(11, right - receiver.x - tw))
  const charge = new Sprite(glowTexture); charge.anchor.set(.5); charge.tint = 0x9ceaff; charge.blendMode = 'add'
  charge.label = 'bubble-beam-v2-charge'; charge.alpha = 0; temporary.addChild(charge)
  const thread = new Graphics(); thread.label = 'bubble-beam-v2-thread'; temporary.addChild(thread)
  const bubbles = [], drops = []
  for (let i = 0; i < 44; i++) {
    const radius = 6 + i % 3 * 2, lane = i % 2 ? 1 : -1, birth = .4 + i * .035, arrival = birth + .38
    const ball = new Graphics().circle(0, 0, radius).fill({ color: 0x73d8ff, alpha: .1 })
      .stroke({ color: 0xb8f2ff, width: 1.8, alpha: .8 })
      .circle(-radius * .3, -radius * .35, radius * .16).fill({ color: 0xf0fdff, alpha: .85 })
    ball.label = `bubble-beam-v2-bubble-${i}`; ball.alpha = 0; temporary.addChild(ball)
    const pop = new Graphics().circle(0, 0, radius).stroke({ color: 0xd6faff, width: 1.8, alpha: .85 })
    pop.label = `bubble-beam-v2-pop-${i}`; pop.alpha = 0; temporary.addChild(pop)
    const item = { ball, pop, radius, lane, birth, arrival, source: null, impact: null }; bubbles.push(item)
    if (i % 3 === 0 || i === 43) for (let j = 0; j < 4; j++) {
      const g = new Graphics().ellipse(0, 0, 2.5 + j % 2, 5 + j % 3).fill({ color: j % 2 ? 0xc0f4ff : 0x74cdf1, alpha: .85 })
      g.label = `bubble-beam-v2-drop-${i}-${j}`; g.alpha = 0; temporary.addChild(g)
      drops.push({ g, bubble: item, angle: j * Math.PI / 2, life: Math.min(.36 + j % 3 * .06, 2.445 - arrival) })
    }
    tl.call(() => { item.source = { ...socket('emission', true) }; update(birth) }, [], birth)
      .call(() => { item.impact = endPoint(item); update(arrival) }, [], arrival)
  }
  function endPoint(item) {
    const b = targetSocket('center', true), c = targetSocket('visualCenter', true), half = context.target.metrics.height / (2 * unit)
    return { x: b.x, y: clamp(b.y + item.lane * 8, Math.max(top + 2, c.y - half), Math.min(bottom - 2, c.y + half)) }
  }
  function update(time) {
    const source = socket('emission', true), target = targetSocket('center', true)
    charge.position.copyFrom(source); charge.width = Math.min(82, room(source) * 2); charge.height = Math.min(73.8, room(source) * 2)
    charge.alpha = .35 * clamp((time - .1) / .3, 0, 1) * clamp((2.16 - time) / .22, 0, 1)
    thread.position.copyFrom(source); thread.clear()
    const reach = clamp((time - .4) / .38, 0, 1), fade = clamp((2.17 - time) / .25, 0, 1)
    if (time >= .4 && fade > 0) for (const [width, alpha] of [[12, .1], [3, .22]]) {
      thread.moveTo(0, 0).lineTo((target.x - source.x) * reach, (target.y - source.y) * reach)
        .stroke({ width: Math.min(width, room(source) * 2, room(target) * 2), color: 0x58c2ed, alpha: alpha * fade, cap: 'round' })
    }
    for (const item of bubbles) {
      const age = time - item.birth, u = clamp(age / .38, 0, 1), a = item.source ?? source, b = item.impact ?? endPoint(item)
      const margin = Math.max(0, Math.min(Math.min(a.y, b.y) - top, bottom - Math.max(a.y, b.y)) - item.radius - 2)
      const offset = Math.sin(Math.PI * u) * Math.min(11, margin) * item.lane * Math.sin(u * Math.PI * 4)
      const q = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u + offset }
      fit(item.ball, q, item.radius + 2, .45 + .55 * clamp(age / .18, 0, 1))
      item.ball.alpha = age >= 0 && time < item.arrival ? .85 * clamp(age / .08, 0, 1) : 0
      const popAge = time - item.arrival, life = Math.min(.34, 2.445 - item.arrival)
      fit(item.pop, b, item.radius + 2, 1 + .55 * clamp(popAge / life, 0, 1))
      item.pop.alpha = item.impact && popAge >= 0 && popAge < life ? .7 * Math.min(1, (1 - popAge / life) / .7) : 0
    }
    for (const p of drops) {
      const age = time - p.bubble.arrival, u = age / p.life, origin = p.bubble.impact
      p.g.alpha = origin && u >= 0 && u < 1 ? .8 * Math.min(1, (1 - u) / .5) : 0
      if (!p.g.alpha) continue
      const distance = Math.min(p.bubble.radius * 2.4, room(origin) / 1.8)
      const q = { x: origin.x + Math.cos(p.angle) * distance * u,
        y: origin.y + Math.sin(p.angle) * distance * u + distance * .6 * u * u }
      fit(p.g, q, 8); p.g.rotation = p.angle + Math.PI / 2
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .2 }, 0)
    .to(attacker, { x: home.x + thrust, duration: .16 }, .2)
    .to(attacker, { x: home.x, duration: .3 }, 1.94)
    .call(() => { update(timing.contact); onCue({ type: 'impact' }); defender.tint = 0xb8eaf5 }, [], timing.contact)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 7, yoyo: true, ease: 'none' }, timing.contact)
    .call(() => { defender.tint = 0xffffff }, [], 1.02)
    .set(defender, { x: defenderHome.x }, 1.28)
    .set(world, { x: 0, y: 0 }, timing.duration)
    .call(() => {}, [], timing.duration)
}
