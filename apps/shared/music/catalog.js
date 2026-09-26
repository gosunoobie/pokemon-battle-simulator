export const MUSIC_CATALOG_VERSION = 1
export const BATTLE_MUSIC_IDS = Object.freeze(['wild-battle', 'gym-leader', 'elite-four'])

/** Asset filenames are deliberately separate from stable soundtrack IDs. */
export function createMusicCatalog(baseUrl = import.meta.env?.BASE_URL ?? '/') {
  const base = `${baseUrl || '/'}${String(baseUrl || '/').endsWith('/') ? '' : '/'}`
  return Object.freeze(Object.fromEntries([
    // Endpoints remove measured silence below -60 dBFS, preserving authored fades.
    ['opening-theme', 'Opening theme', 'opening_theme.mp3', 155.7],
    ['wild-battle', 'Wild battle', 'wild_batle.mp3', 137.35],
    ['gym-leader', 'Gym Leader battle', 'gym_leader.mp3'],
    ['elite-four', 'Elite Four battle', 'elite_four.mp3', 125.3],
  ].map(([id, title, filename, loopEnd]) => [id, Object.freeze({ id, title, url: `${base}music/${filename}`, gain: 1, ...(loopEnd ? { loopEnd } : {}) })])))
}
