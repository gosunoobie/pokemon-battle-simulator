// No rendering or battle-rule imports. Committed transactions are read-only inputs.
export function createPresenter({ loadFx, getScene, onDisplay, onBusy = () => {}, onError = () => {}, onMove = () => null, deadlineMs }) {
  let generation = 0, destroyed = false, active = null, queue = [], fxPromise, fxUnavailable = false
  const safe = (fn, ...args) => { if (!destroyed) { try { return fn(...args) } catch (error) { try { onError(error) } catch {} } } }

  function reconcile(job) {
    safe(onDisplay, { state: job.transaction.after, message: job.transaction.event.resultMessage, animate: false })
  }

  async function run(job) {
    const token = generation
    const controller = new AbortController()
    let playback, sound, timer, impact = false, recovery = false, playbackCancelled = false, soundCancelled = false, soundImpacted = false
    let end
    const stopped = new Promise(resolve => { end = resolve })
    const cancelSound = () => {
      if (soundCancelled) return
      soundCancelled = true; safe(() => sound?.cancel())
    }
    const cancelPlayback = () => {
      if (playbackCancelled) return
      playbackCancelled = true
      try { playback?.cancel?.() } catch (error) { safe(onError, error) }
    }
    const current = { job, stop: status => {
      try { cancelSound(); controller.abort(); cancelPlayback() } finally { end({ status }) }
    } }
    active = current
    safe(onBusy, true)
    safe(onDisplay, { state: job.transaction.before, message: job.transaction.event.usedMessage, animate: false })
    const valid = () => !destroyed && token === generation && active === current
    const impactSound = () => {
      const { event } = job.transaction
      if (soundImpacted || soundCancelled || !valid() || controller.signal.aborted || event.phase === 'prepare' ||
        (event.outcome && event.outcome !== 'hit')) return
      soundImpacted = true
      safe(() => sound?.onImpact?.())
    }
    const armDeadline = milliseconds => {
      clearTimeout(timer)
      timer = setTimeout(() => { fxUnavailable = true; current.stop('failed') }, milliseconds)
    }
    const work = async () => {
      if (!job.options.effectsEnabled || fxUnavailable || !getScene()) return { status: 'skipped' }
      if (!fxPromise) {
        const pending = Promise.resolve().then(loadFx).catch(error => {
          if (fxPromise === pending) fxPromise = undefined
          throw error
        })
        fxPromise = pending
      }
      const fx = await fxPromise
      if (controller.signal.aborted || !valid()) return { status: 'cancelled' }
      if (typeof fx?.play !== 'function') throw new Error('Effect unavailable')
      const { event } = job.transaction
      const request = { moveId: event.moveId, sourceId: event.sourceId, targetIds: event.targetIds,
        outcome: event.outcome, ...(event.phase ? { phase: event.phase } : {}), visualSeed: job.options.visualSeed ?? 1 }
      const fxDeadline = safe(() => fx.getPresentationDeadlineMs?.(request, { reducedMotion: job.options.reducedMotion }))
      if (deadlineMs === undefined && Number.isFinite(fxDeadline) && fxDeadline + 500 > 6500) armDeadline(fxDeadline + 500)
      if (!event.outcome || event.outcome === 'hit') {
        sound = safe(onMove, { moveId: event.moveId, phase: event.phase ?? 'attack', outcome: event.outcome ?? 'hit',
          mode: job.options.reducedMotion ? 'reduced' : 'normal' })
      }
      const soundReady = safe(() => sound?.ready)
      if (soundReady) {
        // Loading may delay the start briefly; the sound must still start on
        // the real visual clock, and unavailable audio cannot block playback.
        let audioTimer
        try {
          await Promise.race([Promise.resolve(soundReady).catch(() => {}), stopped,
            new Promise(resolve => { audioTimer = setTimeout(resolve, 500) })])
        } finally { clearTimeout(audioTimer) }
        if (controller.signal.aborted || !valid()) return { status: 'cancelled' }
        // Keep the normal rendering allowance intact after optional loading;
        // an explicit caller deadline still bounds the whole presentation.
        if (deadlineMs === undefined) armDeadline(Number.isFinite(fxDeadline) && fxDeadline > 0
          ? Math.max(6500, fxDeadline + 500) : 6500)
      }
      playback = fx.play(request, {
        scene: getScene(), signal: controller.signal, reducedMotion: job.options.reducedMotion,
        onPresentation(cue) { if (valid() && !controller.signal.aborted) safe(() => sound?.onPresentation(cue)) },
        onCue(cue) {
          if (!valid() || controller.signal.aborted) return
          if (event.phase === 'prepare') {
            if (cue.type === 'prepared' && !impact) { impact = true; safe(onDisplay, { state: job.transaction.after, message: event.resultMessage, animate: false }) }
          } else if (cue.type === 'impact' && !impact) {
            impact = true
            impactSound()
            const after = job.transaction.after
            // Presentation snapshot only: both HP changes are already committed in core.
            const state = event.healing > 0 ? { ...after, actors: { ...after.actors,
              [event.sourceId]: { ...after.actors[event.sourceId], hp: event.sourceBeforeHp },
            } } : after
            safe(onDisplay, { state, message: event.healing > 0 ? event.impactMessage : event.resultMessage, animate: true })
          } else if (cue.type === 'recovery' && impact && !recovery && event.healing > 0) {
            recovery = true
            safe(onDisplay, { state: job.transaction.after, message: event.resultMessage, animate: true })
          }
        },
      })
      return await playback.finished
    }
    armDeadline(deadlineMs ?? 6500)
    let result
    try {
      result = await Promise.race([work(), stopped])
      if (!['completed', 'skipped', 'cancelled', 'failed'].includes(result?.status)) result = { status: 'failed' }
    } catch (error) { result = { status: 'failed' }; safe(onError, error) }
    finally {
      if (result?.status === 'completed' && !soundCancelled) {
        // A successful clip without a cue still reveals its committed result here.
        if (!impact) impactSound()
        safe(() => sound?.finish(result))
      }
      else cancelSound()
      clearTimeout(timer)
      controller.abort()
      cancelPlayback()
      if (valid()) {
        reconcile(job)
        active = null
        safe(onBusy, false)
      }
    }
    job.resolve(result)
    if (!destroyed && token === generation) pump()
  }

  function pump() { if (!active && !destroyed && queue.length) void run(queue.shift()) }
  function reset(snapshot, message = 'Choose a move.') {
    generation++
    const previous = active
    active = null
    previous?.stop('cancelled')
    for (const job of queue.splice(0)) job.resolve({ status: 'cancelled' })
    safe(onBusy, false)
    if (snapshot) safe(onDisplay, { state: snapshot, message, animate: false })
  }
  return {
    enqueue(transaction, options = {}) {
      if (destroyed) return Promise.resolve({ status: 'cancelled' })
      return new Promise(resolve => { queue.push({ transaction, options: { effectsEnabled: true, ...options }, resolve }); pump() })
    },
    skip() { active?.stop('skipped') },
    reset,
    retryEffects() {
      active?.stop('skipped')
      const previous = fxPromise
      fxPromise = undefined; fxUnavailable = false
      previous?.then(fx => fx.dispose?.()).catch(() => {})
    },
    destroy() {
      reset(); destroyed = true
      fxPromise?.then(fx => fx.dispose?.()).catch(() => {})
    },
  }
}
