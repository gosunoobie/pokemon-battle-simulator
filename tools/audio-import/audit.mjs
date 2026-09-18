import { readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkAudio } from './import.mjs'
import { inspectMp3, sha256, stripId3v2 } from './mp3.mjs'
import { decodeSound, inspectDecoderIdentity } from './decode.mjs'
import { buildMappings } from './sfx-mappings.mjs'
import { assert, assertLocal, atomicWrite, json, readLocal } from './audit-io.mjs'

export const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const AUDIT_LOCK = 'tools/audio-import/audit-lock.json'
export const INPUT_PATHS = Object.freeze([
  'tools/audio-import/source-lock.json', 'public/sound_effects/manifest.json', 'tools/audio-import/reports/optimization.json',
  'packages/game-data/data/gen3.json', 'packages/battle-fx/src/catalog.js',
  'tools/audio-import/mapping-policy.json', 'tools/audio-import/package.json', 'tools/audio-import/package-lock.json',
  'tools/audio-import/decode.mjs', 'tools/audio-import/sfx-mappings.mjs',
  'tools/audio-import/mp3.mjs', 'tools/audio-import/import.mjs',
  'tools/audio-import/audit.mjs', 'tools/audio-import/audit-io.mjs',
])
export const OUTPUT_PATHS = Object.freeze([
  'packages/battle-sfx/data/catalog.json', 'packages/battle-sfx/src/catalog.generated.js',
  'tools/audio-import/reports/decoded.json', 'tools/audio-import/reports/sfx-coverage.json',
  'tools/audio-import/reports/sfx-discrepancies.json', 'tools/audio-import/reports/sfx-audit.md',
  'tools/audio-import/reports/sfx-generation.json',
])

const round = value => Number(value.toFixed(6))
const groups = (rows, key) => {
  const grouped = new Map()
  for (const row of rows) { const id = key(row); if (!grouped.has(id)) grouped.set(id, []); grouped.get(id).push(row.file) }
  return [...grouped.entries()].filter(([, files]) => files.length > 1).map(([hash, files]) => ({ hash, files }))
}
const countsBy = (rows, key) => rows.reduce((counts, row) => { const value = key(row); counts[value] = (counts[value] ?? 0) + 1; return counts }, {})

