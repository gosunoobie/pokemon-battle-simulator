import { createAudioPlayer } from '@battle/battle-audio'
import { getPokemonCry } from '@battle/pokemon-cries'
import { getRuntimeSoundAsset, getFxSoundPlan, getMoveSoundPlan } from '@battle/battle-sfx/runtime'
import { getAcceptedRuntimeSoundAsset, getAcceptedFxSoundPlan, getAcceptedMoveSoundPlan } from '@battle/battle-sfx/accepted-runtime'
import { getDraftRuntimeSoundAsset, getDraftFxSoundPlan, getDraftMoveSoundPlan } from '@battle/battle-sfx/draft-runtime'
import { getEventSoundPlan, getEventRuntimeSoundAsset } from '@battle/battle-sfx/event-runtime'
import { createMoveAudio, nativeSoundCompatibility } from '../../shared/battle/moveAudio.js'
import { createImpactAudio } from '../../shared/battle/impactAudio.js'

const safe = callback => { try { return callback() } catch { return undefined } }
const fxPlan = (id, options) => getAcceptedFxSoundPlan(id, options) ?? getFxSoundPlan(id, options) ?? getDraftFxSoundPlan(id, options)
const movePlan = (id, options) => getAcceptedMoveSoundPlan(id, options) ?? getMoveSoundPlan(id, options) ?? getDraftMoveSoundPlan(id, options)
const impactEvents = Object.freeze({ 'super-effective': 'battle.hit.super-effective', resisted: 'battle.hit.resisted' })

export function getPlaygroundSoundInfo(moveId, { userAgent = globalThis.navigator?.userAgent ?? '' } = {}) {
  const plan = fxPlan(moveId)
  if (!plan) return Object.freeze({ label: 'No move recording', kind: 'none', available: false })
  if (plan.reviewStatus === 'accepted-sync') return Object.freeze({ label: 'Reviewed sound', kind: 'accepted', available: true })
  if (plan.reviewStatus === 'technical-draft') return Object.freeze({ label: 'Draft sound', kind: 'draft', available: true })
  const available = nativeSoundCompatibility(plan, userAgent)
  return Object.freeze({ label: available ? 'Pilot sound' : 'Pilot sound · compatible decoder required', kind: 'legacy', available })
}

/** Isolated audition settings and cosmetic cues; no battle state or saved player preferences. */
export function createPlaygroundAudio({ playerFactory = createAudioPlayer, document: doc = globalThis.document,
  userAgent = globalThis.navigator?.userAgent ?? '' } = {}) {
  const listeners = new Set()
  let disposed = false, generation = 0, sfxEnabled = true, warmIds = [], state, active
  const publish = value => {
    state = Object.freeze({ ...value, sfxEnabled })
    if (!disposed) for (const listener of listeners) safe(() => listener(state))
  }
  const player = playerFactory({ resolveAsset: id => getEventRuntimeSoundAsset(id)
    ?? getAcceptedRuntimeSoundAsset(id) ?? getRuntimeSoundAsset(id) ?? getDraftRuntimeSoundAsset(id) ?? getPokemonCry(id), onState: publish })
  const available = () => !disposed && state?.enabled && !doc?.hidden
  const moves = createMoveAudio({ player, userAgent, getPlan: fxPlan, getCanonicalPlan: movePlan,
    allowTechnicalDrafts: true, enabled: () => available() && sfxEnabled })
  const impacts = createImpactAudio({ player, enabled: () => available() && sfxEnabled })
  publish(player.getState())

  function stop() {
    generation++
    active?.cancel(); active = null
    moves.stop(); impacts.stop(); player.stop()
  }
  function warmMoves(ids = []) {
    warmIds = [...ids].slice(0, 16)
    impacts.warm()
    return moves.warm(warmIds, { fxIds: true })
  }
  function unlock() {
    if (!available()) return Promise.resolve(false)
    // Keep context creation in the user gesture, before any asynchronous work.
    return Promise.resolve(safe(() => player.unlock())).then(ready => {
      if (ready && available()) { impacts.warm(); moves.warm(warmIds, { fxIds: true }) }
      return Boolean(ready && available())
    }).catch(() => false)
  }
  const visibility = () => { if (doc?.hidden) stop(); player.setSuspended(Boolean(doc?.hidden)) }
  doc?.addEventListener('visibilitychange', visibility)
  visibility()

  function begin({ moveId, phase = 'attack', mode = 'normal', effectiveness = null } = {}) {
    stop()
    const token = generation, move = moves.begin({ moveId, phase, mode, key: `playground:${token}` })
    const feedback = phase === 'attack' && Object.hasOwn(impactEvents, effectiveness) ? getEventSoundPlan(impactEvents[effectiveness]) : null
    const scope = Object.freeze({ playgroundFeedbackLoad: token })
    let cancelled = false, finished = false, impacted = false, voice, feedbackReady
    const valid = () => !disposed && !cancelled && !finished && token === generation
    const cancel = () => {
      if (cancelled) return
      cancelled = true; move.cancel(); safe(() => voice?.cancel()); safe(() => player.stopScope(scope))
    }
    active = Object.freeze({
      get ready() {
        if (!valid() || !available() || !sfxEnabled) return undefined
        const moveReady = move.ready
        if (feedback && !safe(() => player.readyInfo(feedback.assetId))) {
          feedbackReady ??= Promise.resolve(safe(() => player.preload([feedback.assetId], { priority: 2, scope }))).catch(() => {})
        }
        return moveReady || feedbackReady ? Promise.all([moveReady, feedbackReady]) : undefined
      },
      onPresentation(cue) { if (valid()) move.onPresentation(cue) },
      onImpact() {
        if (!valid() || impacted || !feedback) return
        impacted = true
        voice = impacts.play({ key: `playground:${token}:impact`, kind: effectiveness })
      },
      finish(result) {
        if (!valid()) return
        finished = true; move.finish(result)
        safe(() => player.stopScope(scope))
        if (result?.status !== 'completed') cancel()
      },
      cancel,
    })
    return active
  }

  async function previewCry(profileId) {
    if (!available() || !getPokemonCry(profileId)) return false
    stop()
    const token = generation
    // A newer audition, Stop, mute, hide or disposal invalidates this request.
    const valid = () => available() && token === generation
    if (!await Promise.resolve(safe(() => player.unlock())).catch(() => false) || !valid()) return false
    await Promise.resolve(safe(() => player.preload([profileId]))).catch(() => {})
    return valid() && Boolean(safe(() => player.play(profileId)))
  }

  return Object.freeze({
    getState: () => state,
    subscribe(listener) { if (disposed) return () => {}; listeners.add(listener); safe(() => listener(state)); return () => listeners.delete(listener) },
    describeMove: moveId => getPlaygroundSoundInfo(moveId, { userAgent }),
    unlock, warmMoves, begin, stop, previewCry,
    setEnabled(value) { if (disposed) return; if (!value) stop(); player.setEnabled(Boolean(value)); if (value) void unlock() },
    setVolume(value) { if (!disposed) player.setVolume(value) },
    setSfxEnabled(value) {
      if (disposed) return
      sfxEnabled = Boolean(value)
      if (!sfxEnabled) { active?.cancel(); moves.stop(); impacts.stop() }
      player.setCategoryEnabled?.('sfx', sfxEnabled)
      publish(player.getState())
      if (sfxEnabled) void unlock()
    },
    dispose() {
      if (disposed) return
      disposed = true; stop()
      doc?.removeEventListener('visibilitychange', visibility)
      listeners.clear(); moves.dispose(); impacts.dispose(); player.dispose()
    },
  })
}
