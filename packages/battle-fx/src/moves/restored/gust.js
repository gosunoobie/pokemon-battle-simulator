import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function gust(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const attachment = context.source.hasAnchor?.('wing') ? 'wing' : 'emission'
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges)
  const top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const clamp = n => Math.max(0, Math.min(1, n))
  const fit = (g, p, extent) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / extent)) }
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const sourceCenter = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const targetCenter = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const back = Math.max(0, Math.min(5, sourceCenter.x - context.source.metrics.width / (2 * unit) - left))
  const recoil = Math.max(0, Math.min(7, right - targetCenter.x - context.target.metrics.width / (2 * unit)))
  const gathering = make('gust-gathering')
  const whorls = Array.from({ length: 3 }, (_, i) => ({
    g: make(i === 0 ? 'gust-tip' : `gust-whorl-${i}`), start: .24 + i * .09,
    radius: 23 - i * 2, lane: i === 0 ? 0 : i === 1 ? -.65 : .7,
  }))
  const buffet = make('gust-impact')
  const curls = Array.from({ length: 18 }, (_, i) => ({
    g: make(`gust-curl-${i}`), angle: i * Math.PI / 9 + random() * .12,
    length: 6 + random() * 7, reach: 26 + random() * 40, start: .62 + i % 3 * .07, life: .31 + random() * .34,
  }))
  let struck = false

  function update(time) {
    const a = socket(attachment, true), b = targetSocket('center', true)
    const dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx), nx = -Math.sin(angle), ny = Math.cos(angle)
    gathering.clear(); fit(gathering, a, 47); gathering.rotation = angle
    gathering.alpha = time >= .025 && time < .55 ? Math.min(1, (time - .025) / .12, (.55 - time) / .15) : 0
    for (let j = 0; j < 3; j++) {
      const r = 13 + j * 9, theta = time * 6 + j * 2
      gathering.moveTo(Math.cos(theta) * r * .65, Math.sin(theta) * r)
        .quadraticCurveTo(-r, -r * .5, -r * .64, 0)
        .quadraticCurveTo(-r * .4, r * .65, r * .35, r * .27)
        .stroke({ color: j === 1 ? 0xe3fff4 : 0xc8e7ed, width: 1.3, alpha: .42 })
    }
    for (const whorl of whorls) {
      const age = time - whorl.start, u = clamp(age / .38)
      const p = { x: a.x + dx * u, y: a.y + dy * u }
      const bow = Math.sin(u * Math.PI) * Math.min(27, room(p) * .4) * whorl.lane
      p.x += nx * bow; p.y += ny * bow
      const g = whorl.g, r = whorl.radius
      g.clear(); fit(g, p, r * 2.75); g.rotation = angle
      g.alpha = age >= 0 && age < .53 ? Math.min(1, .87 + age * 7, (.53 - age) / .15) : 0
      // The front is local zero. Tight open spirals coil behind it, with no cutting blade.
      g.moveTo(0, 0).quadraticCurveTo(-r * .17, -r * .88, -r * 1.08, -r * .9)
        .quadraticCurveTo(-r * 2.15, -r * .48, -r * 1.78, r * .44)
        .quadraticCurveTo(-r * 1.11, r * .94, -r * .51, r * .46)
        .quadraticCurveTo(-r * .93, r * .65, -r * 1.35, r * .26)
        .quadraticCurveTo(-r * 1.57, -r * .36, -r * .89, -r * .5)
        .quadraticCurveTo(-r * .36, -r * .51, 0, 0).fill({ color: 0xc8efeb, alpha: .12 })
      for (let j = 0; j < 3; j++) {
        const phase = age * 11 + j * 2.1
        for (let k = 0; k <= 30; k++) {
          const t = k / 30, theta = phase + t * Math.PI * 2.45, radius = r * (.83 - t * .6)
          const x = -r + Math.cos(theta) * radius, y = Math.sin(theta) * radius * .86
          if (k === 0) g.moveTo(x, y); else g.lineTo(x, y)
        }
        g.stroke({ color: j === 1 ? 0xf2fffb : 0xbcdce6, width: j === 1 ? 2.2 : 1.2, alpha: .9 - j * .2 })
      }
      g.moveTo(-r * .53, -r * .56).quadraticCurveTo(-r * .1, -r * .33, 0, 0)
        .quadraticCurveTo(-r * .16, r * .38, -r * .57, r * .53)
        .stroke({ color: 0xf5ffff, width: 2.1, alpha: .94 })
      for (let j = 0; j < 2; j++) {
        g.moveTo(-r * 1.6, (j ? 1 : -1) * r * .37)
          .quadraticCurveTo(-r * 2.07, (j ? 1 : -1) * r * .48, -r * 2.35, (j ? 1 : -1) * r * .29)
          .stroke({ color: 0xc7e3e7, width: 1, alpha: .48 })
      }
    }
    const age = time - .62, u = clamp(age / .79)
    buffet.clear(); fit(buffet, b, 72); buffet.rotation = angle
    buffet.alpha = struck && age >= 0 && age < .79 ? 1 - u : 0
    for (let j = 0; j < 3; j++) {
      const theta = age * 5 + j * 2.1, radius = 17 + j * 9 + u * 12
      for (let k = 0; k <= 20; k++) {
        const q = theta + k * .11, x = Math.cos(q) * radius, y = Math.sin(q) * radius * .72
        if (k === 0) buffet.moveTo(x, y); else buffet.lineTo(x, y)
      }
      buffet.stroke({ color: j === 1 ? 0xf1fffa : 0xc6e6e8, width: 2.6 - j * .45, alpha: .78 })
    }
    for (const curl of curls) {
      const age = time - curl.start, v = clamp(age / curl.life), distance = Math.min(curl.reach, room(b) * .6) * v
      const theta = curl.angle + v * .55, p = { x: b.x + Math.cos(theta) * distance, y: b.y + Math.sin(theta) * distance }
      const g = curl.g; g.clear(); fit(g, p, curl.length * 1.7); g.rotation = theta + Math.PI / 2
      g.alpha = struck && age >= 0 && age < curl.life ? Math.sin(v * Math.PI) * .8 : 0
      g.moveTo(-curl.length, 0).quadraticCurveTo(-curl.length * .15, -curl.length * .47, curl.length * .58, 0)
        .quadraticCurveTo(curl.length * .67, curl.length * .34, curl.length * .21, curl.length * .31)
        .stroke({ color: 0xe0f5f2, width: 1.25, alpha: .88 })
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .13 }, 0)
    .to(attacker, { x: home.x, duration: .1, ease: 'power2.out' }, .13)
    .call(() => update(.24), [], .24)
    .call(() => { struck = true; update(.62); onCue({ type: 'impact' }); defender.tint = 0xe5faf7 }, [], .62)
    .to(defender, { x: defenderHome.x + recoil, duration: .065, repeat: 5, yoyo: true }, .62)
    .call(() => { defender.tint = 0xffffff }, [], 1.02)
    .call(() => {}, [], 1.7)
}
