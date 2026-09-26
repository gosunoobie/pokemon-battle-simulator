import { createReviewedBattleFx } from '../../shared/battle/reviewedFx.js'

const safe = callback => { try { return callback() } catch { return undefined } }
const cancelled = () => ({ status: 'cancelled' })

/** Owns cosmetic playback only; no battle state or result is calculated here. */
export function createPlaygroundPlayback({ getScene, audio, onState, createFx = createReviewedBattleFx,
  document: doc = globalThis.document, setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: unschedule = globalThis.clearTimeout } = {}) {
  const fx = createFx()
  let disposed = false, current = null
  let state = Object.freeze({ status: 'idle', busy: false, cue: null, message: 'Ready to play.', iteration: 0 })

  function publish(patch) {
    state = Object.freeze({ ...state, ...patch })
    if (!disposed) safe(() => onState?.(state))
  }
  function cancelJob(job) {
    if (!job || job.cancelled) return
    job.cancelled = true
    job.cancelWait?.()
    safe(() => job.handle?.cancel())
    safe(() => job.sound?.cancel())
    job.settleFirst(cancelled())
  }
  function stop(message = 'Playback stopped.') {
    cancelJob(current)
    current = null
    safe(() => audio?.stop())
    publish({ status: 'idle', busy: false, cue: null, message })
  }
  function active(job) {
    if (disposed || current !== job || job.cancelled) return false
    if (doc?.hidden || safe(getScene) !== job.scene) {
      stop(doc?.hidden ? 'Playback stopped while the page is hidden.' : 'Playback stopped because the scene changed.')
      return false
    }
    return true
  }

  // Every pending load, FX result and repeat delay can settle immediately on
  // Stop, even when an optional decoder or renderer never settles its promise.
  function wait(job, promise, timeoutMs) {
    return new Promise(resolve => {
      let settled = false, timer
      const finish = value => {
        if (settled) return
        settled = true
        if (timer !== undefined) unschedule(timer)
        if (job.cancelWait === cancel) job.cancelWait = null
        resolve(value)
      }
      const cancel = () => finish(cancelled())
      job.cancelWait = cancel
      if (timeoutMs !== undefined) timer = schedule(() => finish(undefined), timeoutMs)
      if (promise !== undefined) Promise.resolve(promise).then(finish,
        error => finish({ status: 'failed', reason: error?.message ?? String(error) }))
      if (!active(job)) cancel()
    })
  }

  async function run(job) {
    while (active(job)) {
      job.iteration++
      let impacted = false
      safe(() => audio?.stop())
      job.sound = safe(() => audio?.begin({ moveId: job.request.moveId, phase: job.request.phase ?? 'attack',
        mode: job.reducedMotion ? 'reduced' : 'normal', effectiveness: job.effectiveness }))
      publish({ status: 'loading', busy: true, cue: null, message: 'Preparing playback…', iteration: job.iteration })
      const ready = safe(() => job.sound?.ready)
      if (ready !== undefined) await wait(job, ready, 350)
      if (!active(job)) return
      publish({ status: 'playing', busy: true, message: 'Playing effect…' })
      let result, presenting = true
      try {
        job.handle = fx.play(job.request, { scene: job.scene, reducedMotion: job.reducedMotion,
          onPresentation(cue) {
            if (presenting && active(job)) safe(() => job.sound?.onPresentation(cue))
          },
          onCue(cue) {
            if (!presenting || !active(job) || !['impact', 'prepared', 'recovery'].includes(cue?.type)) return
            if (cue.type === 'impact' && !impacted) {
              impacted = true
              safe(() => job.sound?.onImpact(cue))
            }
            publish({ cue: cue.type, message: cue.type === 'prepared' ? 'Preparation complete.'
              : cue.type === 'recovery' ? 'Recovery cue.' : 'Impact cue.' })
          },
        })
        if (!active(job)) { safe(() => job.handle?.cancel()); return }
        result = await wait(job, job.handle?.finished ?? Promise.resolve({ status: 'failed', reason: 'Playback could not start.' }))
      } catch (error) {
        result = { status: 'failed', reason: error?.message ?? String(error) }
      }
      presenting = false
      if (!active(job)) return
      job.handle = null
      safe(() => job.sound?.finish(result))
      job.settleFirst(result)
      if (result?.status !== 'completed') {
        safe(() => job.sound?.cancel())
        publish({ status: result?.status === 'failed' ? 'error' : 'idle', busy: false,
          message: result?.status === 'failed' ? `Playback failed: ${result.reason ?? 'Please try again.'}` : `Playback ${result?.status ?? 'stopped'}.` })
        return
      }
      if (!job.loop) {
        publish({ status: 'idle', busy: false, message: 'Playback complete. Ready to replay.' })
        return
      }
      publish({ status: 'waiting', busy: true, message: 'Playback complete. Waiting to repeat…' })
      await wait(job, undefined, job.loopDelayMs)
    }
  }

  function play(request = {}, { reducedMotion = false, loop = false, loopDelayMs = 1000 } = {}) {
    if (disposed) return Promise.resolve(cancelled())
    // Browser audio activation must happen in the original button/key gesture.
    const unlocking = safe(() => audio?.unlock())
    if (unlocking?.catch) unlocking.catch(() => {})
    stop()
    if (doc?.hidden) return Promise.resolve(cancelled())
    const scene = safe(getScene)
    if (!scene) {
      const result = { status: 'failed', reason: 'The scene is not ready.' }
      publish({ status: 'error', message: result.reason })
      return Promise.resolve(result)
    }
    const { effectiveness, ...visualRequest } = request
    const snapshot = Object.freeze({ ...visualRequest,
      ...(Array.isArray(request.targetIds) ? { targetIds: Object.freeze([...request.targetIds]) } : {}) })
    let settled = false, resolveFirst
    const first = new Promise(resolve => { resolveFirst = resolve })
    const job = { scene, request: snapshot, effectiveness, reducedMotion: Boolean(reducedMotion), loop: Boolean(loop),
      loopDelayMs: Number.isFinite(loopDelayMs) ? Math.max(500, Math.min(10000, loopDelayMs)) : 1000,
      iteration: 0, cancelled: false, handle: null, sound: null, cancelWait: null,
      settleFirst(result) { if (!settled) { settled = true; resolveFirst(result) } },
    }
    current = job
    void run(job)
    return first
  }

  const onVisibility = () => { if (doc?.hidden) stop('Playback stopped while the page is hidden.') }
  doc?.addEventListener?.('visibilitychange', onVisibility)
  return Object.freeze({ play, stop, getState: () => state,
    dispose() {
      if (disposed) return
      stop()
      disposed = true
      doc?.removeEventListener?.('visibilitychange', onVisibility)
      safe(() => fx.dispose())
    },
  })
}
