import { createAudioPlayer } from '@battle/battle-audio'
import { getPokemonCry } from '@battle/pokemon-cries'
import { getRuntimeSoundAsset, getFxSoundPlan, getMoveSoundPlan } from '@battle/battle-sfx/runtime'
import { getAcceptedRuntimeSoundAsset, getAcceptedFxSoundPlan, getAcceptedMoveSoundPlan } from '@battle/battle-sfx/accepted-runtime'
import { activeMembers, speciesId } from './scene.js'
import { createMoveAudio } from './moveAudio.js'

const SETTINGS_KEY = 'battle-lab:audio:v1'
const CURRENT_SETTINGS_KEY = 'battle-lab:audio:v2'
const safeStorage = () => { try { return globalThis.localStorage } catch { return null } }
const safe = callback => { try { return callback() } catch { return undefined } }

// Composition belongs to the host: the player knows sound IDs and URLs, never
// battle state. Only this adapter maps a viewer-safe species to a cry identity.
export function createBattleAudio({ playerFactory = createAudioPlayer, storage = safeStorage(), document: doc = globalThis.document,
  userAgent = globalThis.navigator?.userAgent ?? '', sfxEnabled = import.meta.env?.VITE_BATTLE_SFX_ENABLED !== 'false', technicalSoundPack = null } = {}) {
  if (technicalSoundPack && !['getFxSoundPlan', 'getMoveSoundPlan', 'getSoundAsset'].every(key => typeof technicalSoundPack[key] === 'function')) throw new TypeError('A technical sound pack requires explicit plan and asset lookups')
  const listeners = new Set(), heard = new Set()
  let disposed = false, generation = 0, warmIds = [], warmMoveIds = [], warmMoveFxIds = false, state, moveAudio
  let criesEnabled = true, moveSoundsEnabled = true
  const publish = value => {
    state = { ...value, criesEnabled, sfxEnabled: moveSoundsEnabled,
      sfxAvailable: Boolean(sfxEnabled && moveAudio?.supported()) }
    for (const listener of listeners) safe(() => listener(state))
  }
  const player = playerFactory({ resolveAsset: id => getAcceptedRuntimeSoundAsset(id) ?? getRuntimeSoundAsset(id) ?? technicalSoundPack?.getSoundAsset(id) ?? getPokemonCry(id), onState: publish })
  const currentSaved = safe(() => JSON.parse(storage?.getItem(CURRENT_SETTINGS_KEY) ?? 'null'))
  const saved = currentSaved?.schemaVersion === 2 ? currentSaved : safe(() => JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null'))
  if (typeof saved?.criesEnabled === 'boolean') criesEnabled = saved.criesEnabled
  if (typeof saved?.sfxEnabled === 'boolean') moveSoundsEnabled = saved.sfxEnabled
  if (typeof saved?.enabled === 'boolean') player.setEnabled(saved.enabled)
  if (Number.isFinite(saved?.volume) && saved.volume >= 0 && saved.volume <= 1) player.setVolume(saved.volume)
  moveAudio = createMoveAudio({ player, userAgent, allowTechnicalDrafts: Boolean(technicalSoundPack),
    getPlan: (id, options) => getAcceptedFxSoundPlan(id, options) ?? getFxSoundPlan(id, options) ?? technicalSoundPack?.getFxSoundPlan(id, options) ?? null,
    getCanonicalPlan: (id, options) => getAcceptedMoveSoundPlan(id, options) ?? getMoveSoundPlan(id, options) ?? technicalSoundPack?.getMoveSoundPlan(id, options) ?? null,
    enabled: () => !disposed && sfxEnabled && moveSoundsEnabled && state?.enabled && !doc?.hidden })
  player.setCategoryEnabled?.('cries', criesEnabled)
  player.setCategoryEnabled?.('sfx', moveSoundsEnabled && sfxEnabled)
  publish(player.getState())
  const persist = () => safe(() => storage?.setItem(CURRENT_SETTINGS_KEY, JSON.stringify({ schemaVersion: 2,
    enabled: state.enabled, volume: state.volume, criesEnabled, sfxEnabled: moveSoundsEnabled })))
  const cancel = () => { generation++; moveAudio.stop(); player.stop() }
  const visibility = () => { if (doc?.hidden) cancel(); player.setSuspended(Boolean(doc?.hidden)) }
  doc?.addEventListener('visibilitychange', visibility)
  visibility()
  function preload(species) {
    warmIds = [...new Set(species.map(speciesId).filter(Boolean))]
    if (!disposed) void Promise.resolve(player.preload(warmIds)).catch(() => {})
  }
  function warm(view, events = []) {
    preload([...activeMembers(view), ...(view?.own?.team ?? []), ...(view?.opponent?.known ?? [])].filter(Boolean).map(member => member.species)
      .concat(events.filter(event => ['switch', 'drag'].includes(event.args?.opcode)).map(event => event.args?.fields?.[1]?.split(',')[0])))
    // Own current choices and newly published move names only. Never speculate
    // about private opponent moves or decode the entire party's move library.
    warmMoveIds = [...new Set([...(view?.decision?.moves ?? []).map(move => move.id ?? move.name),
      ...events.filter(event => event.args?.opcode === 'move').map(event => event.args.fields?.[1])].filter(Boolean))]
    warmMoveFxIds = false
    moveAudio.warm(warmMoveIds)
  }
  function unlock() {
    if (disposed) return Promise.resolve(false)
    // Invoke synchronously in Start/Ready/Enable handlers, before a network await.
    return Promise.resolve(player.unlock()).then(ready => {
      if (ready && !disposed) {
        void Promise.resolve(player.preload(warmIds)).catch(() => {})
        moveAudio.warm(warmMoveIds, { fxIds: warmMoveFxIds })
      }
      return ready
    }).catch(() => false)
  }
  return Object.freeze({
    unlock, preload,
    getState: () => state,
    subscribe(listener) { listeners.add(listener); safe(() => listener(state)); return () => listeners.delete(listener) },
    setEnabled(value) { if (disposed) return; if (!value) cancel(); player.setEnabled(Boolean(value)); persist(); if (value) void unlock() },
    setVolume(value) { if (!disposed) { player.setVolume(value); persist() } },
    setCriesEnabled(value) {
      if (disposed) return
      criesEnabled = Boolean(value); player.setCategoryEnabled?.('cries', criesEnabled)
      publish(player.getState()); persist()
    },
    setSfxEnabled(value) {
      if (disposed) return
      moveSoundsEnabled = Boolean(value)
      if (!moveSoundsEnabled) moveAudio.stop()
      player.setCategoryEnabled?.('sfx', moveSoundsEnabled && sfxEnabled)
      publish(player.getState()); persist()
      if (moveSoundsEnabled) void unlock()
    },
    warmMoves(ids, { fxIds = false } = {}) {
      warmMoveIds = [...(ids ?? [])].slice(0, 16); warmMoveFxIds = fxIds === true
      return moveAudio.warm(warmMoveIds, { fxIds: warmMoveFxIds })
    },
    previewMove(request) { moveAudio.stop(); return moveAudio.begin(request) },
    diagnostics: () => ({ sfx: moveAudio.diagnostics(), player: player.diagnostics?.() }),
    begin(view, events = []) {
      cancel(); warm(view, events)
      const token = generation
      return Object.freeze({
        entry(entryView, actorId) {
          if (disposed || !criesEnabled || generation !== token || entryView?.matchId !== view?.matchId || doc?.hidden || !['source', 'target'].includes(actorId)) return false
          const member = activeMembers(entryView)[actorId === 'source' ? 0 : 1]
          const id = speciesId(member?.species)
          if (!id || member.fainted || member.hp?.current === 0) return false
          const key = JSON.stringify([entryView.matchId, entryView.cursor, actorId, member.memberId])
          if (heard.has(key)) return false
          // Remember even a cache miss: a late file or duplicate delivery must
          // never replay an entry that has already passed on screen.
          heard.add(key)
          if (heard.size > 256) heard.delete(heard.values().next().value)
          return player.play(id)
        },
        move(request) {
          if (disposed || generation !== token || doc?.hidden) return null
          return moveAudio.begin({ ...request, key: `${view.matchId}:${request.cursor}:move` })
        },
        cancel() { if (generation === token) cancel() },
      })
    },
    sync(view) { cancel(); warm(view) },
    stop: cancel,
    dispose() {
      if (disposed) return
      disposed = true; generation++; doc?.removeEventListener('visibilitychange', visibility)
      listeners.clear(); heard.clear(); moveAudio.dispose(); player.dispose()
    },
  })
}
