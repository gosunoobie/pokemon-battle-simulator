import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { createBenchManifest, BENCH_ROOT } from './bench.mjs'
import { assert, atomicWrite, json, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { importReviewBundle, nativeRegionFrames } from '../../packages/battle-sfx/src/review.js'

const SELECTION = 'tools/audio-import/runtime-selection.json'
const REVIEWS = 'tools/audio-import/review/pilot-reviews.json'
const GENERATED = 'packages/battle-sfx/src/runtime.generated.js'
const REPORT = 'tools/audio-import/reports/sfx-runtime.json'
const POLICY = { mode: 'normal', outcome: 'hit', playbackRate: 1, tailPolicy: 'continue-until-region-end', unreviewed: 'silence' }
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function keys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) && equal(Object.keys(value).sort(), [...expected].sort())
}

/** Pure compilation after freshly verified audit, source and visual metadata are supplied. */
export function compileRuntime({ manifest, reviewText, selectionText }) {
  const context = {
    catalog: manifest, visualRevisions: manifest.visualRevisions,
    visualDurations: Object.fromEntries(manifest.subjects.filter(s => s.kind === 'move').map(s => [`move:${s.id}:${s.phase}`, s.durationSeconds])),
  }
  const bundle = importReviewBundle(reviewText, context)
  const selection = JSON.parse(selectionText)
  assert(keys(selection, ['schemaVersion', 'kind', 'reviewBundleSha256', 'policy', 'entries']) && selection.schemaVersion === 1 && selection.kind === 'battle-sfx-runtime-selection', 'Unsupported runtime selection schema')
  assert(selection.reviewBundleSha256 === sha256(Buffer.from(reviewText)), 'Runtime selection pins a different review bundle')
  assert(equal(selection.policy, POLICY), 'Runtime selection changes the approved Stage C playback policy')
  assert(Array.isArray(selection.entries) && selection.entries.length > 0 && selection.entries.length <= 12, 'Runtime selection must contain 1–12 reviewed move defaults')
  const assets = {}, moves = {}, fxMoves = {}, selected = [], alternatives = []
  for (const row of selection.entries) {
    assert(keys(row, ['moveId', 'phase', 'assetId']) && /^[a-z][a-z0-9]*$/.test(row.moveId) && row.phase === 'attack' && typeof row.assetId === 'string', 'Invalid runtime selection entry')
    assert(!Object.hasOwn(moves, row.moveId), `Duplicate runtime default: ${row.moveId}`)
    const record = bundle.records.find(r => r.subject.kind === 'move' && r.subject.id === row.moveId && r.subject.phase === row.phase && r.source.assetId === row.assetId)
    assert(record?.status === 'approved', `Runtime default lacks an approved review: ${row.moveId}/${row.assetId}`)
    const subject = manifest.subjects.find(s => s.kind === 'move' && s.id === row.moveId && s.phase === row.phase)
    assert(subject?.fxId && subject.assetIds.includes(row.assetId) && Number.isFinite(subject.durationSeconds), 'Selected visual/source relationship is unavailable')
    const asset = manifest.assets[row.assetId], native = record.review.native
    assert(native.browser === 'Chrome' && native.version === '152.0.0.0' && native.sampleRate === 48000, 'Native decoder profile needs separate Stage C integration review')
    // This release only promotes unchanged whole-recording pilots. Additional edits require an explicit compiler policy revision.
    assert(record.segments.length === 1, 'Stage C pilot expects one reviewed whole-recording region')
    const segment = record.segments[0]
    assert(equal(segment, { startFrame: 0, endFrame: record.source.sampleFrames, sourceAnchorFrame: 0, visualAnchorSeconds: 0, gainDb: 0, nativeOffsetSeconds: 0 }), 'Stage C pilot must preserve the reviewed whole recording, timing and gain')
    const region = nativeRegionFrames(segment, record.source.sampleRate, native.sampleRate)
    assert(region.startFrame >= 0 && region.endFrame > region.startFrame && region.endFrame <= native.sampleFrames, 'Reviewed native region exceeds the native buffer')
    const file = `${asset.sha256}.mp3`
    assets[asset.id] = { id: asset.id, file, bytes: asset.bytes, sha256: asset.sha256, mime: asset.mime, reference: { sampleRate: asset.decoded.sampleRate, sampleFrames: asset.decoded.sampleFrames, channels: asset.decoded.channels, peak: asset.decoded.peak } }
    moves[row.moveId] = {
      moveId: row.moveId, fxId: subject.fxId, phase: row.phase, assetId: asset.id,
      visualRevision: record.visualRevision, segments: record.segments,
      reference: { sampleRate: record.source.sampleRate, sampleFrames: record.source.sampleFrames },
      nativeCompatibility: { browser: native.browser, version: native.version, sampleRate: native.sampleRate, sampleFrames: native.sampleFrames },
      playbackRate: 1, visualDurationSeconds: subject.durationSeconds, tailPolicy: POLICY.tailPolicy,
    }
    assert(!Object.hasOwn(fxMoves, subject.fxId), `Duplicate reviewed FX identifier: ${subject.fxId}`)
    fxMoves[subject.fxId] = row.moveId
    selected.push({ moveId: row.moveId, phase: row.phase, assetId: asset.id, sourceFile: asset.file, sourceSha256: asset.sha256, sourcePcmSha256: record.source.pcmSha256, visualRevision: record.visualRevision, reviewFingerprintSha256: sha256(Buffer.from(record.approvalFingerprint)), assetBytes: asset.bytes })
  }
  for (const record of bundle.records.filter(r => r.status === 'approved')) {
    if (!selected.some(row => row.moveId === record.subject.id && row.phase === record.subject.phase && row.assetId === record.source.assetId)) alternatives.push({ subject: record.subject, assetId: record.source.assetId })
  }
  const provenance = { auditLockSha256: manifest.auditLockSha256, reviewBundleSha256: selection.reviewBundleSha256, selectionSha256: sha256(Buffer.from(selectionText)) }
  const catalog = { schemaVersion: 1, kind: 'battle-sfx-runtime', status: 'approved-subset', provenance, policy: POLICY, assets, moves, fxMoves }
  const generated = `// Generated by tools/audio-import/runtime.mjs. Do not edit.\nexport default ${JSON.stringify(catalog)}\n`
  const report = {
    schemaVersion: 1, stage: 'C', status: 'approved-subset', provenance,
    selectedMoveCount: selected.length, selectedAssetCount: Object.keys(assets).length,
    approvedReviewCount: bundle.records.filter(r => r.status === 'approved').length,
    approvedAlternativesNotScheduled: alternatives,
    encodedBytes: Object.values(assets).reduce((sum, row) => sum + row.bytes, 0),
    reviewedNativeDecodedBytes: Object.values(moves).reduce((sum, row) => sum + row.nativeCompatibility.sampleFrames * assets[row.assetId].reference.channels * 4, 0),
    decodedPeakMaximum: Math.max(...Object.values(assets).map(row => row.reference.peak)),
    runtimeModuleBytes: Buffer.byteLength(generated),
    runtimeModuleSha256: sha256(Buffer.from(generated)), selected,
    silence: ['unapproved moves and variants', 'prepare phase', 'reduced motion', 'instant presentation', 'miss', 'fail', 'immune', 'unreviewed native decoder profile'],
  }
  return { catalog, generated, report }
}

