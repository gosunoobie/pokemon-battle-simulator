import { planSyncAudition, validateSyncPlan, SYNC_LIMITS } from './sync.js'

export const SYNC_FEEDBACK_VERDICTS = Object.freeze([
  ['unreviewed', 'Not reviewed'], ['keep', 'Keep proposed version'],
  ['adjust-sound', 'Adjust sound'], ['adjust-animation', 'Adjust animation'], ['adjust-both', 'Adjust both'],
])
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
function shape(value, keys, label) {
  if (!plain(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new Error(`Invalid saved ${label}`)
}
function draftNumber(value, nullable = false) {
  // A cleared number input is an intentional unfinished edit. It is safe to
  // retain as draft data, but validateSyncPlan will continue to reject playback.
  if (value !== '' && !(nullable && value === null) && !Number.isFinite(value)) throw new Error('Invalid saved numeric tuning field')
}
function checkNative(value) {
  if (value === null) return
  shape(value, ['sampleRate', 'sampleFrames', 'durationSeconds', 'userAgent'], 'browser measurement')
  if (!Number.isSafeInteger(value.sampleRate) || value.sampleRate < 8000 || value.sampleRate > 192000
    || !Number.isSafeInteger(value.sampleFrames) || value.sampleFrames <= 0
    || !Number.isFinite(value.durationSeconds) || value.durationSeconds <= 0 || value.durationSeconds > SYNC_LIMITS.maxDurationSeconds
    || Math.abs(value.sampleFrames / value.sampleRate - value.durationSeconds) > 1 / value.sampleRate
    || typeof value.userAgent !== 'string' || value.userAgent.length > 2000) throw new Error('Invalid saved browser measurement')
}
function checkDraftPlan(plan) {
  shape(plan, ['visualRate', 'segments'], 'tuning plan')
  draftNumber(plan.visualRate)
  if (!Array.isArray(plan.segments) || !plan.segments.length || plan.segments.length > SYNC_LIMITS.maxSegments) throw new Error('Invalid saved tuning regions')
  for (const segment of plan.segments) {
    shape(segment, ['startSeconds', 'endSeconds', 'soundAnchorSeconds', 'cueSeconds', 'gainDb'], 'tuning region')
    for (const key of ['startSeconds', 'soundAnchorSeconds', 'cueSeconds', 'gainDb']) draftNumber(segment[key])
    draftNumber(segment.endSeconds, true)
  }
}

export function syncFeedbackIssues(record, visual) {
  try {
    validateSyncPlan(record.plan, visual)
    if (record.native) planSyncAudition(record.plan, record.native, visual)
    if (record.accent) {
      const plan = { visualRate: record.plan.visualRate, segments: [record.accent.segment] }
      validateSyncPlan(plan, visual)
      if (record.plan.segments.length + 1 > SYNC_LIMITS.maxSegments) throw new Error('A layered comparison supports at most eight simultaneous regions')
      if (record.accent.native) planSyncAudition(plan, record.accent.native, visual)
    }
    return []
  } catch (cause) { return [cause.message] }
}

/** Feedback is editable draft data, never a playable plan or approval. Preserve
 * safe unfinished tuning and all notes, while invalid tuning loses its verdict. */
export function normalizeSyncFeedback(value, manifest) {
  shape(value, ['schemaVersion', 'kind', 'batchId', 'revision', 'records'], 'feedback bundle')
  if (value.schemaVersion !== 1 || value.kind !== 'battle-sfx-sync-feedback'
    || value.batchId !== manifest?.id || value.revision !== manifest?.revision
    || !Array.isArray(value.records) || value.records.length !== manifest?.moves?.length || value.records.length > 64) throw new Error('Saved feedback belongs to a different batch revision')
  const seen = new Set()
  const records = value.records.map(item => {
    const subject = manifest.moves.find(entry => entry.id === item?.moveId)
    shape(item, ['moveId', 'plan', 'verdict', 'notes', 'native', ...(subject?.accent ? ['accent'] : []), ...(subject?.visualAccent ? ['visualAccent'] : [])], 'feedback record')
    if (!subject || seen.has(item.moveId) || !SYNC_FEEDBACK_VERDICTS.some(([id]) => id === item.verdict)
      || typeof item.notes !== 'string' || item.notes.length > 4000) throw new Error('Invalid saved feedback')
    seen.add(item.moveId); checkDraftPlan(item.plan)
    checkNative(item.native)
    if (subject.accent) {
      shape(item.accent, ['assetId', 'sha256', 'segment', 'native'], 'impact accent')
      if (item.accent.assetId !== subject.accent.asset.id || item.accent.sha256 !== subject.accent.asset.sha256) throw new Error('Invalid saved impact accent pins')
      checkDraftPlan({ visualRate: item.plan.visualRate, segments: [item.accent.segment] })
      checkNative(item.accent.native)
    }
    if (subject.visualAccent) {
      shape(item.visualAccent, ['id', 'revision'], 'visual accent')
      if (item.visualAccent.id !== subject.visualAccent.id || item.visualAccent.revision !== subject.visualAccent.revision) throw new Error('Invalid saved visual accent revision')
    }
    return { ...JSON.parse(JSON.stringify(item)), verdict: syncFeedbackIssues(item, subject.visual).length || subject.accent && (item.native === null || item.accent.native === null) ? 'unreviewed' : item.verdict }
  })
  return { schemaVersion: 1, kind: value.kind, batchId: value.batchId, revision: value.revision, records }
}
