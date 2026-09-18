import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { readLocal, assert } from './audit-io.mjs'
import { analyzePcm, inspectDecoderIdentity, DECODE_LIMITS } from './decode.mjs'
import { inspectMp3, sha256 } from './mp3.mjs'

export const BENCH_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const LOCK = 'tools/audio-import/audit-lock.json'
const CATALOG = 'packages/battle-sfx/data/catalog.json'
const RECEIPT = 'tools/audio-import/reports/sfx-generation.json'
const PILOT = 'tools/audio-import/review/pilot.json'
const REGISTRY = 'packages/battle-fx/src/registry.js'
const AUDITION_FILES = ['apps/sfx-bench/src/visual.js', 'apps/sfx-bench/src/timing.js', 'apps/sfx-bench/src/audio.js', 'apps/sfx-bench/src/Bench.vue', 'packages/battle-sfx/src/review.js']
const SHARED_VISUAL_FILES = [REGISTRY, 'packages/battle-fx/src/index.js', 'packages/battle-fx/src/effect-space.js', 'packages/battle-fx/src/assets.js', 'packages/battle-fx/src/random.js', ...AUDITION_FILES]
const round = value => Number(value.toFixed(8))

export class BenchError extends Error {
  constructor(message, status = 422) { super(message); this.name = 'BenchError'; this.status = status }
}

export async function verifiedCatalog(root) {
  const lockBytes = await readLocal(root, LOCK), lock = JSON.parse(lockBytes)
  const auditLockSha256 = sha256(lockBytes)
  assert(lock.schemaVersion === 1 && lock.stage === 'A' && Array.isArray(lock.inputs), 'Unsupported Stage A lock')
  // Re-check source/configuration pins without decoding the full collection.
  for (const pin of lock.inputs) {
    const bytes = await readLocal(root, pin.path)
    assert(bytes.length === pin.bytes && sha256(bytes) === pin.sha256, `Stage A input differs from lock: ${pin.path}`)
  }
  const receipt = JSON.parse(await readLocal(root, RECEIPT)), catalogBytes = await readLocal(root, CATALOG)
  const expected = receipt.outputs?.find(row => row.path === CATALOG)
  assert(receipt.auditLockSha256 === auditLockSha256 && expected?.bytes === catalogBytes.length && expected.sha256 === sha256(catalogBytes), 'Stage A catalog receipt mismatch; run npm run sfx:check')
  const catalog = JSON.parse(catalogBytes)
  assert(catalog.provenance.auditLockSha256 === auditLockSha256, 'Catalog provenance disagrees with Stage A lock')
  const decoder = await inspectDecoderIdentity()
  assert(JSON.stringify(decoder) === JSON.stringify(lock.decoder), 'Installed reference decoder differs from Stage A lock; run npm run audio:setup')
  return { catalog, decoder, auditLockSha256 }
}