/** All validation precedes output writes. Check mode never writes or repairs files. */
export async function generateRuntime({ root = BENCH_ROOT, check = false } = {}) {
  const manifest = await createBenchManifest({ root })
  const [reviewBytes, selectionBytes] = await Promise.all([readLocal(root, REVIEWS), readLocal(root, SELECTION)])
  const result = compileRuntime({ manifest, reviewText: reviewBytes.toString(), selectionText: selectionBytes.toString() })
  const outputs = [{ path: GENERATED, bytes: Buffer.from(result.generated) }]
  for (const row of result.report.selected) {
    const bytes = await readLocal(root, `public/sound_effects/${row.sourceFile}`)
    assert(bytes.length === row.assetBytes && sha256(bytes) === row.sourceSha256, `Selected source changed during compilation: ${row.assetId}`)
    outputs.push({ path: `public/audio/sfx/${result.catalog.assets[row.assetId].file}`, bytes })
  }
  result.report.compiler = { path: 'tools/audio-import/runtime.mjs', sha256: sha256(await readFile(fileURLToPath(import.meta.url))) }
  result.report.outputs = outputs.map(row => ({ path: row.path, bytes: row.bytes.length, sha256: sha256(row.bytes) }))
  outputs.push({ path: REPORT, bytes: Buffer.from(json(result.report)) })
  if (check) {
    for (const row of outputs) {
      const existing = await readLocal(root, row.path, true)
      assert(existing && existing.equals(row.bytes), `Runtime output differs or is missing: ${row.path}`)
    }
  } else {
    for (const row of outputs) await atomicWrite(root, row.path, row.bytes)
  }
  return result.report
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2)
    assert(args.every(arg => arg === '--check') && args.length <= 1, 'Usage: node tools/audio-import/runtime.mjs [--check]')
    const report = await generateRuntime({ check: args.includes('--check') })
    console.log(`${args.includes('--check') ? 'Verified' : 'Generated'} ${report.selectedMoveCount} approved moves, ${report.selectedAssetCount} assets, ${report.encodedBytes} encoded bytes. ${report.approvedAlternativesNotScheduled.length} approved alternative remains unscheduled.`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
