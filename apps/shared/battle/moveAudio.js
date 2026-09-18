import { getFxSoundPlan, getMoveSoundPlan } from '@battle/battle-sfx/runtime'

const safe = callback => { try { return callback() } catch { return undefined } }
const canonical = value => typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : ''

// A listening approval covers a specific native decoder, not every Web Audio
// implementation. New browser families/majors need their own reviewed evidence.
export function nativeSoundCompatibility(plan, userAgent, info) {
  const chrome = /\bChrome\/(\d+)\./.exec(userAgent ?? '')
  const expected = plan?.nativeCompatibility
  if (!expected || expected.browser !== 'Chrome' || !chrome || /Edg\/|OPR\//.test(userAgent)
    || chrome[1] !== expected.version.split('.')[0]) return false
  return !info || info.sampleRate === expected.sampleRate && info.sampleFrames === expected.sampleFrames
}

// User-authorized technical drafts play the complete native decode. Reference
// frame coordinates remain provenance, never an unmeasured browser trim offset.
function wholeDraftCompatibility(plan, info) {
  const reference = plan?.reference, segment = plan?.segments?.[0]
  if (plan?.reviewStatus !== 'technical-draft' || plan.playbackPolicy !== 'whole-native-buffer-at-visual-start'
    || plan.nativeCompatibility !== null || plan.phase !== 'attack' || plan.playbackRate !== 1
    || !Array.isArray(plan.segments) || plan.segments.length !== 1 || !segment || !Number.isSafeInteger(reference?.sampleRate)
    || reference.sampleRate < 8000 || reference.sampleRate > 192000
    || !Number.isSafeInteger(reference.sampleFrames) || reference.sampleFrames <= 0
    || reference.sampleFrames / reference.sampleRate > 120 || segment.startFrame !== 0
    || segment.endFrame !== reference.sampleFrames || segment.sourceAnchorFrame !== 0
    || segment.visualAnchorSeconds !== 0 || segment.nativeOffsetSeconds !== 0
    || !Number.isFinite(segment.gainDb) || segment.gainDb < -60 || segment.gainDb > 0) return false
  if (!info) return true
  if (!Number.isSafeInteger(info.sampleRate) || info.sampleRate < 8000 || info.sampleRate > 192000
    || !Number.isSafeInteger(info.sampleFrames) || info.sampleFrames <= 0) return false
  const duration = info.sampleFrames / info.sampleRate
  return duration <= 120 && Math.abs(duration - reference.sampleFrames / reference.sampleRate) <= .1
}

// Final sync approvals use the exact native-buffer seconds auditioned by the
// reviewer, rather than interpreting reference decoder frames as browser trims.
function acceptedRegions(plan, info) {
  if (plan.phase !== 'attack' || plan.playbackRate !== 1 || !Number.isFinite(plan.visualRate)
    || plan.visualRate < .75 || plan.visualRate > 1.25 || !Number.isFinite(plan.visualDurationSeconds)
    || plan.visualDurationSeconds <= 0 || !Array.isArray(plan.segments)
    || !plan.segments.length || plan.segments.length > 8
    || !Number.isSafeInteger(info.sampleRate) || info.sampleRate <= 0
    || !Number.isSafeInteger(info.sampleFrames) || info.sampleFrames <= 0) return null
  const duration = info.sampleFrames / info.sampleRate
  if (duration > 120) return null
  const regions = []
  for (const segment of plan.segments) {
    const { startSeconds, soundAnchorSeconds, cueSeconds, gainDb } = segment
    const endSeconds = segment.endSeconds === null ? duration : segment.endSeconds
    const delay = cueSeconds / plan.visualRate - (soundAnchorSeconds - startSeconds)
    if (![startSeconds, endSeconds, soundAnchorSeconds, cueSeconds, gainDb, delay].every(Number.isFinite)
      || startSeconds < 0 || endSeconds <= startSeconds || endSeconds > duration
      || soundAnchorSeconds < startSeconds || soundAnchorSeconds >= endSeconds
      || cueSeconds < 0 || cueSeconds > plan.visualDurationSeconds || delay < 0
      || delay + endSeconds - startSeconds > 120 || gainDb < -60 || gainDb > 0) return null
    regions.push({ startSeconds, endSeconds, delay, gainDb })
  }
  return regions
}

