import { createAudioPlayer, createAudioSession, createMusicPlayer } from '@battle/battle-audio'
import { createAudioPreferences } from './preferences.js'
import { createMusicDirector } from './director.js'

const safe = callback => { try { return callback() } catch { return undefined } }

/** One document owns the device. Battle batches only borrow its transient player. */
export function createExperienceAudio({ createBattle, storage, document: doc = globalThis.document,
  window: win = globalThis.window, baseUrl = import.meta.env?.BASE_URL ?? '/',
  sessionFactory = createAudioSession, musicFactory = createMusicPlayer,
  preferencesFactory = createAudioPreferences, playerFactory = createAudioPlayer } = {}) {
  const preferences = preferencesFactory({ storage, window: win })
  const session = sessionFactory(preferences.getState())
  const listeners = new Set(), subscriptions = []
  let music = null, battle = null, state, disposed = false, pageHidden = false
  const publish = () => {
    if (disposed) return
    const musicState = music?.getState() ?? { status: 'locked' }
    state = Object.freeze({ ...battle?.getState(), ...preferences.getState(),
      status: session.getState().status, musicStatus: musicState.status, musicError: musicState.error ?? null,
      trackId: musicState.trackId, trackTitle: musicState.trackTitle,
      sfxAvailable: battle?.getState().sfxAvailable ?? false })
    for (const listener of listeners) safe(() => listener(state))
  }
  music = musicFactory({ session, onState: publish })
  if (createBattle) battle = createBattle({ storage: null, document: doc,
    playerFactory: options => playerFactory({ ...options, session }) })
  const director = createMusicDirector({ player: music, getMode: () => preferences.getState().battleMusicMode, baseUrl })
  function apply(value) {
    session.setEnabled(value.enabled)
    session.setVolume(value.volume)
    music.setEnabled(value.enabled && value.musicEnabled)
    music.setVolume(value.musicVolume)
    const previous = battle?.getState()
    if (previous) {
      if (previous.enabled !== value.enabled) battle.setEnabled(value.enabled)
      if (previous.volume !== value.volume) battle.setVolume(value.volume)
      if (previous.criesEnabled !== value.criesEnabled) battle.setCriesEnabled(value.criesEnabled)
      if (previous.sfxEnabled !== value.sfxEnabled) battle.setSfxEnabled(value.sfxEnabled)
    }
    publish()
  }
  const visibility = () => { if (!disposed) music.setSuspended(pageHidden || Boolean(doc?.hidden)) }
  function unlock() {
    if (disposed || pageHidden || doc?.hidden || !preferences.getState().enabled) return Promise.resolve(false)
    // All calls begin synchronously inside the gesture, before any network await.
    const attempts = [safe(() => session.unlock()), safe(() => music.unlock()), safe(() => battle?.unlock())]
    return Promise.allSettled(attempts).then(results => !disposed && results.some(result => result.status === 'fulfilled' && result.value === true))
  }
  const gesture = event => {
    if (event.isTrusted === false || event.type === 'keydown' && (event.repeat || !['Enter', ' '].includes(event.key))) return
    if (state.status === 'locked' || state.musicEnabled && state.musicStatus === 'locked') void unlock()
  }
  const hide = event => {
    // BFCache retains this document and its owners. Resume them on pageshow.
    if (event.persisted) { pageHidden = true; music.setSuspended(true); battle?.stop() }
    else dispose()
  }
  const show = () => { pageHidden = false; visibility() }
  subscriptions.push(session.subscribe(publish), preferences.subscribe(apply))
  if (battle) subscriptions.push(battle.subscribe(publish))
  director.setContext({ kind: 'menu' })
  visibility(); publish()
  doc?.addEventListener('visibilitychange', visibility)
  doc?.addEventListener('click', gesture)
  doc?.addEventListener('keydown', gesture)
  win?.addEventListener('pagehide', hide)
  win?.addEventListener('pageshow', show)
  function change(patch, activate = false) {
    if (disposed) return
    preferences.set(patch)
    if (activate) void unlock()
  }
  function dispose() {
    if (disposed) return
    disposed = true
    doc?.removeEventListener('visibilitychange', visibility)
    doc?.removeEventListener('click', gesture)
    doc?.removeEventListener('keydown', gesture)
    win?.removeEventListener('pagehide', hide)
    win?.removeEventListener('pageshow', show)
    for (const unsubscribe of subscriptions) unsubscribe()
    listeners.clear(); battle?.dispose(); music.dispose(); preferences.dispose(); session.dispose()
  }
  return Object.freeze({ ...battle, unlock, dispose,
    getState: () => state,
    subscribe(listener) { listeners.add(listener); safe(() => listener(state)); return () => listeners.delete(listener) },
    setEnabled: value => change({ enabled: value }, value === true),
    setVolume: value => change({ volume: value }),
    setCriesEnabled: value => change({ criesEnabled: value }),
    setSfxEnabled: value => change({ sfxEnabled: value }, value === true),
    setMusicEnabled: value => change({ musicEnabled: value }, value === true),
    setMusicVolume: value => change({ musicVolume: value }),
    setBattleMusicMode: value => change({ battleMusicMode: value }),
    setMusicContext(context) { if (!disposed) director.setContext(context) },
  })
}
