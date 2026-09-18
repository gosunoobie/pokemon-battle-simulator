import { exportReviewBundle, importReviewBundle, validateReviewRecord } from '../../../packages/battle-sfx/src/review.js'

export const collectionSubjectKey = subject => `${subject.kind}:${subject.id}:${subject.phase}`
export const collectionRecordKey = record => `${collectionSubjectKey(record.subject)}:${record.source.assetId}`
export const collectionStorageKey = (batchId, revision = '') => `battle-lab.sfx-bench.collection.v1.${encodeURIComponent(revision)}.${encodeURIComponent(batchId)}`
export const canPairCollectionSubject = (subject, asset) => Boolean(subject?.fxId && asset && asset.variant?.type !== 'turn-effect'
  && !(subject.id === 'present' && asset.variant?.outcome === 'heal'))

export function collectionContext(manifest, record) {
  const context = { catalog: manifest, visualRevisions: manifest?.visualRevisions }
  const subject = manifest?.subjects.find(item => collectionSubjectKey(item) === collectionSubjectKey(record?.subject ?? {}))
  // Audio-only moves deliberately have no visual duration. Each animated record
  // still gets the strict duration bound; omitting it for a bundle must not let a
  // later edited anchor escape its animation.
  if (subject?.fxId) context.visualDurations = Object.fromEntries(manifest.subjects.filter(item => item.fxId).map(item => [collectionSubjectKey(item), item.durationSeconds]))
  return context
}

export function validateCollectionRecord(record, manifest) {
  const result = validateReviewRecord(record, collectionContext(manifest, record))
  const subject = manifest?.subjects.find(item => collectionSubjectKey(item) === collectionSubjectKey(record?.subject ?? {}))
  if (!subject) result.errors.push('This study is absent from the current collection')
  if (record?.status === 'approved' && !canPairCollectionSubject(subject, manifest?.assets[record?.source?.assetId])) result.errors.push('Audio-only studies cannot have a visual listening approval')
  return { valid: result.errors.length === 0, errors: result.errors }
}

function validateRecords(records, manifest, allowedKeys) {
  for (const record of records) {
    const result = validateCollectionRecord(record, manifest)
    if (allowedKeys && !allowedKeys.has(collectionRecordKey(record))) result.errors.push('This review belongs to a different batch')
    if (result.errors.length) throw new TypeError(result.errors.join('; '))
  }
}

export function importCollectionBundle(text, manifest, allowedKeys) {
  const bundle = importReviewBundle(text, collectionContext(manifest))
  const records = bundle.records
  validateRecords(records, manifest, allowedKeys)
  return records
}

export function exportCollectionBundle(records, manifest, allowedKeys) {
  validateRecords(records, manifest, allowedKeys)
  return exportReviewBundle(records, collectionContext(manifest))
}
