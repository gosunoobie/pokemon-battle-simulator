import { Container, Graphics, Sprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Second local review: preserve the lobed sludge ball and its arc, then let its
// opaque wet fragments, threads and pool carry the recording's later splashes.
export const timing = Object.freeze({ contact: 1.02, duration: 2.40, markers: Object.freeze([
  { id: 'launch', label: 'Sludge ball launches', timeSeconds: .38 },
  { id: 'wet-burst-one', label: 'Late wet dispersion', timeSeconds: 1.98 },
  { id: 'wet-burst-two', label: 'Last wet dispersion', timeSeconds: 2.0325 },
  { id: 'dispersion-end', label: 'Wet dispersion settles', timeSeconds: 2.25 },
]) })

export default function sludgeBomb(context) {
  const { tl, glowTexture, onFrame, onCue } = context
  const { temporary, attacker, defender, home, defenderHome, socket, targetSocket, world, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges) + 5, right = Math.max(...edges) - 5
  const top = -temporary.y / unit + 5, bottom = (context.scene.height - temporary.y) / unit - 5
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
  const room = p => Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y))
  const fit = (g, p, radius, scale = 1) => { g.position.copyFrom(p); g.scale.set(Math.min(scale, room(p) / radius)) }
  const bounded = (p, r) => ({ x: clamp(p.x, left + r, right - r), y: clamp(p.y, top + r, bottom - r) })
  const sourceCenter = socket('visualCenter'), targetCenter = targetSocket('visualCenter')
  const sw = context.source.metrics.width / (2 * unit), tw = context.target.metrics.width / (2 * unit)
  const back = Math.max(0, Math.min(14, sourceCenter.x - sw - left)), thrust = Math.max(0, Math.min(12, right - sourceCenter.x - sw))
  const recoil = Math.max(0, Math.min(16, right - targetCenter.x - tw))
  const bomb = new Container(); bomb.label = 'sludge-bomb-v2-ball'; bomb.alpha = 0; temporary.addChild(bomb)
  bomb.addChild(new Graphics().circle(-15, 7, 17).fill(0x673584).circle(13, -7, 18).fill(0x673584)
    .circle(0, 0, 25).fill(0x8646a2).ellipse(-7, -9, 11, 7).fill({ color: 0xd3a0e5, alpha: .75 })
    .circle(11, 10, 6).fill({ color: 0x48265d, alpha: .65 }))
  const threads = new Graphics(); threads.label = 'sludge-bomb-v2-wet-threads'; temporary.addChild(threads)
  const pool = new Graphics(); pool.label = 'sludge-bomb-v2-pool'; temporary.addChild(pool)
  const impactGlow = new Sprite(glowTexture); impactGlow.anchor.set(.5); impactGlow.tint = 0xa66ac3
  impactGlow.alpha = 0; impactGlow.label = 'sludge-bomb-v2-impact'; temporary.addChild(impactGlow)
  const drops = [], births = [1.02, 1.16, 1.34, 1.53, 1.73, 1.98, 2.0325]
  births.forEach((birth, wave) => {
    const count = wave === 0 ? 30 : wave >= 5 ? 14 : 8
    for (let i = 0; i < count; i++) {
      const radius = wave === 0 ? 4 + i % 3 * 2.5 : wave >= 5 ? 3 + i % 3 * 1.4 : 2.6 + i % 3
      const g = new Graphics().ellipse(0, 0, radius * 1.3, radius).fill(i % 2 ? 0xb47bc9 : 0x7d429c)
        .ellipse(-radius * .25, -radius * .27, radius * .4, radius * .21).fill({ color: 0xd9a9e7, alpha: .75 })
      g.label = `sludge-bomb-v2-drop-${wave}-${i}`; g.alpha = 0; temporary.addChild(g)
      const angle = i * Math.PI * 2 / count + wave * .31
      drops.push({ g, birth, wave, angle, radius, distance: (wave === 0 ? 80 : wave >= 5 ? 47 : 26) + i % 4 * 15,
        life: Math.min(wave === 0 ? .62 + i % 4 * .055 : .44, 2.37 - birth), origin: null })
    }
  })
  let from = null, collision = null
  const floor = targetSocket('floor')
  function update(time) {
    const mouth = socket('emission', true), target = targetSocket('center', true)
    if (time < .38) fit(bomb, mouth, 44, .65 + .35 * clamp((time - .32) / .12, 0, 1))
    else {
      from ??= { ...mouth }
      const p = clamp((time - .38) / .64, 0, 1), eased = p * p
      const height = Math.min(110, Math.max(0, Math.min(from.y, target.y) - top - 44))
      fit(bomb, { x: from.x + (target.x - from.x) * eased,
        y: from.y + (target.y - from.y) * eased - 4 * height * eased * (1 - eased) }, 44)
      bomb.rotation = eased * Math.PI * 1.5
    }
    bomb.alpha = time >= .32 && time < timing.contact ? Math.min(1, (time - .32) / .06) : 0
    if (time >= timing.contact) collision ??= { ...target }
    const age = time - timing.contact, tail = clamp((2.40 - time) / .15, 0, 1)
    impactGlow.position.copyFrom(target); impactGlow.width = Math.min(250, room(target) * 2); impactGlow.height = Math.min(190, room(target) * 2)
    impactGlow.alpha = age >= 0 ? .38 * Math.max(0, 1 - age / .55) : 0
    threads.clear(); pool.clear()
    if (collision && age >= 0 && time < 2.4) {
      const poolPoint = bounded({ x: collision.x, y: floor.y - 5 }, 16), width = Math.min(75, poolPoint.x - left, right - poolPoint.x)
      const spread = Math.min(1, age / .42), wobble = Math.sin(time * 21) * .8
      pool.ellipse(poolPoint.x, poolPoint.y, width * (.25 + .75 * spread), 10 + wobble)
        .fill({ color: 0x8945a5, alpha: .55 * tail })
      for (let i = 0; i < 5; i++) {
        const p = (time * 1.8 + i / 5) % 1, x = poolPoint.x + Math.sin(i * 2.4) * width * .7
        pool.ellipse(x, poolPoint.y - Math.sin(p * Math.PI) * 7, 3 + p * 5, 2 + p * 2)
          .stroke({ color: 0xbd80cf, width: 1.2, alpha: (1 - p) * tail * .7 })
      }
      if (age < .42) for (let i = 0; i < 11; i++) {
        const a = i * Math.PI * 2 / 11, p = age / .42, distance = (32 + i % 3 * 18) * p
        const end = bounded({ x: collision.x + Math.cos(a) * distance, y: collision.y + Math.sin(a) * distance * .72 + 22 * p * p }, 7)
        threads.moveTo(collision.x, collision.y).quadraticCurveTo((collision.x + end.x) / 2, (collision.y + end.y) / 2 - 10, end.x, end.y)
          .stroke({ color: i % 2 ? 0xb77acd : 0x79418f, width: 6 * (1 - p) + 1, alpha: .8 * (1 - p), cap: 'round' })
      }
    }
    for (const drop of drops) {
      const age = time - drop.birth, p = age / drop.life
      if (age < 0 || p >= 1 || !collision) { drop.g.alpha = 0; continue }
      drop.origin ??= drop.wave === 0 ? { ...collision } : { ...target }
      const origin = drop.origin, distance = Math.min(drop.distance, room(origin) / 1.85)
      const point = { x: origin.x + Math.cos(drop.angle) * distance * p,
        y: origin.y + Math.sin(drop.angle) * distance * p + distance * .55 * p * p }
      fit(drop.g, point, drop.radius * 1.7); drop.g.rotation = drop.angle + p * 1.5
      drop.g.alpha = .95 * Math.min(1, (1 - p) / .3) * tail
    }
  }
  onFrame(update)
  tl.to(attacker, { x: home.x - back, duration: .2 }, 0)
    .to(attacker, { x: home.x + thrust, duration: .16, ease: 'power2.out' }, .2)
    .call(() => { from = { ...socket('emission', true) }; update(.38) }, [], .38)
    .call(() => { collision = { ...targetSocket('center', true) }; update(timing.contact); onCue({ type: 'impact' }); defender.tint = 0xc39bd1 }, [], timing.contact)
    .to(defender, { x: defenderHome.x + recoil, duration: .06, repeat: 7, yoyo: true, ease: 'none' }, timing.contact)
    .call(() => { defender.tint = 0xffffff }, [], 1.26)
    .set(defender, { x: defenderHome.x }, 1.52)
    .to(attacker, { x: home.x, duration: .3 }, 1.4)
    .set(world, { x: 0, y: 0 }, timing.duration)
    .call(() => {}, [], timing.duration)
}