export function createArtifacts({ lock, source, mappings, files }) {
  const assets = {}, byFile = new Map(files.map(row => [row.file, row]))
  for (const entry of mappings.assets) {
    const file = byFile.get(entry.file)
    assert(file, `Missing decoded asset: ${entry.file}`)
    assets[entry.id] = { ...entry, bytes: file.bytes, sha256: file.sha256, mime: 'audio/mpeg',
      sourceSha256: file.originalSha256, decoded: file.decoded,
      annotations: { status: 'not-authored', regions: [], gainDb: null, visualRevision: null, nativeBrowserReview: 'not-performed' } }
  }
  const provenance = { source: source.source, sourceLockSha256: lock.inputs.find(pin => pin.path.endsWith('/source-lock.json')).sha256,
    auditLockSha256: sha256(json(lock)), decoder: lock.decoder, transform: 'none-stage-a',
    sourcePreparation: source.transform, reviewedPlaybackMappings: 0 }
  const catalog = { schemaVersion: 1, stage: 'A', generation: 3, packId: 'gen3-sfx-candidates-v1',
    provenance, assets, moves: mappings.moves, events: mappings.events }
  const duplicates = {
    files: groups(files, row => row.sha256), mpegPayloads: groups(files, row => row.mpegPayloadSha256),
    decodedPcm: groups(files, row => `${row.decoded.sampleRate}:${row.decoded.channels}:${row.decoded.sampleFrames}:${row.decoded.pcmSha256}`),
    perceptualComparison: 'not-performed',
  }
  const coverage = { schemaVersion: 1, stage: 'A',
    counts: { files: files.length, decoded: files.length, moves: Object.keys(mappings.moves).length,
      movesWithCandidates: Object.values(mappings.moves).filter(row => row.assetIds.length).length,
      movesWithFx: Object.values(mappings.moves).filter(row => row.fxId).length, approvedPlaybackMappings: 0,
      eventsWithCandidates: Object.values(mappings.events).filter(row => row.assetIds.length).length },
    assetCategories: countsBy(mappings.assets, row => row.variant.type),
    moveStatuses: countsBy(Object.values(mappings.moves), row => row.status),
    eventStatuses: countsBy(Object.values(mappings.events), row => row.status),
    movesWithoutNamedAssets: Object.values(mappings.moves).filter(row => !row.assetIds.length).map(row => row.id),
    movesWithoutFx: Object.values(mappings.moves).filter(row => !row.fxId).map(row => row.id),
    moves: mappings.moves, events: mappings.events,
    interpretation: 'Candidate coverage is filename evidence only. No cue region, gain or playback mapping is approved by Stage A.' }
  const issues = [...mappings.discrepancies,
    { code: 'all-mappings-await-listening', severity: 'review', subject: 'collection', message: 'All candidate mappings require listening, region annotation and visual synchronization review.' },
    { code: 'source-rights-unverified', severity: 'review', subject: 'collection', message: 'Preserve the supplied provenance; no redistribution authorization is established by this audit.' },
    { code: 'durable-original-archive-unverified', severity: 'review', subject: 'collection', message: 'The ignored original cache is not a durable cross-device backup. Original hashes remain in the source lock.' },
    { code: 'native-browser-alignment-unverified', severity: 'review', subject: 'collection', message: 'The pinned decoder is a reference only. Native MP3 onset/region alignment requires Stage B browser measurements.' },
    { code: 'true-peak-and-loudness-not-measured', severity: 'info', subject: 'collection', message: 'Sample peak/RMS are measured. Oversampled true peak and integrated loudness are not measured by this decoder pipeline.' },
  ]
  for (const file of files) for (const warning of file.decoded.warnings ?? []) issues.push({ code: 'decoded-audio-warning', severity: 'review', subject: file.file, message: warning })
  for (const duplicate of duplicates.decodedPcm) issues.push({ code: 'identical-reference-pcm', severity: 'info', subject: duplicate.files.join('; '), message: 'Exact matching reference PCM; assets remain separate until editorial review.' })
  const discrepancies = { schemaVersion: 1, stage: 'A', approvedPlaybackMappings: 0, issues }
  const report = { schemaVersion: 1, stage: 'A', provenance, inputs: lock.inputs,
    referenceCoordinates: 'Zero is the first sample returned by the pinned gapless-enabled decoder. No resampling, trimming, gain or channel conversion is applied. Future regions must name this reference; native browser alignment is unverified.',
    totals: { files: files.length, encodedBytes: files.reduce((n, row) => n + row.bytes, 0),
      decodedBytes: files.reduce((n, row) => n + row.decoded.decodedBytes, 0),
      durationSeconds: round(files.reduce((n, row) => n + row.decoded.durationSeconds, 0)),
      minimumDurationSeconds: Math.min(...files.map(row => row.decoded.durationSeconds)),
      maximumDurationSeconds: Math.max(...files.map(row => row.decoded.durationSeconds)),
      maximumSamplePeak: Math.max(...files.map(row => row.decoded.peak)),
      filesAboveFullScale: files.filter(row => row.decoded.samplesAboveFullScale > 0).length,
      belowQuietThreshold: files.filter(row => row.decoded.allBelowThreshold).length },
    duplicates, files }
  const markdown = `# Stage A battle SFX audit\n\n` +
    `**${files.length} files decoded; ${coverage.counts.moves} moves accounted for; zero approved playback mappings.** No recordings or battle playback were changed.\n\n` +
    `| Measurement | Result |\n| --- | ---: |\n| Encoded bytes | ${report.totals.encodedBytes} |\n| Reference PCM bytes | ${report.totals.decodedBytes} |\n| Total decoded seconds | ${report.totals.durationSeconds} |\n| Duration range, seconds | ${report.totals.minimumDurationSeconds}–${report.totals.maximumDurationSeconds} |\n| Files with samples above full scale | ${report.totals.filesAboveFullScale} |\n| Maximum sample peak | ${report.totals.maximumSamplePeak} |\n| Moves with filename candidates | ${coverage.counts.movesWithCandidates}/${coverage.counts.moves} |\n| Moves with FX | ${coverage.counts.movesWithFx}/${coverage.counts.moves} |\n| Exact decoded PCM duplicate groups | ${duplicates.decodedPcm.length} |\n\n` +
    `Decoder: ${lock.decoder.name} ${lock.decoder.version}. Its package integrity and installed implementation hashes are pinned in [audit-lock.json](../audit-lock.json). Metrics use decoded Float32 PCM at the source sample rate, not encoded frame duration. Samples above full scale are warnings, not proof that the original source was clipped. Sample peak is not oversampled true peak.\n\n` +
    `Missing named assets: **${coverage.movesWithoutNamedAssets.join(', ')}**. Called-move policies remain explicit; there is no inferred recording or client battle-rule implementation.\n\n` +
    `No FX recipe: ${coverage.movesWithoutFx.join(', ')}. Audio candidate coverage is independent of FX availability.\n\n` +
    `All mappings are candidates or explicit unresolved policies. Regions, gain, audible cue identity, source vintage/rights, perceptual duplication and browser alignment remain unapproved. Quiet boundaries use a fixed -60 dBFS sample threshold; they are not perceptual onset annotations.\n\n` +
    `See [full decoded measurements](decoded.json), [coverage](sfx-coverage.json), [discrepancies](sfx-discrepancies.json), and [generation receipt](sfx-generation.json). Stage B must audition sounds against animations before any move playback is enabled.\n`
  const outputs = new Map([
    [OUTPUT_PATHS[0], json(catalog)], [OUTPUT_PATHS[1], `// Generated by tools/audio-import/audit.mjs. Do not edit.\nexport default ${JSON.stringify(catalog)}\n`],
    [OUTPUT_PATHS[2], json(report)], [OUTPUT_PATHS[3], json(coverage)], [OUTPUT_PATHS[4], json(discrepancies)], [OUTPUT_PATHS[5], markdown],
  ])
  outputs.set(OUTPUT_PATHS[6], json({ schemaVersion: 1, auditLockSha256: sha256(json(lock)),
    outputs: [...outputs].map(([path, bytes]) => ({ path, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) })) }))
  return { outputs, catalog, report, coverage, discrepancies }
}

