import { ColorMatrixFilter, Container, Graphics } from 'pixi.js'
import { gsap } from 'gsap'

const DURATION = .9
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const progress = (time, start, duration) => clamp((time - start) / duration, 0, 1)

/** Cosmetic exit only. The host chooses fainted actors and owns final visibility. */
export function playPokemonFaint({ scene, actorIds = [], reducedMotion = false, signal, onCue, timelineEngine = gsap } = {}) {
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
        const { actor } = entry
        if (reducedMotion) {
          actor.pose.alpha = 1 - progress(time, 0, .22)
          continue
        }
        const { copy, origin, filter, height, dip, ground, ripple, dust, radius } = entry
        const sinking = progress(time, .2, .56), dropped = sinking * sinking
        if (copy) {
          // Translate a full-size copy behind a fixed ground mask. No scaling or
          // rotation around registration pivots can distort the defeated sprite.
          copy.position.set(origin.x, origin.y + dip * progress(time, 0, .18) + (height + 2) * dropped)
          copy.alpha = 1 - progress(time, .64, .16) * .35
          actor.pose.alpha = 0
          const gray = progress(time, .015, .18) * .8, saturation = 1 - gray
          const r = .2126 * gray, g = .7152 * gray, b = .0722 * gray
          filter.matrix = [r + saturation, g, b, 0, 0, r, g + saturation, b, 0, 0,
            r, g, b + saturation, 0, 0, 0, 0, 0, 1, 0]
        } else {
          // Adapters without artwork capture use a short, bounded dip and fade.
          actor.pose.y = dip * progress(time, 0, .4)
          actor.pose.alpha = 1 - progress(time, .14, .48)
        }
        const wake = progress(time, .2, .61)
        ripple.position.copyFrom(ground)
        ripple.scale.set(.62 + .38 * wake)
        ripple.alpha = Math.sin(Math.PI * wake) * .24
        for (const [index, mote] of dust.entries()) {
          const age = time - .3 - (index % 3) * .025, life = .43, travel = clamp(age / life, 0, 1)
          const direction = index % 2 ? 1 : -1
          mote.position.set(ground.x + direction * radius * (.2 + .72 * travel),
            ground.y - Math.sin(Math.PI * travel) * entry.dustRise - entry.dustSize)
          mote.scale.set(1 - travel * .55)
          mote.alpha = age >= 0 ? Math.sin(Math.PI * travel) * .28 : 0
        }
      }
      // Publish after the first frame is ready, including the owned snapshot.
      // Revisited frames and optional consumers cannot restart or break a clip.
      for (const entry of entries) {
        if (settled) return
        if (entry.started) continue
        entry.started = true
        try { onCue?.({ type: 'faint', actorId: entry.actor.id }) } catch {}
      }
    } catch (error) { finish('failed', error) }
  }

  try {
    for (const id of new Set(actorIds)) {
      const actor = scene.actor(id)
      if (actor?.pose && actor.anchor && actor.resetPose && actor.metrics?.height > 0 && !actors.includes(actor)) actors.push(actor)
    }
    if (!actors.length) { finish('skipped'); return handle }
    signal?.addEventListener('abort', abort, { once: true })
    for (const actor of actors) actor.resetPose()
    layer = new Container(); layer.label = 'pokemon-faint'; scene.effects.addChild(layer)
    const unit = scene.unit ?? 1
    for (const actor of actors) {
      const entry = { actor }; entries.push(entry)
      if (reducedMotion) continue
      const center = actor.anchor('visualCenter'), height = actor.metrics.height
      // Semantic floor/ground sockets can intentionally sit inside the sprite.
      // Fainting clips at the actual visible bottom, also used by the platform.
      const ground = { x: center.x, y: center.y + height / 2 }
      const dip = Math.min(7 * unit, height * .05, Math.max(0, scene.height - ground.y - 2 * unit))
      const radius = Math.max(0, Math.min(72 * unit, actor.metrics.width * .4,
        ground.x - 3 * unit, scene.width - ground.x - 3 * unit))
      const ripple = new Graphics().ellipse(0, 0, radius, Math.min(8 * unit,
        Math.max(0, scene.height - ground.y - unit), Math.max(0, ground.y - unit)))
        .stroke({ color: 0xc2c8b2, width: 1.5 * unit })
      ripple.label = `faint-ripple-${actor.id}`
      layer.addChild(ripple)
      const copy = actor.snapshot?.()
      let origin, filter
      if (copy) {
        copy.label = `faint-copy-${actor.id}`; layer.addChild(copy)
        origin = { x: copy.x, y: copy.y }
        const clip = new Graphics().rect(0, 0, scene.width, Math.max(0, ground.y)).fill(0xffffff)
        clip.label = `faint-clip-${actor.id}`; layer.addChild(clip); copy.mask = clip
        filter = new ColorMatrixFilter(); filters.push(filter); copy.filters = [filter]
        actor.pose.alpha = 0
      }
      const dustSize = Math.min(2.5 * unit, radius * .06, Math.max(0, ground.y / 4))
      const dustRise = Math.min(8 * unit, Math.max(0, ground.y - dustSize * 2))
      const dust = Array.from({ length: 6 }, (_, i) => {
        const mote = new Graphics().ellipse(0, 0, dustSize, dustSize * .55).fill(i % 2 ? 0xc7c5ac : 0x8eac9c)
        mote.label = `faint-dust-${actor.id}-${i}`; layer.addChild(mote)
        return mote
      })
      Object.assign(entry, { copy, origin, filter, height, dip, ground, radius, ripple, dust, dustSize, dustRise })
    }
    const duration = reducedMotion ? .22 : DURATION, clock = { time: 0 }
    timeline = timelineEngine.timeline({ onUpdate: () => render(clock.time), onComplete: () => finish('completed') })
    timeline.to(clock, { time: duration, duration, ease: 'none' }, 0)
    render(0)
    if (!settled) timer = setTimeout(() => finish('failed', new Error('Pokémon faint deadline exceeded.')), 5000)
  } catch (error) { finish('failed', error) }
  return handle
}
