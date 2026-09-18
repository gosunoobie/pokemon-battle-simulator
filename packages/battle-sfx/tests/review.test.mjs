import test from 'node:test'
import assert from 'node:assert/strict'
import { SFX_CATALOG } from '../src/index.js'
import {
  REVIEW_LIMITS, createReviewRecord, validateReviewRecord, nativeRegionFrames,
  approveReviewRecord, resetReviewRecord, exportReviewBundle, importReviewBundle,
} from '../src/review.js'

const context = {
  catalog: SFX_CATALOG,
  visualRevisions: { 'move:tackle:attack': 'tackle-sha-1', 'move:fly:attack': 'fly-sha-1', 'move:fly:prepare': 'fly-prepare-sha-1' },
}
const clone = value => JSON.parse(JSON.stringify(value))
function draft(move = 'tackle', phase = 'attack') {
  return createReviewRecord({
    asset: SFX_CATALOG.assets[SFX_CATALOG.moves[move].assetIds[0]],
    subject: { kind: 'move', id: move, phase },
    visualRevision: context.visualRevisions[`move:${move}:${phase}`],
    decoderReference: SFX_CATALOG.provenance,
  })
}
function evidence(record = draft()) {
  record.review = {
    reviewer: 'Example reviewer', notes: 'Test fixture only, not actual listening evidence.', near: true, far: true,
    native: { browser: 'Test fixture browser', version: '1', sampleRate: record.source.sampleRate, sampleFrames: record.source.sampleFrames, alignmentConfirmed: true, notes: 'Synthetic test fixture. No device certification.' },
  }
  return record
}
function invalid(record, pattern) {
  const result = validateReviewRecord(record, context)
  assert.equal(result.valid, false)
  if (pattern) assert.match(result.errors.join('; '), pattern)
}

test('creation preserves exact source coordinates and records no invented evidence', () => {
  const record = draft()
  assert.equal(validateReviewRecord(record, context).valid, true)
  assert.equal(record.status, 'draft')
  assert.equal(record.source.pcmSha256, SFX_CATALOG.assets['source.tackle'].decoded.pcmSha256)
  assert.equal(record.source.auditLockSha256, SFX_CATALOG.provenance.auditLockSha256)
  assert.equal(record.segments[0].endFrame, record.source.sampleFrames)
  assert.equal(record.segments[0].gainDb, 0)
  assert.deepEqual([record.review.near, record.review.far, record.review.native.alignmentConfirmed], [false, false, false])
  assert.equal(record.review.native.sampleRate, null)
  assert.equal(record.approvalFingerprint, null)
})

test('source hash, PCM coordinates, pack pin and visual revision must remain current', () => {
  for (const [key, value] of [['sha256', '0'.repeat(64)], ['pcmSha256', '0'.repeat(64)], ['sampleRate', 48000], ['sampleFrames', 5], ['auditLockSha256', '0'.repeat(64)]]) {
    const record = draft()
    record.source[key] = value
    invalid(record, /stale/)
  }
  const record = draft()
  record.visualRevision = 'outdated-recipe'
  invalid(record, /visualRevision/)
})

test('subject, phase and asset policy are explicit', () => {
  const unknown = draft(); unknown.subject.id = 'madeup'; invalid(unknown, /no catalog policy/)
  const wrongMove = draft(); wrongMove.subject.id = 'protect'; invalid(wrongMove, /not a candidate/)
  const wrongAsset = draft(); wrongAsset.source.assetId = 'madeup'; invalid(wrongAsset, /unknown/)
  const wrongPhase = draft(); wrongPhase.subject.phase = 'prepare'; invalid(wrongPhase, /unsupported for this phase/)
  assert.equal(validateReviewRecord(draft('fly', 'prepare'), context).valid, true)
  assert.equal(validateReviewRecord(draft('fly'), context).valid, true)
  const mismatch = draft('fly'); mismatch.visualRevision = context.visualRevisions['move:fly:prepare']; invalid(mismatch, /stale/)
})

