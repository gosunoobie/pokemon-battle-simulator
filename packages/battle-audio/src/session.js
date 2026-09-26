const defaultContext = () => {
  const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (!AudioContext) throw new Error('Web Audio is unavailable')
  return new AudioContext()
}
const disconnect = node => { try { node?.disconnect() } catch { /* Owned cleanup only. */ } }
const close = context => { try { Promise.resolve(context?.close?.()).catch(() => {}) } catch { /* Already closed. */ } }

/** Page-owned output shared by independent music and transient playback lifecycles. */
export function createAudioSession({ createContext = defaultContext, enabled: initialEnabled = true, volume: initialVolume = .6, onState } = {}) {
  if (typeof createContext !== 'function') throw new TypeError('createContext must be a function')
  let context = null, output = null, disposed = false, resumePromise = null
  let enabled = Boolean(initialEnabled), volume = Number.isFinite(initialVolume) ? Math.min(1, Math.max(0, initialVolume)) : .6
  let status = 'locked'
  const listeners = new Set(typeof onState === 'function' ? [onState] : [])
  const getState = () => Object.freeze({ enabled, volume, status })
  const notify = () => {
    const state = getState()
    for (const listener of [...listeners]) { try { listener(state) } catch { /* Observers cannot break audio. */ } }
  }
  const contextChanged = () => {
    if (disposed) return
    const next = context?.state === 'running' ? 'ready' : context?.state === 'closed' ? 'unavailable' : 'locked'
    if (next !== status) { status = next; notify() }
  }
  const updateOutput = () => {
    if (!output) return
    const next = enabled ? volume : 0, parameter = output.gain, now = context.currentTime
    try {
      parameter.cancelScheduledValues?.(now)
      if (typeof parameter.setValueAtTime === 'function' && typeof parameter.linearRampToValueAtTime === 'function') {
        parameter.setValueAtTime(parameter.value, now)
        parameter.linearRampToValueAtTime(next, now + .015)
      } else parameter.value = next
    } catch { parameter.value = next }
  }
  // Call only from an explicit unlock gesture; construction and settings are silent.
  const ensure = () => {
    if (disposed) throw new Error('Audio session is disposed')
    if (context) {
      if (context.state === 'closed') { contextChanged(); throw new Error('Audio session is closed') }
      return Object.freeze({ context, output })
    }
    let candidate, candidateOutput
    try {
      candidate = createContext()
      if (!candidate || !['resume', 'createGain'].every(method => typeof candidate[method] === 'function')) throw new Error('Invalid audio context')
      candidateOutput = candidate.createGain()
      candidateOutput.gain.value = enabled ? volume : 0
      candidateOutput.connect(candidate.destination)
      candidate.addEventListener?.('statechange', contextChanged)
      context = candidate; output = candidateOutput
      contextChanged()
      return Object.freeze({ context, output })
    } catch (error) {
      disconnect(candidateOutput); close(candidate)
      if (status !== 'unavailable') { status = 'unavailable'; notify() }
      throw error
    }
  }
  // ensure() and resume() both run before any promise boundary to preserve activation.
  const unlock = () => {
    if (disposed || !enabled) return Promise.resolve(false)
    try { ensure() } catch { return Promise.resolve(false) }
    if (resumePromise) return resumePromise
    let resumed
    try { resumed = context.state === 'running' ? undefined : context.resume() }
    catch { contextChanged(); return Promise.resolve(false) }
    contextChanged()
    resumePromise = Promise.resolve(resumed).then(() => {
      if (disposed) return false
      contextChanged()
      return enabled && status === 'ready'
    }, () => { if (!disposed) contextChanged(); return false }).finally(() => { resumePromise = null })
    return resumePromise
  }
  const setEnabled = value => {
    const next = Boolean(value)
    if (disposed || next === enabled) return
    enabled = next; updateOutput(); notify()
  }
  const setVolume = value => {
    if (disposed || !Number.isFinite(value)) return
    const next = Math.min(1, Math.max(0, value))
    if (next === volume) return
    volume = next; updateOutput(); notify()
  }
  const subscribe = listener => {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function')
    if (!disposed) listeners.add(listener)
    try { listener(getState()) } catch { /* Observers cannot break audio. */ }
    return () => listeners.delete(listener)
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    context?.removeEventListener?.('statechange', contextChanged)
    disconnect(output); close(context)
    status = 'unavailable'; notify(); listeners.clear()
  }
  return Object.freeze({ ensure, unlock, setEnabled, setVolume, getState, subscribe, dispose })
}
