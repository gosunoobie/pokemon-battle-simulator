import generated from './runtime.generated.js'

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

/** Approved subset only. This entry never imports the 530-file candidate catalog. */
export const SFX_RUNTIME_CATALOG = freeze(generated)

/** Unsupported phases, presentation modes and cosmetic outcomes are intentionally silent. */
export function getMoveSoundPlan(moveId, { phase = 'attack', mode = 'normal', outcome = 'hit' } = {}) {
  if (typeof moveId !== 'string' || phase !== 'attack' || mode !== 'normal' || outcome !== 'hit') return null
  return Object.hasOwn(generated.moves, moveId) ? generated.moves[moveId] : null
}

/** Explicit reviewed FX identifiers; no spelling normalization or filename inference. */
export function getFxSoundPlan(fxId, options) {
  if (typeof fxId !== 'string' || !Object.hasOwn(generated.fxMoves, fxId)) return null
  return getMoveSoundPlan(generated.fxMoves[fxId], options)
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

export function getRuntimeSoundAsset(assetId, { baseUrl = '/audio/sfx/' } = {}) {
  if (typeof assetId !== 'string' || !Object.hasOwn(generated.assets, assetId)) return null
  checkBase(baseUrl)
  const asset = generated.assets[assetId]
  return Object.freeze({ ...asset, url: `${baseUrl.replace(/\/+$/, '')}/${asset.file}` })
}
