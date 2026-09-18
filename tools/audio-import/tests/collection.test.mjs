import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BENCH_ROOT, createBenchManifest, createBenchService } from '../bench.mjs'
import { createCollectionManifest } from '../collection.mjs'
import { createCollectionService } from '../collection-service.mjs'
import { createBenchMiddleware } from '../bench-plugin.mjs'
import { EFFECT_TIMINGS, PHASE_TIMINGS, MOVE_EFFECTS } from '../../../packages/battle-fx/src/registry.js'
import { importReviewBundle } from '../../../packages/battle-sfx/src/review.js'

const key = subject => `${subject.kind}:${subject.id}:${subject.phase}`
let collectionPromise
const collection = () => collectionPromise ??= createCollectionManifest()
const context = manifest => ({
  catalog: manifest, visualRevisions: manifest.visualRevisions,
  visualDurations: Object.fromEntries(manifest.subjects.filter(subject => subject.fxId).map(subject => [key(subject), subject.durationSeconds])),
})

test('collection accounts for every audited source, move policy, animation and event without inventing coverage', async () => {
  const data = await collection()
  assert.deepEqual(data.summary, {
    assetCount: 530, movePolicyCount: 354, animatedMoveCount: 335,
    preparationCount: 4, noVisualMoveCount: 19, eventCount: 28,
  })
  assert.equal(data.status, 'technical-drafts-only')
  assert.equal(data.subjects.length, 386)
  assert.equal(new Set(data.subjects.map(key)).size, data.subjects.length)
  assert.equal(Object.keys(data.visualRevisions).length, data.subjects.length)
  const covered = new Set()
  for (const subject of data.subjects) {
    assert.equal(data.visualRevisions[key(subject)], subject.visualRevision, key(subject))
    assert.match(subject.visualRevision, /^[a-f0-9]{64}$/)
    const policy = (subject.kind === 'move' ? data.moves : data.events)[subject.id]
    assert.ok(policy, key(subject))
    assert.deepEqual(subject.assetIds, policy.assetIds)
    for (const id of subject.assetIds) {
      const asset = data.assets[id]
      assert.ok(asset, id)
      assert.equal(asset.reviewStatus, 'candidate', id)
      assert.equal(asset.url, `/sound_effects/${encodeURIComponent(asset.file)}`)
      covered.add(id)
    }
  }
  assert.equal(covered.size, 530)
})

test('collection preserves original pilot subjects and all eleven existing approval fingerprints', async () => {
  const [data, pilot] = await Promise.all([collection(), createBenchManifest()])
  for (const original of pilot.subjects) {
    assert.deepEqual(data.subjects.find(subject => key(subject) === key(original)), original, key(original))
    assert.equal(data.visualRevisions[key(original)], pilot.visualRevisions[key(original)])
  }
  const text = await readFile(join(BENCH_ROOT, 'tools/audio-import/review/pilot-reviews.json'), 'utf8')
  const original = importReviewBundle(text, context(pilot))
  const expanded = importReviewBundle(text, context(data))
  assert.deepEqual(expanded, original)
  assert.equal(expanded.records.filter(record => record.status === 'approved').length, 11)
})

test('every animated collection subject uses its actual phase timing and existing result/recovery markers', async () => {
  const data = await collection()
  const preparationIds = []
  let recoveries = 0
  for (const subject of data.subjects.filter(subject => subject.kind === 'move' && subject.fxId)) {
    const definition = MOVE_EFFECTS[subject.fxId]
    const timing = subject.phase === 'prepare' ? PHASE_TIMINGS[subject.fxId]?.prepare : EFFECT_TIMINGS[subject.fxId]
    assert.ok(definition && timing, key(subject))
    assert.equal(subject.durationSeconds, timing.duration, key(subject))
    const cue = subject.markers.find(marker => marker.id === (subject.phase === 'prepare' ? 'prepared' : 'impact'))
    assert.equal(cue?.kind, 'result')
    assert.equal(cue?.timeSeconds, timing.contact, key(subject))
    assert.equal(subject.visualSubject, subject.phase === 'prepare' ? 'source' : definition.subject ?? 'target')
    if (subject.phase === 'prepare') preparationIds.push(subject.id)
    const recovery = subject.markers.find(marker => marker.id === 'recovery')
    if (timing.recovery !== undefined) {
      assert.equal(recovery?.timeSeconds, timing.recovery, key(subject))
      recoveries++
    } else assert.equal(recovery, undefined, key(subject))
    for (const marker of subject.markers) assert.ok(marker.timeSeconds >= 0 && marker.timeSeconds <= timing.duration, key(subject))
  }
  assert.deepEqual(preparationIds.sort(), ['bounce', 'dig', 'dive', 'fly'])
  assert.equal(recoveries, 5)
})

