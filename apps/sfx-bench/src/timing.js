// Seconds sent to Web Audio are derived from explicitly named reference frames.
// A default zero native offset is an unreviewed hypothesis, never auto-correction.
export function planAudition(record, native) {
  const { sampleRate } = record?.source ?? {}
  if (!native || !Number.isFinite(native.durationSeconds) || native.durationSeconds <= 0 || !Number.isSafeInteger(native.sampleRate) || native.sampleRate <= 0 || !Number.isSafeInteger(native.sampleFrames) || native.sampleFrames <= 0) throw new Error('Load a valid selected recording first')
  if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0 || !Number.isSafeInteger(record?.source?.sampleFrames) || record.source.sampleFrames <= 0 || !Array.isArray(record.segments) || !record.segments.length || record.segments.length > 8) throw new Error('Invalid reference region metadata')
  return record.segments.map((segment, index) => {
    const { startFrame, endFrame, sourceAnchorFrame, visualAnchorSeconds, gainDb, nativeOffsetSeconds } = segment
    if (![sampleRate, startFrame, endFrame, sourceAnchorFrame, visualAnchorSeconds, gainDb, nativeOffsetSeconds].every(Number.isFinite) || sampleRate <= 0) throw new Error(`Region ${index + 1} contains invalid numbers`)
    if (![startFrame, endFrame, sourceAnchorFrame].every(Number.isInteger) || startFrame < 0 || endFrame <= startFrame || endFrame > record.source.sampleFrames || sourceAnchorFrame < startFrame || sourceAnchorFrame >= endFrame || visualAnchorSeconds < 0 || gainDb < -60 || gainDb > 6) throw new Error(`Region ${index + 1} has invalid bounds or gain`)
    // Use the same inward grid conversion as review validation; never clamp to
    // the decoded buffer or guess a native encoder-priming correction.
    const { startFrame: nativeStart, endFrame: nativeEnd } = nativeRegionFrames(segment, sampleRate, native.sampleRate)
    const startSeconds = nativeStart / native.sampleRate
    const endSeconds = nativeEnd / native.sampleRate
    const delaySeconds = visualAnchorSeconds - (sourceAnchorFrame - startFrame) / sampleRate
    if (!Number.isSafeInteger(nativeStart) || !Number.isSafeInteger(nativeEnd) || nativeStart < 0 || nativeEnd <= nativeStart || nativeEnd > native.sampleFrames) throw new Error(`Region ${index + 1} lies outside this browser's decoded buffer; inspect alignment before editing the offset`)
    if (delaySeconds < 0) throw new Error(`Region ${index + 1} would start before the animation. Choose a shorter lead-in or a later visual anchor`)
    return { startSeconds, endSeconds, delaySeconds, gainDb }
  })
}

export function waveformPath(waveform, width = 1000, height = 120) {
  if (!waveform?.min?.length || waveform.min.length !== waveform.max.length) return ''
  const scale = height * .45, middle = height / 2, count = waveform.min.length
  return waveform.min.map((minimum, index) => {
    const maximum = waveform.max[index]
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return ''
    const x = (index + .5) * width / count
    return `M${x.toFixed(2)},${(middle - maximum * scale).toFixed(2)}V${(middle - minimum * scale).toFixed(2)}`
  }).join(' ')
}
import { nativeRegionFrames } from '../../../packages/battle-sfx/src/review.js'
