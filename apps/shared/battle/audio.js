import { createAudioPlayer } from '@battle/battle-audio'
import { getPokemonCry } from '@battle/pokemon-cries'
import { getRuntimeSoundAsset, getFxSoundPlan, getMoveSoundPlan } from '@battle/battle-sfx/runtime'
import { getAcceptedRuntimeSoundAsset, getAcceptedFxSoundPlan, getAcceptedMoveSoundPlan } from '@battle/battle-sfx/accepted-runtime'
import { activeMembers, speciesId } from './scene.js'
import { createMoveAudio } from './moveAudio.js'
import { createImpactAudio } from './impactAudio.js'
import { createEventAudio } from './eventAudio.js'
import { getEventRuntimeSoundAsset } from '@battle/battle-sfx/event-runtime'

const SETTINGS_KEY = 'battle-lab:audio:v1'
const CURRENT_SETTINGS_KEY = 'battle-lab:audio:v2'
const safeStorage = () => { try { return globalThis.localStorage } catch { return null } }
const safe = callback => { try { return callback() } catch { return undefined } }
export const BATTLE_AUDIO_MIX = Object.freeze({ cries: .75, sfx: 1.1 })
const transitionEvents = Object.freeze({ pokeball: 'battle.release.pokeball', faint: 'battle.faint' })