test('missing visuals, missing sources and outcome variants remain explicitly distinguishable', async () => {
  const data = await collection()
  const noVisual = data.subjects.filter(subject => subject.kind === 'move' && !subject.fxId)
  assert.deepEqual(noVisual.map(subject => subject.id).sort(), [
    'acid', 'camouflage', 'conversion', 'conversion2', 'covet', 'growth', 'haze', 'heatwave', 'mist',
    'powdersnow', 'pursuit', 'shockwave', 'sludge', 'snatch', 'spore', 'stockpile', 'swallow', 'thief', 'waterspout',
  ])
  for (const subject of [...noVisual, ...data.subjects.filter(subject => subject.kind === 'event')]) {
    assert.equal(subject.fxId, null, key(subject))
    assert.equal(subject.durationSeconds, null, key(subject))
    assert.deepEqual(subject.markers, [], key(subject))
  }
  for (const id of ['mirrormove', 'naturepower']) {
    const subject = data.subjects.find(subject => subject.kind === 'move' && subject.id === id)
    assert.equal(subject.status, 'called-move')
    assert.ok(subject.fxId)
    assert.deepEqual(subject.assetIds, [])
  }
  const present = data.subjects.find(subject => subject.id === 'present')
  assert.ok(present.notes.some(note => /damage only/.test(note)))
  assert.equal(data.assets['source.present-heal'].variant.outcome, 'heal')
  assert.equal(data.assets['source.present-damage'].variant.outcome, 'damage')
  assert.equal(data.assets['source.future-sight-turn-damage'].variant.type, 'turn-effect')
  assert.equal(data.events['battle.release.pokeball'].status, 'deferred')
  assert.deepEqual(data.events['battle.release.pokeball'].assetIds, [])
})

test('collection reference accepts a non-pilot source while legacy scope remains unchanged and unknown assets fail closed', async () => {
  const service = createCollectionService(), data = await collection()
  const reference = await service.reference('source.water-gun')
  assert.deepEqual(reference.decoded, data.assets['source.water-gun'].decoded)
  assert.equal(reference.waveform.sampleFrames, reference.decoded.sampleFrames)
  assert.equal(reference.waveform.binCount, 512)
  assert.equal(reference.waveform.channels.length, 2)
  assert.ok(!('pcm' in reference) && !('channelData' in reference))
  await assert.rejects(createBenchService().reference('source.water-gun'), error => error.status === 404)
  for (const id of ['source.does-not-exist', '../../package.json', 'constructor']) {
    await assert.rejects(service.reference(id), error => error.status === 404, id)
  }
  await assert.rejects(service.reference('x'.repeat(129)), error => error.status === 400)
})

test('draft batch identifiers reject traversal and arbitrary paths before reading generated analysis', async () => {
  // An absent root makes an accidental filesystem read distinguishable from a
  // deliberate bad-ID response, without mutating any authoring evidence.
  const service = createCollectionService({ root: join(BENCH_ROOT, 'does-not-exist-collection-fixture') })
  for (const id of ['../../package.json', '../batch-001', 'batch-001.json', 'batch-1', 'batch-0001', 'batch-001/extra', '', null, {}]) {
    await assert.rejects(service.drafts(id), error => error.status === 400, String(id))
  }
})

async function request(middleware, url, { method = 'GET', origin } = {}) {
  const headers = {}, req = { url, method, headers: { host: 'localhost:5173', ...(origin ? { origin } : {}) } }
  let body, next = false
  const res = { statusCode: 0, setHeader(name, value) { headers[name] = value }, end(value) { body = JSON.parse(value) } }
  await middleware(req, res, () => { next = true })
  return { req, status: res.statusCode, headers, body, next }
}

