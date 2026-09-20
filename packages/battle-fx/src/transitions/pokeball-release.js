import { ColorMatrixFilter, Container, Graphics } from 'pixi.js'
import { gsap } from 'gsap'

const DURATION = 1.35
const OPEN = .52
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const progress = (time, start, duration) => clamp((time - start) / duration, 0, 1)
const easeOut = t => 1 - (1 - t) ** 3

function ballHalf(radius, upper, color) {
  const points = []
  for (let step = 0; step <= 20; step++) {
    const angle = Math.PI * step / 20 + (upper ? Math.PI : 0)
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius)
  }
  return new Graphics().poly(points).fill(color).stroke({ color: 0x243348, width: radius * .15 })
}

/** Cosmetic entry only. The host has already selected/committed these actors. */
export function playPokeballRelease({ scene, actorIds = [], reducedMotion = false, signal, onCue, timelineEngine = gsap } = {}) {
  let settled = false, layer, timeline, timer, resolve
  const actors = [], entries = [], filters = []
  const finished = new Promise(done => { resolve = done })
  const handle = { finished, cancel: () => finish('cancelled') }
  const abort = () => finish('cancelled')
  function finish(status, error) {
    if (settled) return
    settled = true
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    let cleanupError
    const attempt = fn => { try { fn() } catch (error) { cleanupError ??= error } }
    attempt(() => timeline?.kill())
    attempt(() => { if (layer && !layer.destroyed) layer.destroy({ children: true }) })
    for (const filter of filters) attempt(() => filter.destroy())
    for (const actor of actors) attempt(() => actor.resetPose())
    const reason = error ?? cleanupError
    resolve({ status: cleanupError ? 'failed' : status, ...(reason ? { reason: reason.message ?? String(reason) } : {}) })
  }
  if (signal?.aborted) { finish('cancelled'); return handle }
  if (!scene?.effects || !Array.isArray(actorIds)) { finish('skipped'); return handle }

  function render(time) {
    if (settled) return
    try {
      for (const entry of entries) {
        const { actor, center, offset } = entry, local = time - offset
        if (reducedMotion) {
          actor.pose.alpha = progress(local, 0, .25)
          continue
        }
        const reveal = progress(local, OPEN + .025, .36)
        const scale = .07 + .93 * easeOut(reveal)
        actor.pose.scale.set(scale)
        actor.pose.position.set(0, 0)
        // Registration pivots can lie outside the artwork. Keep the visible art
        // centered on the opened ball, then grow into its exact resting bounds.
        const posed = actor.anchor('visualCenter')
        actor.pose.position.set(center.x - posed.x, center.y - posed.y)
        actor.pose.alpha = progress(local, OPEN + .025, .1)

        const { ball, upper, lower, glint, button, seam, rim, rings, core, rays, motes, trail, wake,
          radius, start, arc, burstRadius, silhouette, silhouetteOrigin } = entry
        const point = t => ({ x: start.x + (center.x - start.x) * t,
          y: start.y + (center.y - start.y) * t - Math.sin(Math.PI * t) * arc })
        const toss = progress(local, 0, OPEN), p = point(toss), opened = progress(local, OPEN, .21)
        const direction = center.x > start.x ? 1 : -1
        const spin = direction * (Math.PI * 4 * (1 - (1 - toss) ** 1.2) + opened * .4)
        ball.position.copyFrom(p)
        // Keep the roll continuous through opening. The projected button and
        // curved equator make the turn visible even when the outline is circular.
        ball.rotation = spin
        ball.alpha = local < 0 ? 0 : 1 - opened
        upper.y = -opened * radius * 1.1; lower.y = opened * radius * .8
        upper.rotation = -opened * .55; lower.rotation = opened * .4
        glint.position.copyFrom(upper.position); glint.rotation = upper.rotation
        const roll = Math.PI * 4 * toss, projection = Math.cos(roll)
        button.x = Math.sin(roll) * radius * .62
        button.y = Math.sin(roll) * radius * .13
        button.scale.x = .3 + .7 * Math.abs(projection)
        button.alpha = (1 - opened) * clamp(projection * 4 + .3, 0, 1)
        seam.clear().moveTo(-radius, 0).bezierCurveTo(-radius * .4, Math.sin(roll) * radius * .3,
          radius * .4, Math.sin(roll) * radius * .3, radius, 0).stroke({ color: 0x17263c, width: radius * .18 })
        seam.alpha = rim.alpha = 1 - opened

        // A connected, tapered wake reads as speed, rather than three loose dots.
        trail.clear(); wake.clear()
        for (let segment = 0; segment < 15; segment++) {
          const a = point(clamp(toss - .31 + segment * .02, 0, 1))
          const b = point(clamp(toss - .31 + (segment + 1) * .02, 0, 1))
          const taper = (segment + 1) / 15
          trail.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0x59dfff, width: radius * .84 * taper, alpha: .28 * taper, cap: 'round' })
          trail.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0xfff3af, width: radius * .2 * taper, alpha: .9 * taper, cap: 'round' })
          if (segment % 3 === 0) wake.moveTo(a.x, a.y + radius * .7).lineTo(b.x, b.y + radius * .7)
            .stroke({ color: 0xcaf9ff, width: radius * .09, alpha: .5 * taper, cap: 'round' })
        }
        trail.alpha = wake.alpha = local > 0 ? 1 - progress(local, OPEN, .14) : 0

        const burst = progress(local, OPEN, .7), flashing = local >= OPEN
        core.position.copyFrom(center); core.scale.set(.34 + .66 * easeOut(progress(local, OPEN, .18)))
        core.alpha = flashing ? (1 - progress(local, OPEN, .27)) ** 1.6 : 0
        rays.position.copyFrom(center); rays.rotation = direction * burst * .16
        rays.scale.set(.24 + .76 * easeOut(progress(local, OPEN, .32)))
        rays.alpha = flashing ? (1 - progress(local, OPEN, .46)) ** 1.3 : 0
        rings.forEach((ring, index) => {
          const age = local - OPEN - index * .055, travel = clamp(age / (.46 + index * .08), 0, 1)
          ring.position.copyFrom(center); ring.scale.set(.17 + .83 * easeOut(travel))
          ring.alpha = age >= 0 ? (1 - travel) * (index ? .85 : 1) : 0
        })
        for (const [index, mote] of motes.entries()) {
          const angle = index * Math.PI * 2 / motes.length - Math.PI / 2
          const age = local - OPEN - (index % 3) * .018, travel = clamp(age / (.62 + index % 3 * .04), 0, 1)
          const distance = burstRadius * (.16 + .67 * (.6 * easeOut(travel) + .4 * travel))
          mote.position.set(center.x + Math.cos(angle) * distance,
            center.y + Math.sin(angle) * distance + burstRadius * .09 * travel * travel)
          mote.rotation = angle + Math.PI / 2 + direction * travel * .7
          mote.scale.set(.35 + (1 - travel) * .65)
          mote.alpha = age >= 0 ? (1 - travel) ** .7 : 0
        }
        if (silhouette) {
          silhouette.scale.set(scale)
          silhouette.position.set(center.x + (silhouetteOrigin.x - center.x) * scale,
            center.y + (silhouetteOrigin.y - center.y) * scale)
          silhouette.alpha = progress(local, OPEN + .025, .045) * (1 - progress(local, OPEN + .105, .23))
        }
      }
      // Publish only after poses/art are updated. Optional consumers cannot
      // interrupt the clip, and seeking or revisiting a frame cannot replay it.
      for (const entry of entries) {
        if (settled) return
        if (!entry.opened && (reducedMotion ? entry.actor.pose.alpha > 0 : time - entry.offset >= OPEN)) {
          entry.opened = true
          try { onCue?.({ type: 'open', actorId: entry.actor.id }) } catch {}
        }
        if (settled) return
        if (entry.revealed || entry.actor.pose.alpha <= 0) continue
        entry.revealed = true
        try { onCue?.({ type: 'reveal', actorId: entry.actor.id }) } catch {}
      }
    } catch (error) { finish('failed', error) }
  }

  try {
    for (const id of new Set(actorIds)) {
      const actor = scene.actor(id)
      if (actor?.pose && actor.anchor && actor.resetPose && !actors.includes(actor)) actors.push(actor)
    }
    if (!actors.length) { finish('skipped'); return handle }
    signal?.addEventListener('abort', abort, { once: true })
    // Hide before returning the handle so a new scene cannot render the incoming
    // Pokémon for one frame before its ball arrives.
    for (const actor of actors) { actor.resetPose(); actor.pose.alpha = 0 }
    layer = new Container(); layer.label = 'pokeball-release'; scene.effects.addChild(layer)
    const unit = scene.unit ?? 1
    for (const [index, actor] of actors.entries()) {
      const center = actor.anchor('visualCenter'), offset = reducedMotion ? 0 : Math.min(index, 1) * .1
      const entry = { actor, center: { ...center }, offset }
      entries.push(entry)
      if (reducedMotion) continue
      const radius = 20 * unit, ball = new Container()
      ball.label = `pokeball-${actor.id}`
      ball.scale.set(.7)
      const upper = ballHalf(radius, true, 0xed454e), lower = ballHalf(radius, false, 0xf9fbff)
      upper.label = 'pokeball-red-half'; lower.label = 'pokeball-white-half'
      const glint = new Graphics().ellipse(-radius * .27, -radius * .5, radius * .34, radius * .13).fill({ color: 0xffffff, alpha: .88 })
        .circle(radius * .42, -radius * .33, radius * .09).fill(0xffb8a7)
      glint.label = 'pokeball-glint'
      const rim = new Graphics().circle(0, 0, radius).stroke({ color: 0x142338, width: radius * .12 })
      const seam = new Graphics(); seam.label = 'pokeball-equator'
      const button = new Graphics().circle(0, 0, radius * .31).fill(0x243348)
        .circle(0, 0, radius * .21).fill(0xffffff).circle(0, 0, radius * .1).fill(0xb8e7fa)
      button.label = 'pokeball-button'
      ball.addChild(lower, upper, glint, rim, seam, button)
      const start = { x: center.x < scene.width / 2 ? 36 * unit : scene.width - 36 * unit,
        y: clamp(center.y + 76 * unit, radius * 2, scene.height - radius * 2) }
      const arc = Math.min(95 * unit, Math.max(0, Math.min(start.y, center.y) - radius * 2))
      const clearance = Math.min(center.x, scene.width - center.x, center.y, scene.height - center.y)
      const burstRadius = Math.max(0, Math.min(112 * unit, clearance - 8 * unit))
      const rings = [0xc7f6ff, 0xffdf83].map((color, i) => {
        const ring = new Graphics().circle(0, 0, burstRadius * (i ? .83 : 1)).stroke({ color, width: (i ? 3 : 4) * unit })
        ring.label = `release-ring-${actor.id}-${i}`; ring.blendMode = 'add'
        return ring
      })
      const core = new Graphics()
      core.label = `release-core-${actor.id}`; core.blendMode = 'add'
      for (const [size, alpha, color] of [[.7, .11, 0x52ceff], [.5, .24, 0xb7efff], [.32, .58, 0xe5fbff], [.18, 1, 0xffffff]]) {
        core.circle(0, 0, burstRadius * size).fill({ color, alpha })
      }
      const rays = new Graphics()
      rays.label = `release-light-${actor.id}`
      rays.blendMode = 'add'
      for (let ray = 0; ray < 12; ray++) {
        const angle = ray * Math.PI / 6, length = burstRadius * (ray % 2 ? .66 : .94), spread = .035
        rays.poly([Math.cos(angle - spread) * burstRadius * .12, Math.sin(angle - spread) * burstRadius * .12,
          Math.cos(angle) * length, Math.sin(angle) * length,
          Math.cos(angle + spread) * burstRadius * .12, Math.sin(angle + spread) * burstRadius * .12])
          .fill(ray % 2 ? 0xffe49f : 0xecfdff)
      }
      const trail = new Graphics(), wake = new Graphics()
      trail.label = `pokeball-trail-${actor.id}`; wake.label = `pokeball-wake-${actor.id}`
      trail.blendMode = wake.blendMode = 'add'
      const motes = Array.from({ length: 18 }, (_, i) => {
        const mote = new Graphics().poly([0, -7 * unit, 2.6 * unit, 0, 0, 4 * unit, -2.6 * unit, 0])
          .fill(i % 3 ? 0xc9f6ff : 0xffe29a)
        mote.blendMode = 'add'
        mote.label = `release-mote-${actor.id}-${i}`
        return mote
      })
      layer.addChild(trail, wake, ...rings, core, rays, ...motes, ball)
      // White energy uses an owned copy of the supplied artwork, never a species
      // texture lookup or a filter attached to the live Pokémon.
      const silhouette = actor.snapshot?.()
      const silhouetteOrigin = silhouette ? { x: silhouette.x, y: silhouette.y } : null
      if (silhouette) {
        silhouette.label = `release-silhouette-${actor.id}`
        layer.addChild(silhouette)
        const white = new ColorMatrixFilter(); filters.push(white)
        white.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]
        silhouette.filters = [white]
      }
      Object.assign(entry, { radius, ball, upper, lower, glint, button, seam, rim, start, arc, burstRadius,
        rings, core, rays, trail, wake, motes, silhouette, silhouetteOrigin })
    }
    const duration = reducedMotion ? .25 : DURATION + Math.min(actors.length - 1, 1) * .1
    const clock = { time: 0 }
    timeline = timelineEngine.timeline({ onUpdate: () => render(clock.time), onComplete: () => finish('completed') })
    timeline.to(clock, { time: duration, duration, ease: 'none' }, 0)
    render(0)
    if (!settled) timer = setTimeout(() => finish('failed', new Error('Poké Ball release deadline exceeded.')), 5000)
  } catch (error) { finish('failed', error) }
  return handle
}
