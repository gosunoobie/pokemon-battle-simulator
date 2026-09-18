// A development-only two-recording audition. Both bounded, checksum-verified
// decoders share one native clock; neither child owns or closes that clock.
import { createAuditionAudio, AUDITION_LIMITS } from './audio.js'
import { planSyncAudition, SYNC_LIMITS } from './sync.js'

export function planSyncLayers(plan, native, visual, accent, accentNative) {
  const regions = planSyncAudition(plan, native, visual).map(region => ({ ...region, layer: 'base' }))
  if (accent) regions.push(...planSyncAudition({ visualRate: plan.visualRate, segments: [accent.segment] }, accentNative, visual).map(region => ({ ...region, layer: 'accent' })))
  if (regions.length > SYNC_LIMITS.maxSegments) throw new Error('A layered comparison supports at most eight simultaneous regions')
  return regions
}
const nativeContext = () => {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (!Context) throw new Error('Web Audio is unavailable')
  return new Context()
}
const cancelled = () => Object.assign(new Error('Layered audition cancelled'), { name: 'AbortError' })

export function createSyncLayerAudio({ createContext = nativeContext, ...dependencies } = {}) {
  let context, bus, disposed = false, generation = 0, volume = .2, ready = null, running = false, mixPeak = 0
  let closed = false
  const closeOwner = () => {
    if (closed) return
    closed = true
    try { bus?.disconnect() } catch { /* Owned output already disconnected. */ }
    try { Promise.resolve(context?.close()).catch(() => {}) } catch { /* Native close can fail after teardown. */ }
  }
  const facade = () => {
    if (disposed) throw new Error('Layered audition disposed')
    if (!context) {
      context = createContext()
      try { bus = context.createGain(); bus.gain.value = 1; bus.connect(context.destination) }
      catch (cause) { closeOwner(); throw cause }
    }
    return {
      get state() { return context.state }, get currentTime() { return context.currentTime },
      get sampleRate() { return context.sampleRate }, get baseLatency() { return context.baseLatency },
      get outputLatency() { return context.outputLatency }, get destination() { return bus },
      resume: (...args) => context.resume(...args), decodeAudioData: (...args) => context.decodeAudioData(...args),
      createBufferSource: (...args) => context.createBufferSource(...args), createGain: (...args) => context.createGain(...args),
      addEventListener: (...args) => context.addEventListener?.(...args), removeEventListener: (...args) => context.removeEventListener?.(...args),
      getOutputTimestamp: () => context.getOutputTimestamp?.(), close: () => Promise.resolve(),
    }
  }
  const base = createAuditionAudio({ ...dependencies, createContext: facade })
  const accent = createAuditionAudio({ ...dependencies, createContext: facade })
  const adjustBus = () => {
    if (!bus) return
    // Sum all scheduled voice peaks, including future overlaps. Conservative
    // headroom is fixed for a run, so the accent cannot pump the base recording.
    const gain = volume && mixPeak ? Math.min(1, .95 / (volume * mixPeak)) : 1
    bus.gain.cancelScheduledValues?.(context.currentTime)
    if (bus.gain.setValueAtTime) bus.gain.setValueAtTime(gain, context.currentTime)
    else bus.gain.value = gain
  }
  const stop = () => { generation++; base.stop(); accent.stop(); running = false; mixPeak = 0; adjustBus() }
  const unlock = () => {
    // Invoke both synchronously while the click still owns audio activation.
    const first = base.unlock(), second = accent.unlock()
    return Promise.all([first, second]).then(values => values.every(Boolean) && !disposed)
  }
  const load = async (baseAsset, accentAsset) => {
    stop(); ready = null
    const token = generation
    try {
      const [baseNative, accentNative] = await Promise.all([base.load(baseAsset), accent.load(accentAsset)])
      if (disposed || token !== generation) throw cancelled()
      if (baseNative.decodedBytes + accentNative.decodedBytes > AUDITION_LIMITS.decodedBytes) throw new Error('Combined decoded sounds exceed audition memory limits')
      ready = { base: baseNative, accent: accentNative }
      return ready
    } catch (cause) { if (token === generation) stop(); throw cause }
  }
  const play = regions => {
    if (disposed || !ready || context?.state !== 'running') throw new Error('Load both native recordings before playing a layered comparison')
    if (running) throw new Error('A layered comparison is already playing')
    if (!Array.isArray(regions) || !regions.length || regions.length > AUDITION_LIMITS.voices) throw new Error('Layered audition voice limit reached')
    // Validate the complete group before starting any source.
    for (const region of regions) {
      const descriptor = ready[region.layer]
      if (!['base', 'accent'].includes(region.layer) || !descriptor || ![region.startSeconds, region.endSeconds, region.delaySeconds, region.gainDb].every(Number.isFinite)
        || region.startSeconds < 0 || region.endSeconds <= region.startSeconds || region.endSeconds > descriptor.durationSeconds
        || region.delaySeconds < 0 || region.delaySeconds + region.endSeconds - region.startSeconds > SYNC_LIMITS.maxDurationSeconds
        || region.gainDb < -60 || region.gainDb > 6) throw new Error('Invalid layered audition region')
    }
    const token = generation, time = context.currentTime, handles = []
    mixPeak = regions.reduce((sum, region) => sum + ready[region.layer].peak * 10 ** (region.gainDb / 20), 0)
    adjustBus(); running = true
    try {
      for (const { layer, delaySeconds, ...region } of regions) handles.push((layer === 'base' ? base : accent).play({ ...region, ...(delaySeconds > 0 ? { when: time + delaySeconds } : {}) }))
    } catch (cause) { stop(); throw cause }
    const finished = Promise.all(handles.map(handle => handle.finished)).then(results => {
      if (token === generation) { running = false; mixPeak = 0; adjustBus() }
      return results
    })
    return Object.freeze({ finished, contextTime: time, cancel: stop })
  }
  const setVolume = value => {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError('Master volume must be between 0 and 1')
    if (disposed) return
    volume = Math.min(.6, value)
    // Lower the bus first before a child volume increase can reach the output.
    adjustBus(); base.setVolume(volume); accent.setVolume(volume)
  }
  const dispose = () => {
    if (disposed) return
    disposed = true; stop(); ready = null; base.dispose(); accent.dispose(); closeOwner()
  }
  return Object.freeze({ unlock, load, play, stop, setVolume, dispose, contextTime: () => context?.currentTime ?? null })
}