export async function generateSfxAudit({ root = repository, check = false, initialize = false, onProgress = () => {} } = {}) {
  assert(!(check && initialize), 'Cannot initialize in check mode')
  for (const path of [...INPUT_PATHS, ...OUTPUT_PATHS, AUDIT_LOCK]) await assertLocal(root, path)
  const inputBytes = new Map(await Promise.all(INPUT_PATHS.map(async path => [path, await readLocal(root, path)])))
  const source = JSON.parse(inputBytes.get('tools/audio-import/source-lock.json'))
  assert(Array.isArray(source.files) && source.files.every(row => /^[A-Za-z0-9][A-Za-z0-9 ()'-]*\.mp3$/.test(row.file)), 'Invalid locked source filenames')
  const moves = JSON.parse(inputBytes.get('packages/game-data/data/gen3.json')).moves
  const policy = JSON.parse(inputBytes.get('tools/audio-import/mapping-policy.json'))
  for (const row of source.files) await readLocal(root, `public/sound_effects/${row.file}`)
  await checkAudio({ root })
  const decoder = await inspectDecoderIdentity()
  const lock = { schemaVersion: 1, stage: 'A', decoder, inputs: [...inputBytes].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) }
  const prior = await readLocal(root, AUDIT_LOCK, true)
  if (initialize) {
    assert(!prior, 'SFX audit lock exists; initialization cannot overwrite it')
    for (const path of OUTPUT_PATHS) assert(!await readLocal(root, path, true), 'Initialization requires absent generated SFX outputs')
  } else {
    assert(prior, 'Missing SFX audit lock; initialize once with --init after source review')
    assert(prior.toString() === json(lock), 'SFX audit inputs or decoder differ from lock; review before updating any pin')
  }
  // The reviewed repository catalog is a self-contained ES module (hex literals
  // and Object.freeze), not JSON. Evaluate exactly the captured, pinned bytes.
  const { FX_CATALOG: fxCatalog } = await import(`data:text/javascript;base64,${inputBytes.get('packages/battle-fx/src/catalog.js').toString('base64')}`)
  assert(source.files.length === 530 && moves.length === 354 && fxCatalog.length === 335, 'Gen 3 Stage A inventory scope changed; explicit review required')
  const mappings = buildMappings({ files: source.files, moves, fxCatalog, policy })
  const files = []
  for (const [index, row] of source.files.entries()) {
    const bytes = await readLocal(root, `public/sound_effects/${row.file}`)
    assert(bytes.length === row.output.bytes && sha256(bytes) === row.output.sha256, `Audio changed during audit: ${row.file}`)
    const format = inspectMp3(bytes), decoded = await decodeSound(bytes, format)
    const payload = bytes.subarray(0, bytes.subarray(-128, -125).toString() === 'TAG' ? bytes.length - 128 : bytes.length)
    files.push({ file: row.file, bytes: bytes.length, sha256: row.output.sha256, originalSha256: row.original.sha256,
      mpegPayloadSha256: sha256(payload), format, decoded })
    onProgress(index + 1, source.files.length)
  }
  const result = createArtifacts({ lock, source, mappings, files })
  await checkAudio({ root })
  for (const [path, bytes] of inputBytes) assert((await readLocal(root, path)).equals(bytes), `Audit input changed during decoding: ${path}`)
  // Finish all decoding/validation before publication. The receipt is written last;
  // --check detects an interrupted generation and normal regeneration repairs it.
  if (check) {
    for (const [path, bytes] of result.outputs) assert((await readLocal(root, path, true))?.toString() === bytes, `Generated SFX output differs: ${path}`)
  } else {
    if (initialize) await atomicWrite(root, AUDIT_LOCK, json(lock))
    for (const [path, bytes] of result.outputs) await atomicWrite(root, path, bytes)
  }
  return result
}

export async function verifyOriginals({ root = repository } = {}) {
  const source = JSON.parse(await readLocal(root, 'tools/audio-import/source-lock.json'))
  assert(Array.isArray(source.files) && source.files.every(row => /^[A-Za-z0-9][A-Za-z0-9 ()'-]*\.mp3$/.test(row.file)), 'Invalid locked source filenames')
  for (const path of ['public/sound_effects/manifest.json', 'tools/audio-import/reports/optimization.json', ...source.files.map(row => `public/sound_effects/${row.file}`)]) await assertLocal(root, path)
  await checkAudio({ root })
  const directory = await assertLocal(root, 'tools/audio-import/.cache/originals')
  const names = await readdir(directory, { withFileTypes: true })
  assert(names.every(entry => entry.isFile()) && json(names.map(entry => entry.name).sort()) === json(source.files.map(row => row.file)), 'Original backup inventory differs')
  for (const row of source.files) {
    const bytes = await readLocal(root, `tools/audio-import/.cache/originals/${row.file}`)
    assert(bytes.length === row.original.bytes && sha256(bytes) === row.original.sha256, `Original backup differs: ${row.file}`)
    const stripped = stripId3v2(bytes).bytes
    assert(stripped.length === row.output.bytes && sha256(stripped) === row.output.sha256, `Original payload differs: ${row.file}`)
  }
  return { verifiedOriginals: source.files.length, durableExternalArchive: 'not-established-by-this-check' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2)
    assert(args.length <= 1 && args.every(arg => ['--check', '--init', '--verify-originals'].includes(arg)), 'Use audit.mjs [--check|--init|--verify-originals]')
    if (args[0] === '--verify-originals') console.log(json(await verifyOriginals()).trim())
    else {
      const result = await generateSfxAudit({ check: args[0] === '--check', initialize: args[0] === '--init',
        onProgress: (done, total) => { if (done % 100 === 0 || done === total) console.log(`Decoded ${done}/${total} sound files`) } })
      console.log(`SFX Stage A ${args[0] === '--check' ? 'verified' : 'generated'}: ${result.report.totals.files} files, ${result.coverage.counts.moves} move policies; no playback mappings approved.`)
    }
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
