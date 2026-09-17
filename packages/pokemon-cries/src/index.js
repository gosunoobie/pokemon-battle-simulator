import catalog from './catalog.generated.js'

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
export const CRY_CATALOG = freeze(catalog)

/** Exact project species/form IDs only. This function never fetches or plays audio. */
export function getPokemonCry(id, { baseUrl = '/audio/cries/' } = {}) {
  if (typeof id !== 'string' || !Object.hasOwn(catalog.pokemon, id)) return null
  const invalid = () => { throw new TypeError('Cry baseUrl must be a root-relative path or HTTP(S) URL without credentials, whitespace, query or fragment') }
  if (typeof baseUrl !== 'string' || !baseUrl.length || /[\\\s\u0000-\u001f\u007f?#]/.test(baseUrl)) invalid()
  if (baseUrl.startsWith('/')) {
    if (baseUrl.startsWith('//')) invalid()
  } else {
    let parsed
    try { parsed = new URL(baseUrl) } catch { invalid() }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !/^https?:\/\//.test(baseUrl)) invalid()
  }
  const mapping = catalog.pokemon[id], asset = catalog.assets[mapping.assetId]
  return Object.freeze({ id, ...mapping, ...asset, url: `${baseUrl.replace(/\/+$/, '')}/${asset.file}` })
}