test('regions use bounded integer reference frames and independent chronological anchors', () => {
  for (const mutation of [
    record => { record.segments = [] },
    record => { record.segments = Array.from({ length: 9 }, () => ({ ...record.segments[0] })) },
    record => { record.segments[0].startFrame = -1 },
    record => { record.segments[0].endFrame += 1 },
    record => { record.segments[0].startFrame = 0.5 },
    record => { record.segments[0].sourceAnchorFrame = record.segments[0].endFrame },
    record => { record.segments[0].endFrame = 0 },
    record => { record.segments[0].gainDb = Infinity },
    record => { record.segments[0].gainDb = NaN },
    record => { record.segments[0].gainDb = 7 },
    record => { record.segments[0].nativeOffsetSeconds = -0.2 },
    record => { record.segments[0].visualAnchorSeconds = -1 },
  ]) { const record = draft(); mutation(record); invalid(record) }
  const record = draft()
  record.segments[0].sourceAnchorFrame = 1
  invalid(record, /before the visual timeline/)
  record.segments[0].visualAnchorSeconds = 1
  assert.equal(validateReviewRecord(record, context).valid, true)
  record.segments.push({ ...record.segments[0], visualAnchorSeconds: 2 })
  assert.equal(validateReviewRecord(record, context).valid, true)
})

test('native measurements use actual sample rate and region offset must fit that buffer', () => {
  const record = evidence()
  record.review.native.sampleRate = 48000
  record.review.native.sampleFrames = Math.ceil(record.source.sampleFrames / record.source.sampleRate * 48000)
  assert.equal(validateReviewRecord(record, context).valid, true)
  record.segments[0].nativeOffsetSeconds = 0.1
  invalid(record, /outside the measured native/)
  record.segments[0].nativeOffsetSeconds = -0.1
  invalid(record, /outside the measured native/)
  record.segments[0].startFrame = Math.ceil(0.1 * record.source.sampleRate)
  record.segments[0].sourceAnchorFrame = record.segments[0].startFrame
  assert.equal(validateReviewRecord(record, context).valid, true)
  record.review.native.sampleFrames = null
  invalid(record, /supplied together/)
})

test('real 44.1-to-48 kHz decodes use inward native frames without hiding full-frame overruns', () => {
  const record = evidence()
  assert.equal(record.source.sampleRate, 44100)
  assert.equal(record.source.sampleFrames, 24758)
  record.review.native.sampleRate = 48000
  record.review.native.sampleFrames = 26947
  const exactReferenceEnd = record.source.sampleFrames / record.source.sampleRate * 48000
  assert.ok(exactReferenceEnd > 26947 && exactReferenceEnd < 26947.5)
  assert.equal(validateReviewRecord(record, context).valid, true)
  assert.equal(validateReviewRecord(approveReviewRecord(record, context), context).valid, true)
  const lessThanOneFrame = clone(record)
  lessThanOneFrame.segments[0].nativeOffsetSeconds = (26947.99 - exactReferenceEnd) / 48000
  assert.equal(validateReviewRecord(lessThanOneFrame, context).valid, true)
  const moreThanOneFrame = clone(record)
  moreThanOneFrame.segments[0].nativeOffsetSeconds = (26948.01 - exactReferenceEnd) / 48000
  invalid(moreThanOneFrame, /outside the measured native/)
  const negativeStart = clone(record)
  negativeStart.segments[0].nativeOffsetSeconds = -1.01 / 48000
  invalid(negativeStart, /outside the measured native/)
  const roundedStart = clone(record)
  roundedStart.segments[0].nativeOffsetSeconds = -0.99 / 48000
  assert.equal(validateReviewRecord(roundedStart, context).valid, true)
  const subNativeFrame = clone(record)
  subNativeFrame.review.native.sampleRate = 8000
  subNativeFrame.review.native.sampleFrames = Math.round(record.source.sampleFrames / record.source.sampleRate * 8000)
  subNativeFrame.segments[0].endFrame = 1
  invalid(subNativeFrame, /no playable frames/)

  const doubleKickContext = { ...context, visualRevisions: { 'move:doublekick:attack': 'double-kick-fixture' } }
  const doubleKick = createReviewRecord({ asset: SFX_CATALOG.assets['source.double-kick-1hit'], subject: { kind: 'move', id: 'doublekick', phase: 'attack' }, visualRevision: 'double-kick-fixture', decoderReference: SFX_CATALOG.provenance })
  assert.equal(doubleKick.source.sampleFrames, 23933)
  Object.assign(doubleKick.review.native, { sampleRate: 48000, sampleFrames: 26049 })
  assert.equal(validateReviewRecord(doubleKick, doubleKickContext).valid, true)
  assert.deepEqual(nativeRegionFrames(doubleKick.segments[0], 44100, 48000), { startFrame: 0, endFrame: 26049 })
})