test('collection middleware keeps route arguments constrained, same-origin, read-only and private to development', async () => {
  const calls = []
  const service = {
    manifest: async () => { calls.push(['manifest']); return { kind: 'collection' } },
    analysis: async () => { calls.push(['analysis']); return { kind: 'analysis' } },
    drafts: async id => { calls.push(['drafts', id]); return { id } },
    reference: async id => { calls.push(['reference', id]); return { id } },
  }
  const middleware = createBenchMiddleware(null, { collectionService: service })
  const routes = [
    ['/__sfx-bench/collection', { kind: 'collection' }],
    ['/__sfx-bench/analysis', { kind: 'analysis' }],
    ['/__sfx-bench/drafts?batch=batch-001', { id: 'batch-001' }],
    ['/__sfx-bench/collection-reference?assetId=source.water-gun', { id: 'source.water-gun' }],
  ]
  for (const [url, body] of routes) {
    const result = await request(middleware, url)
    assert.equal(result.status, 200, url)
    assert.deepEqual(result.body, body)
    assert.equal(result.headers['Cache-Control'], 'no-store')
    assert.equal(result.headers['X-Content-Type-Options'], 'nosniff')
  }
  assert.deepEqual(calls, [['manifest'], ['analysis'], ['drafts', 'batch-001'], ['reference', 'source.water-gun']])
  const before = calls.length
  for (const [url] of routes) {
    assert.equal((await request(middleware, url, { method: 'POST' })).status, 405, url)
    assert.equal((await request(middleware, url, { origin: 'https://foreign.example' })).status, 403, url)
    assert.equal((await request(createBenchMiddleware(null, { preview: true, collectionService: service }), url)).status, 404, url)
  }
  for (const url of [
    '/__sfx-bench/collection?extra=1', '/__sfx-bench/analysis?extra=1', '/__sfx-bench/drafts',
    '/__sfx-bench/drafts?batch=batch-001&batch=batch-002', '/__sfx-bench/drafts?path=../../package.json',
    '/__sfx-bench/collection-reference?assetId=source.tackle&assetId=source.protect',
    '/__sfx-bench/collection-reference?assetId=source.tackle&extra=1',
  ]) assert.equal((await request(middleware, url)).status, 404, url)
  assert.equal(calls.length, before)
})

test('stored analysis is current, covers all source hashes and claims no new native, listening or playback approvals', async () => {
  const service = createCollectionService(), data = await collection()
  const report = await service.analysis()
  assert.equal(report.status, 'drafts-only')
  assert.equal(report.provenance.collectionRevision, data.collectionRevision)
  assert.equal(report.measurements.length, 530)
  assert.equal(new Set(report.measurements.map(row => row.assetId)).size, 530)
  for (const measurement of report.measurements) {
    const asset = data.assets[measurement.assetId]
    assert.equal(measurement.sha256, asset.sha256, asset.id)
    assert.equal(measurement.pcmSha256, asset.decoded.pcmSha256, asset.id)
    assert.ok(measurement.suggestedGainDb <= 0, asset.id)
  }
  assert.equal(report.summary.approvedCandidateCount, 11)
  for (const field of ['nativeBrowserReviewsAdded', 'listeningApprovalsAdded', 'runtimeMappingsAdded']) assert.equal(report.summary[field], 0, field)
  assert.equal(report.batches.length, report.summary.batchCount)
})

test('every served draft batch stays bounded, source-valid, unmeasured and disjoint from the existing approved records', async () => {
  const service = createCollectionService(), data = await collection(), report = await service.analysis()
  const approved = importReviewBundle(await readFile(join(BENCH_ROOT, 'tools/audio-import/review/pilot-reviews.json'), 'utf8'), context(data))
  const recordKey = record => `${key(record.subject)}:${record.source.assetId}`
  const approvedKeys = new Set(approved.records.filter(record => record.status === 'approved').map(recordKey))
  const seen = new Set()
  for (const batch of report.batches) {
    assert.match(batch.id, /^batch-\d{3}$/)
    assert.equal(batch.path, `tools/audio-import/review/remaining/${batch.id}.json`)
    const value = await service.drafts(batch.id)
    assert.equal(value.records.length, batch.count)
    assert.ok(value.records.length > 0 && value.records.length <= 64)
    assert.ok(Buffer.byteLength(JSON.stringify(value)) <= 1024 * 1024)
    for (const record of value.records) {
      const id = recordKey(record)
      assert.ok(!seen.has(id) && !approvedKeys.has(id), id)
      seen.add(id)
      assert.equal(record.status, 'draft', id)
      assert.equal(record.approvalFingerprint, null, id)
      assert.equal(record.review.reviewer, '', id)
      assert.equal(record.review.near, false, id)
      assert.equal(record.review.far, false, id)
      assert.deepEqual(record.review.native, { browser: '', version: '', sampleRate: null, sampleFrames: null, alignmentConfirmed: false, notes: '' }, id)
      assert.equal(record.segments.length, 1, id)
      const segment = record.segments[0]
      assert.ok(segment.gainDb <= 0, id)
      assert.deepEqual({ ...segment, gainDb: 0 }, {
        startFrame: 0, endFrame: data.assets[record.source.assetId].decoded.sampleFrames,
        sourceAnchorFrame: 0, visualAnchorSeconds: 0, gainDb: 0, nativeOffsetSeconds: 0,
      }, id)
    }
  }
  assert.equal(seen.size, report.summary.draftCount)
  await assert.rejects(service.drafts('batch-999'), error => error.status === 404)
})
