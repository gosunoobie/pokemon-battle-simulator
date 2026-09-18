// Development-only A/B timing proposals. These are not listening approvals or
// production sound plans, and source times refer to the selected native decode.
export const SYNC_LIMITS = Object.freeze({ minVisualRate: .75, maxVisualRate: 1.25,
  maxSegments: 8, maxDurationSeconds: 120, minGainDb: -60, maxGainDb: 6 })

export function validateVisualRate(value) {
  if (!Number.isFinite(value) || value < SYNC_LIMITS.minVisualRate || value > SYNC_LIMITS.maxVisualRate) {
    throw new Error(`Visual rate must be between ${SYNC_LIMITS.minVisualRate} and ${SYNC_LIMITS.maxVisualRate}`)
  }
  return value
}

export function validateSyncPlan(plan, { durationSeconds } = {}) {
  validateVisualRate(plan?.visualRate)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > SYNC_LIMITS.maxDurationSeconds) throw new Error('A valid authored visual duration is required')
  if (!Array.isArray(plan.segments) || plan.segments.length < 1 || plan.segments.length > SYNC_LIMITS.maxSegments) throw new Error('A sync plan needs between one and eight regions')
  const segments = plan.segments.map((segment, index) => {
    const fail = reason => { throw new Error(`Region ${index + 1} ${reason}`) }
    if (!segment || typeof segment !== 'object') fail('is invalid')
    const { startSeconds, endSeconds, soundAnchorSeconds, cueSeconds, gainDb } = segment
    if (![startSeconds, soundAnchorSeconds, cueSeconds, gainDb].every(Number.isFinite)
      || endSeconds !== null && !Number.isFinite(endSeconds)) fail('contains invalid numbers')
    if (startSeconds < 0 || startSeconds >= SYNC_LIMITS.maxDurationSeconds
      || endSeconds !== null && (endSeconds <= startSeconds || endSeconds > SYNC_LIMITS.maxDurationSeconds)
      || soundAnchorSeconds < startSeconds || soundAnchorSeconds >= (endSeconds ?? SYNC_LIMITS.maxDurationSeconds)
      || cueSeconds < 0 || cueSeconds > durationSeconds
      || gainDb < SYNC_LIMITS.minGainDb || gainDb > SYNC_LIMITS.maxGainDb) fail('has invalid bounds, anchor or gain')
    const delaySeconds = cueSeconds / plan.visualRate - (soundAnchorSeconds - startSeconds)
    if (delaySeconds < 0) fail('would start before the animation; shorten the sound lead-in or choose a later visual cue')
    return { startSeconds, endSeconds, soundAnchorSeconds, cueSeconds, gainDb }
  })
  return { visualRate: plan.visualRate, segments }
}

/** Produce independent audio.play regions; the caller adds its audio base time. */
export function planSyncAudition(plan, native, options) {
  const validated = validateSyncPlan(plan, options)
  if (!native || !Number.isSafeInteger(native.sampleRate) || native.sampleRate < 8000 || native.sampleRate > 192000
    || !Number.isSafeInteger(native.sampleFrames) || native.sampleFrames <= 0
    || !Number.isFinite(native.durationSeconds) || native.durationSeconds <= 0
    || native.durationSeconds > SYNC_LIMITS.maxDurationSeconds || native.sampleFrames / native.sampleRate > SYNC_LIMITS.maxDurationSeconds
    || Math.abs(native.durationSeconds - native.sampleFrames / native.sampleRate) > 1 / native.sampleRate) {
    throw new Error('Load a valid native recording before scheduling a sync comparison')
  }
  const duration = native.sampleFrames / native.sampleRate
  return validated.segments.map((segment, index) => {
    const { startSeconds, soundAnchorSeconds, cueSeconds, gainDb } = segment
    const endSeconds = segment.endSeconds ?? duration
    if (endSeconds > duration || startSeconds >= endSeconds || soundAnchorSeconds >= endSeconds) {
      throw new Error(`Region ${index + 1} lies outside this native recording; boundaries are never clamped`)
    }
    return { startSeconds, endSeconds, delaySeconds: cueSeconds / validated.visualRate - (soundAnchorSeconds - startSeconds), gainDb }
  })
}
