// Batch 5 review transport, isolated to preserve earlier approved players.
// Edited boundaries use a short gain taper to prevent cut clicks.
// Developer audition transport. No battle state, animation recipes or production
// audio package are involved; loading a selection can never start playback.
export const AUDITION_LIMITS = Object.freeze({ encodedBytes: 8 * 1024 * 1024, decodedBytes: 32 * 1024 * 1024, durationSeconds: 120, voices: 8, waveformBins: 512 })

const defaultContext = () => {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (!Context) throw new Error('Web Audio is unavailable')
  return new Context()
}
const abortError = () => Object.assign(new Error('Audio audition cancelled'), { name: 'AbortError' })
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`)
  return value
}
const close = context => { try { Promise.resolve(context?.close?.()).catch(() => {}) } catch { /* Already closed. */ } }
const disconnect = node => { try { node?.disconnect() } catch { /* Best-effort owned-node cleanup. */ } }
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

function measure(buffer) {
  const { sampleRate, numberOfChannels: channels, length: sampleFrames, duration } = buffer ?? {}
  const decodedBytes = sampleFrames * channels * 4
  if (!Number.isSafeInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000
    || ![1, 2].includes(channels) || !Number.isSafeInteger(sampleFrames) || sampleFrames <= 0
    || !Number.isSafeInteger(decodedBytes) || decodedBytes > AUDITION_LIMITS.decodedBytes
    || !Number.isFinite(duration) || duration <= 0 || duration > AUDITION_LIMITS.durationSeconds
    || Math.abs(duration - sampleFrames / sampleRate) > 1 / sampleRate) throw new Error('Decoded audio exceeds audition limits or has invalid metadata')
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel))
  if (data.some(channel => !(channel instanceof Float32Array) || channel.length !== sampleFrames)) throw new Error('Decoded audio channel mismatch')
  const bins = Math.min(AUDITION_LIMITS.waveformBins, sampleFrames)
  const min = Array(bins).fill(Infinity), max = Array(bins).fill(-Infinity)
  let peak = 0, first = -1, last = -1
  for (let frame = 0; frame < sampleFrames; frame++) {
    const bin = Math.floor(frame * bins / sampleFrames)
    for (const channel of data) {
      const value = channel[frame]
      if (!Number.isFinite(value)) throw new Error('Decoded audio contains a non-finite sample')
      const magnitude = Math.abs(value)
      peak = Math.max(peak, magnitude)
      min[bin] = Math.min(min[bin], value); max[bin] = Math.max(max[bin], value)
      if (magnitude > 0.001) { if (first < 0) first = frame; last = frame }
    }
  }
  return freeze({
    sampleRate, channels, sampleFrames, durationSeconds: sampleFrames / sampleRate, decodedBytes, peak,
    quietThresholdDbfs: -60, leadingQuietFrames: first < 0 ? sampleFrames : first,
    trailingQuietFrames: first < 0 ? sampleFrames : sampleFrames - 1 - last,
    waveform: { bins, min, max },
  })
}

export function createBatchFiveAudio({
  createContext = defaultContext,
  fetcher = (...args) => globalThis.fetch(...args),
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  loadTimeoutMs = 15_000,
} = {}) {
  if (![createContext, fetcher, now].every(value => typeof value === 'function')) throw new TypeError('Invalid audition dependency')
  if (!Number.isSafeInteger(loadTimeoutMs) || loadTimeoutMs < 1) throw new TypeError('Invalid audition load deadline')
  let context = null, master = null, disposed = false, stopping = false, generation = 0, volume = 0.2
  let selected = null, pending = null, active = null, queued = null, safetyAttenuation = 1
  const voices = new Set()

  const adjustMaster = () => {
    if (!master || !context) return
    const worstPeak = [...voices].reduce((total, voice) => total + voice.peak * voice.regionGain, 0)
    const output = Math.min(volume, worstPeak ? 0.95 / worstPeak : volume)
    safetyAttenuation = volume ? output / volume : 1
    const parameter = master.gain, time = context.currentTime
    parameter.cancelScheduledValues?.(time)
    // Attenuation takes effect immediately so newly scheduled overlapping clips
    // cannot overload the output. Only upward user changes receive a short ramp.
    if (output > parameter.value && parameter.setValueAtTime && parameter.linearRampToValueAtTime) {
      parameter.setValueAtTime(parameter.value, time)
      parameter.linearRampToValueAtTime(output, time + 0.012)
    } else if (parameter.setValueAtTime) parameter.setValueAtTime(output, time)
    else parameter.value = output
  }
  const finishVoice = (voice, reason) => {
    if (!voices.delete(voice)) return
    voice.source.onended = null
    voice.signal?.removeEventListener('abort', voice.abort)
    if (reason !== 'ended') { try { voice.source.stop() } catch { /* Already ended. */ } }
    disconnect(voice.source); disconnect(voice.gain)
    try { voice.source.buffer = null } catch { /* Some implementations retain the buffer until GC. */ }
    adjustMaster()
    const result = Object.freeze({ reason })
    voice.resolve(result)
    try { voice.onEnded?.(result) } catch { /* An observer cannot prevent cleanup. */ }
  }
  const settleJob = (job, error, descriptor) => {
    if (job.settled) return
    job.settled = true
    clearTimeout(job.timer)
    job.signal?.removeEventListener('abort', job.abort)
    if (pending === job) pending = null
    if (queued === job) queued = null
    if (error) { job.controller.abort(); job.reject(error) } else job.resolve(descriptor)
  }
  const current = job => !disposed && !job.settled && job.generation === generation && context === job.context
  const requireCurrent = job => { if (!current(job)) throw abortError() }
  const stop = () => {
    if (stopping) return
    stopping = true
    generation++
    try {
      for (const voice of [...voices]) finishVoice(voice, 'cancelled')
      if (pending) settleJob(pending, abortError())
      if (queued) settleJob(queued, abortError())
    } finally { stopping = false }
  }
  const stateChanged = () => {
    if (context?.state !== 'running') for (const voice of [...voices]) finishVoice(voice, 'interrupted')
  }
  // Both context construction and resume run before any promise boundary, so
  // this method can be invoked directly inside a browser user gesture.
  const unlock = () => {
    if (disposed) return Promise.resolve(false)
    try {
      if (!context) {
        const candidate = createContext()
        if (!candidate || !['resume', 'decodeAudioData', 'createBufferSource', 'createGain'].every(method => typeof candidate[method] === 'function')) {
          close(candidate); throw new Error('Invalid audio context')
        }
        let gain
        try { gain = candidate.createGain(); gain.gain.value = volume; gain.connect(candidate.destination) }
        catch (error) { disconnect(gain); close(candidate); throw error }
        context = candidate; master = gain
        context.addEventListener?.('statechange', stateChanged)
      }
      const resumed = context.state === 'running' ? undefined : context.resume()
      return Promise.resolve(resumed).then(() => !disposed && context.state === 'running', () => false)
    } catch { return Promise.resolve(false) }
  }

  const readBounded = async (response, job) => {
    if (!response?.ok) throw new Error(`Audio request failed (${response?.status ?? 'no response'})`)
    const declared = response.headers?.get?.('content-length')
    if (declared !== null && declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) !== job.asset.bytes)) throw new Error('Audio response size does not match its pinned catalog')
    const reader = response.body?.getReader?.()
    if (!reader) throw new Error('Audio response has no readable body')
    const bytes = new Uint8Array(job.asset.bytes)
    let length = 0, completed = false
    try {
      while (true) {
        const { value, done } = await reader.read()
        requireCurrent(job)
        if (done) { completed = true; break }
        if (!(value instanceof Uint8Array) || length + value.byteLength > bytes.byteLength) throw new Error('Audio response exceeds its pinned byte limit')
        bytes.set(value, length); length += value.byteLength
      }
    } finally {
      if (!completed) { try { await reader.cancel() } catch { /* Network abort. */ } }
      reader.releaseLock?.()
    }
    if (length !== bytes.byteLength) throw new Error('Audio response is truncated')
    return bytes
  }
  const runJob = async job => {
    try {
      requireCurrent(job)
      const response = await fetcher(job.asset.url, { signal: job.controller.signal, cache: 'default' })
      requireCurrent(job)
      const bytes = await readBounded(response, job)
      requireCurrent(job)
      if (!globalThis.crypto?.subtle) throw new Error('Secure-context SHA-256 verification is unavailable')
      const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))
      requireCurrent(job)
      const actual = [...hash].map(byte => byte.toString(16).padStart(2, '0')).join('')
      if (actual !== job.asset.sha256) throw new Error('Audio checksum does not match its pinned catalog')
      // A browser decoder cannot be aborted. Its physical concurrency slot stays
      // occupied until it settles, even after the public load promise is aborted.
      const buffer = await job.context.decodeAudioData(bytes.buffer)
      requireCurrent(job)
      const descriptor = measure(buffer)
      requireCurrent(job)
      selected = { assetId: job.asset.id ?? null, buffer, descriptor }
      settleJob(job, null, descriptor)
    } catch (error) { settleJob(job, error instanceof Error ? error : new Error('Audio decode failed')) }
  }
  const pump = () => {
    if (disposed || active || !queued) return
    const job = queued
    queued = null; active = job
    void runJob(job).finally(() => { if (active === job) active = null; pump() })
  }
  const load = (asset, { signal } = {}) => {
    if (stopping) return Promise.reject(new Error('Audio audition is stopping'))
    stop(); selected = null
    if (disposed || !context || context.state === 'closed') return Promise.reject(new Error('Unlock browser audio before loading a sound'))
    if (!asset || typeof asset.url !== 'string' || !asset.url.length
      || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > AUDITION_LIMITS.encodedBytes
      || !/^[a-f0-9]{64}$/.test(asset.sha256 ?? '')) return Promise.reject(new Error('Invalid pinned sound asset'))
    if (signal?.aborted) return Promise.reject(abortError())
    let resolve, reject
    const promise = new Promise((yes, no) => { resolve = yes; reject = no })
    const job = { asset: { ...asset }, context, generation, controller: new AbortController(), signal, resolve, reject, settled: false, timer: null, abort: null }
    job.abort = () => settleJob(job, abortError())
    signal?.addEventListener('abort', job.abort, { once: true })
    job.timer = setTimeout(() => settleJob(job, new Error('Audio load exceeded its deadline')), loadTimeoutMs)
    pending = job; queued = job; pump()
    return promise
  }
  const play = ({ startSeconds = 0, endSeconds = selected?.descriptor.durationSeconds, gainDb = 0, when, signal, onEnded, taperEdits = true } = {}) => {
    if (disposed || stopping || context?.state !== 'running' || !selected) throw new Error('No decoded sound is ready for audition')
    finite(startSeconds, 'Region start'); finite(endSeconds, 'Region end'); finite(gainDb, 'Region gain')
    if (when !== undefined) finite(when, 'Playback time')
    if (startSeconds < 0 || endSeconds <= startSeconds || endSeconds > selected.descriptor.durationSeconds) throw new RangeError('Audition region is outside the native decoded sound')
    if (gainDb < -60 || gainDb > 6) throw new RangeError('Audition region gain must be between -60 and +6 dB')
    if (when !== undefined && when < context.currentTime) throw new RangeError('Audition playback cannot be scheduled in the past')
    if (signal?.aborted) throw abortError()
    if (voices.size >= AUDITION_LIMITS.voices) throw new Error('Audition voice limit reached')
    let source, gain, voice, resolve
    try {
      source = context.createBufferSource(); gain = context.createGain()
      const finished = new Promise(done => { resolve = done })
      voice = { source, gain, resolve, signal, onEnded, abort: null, peak: selected.descriptor.peak, regionGain: 10 ** (gainDb / 20) }
      voice.abort = () => finishVoice(voice, 'cancelled')
      source.buffer = selected.buffer; source.loop = false; source.playbackRate.value = 1
      gain.gain.value = voice.regionGain
      const begins = when ?? context.currentTime, span = endSeconds - startSeconds
      const fade = Math.min(.012, span / 4)
      if (taperEdits && startSeconds > 0) {
        gain.gain.setValueAtTime(0, begins)
        gain.gain.linearRampToValueAtTime(voice.regionGain, begins + fade)
      }
      if (taperEdits && endSeconds < selected.descriptor.durationSeconds) {
        gain.gain.setValueAtTime(voice.regionGain, begins + span - fade)
        gain.gain.linearRampToValueAtTime(0, begins + span)
      }
      source.connect(gain); gain.connect(master)
      voices.add(voice); adjustMaster()
      source.onended = () => finishVoice(voice, 'ended')
      signal?.addEventListener('abort', voice.abort, { once: true })
      source.start(when ?? context.currentTime, startSeconds, endSeconds - startSeconds)
      return Object.freeze({ finished, cancel: voice.abort })
    } catch (error) {
      if (voice && voices.has(voice)) finishVoice(voice, 'failed')
      else { disconnect(source); disconnect(gain) }
      throw error
    }
  }
  const setVolume = value => {
    finite(value, 'Master volume')
    if (value < 0 || value > 1) throw new RangeError('Master volume must be between 0 and 1')
    if (disposed) return
    volume = Math.min(0.6, value); adjustMaster()
  }
  const contextTime = () => context?.currentTime ?? null
  const diagnostics = () => {
    let outputTimestamp = null
    try {
      const stamp = context?.getOutputTimestamp?.()
      if (Number.isFinite(stamp?.contextTime) && Number.isFinite(stamp?.performanceTime)) outputTimestamp = { contextTime: stamp.contextTime, performanceTime: stamp.performanceTime }
    } catch { /* Not all native implementations expose timestamps. */ }
    const latency = value => Number.isFinite(value) && value >= 0 ? value : null
    return freeze({ state: disposed ? 'disposed' : context?.state ?? 'locked', contextTime: contextTime(), observedAt: now(),
      sampleRate: context?.sampleRate ?? null, baseLatency: latency(context?.baseLatency), outputLatency: latency(context?.outputLatency), outputTimestamp,
      volume, safetyAttenuation, voices: voices.size, ready: Boolean(selected), assetId: selected?.assetId ?? null,
      decodedBytes: selected?.descriptor.decodedBytes ?? 0, inFlight: Boolean(active), queued: Boolean(queued),
      synchronization: 'Unmeasured browser scheduling diagnostics; not proof of audiovisual synchronization.' })
  }
  const dispose = () => {
    if (disposed) return
    disposed = true; stop(); selected = null
    context?.removeEventListener?.('statechange', stateChanged)
    disconnect(master); close(context)
  }
  return Object.freeze({ unlock, load, play, stop, dispose, setVolume, contextTime, diagnostics })
}
