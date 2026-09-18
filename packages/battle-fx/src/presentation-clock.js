import { gsap } from 'gsap'
import { createBattleFx } from './index.js'

/**
 * Optional cosmetic clock for hosts synchronizing independently owned media.
 * Each play owns its FX runtime so asynchronous artwork loading cannot attach
 * another run's observer to this run's timeline. No result cues are synthesized.
 */
export function createClockedBattleFx({ createFx = createBattleFx, timelineEngine = gsap,
  now = () => performance.now(), ...fxOptions } = {}) {
  const runs = new Set(), byScene = new WeakMap()
  let disposed = false

  function play(request = {}, options = {}) {
    const { scene, signal, onPresentation, reducedMotion = false, visualRate = 1,
      deadlineMs = fxOptions.deadlineMs, ...playOptions } = options
    if (disposed || signal?.aborted) return { finished: Promise.resolve({ status: 'cancelled' }), cancel() {} }
    if (!Number.isFinite(visualRate) || visualRate < .75 || visualRate > 1.25) {
      return { finished: Promise.resolve({ status: 'failed', reason: 'Visual rate must be between 0.75 and 1.25.' }), cancel() {} }
    }
    const ownsScene = scene !== null && (typeof scene === 'object' || typeof scene === 'function')
    if (ownsScene) byScene.get(scene)?.cancel()
    const run = { active: true, started: false, ended: false, raw: null, fx: null, inner: null }
    const active = () => run.active && !run.ended && !disposed && !signal?.aborted
    // A failed or disabled sound observer must never turn a successful move
    // animation into a failed battle presentation.
    function emit(type) {
      if (!active() || typeof onPresentation !== 'function') return
      try {
        onPresentation(Object.freeze({ type, timelineSeconds: type === 'start' ? 0 : run.raw.time() / visualRate,
          observedAtMs: now(), durationSeconds: run.raw.duration() / visualRate, reducedMotion: Boolean(reducedMotion) }))
      } catch { /* Presentation observers have no authority over FX results. */ }
    }
    const handle = {
      finished: null,
      cancel() {
        if (!run.active) return
        run.active = false
        run.inner?.cancel()
      },
    }
    function cleanup() {
      run.active = false
      runs.delete(handle)
      if (ownsScene && byScene.get(scene) === handle) byScene.delete(scene)
      // The underlying result already accounts for timeline/scene cleanup.
      // Dispose only this run's owned runtime resources, never another run's.
      try { run.fx?.dispose() } catch { /* Preserve the underlying FX result. */ }
    }
    runs.add(handle)
    if (ownsScene) byScene.set(scene, handle)
    try {
      run.fx = createFx({ ...fxOptions, ...(deadlineMs !== undefined ? { deadlineMs } : {}), timelineEngine: {
        timeline(vars) {
          const raw = timelineEngine.timeline({ ...vars, paused: true, onUpdate() {
            vars.onUpdate?.()
            if (run.started) emit('frame')
          } })
          run.raw = raw
          const kill = raw.kill.bind(raw)
          raw.kill = (...args) => { run.ended = true; return kill(...args) }
          // createBattleFx builds its recipe synchronously after timeline().
          // A throwing builder kills the paused timeline before this executes.
          queueMicrotask(() => {
            if (!active()) return
            // Keep recipe time, geometry and contact cues in authored units;
            // only the rate of presentation changes on this owned timeline.
            raw.timeScale(visualRate)
            run.started = true
            emit('start')
            if (active()) raw.play(0)
          })
          return raw
        },
      } })
      run.inner = run.fx.play(request, { ...playOptions, scene, signal, reducedMotion })
      handle.finished = Promise.resolve(run.inner.finished).then(result => {
        cleanup()
        return result
      }, error => {
        cleanup()
        return { status: 'failed', reason: error?.message ?? String(error) }
      })
    } catch (error) {
      run.inner?.cancel()
      cleanup()
      handle.finished = Promise.resolve({ status: 'failed', reason: error?.message ?? String(error) })
    }
    return handle
  }

  return { play, dispose() {
    if (disposed) return
    disposed = true
    for (const run of [...runs]) run.cancel()
  } }
}