/** Host-owned optional presentation. This module receives no mutable battle state. */
export function createMoveAudio({ player, userAgent = globalThis.navigator?.userAgent ?? '',
  getPlan = getFxSoundPlan, getCanonicalPlan = getMoveSoundPlan, enabled = () => true,
  allowTechnicalDrafts = false, maxDriftSeconds = .1, now = () => performance.now() } = {}) {
  const runs = new Set(), heard = new Set()
  const counts = { started: 0, cacheMiss: 0, unsupported: 0, droppedLate: 0, interrupted: 0 }
  let disposed = false, serial = 0
  const isDraft = plan => plan?.reviewStatus === 'technical-draft'
  const layers = plan => {
    if (!plan?.accent) return plan ? [plan] : []
    const accent = plan.accent
    if (plan.reviewStatus !== 'accepted-sync' || typeof accent.assetId !== 'string' || !accent.assetId
      || accent.assetId === plan.assetId || !accent.segment || !accent.nativeCompatibility) return []
    return [plan, { ...plan, assetId: accent.assetId, segments: [accent.segment], nativeCompatibility: accent.nativeCompatibility }]
  }
  const supported = (plan, info) => isDraft(plan)
    ? allowTechnicalDrafts === true && wholeDraftCompatibility(plan, info)
    : nativeSoundCompatibility(plan, userAgent, info)
  const supportedPlan = plan => {
    const parts = layers(plan)
    return parts.length > 0 && parts.every(part => supported(part))
  }
  function warm(moveIds, { fxIds = false } = {}) {
    if (disposed || !enabled()) return []
    const ids = [...new Set((moveIds ?? []).slice(0, 16).map(id => fxIds ? getPlan(id) : getCanonicalPlan(canonical(id)))
      .filter(supportedPlan).flatMap(plan => layers(plan).map(part => part.assetId)))]
    if (ids.length) safe(() => Promise.resolve(player.preload(ids, { priority: 1 })).catch(() => {}))
    return ids
  }
  function begin({ moveId, phase = 'attack', outcome = 'hit', mode = 'normal', key } = {}) {
    const plan = phase === 'attack' && outcome === 'hit' && mode === 'normal' ? getPlan(moveId, { phase, outcome, mode }) : null
    const scope = Object.freeze({ soundRun: ++serial })
    const eventKey = key ?? `preview:${serial}`
    let started = false, cancelled = false, complete = false, audioBase, visualBase, voices = []
    const cancel = () => {
      if (cancelled) return
      cancelled = true; runs.delete(run)
      safe(() => player.stopScope(scope))
      for (const voice of voices) safe(() => voice.cancel())
    }
    const run = Object.freeze({
      onPresentation(cue) {
        if (disposed || cancelled || complete || !enabled() || !plan) return
        if (cue?.type === 'start') {
          if (started || heard.has(eventKey)) return
          started = true; heard.add(eventKey)
          if (heard.size > 512) heard.delete(heard.values().next().value)
          if (cue.reducedMotion || !supportedPlan(plan)) { counts.unsupported++; cancel(); return }
          if (cue.timelineSeconds !== 0 || !Number.isFinite(cue.observedAtMs) || Math.abs(now() - cue.observedAtMs) > maxDriftSeconds * 1000) {
            counts.droppedLate++; cancel(); return
          }
          const regions = []
          // Validate every layer before scheduling any voice. A missing or
          // incompatible impact must not leave a partly accepted Psychic mix.
          for (const part of layers(plan)) {
            const info = safe(() => player.readyInfo(part.assetId))
            if (!info) { counts.cacheMiss++; cancel(); return }
            if (!supported(part, info)) { counts.unsupported++; cancel(); return }
            if (part.reviewStatus === 'accepted-sync') {
              const accepted = acceptedRegions(part, info)
              if (!accepted) { counts.unsupported++; cancel(); return }
              regions.push(...accepted.map(region => ({ ...region, assetId: part.assetId })))
            } else if (isDraft(part)) {
              regions.push({ assetId: part.assetId, startSeconds: 0, endSeconds: info.sampleFrames / info.sampleRate, delay: 0, gainDb: part.segments[0].gainDb })
            } else for (const segment of part.segments) {
              const start = Math.ceil((segment.startFrame / part.reference.sampleRate + segment.nativeOffsetSeconds) * info.sampleRate - 1e-7)
              const end = Math.floor((segment.endFrame / part.reference.sampleRate + segment.nativeOffsetSeconds) * info.sampleRate + 1e-7)
              const delay = segment.visualAnchorSeconds - (segment.sourceAnchorFrame - segment.startFrame) / part.reference.sampleRate
              if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > info.sampleFrames || end <= start || delay < 0 || !Number.isFinite(delay)) {
                counts.unsupported++; cancel(); return
              }
              regions.push({ assetId: part.assetId, startSeconds: start / info.sampleRate, endSeconds: end / info.sampleRate, delay, gainDb: segment.gainDb })
            }
          }
          if (regions.length > 8) { counts.unsupported++; cancel(); return }
          audioBase = player.contextTime(); visualBase = cue.timelineSeconds
          if (!Number.isFinite(audioBase) || audioBase < 0) { counts.unsupported++; cancel(); return }
          for (const { delay, assetId, ...region } of regions) {
            const voice = safe(() => player.playSegment(assetId, { ...region, category: 'sfx', priority: 1, scope,
              ...(delay > 0 ? { when: audioBase + delay } : {}) }))
            if (!voice) { counts.cacheMiss++; cancel(); return }
            voices.push(voice)
          }
          counts.started++
          void Promise.all(voices.map(voice => voice.finished)).then(() => runs.delete(run), cancel)
        } else if (cue?.type === 'frame' && audioBase != null) {
          const drift = Math.abs(player.contextTime() - audioBase - (cue.timelineSeconds - visualBase))
          if (!Number.isFinite(drift) || drift > maxDriftSeconds) { counts.interrupted++; cancel() }
        }
      },
      finish(result) {
        complete = true
        if (result?.status !== 'completed') cancel()
        else if (!voices.length) runs.delete(run)
        // Natural whole-recording tails may finish; no presenter cleanup signal
        // owns them. Explicit cancellation still stops this run after completion.
      },
      cancel,
    })
    runs.add(run)
    return run
  }
  function stop() { for (const run of [...runs]) run.cancel() }
  return Object.freeze({ warm, begin, stop,
    supported: () => allowTechnicalDrafts === true || supported(getCanonicalPlan('tackle')),
    diagnostics: () => Object.freeze({ ...counts, activeRuns: runs.size }),
    dispose() { disposed = true; stop(); heard.clear() },
  })
}
