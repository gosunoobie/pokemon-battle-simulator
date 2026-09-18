const MiB = 1024 * 1024
const CATEGORIES = Object.freeze({ cries: 2, sfx: 4, ui: 2 })
const defaultContext = () => {
  const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (!AudioContext) throw new Error('Web Audio is unavailable')
  return new AudioContext()
}
const positiveInteger = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`)
  return value
}
const priorityValue = value => Number.isFinite(value) ? Math.max(-100, Math.min(100, value)) : 0
const disconnect = node => { try { node?.disconnect() } catch { /* Owned cleanup only. */ } }

/** Optional presentation audio. Loading can make a clip ready, but never plays it. */
export function createAudioPlayer({
  resolveAsset,
  createContext = defaultContext,
  fetch: fetchAsset = (...args) => globalThis.fetch(...args),
  crypto: cryptoImpl = globalThis.crypto,
  maxCacheBytes = 16 * MiB,
  maxVoices = 8,
  concurrency = 3,
  maxEncodedBytes = 8 * MiB,
  maxDecodedBytes = 8 * MiB,
  maxWorkingBytes = 48 * MiB,
  maxQueued = 32,
  loadTimeoutMs = 10_000,
  onState = () => {},
} = {}) {
  if (typeof resolveAsset !== 'function') throw new TypeError('resolveAsset must be a function')
  for (const [name, value] of Object.entries({ maxCacheBytes, maxVoices, concurrency, maxEncodedBytes, maxDecodedBytes, maxWorkingBytes, maxQueued, loadTimeoutMs })) positiveInteger(value, name)
  let context = null, master = null
  let disposed = false, enabled = true, volume = 0.6, suspended = false
  let status = 'locked', loadError = null, epoch = 0, cacheBytes = 0, sequence = 0
  const cache = new Map(), pending = new Map(), queue = [], physical = new Set(), voices = new Set(), fading = new Set()
  const buses = new Map()
  const categoryEnabled = new Map(Object.keys(CATEGORIES).map(category => [category, true]))
  const getState = () => Object.freeze({ enabled, volume, status, suspended, loadError })
  const notify = () => { try { onState(getState()) } catch { /* Observers cannot break audio. */ } }
  const setStatus = value => { if (status !== value) { status = value; notify() } }
  const setLoadError = value => { if (loadError !== value) { loadError = value; notify() } }
  const assetFor = id => {
    try {
      const asset = resolveAsset(id)
      if (!asset || typeof asset.url !== 'string' || !asset.url.length) return null
      if (asset.bytes !== undefined && (!Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > maxEncodedBytes)) return null
      if (asset.sha256 !== undefined && (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256))) return null
      return { ...asset, key: JSON.stringify([asset.url, asset.sha256 ?? null, asset.bytes ?? null]) }
    } catch { return null }
  }
  const touch = key => {
    const entry = cache.get(key)
    if (entry) { cache.delete(key); cache.set(key, entry) }
    return entry
  }
  const retainedEntries = () => new Set([...cache.values(), ...[...voices, ...fading].map(voice => voice.entry)])
  const retainedBytes = () => [...retainedEntries()].reduce((total, entry) => total + entry.bytes, 0)
  const reservedBytes = () => [...physical].reduce((total, job) => total + job.reservation, 0)
  const evictOldest = () => {
    const oldest = cache.keys().next().value
    if (oldest === undefined) return false
    cacheBytes -= cache.get(oldest).bytes
    cache.delete(oldest)
    return true
  }
  const makeRoom = bytes => {
    while (retainedBytes() + reservedBytes() + bytes > maxWorkingBytes && cache.size) evictOldest()
    return retainedBytes() + reservedBytes() + bytes <= maxWorkingBytes
  }
  const updateMix = () => {
    if (!context || disposed) return
    for (const category of ['sfx', 'ui']) {
      const bus = buses.get(category)
      if (!bus) continue
      const peakSum = [...voices, ...fading].filter(voice => voice.category === category)
        .reduce((sum, voice) => sum + voice.entry.peak * voice.mixGain, 0)
      const next = (category === 'sfx' ? 0.25 : 0.05) / Math.max(1, peakSum)
      const parameter = bus.gain, now = context.currentTime
      try {
        parameter.cancelScheduledValues?.(now)
        if (next > parameter.value && typeof parameter.setValueAtTime === 'function' && typeof parameter.linearRampToValueAtTime === 'function') {
          parameter.setValueAtTime(parameter.value, now)
          parameter.linearRampToValueAtTime(next, now + 0.015)
        } else {
          parameter.value = next
          parameter.setValueAtTime?.(next, now)
        }
      } catch { parameter.value = next }
    }
  }
  const clearVoice = voice => {
    if (voice.cleaned) return
    voice.cleaned = true
    voices.delete(voice); fading.delete(voice)
    clearTimeout(voice.cleanupTimer)
    voice.source.onended = null
    voice.signal?.removeEventListener('abort', voice.abort)
    disconnect(voice.source); disconnect(voice.gain)
    try { voice.source.buffer = null } catch { /* Some adapters make buffers read-only. */ }
    voice.entry = null; voice.source = null; voice.gain = null; voice.signal = null
    updateMix(); pump()
  }
  const stopVoice = (voice, reason = 'cancelled', fade = true) => {
    if (voice.done) return
    voice.done = true
    voices.delete(voice)
    voice.signal?.removeEventListener('abort', voice.abort)
    voice.resolve(Object.freeze({ reason }))
    if (reason === 'ended') { clearVoice(voice); return }
    const now = context?.currentTime ?? 0
    if (fade && context?.state === 'running' && voice.when <= now
      && typeof voice.gain.gain.setValueAtTime === 'function' && typeof voice.gain.gain.linearRampToValueAtTime === 'function') {
      // A short owned fade avoids a hard waveform discontinuity; never delays cancellation.
      try {
        voice.gain.gain.cancelScheduledValues?.(now)
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now)
        voice.gain.gain.linearRampToValueAtTime(0, now + 0.008)
        fading.add(voice)
        voice.source.onended = () => clearVoice(voice)
        voice.source.stop(now + 0.008)
        voice.cleanupTimer = setTimeout(() => clearVoice(voice), 24)
        return
      } catch { /* Fall back to immediate cancellation. */ }
    }
    try { voice.source.stop() } catch { /* The source may already have ended. */ }
    clearVoice(voice)
  }
  const settleSubscriber = (job, subscriber, ready) => {
    if (!job.subscribers.delete(subscriber)) return
    subscriber.signal?.removeEventListener('abort', subscriber.abort)
    subscriber.resolve(ready)
  }
  const settle = (job, ready) => {
    if (job.settled) return
    job.settled = true
    clearTimeout(job.timer)
    if (pending.get(job.asset.key) === job) pending.delete(job.asset.key)
    const index = queue.indexOf(job)
    if (index >= 0) queue.splice(index, 1)
    if (!ready) job.controller.abort()
    for (const subscriber of [...job.subscribers]) settleSubscriber(job, subscriber, ready)
  }
  const cancelSubscriber = (job, subscriber) => {
    settleSubscriber(job, subscriber, false)
    if (!job.subscribers.size) settle(job, false)
    else job.priority = Math.max(...[...job.subscribers].map(item => item.priority))
    pump()
  }
  const stopScope = scope => {
    // Undefined is the unscoped/default group, not a wildcard.
    for (const job of [...pending.values()]) {
      for (const subscriber of [...job.subscribers]) if (subscriber.scope === scope) cancelSubscriber(job, subscriber)
    }
    for (const voice of [...voices]) if (voice.scope === scope) stopVoice(voice)
  }
  const stop = () => {
    epoch += 1
    for (const job of [...pending.values()]) settle(job, false)
    queue.length = 0
    for (const voice of [...voices]) stopVoice(voice)
  }
  const stopCategory = category => {
    if (!Object.hasOwn(CATEGORIES, category)) return
    for (const voice of [...voices]) if (voice.category === category) stopVoice(voice)
  }
  const setCategoryEnabled = (category, value) => {
    if (disposed || !Object.hasOwn(CATEGORIES, category)) return
    categoryEnabled.set(category, Boolean(value))
    if (!value) stopCategory(category)
  }
  const contextChanged = () => {
    if (disposed) return
    setStatus(context?.state === 'running' ? 'ready' : context?.state === 'closed' ? 'unavailable' : 'locked')
    if (context?.state !== 'running') {
      for (const voice of [...voices]) stopVoice(voice, 'interrupted', false)
      for (const voice of [...fading]) clearVoice(voice)
    }
  }
  // Context creation/resume must occur synchronously within the user's gesture.
  const unlock = () => {
    if (disposed || !enabled || suspended) return Promise.resolve(false)
    try {
      if (!context) {
        const candidate = createContext()
        if (!candidate || !['resume', 'decodeAudioData', 'createBufferSource', 'createGain'].every(method => typeof candidate[method] === 'function')) {
          try { Promise.resolve(candidate?.close?.()).catch(() => {}) } catch { /* Invalid factory. */ }
          throw new Error('Invalid audio context')
        }
        let output
        const categories = new Map()
        try {
          output = candidate.createGain(); output.gain.value = volume; output.connect(candidate.destination)
          for (const category of Object.keys(CATEGORIES)) {
            const bus = candidate.createGain()
            bus.gain.value = category === 'cries' ? 0.35 : category === 'sfx' ? 0.25 : 0.05
            bus.connect(output); categories.set(category, bus)
          }
        } catch (error) {
          disconnect(output); for (const bus of categories.values()) disconnect(bus)
          try { Promise.resolve(candidate.close?.()).catch(() => {}) } catch { /* Invalid node factory. */ }
          throw error
        }
        context = candidate; master = output
        for (const [name, bus] of categories) buses.set(name, bus)
        context.addEventListener?.('statechange', contextChanged)
      }
    } catch { setStatus('unavailable'); return Promise.resolve(false) }
    let resumed
    try { resumed = context.state === 'running' ? undefined : context.resume() }
    catch { contextChanged(); return Promise.resolve(false) }
    contextChanged()
    return Promise.resolve(resumed).then(() => {
      if (disposed) return false
      contextChanged()
      return enabled && !suspended && status === 'ready'
    }, () => { if (!disposed) contextChanged(); return false })
  }
  const current = job => !disposed && !job.settled && enabled && !suspended && job.epoch === epoch && context === job.context
  const remember = (key, buffer) => {
    const bytes = buffer.length * buffer.numberOfChannels * 4
    if (!Number.isSafeInteger(buffer.length) || buffer.length < 1 || !Number.isSafeInteger(buffer.numberOfChannels) || buffer.numberOfChannels < 1
      || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > maxDecodedBytes || bytes > maxCacheBytes
      || !Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 120) return false
    while (cacheBytes + bytes > maxCacheBytes && cache.size) evictOldest()
    if (!makeRoom(bytes)) return false
    let peak = 1
    if (typeof buffer.getChannelData === 'function') {
      peak = 0
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const samples = buffer.getChannelData(channel)
        for (const sample of samples) {
          if (!Number.isFinite(sample)) return false
          peak = Math.max(peak, Math.abs(sample))
        }
      }
    }
    cache.set(key, { buffer, bytes, peak }); cacheBytes += bytes
    return true
  }
  const readEncoded = async (response, job) => {
    const limit = job.asset.bytes ?? maxEncodedBytes
    const header = response.headers?.get?.('content-length')
    if (header !== null && header !== undefined && (!/^\d+$/.test(header) || Number(header) > limit)) throw new Error('Encoded size exceeds limit')
    let encoded
    const reader = response.body?.getReader?.()
    if (reader) {
      // A single bounded assembly buffer avoids unbounded arrays of tiny stream chunks.
      const assembly = new Uint8Array(limit)
      let length = 0
      try {
        while (current(job)) {
          const { value, done } = await reader.read()
          if (done) break
          if (!(value instanceof Uint8Array) || length + value.byteLength > limit) throw new Error('Encoded size exceeds limit')
          assembly.set(value, length); length += value.byteLength
        }
        if (!current(job)) throw new Error('Cancelled')
        encoded = length === limit ? assembly.buffer : assembly.slice(0, length).buffer
      } catch (error) { try { await reader.cancel() } catch { /* Cancellation is best effort. */ } throw error }
      finally { try { reader.releaseLock() } catch { /* Reader may already be released. */ } }
    } else encoded = await response.arrayBuffer()
    if (!(encoded instanceof ArrayBuffer) || encoded.byteLength < 1 || encoded.byteLength > limit
      || (job.asset.bytes !== undefined && encoded.byteLength !== job.asset.bytes)) throw new Error('Encoded size mismatch')
    if (job.asset.sha256) {
      if (typeof cryptoImpl?.subtle?.digest !== 'function') throw new Error('Integrity verification unavailable')
      const digest = await cryptoImpl.subtle.digest('SHA-256', encoded)
      const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
      if (hash !== job.asset.sha256) throw new Error('Audio integrity mismatch')
    }
    return encoded
  }
  const load = async job => {
    try {
      if (!current(job)) return
      const response = await fetchAsset(job.asset.url, { signal: job.controller.signal })
      if (!current(job)) return
      if (!response?.ok) throw new Error('Audio request failed')
      const encoded = await readEncoded(response, job)
      if (!current(job)) return
      job.phase = 'decode'
      const buffer = await job.context.decodeAudioData(encoded)
      if (!current(job)) return
      // Replace the reservation with the retained decoded buffer, atomically in this turn.
      job.reservation = 0
      const ready = remember(job.asset.key, buffer)
      if (ready) setLoadError(null)
      settle(job, ready)
    } catch { if (current(job)) setLoadError(job.phase) }
    finally { settle(job, false) }
  }
  function pump() {
    if (disposed) return
    queue.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence)
    while (physical.size < concurrency && queue.length) {
      const job = queue[0]
      if (!current(job)) { settle(job, false); continue }
      if (!makeRoom(job.requiredBytes)) break
      queue.shift(); job.reservation = job.requiredBytes; physical.add(job)
      void load(job).finally(() => { physical.delete(job); job.reservation = 0; pump() })
    }
  }
  const preloadOne = (id, { signal, scope, priority = 0 }) => {
    if (disposed || !enabled || suspended || !context || context.state === 'closed' || signal?.aborted) return Promise.resolve(false)
    const asset = assetFor(id)
    if (!asset) return Promise.resolve(false)
    if (touch(asset.key)) return Promise.resolve(true)
    let job = pending.get(asset.key)
    if (job?.subscribers.size >= 64) return Promise.resolve(false)
    if (!job) {
      if (queue.length >= maxQueued) return Promise.resolve(false)
      const requiredBytes = 2 * (asset.bytes ?? maxEncodedBytes) + maxDecodedBytes
      if (requiredBytes > maxWorkingBytes) return Promise.resolve(false)
      job = { asset, context, epoch, subscribers: new Set(), settled: false, phase: 'load', controller: new AbortController(),
        priority: priorityValue(priority), sequence: sequence++, reservation: 0, requiredBytes, timer: null }
      job.timer = setTimeout(() => {
        if (current(job)) setLoadError(job.phase)
        settle(job, false); pump()
      }, loadTimeoutMs)
      pending.set(asset.key, job); queue.push(job)
    }
    const result = new Promise(resolve => {
      const subscriber = { resolve, signal, scope, priority: priorityValue(priority), abort: null }
      subscriber.abort = () => cancelSubscriber(job, subscriber)
      job.subscribers.add(subscriber)
      job.priority = Math.max(job.priority, subscriber.priority)
      signal?.addEventListener('abort', subscriber.abort, { once: true })
    })
    pump()
    return result
  }
  const preload = (ids, options = {}) => Promise.all((Array.isArray(ids) ? ids : []).map(id => preloadOne(id, options ?? {})))
  const readyInfo = id => {
    const asset = assetFor(id), entry = asset && touch(asset.key)
    if (!entry || disposed) return null
    const { buffer } = entry
    return Object.freeze({ sampleRate: buffer.sampleRate ?? context?.sampleRate ?? buffer.length / buffer.duration,
      sampleFrames: buffer.length, durationSeconds: buffer.duration })
  }
  const playSegment = (id, { startSeconds = 0, endSeconds, gainDb = 0, when, category = 'sfx', priority = 0, scope, signal } = {}) => {
    if (disposed || !enabled || suspended || context?.state !== 'running' || signal?.aborted || !categoryEnabled.get(category)) return null
    const asset = assetFor(id), entry = asset && touch(asset.key)
    if (!entry) return null
    const now = context.currentTime
    const end = endSeconds ?? entry.buffer.duration, startAt = when ?? now
    if (![startSeconds, end, gainDb, startAt].every(Number.isFinite) || startSeconds < 0 || end <= startSeconds
      || end > entry.buffer.duration || gainDb < -60 || gainDb > 6 || startAt < now || startAt > now + 120) return null
    const rank = priorityValue(priority)
    const categoryVoices = [...voices].filter(voice => voice.category === category)
    const fadingCategory = [...fading].filter(voice => voice.category === category).length
    if (categoryVoices.length + fadingCategory >= Math.min(CATEGORIES[category], maxVoices) || voices.size + fading.size >= maxVoices) {
      const candidate = categoryVoices.filter(voice => voice.priority <= rank).sort((a, b) => a.priority - b.priority || a.sequence - b.sequence)[0]
      if (!candidate) return null
      // Replacement is immediate so repeated scheduling cannot exceed the physical voice cap.
      stopVoice(candidate, 'replaced', false)
    }
    let source, voice
    try {
      source = context.createBufferSource()
      const gain = context.createGain()
      let resolve
      const finished = new Promise(done => { resolve = done })
      const requestedGain = 10 ** (gainDb / 20)
      // Cries retain their established gain except for clipping native samples.
      // SFX/UI retain authored relative gains; their shared buses bound the summed peaks.
      const mixGain = category === 'cries' ? Math.min(requestedGain, 1 / Math.max(Number.EPSILON, entry.peak)) : requestedGain
      voice = { source, gain, entry, category, priority: rank, scope, signal, sequence: sequence++, when: startAt, resolve, mixGain, done: false, cleaned: false, cleanupTimer: null }
      voice.abort = () => stopVoice(voice)
      voices.add(voice)
      source.buffer = entry.buffer; source.loop = false
      if (source.playbackRate) source.playbackRate.value = 1
      gain.gain.value = mixGain
      updateMix()
      source.connect(gain); gain.connect(buses.get(category))
      source.onended = () => stopVoice(voice, 'ended', false)
      signal?.addEventListener('abort', voice.abort, { once: true })
      if (startSeconds === 0 && end === entry.buffer.duration) source.start(startAt)
      else source.start(startAt, startSeconds, end - startSeconds)
      return Object.freeze({ finished, cancel: () => stopVoice(voice) })
    } catch {
      if (voice) stopVoice(voice, 'failed', false)
      else disconnect(source)
      return null
    }
  }
  const play = id => Boolean(playSegment(id, { category: 'cries' }))
  const setEnabled = value => {
    const next = Boolean(value)
    if (disposed || next === enabled) return
    enabled = next; if (!enabled) stop(); notify()
  }
  const setVolume = value => {
    if (disposed || !Number.isFinite(value)) return
    const next = Math.min(1, Math.max(0, value))
    if (next === volume) return
    volume = next
    if (master) {
      const parameter = master.gain, now = context.currentTime
      if (typeof parameter.setValueAtTime === 'function' && typeof parameter.linearRampToValueAtTime === 'function') {
        try {
          parameter.cancelScheduledValues?.(now)
          parameter.setValueAtTime(parameter.value, now)
          parameter.linearRampToValueAtTime(volume, now + 0.015)
        } catch { parameter.value = volume }
      } else parameter.value = volume
    }
    notify()
  }
  const setSuspended = value => {
    const next = Boolean(value)
    if (disposed || next === suspended) return
    suspended = next; if (suspended) stop(); notify()
  }
  const contextTime = () => context?.state === 'running' && !disposed ? context.currentTime : null
  const diagnostics = () => Object.freeze({ cacheBytes, retainedBytes: retainedBytes(), reservedBytes: reservedBytes(),
    workingBytes: retainedBytes() + reservedBytes(), maxWorkingBytes, cachedAssets: cache.size, physicalJobs: physical.size,
    queuedJobs: queue.length, subscribers: [...pending.values()].reduce((count, job) => count + job.subscribers.size, 0),
    voices: voices.size, fadingVoices: fading.size, categoryVoices: Object.freeze(Object.fromEntries(Object.keys(CATEGORIES).map(category => [category, [...voices].filter(voice => voice.category === category).length]))),
    sampleRate: context?.sampleRate ?? null, baseLatency: context?.baseLatency ?? null, outputLatency: context?.outputLatency ?? null })
  const dispose = () => {
    if (disposed) return
    disposed = true; stop()
    for (const voice of [...fading]) clearVoice(voice)
    cache.clear(); cacheBytes = 0
    context?.removeEventListener?.('statechange', contextChanged)
    for (const bus of buses.values()) disconnect(bus)
    buses.clear(); disconnect(master)
    try { Promise.resolve(context?.close()).catch(() => {}) } catch { /* Already closed. */ }
    status = 'unavailable'; notify()
  }
  return Object.freeze({ unlock, preload, play, playSegment, stop, stopScope, stopCategory, setCategoryEnabled, readyInfo, contextTime, diagnostics,
    setEnabled, setVolume, setSuspended, getState, dispose })
}
