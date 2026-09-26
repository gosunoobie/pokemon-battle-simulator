import { getEventSoundPlan, getEventRuntimeSoundAsset } from '@battle/battle-sfx/event-runtime'

const safe = callback => { try { return callback() } catch { return undefined } }

/** Plays explicit host cues only, with shared source validation and owned cleanup. */
export function createEventAudio({ player, eventIds, enabled = () => true, gainMultiplier = 1 } = {}) {
  const heard = new Set(), voices = new Set()
  const gainOffset = Number.isFinite(gainMultiplier) && gainMultiplier > 0 && gainMultiplier <= 2
    ? 20 * Math.log10(gainMultiplier) : 0
  let disposed = false
  const available = () => !disposed && enabled()
  function warm() {
    if (!available()) return
    const ids = Object.values(eventIds).map(id => getEventSoundPlan(id)?.assetId).filter(Boolean)
    safe(() => Promise.resolve(player.preload(ids, { priority: 2 })).catch(() => {}))
  }
  function play(feedback) {
    if (!available() || typeof feedback?.key !== 'string' || !feedback.key || heard.has(feedback.key)
      || !Object.hasOwn(eventIds, feedback.kind)) return null
    // Remember cache misses too. A download finishing after impact must not
    // start a delayed effect, and duplicate network delivery never replays it.
    heard.add(feedback.key)
    if (heard.size > 512) heard.delete(heard.values().next().value)
    const plan = getEventSoundPlan(eventIds[feedback.kind]), info = safe(() => player.readyInfo(plan.assetId))
    const reference = getEventRuntimeSoundAsset(plan.assetId)?.reference
    if (!Number.isSafeInteger(info?.sampleRate) || info.sampleRate < 8000 || info.sampleRate > 192000
      || !Number.isSafeInteger(info.sampleFrames) || info.sampleFrames <= 0) return null
    const duration = info.sampleFrames / info.sampleRate
    if (duration > 120 || !reference || Math.abs(duration - reference.sampleFrames / reference.sampleRate) > .1) return null
    const voice = safe(() => player.playSegment(plan.assetId, { category: 'sfx', priority: 2,
      gainDb: Math.max(-60, Math.min(6, plan.gainDb + gainOffset)), scope: Object.freeze({ eventSound: feedback.key }) }))
    if (!voice) return null
    voices.add(voice)
    void Promise.resolve(voice.finished).then(() => voices.delete(voice), () => { safe(() => voice.cancel()); voices.delete(voice) })
    return voice
  }
  function stop() { for (const voice of voices) safe(() => voice.cancel()); voices.clear() }
  return Object.freeze({ warm, play, stop, dispose() { disposed = true; stop(); heard.clear() } })
}
