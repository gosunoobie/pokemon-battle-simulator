import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function petalDance(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, defender, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges)
  const top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const clamp = n => Math.max(0, Math.min(1, n))
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / extent)) }
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const targetCenter = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const recoil = Math.max(0, Math.min(6, right - targetCenter.x - context.target.metrics.width / (2 * unit)))
  const colors = [0xff9dcc, 0xffc5df, 0xf76cae, 0xffe2ef, 0xe992d0]
  const breeze = make('petal-dance-source-spiral')
  const vortex = make('petal-dance-impact')
  const petals = Array.from({ length: 36 }, (_, i) => ({
    g: make(i === 0 ? 'petal-dance-tip' : `petal-dance-petal-${i}`),
    start: .4 + i * .012, arrival: 1.02 + i * .012, phase: i * 2.39996,
    size: 9 + random() * 8, radius: 35 + random() * 29, color: colors[i % colors.length],
    turn: .53 + random() * .12, drift: (random() - .5) * 22,
  }))
  let struck = false

  function update(time) {
    const a = socket('emission', true), b = targetSocket('center', true)
    const dx = b.x - a.x, dy = b.y - a.y, direction = Math.atan2(dy, dx)
    const nx = -Math.sin(direction), ny = Math.cos(direction)
    breeze.clear(); fit(breeze, a, 72)
    breeze.alpha = time >= .035 && time < 1.03 ? Math.min(1, (time - .035) / .16, (1.03 - time) / .22) : 0
    // Loose, slanted spirals gather separate petals around the live release socket.
    for (let j = 0; j < 3; j++) {
      const radius = 24 + j * 14, phase = time * 3.8 + j * 2.1
      for (let k = 0; k <= 16; k++) {
        const theta = phase + k / 16 * 2.7, x = Math.cos(theta) * radius, y = Math.sin(theta) * radius * .58
        if (k === 0) breeze.moveTo(x, y); else breeze.lineTo(x, y)
      }
      breeze.stroke({ color: colors[j], width: 1.5, alpha: .4 })
    }
    for (const petal of petals) {
      const flight = clamp((time - petal.start) / .62), age = time - petal.arrival
      let p, rotation
      if (time < petal.start) {
        const envelope = Math.sin(clamp((time - .025) / (petal.start - .025)) * Math.PI)
        const radius = Math.min(petal.radius, room(a) * .61) * envelope
        const theta = petal.phase + time * 4.8
        p = { x: a.x + Math.cos(theta) * radius, y: a.y + Math.sin(theta) * radius * .61 }
        rotation = theta + Math.PI / 2
      } else if (age <= 0) {
        const q = { x: a.x + dx * flight, y: a.y + dy * flight }
        const bow = Math.sin(flight * Math.PI) * Math.sin(petal.phase + flight * 5) * Math.min(57, room(q) * .66)
        p = { x: q.x + nx * bow, y: q.y + ny * bow }
        rotation = direction + Math.sin(petal.phase + flight * 5) * .38
      } else {
        const falling = clamp((age - petal.turn) / .48)
        const theta = petal.phase + Math.min(age, petal.turn) * 7.2 + falling * 1.6
        const radius = Math.min(petal.radius, room(b) * .52) * Math.sin(Math.min(1, age / .16) * Math.PI / 2)
        const descent = Math.min(58, room(b) * .28) * falling * falling
        p = { x: b.x + Math.cos(theta) * radius + petal.drift * falling * Math.min(1, room(b) / 70), y: b.y + Math.sin(theta) * radius * .65 + descent }
        rotation = theta + Math.PI / 2 + falling * Math.sin(petal.phase + time * 9) * .8
        // The target swirl loosens into falling petals, with gravity unchanged by mirroring.
      }
      const g = petal.g, r = petal.size
      g.clear(); fit(g, p, r * 1.5); g.rotation = rotation
      const end = petal.arrival + petal.turn + .48
      g.alpha = time >= .03 && time < end ? Math.min(1, (time - .03) / .14, (end - time) / .26) * .94 : 0
      g.moveTo(0, 0).quadraticCurveTo(-r * .3, -r * .65, -r * .9, -r * .31)
        .quadraticCurveTo(-r * 1.26, r * .21, -r * .65, r * .31)
        .quadraticCurveTo(-r * .26, r * .38, 0, 0).fill(petal.color)
        .moveTo(-r * .87, -.02 * r).quadraticCurveTo(-r * .48, r * .1, 0, 0)
        .stroke({ color: 0xfff2f8, width: .9, alpha: .73 })
    }
    const age = time - 1.02, phase = clamp(age / 1.42)
    vortex.clear(); fit(vortex, b, 91)
    vortex.alpha = struck && age >= 0 && age < 1.42 ? Math.min(1, 1.42 - age) * .79 : 0
    for (let j = 0; j < 4; j++) {
      const radius = 24 + j * 15 + Math.sin(age * 3) * 4, theta = age * (j % 2 ? 3.9 : 4.5) + j * 1.6
      for (let k = 0; k <= 20; k++) {
        const q = theta + k * .085, x = Math.cos(q) * radius, y = Math.sin(q) * radius * .62
        if (k === 0) vortex.moveTo(x, y); else vortex.lineTo(x, y)
      }
      vortex.stroke({ color: colors[j], width: 2 - j * .2, alpha: .46 * (1 - phase * .4) })
    }
    if (age >= 0 && age < .28) {
      const flash = 1 - age / .28
      for (let j = 0; j < 5; j++) {
        const theta = j * Math.PI * .4, x = Math.cos(theta) * (17 + age * 30), y = Math.sin(theta) * (17 + age * 30)
        vortex.moveTo(0, 0).quadraticCurveTo(x - y * .45, y + x * .45, x, y)
          .quadraticCurveTo(x + y * .45, y - x * .45, 0, 0).fill({ color: 0xffe8f4, alpha: flash * .8 })
      }
    }
  }
  onFrame(update)
  tl.call(() => update(.4), [], .4)
    .call(() => { struck = true; update(1.02); onCue({ type: 'impact' }); defender.tint = 0xffd7eb }, [], 1.02)
    .to(defender, { x: defenderHome.x + recoil, duration: .075, repeat: 5, yoyo: true }, 1.02)
    .call(() => { defender.tint = 0xffffff }, [], 1.47)
    .call(() => {}, [], 2.65)
}
