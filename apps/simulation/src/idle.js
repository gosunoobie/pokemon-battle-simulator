import { gsap } from 'gsap'

const PERIOD = 6.4
const GROWTH = .012
const SWAY = .0045
const TAU = Math.PI * 2

const eligible = actor => actor?.pose && !actor.pose.destroyed && !actor.root?.destroyed &&
  actor.root?.visible !== false && actor.root?.renderable !== false && actor.root?.alpha !== 0 &&
  actor.pose.visible !== false && actor.pose.alpha > 0

// Only the fields owned by idle motion are restored. Opacity, tint, visibility,
// depth and any shared textures remain under their existing owners' control.
function restore(actor) {
  if (!actor?.pose || actor.pose.destroyed) return
  actor.pose.position.set(0, 0)
  actor.pose.scale.set(1)
  actor.pose.rotation = 0
}

function describe(actor, scene, startedAt) {
  const { width, height } = actor.metrics ?? {}
  const center = actor.base?.('visualCenter'), origin = actor.base?.('origin')
  if (![width, height, center?.x, center?.y, origin?.x, origin?.y, scene.width, scene.height].every(Number.isFinite) || width <= 0 || height <= 0) return null
  const bottom = { x: center.x, y: center.y + height / 2 }
  // Bound the complete rotated rectangle for either sway direction. Using an
  // envelope rather than the semantic floor socket also handles custom pivots.
  const fits = amount => {
    const scale = 1 + GROWTH * amount, sine = Math.sin(SWAY * amount)
    const halfWidth = (width / 2 + height * sine) * scale
    return bottom.x - halfWidth >= 0 && bottom.x + halfWidth <= scene.width &&
      bottom.y - (height + width / 2 * sine) * scale >= 0 &&
      bottom.y + width / 2 * sine * scale <= scene.height
  }
  let amount = 1
  if (!fits(amount)) {
    let low = 0, high = 1
    for (let index = 0; index < 24; index++) {
      const middle = (low + high) / 2
      if (fits(middle)) low = middle
      else high = middle
    }
    amount = low
  }
  const far = bottom.x > scene.width / 2
  return { actor, startedAt, amount, phase: far ? 1.9 : 0, direction: far ? -1 : 1,
    foot: { x: bottom.x - origin.x, y: bottom.y - origin.y } }
}

/** Host-owned ambient presentation; callers relinquish idle before any FX clip. */
export function createIdleMotion({ scene, timelineEngine = gsap } = {}) {
  let entries = new Map(), timeline = null, disposed = false, generation = 0
  const clock = { time: 0 }
  const elapsed = () => timeline?.totalTime?.() ?? clock.time

  function pause() {
    generation++
    const previous = timeline, owned = entries
    timeline = null; entries = new Map()
    // Remove the callback before releasing actors, so even a retained timeline
    // reference cannot overwrite a subsequent attack or transition pose.
    try { previous?.eventCallback?.('onUpdate', null) } catch {}
    try { previous?.kill() } catch {}
    for (const { actor } of owned.values()) { try { restore(actor) } catch {} }
  }

  function render(token) {
    if (disposed || token !== generation) return
    const time = elapsed(), wave = clock.time / PERIOD * TAU
    for (const [id, entry] of entries) {
      const { actor, amount, phase, direction, foot } = entry
      if (!eligible(actor)) {
        entries.delete(id)
        try { restore(actor) } catch {}
        continue
      }
      try {
        const fade = Math.max(0, Math.min(1, (time - entry.startedAt) / .7))
        const weight = fade * fade * (3 - 2 * fade) * amount
        const scale = 1 + GROWTH * (1 - Math.cos(wave * 2 + phase)) / 2 * weight
        const rotation = SWAY * Math.sin(wave + phase * .7) * direction * weight
        const cosine = Math.cos(rotation), sine = Math.sin(rotation)
        actor.pose.scale.set(scale)
        actor.pose.rotation = rotation
        actor.pose.position.set(foot.x - scale * (foot.x * cosine - foot.y * sine),
          foot.y - scale * (foot.x * sine + foot.y * cosine))
      } catch {
        entries.delete(id)
        try { restore(actor) } catch {}
      }
    }
    if (!entries.size) pause()
  }

  function setActors(actorIds = []) {
    if (disposed) return
    const requested = new Map()
    for (const id of Array.isArray(actorIds) ? new Set(actorIds) : []) {
      const actor = scene?.actor(id)
      if (eligible(actor)) requested.set(id, actor)
    }
    for (const [id, entry] of entries) {
      if (requested.get(id) === entry.actor) continue
      entries.delete(id)
      try { restore(entry.actor) } catch {}
    }
    for (const [id, actor] of requested) {
      if (entries.has(id)) continue
      const entry = describe(actor, scene, timeline ? elapsed() : 0)
      if (!entry) continue
      try { restore(actor); entries.set(id, entry) } catch {}
    }
    if (!entries.size) { pause(); return }
    if (timeline) return
    clock.time = 0
    const token = ++generation
    try {
      timeline = timelineEngine.timeline({ repeat: -1, onUpdate: () => render(token) })
      timeline.to(clock, { time: PERIOD, duration: PERIOD, ease: 'none' })
    } catch { pause() }
  }

  return { setActors, pause, dispose() { if (disposed) return; disposed = true; pause() } }
}
