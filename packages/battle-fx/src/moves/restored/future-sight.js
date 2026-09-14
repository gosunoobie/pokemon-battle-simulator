import { Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function futureSight(context) {
  const { tl, random, onFrame, onCue } = context
  const { temporary, socket, targetSocket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 4)
  const fit = (g, p, radius) => { g.position.copyFrom(p); g.scale.set(Math.min(1, room(p) / radius)) }
  const make = label => { const g = new Graphics(); g.label = label; g.alpha = 0; temporary.addChild(g); return g }
  const attachment = context.source.hasAnchor?.('eyes') ? 'eyes' : 'emission'
  const root = make('future-sight-root'), omen = make('future-sight-premonition'), tip = make('future-sight-tip'), wake = make('future-sight-packet-trail')
  root.attachmentSocket = attachment
  const impact = make('future-sight-impact'), echoes = make('future-sight-collapse-echoes')
  const fragments = Array.from({ length: 24 }, (_, i) => ({
    g: make(`future-sight-fragment-${i}`), start: 1.55 + Math.floor(i / 6) * .07,
    angle: i * Math.PI / 12, size: 3.2 + random() * 3.3, reach: 46 + random() * 25, life: .81 + random() * .1,
  }))
  let struck = false

  function update(time) {
    const a = socket(attachment, true), b = targetSocket('center', true), dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx)
    const charge = clamp((time - .05) / .31), focus = clamp((time - .91) / .13)
    root.clear(); fit(root, a, 49)
    root.alpha = time >= .05 && time < 1.25 ? Math.min(1, (time - .05) / .18, (1.25 - time) / .23) : 0
    const lid = 7 + charge * 10, pupil = 3.4 + focus * 3
    // The eye and its clock-like ticks remain suspended during the anticipation pause.
    root.moveTo(-31, 0).quadraticCurveTo(0, -lid * 1.7, 31, 0).quadraticCurveTo(0, lid * 1.7, -31, 0)
      .stroke({ color: 0xc59ae7, width: 1.9, alpha: .87 })
      .moveTo(-23, 0).quadraticCurveTo(0, -lid, 23, 0).quadraticCurveTo(0, lid, -23, 0)
      .fill({ color: 0x75579c, alpha: .13 })
      .poly([0, -pupil * 1.7, pupil, 0, 0, pupil * 1.7, -pupil, 0]).fill(0xf2d6ff)
    for (let j = 0; j < 12; j++) {
      const theta = j * Math.PI / 6 + time * .18, radius = 37 + Math.sin(time * 2 + j) * 1.2
      root.moveTo(Math.cos(theta) * radius, Math.sin(theta) * radius * .79)
        .lineTo(Math.cos(theta) * (radius + (j % 3 ? 3 : 6)), Math.sin(theta) * (radius + (j % 3 ? 3 : 6)) * .79)
        .stroke({ color: j % 3 ? 0x9074b4 : 0xe2bef3, width: j % 3 ? 1 : 1.5, alpha: .56 + focus * .28 })
    }

    omen.clear(); fit(omen, b, 78)
    const omenFade = time >= .35 && time < 1.54 ? Math.min(1, (time - .35) / .23, (1.54 - time) / .2) : 0
    omen.alpha = omenFade * (.46 + focus * .26)
    const hold = 1 - clamp((time - 1.04) / .38) * .26
    for (let j = 0; j < 3; j++) {
      const theta = j * Math.PI * 2 / 3 + time * .24, r = 49 * hold
      for (let k = 0; k <= 14; k++) {
        const q = theta + k / 14 * 1.1, x = Math.cos(q) * r, y = Math.sin(q) * r * .83
        k ? omen.lineTo(x, y) : omen.moveTo(x, y)
      }
      omen.stroke({ color: j === 1 ? 0xd3a6e8 : 0x9d84c4, width: 1.4, alpha: .6 })
      omen.poly([Math.cos(theta) * (r + 8), Math.sin(theta) * (r + 8) * .83,
        Math.cos(theta + .07) * r, Math.sin(theta + .07) * r * .83,
        Math.cos(theta - .07) * r, Math.sin(theta - .07) * r * .83]).fill(0xb99cda)
    }
    omen.moveTo(-15, -24).quadraticCurveTo(0, -35, 15, -24).quadraticCurveTo(0, -15, -15, -24)
      .stroke({ color: 0xd7b6ed, width: 1.2, alpha: .63 })

    const u = clamp((time - 1.04) / .38), p = { x: a.x + dx * u, y: a.y + dy * u }
    tip.clear(); fit(tip, p, 49); tip.rotation = angle
    tip.alpha = time >= 1.04 && time < 1.58 ? Math.min(1, .9 + (time - 1.04) * 3, (1.58 - time) / .16) : 0
    // All facets trail the front point at local zero; the packet is one committed strike.
    tip.poly([0, 0, -23, -15, -43, 0, -23, 15]).fill({ color: 0x72519d, alpha: .7 })
      .poly([0, 0, -23, -15, -17, 0]).fill({ color: 0xe3b8f2, alpha: .92 })
      .poly([0, 0, -23, 15, -17, 0]).fill({ color: 0xa68ad1, alpha: .95 })
      .moveTo(-39, 0).lineTo(-22, -10).lineTo(-8, 0).lineTo(-22, 10).closePath()
      .stroke({ color: 0xefd6ff, width: 1.4, alpha: .89 })
      .ellipse(-1, 0, 1, 2).fill(0xffeaff)
    wake.clear(); wake.alpha = time >= 1.04 && time < 1.64 ? Math.min(1, (time - 1.04) / .055, (1.64 - time) / .22) : 0
    for (let j = 1; j <= 8; j++) {
      const q = Math.max(0, u - j * .048), z = Math.max(0, q - .025), from = { x: a.x + dx * q, y: a.y + dy * q }, to = { x: a.x + dx * z, y: a.y + dy * z }
      const offset = Math.sin(j * 1.7 + time * 6) * Math.min(9, room(from) * .23), nx = -Math.sin(angle), ny = Math.cos(angle)
      wake.moveTo(from.x + nx * offset, from.y + ny * offset).lineTo(to.x + nx * offset * .7, to.y + ny * offset * .7)
        .stroke({ color: j % 2 ? 0xc499e3 : 0x8268b0, width: 2.5 - j * .21, alpha: (1 - j / 10) * .63, cap: 'round' })
    }

    const age = time - 1.42, collapse = clamp(age / .25), fade = 1 - clamp((age - .32) / .68)
    impact.clear(); fit(impact, b, 91); impact.alpha = struck && age >= 0 && age < 1 ? fade : 0
    const inward = 52 * (1 - collapse) + 6
    for (let j = 0; j < 3; j++) {
      const theta = j * Math.PI / 3 + time * .5, rx = inward * (1 - j * .1), ry = inward * .58
      for (let k = 0; k <= 36; k++) {
        const q = k * Math.PI * 2 / 36, x = Math.cos(q) * rx, y = Math.sin(q) * ry
        const px = x * Math.cos(theta) - y * Math.sin(theta), py = x * Math.sin(theta) + y * Math.cos(theta)
        k ? impact.lineTo(px, py) : impact.moveTo(px, py)
      }
      impact.closePath().stroke({ color: j === 1 ? 0xe4c5f3 : 0xa588cc, width: j === 1 ? 2.1 : 1.3, alpha: .72 * (1 - collapse * .7) })
    }
    const centerRadius = 4 + Math.sin(collapse * Math.PI) * 7
    impact.poly([0, -centerRadius, centerRadius * .7, 0, 0, centerRadius, -centerRadius * .7, 0]).fill({ color: 0xf1d7ff, alpha: .85 * (1 - clamp((age - .3) / .24)) })
    echoes.clear(); fit(echoes, b, 88); echoes.alpha = struck && age >= .16 && age < 1.15 ? Math.min(1, (age - .16) / .15, (1.15 - age) / .4) * .65 : 0
    for (let j = 0; j < 4; j++) {
      const phase = (Math.max(0, age - .16) * .8 + j / 4) % 1, radius = 23 + phase * 46, theta = j * Math.PI / 2 - age
      echoes.arc(0, 0, radius, theta, theta + .8).stroke({ color: j % 2 ? 0xcab0e4 : 0x9878be, width: 1.9 - phase, alpha: (1 - phase) * .58 })
    }
    for (const fragment of fragments) {
      const age = time - fragment.start, u = clamp(age / fragment.life), reach = Math.min(fragment.reach, room(b) * .68), theta = fragment.angle + u * .57
      const distance = reach * (.1 + .88 * Math.sin(u * Math.PI / 2)), p = { x: b.x + Math.cos(theta) * distance, y: b.y + Math.sin(theta) * distance * .77 + Math.min(12, room(b) * .1) * u * u }
      const g = fragment.g, r = fragment.size; g.clear(); fit(g, p, r * 1.7); g.rotation = fragment.angle + age * 1.5
      g.alpha = struck && age >= 0 && age < fragment.life ? Math.min(1, age / .055, (fragment.life - age) / .3) * .79 : 0
      g.poly([0, -r, r * .61, 0, 0, r * 1.1, -r * .36, 0]).fill({ color: 0xb28cd2, alpha: .79 })
        .moveTo(0, -r * .78).lineTo(0, r * .72).stroke({ color: 0xecd0f5, width: .9, alpha: .87 })
    }
  }
  onFrame(update)
  tl.call(() => update(1.04), [], 1.04)
    .call(() => { struck = true; update(1.42); onCue({ type: 'impact' }) }, [], 1.42)
    .to({}, { duration: 2.85 }, 0)
}
