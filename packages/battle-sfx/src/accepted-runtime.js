import generated from './accepted-runtime.generated.js'

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

/** Accepted timing/region overrides only; authoring history stays out of clients. */
export const ACCEPTED_SFX_RUNTIME_CATALOG = freeze(generated)

export function getAcceptedMoveSoundPlan(id, { phase = 'attack', mode = 'normal', outcome = 'hit' } = {}) {
  if (typeof id !== 'string' || phase !== 'attack' || mode !== 'normal' || outcome !== 'hit') return null
  return Object.hasOwn(generated.moves, id) ? generated.moves[id] : null
}

export function getAcceptedFxSoundPlan(id, options) {
  if (typeof id !== 'string' || !Object.hasOwn(generated.fxMoves, id)) return null
  return getAcceptedMoveSoundPlan(generated.fxMoves[id], options)
}

export function getAcceptedRuntimeSoundAsset(id, { baseUrl = '/audio/sfx/' } = {}) {
  if (typeof id !== 'string' || !Object.hasOwn(generated.assets, id)) return null
  const fail = () => { throw new TypeError('Sound baseUrl must be root-relative or HTTP(S) without credentials, whitespace, query or fragment') }
  if (typeof baseUrl !== 'string' || !baseUrl.length || /[\\\s\u0000-\u001f\u007f?#]/.test(baseUrl)) fail()
  if (baseUrl.startsWith('/')) { if (baseUrl.startsWith('//')) fail() }
  else {
    let url
    try { url = new URL(baseUrl) } catch { fail() }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !/^https?:\/\//.test(baseUrl)) fail()
  }
  const asset = generated.assets[id]
  return Object.freeze({ ...asset, url: `${baseUrl.replace(/\/+$/, '')}/${asset.file}` })
}
