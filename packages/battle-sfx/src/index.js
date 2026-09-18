import catalog from './catalog.generated.js'

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

export const SFX_CATALOG = freeze(catalog)

function lookup(records, id) {
  return typeof id === 'string' && Object.hasOwn(records, id) ? records[id] : null
}

function validateBaseUrl(baseUrl) {
  const invalid = () => {
    throw new TypeError('Sound baseUrl must be a root-relative path or HTTP(S) URL without credentials, whitespace, query or fragment')
  }
  if (typeof baseUrl !== 'string' || !baseUrl.length || /[\\\s\u0000-\u001f\u007f?#]/.test(baseUrl)) invalid()
  if (baseUrl.startsWith('/')) {
    if (baseUrl.startsWith('//')) invalid()
  } else {
    let parsed
    try { parsed = new URL(baseUrl) } catch { invalid() }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !/^https?:\/\//.test(baseUrl)) invalid()
  }
}

/** Exact catalog asset ID only. A descriptor does not approve or play a sound. */
export function getSoundAsset(id, { baseUrl = '/sound_effects/' } = {}) {
  const asset = lookup(catalog.assets, id)
  if (!asset) return null
  validateBaseUrl(baseUrl)
  return Object.freeze({ ...asset, url: `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(asset.file)}` })
}

/** Exact canonical game move ID only; Stage A returns an unreviewed mapping. */
export function getMoveSound(id) {
  return lookup(catalog.moves, id)
}

/** Exact semantic event ID only; the host decides whether an event is relevant. */
export function getBattleSound(id) {
  return lookup(catalog.events, id)
}
