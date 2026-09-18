import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { validateVisualRate, SYNC_LIMITS } from './sync.js'

// Isolated development transport. Raw recipe time stays authored time; GSAP's
// rate changes wall-clock pacing without rewriting geometry or result cues.
export function createSyncVisualAuditioner({ createFx = createBattleFx, timelineEngine = gsap, now = () => performance.now() } = {}) {
  let current = null, disposed = false
  const valid = run => !disposed && current === run && !run.cancelled && !run.ended
  function cancel(run) {
    if (!run || run.cancelled) return
    run.cancelled = true
    run.handle?.cancel()
    run.timeline?.kill()
    if (current === run) current = null
  }
  function notify(run, callback, ...args) {
    if (!valid(run) || typeof callback !== 'function') return
    try { callback(...args) } catch (error) { run.error = error; cancel(run) }
  }
  function timing(run) {
    const authoredTimelineSeconds = run.timeline?.time() ?? 0, observedAtMs = now()
    return { authoredTimelineSeconds, elapsedSeconds: authoredTimelineSeconds / run.visualRate,
      elapsedWallSeconds: run.startedAtMs == null ? 0 : (observedAtMs - run.startedAtMs) / 1000, observedAtMs }
  }
  return {
    play(subject, { scene, sourceId = 'source', visualRate = 1, onStart, onFrame, onMarker } = {}) {
      if (disposed) throw new Error('Sync visual auditioner is disposed')
      validateVisualRate(visualRate)
      const visual = subject?.visual ?? subject
      const durationSeconds = visual?.durationSeconds
      if (!subject?.fxId || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > SYNC_LIMITS.maxDurationSeconds) throw new Error('A valid authored move animation and duration are required')
      const suppliedMarkers = visual.markers ?? []
      if (!Array.isArray(suppliedMarkers) || suppliedMarkers.length > 64 || suppliedMarkers.some(marker => !marker || typeof marker.id !== 'string'
        || !marker.id || typeof marker.label !== 'string' || !Number.isFinite(marker.timeSeconds)
        || marker.timeSeconds < 0 || marker.timeSeconds > durationSeconds)) throw new Error('Invalid authored comparison markers')
      const markers = suppliedMarkers.map(({ id, label, timeSeconds }) => ({ id, label, timeSeconds }))
      cancel(current)
      const run = { subject, visualRate, startedAtMs: null, cancelled: false, ended: false, error: null, timeline: null, handle: null }
      current = run
      let fx
      try {
        fx = createFx({ deadlineMs: Math.max(6000, durationSeconds / visualRate * 1000 + 1500), timelineEngine: {
          timeline(vars) {
            let raw
            raw = timelineEngine.timeline({ ...vars, paused: true, onUpdate() {
              vars.onUpdate?.()
              if (run.startedAtMs != null && valid(run)) {
                const observed = timing(run)
                notify(run, onFrame, observed.elapsedSeconds, observed)
              }
            } })
            run.timeline = raw
            raw.timeScale(visualRate)
            const kill = raw.kill.bind(raw)
            raw.kill = (...args) => { run.ended = true; return kill(...args) }
            queueMicrotask(() => {
              if (!valid(run)) return
              if (markers.some(marker => marker.timeSeconds > raw.duration())) {
                run.error = new Error('Comparison markers cannot extend the authored animation')
                cancel(run)
                return
              }
              for (const marker of markers) raw.call(() => {
                const observed = timing(run)
                notify(run, onMarker, { ...marker, ...observed, observedTimelineSeconds: observed.authoredTimelineSeconds,
                  elapsedCueSeconds: marker.timeSeconds / visualRate, visualRate, origin: 'authored-guide' })
              }, [], marker.timeSeconds)
              run.startedAtMs = now()
              notify(run, onStart, { startedAtMs: run.startedAtMs, durationSeconds: raw.duration() / visualRate,
                authoredDurationSeconds: raw.duration(), visualRate })
              if (valid(run)) raw.play(0)
            })
            return raw
          },
        } })
        run.handle = fx.play({ moveId: subject.fxId, phase: subject.phase ?? 'attack', sourceId,
          targetIds: [sourceId === 'source' ? 'target' : 'source'], visualSeed: 42 }, {
          scene,
          onCue(cue) {
            const observed = timing(run)
            notify(run, onMarker, { id: cue.type, label: cue.type, timeSeconds: observed.authoredTimelineSeconds,
              ...observed, observedTimelineSeconds: observed.authoredTimelineSeconds, visualRate, origin: 'observed-result-cue' })
          },
        })
      } catch (error) {
        run.error = error; cancel(run)
        try { fx?.dispose() } catch { /* Best-effort owned cleanup. */ }
        return { cancel() {}, finished: Promise.resolve({ status: 'failed', reason: error.message }) }
      }
      const finished = Promise.resolve(run.handle.finished).then(result => run.error ? { status: 'failed', reason: run.error.message } : result,
        error => ({ status: 'failed', reason: error?.message ?? String(error) })).finally(() => {
        run.ended = true
        if (current === run) current = null
        try { fx.dispose() } catch { /* Other runs have independent ownership. */ }
      })
      return { cancel: () => { if (current === run) cancel(run) }, finished }
    },
    stop() { cancel(current) },
    dispose() { cancel(current); disposed = true },
  }
}
