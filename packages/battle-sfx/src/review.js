// Stage B authoring records only. Approval is a reviewer assertion, not permission
// to publish or play a sound. This module has no runtime or catalog dependency.
export const REVIEW_LIMITS = Object.freeze({ records: 64, segments: 8, jsonBytes: 1024 * 1024, jsonCharacters: 1024 * 1024, notesCharacters: 4000 })

const HASH = /^[a-f0-9]{64}$/
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
const own = (object, key) => object && typeof key === 'string' && Object.hasOwn(object, key) ? object[key] : undefined
const hasText = value => typeof value === 'string' && value.trim().length > 0
const copy = value => JSON.parse(JSON.stringify(value))

function exceedsJsonLimit(text) {
  // A fast UTF-16 bound precedes counting the actual serialized UTF-8 bytes.
  // Unpaired surrogates take three bytes, matching UTF-8 replacement encoding.
  if (text.length > REVIEW_LIMITS.jsonCharacters) return true
  let bytes = 0
  for (const character of text) {
    const point = character.codePointAt(0)
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4
    if (bytes > REVIEW_LIMITS.jsonBytes) return true
  }
  return false
}

function shape(value, keys, path, errors) {
  if (!isObject(value)) { errors.push(`${path} must be a plain object`); return false }
  for (const key of Object.keys(value)) if (!keys.includes(key) || UNSAFE_KEYS.has(key)) errors.push(`${path}.${key} is not allowed`)
  for (const key of keys) if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required`)
  return true
}

function string(value, max, path, errors, nonempty = false) {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) errors.push(`${path} must be ${nonempty ? 'nonempty ' : ''}text of at most ${max} characters`)
}

function number(value, min, max, path, errors, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) errors.push(`${path} must be ${integer ? 'an integer' : 'finite'} from ${min} to ${max}`)
}

function bool(value, path, errors) { if (typeof value !== 'boolean') errors.push(`${path} must be a boolean`) }

/** Select only whole native frames inside the authored reference-time window.
 * This is coordinate quantization, never buffer clamping or priming correction. */
export function nativeRegionFrames(segment, referenceRate, nativeRate) {
  if (![segment?.startFrame, segment?.endFrame, segment?.nativeOffsetSeconds, referenceRate, nativeRate].every(Number.isFinite) || referenceRate <= 0 || nativeRate <= 0) throw new TypeError('Native frame conversion requires finite coordinates and positive sample rates')
  const start = (segment.startFrame / referenceRate + segment.nativeOffsetSeconds) * nativeRate
  const end = (segment.endFrame / referenceRate + segment.nativeOffsetSeconds) * nativeRate
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new RangeError('Native frame coordinates overflowed')
  // The 1e-7 frame tolerance repairs floating-point noise at exact integers only.
  const startFrame = Math.ceil(start - 1e-7), endFrame = Math.floor(end + 1e-7)
  return { startFrame: startFrame === 0 ? 0 : startFrame, endFrame: endFrame === 0 ? 0 : endFrame }
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted)
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]))
  return value
}

function fingerprint(record) {
  const { status, approvalFingerprint, ...reviewed } = record
  // An exact snapshot avoids pretending a weak checksum is a signature.
  return JSON.stringify(sorted(reviewed))
}

export function createReviewRecord({ asset, subject, visualRevision, decoderReference }) {
  if (!asset?.decoded || !subject) throw new TypeError('An audited asset and explicit subject are required')
  const record = {
    schemaVersion: 1,
    status: 'draft',
    subject: { kind: subject.kind, id: subject.id, phase: subject.phase },
    source: {
      assetId: asset.id,
      sha256: asset.sha256,
      pcmSha256: asset.decoded.pcmSha256,
      sampleRate: asset.decoded.sampleRate,
      sampleFrames: asset.decoded.sampleFrames,
      auditLockSha256: decoderReference?.auditLockSha256,
    },
    visualRevision,
    segments: [{ startFrame: 0, endFrame: asset.decoded.sampleFrames, sourceAnchorFrame: 0, visualAnchorSeconds: 0, gainDb: 0, nativeOffsetSeconds: 0 }],
    review: {
      reviewer: '', notes: '', near: false, far: false,
      native: { browser: '', version: '', sampleRate: null, sampleFrames: null, alignmentConfirmed: false, notes: '' },
    },
    approvalFingerprint: null,
  }
  return record
}

/** Validation never fills missing evidence, guesses an asset, or repairs a record. */
export function validateReviewRecord(record, { catalog, visualRevisions, visualDurations } = {}) {
  const errors = []
  if (!shape(record, ['schemaVersion', 'status', 'subject', 'source', 'visualRevision', 'segments', 'review', 'approvalFingerprint'], 'record', errors)) return { valid: false, errors }
  if (record.schemaVersion !== 1) errors.push('record.schemaVersion must be 1')
  if (!['draft', 'approved'].includes(record.status)) errors.push('record.status must be draft or approved')
  const subjectShape = shape(record.subject, ['kind', 'id', 'phase'], 'record.subject', errors)
  const sourceShape = shape(record.source, ['assetId', 'sha256', 'pcmSha256', 'sampleRate', 'sampleFrames', 'auditLockSha256'], 'record.source', errors)
  let policy, asset, visualDuration
  if (subjectShape) {
    if (!['move', 'event'].includes(record.subject.kind)) errors.push('record.subject.kind must be move or event')
    string(record.subject.id, 120, 'record.subject.id', errors, true)
    if (!['attack', 'prepare'].includes(record.subject.phase) || (record.subject.kind === 'event' && record.subject.phase !== 'attack')) errors.push('record.subject.phase is unsupported')
    policy = own(record.subject.kind === 'move' ? catalog?.moves : catalog?.events, record.subject.id)
    if (!policy) errors.push('record.subject has no catalog policy')
    const revisionKey = ['kind', 'id', 'phase'].every(key => typeof record.subject[key] === 'string') ? `${record.subject.kind}:${record.subject.id}:${record.subject.phase}` : ''
    const revision = own(visualRevisions, revisionKey)
    if (typeof revision !== 'string' || record.visualRevision !== revision) errors.push('record.visualRevision is missing, stale, or unsupported for this phase')
    // Optional for external authoring consumers; a bench that supplies this map
    // must supply valid duration metadata for every animated move it supports.
    if (record.subject.kind === 'move' && visualDurations !== undefined) {
      visualDuration = own(visualDurations, revisionKey)
      if (!Number.isFinite(visualDuration) || visualDuration <= 0 || visualDuration > 120) errors.push('The move phase needs valid visual duration metadata')
    }
  }
  string(record.visualRevision, 200, 'record.visualRevision', errors, true)
  if (sourceShape) {
    string(record.source.assetId, 180, 'record.source.assetId', errors, true)
    for (const key of ['sha256', 'pcmSha256', 'auditLockSha256']) if (typeof record.source[key] !== 'string' || !HASH.test(record.source[key])) errors.push(`record.source.${key} must be a SHA-256 hash`)
    number(record.source.sampleRate, 8000, 192000, 'record.source.sampleRate', errors, true)
    number(record.source.sampleFrames, 1, 23040000, 'record.source.sampleFrames', errors, true)
    asset = own(catalog?.assets, record.source.assetId)
    if (!asset) errors.push('record.source.assetId is unknown')
    else {
      if (record.source.sha256 !== asset.sha256 || record.source.pcmSha256 !== asset.decoded?.pcmSha256 || record.source.sampleRate !== asset.decoded?.sampleRate || record.source.sampleFrames !== asset.decoded?.sampleFrames) errors.push('record.source is stale relative to the audited asset')
      if (!policy?.assetIds?.includes(asset.id)) errors.push('record.source.assetId is not a candidate for this subject')
    }
    if (record.source.auditLockSha256 !== catalog?.provenance?.auditLockSha256) errors.push('record.source.auditLockSha256 is stale')
  }
  if (!Array.isArray(record.segments) || record.segments.length < 1 || record.segments.length > REVIEW_LIMITS.segments) errors.push('record.segments must contain 1–8 regions')
  else record.segments.forEach((segment, index) => {
    const path = `record.segments[${index}]`
    if (!shape(segment, ['startFrame', 'endFrame', 'sourceAnchorFrame', 'visualAnchorSeconds', 'gainDb', 'nativeOffsetSeconds'], path, errors)) return
    const end = asset?.decoded?.sampleFrames ?? 0
    number(segment.startFrame, 0, end - 1, `${path}.startFrame`, errors, true)
    number(segment.endFrame, 1, end, `${path}.endFrame`, errors, true)
    number(segment.sourceAnchorFrame, 0, end - 1, `${path}.sourceAnchorFrame`, errors, true)
    const finiteFrames = ['startFrame', 'endFrame', 'sourceAnchorFrame'].every(key => Number.isFinite(segment[key]))
    if (finiteFrames && (segment.endFrame <= segment.startFrame || segment.sourceAnchorFrame < segment.startFrame || segment.sourceAnchorFrame >= segment.endFrame)) errors.push(`${path} must have start <= anchor < end`)
    number(segment.visualAnchorSeconds, 0, 120, `${path}.visualAnchorSeconds`, errors)
    if (Number.isFinite(visualDuration) && Number.isFinite(segment.visualAnchorSeconds) && segment.visualAnchorSeconds > visualDuration) errors.push(`${path}.visualAnchorSeconds exceeds the animation duration`)
    number(segment.gainDb, -60, 6, `${path}.gainDb`, errors)
    number(segment.nativeOffsetSeconds, -0.1, 0.1, `${path}.nativeOffsetSeconds`, errors)
    const rate = record.source?.sampleRate
    if (finiteFrames && Number.isFinite(segment.visualAnchorSeconds) && Number.isFinite(rate) && rate > 0 && segment.visualAnchorSeconds - (segment.sourceAnchorFrame - segment.startFrame) / rate < 0) errors.push(`${path} would start before the visual timeline; choose a later visual anchor or a shorter source lead-in`)
    const native = record.review?.native
    if (finiteFrames && Number.isFinite(segment.nativeOffsetSeconds) && Number.isFinite(rate) && rate > 0 && Number.isFinite(native?.sampleRate) && native.sampleRate > 0 && Number.isFinite(native?.sampleFrames)) {
      try {
        const { startFrame: nativeStart, endFrame: nativeEnd } = nativeRegionFrames(segment, rate, native.sampleRate)
        if (nativeStart < 0 || nativeEnd > native.sampleFrames) errors.push(`${path} extends outside the measured native browser buffer`)
        if (nativeEnd <= nativeStart) errors.push(`${path} has no playable frames on the measured native browser sample grid`)
      } catch { errors.push(`${path} has invalid native browser frame coordinates`) }
    }
  })
  if (shape(record.review, ['reviewer', 'notes', 'near', 'far', 'native'], 'record.review', errors)) {
    string(record.review.reviewer, 120, 'record.review.reviewer', errors)
    string(record.review.notes, REVIEW_LIMITS.notesCharacters, 'record.review.notes', errors)
    bool(record.review.near, 'record.review.near', errors)
    bool(record.review.far, 'record.review.far', errors)
    if (shape(record.review.native, ['browser', 'version', 'sampleRate', 'sampleFrames', 'alignmentConfirmed', 'notes'], 'record.review.native', errors)) {
      const native = record.review.native
      string(native.browser, 100, 'record.review.native.browser', errors)
      string(native.version, 100, 'record.review.native.version', errors)
      string(native.notes, REVIEW_LIMITS.notesCharacters, 'record.review.native.notes', errors)
      bool(native.alignmentConfirmed, 'record.review.native.alignmentConfirmed', errors)
      if (native.sampleRate !== null) number(native.sampleRate, 8000, 192000, 'record.review.native.sampleRate', errors, true)
      if (native.sampleFrames !== null) number(native.sampleFrames, 1, 23040000, 'record.review.native.sampleFrames', errors, true)
      if ((native.sampleRate === null) !== (native.sampleFrames === null)) errors.push('Native sample rate and frame count must be supplied together')
    }
  }
  if (record.status === 'draft' && record.approvalFingerprint !== null) errors.push('A draft cannot retain an approval fingerprint')
  if (record.status === 'approved') {
    string(record.approvalFingerprint, 30000, 'record.approvalFingerprint', errors, true)
    approvalErrors(record, errors)
    if (!errors.length && record.approvalFingerprint !== fingerprint(record)) errors.push('Approval is stale: source, visual revision, settings, or evidence changed')
  }
  return { valid: errors.length === 0, errors }
}

function approvalErrors(record, errors) {
  const review = record.review, native = review?.native
  if (!hasText(review?.reviewer) || !hasText(review?.notes)) errors.push('Approval requires a reviewer and listening notes')
  if (review?.near !== true || review?.far !== true) errors.push('Approval requires both near and far perspective listening checks')
  if (!hasText(native?.browser) || !hasText(native?.version) || !Number.isSafeInteger(native?.sampleRate) || native.sampleRate <= 0 || !Number.isSafeInteger(native?.sampleFrames) || native.sampleFrames <= 0 || native?.alignmentConfirmed !== true || !hasText(native?.notes)) errors.push('Approval requires measured native decoding and manual alignment notes')
}

export function approveReviewRecord(record, context) {
  const draft = copy(record)
  draft.status = 'draft'
  draft.approvalFingerprint = null
  const result = validateReviewRecord(draft, context)
  approvalErrors(draft, result.errors)
  if (result.errors.length) throw new TypeError(result.errors.join('; '))
  draft.status = 'approved'
  draft.approvalFingerprint = fingerprint(draft)
  return draft
}

/** Call after changing region, gain, alignment, selected asset, or visual revision. */
export function resetReviewRecord(record) {
  const draft = copy(record)
  draft.status = 'draft'
  draft.approvalFingerprint = null
  draft.review.near = false
  draft.review.far = false
  draft.review.native.alignmentConfirmed = false
  return draft
}

function validateBundle(bundle, context) {
  const errors = []
  if (!shape(bundle, ['schemaVersion', 'kind', 'auditLockSha256', 'records'], 'bundle', errors)) return errors
  if (bundle.schemaVersion !== 1 || bundle.kind !== 'battle-sfx-reviews') errors.push('Unsupported review bundle schema')
  if (bundle.auditLockSha256 !== context?.catalog?.provenance?.auditLockSha256 || !HASH.test(bundle.auditLockSha256)) errors.push('Review bundle audit lock is missing or stale')
  if (!Array.isArray(bundle.records) || bundle.records.length > REVIEW_LIMITS.records) errors.push('Review bundle must have at most 64 records')
  else {
    const seen = new Set()
    bundle.records.forEach((record, index) => {
      errors.push(...validateReviewRecord(record, context).errors.map(error => `records[${index}]: ${error}`))
      const key = JSON.stringify([record?.subject?.kind, record?.subject?.id, record?.subject?.phase, record?.source?.assetId])
      if (seen.has(key)) errors.push(`records[${index}]: duplicate subject/phase/asset record`)
      seen.add(key)
    })
  }
  return errors
}

export function exportReviewBundle(records, context) {
  const bundle = { schemaVersion: 1, kind: 'battle-sfx-reviews', auditLockSha256: context?.catalog?.provenance?.auditLockSha256, records }
  const errors = validateBundle(bundle, context)
  if (errors.length) throw new TypeError(errors.join('; '))
  const text = `${JSON.stringify(bundle, null, 2)}\n`
  if (exceedsJsonLimit(text)) throw new RangeError('Review bundle exceeds its 1 MiB UTF-8 size limit')
  return text
}

export function importReviewBundle(text, context) {
  if (typeof text !== 'string' || exceedsJsonLimit(text)) throw new RangeError('Review bundle must be bounded JSON text of at most 1 MiB UTF-8')
  let bundle
  try { bundle = JSON.parse(text) } catch { throw new TypeError('Review bundle is not valid JSON') }
  const errors = validateBundle(bundle, context)
  if (errors.length) throw new TypeError(errors.join('; '))
  return bundle
}