test('shared native-coordinate conversion rounds inward without clamping or shifting alignment', () => {
  assert.deepEqual(nativeRegionFrames({ startFrame: 1, endFrame: 100, nativeOffsetSeconds: 0 }, 44100, 48000), { startFrame: 2, endFrame: 108 })
  assert.deepEqual(nativeRegionFrames({ startFrame: 441, endFrame: 882, nativeOffsetSeconds: 0 }, 44100, 48000), { startFrame: 480, endFrame: 960 })
  assert.deepEqual(nativeRegionFrames({ startFrame: 0, endFrame: 4410, nativeOffsetSeconds: -1 }, 44100, 48000), { startFrame: -48000, endFrame: -43200 }, 'Conversion does not clamp negative offsets to zero')
  assert.throws(() => nativeRegionFrames({ startFrame: 0, endFrame: 100, nativeOffsetSeconds: 0 }, 0, 48000), /positive sample rates/)
  assert.throws(() => nativeRegionFrames({ startFrame: NaN, endFrame: 100, nativeOffsetSeconds: 0 }, 44100, 48000), /finite/)
})

test('supplied visual durations bound move anchors and cannot silently omit a phase', () => {
  const bounded = { ...context, visualDurations: { 'move:tackle:attack': 1.2, 'move:fly:prepare': 1.4 } }
  const record = evidence()
  record.segments[0].visualAnchorSeconds = 1.2
  assert.equal(validateReviewRecord(record, bounded).valid, true)
  assert.equal(validateReviewRecord(approveReviewRecord(record, bounded), bounded).valid, true)
  record.segments[0].visualAnchorSeconds = 1.2001
  assert.match(validateReviewRecord(record, bounded).errors.join('; '), /exceeds the animation duration/)
  assert.throws(() => approveReviewRecord(record, bounded), /exceeds the animation duration/)
  for (const duration of [undefined, null, NaN, Infinity, 0, -1, '1.2', 121]) {
    const metadata = { ...context, visualDurations: { 'move:tackle:attack': duration } }
    assert.match(validateReviewRecord(draft(), metadata).errors.join('; '), /valid visual duration/)
    assert.throws(() => approveReviewRecord(evidence(), metadata), /valid visual duration/)
  }
  assert.equal(validateReviewRecord(draft('fly', 'prepare'), bounded).valid, true)
  assert.match(validateReviewRecord(draft('fly', 'attack'), bounded).errors.join('; '), /valid visual duration/)
  const policy = Object.values(SFX_CATALOG.events).find(event => event.assetIds.length)
  const eventRecord = createReviewRecord({ asset: SFX_CATALOG.assets[policy.assetIds[0]], subject: { kind: 'event', id: policy.id, phase: 'attack' }, visualRevision: 'audio-only-v1', decoderReference: SFX_CATALOG.provenance })
  const audioOnly = { ...bounded, visualRevisions: { [`event:${policy.id}:attack`]: 'audio-only-v1' } }
  assert.equal(validateReviewRecord(eventRecord, audioOnly).valid, true, 'Audio-only events must not fabricate animation duration')
})

test('approval requires real reviewer assertions rather than successful decode alone', () => {
  assert.throws(() => approveReviewRecord(draft(), context), /reviewer.*both near and far.*native decoding/)
  for (const mutation of [
    record => { record.review.reviewer = '' },
    record => { record.review.notes = '' },
    record => { record.review.near = false },
    record => { record.review.far = false },
    record => { record.review.native.browser = '' },
    record => { record.review.native.version = '' },
    record => { record.review.native.sampleRate = null; record.review.native.sampleFrames = null },
    record => { record.review.native.alignmentConfirmed = false },
    record => { record.review.native.notes = '' },
  ]) { const record = evidence(); mutation(record); assert.throws(() => approveReviewRecord(record, context)) }
})

