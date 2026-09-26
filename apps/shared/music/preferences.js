export const AUDIO_PREFERENCES_KEY = 'battle-lab:audio:v3'
export const DEFAULT_AUDIO_PREFERENCES = Object.freeze({
  schemaVersion: 3,
  enabled: true,
  volume: .6,
  criesEnabled: true,
  sfxEnabled: true,
  musicEnabled: true,
  musicVolume: .8,
  battleMusicMode: 'themed',
})

const legacyKeys = ['battle-lab:audio:v2', 'battle-lab:audio:v1']
const booleanFields = ['enabled', 'criesEnabled', 'sfxEnabled', 'musicEnabled']
const volumeFields = ['volume', 'musicVolume']
const safe = callback => { try { return callback() } catch { return undefined } }
const safeStorage = () => safe(() => globalThis.localStorage) ?? null
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const parse = value => safe(() => JSON.parse(value ?? 'null'))

function validated(value, { clamp = false, legacy = false } = {}) {
  if (!record(value)) return {}
  const result = {}
  for (const field of booleanFields) {
    if ((!legacy || field !== 'musicEnabled') && typeof value[field] === 'boolean') result[field] = value[field]
  }
  for (const field of volumeFields) {
    if (legacy && field === 'musicVolume') continue
    const volume = value[field]
    if (Number.isFinite(volume) && (clamp || volume >= 0 && volume <= 1)) result[field] = Math.max(0, Math.min(1, volume))
  }
  if (!legacy && ['themed', 'random'].includes(value.battleMusicMode)) result.battleMusicMode = value.battleMusicMode
  return result
}

function readSaved(storage) {
  const current = parse(safe(() => storage?.getItem(AUDIO_PREFERENCES_KEY)))
  if (record(current) && current.schemaVersion === 3) return { value: validated(current), migrate: false }
  for (const [index, key] of legacyKeys.entries()) {
    const previous = parse(safe(() => storage?.getItem(key)))
    const version = index === 0 ? 2 : 1
    if (record(previous) && (previous.schemaVersion === version || version === 1 && previous.schemaVersion === undefined)) {
      return { value: validated(previous, { legacy: true }), migrate: true }
    }
  }
  return { value: {}, migrate: false }
}

// This service owns persistence only. Playback and browser audio permissions
// belong to the page's audio controller, so reading settings is always silent.
export function createAudioPreferences({ storage = safeStorage(), window: host = globalThis.window } = {}) {
  const saved = readSaved(storage)
  let state = Object.freeze({ ...DEFAULT_AUDIO_PREFERENCES, ...saved.value }), disposed = false
  const listeners = new Set()
  const persist = () => safe(() => storage?.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(state)))
  const publish = next => {
    if (Object.keys(DEFAULT_AUDIO_PREFERENCES).every(field => state[field] === next[field])) return false
    state = Object.freeze(next)
    const snapshot = state
    for (const listener of listeners) safe(() => listener(snapshot))
    return true
  }
  const onStorage = event => {
    if (disposed || event.storageArea && event.storageArea !== storage) return
    if (event.key !== AUDIO_PREFERENCES_KEY && event.key !== null) return
    // A cleared preference store resets this tab, but never rewrites the other
    // tab's update or resurrects stale settings from a pre-migration key.
    if (event.newValue === null || event.key === null) {
      publish({ ...DEFAULT_AUDIO_PREFERENCES })
      return
    }
    const incoming = parse(event.newValue)
    if (record(incoming) && incoming.schemaVersion === 3) publish({ ...DEFAULT_AUDIO_PREFERENCES, ...validated(incoming) })
  }
  safe(() => host?.addEventListener('storage', onStorage))
  if (saved.migrate) persist()

  return Object.freeze({
    getState: () => state,
    subscribe(listener) {
      if (disposed || typeof listener !== 'function') return () => {}
      listeners.add(listener)
      safe(() => listener(state))
      return () => listeners.delete(listener)
    },
    set(patch) {
      if (disposed) return state
      if (publish({ ...state, ...validated(patch, { clamp: true }) })) persist()
      return state
    },
    dispose() {
      if (disposed) return
      disposed = true
      safe(() => host?.removeEventListener('storage', onStorage))
      listeners.clear()
    },
  })
}
