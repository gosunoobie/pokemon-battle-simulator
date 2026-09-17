import { createAudioPlayer } from '@battle/battle-audio'
import { getPokemonCry } from '@battle/pokemon-cries'
import { activeMembers, speciesId } from './scene.js'

const SETTINGS_KEY = 'battle-lab:audio:v1'
const safeStorage = () => { try { return globalThis.localStorage } catch { return null } }
const safe = callback => { try { return callback() } catch { return undefined } }

// Composition belongs to the host: the player knows sound IDs and URLs, never
// battle state. Only this adapter maps a viewer-safe species to a cry identity.
export function createBattleAudio({ playerFactory = createAudioPlayer, storage = safeStorage(), document: doc = globalThis.document } = {}) {
  const listeners = new Set(), heard = new Set()
  let disposed = false, generation = 0, warmIds = [], state
  const publish = value => { state = value; for (const listener of listeners) safe(() => listener(value)) }
  const player = playerFactory({ resolveAsset: getPokemonCry, onState: publish })
  const saved = safe(() => JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null'))
  if (typeof saved?.enabled === 'boolean') player.setEnabled(saved.enabled)
  if (Number.isFinite(saved?.volume) && saved.volume >= 0 && saved.volume <= 1) player.setVolume(saved.volume)
  state = player.getState()
  const persist = () => safe(() => storage?.setItem(SETTINGS_KEY, JSON.stringify({ enabled: state.enabled, volume: state.volume })))
  const cancel = () => { generation++; player.stop() }
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
  }
  function unlock() {
    if (disposed) return Promise.resolve(false)
    // Invoke synchronously in Start/Ready/Enable handlers, before a network await.
    return Promise.resolve(player.unlock()).then(ready => {
      if (ready && !disposed) void Promise.resolve(player.preload(warmIds)).catch(() => {})
      return ready
    }).catch(() => false)
  }
  return Object.freeze({
    unlock, preload,
    getState: () => state,
    subscribe(listener) { listeners.add(listener); safe(() => listener(state)); return () => listeners.delete(listener) },
    setEnabled(value) { if (disposed) return; if (!value) cancel(); player.setEnabled(Boolean(value)); persist(); if (value) void unlock() },
    setVolume(value) { if (!disposed) { player.setVolume(value); persist() } },
    begin(view, events = []) {
      cancel(); warm(view, events)
      const token = generation
      return Object.freeze({
        entry(entryView, actorId) {
          if (disposed || generation !== token || entryView?.matchId !== view?.matchId || doc?.hidden || !['source', 'target'].includes(actorId)) return false
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
        cancel() { if (generation === token) cancel() },
      })
    },
    sync(view) { cancel(); warm(view) },
    stop: cancel,
    dispose() {
      if (disposed) return
      disposed = true; generation++; doc?.removeEventListener('visibilitychange', visibility)
      listeners.clear(); heard.clear(); player.dispose()
    },
  })
}
