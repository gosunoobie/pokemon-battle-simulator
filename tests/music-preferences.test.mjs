import test from 'node:test'
import assert from 'node:assert/strict'
import { AUDIO_PREFERENCES_KEY, DEFAULT_AUDIO_PREFERENCES, createAudioPreferences } from '../apps/shared/music/preferences.js'

function harness(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]))
  const writes = [], listeners = new Set()
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes.push({ key, value }); values.set(key, value) },
  }
  const window = {
    addEventListener(name, listener) { assert.equal(name, 'storage'); listeners.add(listener) },
    removeEventListener(name, listener) { assert.equal(name, 'storage'); listeners.delete(listener) },
  }
  const preferences = createAudioPreferences({ storage, window })
  const dispatch = event => { for (const listener of listeners) listener({ storageArea: storage, ...event }) }
  return { preferences, storage, writes, listeners, dispatch }
}

test('fresh preferences are immutable and only settings changes are persisted', () => {
  const { preferences, writes } = harness()
  assert.deepEqual(preferences.getState(), DEFAULT_AUDIO_PREFERENCES)
  assert.ok(Object.isFrozen(preferences.getState()))
  assert.equal(writes.length, 0)
  preferences.set({ musicEnabled: false, musicVolume: .4, battleMusicMode: 'random' })
  assert.deepEqual(preferences.getState(), { ...DEFAULT_AUDIO_PREFERENCES, musicEnabled: false, musicVolume: .4, battleMusicMode: 'random' })
  assert.equal(writes.length, 1)
  assert.equal(writes[0].key, AUDIO_PREFERENCES_KEY)
  preferences.set({ musicEnabled: false })
  assert.equal(writes.length, 1)
  preferences.dispose()
})

test('version two migration preserves master mute, zero volume and individual sound choices', () => {
  const { preferences, writes } = harness({
    'battle-lab:audio:v2': { schemaVersion: 2, enabled: false, volume: 0, criesEnabled: false, sfxEnabled: false },
    'battle-lab:audio:v1': { enabled: true, volume: 1 },
  })
  assert.deepEqual(preferences.getState(), { ...DEFAULT_AUDIO_PREFERENCES, enabled: false, volume: 0, criesEnabled: false, sfxEnabled: false })
  assert.deepEqual(writes.map(write => write.key), [AUDIO_PREFERENCES_KEY])
  assert.equal(JSON.parse(writes[0].value).enabled, false)
  preferences.dispose()
})

test('legacy version one is read when version two is absent or invalid', () => {
  for (const invalid of ['{bad json', { schemaVersion: 99, enabled: true }]) {
    const { preferences, writes } = harness({
      'battle-lab:audio:v2': invalid,
      'battle-lab:audio:v1': { enabled: false, volume: .3, criesEnabled: false, sfxEnabled: true, musicEnabled: false },
    })
    assert.equal(preferences.getState().enabled, false)
    assert.equal(preferences.getState().volume, .3)
    assert.equal(preferences.getState().criesEnabled, false)
    assert.equal(preferences.getState().musicEnabled, true)
    assert.deepEqual(writes.map(write => write.key), [AUDIO_PREFERENCES_KEY])
    preferences.dispose()
  }
})

test('current preferences take precedence over stale older settings', () => {
  const { preferences, writes } = harness({
    [AUDIO_PREFERENCES_KEY]: { schemaVersion: 3, enabled: false, musicEnabled: false, battleMusicMode: 'random', volume: .15 },
    'battle-lab:audio:v2': { schemaVersion: 2, enabled: true, volume: .9 },
  })
  assert.equal(preferences.getState().enabled, false)
  assert.equal(preferences.getState().musicEnabled, false)
  assert.equal(preferences.getState().battleMusicMode, 'random')
  assert.equal(preferences.getState().volume, .15)
  assert.equal(writes.length, 0)
  preferences.dispose()
})

test('stored corrupt fields are replaced by defaults and never coerced', () => {
  const { preferences } = harness({ [AUDIO_PREFERENCES_KEY]: {
    schemaVersion: 3, enabled: 'false', volume: -2, criesEnabled: null, sfxEnabled: 0,
    musicEnabled: false, musicVolume: '0.8', battleMusicMode: 'shuffle', extra: 'discarded',
  } })
  assert.deepEqual(preferences.getState(), { ...DEFAULT_AUDIO_PREFERENCES, musicEnabled: false })
  preferences.dispose()
  for (const value of ['broken', [], null, { schemaVersion: 5 }]) {
    const { preferences: invalid } = harness({ [AUDIO_PREFERENCES_KEY]: value })
    assert.deepEqual(invalid.getState(), DEFAULT_AUDIO_PREFERENCES)
    invalid.dispose()
  }
})

