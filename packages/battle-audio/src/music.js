const disconnect = node => { try { node?.disconnect() } catch { /* Owned nodes only. */ } }
const defaultMedia = () => new globalThis.Audio()
const level = value => Math.max(0, Math.min(1, value))
const MUSIC_HEADROOM = .25

/** Long-form streamed music with a lifecycle independent of short battle sounds. */
export function createMusicPlayer({
  session,
  createMedia = defaultMedia,
  onState = () => {},
  fadeOutMs = 160,
  fadeInMs = 260,
  loadTimeoutMs = 12_000,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: unschedule = globalThis.clearTimeout,
} = {}) {
  if (!session || typeof session.ensure !== 'function' || typeof session.unlock !== 'function') throw new TypeError('Shared audio session is required')
  for (const [name, value] of Object.entries({ fadeOutMs, fadeInMs, loadTimeoutMs })) {
    if (!Number.isFinite(value) || value < 0 || (name === 'loadTimeoutMs' && value === 0)) throw new TypeError(`Invalid ${name}`)
  }
  let media = null, context = null, source = null, bus = null
  let desired = null, current = null, generation = 0, attempt = null, fadeTimer = null
  let enabled = true, volume = .8, suspended = false, disposed = false, hasGesture = false, unlocking = false
  let status = 'locked', error = null, failedIdentity = null, removeMediaListeners = () => {}
  const getState = () => Object.freeze({ enabled, volume, suspended, status, error,
    trackId: desired?.track.id ?? null, trackTitle: desired?.track.title ?? null })
  const notify = () => { try { onState(getState()) } catch { /* Observers cannot break playback. */ } }
  const update = (next, failure = null) => {
    if (status === next && error === failure) return
    status = next; error = failure; notify()
  }
  const allowed = () => !disposed && enabled && !suspended && session.getState?.().enabled !== false
  const pause = () => { try { media?.pause() } catch { /* Media adapters may already be detached. */ } }
  const gain = (value, milliseconds = 0) => {
    if (!bus || !context) return
    const parameter = bus.gain, now = context.currentTime
    try {
      if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now)
      else { parameter.cancelScheduledValues?.(now); parameter.setValueAtTime?.(parameter.value, now) }
      if (milliseconds > 0 && context.state === 'running' && typeof parameter.linearRampToValueAtTime === 'function') {
        parameter.linearRampToValueAtTime(value, now + milliseconds / 1000)
      } else { parameter.value = value; parameter.setValueAtTime?.(value, now) }
    } catch { parameter.value = value }
  }
  const targetGain = () => MUSIC_HEADROOM * volume * (current?.track.gain ?? 1)
  const cancelWork = () => {
    generation += 1
    if (fadeTimer !== null) unschedule(fadeTimer)
    fadeTimer = null
    if (attempt) { unschedule(attempt.timer); attempt.resolve(false) }
    attempt = null
    // Hold the current envelope while invalidating all of its future automation.
    if (bus) gain(bus.gain.value)
  }
  const fail = (next, reason, identity = desired?.identity) => {
    cancelWork(); pause(); gain(0)
    failedIdentity = identity
    update(next, reason)
  }
  const ensureMedia = () => {
    if (media) return media
    const candidate = createMedia()
    if (!candidate || typeof candidate.play !== 'function' || typeof candidate.pause !== 'function') throw new Error('Audio media is unavailable')
    candidate.loop = true; candidate.preload = 'metadata'; candidate.volume = 1
    media = candidate
    return media
  }
  const ensureGraph = () => {
    if (context) return
    const connection = session.ensure()
    let nextSource, nextBus
    try {
      nextSource = connection.context.createMediaElementSource(ensureMedia())
      nextBus = connection.context.createGain(); nextBus.gain.value = 0
      nextSource.connect(nextBus); nextBus.connect(connection.output)
    } catch (failure) { disconnect(nextSource); disconnect(nextBus); throw failure }
    context = connection.context; source = nextSource; bus = nextBus
    context.addEventListener?.('statechange', contextChanged)
  }
  const install = () => {
    if (current?.identity === desired?.identity) return
    pause(); gain(0); removeMediaListeners(); removeMediaListeners = () => {}
    current = desired
    if (!current) {
      if (media) { try { media.removeAttribute?.('src'); media.load?.() } catch { /* Release network work. */ } }
      update('paused'); return
    }
    const active = current
    const element = ensureMedia()
    const onError = () => {
      if (disposed || current !== active || desired?.identity !== active.identity || !element.error) return
      fail('error', 'media', active.identity)
    }
    const onTimeUpdate = () => {
      if (disposed || !allowed() || current !== active || desired?.identity !== active.identity
        || status !== 'playing' || fadeTimer !== null || context?.state !== 'running' || element.paused) return
      const end = active.track.loopEnd
      if (end === undefined || element.currentTime < end || (Number.isFinite(element.duration) && end > element.duration)) return
      // Only trim a supplied quiet tail; keep the already-authorized media playing.
      // timeupdate is browser-owned, so no ticker or second player is necessary.
      try { element.currentTime = 0 } catch { /* Seeking can fail during a media interruption. */ }
    }
    element.addEventListener?.('error', onError)
    element.addEventListener?.('timeupdate', onTimeUpdate)
    removeMediaListeners = () => {
      element.removeEventListener?.('error', onError)
      element.removeEventListener?.('timeupdate', onTimeUpdate)
    }
    element.src = active.track.url
    try { element.currentTime = 0 } catch { /* Metadata is not available yet. */ }
    element.load?.()
  }
  const stalePlayback = () => { if (!allowed() || !desired) pause() }
  const start = ({ gesture = false } = {}) => {
    if (!allowed() || !desired || (!gesture && (!hasGesture || failedIdentity === desired.identity))) return Promise.resolve(false)
    if (attempt) return attempt.promise
    try { ensureGraph(); install() } catch { fail('unavailable', 'unsupported'); return Promise.resolve(false) }
    if (!gesture && context.state !== 'running') { update('locked'); return Promise.resolve(false) }
    const token = generation, identity = desired.identity
    let finish
    const job = { token, identity, timer: null, resolve: null, promise: new Promise(resolve => { finish = resolve }) }
    job.resolve = finish
    attempt = job
    job.timer = schedule(() => { if (attempt === job) fail('error', 'timeout', identity) }, loadTimeoutMs)
    gain(0); update('loading')
    // Both calls happen before any await, so a click can authorize both browser gates.
    let resumed, played
    unlocking = gesture
    try { resumed = gesture ? session.unlock() : context.state === 'running' } catch { resumed = false }
    try { played = media.play() } catch (failure) { played = Promise.reject(failure) }
    unlocking = false
    void Promise.all([
      Promise.resolve(resumed).then(Boolean, () => false),
      Promise.resolve(played).then(() => ({ ok: true }), failure => ({ ok: false, failure })),
    ]).then(([ready, playback]) => {
      if (disposed || attempt !== job || generation !== token || desired?.identity !== identity) { stalePlayback(); return }
      unschedule(job.timer); attempt = null
      if (!allowed()) { pause(); gain(0); update('paused'); job.resolve(false); return }
      if (!ready || context.state !== 'running') { fail('locked', 'context', identity); job.resolve(false); return }
      if (!playback.ok) {
        fail(playback.failure?.name === 'NotAllowedError' ? 'locked' : 'error', 'playback', identity)
        job.resolve(false); return
      }
      failedIdentity = null
      gain(targetGain(), fadeInMs); update('playing')
      job.resolve(true)
    })
    return job.promise
  }
  const reconcile = () => {
    if (disposed) return
    try { install() } catch { fail('unavailable', 'unsupported'); return }
    if (!desired || !allowed()) { pause(); gain(0); update('paused'); return }
    if (failedIdentity === desired.identity) return
    if (!hasGesture || !context || context.state !== 'running') { update('locked'); return }
    if (status === 'playing' && !media.paused) { gain(targetGain(), 15); return }
    void start()
  }
  function contextChanged() {
    if (disposed || unlocking) return
    if (context?.state !== 'running') {
      cancelWork(); pause(); gain(0)
      update(context?.state === 'closed' ? 'unavailable' : 'locked')
    } else if (!attempt && fadeTimer === null) reconcile()
  }
  const setTrack = (track, { key = track?.id } = {}) => {
    if (disposed) return false
    if (track && (typeof track.id !== 'string' || !track.id || typeof track.url !== 'string' || !track.url
      || (track.gain !== undefined && (!Number.isFinite(track.gain) || track.gain < 0 || track.gain > 1))
      || (track.loopEnd !== undefined && (!Number.isFinite(track.loopEnd) || track.loopEnd <= 0)))) throw new TypeError('Invalid music track')
    const next = track ? { track: Object.freeze({ ...track, gain: track.gain ?? 1 }), identity: JSON.stringify([track.id, track.url, key]) } : null
    if (next?.identity === desired?.identity) return false
    const shouldFade = status === 'playing' && allowed() && context?.state === 'running' && fadeOutMs > 0
    cancelWork(); desired = next; failedIdentity = null; error = null
    notify()
    if (shouldFade) {
      const token = generation
      gain(0, fadeOutMs)
      fadeTimer = schedule(() => {
        fadeTimer = null
        if (!disposed && generation === token) reconcile()
      }, fadeOutMs)
    } else reconcile()
    return true
  }
  const unlock = () => {
    if (!allowed() || !desired) return Promise.resolve(false)
    hasGesture = true
    const retryMedia = failedIdentity === desired.identity && error !== 'playback' && error !== 'context'
    cancelWork(); failedIdentity = null
    if (retryMedia) { current = null; removeMediaListeners(); removeMediaListeners = () => {} }
    if (status === 'playing' && current?.identity === desired.identity && context?.state === 'running' && !media?.paused) {
      gain(targetGain(), 15)
      return Promise.resolve(true)
    }
    return start({ gesture: true })
  }
  const setEnabled = value => {
    const next = Boolean(value)
    if (disposed || next === enabled) return
    enabled = next; cancelWork(); reconcile(); notify()
  }
  const setSuspended = value => {
    const next = Boolean(value)
    if (disposed || next === suspended) return
    suspended = next; cancelWork(); reconcile(); notify()
  }
  const setVolume = value => {
    if (disposed || !Number.isFinite(value)) return
    const next = level(value)
    if (volume === next) return
    volume = next
    if (status === 'playing' && fadeTimer === null) gain(targetGain(), 15)
    notify()
  }
  let lastMasterEnabled = session.getState?.().enabled !== false
  const unsubscribe = session.subscribe?.(state => {
    const next = state.enabled !== false
    if (disposed || lastMasterEnabled === next) return
    lastMasterEnabled = next; cancelWork(); reconcile()
  })
  const dispose = () => {
    if (disposed) return
    disposed = true; cancelWork(); pause(); gain(0); removeMediaListeners(); unsubscribe?.()
    context?.removeEventListener?.('statechange', contextChanged)
    if (media) { try { media.removeAttribute?.('src'); media.load?.() } catch { /* Stop owned media loading. */ } }
    disconnect(source); disconnect(bus)
    desired = null; current = null; update('unavailable')
  }
  return Object.freeze({ setTrack, unlock, setEnabled, setVolume, setSuspended, getState, dispose })
}
