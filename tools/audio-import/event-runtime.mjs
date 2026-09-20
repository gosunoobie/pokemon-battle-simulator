import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { BENCH_ROOT, verifiedCatalog, readAsset } from './bench.mjs'
import { assert, atomicWrite, json, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'

const GENERATED = 'packages/battle-sfx/src/event-runtime.generated.js'
const REPORT = 'tools/audio-import/reports/sfx-event-runtime.json'
const CATALOG = 'packages/battle-sfx/data/catalog.json'
const SOURCE_LOCK = 'tools/audio-import/source-lock.json'
const hash = text => sha256(Buffer.from(text))
// Explicit user requests authorize these event sounds only. They do not
// upgrade the unchanged candidate inventory into a listening review.
const AUTHORIZATION = {
  kind: 'user-message', scope: 'effectiveness-pokeball-and-faint-events',
  description: 'The user previously requested super-effective and not-very-effective hit sounds, and now requested Poké Ball and Pokémon faint sound effects.',
  requests: [
    { scope: 'effectiveness-events', quote: 'Now lets add super effective and not very effective sound effects when these occurs' },
    { scope: 'pokeball-and-faint-events', quote: 'Now lets add the poke ball and pokemon faint sound effect' },
  ],
  listeningApproval: false, nativeDecoderReview: false,
}
const POLICY = {
  playbackPolicy: 'whole-native-buffer-at-event-cue', playbackRate: 1,
  startSeconds: 0, endSeconds: null, defaultGainDb: -6,
  nativeCompatibility: null, tailPolicy: 'continue-until-source-end',
  gainBasis: 'Hit cues retain conservative -6 dB attenuation; standalone transition cues use 0 dB. These are host mix choices, not perceived-loudness normalization or listening approvals.',
  unselected: 'silence',
}
const SELECTION = [
  { eventId: 'battle.hit.super-effective', assetId: 'source.hit-super-effective', file: 'Hit Super Effective.mp3',
    bytes: 71180, sha256: '78652aa7b163ef73a0fcb37af61068a12d83a0a298e64ef447e792e58b34150e',
    pcmSha256: '22f6732810ec91f2620637c3004f8411310a61d4023fde63f3014447118a0d16', sampleFrames: 75852 },
  { eventId: 'battle.hit.resisted', assetId: 'source.hit-weak-not-very-effective', file: 'Hit Weak Not Very Effective.mp3',
    bytes: 30429, sha256: 'cfaa3e077c7a8451a6a6d325755eee10b95db9081196fd7cd8eacde4996bdeb1',
    pcmSha256: '0ac62937be4f8740fd475a434e6090df602e5f17851300289cf70abcb52549cf', sampleFrames: 30870 },
  { eventId: 'battle.release.pokeball', sourceEventId: 'battle.recall.pokeball',
    sourceUse: 'Host-selected reuse of the existing recall/switch recording for Poké Ball activation during send-out; not a dedicated release recording.',
    assetId: 'source.in-battle-recall-switch-pokeball', file: 'In-Battle Recall Switch Pokeball.mp3', gainDb: 0,
    bytes: 35653, sha256: 'a078ff0a5695ddc6ce41a2499b0b2ea1d429d182dc1452bc1723833efe0031a4',
    pcmSha256: '155e6585f38458bc821d0c98525fdf0f25633991d00e5b216f4d572b0f14359a', sampleFrames: 36603 },
  { eventId: 'battle.faint', sourceEventId: 'battle.faint',
    sourceUse: 'Whole faint/no-health event recording, separate from the Pokémon cry.',
    assetId: 'source.in-battle-faint-no-health', file: 'In-Battle Faint No Health.mp3', gainDb: 0,
    bytes: 42968, sha256: 'c71721da6cc02d8dbe5b5d77bf68879b561551efb9173c1bec77066a95ae76d4',
    pcmSha256: 'c8825f43731b9fd6d803cb729866081b43630fe18b3d5015658947baa91e5a55', sampleFrames: 44100 },
]

/** Compile whole-source event choices without using browser trim coordinates. */
export function compileEventRuntime({ catalogText, sourceLockText, auditLockSha256, decoder }) {
  const catalog = JSON.parse(catalogText), sourceLock = JSON.parse(sourceLockText)
  assert(catalog.schemaVersion === 1 && catalog.provenance?.auditLockSha256 === auditLockSha256
    && /^[a-f0-9]{64}$/.test(auditLockSha256), 'Event catalog provenance differs from the verified audit')
  assert(sourceLock.schemaVersion === 1 && sourceLock.transform === 'remove-leading-id3v2.3-only'
    && Array.isArray(sourceLock.files), 'Unsupported original source provenance')
  assert(decoder?.name === 'mpg123-decoder' && decoder.enableGapless === true
    && typeof decoder.referenceConvention === 'string', 'Missing reference decoder convention')
  const assets = {}, events = {}, selected = []
  for (const row of SELECTION) {
    const sourceEventId = row.sourceEventId ?? row.eventId
    const gainDb = row.gainDb ?? POLICY.defaultGainDb
    const event = catalog.events[sourceEventId], asset = catalog.assets[row.assetId], decoded = asset?.decoded
    assert(event?.id === sourceEventId && event.assetIds.length === 1 && event.assetIds[0] === row.assetId
      && asset?.eventId === sourceEventId && asset.kind === 'battle-event' && asset.moveId === null
      && asset.variant?.type === 'generic', `Event/source relationship changed: ${row.eventId}`)
    assert(asset.file === row.file && asset.bytes === row.bytes && asset.sha256 === row.sha256
      && asset.mime === 'audio/mpeg' && decoded?.sampleRate === 44100 && decoded.channels === 2
      && decoded.sampleFrames === row.sampleFrames && decoded.pcmSha256 === row.pcmSha256,
    `Pinned event source or reference PCM changed: ${row.assetId}`)
    assert(Number.isFinite(decoded.peak) && decoded.peak > 0 && decoded.peak <= 1
      && Number.isFinite(decoded.peakDbfs) && Number.isFinite(decoded.rmsDbfs)
      && decoded.samplesAboveFullScale === 0, `Invalid event source levels: ${row.assetId}`)
    const original = sourceLock.files.filter(file => file.file === row.file)
    assert(original.length === 1 && original[0].output.bytes === row.bytes && original[0].output.sha256 === row.sha256
      && original[0].original.sha256 === asset.sourceSha256, `Original source provenance changed: ${row.assetId}`)
    assets[asset.id] = { id: asset.id, file: `${asset.sha256}.mp3`, bytes: asset.bytes,
      sha256: asset.sha256, mime: asset.mime,
      reference: { sampleRate: decoded.sampleRate, sampleFrames: decoded.sampleFrames,
        channels: decoded.channels, peak: decoded.peak } }
    events[row.eventId] = { eventId: row.eventId, assetId: asset.id, authorization: 'user-request',
      playbackPolicy: POLICY.playbackPolicy, playbackRate: 1, startSeconds: 0, endSeconds: null,
      gainDb, nativeCompatibility: null, tailPolicy: POLICY.tailPolicy,
      ...(row.sourceEventId ? { sourceEventId, sourceUse: row.sourceUse } : {}) }
    selected.push({ ...row, originalSourceSha256: asset.sourceSha256,
      sampleRate: decoded.sampleRate, channels: decoded.channels,
      referenceDurationSeconds: decoded.sampleFrames / decoded.sampleRate,
      referencePeakDbfs: decoded.peakDbfs, referenceRmsDbfs: decoded.rmsDbfs, gainDb })
  }
  const provenance = { auditLockSha256, catalogSha256: hash(catalogText), sourceLockSha256: hash(sourceLockText) }
  const runtime = { schemaVersion: 1, kind: 'battle-sfx-event-runtime', status: 'user-authorized-events',
    authorization: AUTHORIZATION, provenance, policy: POLICY, assets, events }
  const generated = `// Generated by tools/audio-import/event-runtime.mjs. User-requested whole-source events; no listening approval.\nexport default ${JSON.stringify(runtime)}\n`
  const report = { schemaVersion: 1, kind: 'battle-sfx-event-runtime-report', authorization: AUTHORIZATION,
    provenance, policy: POLICY, selected, selectedEventCount: selected.length, selectedAssetCount: Object.keys(assets).length,
    encodedBytes: selected.reduce((sum, row) => sum + row.bytes, 0),
    listeningApprovalsAdded: 0, nativeDecoderReviewsAdded: 0, acceptedMoveMappingsChanged: 0,
    decoderReference: { name: decoder.name, version: decoder.version, enableGapless: decoder.enableGapless,
      referenceConvention: decoder.referenceConvention },
    runtimeModuleBytes: Buffer.byteLength(generated), runtimeModuleSha256: hash(generated),
    limitations: [
      'The delivered files exactly match the verified collection MP3 bytes. The earlier collection import removed leading ID3 metadata only; MPEG audio was preserved.',
      'Reference PCM measurements describe source provenance and levels only. No native browser sample-count or listening review is claimed.',
      'Playback uses the entire actual native decode at rate one, including its original quiet beginning and tail. No trimming, taper, normalization, or latency correction is inferred.',
      'The host supplies confirmed effectiveness or transition cues. Neutral hits and immunity have no selected event recording.',
      'The host explicitly reuses the existing recall/switch Poké Ball recording for send-out activation. The original collection event remains battle.recall.pokeball; no dedicated release source or listening approval is claimed.',
    ] }
  return { catalog: runtime, generated, report }
}

/** Verify all source inputs before writing the independent event pack. */
export async function generateEventRuntime({ root = BENCH_ROOT, check = false } = {}) {
  const { catalog, decoder, auditLockSha256 } = await verifiedCatalog(root)
  const [catalogBytes, sourceLockBytes] = await Promise.all([readLocal(root, CATALOG), readLocal(root, SOURCE_LOCK)])
  const result = compileEventRuntime({ catalogText: catalogBytes.toString(), sourceLockText: sourceLockBytes.toString(), auditLockSha256, decoder })
  const outputs = [{ path: GENERATED, bytes: Buffer.from(result.generated) }]
  for (const row of result.report.selected) {
    const bytes = await readAsset(root, catalog.assets[row.assetId])
    outputs.push({ path: `public/audio/sfx/${result.catalog.assets[row.assetId].file}`, bytes })
  }
  result.report.compiler = { path: 'tools/audio-import/event-runtime.mjs', sha256: sha256(await readFile(fileURLToPath(import.meta.url))) }
  result.report.outputs = outputs.map(row => ({ path: row.path, bytes: row.bytes.length, sha256: sha256(row.bytes) }))
  outputs.push({ path: REPORT, bytes: Buffer.from(json(result.report)) })
  if (check) for (const row of outputs) {
    const existing = await readLocal(root, row.path, true)
    assert(existing?.equals(row.bytes), `Event runtime output differs or is missing: ${row.path}`)
  }
  else for (const row of outputs) await atomicWrite(root, row.path, row.bytes)
  return result.report
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2)
    assert(args.every(arg => arg === '--check') && args.length <= 1, 'Usage: node tools/audio-import/event-runtime.mjs [--check]')
    const report = await generateEventRuntime({ check: args.includes('--check') })
    console.log(`${args.includes('--check') ? 'Verified' : 'Generated'} ${report.selectedEventCount} user-requested event sounds, ${report.encodedBytes} source bytes; no listening approvals changed.`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
