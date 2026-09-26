import test from 'node:test'
import assert from 'node:assert/strict'
import { createExperienceAudio } from '../apps/shared/music/audio.js'
import { AUDIO_PREFERENCES_KEY } from '../apps/shared/music/preferences.js'

function surface() {
  const listeners = new Map()
  return { hidden: false, listeners,
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener) },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener) },
    emit(type, event = {}) { for (const fn of [...(listeners.get(type) ?? [])]) fn({ type, ...event }) },
    size() { return [...listeners.values()].reduce((sum, items) => sum + items.size, 0) },
  }
}
function harness(saved = {}) {
  const doc = surface(), win = surface(), writes = [], events = [], tracks = []
  const storage = { getItem: key => saved[key] ?? null, setItem(key, value) { writes.push([key, JSON.parse(value)]); saved[key] = value } }
  let sessionState, musicState, raw, pushMusic
  const controller = createExperienceAudio({ document: doc, window: win, storage,
    sessionFactory(initial) {
      sessionState = { ...initial, status: 'locked' }
      const listeners = new Set()
      const push = () => { for (const fn of listeners) fn(sessionState) }
      return {
        getState: () => sessionState,
        subscribe(fn) { listeners.add(fn); fn(sessionState); return () => listeners.delete(fn) },
        setEnabled(value) { sessionState = { ...sessionState, enabled: value }; push() },
        setVolume(value) { sessionState = { ...sessionState, volume: value }; push() },
        unlock() { events.push('session-unlock'); sessionState = { ...sessionState, status: 'ready' }; push(); return Promise.resolve(true) },
        dispose() { events.push('session-dispose') },
      }
    },
    musicFactory({ onState }) {
      musicState = { status: 'locked', enabled: true, volume: .25, suspended: false }
      pushMusic = patch => { musicState = { ...musicState, ...patch }; onState(musicState) }
      return {
        getState: () => musicState,
        setTrack(track, options) { tracks.push([track, options]); pushMusic({ trackId: track?.id, trackTitle: track?.title }) },
        setEnabled: value => pushMusic({ enabled: value }), setVolume: value => pushMusic({ volume: value }),
        setSuspended: value => { events.push(value ? 'music-pause' : 'music-resume'); pushMusic({ suspended: value }) },
        unlock() { events.push('music-unlock'); pushMusic({ status: 'playing' }); return Promise.resolve(true) },
        dispose() { events.push('music-dispose') },
      }
    },
    createBattle(options) {
      assert.equal(options.storage, null, 'only the experience preferences write storage')
      let state = { enabled: true, volume: .6, criesEnabled: true, sfxEnabled: true, sfxAvailable: true, status: 'locked' }
      const listeners = new Set()
      const update = patch => { state = { ...state, ...patch }; for (const fn of listeners) fn(state) }
      raw = { getState: () => state,
        subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn) },
        setEnabled: value => update({ enabled: value }), setVolume: value => update({ volume: value }),
        setCriesEnabled: value => update({ criesEnabled: value }), setSfxEnabled: value => update({ sfxEnabled: value }),
        begin: () => ({ cancel() { events.push('batch-cancel') } }),
        sync() { events.push('batch-sync') }, stop() { events.push('batch-stop') },
        unlock() { events.push('battle-unlock'); return Promise.resolve(true) },
        dispose() { events.push('battle-dispose') },
      }
      return raw
    },
  })
  return { controller, doc, win, events, tracks, writes, raw, pushMusic, session: () => sessionState, music: () => musicState }
}

