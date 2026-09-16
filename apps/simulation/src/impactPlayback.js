// This owns a DOM overlay's lifetime, never the Pokémon's pose or battle state.
export const IMPACT_TIMINGS = Object.freeze({ full: 1100, reduced: 800 })

export function impactPosition(scene, actorId) {
  const fallback = actorId === 'source' ? { x: .25, y: .57 } : { x: .75, y: .4 }
  try {
    const actor = scene?.actor(actorId)
    if (!actor || !(scene.width > 0) || !(scene.height > 0)) return fallback
    const anchor = actor.anchor('visualCenter')
    // Include any move-owned camera transform at the contact instant, while
    // keeping coordinates independent of canvas pixels and responsive fitting.
    const point = scene.root?.toLocal && scene.effects ? scene.root.toLocal(anchor, scene.effects) : anchor
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return fallback
    return { x: Math.max(0, Math.min(1, point.x / scene.width)), y: Math.max(0, Math.min(1, point.y / scene.height)) }
  } catch { return fallback }
}

export function createImpactPlayback({ onFeedback, getScene = () => null, timers = globalThis }) {
  let active = null, disposed = false, sequence = 0
  const publish = value => { try { onFeedback(value) } catch {} }
  function finish(operation, status) {
    if (!operation || operation.settled) return
    operation.settled = true
    timers.clearTimeout(operation.timer)
    operation.signal?.removeEventListener('abort', operation.abort)
    if (active === operation) { active = null; publish(null) }
    operation.resolve({ status })
  }
  return {
    play(feedback, { reducedMotion = false, signal } = {}) {
      finish(active, 'cancelled')
      if (disposed || signal?.aborted || !feedback) return { finished: Promise.resolve({ status: 'cancelled' }), cancel() {} }
      let resolve
      const finished = new Promise(done => { resolve = done })
      const operation = { resolve, signal, settled: false }
      operation.abort = () => finish(operation, 'cancelled')
      active = operation
      const durationMs = reducedMotion ? IMPACT_TIMINGS.reduced : IMPACT_TIMINGS.full
      let scene
      try { scene = getScene() } catch {}
      const value = { ...feedback, ...impactPosition(scene, feedback.actorId),
        key: `${feedback.key}:${++sequence}`, durationMs, reducedMotion }
      signal?.addEventListener('abort', operation.abort, { once: true })
      operation.timer = timers.setTimeout(() => finish(operation, 'completed'), durationMs)
      publish(value)
      return { finished, cancel: () => finish(operation, 'cancelled') }
    },
    clear() { finish(active, 'cancelled') },
    destroy() { disposed = true; finish(active, 'cancelled') },
  }
}
