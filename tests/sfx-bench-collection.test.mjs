import test from 'node:test'
import assert from 'node:assert/strict'
import { createReviewRecord, approveReviewRecord } from '../packages/battle-sfx/src/review.js'
import { collectionContext, collectionRecordKey, collectionStorageKey, canPairCollectionSubject, validateCollectionRecord, importCollectionBundle, exportCollectionBundle } from '../apps/sfx-bench/src/collection.js'

const hash = 'a'.repeat(64)
function fixture() {
  const assets = Object.fromEntries(['animated', 'audioonly', 'event'].map(id => [id, { id, sha256: hash, decoded: { sampleRate: 48000, sampleFrames: 48000, pcmSha256: hash } }]))
  const subjects = [
    { kind: 'move', id: 'animated', phase: 'attack', fxId: 'animated', durationSeconds: 2, visualRevision: 'visual-1', assetIds: ['animated'] },
    { kind: 'move', id: 'audioonly', phase: 'attack', fxId: null, durationSeconds: null, visualRevision: 'audio-1', assetIds: ['audioonly'] },
    { kind: 'event', id: 'event', phase: 'attack', fxId: null, durationSeconds: null, visualRevision: 'event-1', assetIds: ['event'] },
  ]
  const manifest = { assets, subjects, provenance: { auditLockSha256: hash }, moves: { animated: { assetIds: ['animated'] }, audioonly: { assetIds: ['audioonly'] } }, events: { event: { assetIds: ['event'] } }, visualRevisions: Object.fromEntries(subjects.map(subject => [`${subject.kind}:${subject.id}:${subject.phase}`, subject.visualRevision])) }
  const records = subjects.map(subject => createReviewRecord({ asset: assets[subject.id], subject, visualRevision: subject.visualRevision, decoderReference: manifest.provenance }))
  return { manifest, records }
}

test('collection allows audio-only drafts without weakening animated duration validation', () => {
  const { manifest, records } = fixture()
  for (const record of records) assert.equal(validateCollectionRecord(record, manifest).valid, true)
  records[0].segments[0].visualAnchorSeconds = 2.001
  assert.match(validateCollectionRecord(records[0], manifest).errors.join(' '), /exceeds the animation duration/)
  assert.throws(() => exportCollectionBundle(records, manifest), /exceeds the animation duration/)
})

test('collection checks each imported record after generic bundle validation', () => {
  const { manifest, records } = fixture()
  const valid = exportCollectionBundle(records, manifest)
  assert.equal(importCollectionBundle(valid, manifest).length, 3)
  const tampered = JSON.parse(valid)
  tampered.records[0].segments[0].visualAnchorSeconds = 5
  assert.throws(() => importCollectionBundle(JSON.stringify(tampered), manifest), /exceeds the animation duration/)
})

test('batch membership prevents importing or saving records from another batch', () => {
  const { manifest, records } = fixture()
  const keys = new Set([collectionRecordKey(records[0])])
  assert.equal(importCollectionBundle(exportCollectionBundle([records[0]], manifest, keys), manifest, keys).length, 1)
  assert.throws(() => exportCollectionBundle(records, manifest, keys), /different batch/)
  assert.throws(() => importCollectionBundle(exportCollectionBundle(records, manifest), manifest, keys), /different batch/)
})

test('source, visual and collection membership changes invalidate stored reviews', () => {
  const { manifest, records } = fixture()
  const bundle = exportCollectionBundle(records, manifest)
  manifest.assets.animated.sha256 = 'b'.repeat(64)
  assert.throws(() => importCollectionBundle(bundle, manifest), /stale/)
  manifest.assets.animated.sha256 = hash
  manifest.visualRevisions['move:animated:attack'] = 'visual-2'
  assert.throws(() => importCollectionBundle(bundle, manifest), /stale/)
  manifest.visualRevisions['move:animated:attack'] = 'visual-1'
  manifest.subjects = manifest.subjects.filter(subject => subject.id !== 'audioonly')
  assert.throws(() => importCollectionBundle(bundle, manifest), /absent from the current collection/)
})

test('collection cannot turn audio-only evidence into visual approval', () => {
  const { manifest, records } = fixture(), record = records[1]
  record.review = { reviewer: 'Test fixture', notes: 'Fixture only', near: true, far: true, native: { browser: 'Test', version: '1', sampleRate: 48000, sampleFrames: 48000, alignmentConfirmed: true, notes: 'Fixture measurement' } }
  const approved = approveReviewRecord(record, collectionContext(manifest, record))
  assert.match(validateCollectionRecord(approved, manifest).errors.join(' '), /Audio-only studies/)
  assert.throws(() => exportCollectionBundle([approved], manifest), /Audio-only studies/)
})

test('collection bundle serialization preserves draft evidence as empty and enforces 64 records', () => {
  const { manifest, records } = fixture()
  const [draft] = importCollectionBundle(exportCollectionBundle([records[0]], manifest), manifest)
  assert.equal(draft.status, 'draft')
  assert.equal(draft.review.near, false)
  assert.equal(draft.review.far, false)
  assert.equal(draft.review.native.alignmentConfirmed, false)
  assert.equal(draft.review.native.sampleFrames, null)
  assert.throws(() => exportCollectionBundle(Array(65).fill(records[0]), manifest), /at most 64/)
})

test('browser draft storage is isolated by batch and collection revision', () => {
  assert.notEqual(collectionStorageKey('batch-001', 'revision-a'), collectionStorageKey('batch-002', 'revision-a'))
  assert.notEqual(collectionStorageKey('batch-001', 'revision-a'), collectionStorageKey('batch-001', 'revision-b'))
  assert.ok(!collectionStorageKey('batch/001', 'revision:a').includes('batch/001'))
})

test('later-turn effects and Present healing cannot be paired with an attack animation', () => {
  const subject = { id: 'bind', fxId: 'bind' }
  assert.equal(canPairCollectionSubject(subject, { variant: { type: 'turn-effect', outcome: 'damage' } }), false)
  assert.equal(canPairCollectionSubject({ id: 'present', fxId: 'present' }, { variant: { type: 'outcome', outcome: 'heal' } }), false)
  assert.equal(canPairCollectionSubject(subject, { variant: { type: 'part', part: 1 } }), true)
  assert.equal(canPairCollectionSubject(subject, { variant: { type: 'whole' } }), true)
})