test('every reviewed setting and evidence change invalidates approval', () => {
  const original = evidence()
  const approved = approveReviewRecord(original, context)
  assert.equal(original.status, 'draft', 'approval must not mutate its input')
  assert.equal(validateReviewRecord(approved, context).valid, true)
  for (const mutation of [
    record => { record.segments[0].gainDb = -1 },
    record => { record.segments[0].startFrame = 1; record.segments[0].sourceAnchorFrame = 1 },
    record => { record.segments[0].visualAnchorSeconds = 0.1 },
    record => { record.review.notes += ' Changed after signoff.' },
    record => { record.review.native.notes += ' Changed after signoff.' },
    record => { record.review.reviewer = 'Another reviewer' },
  ]) { const edited = clone(approved); mutation(edited); invalid(edited, /Approval is stale/) }
  const reset = resetReviewRecord(approved)
  assert.equal(reset.status, 'draft')
  assert.equal(reset.approvalFingerprint, null)
  assert.equal(reset.review.reviewer, original.review.reviewer)
  assert.equal(reset.review.notes, original.review.notes)
  assert.deepEqual([reset.review.near, reset.review.far, reset.review.native.alignmentConfirmed], [false, false, false])
  assert.equal(validateReviewRecord(reset, context).valid, true)
})

test('reset after each editorial field change preserves edits and clears all listening claims', () => {
  const initial = evidence()
  initial.segments[0] = { startFrame: 1000, endFrame: initial.source.sampleFrames - 1000, sourceAnchorFrame: 1000, visualAnchorSeconds: 1, gainDb: -2, nativeOffsetSeconds: 0 }
  const approved = approveReviewRecord(initial, context)
  for (const [key, value] of Object.entries({ startFrame: 900, endFrame: initial.source.sampleFrames - 900, sourceAnchorFrame: 1001, visualAnchorSeconds: 1.1, gainDb: -3, nativeOffsetSeconds: 0.001 })) {
    const edited = clone(approved)
    edited.segments[0][key] = value
    invalid(edited, /Approval is stale/)
    const reset = resetReviewRecord(edited)
    assert.equal(reset.segments[0][key], value)
    assert.equal(reset.status, 'draft')
    assert.equal(reset.approvalFingerprint, null)
    assert.deepEqual([reset.review.near, reset.review.far, reset.review.native.alignmentConfirmed], [false, false, false])
    assert.equal(reset.review.native.sampleFrames, initial.review.native.sampleFrames)
    assert.equal(reset.review.native.notes, initial.review.native.notes)
    assert.equal(validateReviewRecord(reset, context).valid, true)
  }
  assert.equal(approved.status, 'approved', 'Reset must never change the stored signed record')
  assert.equal(approved.review.near, true)
})

test('bundle import is strict, bounded, deterministic and independent of property order', () => {
  const approved = approveReviewRecord(evidence(), context)
  const records = [approved, draft('fly', 'prepare')]
  const text = exportReviewBundle(records, context)
  const bundle = importReviewBundle(text, context)
  assert.deepEqual(bundle.records, records)
  assert.equal(exportReviewBundle(bundle.records, context), text)
  const reordered = Object.fromEntries(Object.entries(approved).reverse())
  assert.equal(validateReviewRecord(reordered, context).valid, true)
  assert.throws(() => exportReviewBundle([draft(), draft()], context), /duplicate/)
  assert.throws(() => importReviewBundle('x', context), /valid JSON/)
  assert.throws(() => importReviewBundle(' '.repeat(REVIEW_LIMITS.jsonCharacters + 1), context), /bounded/)
  assert.throws(() => exportReviewBundle(Array.from({ length: 65 }, draft), context), /at most 64/)
  const stale = JSON.parse(text); stale.auditLockSha256 = '0'.repeat(64)
  assert.throws(() => importReviewBundle(JSON.stringify(stale), context), /stale/)
  const tampered = JSON.parse(text); tampered.records[0].segments[0].gainDb = -6
  assert.throws(() => importReviewBundle(JSON.stringify(tampered), context), /Approval is stale/)
})

