import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

export const timing = Object.freeze({ contact: 1.34, duration: 2.4, markers: [
  { id: 'lift', label: 'Five rendered rocks rise into orbit', timeSeconds: .16 },
  { id: 'launch', label: 'First orbiting rock launches', timeSeconds: .86 },
] })

export default function ancientPower(context) {
  const { tl, assets, random, onFrame, onCue, source, target, scene, layer } = context
  const { temporary, attacker, defender, home, defenderHome, focus, socket, targetSocket, captureActor, unit } = bindEffectSpace(context)
  const r = Math.min(22, Math.max(12, source.metrics.height / unit * .085))
  const hold = { x: home.x - 6, y: home.y, rotation: -.022 }
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
  const a = temporary.toLocal({ x: 0, y: 0 }, layer), b = temporary.toLocal({ x: scene.width, y: scene.height }, layer)
  const bounds = { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) }
  // The existing SVG has transparent padding. Compensate that padding so its visible
  // width AND height are exactly twice the previous review's measured rock artwork.
  const assetBounds = { x: 39.5, y: 23, width: 438.593, height: 468.81, viewSize: 512 }
  const visibleSize = 2 * (r * 1.72 + 2)
  const spriteSize = visibleSize * assetBounds.viewSize / assetBounds.height
  const extent = spriteSize / Math.SQRT2 + 2
  const width = source.metrics.width / unit, height = source.metrics.height / unit
  const fitPoint = (point, radius) => ({
    x: clamp(point.x, bounds.left + radius, bounds.right - radius),
    y: clamp(point.y, bounds.top + radius, bounds.bottom - radius),
  })
  function fitSource() {
    const c = Math.cos(attacker.rotation), s = Math.sin(attacker.rotation)
    const rx = (width * Math.abs(c) + height * Math.abs(s)) / 2, ry = (height * Math.abs(c) + width * Math.abs(s)) / 2
    const center = socket('visualCenter', true)
    attacker.x += clamp(center.x, bounds.left + rx, bounds.right - rx) - center.x
    attacker.y += clamp(center.y, bounds.top + ry, bounds.bottom - ry) - center.y
  }
  function orbitGeometry(center) {
    return {
      x: Math.max(1, Math.min(width * .54 + visibleSize * .45, center.x - bounds.left - extent, bounds.right - center.x - extent)),
      y: Math.max(1, Math.min(height * .25 + visibleSize * .12, center.y - bounds.top - extent, bounds.bottom - center.y - extent)),
    }
  }
  function orbitPoint(index, time, center) {
    const radius = orbitGeometry(center), angle = -Math.PI / 2 + index * Math.PI * 2 / 5 + (time - .16) * 1.45
    return { x: center.x + Math.cos(angle) * radius.x, y: center.y + Math.sin(angle) * radius.y, angle }
  }

  const field = new Container(); field.label = 'ancient-power-field'; field.alpha = 0; temporary.addChild(field)
  const circle = new Graphics(); field.addChild(circle)
  const motes = Array.from({ length: 12 }, (_, i) => {
    const g = new Graphics().poly([0, -3, 2, 0, 0, 3, -2, 0]).fill(i % 2 ? 0xe3d3b4 : 0xc5b3e1)
    field.addChild(g); return g
  })
  const rear = new Container(); rear.label = 'ancient-power-orbit-rear'; temporary.addChild(rear)
  const sourceCopy = captureActor(); sourceCopy.label = 'ancient-power-orbit-source'; sourceCopy.visible = false; temporary.addChild(sourceCopy)
  const front = new Container(); front.label = 'ancient-power-orbit-front'; temporary.addChild(front)
  const flights = new Container(); flights.label = 'ancient-power-flights'; temporary.addChild(flights)
  const stones = [], fragments = []
  for (let i = 0; i < 5; i++) {
    const stone = new Container(); stone.label = 'ancient-power-stone-' + i; stone.alpha = 0; front.addChild(stone)
    const artwork = new Sprite(assets.rock); artwork.label = 'ancient-power-rendered-rock-' + i
    artwork.anchor.set((assetBounds.x + assetBounds.width / 2) / assetBounds.viewSize, (assetBounds.y + assetBounds.height / 2) / assetBounds.viewSize)
    artwork.width = artwork.height = spriteSize; artwork.tint = i % 2 ? 0xbfa787 : 0xd1b997
    stone.addChild(artwork)
    const launch = .86 + i * .055, flight = .48
    const end = { x: focus.x + [0, -.4, .4, -.2, .2][i] * r, y: focus.y + [0, .2, -.2, -.5, .5][i] * r }
    const trail = new Graphics(); trail.alpha = 0; flights.addChildAt(trail, 0)
    stones.push({ stone, trail, start: .16 + i * .06, launch, flight, end, origin: null, collision: null, bow: (i - 2) * r * .35 })
    for (let j = 0; j < 6; j++) {
      const g = new Graphics().poly([-2, -1, 3, -2, 2, 2, -2, 3]).fill(j % 2 ? 0xdbcba5 : 0xb8a6d1)
      g.alpha = 0; temporary.addChild(g)
      fragments.push({ g, index: i, start: launch + flight, a: random() * Math.PI * 2, v: 45 + random() * 70, life: .35 + random() * .17 })
    }
  }
  const pulse = new Graphics().circle(0, 0, r * 1.4).stroke({ color: 0xe9d8b0, width: 2 }).circle(0, 0, r * .75).stroke({ color: 0xc8b6dc, width: 1.5 })
  pulse.label = 'ancient-power-impact'; pulse.alpha = 0; temporary.addChild(pulse)
  const pulseGrowth = { value: 1 }
  const targetCenter = targetSocket('visualCenter')
  const recoil = Math.max(0, Math.min(9, bounds.right - targetCenter.x - target.metrics.width / (2 * unit)))

  const update = time => {
    fitSource()
    const center = socket('visualCenter', true), radius = orbitGeometry(center), liveTarget = targetSocket('center', true)
    const dx = liveTarget.x - focus.x, dy = liveTarget.y - focus.y
    field.position.copyFrom(center)
    circle.clear().ellipse(0, 0, radius.x, radius.y).stroke({ color: 0xd7c08d, width: 1.6, alpha: .7 })
      .ellipse(0, 0, radius.x * .86, radius.y * .86).stroke({ color: 0xbba6d6, width: 1.3, alpha: .6 })
    motes.forEach((g, i) => {
      const angle = i * Math.PI / 6 + time * 1.8
      g.position.set(Math.cos(angle) * radius.x, Math.sin(angle) * radius.y); g.alpha = .5 + Math.sin(time * 7 + i) * .25
    })
    sourceCopy.position.set(attacker.x, attacker.y); sourceCopy.rotation = attacker.rotation
    sourceCopy.visible = time >= .16 && time < 1.08 && sourceCopy.children.length > 0
    for (let i = 0; i < stones.length; i++) {
      const p = stones[i], age = time - p.start, travel = time - p.launch, u = clamp(travel / p.flight, 0, 1)
      p.trail.clear(); p.trail.alpha = 0
      if (age < 0 || travel > p.flight + .07) { p.stone.alpha = 0; continue }
      p.stone.alpha = Math.min(1, age / .16) * Math.max(0, 1 - Math.max(0, travel - p.flight) / .07)
      if (travel < 0) {
        const orbit = orbitPoint(i, time, center), lift = Math.min(1, age / .4), ease = 1 - (1 - lift) ** 3
        const ground = socket('floor', true), point = fitPoint({ x: orbit.x, y: ground.y - visibleSize / 2 + (orbit.y - ground.y + visibleSize / 2) * ease }, extent)
        const owner = Math.sin(orbit.angle) < 0 ? rear : front
        if (p.stone.parent !== owner) owner.addChild(p.stone)
        p.stone.position.copyFrom(point); p.stone.rotation = Math.sin(time * 3 + p.start) * .12
      } else {
        p.origin ??= orbitPoint(i, p.launch, center)
        if (p.stone.parent !== flights) flights.addChild(p.stone)
        const destination = fitPoint({ x: p.end.x + dx, y: p.end.y + dy }, extent)
        if (travel >= p.flight - 1e-9 && !p.collision) p.collision = destination
        const end = p.collision ?? destination, v = u * u * (3 - 2 * u)
        const point = fitPoint({ x: p.origin.x + (end.x - p.origin.x) * v, y: p.origin.y + (end.y - p.origin.y) * v + Math.sin(Math.PI * v) * p.bow }, extent)
        p.stone.position.copyFrom(point); p.stone.rotation = Math.sin(p.launch * 3 + p.start) * .12 + travel * 3
        const back = Math.max(0, v - .07), tail = fitPoint({ x: p.origin.x + (end.x - p.origin.x) * back, y: p.origin.y + (end.y - p.origin.y) * back + Math.sin(Math.PI * back) * p.bow }, 2)
        p.trail.alpha = u < 1 ? .6 : 0
        p.trail.moveTo(tail.x, tail.y).lineTo(point.x, point.y).stroke({ color: 0xd6c49b, width: 2.3, cap: 'round' })
      }
    }
    const impact = stones[0].collision ?? fitPoint(liveTarget, extent)
    pulse.position.copyFrom(impact)
    const room = Math.min(impact.x - bounds.left, bounds.right - impact.x, impact.y - bounds.top, bounds.bottom - impact.y)
    pulse.scale.set(Math.min(pulseGrowth.value, Math.max(0, room - 2) / (r * 1.4 + 1)))
    for (const p of fragments) {
      const age = time - p.start, u = age / p.life
      p.g.alpha = u >= 0 && u < 1 ? Math.sin(Math.PI * u) * .85 : 0
      if (age >= 0) {
        const origin = stones[p.index].collision ?? fitPoint({ x: stones[p.index].end.x + dx, y: stones[p.index].end.y + dy }, extent)
        p.g.position.copyFrom(fitPoint({ x: origin.x + Math.cos(p.a) * p.v * age, y: origin.y + Math.sin(p.a) * p.v * age + 32 * age * age }, 5))
        p.g.rotation = p.a + age * 2
      }
    }
  }
  onFrame(update)
  tl.to(attacker, { ...hold, duration: .24 }, 0).to(attacker, { x: home.x, y: home.y, rotation: 0, duration: .5 }, 1.16)
    .to(field, { alpha: .8, duration: .28 }, .1).to(field, { alpha: 0, duration: .3 }, 1.02)
    .to(pulse, { alpha: .85, duration: .06 }, 1.34).to(pulseGrowth, { value: 1.6, duration: .4 }, 1.34).to(pulse, { alpha: 0, duration: .32 }, 1.5)
    .call(() => { update(1.34); onCue({ type: 'impact' }); defender.tint = 0xd6c7ab }, [], 1.34)
    .to(defender, { x: defenderHome.x + recoil, duration: .07, repeat: 5, yoyo: true }, 1.34).call(() => { defender.tint = 0xffffff }, [], 1.78)
    .call(() => {}, [], timing.duration)
  for (const p of stones) tl.call(() => update(p.launch), [], p.launch)
}
