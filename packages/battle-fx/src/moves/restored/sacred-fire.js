import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

export default function sacredFire(context) {
  const { tl, random, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, unit } = bindEffectSpace(context)
  const center = socket(context.source.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const receiver = targetSocket(context.target.hasAnchor?.('visualCenter') ? 'visualCenter' : 'center')
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const back = Math.max(0, Math.min(7, center.x - context.source.metrics.width / (2 * unit) - left))
  const thrust = Math.max(0, Math.min(5, right - center.x - context.source.metrics.width / (2 * unit)))
  const recoil = Math.max(0, Math.min(12, right - receiver.x - context.target.metrics.width / (2 * unit)))
  const r = Math.min(30, Math.max(20, context.target.metrics.height / unit * .125))
  const charge = new Sprite(glowTexture); charge.anchor.set(.5); charge.tint = 0xffaa35; charge.blendMode = 'add'; charge.alpha = 0; temporary.addChild(charge)
  const halo = new Graphics(); halo.label = 'sacred-fire-halo'; halo.alpha = 0; temporary.addChild(halo)
  const wake = [], plumes = [], sparks = []
  for (let i = 0; i < 12; i++) {
    const g = new Graphics(); g.label = `sacred-fire-wake-${i}`; g.alpha = 0; temporary.addChild(g)
    wake.push({ g, delay: .04 + i * .012, phase: i * 1.9 })
  }
  const flame = new Container(); flame.label = 'sacred-fire-comet'; flame.alpha = 0; temporary.addChild(flame)
  const glow = new Sprite(glowTexture); glow.anchor.set(.5); glow.position.set(-r * 1.15, 0); glow.width = r * 2.3; glow.height = r * 1.8; glow.tint = 0xffb844; glow.blendMode = 'add'; glow.alpha = .52
  const body = new Graphics(), ribbons = new Graphics(); flame.addChild(glow, ribbons, body)
  const crown = new Container(); crown.label = 'sacred-fire-crown'; temporary.addChild(crown)
  const bloom = new Sprite(glowTexture); bloom.label = 'sacred-fire-impact-glow'; bloom.anchor.set(.5); bloom.tint = 0xffb949; bloom.blendMode = 'add'; bloom.alpha = 0; crown.addChild(bloom)
  const rings = new Graphics(); rings.label = 'sacred-fire-impact-rings'; rings.alpha = 0; crown.addChild(rings)
  for (let i = 0; i < 7; i++) {
    const g = new Graphics(); g.label = `sacred-fire-plume-${i}`; g.alpha = 0; crown.addChild(g)
    plumes.push({ g, lane: i - 3, start: .94 + Math.abs(i - 3) * .022, life: .76 + random() * .12, phase: random() * 6.28 })
  }
  const flash = new Graphics(); flash.label = 'sacred-fire-impact-flash'; flash.alpha = 0; crown.addChild(flash)
  for (let i = 0; i < 30; i++) {
    const g = new Graphics().poly([0, -3, 1.2, 0, 0, 3, -1.2, 0]).fill(i % 3 ? 0xffbc4b : 0xfff2c0)
    g.label = `sacred-fire-spark-${i}`; g.alpha = 0; temporary.addChild(g)
    sparks.push({ g, x: (random() - .5) * r * 2.6, v: 38 + random() * 85, side: (random() - .5) * 65, life: .42 + random() * .42, delay: .97 + random() * .1 })
  }
  let from, impact

  // Bounds include the whole rotated contour, so edge layouts shrink artwork locally.
  function fit(point, angle, minX, minY, maxX, maxY) {
    const c = Math.cos(angle), s = Math.sin(angle)
    let factor = 1
    for (const x of [minX, maxX]) for (const y of [minY, maxY]) {
      const dx = x * c - y * s, dy = x * s + y * c
      if (dx) factor = Math.min(factor, (dx < 0 ? point.x - left - 4 : right - point.x - 4) / Math.abs(dx))
      if (dy) factor = Math.min(factor, (dy < 0 ? point.y - top - 4 : bottom - point.y - 4) / Math.abs(dy))
    }
    return Math.max(0, factor)
  }
  function paintFlame(g, length, width, curl) {
    g.clear().moveTo(0, 0)
      .bezierCurveTo(-length * .27, -width * .22, -length * .32, -width * (1 + curl), -length * .7, -width * .82)
      .quadraticCurveTo(-length * .49, -width * .14, -length, -width * .3)
      .quadraticCurveTo(-length * .7, width * .06, -length * .86, width * .72)
      .bezierCurveTo(-length * .46, width * (1 - curl), -length * .25, width * .24, 0, 0).fill(0xf06b20)
      .moveTo(-length * .06, 0).quadraticCurveTo(-length * .34, -width * .1, -length * .54, -width * .63)
      .quadraticCurveTo(-length * .41, 0, -length * .78, width * .2)
      .quadraticCurveTo(-length * .3, width * .63, -length * .06, 0).fill(0xffbf43)
      .moveTo(-length * .12, 0).quadraticCurveTo(-length * .29, -width * .25, -length * .49, -width * .23)
      .quadraticCurveTo(-length * .34, width * .07, -length * .63, width * .2)
      .quadraticCurveTo(-length * .28, width * .36, -length * .12, 0).fill(0xfff0ae)
      .moveTo(-length * .18, 0).quadraticCurveTo(-length * .3, -width * .1, -length * .43, width * .04)
      .quadraticCurveTo(-length * .29, width * .19, -length * .18, 0).fill(0xfffbed)
  }
  function route(u, a, b) {
    const p = u * u, rise = Math.min(r * .95, Math.max(0, Math.min(a.y, b.y) - top - r))
    return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p - Math.sin(Math.PI * p) * rise,
      angle: Math.atan2(b.y - a.y - Math.cos(Math.PI * p) * Math.PI * rise, b.x - a.x) }
  }
  function update(time) {
    const mouth = socket('emission', true), age = time - .4, u = Math.max(0, Math.min(1, age / .54)), a = from ?? mouth, b = impact ?? targetSocket('center', true)
    const chargeAlpha = time >= .04 && time < .47 ? Math.min(1, (time - .04) * 5) * Math.min(1, (.47 - time) * 13) : 0
    charge.position.copyFrom(mouth); charge.alpha = chargeAlpha * .45; charge.width = charge.height = r * (1.3 + chargeAlpha * .8) * fit(mouth, 0, -r * 1.2, -r * 1.2, r * 1.2, r * 1.2)
    halo.clear(); halo.position.copyFrom(mouth); halo.alpha = chargeAlpha
    halo.scale.set(fit(mouth, 0, -r * 1.25, -r * 1.25, r * 1.25, r * 1.25))
    for (let i = 0; i < 2; i++) halo.arc(0, 0, r * (.72 + i * .37) * (1.1 - chargeAlpha * .18), time * 8 + i * Math.PI, time * 8 + i * Math.PI + 2.4).stroke({ color: i ? 0xffa431 : 0xffe9a1, width: i ? 2 : 3, cap: 'round' })
    const point = route(u, a, b)
    flame.position.set(point.x, point.y); flame.rotation = point.angle
    flame.scale.set(fit(point, point.angle, -r * 4.2, -r * 1.25, 0, r * 1.25))
    flame.alpha = age >= 0 && age < .67 ? Math.min(1, age / .035) * Math.max(0, 1 - Math.max(0, age - .54) / .13) : 0
    paintFlame(body, r * (2.35 + u * .65), r * (.74 + u * .18), Math.sin(time * 24) * .22)
    ribbons.clear()
    for (let j = 0; j < 3; j++) {
      const points = []
      for (let i = 0; i <= 18; i++) {
        const v = i / 18, x = -r * (.45 + v * 3.65), y = Math.sin(v * 8 - time * 20 + j * 2.1) * r * .38 * Math.sin(v * Math.PI), w = r * .115 * Math.sin(v * Math.PI)
        points.push({ x, y, w }); i ? ribbons.lineTo(x, y - w) : ribbons.moveTo(x, y - w)
      }
      for (let i = points.length - 1; i >= 0; i--) ribbons.lineTo(points[i].x, points[i].y + points[i].w)
      ribbons.closePath().fill({ color: j === 1 ? 0xffe798 : 0xff9e28, alpha: j === 1 ? .8 : .58 })
    }
    for (const p of wake) {
      const wakeAge = age - p.delay, v = Math.max(0, Math.min(1, wakeAge / .54)), at = route(v, a, b)
      p.g.position.set(at.x, at.y + Math.sin(time * 20 + p.phase) * r * .13 * Math.sin(v * Math.PI)); p.g.rotation = at.angle
      p.g.scale.set(fit(p.g.position, at.angle, -r * 1.1, -r * .4, 0, r * .4))
      p.g.alpha = wakeAge >= 0 && time < 1.2 ? Math.min(1, wakeAge * 14) * Math.max(0, 1 - Math.max(0, time - .94) / .26) * .22 : 0
      paintFlame(p.g, r * 1.1, r * .28, Math.sin(time * 22 + p.phase) * .25)
    }
    const hitAge = time - .94
    if (impact) {
      crown.position.copyFrom(impact)
      const rx = Math.max(0, Math.min(r, (impact.x - left - 4) / 2.8, (right - impact.x - 4) / 2.8))
      const vertical = Math.max(0, Math.min(rx * 2, impact.y - top - 4, bottom - impact.y - 4))
      bloom.width = rx * 5.2; bloom.height = vertical * 2; bloom.alpha = hitAge >= 0 && hitAge < .63 ? Math.pow(1 - hitAge / .63, 1.5) * .62 : 0
      flash.clear().ellipse(0, 0, rx * .94, vertical * .65).fill(0xfff9df)
      flash.alpha = hitAge >= 0 && hitAge < .17 ? Math.pow(1 - hitAge / .17, 2) * .88 : 0
      rings.clear(); rings.alpha = hitAge >= 0 && hitAge < .5 ? 1 : 0
      for (let i = 0; i < 2; i++) {
        const v = (hitAge - i * .07) / .35
        if (v < 0 || v >= 1) continue
        const radius = rx * (.5 + v * 1.95), yRadius = Math.min(radius * .57, vertical * .9)
        rings.ellipse(0, 0, radius, yRadius).stroke({ color: i ? 0xffb737 : 0xffe9a2, width: (1 - v) * (i ? 2 : 3), alpha: (1 - v) * .8 })
      }
      for (const p of plumes) {
        const v = (time - p.start) / p.life
        p.g.alpha = v >= 0 && v < 1 ? Math.min(1, v * 11) * Math.pow(1 - v, .55) : 0
        if (v < 0 || v >= 1) continue
        const height = Math.min(r * (3.2 - Math.abs(p.lane) * .33), Math.max(0, impact.y - top - 8)) * (.58 + .42 * Math.sin(v * Math.PI))
        const x = p.lane * rx * .51 + Math.sin(time * 13 + p.phase) * rx * .13 * v, y = -height * (.67 + v * .25)
        const angle = -Math.PI / 2 + Math.sin(time * 11 + p.phase) * .1, width = rx * (.34 - v * .1), length = height * .84
        p.g.position.set(x, y); p.g.rotation = angle
        p.g.scale.set(fit({ x: impact.x + x, y: impact.y + y }, angle, -length, -width * 1.25, 0, width * 1.25))
        paintFlame(p.g, length, width, Math.sin(time * 19 + p.phase) * .23)
      }
    }
    for (const p of sparks) {
      const age = time - p.delay, v = age / p.life
      p.g.alpha = impact && v >= 0 && v < 1 ? Math.sin(v * Math.PI) * .9 : 0
      if (impact && age >= 0) {
        const travel = Math.max(0, Math.min(1,
          (impact.x - left - 3) / Math.max(.001, -p.x, -p.x - p.side * p.life),
          (right - impact.x - 3) / Math.max(.001, p.x, p.x + p.side * p.life),
          (impact.y - top - 3) / (p.v * p.life + 15 * p.life * p.life)))
        p.g.position.set(impact.x + (p.x + p.side * age) * travel, impact.y - (p.v * age + 15 * age * age) * travel)
      }
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .23 }, 0).to(attacker, { x: home.x + thrust, duration: .15 }, .23)
    .call(() => { from = socket('emission', true); update(.4) }, [], .4)
    .call(() => { impact = targetSocket('center', true); update(.94); onCue({ type: 'impact' }); defender.tint = 0xffd67d }, [], .94)
    .to(defender, { x: defenderHome.x + recoil, duration: .05, repeat: 5, yoyo: true }, .94)
    .call(() => { defender.tint = 0xffffff }, [], 1.25)
    .to(attacker, { x: home.x, duration: .45, ease: 'power2.inOut' }, 1.26)
}