test('import and export apply the same 1 MiB UTF-8 limit to multibyte notes', () => {
  const record = draft()
  record.review.notes = '界'.repeat(4000)
  record.review.native.notes = '😀'.repeat(2000)
  const text = exportReviewBundle([record], context)
  const remainingBytes = REVIEW_LIMITS.jsonBytes - Buffer.byteLength(text, 'utf8')
  const exactlyAtLimit = text + ' '.repeat(remainingBytes)
  assert.equal(Buffer.byteLength(exactlyAtLimit, 'utf8'), REVIEW_LIMITS.jsonBytes)
  assert.ok(exactlyAtLimit.length < REVIEW_LIMITS.jsonCharacters)
  assert.equal(importReviewBundle(exactlyAtLimit, context).records[0].review.notes, record.review.notes)
  assert.ok((exactlyAtLimit + ' ').length < REVIEW_LIMITS.jsonCharacters)
  assert.throws(() => importReviewBundle(exactlyAtLimit + ' ', context), /1 MiB UTF-8/)

  const largeContext = { catalog: SFX_CATALOG, visualRevisions: {} }
  const records = Object.values(SFX_CATALOG.assets).filter(asset => asset.kind === 'move').slice(0, 64).map(asset => {
    const subject = { kind: 'move', id: asset.moveId, phase: 'attack' }
    largeContext.visualRevisions[`move:${asset.moveId}:attack`] = 'synthetic-size-test'
    const candidate = createReviewRecord({ asset, subject, visualRevision: 'synthetic-size-test', decoderReference: SFX_CATALOG.provenance })
    candidate.review.notes = 'a'.repeat(4000)
    candidate.review.native.notes = 'a'.repeat(4000)
    return candidate
  })
  const ascii = exportReviewBundle(records, largeContext)
  assert.ok(Buffer.byteLength(ascii, 'utf8') < REVIEW_LIMITS.jsonBytes)
  for (const candidate of records) {
    candidate.review.notes = '界'.repeat(4000)
    candidate.review.native.notes = '界'.repeat(4000)
  }
  assert.throws(() => exportReviewBundle(records, largeContext), /1 MiB UTF-8/)
})

test('unknown keys and prototype pollution payloads are rejected at every schema layer', () => {
  for (const selector of [record => record, record => record.subject, record => record.source, record => record.segments[0], record => record.review, record => record.review.native]) {
    const record = draft()
    selector(record).invented = 'no'
    invalid(record, /not allowed/)
  }
  const text = exportReviewBundle([draft()], context)
  const malicious = JSON.parse(text)
  malicious.records[0].subject = JSON.parse('{"kind":"move","id":"tackle","phase":"attack","__proto__":{"polluted":true}}')
  assert.throws(() => importReviewBundle(JSON.stringify(malicious), context), /not allowed/)
  assert.equal({}.polluted, undefined)
  const extra = JSON.parse(text); extra.runtimeAuthorization = true
  assert.throws(() => importReviewBundle(JSON.stringify(extra), context), /not allowed/)
})

test('malformed types fail validation without leaking exceptions or coercing evidence', () => {
  for (const mutation of [
    record => { record.subject.id = { toString: 'not callable' } },
    record => { record.source.assetId = { toString: 'not callable' } },
    record => { record.review.reviewer = 4; record.status = 'approved' },
    record => { record.review.native = null; record.status = 'approved' },
    record => { record.segments[0] = null },
    record => { record.segments[0].endFrame = { toString: 'not callable' } },
    record => { record.segments[0].nativeOffsetSeconds = { toString: 'not callable' } },
    record => { record.review.near = 'true' },
    record => { record.source = [] },
    record => { record.review = null },
  ]) { const record = draft(); mutation(record); assert.doesNotThrow(() => invalid(record)) }
  assert.equal(validateReviewRecord(null, context).valid, false)
})
