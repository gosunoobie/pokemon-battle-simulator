import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function doomDesire(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const fit = (g, p, radius) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / radius)) }
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const root = make('doom-desire-root'), origin = make('doom-desire-strike-origin'), constellation = make('doom-desire-constellation')
  root.attachmentSocket = 'emission'
  const gather = Array.from({ length: 18 }, (_, i) => ({ g: make(`doom-desire-wish-glint-${i}`), phase: i * Math.PI / 9, start: .04 + i * .029 }))
  const lances = Array.from({ length: 5 }, (_, i) => ({
    star: make(`doom-desire-star-${i}`), g: make(i ? `doom-desire-lance-${i}` : 'doom-desire-tip'), lane: [0, -1, 1, -2, 2][i], start: 1.1 + i * .041,
  }))
  const impact = make('doom-desire-impact'), crown = make('doom-desire-impact-crown')
  const sparks = Array.from({ length: 28 }, (_, i) => ({
    g: make(`doom-desire-spark-${i}`), start: 1.55 + Math.floor(i / 7) * .105,
    phase: i * Math.PI * 2 / 28, speed: 27 + random() * 38, life: .78 + random() * .14, size: 2.1 + random() * 2,
  }))
  let struck = false

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true)
    const headroom = Math.max(0, b.y - top - 7), lift = Math.min(158, Math.max(65, context.target.metrics.height / unit * .8), headroom * .64)
    const sky = { x: b.x, y: b.y - lift }, spread = Math.max(0, Math.min(31, (b.x - left - 8) / 2.6, (right - b.x - 8) / 2.6))
    origin.clear(); fit(origin, sky, 28); origin.alpha = time >= .4 && time < 1.38 ? Math.min(1, (time - .4) / .22, (1.38 - time) / .28) * .77 : 0
    origin.circle(0, 0, 17).stroke({ color: 0xb9b9c8, width: 1.2, alpha: .58 })
      .circle(0, 0, 2.4).fill(0xfff4d7)
    root.clear(); fit(root, a, 41)
    root.alpha = time >= .035 && time < 1.12 ? Math.min(1, (time - .035) / .18, (1.12 - time) / .26) : 0
    const wish = clamp((time - .06) / .54), cross = 6 + wish * 17
    root.poly([0, -cross, 4, -4, cross * .71, 0, 4, 4, 0, cross, -4, 4, -cross * .71, 0, -4, -4])
      .fill({ color: 0xc9bd97, alpha: .46 }).stroke({ color: 0xf0e6c9, width: 1.2, alpha: .81 })
      .poly([0, -11, 2.7, 0, 0, 11, -2.7, 0]).fill(0xfff5d9)
    for (let j = 0; j < 3; j++) {
      const theta = j * Math.PI * 2 / 3 + time * 1.1
      root.arc(0, 0, 31, theta, theta + .73).stroke({ color: j % 2 ? 0xc6cedb : 0xb8a66e, width: 1.3, alpha: .48 })
    }
    for (const glint of gather) {
      const age = time - glint.start, u = clamp(age / .55), radius = Math.min(53, room(a) * .74) * (1 - u), theta = glint.phase + u * .63
      const p = { x: a.x + Math.cos(theta) * radius, y: a.y + Math.sin(theta) * radius }, g = glint.g
      g.clear(); fit(g, p, 8); g.rotation = theta
      g.alpha = age >= 0 && age < .55 ? Math.sin(u * Math.PI) * .78 : 0
      g.poly([0, -5, 1.3, -1.3, 5, 0, 1.3, 1.3, 0, 5, -1.3, 1.3, -5, 0, -1.3, -1.3]).fill(glint.phase < Math.PI ? 0xe5e7ef : 0xf2df9c)
    }

    constellation.clear(); constellation.alpha = time >= .35 && time < 1.44 ? Math.min(1, (time - .35) / .4, (1.44 - time) / .29) * .5 : 0
    const starAt = lane => ({ x: sky.x + lane * spread, y: sky.y + Math.abs(lane) * Math.min(10, lift * .09) })
    for (const lane of [-2, -1, 0, 1]) {
      const p = starAt(lane), q = starAt(lane + 1)
      constellation.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ color: 0xd2caa8, width: 1, alpha: .55 })
    }
    for (let i = 0; i < lances.length; i++) {
      const lance = lances[i], from = starAt(lance.lane), to = { x: b.x + lance.lane * spread * .28, y: b.y }, star = lance.star
      star.clear(); fit(star, from, 24)
      star.alpha = time >= .35 + i * .07 && time < lance.start + .16 ? Math.min(1, (time - .35 - i * .07) / .21, (lance.start + .16 - time) / .18) : 0
      const r = 13 + Math.sin(time * 3 + i) * 1.4, points = []
      for (let j = 0; j < 10; j++) {
        const theta = -Math.PI / 2 + j * Math.PI / 5, radius = j % 2 ? r * .43 : r
        points.push(Math.cos(theta) * radius, Math.sin(theta) * radius)
      }
      star.poly(points).fill({ color: 0xa7a7b7, alpha: .87 }).stroke({ color: 0xeee6ca, width: 1.2, alpha: .86 })
      for (let j = 0; j < 5; j++) {
        const theta = -Math.PI / 2 + j * Math.PI * 2 / 5
        star.poly([0, 0, Math.cos(theta) * r, Math.sin(theta) * r, Math.cos(theta + Math.PI / 5) * r * .43, Math.sin(theta + Math.PI / 5) * r * .43])
          .fill({ color: j % 2 ? 0xf2deb0 : 0xe3e5ef, alpha: .86 })
      }
      const age = time - lance.start, u = clamp(age / .44), fall = u * u * (.64 + .36 * u)
      const p = { x: from.x + (to.x - from.x) * fall, y: from.y + (to.y - from.y) * fall }, g = lance.g
      const length = 33 + u * 69, width = i === 0 ? 8 : 5.6
      g.clear(); fit(g, p, length + 6)
      // The point is local zero. Every lance trails upward and descends in world coordinates.
      g.alpha = age >= 0 && age < .76 ? Math.min(1, .93 + age * 3, (.76 - age) / .32) : 0
      g.poly([0, 0, -width, -17, -width * .59, -length, 0, -length - 3, width * .59, -length, width, -17]).fill({ color: 0xb9a773, alpha: .71 })
        .poly([0, 0, -width * .43, -18, -width * .23, -length + 2, width * .26, -length + 2, width * .43, -18]).fill(0xfff4ce)
        .moveTo(0, -length + 6).lineTo(0, -3).stroke({ color: 0xffffff, width: 1.4, alpha: .94 })
      for (let j = 0; j < 3; j++) {
        const flow = (time * 2.9 + j / 3 + i * .12) % 1, y = -length * (.13 + flow * .78)
        g.moveTo(-width * .7, y).lineTo(width * .7, y - 2).stroke({ color: 0xfaf7e6, width: 1.3, alpha: (1 - flow) * .66 })
      }
    }

    const age = time - 1.54, u = clamp(age / .58)
    impact.clear(); fit(impact, b, 88)
    impact.alpha = struck && age >= 0 && age < .74 ? 1 - clamp((age - .14) / .6) : 0
    const ring = 13 + u * 48
    impact.ellipse(0, 0, ring, ring * .37).stroke({ color: 0xf5e8b5, width: 3 - u, alpha: .79 })
      .ellipse(0, 0, ring * .72, ring * .26).stroke({ color: 0xd9dee8, width: 1.4, alpha: .71 })
      .poly([0, -18 * (1 - u), 5, -4, 18 * (1 - u), 0, 5, 4, 0, 18 * (1 - u), -5, 4, -18 * (1 - u), 0, -5, -4])
      .fill({ color: 0xfff3d2, alpha: (1 - u) * .78 })
    crown.clear(); fit(crown, b, 97); crown.alpha = struck && age >= .05 && age < 1.18 ? Math.min(1, (age - .05) / .1, (1.18 - age) / .5) * .67 : 0
    for (let j = 0; j < 9; j++) {
      const phase = (Math.max(0, age) * .63 + j / 9) % 1, theta = j * Math.PI * 2 / 9, distance = 16 + phase * 57
      crown.moveTo(Math.cos(theta) * distance * .63, Math.sin(theta) * distance * .56)
        .lineTo(Math.cos(theta) * distance, Math.sin(theta) * distance * .71)
        .stroke({ color: j % 2 ? 0xc0c9d8 : 0xe7d695, width: 2 - phase, alpha: (1 - phase) * .66, cap: 'round' })
    }
    for (const spark of sparks) {
      const age = time - spark.start, u = clamp(age / spark.life), reach = Math.min(spark.speed, room(b) * .49)
      const vx = Math.cos(spark.phase) * reach, vy = Math.sin(spark.phase) * reach * .39
      const p = { x: b.x + vx * u, y: b.y + vy * u + reach * .94 * u * u }, g = spark.g, r = spark.size
      g.clear(); fit(g, p, r * 2.3); g.rotation = Math.atan2(vy + reach * 1.88 * u, vx)
      g.alpha = struck && age >= 0 && age < spark.life ? Math.min(1, age / .045, (spark.life - age) / .29) * .84 : 0
      g.poly([-r * 1.7, 0, 0, -r * .4, r * .9, 0, 0, r * .4]).fill(spark.phase < Math.PI ? 0xd4dce8 : 0xf1d58d)
        .moveTo(-r, 0).lineTo(r * .43, 0).stroke({ color: 0xfff4d8, width: .8, alpha: .86 })
    }
  }
  onFrame(update)
  tl.call(() => update(1.1), [], 1.1)
    .call(() => { struck = true; update(1.54); onCue({ type: 'impact' }) }, [], 1.54)
    .to({}, { duration: 2.9 }, 0)
}