// Composition belongs to the host: the player knows sound IDs and URLs, never
// battle state. Only this adapter maps a viewer-safe species to a cry identity.
export function createBattleAudio({ playerFactory = createAudioPlayer, storage = safeStorage(), document: doc = globalThis.document,
  userAgent = globalThis.navigator?.userAgent ?? '', sfxEnabled = import.meta.env?.VITE_BATTLE_SFX_ENABLED !== 'false', technicalSoundPack = null, categoryVolumes, transitionSounds = true } = {}) {
  if (technicalSoundPack && !['getFxSoundPlan', 'getMoveSoundPlan', 'getSoundAsset'].every(key => typeof technicalSoundPack[key] === 'function')) throw new TypeError('A technical sound pack requires explicit plan and asset lookups')
  const listeners = new Set(), heard = new Set()
  let disposed = false, generation = 0, previewSerial = 0, warmIds = [], warmMoveIds = [], warmMoveFxIds = false, state, moveAudio, impactAudio, transitionAudio
  let criesEnabled = true, moveSoundsEnabled = true
  const publish = value => {
    state = { ...value, criesEnabled, sfxEnabled: moveSoundsEnabled,
      sfxAvailable: Boolean(sfxEnabled && (moveAudio?.supported() || impactAudio)) }
    for (const listener of listeners) safe(() => listener(state))
  }
  const player = playerFactory({ resolveAsset: id => getEventRuntimeSoundAsset(id) ?? getAcceptedRuntimeSoundAsset(id) ?? getRuntimeSoundAsset(id) ?? technicalSoundPack?.getSoundAsset(id) ?? getPokemonCry(id), onState: publish, categoryVolumes })
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
  impactAudio = createImpactAudio({ player,
    enabled: () => !disposed && sfxEnabled && moveSoundsEnabled && state?.enabled && !doc?.hidden })
  if (transitionSounds) transitionAudio = createEventAudio({ player, eventIds: transitionEvents,
    enabled: () => !disposed && sfxEnabled && moveSoundsEnabled && state?.enabled && !doc?.hidden })
  player.setCategoryEnabled?.('cries', criesEnabled)
  player.setCategoryEnabled?.('sfx', moveSoundsEnabled && sfxEnabled)
  publish(player.getState())
  const persist = () => safe(() => storage?.setItem(CURRENT_SETTINGS_KEY, JSON.stringify({ schemaVersion: 2,
    enabled: state.enabled, volume: state.volume, criesEnabled, sfxEnabled: moveSoundsEnabled })))
  const cancel = () => { generation++; moveAudio.stop(); impactAudio.stop(); transitionAudio?.stop(); player.stop() }
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
    transitionAudio?.warm()
    impactAudio.warm()
    moveAudio.warm(warmMoveIds)
  }
  function unlock() {
    if (disposed) return Promise.resolve(false)
    // Invoke synchronously in Start/Ready/Enable handlers, before a network await.
    return Promise.resolve(player.unlock()).then(ready => {
      if (ready && !disposed) {
        void Promise.resolve(player.preload(warmIds)).catch(() => {})
        transitionAudio?.warm()
        impactAudio.warm()
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
      if (!moveSoundsEnabled) { moveAudio.stop(); impactAudio.stop(); transitionAudio?.stop() }
      player.setCategoryEnabled?.('sfx', moveSoundsEnabled && sfxEnabled)
      publish(player.getState()); persist()
      if (moveSoundsEnabled) void unlock()
    },
    warmMoves(ids, { fxIds = false } = {}) {
      warmMoveIds = [...(ids ?? [])].slice(0, 16); warmMoveFxIds = fxIds === true
      transitionAudio?.warm()
      impactAudio.warm()
      return moveAudio.warm(warmMoveIds, { fxIds: warmMoveFxIds })
    },
    previewMove(request) {
      moveAudio.stop(); impactAudio.stop()
      const move = moveAudio.begin(request), serial = ++previewSerial, token = generation, key = `preview:${serial}:impact`
      let voice, cancelled = false, impacted = false, finished = false
      return Object.freeze({
        get ready() { return move.ready },
        onPresentation: move.onPresentation,
        onImpact() {
          if (cancelled || finished || impacted || serial !== previewSerial || token !== generation
            || (request.phase ?? 'attack') !== 'attack' || (request.outcome ?? 'hit') !== 'hit') return
          impacted = true
          voice = impactAudio.play({ key, kind: request.effectiveness })
        },
        finish(result) { finished = true; move.finish(result); if (result?.status !== 'completed') { cancelled = true; safe(() => voice?.cancel()) } },
        cancel() { cancelled = true; move.cancel(); safe(() => voice?.cancel()) },
      })
    },
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
        impact(feedback, options = {}) {
          if (disposed || generation !== token || doc?.hidden || options.signal?.aborted
            || typeof feedback?.key !== 'string' || !feedback.key.startsWith(`${view.matchId}:`)) return null
          // Normal presenter completion also aborts its rendering signal. Audio
          // tails belong to this batch scope; skip/reset/failure cancel it.
          return impactAudio.play(feedback)
        },
        transition(transitionView, cue) {
          if (!transitionAudio || disposed || generation !== token || doc?.hidden
            || transitionView?.matchId !== view?.matchId || !['source', 'target'].includes(cue?.actorId)
            || !Object.hasOwn(transitionEvents, cue?.type)) return null
          const side = cue.actorId === 'source' ? transitionView.own : transitionView.opponent
          const members = cue.actorId === 'source' ? side?.team : side?.known
          // A faint can clear active before its retained artwork disappears.
          // Use the exact member supplied by the validated transition cue.
          const memberId = cue.memberId ?? (cue.type === 'pokeball' ? side?.active : null)
          const member = members?.find(row => row.memberId === memberId)
          if (!member || (side.active && side.active !== memberId)) return null
          const fainted = member.fainted || member.hp?.current === 0
          if (cue.type === 'faint' ? !fainted : fainted || side.active !== memberId) return null
          return transitionAudio.play({ kind: cue.type,
            key: JSON.stringify([transitionView.matchId, transitionView.cursor, cue.actorId, memberId, cue.type]) })
        },
        cancel() { if (generation === token) cancel() },
      })
    },
    sync(view) { cancel(); warm(view) },
    stop: cancel,
    dispose() {
      if (disposed) return
      disposed = true; generation++; doc?.removeEventListener('visibilitychange', visibility)
      listeners.clear(); heard.clear(); moveAudio.dispose(); impactAudio.dispose(); transitionAudio?.dispose(); player.dispose()
    },
  })
}
