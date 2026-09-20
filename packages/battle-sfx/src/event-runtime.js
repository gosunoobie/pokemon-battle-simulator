import generated from './event-runtime.generated.js'

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

/** Explicitly requested event recordings; separate from exact move-sync approvals. */
export const EVENT_SFX_RUNTIME_CATALOG = freeze(generated)

export function getEventSoundPlan(eventId) {
  return typeof eventId === 'string' && Object.hasOwn(generated.events, eventId) ? generated.events[eventId] : null
}

function checkBase(baseUrl) {
  const invalid = () => { throw new TypeError('SFX baseUrl must be a root-relative path or HTTP(S) URL without credentials, whitespace, query or fragment') }
  if (typeof baseUrl !== 'string' || !baseUrl.length || /[\\\s\u0000-\u001f\u007f?#]/.test(baseUrl)) invalid()
  if (baseUrl.startsWith('/')) {
    if (baseUrl.startsWith('//')) invalid()
  } else {
    let url
    try { url = new URL(baseUrl) } catch { invalid() }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !/^https?:\/\//.test(baseUrl)) invalid()
  }
}

export function getEventRuntimeSoundAsset(assetId, { baseUrl = '/audio/sfx/' } = {}) {
  if (typeof assetId !== 'string' || !Object.hasOwn(generated.assets, assetId)) return null
  checkBase(baseUrl)
  const asset = generated.assets[assetId]
  return Object.freeze({ ...asset, url: `${baseUrl.replace(/\/+$/, '')}/${asset.file}` })
}
