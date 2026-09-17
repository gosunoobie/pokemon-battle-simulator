const defaultContext = () => {
  const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (!AudioContext) throw new Error('Web Audio is unavailable')
  return new AudioContext()
}

const positiveInteger = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`)
  return value
}

/** Optional presentation audio. A load can make a clip ready, but can never play it. */
export function createAudioPlayer({
  resolveAsset,
  createContext = defaultContext,
  fetch: fetchAsset = (...args) => globalThis.fetch(...args),
  maxCacheBytes = 8 * 1024 * 1024,
  maxVoices = 2,
  concurrency = 3,
  loadTimeoutMs = 10_000,
  onState = () => {},
} = {}) {
  if (typeof resolveAsset !== 'function') throw new TypeError('resolveAsset must be a function')
  positiveInteger(maxCacheBytes, 'maxCacheBytes')
  positiveInteger(maxVoices, 'maxVoices')
  positiveInteger(concurrency, 'concurrency')
  positiveInteger(loadTimeoutMs, 'loadTimeoutMs')

  let context = null
  let disposed = false
  let enabled = true
  let volume = 0.6
  let suspended = false
  let status = 'locked'
  let loadError = null
  let epoch = 0
  let cacheBytes = 0
  let loading = 0
  const cache = new Map()
  const pending = new Map()
  const queue = []
  const voices = new Set()

  const getState = () => Object.freeze({ enabled, volume, status, suspended, loadError })
  const notify = () => {
    try { onState(getState()) } catch { /* Presentation observers cannot break playback. */ }
  }
  const setStatus = value => {
    if (status === value) return
    status = value
    notify()
  }
  const setLoadError = value => {
    if (loadError === value) return
    loadError = value
    notify()
  }
  const assetFor = id => {
    try {
      const asset = resolveAsset(id)
      return asset && typeof asset.url === 'string' && asset.url.length ? asset : null
    } catch { return null }
  }
  const touch = key => {
    const entry = cache.get(key)
    if (entry) {
      cache.delete(key)
      cache.set(key, entry)
    }
    return entry
  }
  const gainValue = () => Math.min(0.35, 0.8 / maxVoices) * volume
  const removeVoice = (voice, stopSource = false) => {
    if (!voices.delete(voice)) return
    voice.source.onended = null
    if (stopSource) {
      try { voice.source.stop() } catch { /* It may already have ended. */ }
    }
    try { voice.source.disconnect() } catch { /* Best-effort node cleanup. */ }
    try { voice.gain.disconnect() } catch { /* Best-effort node cleanup. */ }
  }
  const stopVoices = () => {
    for (const voice of [...voices]) removeVoice(voice, true)
  }
  const settle = (job, ready) => {
    if (job.settled) return
    job.settled = true
    clearTimeout(job.timer)
    if (pending.get(job.url) === job) pending.delete(job.url)
    if (!ready) job.controller.abort()
    job.resolve(ready)
  }
  const stop = () => {
    epoch += 1
    stopVoices()
    for (const job of pending.values()) settle(job, false)
    queue.length = 0
  }
  const contextChanged = () => {
    if (disposed) return
    setStatus(context?.state === 'running' ? 'ready' : context?.state === 'closed' ? 'unavailable' : 'locked')
    if (context?.state !== 'running') stopVoices()
  }

  // Creation and resume happen before the first promise boundary, inside the user's gesture.
  const unlock = () => {
    if (disposed || !enabled || suspended) return Promise.resolve(false)
    try {
      if (!context) {
        const candidate = createContext()
        if (!candidate || !['resume', 'decodeAudioData', 'createBufferSource', 'createGain']
          .every(method => typeof candidate[method] === 'function')) {
          try { Promise.resolve(candidate?.close?.()).catch(() => {}) } catch { /* Invalid factory result. */ }
          throw new Error('Invalid audio context')
        }
        context = candidate
        context.addEventListener?.('statechange', contextChanged)
      }
    } catch {
      setStatus('unavailable')
      return Promise.resolve(false)
    }
    let resumed
    try {
      resumed = context.state === 'running' ? undefined : context.resume()
    } catch {
      contextChanged()
      return Promise.resolve(false)
    }
    contextChanged()
    return Promise.resolve(resumed).then(() => {
      if (disposed) return false
      contextChanged()
      return enabled && !suspended && status === 'ready'
    }, () => {
      if (!disposed) contextChanged()
      return false
    })
  }

  const current = job => !disposed && !job.settled && enabled && !suspended
    && job.epoch === epoch && context === job.context
  const remember = (url, buffer) => {
    // AudioBuffer stores Float32 PCM; compressed file sizes are not the memory budget.
    const bytes = buffer.length * buffer.numberOfChannels * 4
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > maxCacheBytes
      || !Number.isFinite(buffer.duration) || buffer.duration <= 0) return false
    while (cacheBytes + bytes > maxCacheBytes) {
      const oldest = cache.keys().next().value
      cacheBytes -= cache.get(oldest).bytes
      cache.delete(oldest)
    }
    cache.set(url, { buffer, bytes })
    cacheBytes += bytes
    return true
  }
  const load = async job => {
    try {
      if (!current(job)) return
      const response = await fetchAsset(job.url, { signal: job.controller.signal })
      if (!current(job)) return
      if (!response?.ok) {
        setLoadError('load')
        return
      }
      const encoded = await response.arrayBuffer()
      if (!current(job)) return
      job.phase = 'decode'
      const buffer = await job.context.decodeAudioData(encoded)
      if (!current(job)) return
      const ready = remember(job.url, buffer)
      if (ready) setLoadError(null)
      settle(job, ready)
    } catch {
      // Report real failures without turning cancelled work into a warning.
      if (current(job)) setLoadError(job.phase)
    }
    finally { settle(job, false) }
  }
  const pump = () => {
    while (!disposed && loading < concurrency && queue.length) {
      const job = queue.shift()
      if (!current(job)) { settle(job, false); continue }
      loading += 1
      void load(job).finally(() => {
        loading -= 1
        pump()
      })
    }
  }
  const preloadOne = id => {
    if (disposed || !enabled || suspended || !context || context.state === 'closed') return Promise.resolve(false)
    const asset = assetFor(id)
    if (!asset) return Promise.resolve(false)
    if (touch(asset.url)) return Promise.resolve(true)
    if (pending.has(asset.url)) return pending.get(asset.url).promise
    let resolve
    const promise = new Promise(done => { resolve = done })
    const job = {
      url: asset.url, context, epoch, promise, resolve, settled: false, phase: 'load',
      controller: new AbortController(), timer: null,
    }
    // Include queue time in the deadline. Unabortable decodes retain their concurrency slot.
    job.timer = setTimeout(() => {
      if (current(job)) setLoadError(job.phase)
      settle(job, false)
      const index = queue.indexOf(job)
      if (index >= 0) queue.splice(index, 1)
    }, loadTimeoutMs)
    pending.set(asset.url, job)
    queue.push(job)
    pump()
    return promise
  }
  const preload = ids => Promise.all((Array.isArray(ids) ? ids : []).map(preloadOne))
  const play = id => {
    if (disposed || !enabled || suspended || context?.state !== 'running') return false
    const asset = assetFor(id)
    const entry = asset && touch(asset.url)
    if (!entry) return false
    while (voices.size >= maxVoices) removeVoice(voices.values().next().value, true)
    let voice, source
    try {
      source = context.createBufferSource()
      voice = { source, gain: context.createGain() }
      voices.add(voice)
      source.buffer = entry.buffer
      source.loop = false
      voice.gain.gain.value = gainValue()
      source.connect(voice.gain)
      voice.gain.connect(context.destination)
      source.onended = () => removeVoice(voice)
      // The decoded buffer defines the duration; manifest/granule durations can differ.
      source.start(context.currentTime)
      return true
    } catch {
      if (voice) removeVoice(voice, true)
      else {
        try { source?.disconnect() } catch { /* Gain creation may have failed. */ }
      }
      return false
    }
  }
  const setEnabled = value => {
    const next = Boolean(value)
    if (disposed || next === enabled) return
    enabled = next
    if (!enabled) stop()
    notify()
  }
  const setVolume = value => {
    if (disposed || !Number.isFinite(value)) return
    const next = Math.min(1, Math.max(0, value))
    if (next === volume) return
    volume = next
    for (const voice of voices) voice.gain.gain.value = gainValue()
    notify()
  }
  const setSuspended = value => {
    const next = Boolean(value)
    if (disposed || next === suspended) return
    suspended = next
    if (suspended) stop()
    notify()
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    stop()
    cache.clear()
    cacheBytes = 0
    context?.removeEventListener?.('statechange', contextChanged)
    try { Promise.resolve(context?.close()).catch(() => {}) } catch { /* Already closed. */ }
    status = 'unavailable'
    notify()
  }

  return Object.freeze({ unlock, preload, play, stop, setEnabled, setVolume, setSuspended, getState, dispose })
}
