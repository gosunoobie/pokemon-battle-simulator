import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function lusterPurge(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges)
  const top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const sourceHalf = context.source.metrics.width / (2 * unit), targetHalf = context.target.metrics.width / (2 * unit)
  const back = Math.max(0, Math.min(8, center.x - sourceHalf - left))
  const thrust = Math.max(0, Math.min(5, right - center.x - sourceHalf))
  const recoil = Math.max(0, Math.min(11, right - receiver.x - targetHalf))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const clamp = x => Math.max(0, Math.min(1, x))
  const show = (time, start, end, fade = .2) => time < start || time >= end ? 0 : Math.min(1, (time - start) / .06, (end - time) / fade)
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / Math.max(1, extent))) }
  const iris = make('luster-purge-charge'), ray = make('luster-purge-stream')
  const tip = make('luster-purge-tip'), star = make('luster-purge-impact')
  const r = Math.min(27, Math.max(20, context.source.metrics.height / unit * .125))
  const diamonds = Array.from({ length: 10 }, (_, i) => ({ g: make(`luster-purge-diamond-${i}`), start: .74 + i * .025, lane: i % 2 ? -1 : 1 }))
  const shards = Array.from({ length: 20 }, (_, i) => ({
    g: make(`luster-purge-shard-${i}`), angle: i * Math.PI / 10,
    reach: r * (1.2 + random() * 1.5), life: .46 + random() * .25,
  }))
  let impact

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true)
    const dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx)
    const nx = -Math.sin(angle), ny = Math.cos(angle)
    const at = p => ({ x: a.x + dx * p, y: a.y + dy * p })
    const growth = clamp((time - .08) / .6)
    // Four long star points resolve from a ring of inward-turning psychic facets.
    iris.clear(); fit(iris, a, r * 2.7); iris.rotation = time * .42
    iris.alpha = show(time, .08, 1.5, .25)
    iris.circle(0, 0, r * (.3 + growth * .55)).fill({ color: 0xd655a9, alpha: .1 })
    for (let j = 0; j < 8; j++) {
      const theta = j * Math.PI / 4 - time * .95, radius = r * (2.1 - growth * .85)
      const cx = Math.cos(theta) * radius, cy = Math.sin(theta) * radius
      const length = r * (.13 + growth * .14), width = length * .4
      iris.poly([
        cx + Math.cos(theta) * length, cy + Math.sin(theta) * length,
        cx - Math.sin(theta) * width, cy + Math.cos(theta) * width,
        cx - Math.cos(theta) * length, cy - Math.sin(theta) * length,
        cx + Math.sin(theta) * width, cy - Math.cos(theta) * width,
      ]).fill({ color: j % 2 ? 0xe78ad2 : 0xc4a7f5, alpha: .45 + growth * .5 })
    }
    const size = r * (.35 + growth * .8)
    iris.poly([0, -size, size * .16, -size * .16, size, 0, size * .16, size * .16,
      0, size, -size * .16, size * .16, -size, 0, -size * .16, -size * .16]).fill(0xe1b5ed)
    iris.poly([0, -size * .8, size * .1, -size * .1, size * .8, 0, size * .1, size * .1,
      0, size * .8, -size * .1, size * .1, -size * .8, 0, -size * .1, -size * .1]).fill(0xfff8f3)

    const reach = clamp((time - .74) / .31), tail = clamp((time - 1.22) / .24), head = at(reach)
    ray.clear(); ray.alpha = show(time, .74, 1.53, .19)
    if (reach > tail) {
      // A pointed prism has differently colored upper/lower faces and a fine white seam.
      for (const [side, width, color, alpha] of [[1, 1.3, 0xc857b1, .2], [-1, 1.3, 0x9c7ad9, .2], [1, 1, 0xd986c5, .94], [-1, 1, 0xb8a5ef, .94], [1, .57, 0xf5cae7, 1], [-1, .57, 0xdfd0ff, 1], [1, .12, 0xfffef6, 1], [-1, .12, 0xfffef6, 1]]) {
        const outer = [], inner = []
        for (let j = 0; j <= 40; j++) {
          const u = j / 40, p = tail + (reach - tail) * u, q = at(p)
          const taper = u < .28 ? .18 + u / .28 * .82 : (1 - u) / .72
          const w = Math.min(r * width * taper, room(q) * .8) * side
          outer.push(q.x + nx * w, q.y + ny * w); inner.unshift(q.x, q.y)
        }
        ray.poly([...outer, ...inner]).fill({ color, alpha })
      }
      // Short diagonal glints travel on the crystal faces instead of undulating them.
      for (let j = 0; j < 9; j++) {
        const p = (time * 2.7 + j / 9) % 1, end = Math.min(reach, p + .028)
        if (p < tail || p >= reach) continue
        const q = at(p), z = at(end), side = j % 2 ? -1 : 1
        const radius = Math.min(r * .46, room(q) * .5, room(z) * .5)
        ray.moveTo(q.x + nx * radius * side, q.y + ny * radius * side)
          .lineTo(z.x + nx * radius * .17 * side, z.y + ny * radius * .17 * side)
          .stroke({ color: 0xfff4f8, width: Math.min(1.4, room(q), room(z)), alpha: .77 })
      }
    }
    tip.clear(); fit(tip, head, r * 1.1); tip.rotation = angle; tip.alpha = ray.alpha
    tip.poly([0, 0, -r * .55, -r * .48, -r * .83, 0]).fill(0xe8b2db)
      .poly([0, 0, -r * .55, r * .48, -r * .83, 0]).fill(0xd6c2ff)
      .poly([0, 0, -r * .67, -r * .07, -r * .67, r * .07]).fill(0xfffdf4)
    for (const diamond of diamonds) {
      const age = time - diamond.start, u = clamp(age / .31), p = at(u)
      const offset = Math.min(r * .45, room(p) * .35) * Math.sin(u * Math.PI) * diamond.lane
      p.x += nx * offset; p.y += ny * offset
      diamond.g.clear(); fit(diamond.g, p, 11); diamond.g.rotation = angle
      diamond.g.alpha = age >= 0 && age < .4 ? Math.min(1, age / .04, (.4 - age) / .1) : 0
      diamond.g.poly([-9, 0, 0, -3.1, 9, 0, 0, 3.1]).fill(diamond.lane > 0 ? 0xffe0f3 : 0xe8dbff)
    }

    const age = time - 1.05, u = clamp(age / .84)
    star.clear(); fit(star, b, r * 2.95); star.alpha = impact && age >= 0 && age < .84 ? 1 - u : 0
    if (impact) {
      const size = r * (.85 + Math.sin(u * Math.PI) * 1.02)
      star.rotation = Math.sin(time * 5) * .035
      star.poly([0, -size, size * .14, -size * .14, size, 0, size * .14, size * .14,
        0, size, -size * .14, size * .14, -size, 0, -size * .14, -size * .14]).fill(0xfff9f3)
      // Broken diamond frames expand and turn around the four-point flare.
      for (let j = 0; j < 2; j++) {
        const phase = clamp(u * 1.6 - j * .32), radius = r * (.7 + phase * 1.75)
        const rotation = j * Math.PI / 4 + age * .55
        for (let k = 0; k < 4; k++) {
          const theta = rotation + k * Math.PI / 2
          star.moveTo(Math.cos(theta - .43) * radius * .73, Math.sin(theta - .43) * radius * .73)
            .lineTo(Math.cos(theta) * radius, Math.sin(theta) * radius)
            .lineTo(Math.cos(theta + .43) * radius * .73, Math.sin(theta + .43) * radius * .73)
            .stroke({ color: j ? 0xccb5ef : 0xe691cc, width: 1.7, alpha: (1 - phase) * .84 })
        }
      }
    }
    for (const shard of shards) {
      const u = clamp(age / shard.life)
      shard.g.clear(); shard.g.alpha = impact && age >= 0 && age < shard.life ? 1 - u : 0
      if (!impact) continue
      const distance = Math.min(shard.reach, room(impact) / 1.2)
      const p = { x: impact.x + Math.cos(shard.angle) * distance * u, y: impact.y + Math.sin(shard.angle) * distance * u }
      fit(shard.g, p, 9); shard.g.rotation = shard.angle + u * 1.5
      shard.g.poly([-7, 0, 0, -2.6, 7, 0, 0, 2.6]).fill(shard.angle < Math.PI ? 0xddd0ff : 0xf1b9e1)
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back * .55, duration: .32 }, 0)
    .to(attacker, { x: home.x + thrust * .8, duration: .16 }, .55)
    .call(() => { update(.74) }, [], .74)
    .call(() => { impact = targetSocket('center', true); update(1.05); onCue({ type: 'impact' }); defender.tint = 0xf5e5ff }, [], 1.05)
    .to(defender, { x: defenderHome.x + recoil * .6, duration: .07, repeat: 3, yoyo: true }, 1.05)
    .call(() => { defender.tint = 0xffffff }, [], 1.34)
    .to(attacker, { x: home.x, duration: .3 }, 1.59)
}
