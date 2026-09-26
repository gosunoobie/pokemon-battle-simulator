import { BATTLE_MUSIC_IDS, MUSIC_CATALOG_VERSION, createMusicCatalog } from './catalog.js'

const hash = value => {
  let result = 2166136261
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619)
  return result >>> 0
}
const SELECTIONS_KEY = 'battle.music.selections.v1'
const browserStorage = () => { try { return globalThis.sessionStorage } catch { return null } }
const readSelections = storage => {
  try {
    const raw = storage?.getItem(SELECTIONS_KEY)
    if (!raw || raw.length > 32_768) return []
    const saved = JSON.parse(raw)
    if (saved.version !== MUSIC_CATALOG_VERSION || !Array.isArray(saved.choices)) return []
    return saved.choices.slice(-64).filter(entry => Array.isArray(entry) && entry.length === 2
      && typeof entry[0] === 'string' && entry[0].length > 0 && entry[0].length <= 256 && BATTLE_MUSIC_IDS.includes(entry[1]))
  } catch { return [] }
}

/** Host-only soundtrack policy. This never reads battle state or rule randomness. */
export function createMusicDirector({ player, getMode = () => 'themed', baseUrl, catalog = createMusicCatalog(baseUrl), storage = browserStorage() } = {}) {
  if (typeof player?.setTrack !== 'function') throw new TypeError('Music player is required')
  const matches = new Map(readSelections(storage))
  let selected = null
  const setContext = ({ kind = 'menu', matchId } = {}) => {
    if (!['menu', 'private', 'league', 'tournament'].includes(kind)) throw new TypeError('Unknown music context')
    // A lobby has no confirmed match identity and continues the opening theme.
    const battle = kind !== 'menu' && matchId !== undefined && matchId !== null && String(matchId).length > 0
    let trackId = 'opening-theme', key = 'menu'
    if (battle) {
      const id = String(matchId)
      trackId = matches.get(id)
      if (!trackId) {
        trackId = getMode() === 'random'
          ? BATTLE_MUSIC_IDS[hash(`${MUSIC_CATALOG_VERSION}:${id}`) % BATTLE_MUSIC_IDS.length]
          : kind === 'private' ? 'wild-battle' : kind === 'tournament' ? 'gym-leader' : 'elite-four'
        matches.set(id, trackId)
        if (matches.size > 64) matches.delete(matches.keys().next().value)
        // Remember the already-chosen song across refreshes, even if the user has
        // since changed the preference that will apply to their next battle.
        try { storage?.setItem(SELECTIONS_KEY, JSON.stringify({ version: MUSIC_CATALOG_VERSION, choices: [...matches].filter(([key]) => key.length <= 256) })) } catch { /* Restricted storage never blocks a match. */ }
      }
      key = `match:${id}`
    }
    const track = catalog[trackId]
    if (!track) throw new TypeError(`Missing music track: ${trackId}`)
    selected = Object.freeze({ kind: battle ? kind : 'menu', matchId: battle ? String(matchId) : null, trackId, key })
    player.setTrack(track, { key })
    return selected
  }
  return Object.freeze({ setContext, getState: () => selected })
}