test('set clamps finite numeric levels and ignores invalid fields without muting user choices', () => {
  const { preferences, writes } = harness()
  preferences.set({ enabled: false, volume: 2, musicVolume: -1, schemaVersion: 8, unexpected: true })
  assert.deepEqual(preferences.getState(), { ...DEFAULT_AUDIO_PREFERENCES, enabled: false, volume: 1, musicVolume: 0 })
  preferences.set({ enabled: 'yes', criesEnabled: 1, sfxEnabled: null, volume: NaN, musicVolume: Infinity, battleMusicMode: false })
  preferences.set(null)
  preferences.set([])
  assert.equal(writes.length, 1)
  assert.equal(preferences.getState().enabled, false)
  assert.equal(preferences.getState().volume, 1)
  preferences.dispose()
})

test('denied reads, writes and missing browser facilities leave in-memory controls usable', () => {
  const preferences = createAudioPreferences({
    storage: { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } },
    window: { addEventListener() { throw new Error('denied') }, removeEventListener() { throw new Error('denied') } },
  })
  assert.doesNotThrow(() => preferences.set({ enabled: false, musicVolume: .75 }))
  assert.equal(preferences.getState().enabled, false)
  assert.equal(preferences.getState().musicVolume, .75)
  assert.doesNotThrow(() => preferences.dispose())
  const unavailable = createAudioPreferences({ storage: null, window: null })
  unavailable.set({ enabled: false })
  assert.equal(unavailable.getState().enabled, false)
  unavailable.dispose()
})

test('cross-tab changes update subscribers without writing back or accepting other storage areas', () => {
  const { preferences, dispatch, writes } = harness()
  const states = []
  preferences.subscribe(state => states.push(state))
  dispatch({ key: AUDIO_PREFERENCES_KEY, newValue: JSON.stringify({ schemaVersion: 3, enabled: false, volume: .2, musicEnabled: false, battleMusicMode: 'random' }) })
  assert.equal(preferences.getState().enabled, false)
  assert.equal(preferences.getState().volume, .2)
  assert.equal(preferences.getState().battleMusicMode, 'random')
  assert.equal(states.length, 2)
  assert.equal(writes.length, 0)
  const accepted = preferences.getState()
  for (const event of [
    { key: AUDIO_PREFERENCES_KEY, newValue: 'broken' },
    { key: AUDIO_PREFERENCES_KEY, newValue: JSON.stringify({ schemaVersion: 2, enabled: true }) },
    { key: 'battle-lab:audio:v2', newValue: JSON.stringify({ schemaVersion: 2, enabled: true }) },
    { key: AUDIO_PREFERENCES_KEY, storageArea: {}, newValue: JSON.stringify({ schemaVersion: 3, enabled: true }) },
  ]) dispatch(event)
  assert.equal(preferences.getState(), accepted)
  assert.equal(states.length, 2)
  dispatch({ key: AUDIO_PREFERENCES_KEY, newValue: null })
  assert.deepEqual(preferences.getState(), DEFAULT_AUDIO_PREFERENCES)
  assert.equal(writes.length, 0)
  preferences.dispose()
})

test('storage clear resets current choices and listener failures never interrupt controls', () => {
  const { preferences, dispatch, writes, listeners } = harness()
  const states = []
  preferences.subscribe(() => { throw new Error('observer failed') })
  const stop = preferences.subscribe(state => states.push(state))
  preferences.set({ enabled: false })
  assert.equal(states.length, 2)
  dispatch({ key: null, newValue: null })
  assert.equal(preferences.getState().enabled, true)
  assert.equal(states.length, 3)
  assert.equal(writes.length, 1)
  stop()
  preferences.set({ musicEnabled: false })
  assert.equal(states.length, 3)
  preferences.dispose()
  assert.equal(listeners.size, 0)
  const final = preferences.getState(), writesBefore = writes.length
  preferences.set({ enabled: false })
  preferences.subscribe(() => { throw new Error('disposed observer') })
  assert.equal(preferences.getState(), final)
  assert.equal(writes.length, writesBefore)
  preferences.dispose()
})
