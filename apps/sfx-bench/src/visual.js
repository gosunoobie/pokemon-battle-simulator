import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'

// Authoring-only timeline adapter. Production FX and result cues are untouched.
// A paused timeline lets the bench start sound only after async artwork loading
// and recipe construction. The bench cannot seek or change a move's choreography.
export function createVisualAuditioner({ createFx = createBattleFx, timelineEngine = gsap, now = () => performance.now() } = {}) {
  let current, disposed = false
  const fx = createFx({ timelineEngine: {
    timeline(vars) {
      const run = current
      let raw
      raw = timelineEngine.timeline({ ...vars, paused: true, onUpdate() {
        vars.onUpdate?.()
        if (current === run && !run.cancelled) run.onFrame?.(raw.time())
      } })
      run.timeline = raw
      const kill = raw.kill.bind(raw)
      raw.kill = (...args) => { run.timelineEnded = true; return kill(...args) }
      // Build callbacks are registered synchronously by createBattleFx after this
      // factory returns. Append bench markers after the original recipe is built.
      queueMicrotask(() => {
        if (current !== run || run.cancelled || run.timelineEnded || disposed) return
        for (const marker of run.subject.markers) raw.call(() => {
          if (current === run && !run.cancelled) run.onMarker?.({ ...marker, observedTimelineSeconds: raw.time(), observedAtMs: now(), origin: 'authored-guide' })
        }, [], marker.timeSeconds)
        try {
          run.startedAtMs = now()
          run.onStart?.({ startedAtMs: run.startedAtMs, durationSeconds: raw.duration() })
          if (current === run && !run.cancelled) raw.play(0)
        } catch (error) { run.error = error; run.handle?.cancel() }
      })
      return raw
    },
  } })
  function stop() {
    if (!current) return
    current.cancelled = true
    current.handle?.cancel()
    current.timeline?.kill()
    current = null
  }
  return {
    play(subject, { scene, sourceId = 'source', onStart, onFrame, onMarker } = {}) {
      stop()
      if (disposed) throw new Error('Visual auditioner is disposed')
      if (!subject?.fxId) throw new Error('This candidate has no authored move animation')
      const run = { subject, onStart, onFrame, onMarker, cancelled: false }
      current = run
      run.handle = fx.play({ moveId: subject.fxId, phase: subject.phase, sourceId,
        targetIds: [sourceId === 'source' ? 'target' : 'source'], visualSeed: 42 }, {
        scene,
        onCue(cue) {
          if (current === run && !run.cancelled) onMarker?.({ id: cue.type, label: cue.type,
            timeSeconds: run.timeline?.time() ?? 0, observedTimelineSeconds: run.timeline?.time() ?? 0,
            observedAtMs: now(), origin: 'observed-result-cue' })
        },
      })
      return { cancel: () => { if (current === run) stop() }, finished: run.handle.finished.then(result => {
        if (current === run) current = null
        return run.error ? { status: 'failed', reason: run.error.message } : result
      }) }
    },
    stop,
    dispose() { stop(); disposed = true; fx.dispose() },
  }
}