test('experience construction stays locked, migrates mute, and separates music from transient batch cancellation', async t => {
  const h = harness({ 'battle-lab:audio:v2': JSON.stringify({ schemaVersion: 2, enabled: false, volume: .3, criesEnabled: false, sfxEnabled: true }) })
  t.after(() => h.controller.dispose())
  assert.equal(h.controller.getState().enabled, false)
  assert.equal(h.raw.getState().enabled, false)
  assert.equal(h.music().enabled, false)
  assert.equal(h.session().volume, .3)
  assert.equal(h.events.some(value => value.endsWith('unlock')), false)
  assert.equal(h.tracks.at(-1)[0].id, 'opening-theme')
  assert.equal(await h.controller.unlock(), false)
  h.controller.setEnabled(true)
  assert.deepEqual(h.events.filter(value => value.endsWith('unlock')), ['session-unlock', 'music-unlock', 'battle-unlock'])
  h.controller.setMusicContext({ kind: 'private', matchId: 'experience-one' })
  const trackCount = h.tracks.length
  h.controller.begin().cancel(); h.controller.sync(); h.controller.stop()
  assert.equal(h.tracks.length, trackCount)
  assert.equal(h.music().status, 'playing')
  assert.ok(h.writes.every(([key]) => key === AUDIO_PREFERENCES_KEY))
})

test('independent controls preserve master and sound settings, and publish playback title/errors', t => {
  const h = harness(); t.after(() => h.controller.dispose())
  h.controller.setMusicEnabled(false); h.controller.setMusicVolume(.4)
  assert.equal(h.music().enabled, false)
  assert.equal(h.raw.getState().enabled, true)
  assert.equal(h.session().volume, .6)
  h.controller.setVolume(.8)
  assert.equal(h.session().volume, .8)
  assert.equal(h.raw.getState().volume, .8)
  assert.equal(h.music().volume, .4)
  h.controller.setCriesEnabled(false)
  assert.equal(h.raw.getState().criesEnabled, false)
  assert.equal(h.controller.getState().trackTitle, 'Opening theme')
  h.pushMusic({ status: 'error', error: 'media' })
  assert.equal(h.controller.getState().musicError, 'media')
})

test('hidden tabs and persisted back navigation pause retained ownership; final exit disposes once', async () => {
  const h = harness()
  await h.controller.unlock()
  h.doc.hidden = true; h.doc.emit('visibilitychange')
  assert.equal(h.music().suspended, true)
  assert.equal(await h.controller.unlock(), false)
  h.win.emit('pagehide', { persisted: true })
  h.doc.hidden = false; h.doc.emit('visibilitychange')
  assert.equal(h.music().suspended, true, 'pagehide suspension outlives a visibility event')
  assert.equal(h.events.some(value => value.endsWith('dispose')), false)
  h.win.emit('pageshow', { persisted: true })
  assert.equal(h.music().suspended, false)
  h.win.emit('pagehide', { persisted: false }); h.controller.dispose()
  assert.deepEqual(h.events.filter(value => value.endsWith('dispose')), ['battle-dispose', 'music-dispose', 'session-dispose'])
  assert.equal(h.doc.size(), 0); assert.equal(h.win.size(), 0)
  assert.equal(await h.controller.unlock(), false)
})

test('only eligible real gestures unlock, and established playback is not restarted by later clicks', t => {
  const h = harness(); t.after(() => h.controller.dispose())
  h.doc.emit('click', { isTrusted: false })
  h.doc.emit('keydown', { isTrusted: true, key: 'ArrowLeft' })
  assert.equal(h.events.some(value => value.endsWith('unlock')), false)
  h.doc.emit('keydown', { isTrusted: true, key: 'Enter' })
  assert.equal(h.events.filter(value => value === 'music-unlock').length, 1)
  h.doc.emit('click', { isTrusted: true })
  assert.equal(h.events.filter(value => value === 'music-unlock').length, 1)
})

test('cross-tab mute updates active channels without writing back or creating a second owner', t => {
  const h = harness(); t.after(() => h.controller.dispose())
  const count = h.writes.length
  h.win.emit('storage', { key: AUDIO_PREFERENCES_KEY, newValue: JSON.stringify({ schemaVersion: 3, enabled: false, musicVolume: .9 }) })
  assert.equal(h.controller.getState().enabled, false)
  assert.equal(h.music().enabled, false)
  assert.equal(h.raw.getState().enabled, false)
  assert.equal(h.writes.length, count)
})