export async function readAsset(root, asset) {
  assert(asset && /^[A-Za-z0-9][A-Za-z0-9 ()'-]*\.mp3$/.test(asset.file), 'Invalid bench sound asset')
  const bytes = await readLocal(root, `public/sound_effects/${asset.file}`)
  assert(bytes.length === asset.bytes && sha256(bytes) === asset.sha256, `Sound asset differs from Stage A: ${asset.id}`)
  return bytes
}

/** Read-only, development-only selection; this never promotes a candidate. */
export async function createBenchManifest({ root = BENCH_ROOT } = {}) {
  const { catalog, decoder, auditLockSha256 } = await verifiedCatalog(root)
  const pilotBytes = await readLocal(root, PILOT), pilot = JSON.parse(pilotBytes)
  assert(pilot.schemaVersion === 1 && pilot.status === 'unreviewed-pilot', 'Unsupported SFX pilot policy')
  const shared = await Promise.all(SHARED_VISUAL_FILES.map(async path => ({ path, sha256: sha256(await readLocal(root, path)) })))
  const registry = await import(`${pathToFileURL(resolve(root, REGISTRY)).href}?bench=${shared[0].sha256}`)
  const subjects = [], assets = {}, moves = {}, events = {}, visualRevisions = {}
  const addAssets = async ids => {
    for (const id of ids) {
      if (Object.hasOwn(assets, id)) continue
      const asset = catalog.assets[id]
      await readAsset(root, asset)
      assets[id] = { ...asset, url: `/sound_effects/${encodeURIComponent(asset.file)}` }
    }
  }
  for (const id of pilot.moves) {
    const move = catalog.moves[id]
    assert(move, `Unknown pilot move: ${id}`)
    moves[id] = { id, assetIds: move.assetIds, status: move.status }
    await addAssets(move.assetIds)
    for (const phase of pilot.prepare.includes(id) ? ['attack', 'prepare'] : ['attack']) {
      const definition = registry.MOVE_EFFECTS[move.fxId]
      const timing = phase === 'prepare' ? registry.PHASE_TIMINGS[move.fxId]?.prepare : registry.EFFECT_TIMINGS[move.fxId]
      assert(definition && timing, `Pilot visual is unavailable: ${id}:${phase}`)
      const path = `packages/battle-fx/src/moves/restored/${move.fxId}${phase === 'prepare' ? '-prepare' : ''}.js`
      const recipe = await readLocal(root, path)
      const sourceFiles = [...shared, { path, sha256: sha256(recipe) }, { path: PILOT, sha256: sha256(pilotBytes) }]
      const visualRevision = sha256(Buffer.from(JSON.stringify(sourceFiles)))
      const markers = [{ id: phase === 'prepare' ? 'prepared' : 'impact', label: phase === 'prepare' ? 'Prepared result cue' : 'Result impact cue', timeSeconds: timing.contact, kind: 'result', source: REGISTRY }]
      if (timing.recovery != null) markers.push({ id: 'recovery', label: 'Recovery result cue', timeSeconds: timing.recovery, kind: 'result', source: REGISTRY })
      for (const marker of pilot.authoredMarkers[`${id}:${phase}`] ?? []) {
        assert(recipe.toString().includes(marker.evidence), `Authored marker needs review after visual change: ${id}:${marker.id}`)
        assert(Number.isFinite(marker.timeSeconds) && marker.timeSeconds >= 0 && marker.timeSeconds <= timing.duration, 'Authored marker outside visual duration')
        markers.push({ id: marker.id, label: marker.label, timeSeconds: marker.timeSeconds, kind: 'authored', source: path })
      }
      markers.sort((a, b) => a.timeSeconds - b.timeSeconds || a.id.localeCompare(b.id))
      const notes = [...move.notes, 'Filename candidates only: no region, gain, onset or sound-role approval has been inferred.']
      if (id === 'fly') notes.push('Both phases expose the same unassigned source candidates. Part numbers do not assign prepare or attack roles.')
      if (id === 'present') notes.push('The existing Present visual previews damage only. The heal recording is available for audio-only comparison; it does not establish a healing visual or gameplay outcome.')
      if (id === 'doublekick' || id === 'bulletseed') notes.push('Authored cosmetic contacts precede the single result cue; they are not additional battle damage events.')
      const key = `move:${id}:${phase}`
      visualRevisions[key] = visualRevision
      subjects.push({ id, kind: 'move', name: move.name, phase, fxId: move.fxId, visualSubject: phase === 'prepare' ? 'source' : definition.subject ?? 'target', visualRevision, sourceFiles, durationSeconds: timing.duration, markers, assetIds: move.assetIds, status: move.status, notes })
    }
  }
  for (const id of pilot.events) {
    const event = catalog.events[id]
    assert(event, `Unknown pilot event: ${id}`)
    events[id] = { id, assetIds: event.assetIds, status: event.status }
    await addAssets(event.assetIds)
    const sourceFiles = shared.filter(row => AUDITION_FILES.includes(row.path))
    const phase = 'attack', visualRevision = sha256(Buffer.from(JSON.stringify({ kind: 'audio-only-event-v1', id, sourceFiles })))
    visualRevisions[`event:${id}:${phase}`] = visualRevision
    subjects.push({ id, kind: 'event', name: id.replace(/^battle\./, '').replaceAll('.', ' '), phase, fxId: null, visualRevision, sourceFiles, durationSeconds: null, markers: [], assetIds: event.assetIds, status: event.status, notes: [...event.notes, 'Audio-only audition. No battle-event visual or synthetic impact timeline is represented here.'] })
  }
  return {
    schemaVersion: 1, stage: 'B', status: 'unreviewed-pilot', auditLockSha256,
    provenance: { auditLockSha256 },
    decoderReference: { name: decoder.name, version: decoder.version, enableGapless: decoder.enableGapless, referenceConvention: decoder.referenceConvention, identitySha256: sha256(Buffer.from(JSON.stringify(decoder))) },
    subjects, assets, moves, events, visualRevisions,
  }
}

/** Min/max channels retain peaks, including values outside [-1,1]; bins are frames. */
export function waveformBins(channelData, bins = 512) {
  assert(Number.isInteger(bins) && bins > 0 && bins <= 2048, 'Invalid waveform bin budget')
  assert(Array.isArray(channelData) && channelData.length > 0 && channelData.every(channel => channel instanceof Float32Array && channel.length === channelData[0].length) && channelData[0].length > 0, 'Invalid waveform PCM')
  const sampleFrames = channelData[0].length, count = Math.min(bins, sampleFrames)
  const channels = channelData.map(channel => Array.from({ length: count }, (_, bin) => {
    const start = Math.floor(bin * sampleFrames / count), end = Math.floor((bin + 1) * sampleFrames / count)
    let min = Infinity, max = -Infinity
    for (let frame = start; frame < end; frame++) {
      assert(Number.isFinite(channel[frame]), 'Non-finite waveform sample')
      min = Math.min(min, channel[frame]); max = Math.max(max, channel[frame])
    }
    return [round(min), round(max)]
  }))
  return { binCount: count, sampleFrames, boundaryConvention: 'Bin i covers [floor(i * sampleFrames / binCount), floor((i + 1) * sampleFrames / binCount)).', channels }
}

async function referenceForAsset(asset, bytes) {
  const format = inspectMp3(bytes), upperFrames = format.frameCount * 1152
  assert(bytes.length <= DECODE_LIMITS.inputBytes && format.channels === 2 && upperFrames * format.channels * 4 <= DECODE_LIMITS.decodedBytes && upperFrames / format.sampleRate <= DECODE_LIMITS.durationSeconds, 'Reference decode exceeds pinned resource bounds')
  const { MPEGDecoder } = await import('mpg123-decoder')
  const decoder = new MPEGDecoder({ enableGapless: true })
  let ready = false
  try {
    await decoder.ready; ready = true
    const result = decoder.decode(bytes), decoded = analyzePcm(result)
    assert(JSON.stringify(decoded) === JSON.stringify(asset.decoded), `Reference PCM differs from Stage A: ${asset.id}`)
    return { schemaVersion: 1, assetId: asset.id, sha256: asset.sha256, decoded, waveform: waveformBins(result.channelData), coordinateSystem: 'Stage A native-rate gapless-enabled reference sample frames; browser offsets must be measured separately.' }
  } finally { if (ready) decoder.free() }
}

/** Cache only small waveform summaries, never decoded PCM; cap queued decodes. */
export function createBenchService({ root = BENCH_ROOT, getManifest = () => createBenchManifest({ root }) } = {}) {
  const cache = new Map()
  let pending = 0, queue = Promise.resolve()
  return {
    manifest: getManifest,
    async reference(assetId) {
      if (typeof assetId !== 'string' || assetId.length > 128) throw new BenchError('Invalid asset ID', 400)
      if (pending >= 8) throw new BenchError('Reference decoder is busy; retry after the current audition loads', 503)
      pending++
      const run = queue.then(async () => {
        const manifest = await getManifest()
        if (!Object.hasOwn(manifest.assets, assetId)) throw new BenchError('Asset is not in the Stage B pilot', 404)
        const asset = manifest.assets[assetId], bytes = await readAsset(root, asset)
        const key = `${asset.id}:${asset.sha256}:${manifest.decoderReference.identitySha256}`
        let result = cache.get(key)
        if (result) cache.delete(key)
        else result = await referenceForAsset(asset, bytes)
        cache.set(key, result)
        if (cache.size > 4) cache.delete(cache.keys().next().value)
        return result
      })
      queue = run.catch(() => {})
      try { return await run } finally { pending-- }
    },
  }
}
