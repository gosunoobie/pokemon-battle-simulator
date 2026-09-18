import { Container, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// The reviewed continuous volley now uses lava balls twice as wide and tall.
// Each plume owns its captured launch and collision; all timing is cosmetic.
export const ERUPTION_ARRIVALS = Object.freeze([.94, 1.24, 1.78, 1.95, 2.35, 2.92, 3.23, 3.49, 4.06])
// A steady stream fills the quieter gaps; each crest sends a three-ball cluster.
const clustered = ERUPTION_ARRIVALS.flatMap(at => [at, at + .045, at + .09])
const steady = Array.from({ length: 24 }, (_, i) => .94 + i * .14).filter(at => !clustered.some(crest => Math.abs(at - crest) < .04))
export const ERUPTION_VOLLEY_ARRIVALS = Object.freeze([...clustered, ...steady].map(at => Number(at.toFixed(4))).sort((a, b) => a - b))
export const timing = Object.freeze({ contact: .94, duration: 4.75, markers: ERUPTION_ARRIVALS.map((timeSeconds, index) => ({ id: `lava-${index + 1}`, label: `Lava impact ${index + 1}`, timeSeconds })) })

export default function eruption(context) {
  const { tl, glowTexture, onFrame, onCue, layer, scene } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, world, unit } = bindEffectSpace(context)
  const base = temporary.toLocal({ x: 0, y: 0 }, layer), edge = temporary.toLocal({ x: scene.width, y: scene.height }, layer)
  const bounds = { left: Math.min(base.x, edge.x), right: Math.max(base.x, edge.x), top: Math.min(base.y, edge.y), bottom: Math.max(base.y, edge.y) }
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n))
  const fit = (point, radius) => ({ x: clamp(point.x, bounds.left + radius, bounds.right - radius), y: clamp(point.y, bounds.top + radius, bounds.bottom - radius) })
  const glow = (parent, width, height, tint, alpha = 1, label) => {
    const g = new Sprite(glowTexture); g.anchor.set(.5); g.width = width; g.height = height; g.tint = tint; g.alpha = alpha; g.blendMode = 'add'; g.label = label; parent.addChild(g); return g
  }
  const vent = glow(temporary, 100, 140, 0xff681d, 0, 'eruption-review-vent')
  const receiver = glow(temporary, 160, 140, 0xffa433, 0, 'eruption-review-receiver')
  const flow = { strength: 0 }
  tl.to(attacker, { y: home.y + 5, duration: .16 }, 0)
    .to(attacker, { y: home.y - 6, duration: .18, ease: 'power2.out' }, .16)
    .to(flow, { strength: 1, duration: .2 }, .16)
    .to(flow, { strength: 0, duration: .35 }, 3.82)
    .to(attacker, { y: home.y, duration: .38 }, 3.91)
  const lavas = [], debris = []
  ERUPTION_VOLLEY_ARRIVALS.forEach((arrive, index) => {
    const lane = index % 5 - 2, flight = .66 + index % 4 * .055, launch = arrive - flight
    const lava = new Container(); lava.label = `eruption-review-lava-${index + 1}`; lava.alpha = 0; temporary.addChild(lava)
    const size = 2 * (.66 + index % 4 * .11)
    const radius = Math.hypot(58 * size, 74 * size) / 2 + 2
    glow(lava, 58 * size, 74 * size, 0xff4818, .85); glow(lava, 31 * size, 39 * size, 0xffba39); glow(lava, 12 * size, 16 * size, 0xfff0af)
    lavas.push({ lava, lane, launch, arrive, flight, radius, source: null, impact: null, height: 84 + index % 5 * 19 })
    for (let j = 0; j < 6; j++) {
      const spark = glow(temporary, 8 + j % 3 * 2, 6 + j % 2 * 3, j % 2 ? 0xffc65b : 0xff751d, 0, `eruption-review-fleck-${index}-${j}`)
      const angle = j * Math.PI * 2 / 6 + index * .3
      debris.push({ spark, lavaIndex: index, arrive, vx: Math.cos(angle) * (80 + j % 3 * 22), vy: Math.sin(angle) * 65 - 50, life: .40 + j % 3 * .045 })
    }
  })
  // Capture sockets on the owned timeline, even when playback advances over a launch.
  lavas.forEach(item => tl.call(() => { item.source = fit(socket('vent', true), item.radius) }, [], item.launch))
  function update(time) {
    const source = fit(socket('vent', true), 74)
    vent.position.set(source.x, source.y - 12); vent.alpha = flow.strength * (.35 + .12 * Math.sin(time * 22) ** 2)
    const live = fit(targetSocket('center', true), 84)
    receiver.position.copyFrom(live)
    receiver.alpha = Math.max(0, ...ERUPTION_VOLLEY_ARRIVALS.map(at => time >= at ? .42 * (1 - (time - at) / .22) : 0))
    for (const item of lavas) {
      const age = time - item.launch, p = clamp(age / item.flight, 0, 1)
      if (age < 0) { item.lava.alpha = 0; continue }
      if (!item.source) item.source = fit(socket('vent', true), item.radius)
      const target = item.impact ?? fit({ x: live.x + item.lane * 13, y: live.y + item.lane * 7 }, item.radius)
      // Keep world-up apex and the entire elongated ember within the field.
      const headroom = Math.max(0, Math.min(item.source.y, target.y) - bounds.top - item.radius)
      const height = Math.min(item.height, headroom)
      const position = fit({ x: item.source.x + (target.x - item.source.x) * p,
        y: item.source.y + (target.y - item.source.y) * p - 4 * height * p * (1 - p) }, item.radius)
      item.lava.position.copyFrom(position)
      item.lava.rotation = Math.atan2(target.y - item.source.y - 4 * height * (1 - 2 * p), target.x - item.source.x) - Math.PI / 2
      item.lava.alpha = time < item.arrive ? Math.min(1, age / .04) : 0
      if (time >= item.arrive && !item.impact) item.impact = target
    }
    for (const item of debris) {
      const age = time - item.arrive, origin = lavas[item.lavaIndex].impact
      if (!origin || age < 0 || age >= item.life) { item.spark.alpha = 0; continue }
      item.spark.position.copyFrom(fit({ x: origin.x + item.vx * age, y: origin.y + item.vy * age + 100 * age * age }, 10))
      item.spark.alpha = (1 - age / item.life) ** .8
      item.spark.rotation = Math.atan2(item.vy + 200 * age, item.vx)
    }
  }
  onFrame(update)
  // Update contact geometry synchronously before the sole committed-result cue.
  tl.call(() => { update(timing.contact); onCue({ type: 'impact' }) }, [], timing.contact)
  ERUPTION_ARRIVALS.forEach(at => {
    tl.to(defender, { x: defenderHome.x + 5, duration: .045, repeat: 1, yoyo: true }, at)
      .set(defender, { x: defenderHome.x }, at + .10)
      .to(world, { y: 1.5, duration: .04, repeat: 1, yoyo: true }, at)
      .set(world, { x: 0, y: 0 }, at + .09)
  })
  tl.call(() => {}, [], timing.duration)
}
