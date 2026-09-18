import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BENCH_ROOT, createBenchManifest, verifiedCatalog, readAsset } from './bench.mjs'
import { readLocal, assert } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'

const REGISTRY = 'packages/battle-fx/src/registry.js'
const EXTRA_AUTHORING = ['tools/audio-import/collection.mjs', 'apps/sfx-bench/src/CollectionBench.vue', 'apps/sfx-bench/src/collection.js', 'apps/sfx-bench/src/main.js']
const key = subject => `${subject.kind}:${subject.id}:${subject.phase}`

/** A separate worklist preserves the original pilot's exact evidence and pins. */
export async function createCollectionManifest({ root = BENCH_ROOT } = {}) {
  const pilot = await createBenchManifest({ root })
  const { catalog } = await verifiedCatalog(root)
  const extraFiles = await Promise.all(EXTRA_AUTHORING.map(async path => ({ path, sha256: sha256(await readLocal(root, path)) })))
  const registryHash = sha256(await readLocal(root, REGISTRY))
  const registry = await import(`${pathToFileURL(resolve(root, REGISTRY)).href}?collection=${registryHash}`)
  const pilotSubjects = new Map(pilot.subjects.map(subject => [key(subject), subject]))
  const shared = pilot.subjects[0].sourceFiles.filter(row => !row.path.includes('/moves/restored/') && row.path !== 'tools/audio-import/review/pilot.json')
  const subjects = [], assets = {}, moves = {}, events = {}, visualRevisions = {}
  for (const asset of Object.values(catalog.assets)) {
    await readAsset(root, asset)
    assets[asset.id] = { ...asset, url: `/sound_effects/${encodeURIComponent(asset.file)}` }
  }
  for (const move of Object.values(catalog.moves)) {
    moves[move.id] = { id: move.id, assetIds: move.assetIds, status: move.status }
    const definition = registry.MOVE_EFFECTS[move.fxId]
    const phases = registry.PHASE_TIMINGS[move.fxId]?.prepare ? ['attack', 'prepare'] : ['attack']
    for (const phase of phases) {
      const subjectKey = `move:${move.id}:${phase}`
      const original = pilotSubjects.get(subjectKey)
      if (original) { subjects.push(original); visualRevisions[subjectKey] = original.visualRevision; continue }
      const timing = phase === 'prepare' ? registry.PHASE_TIMINGS[move.fxId]?.prepare : registry.EFFECT_TIMINGS[move.fxId]
      assert(!definition || timing, `Missing visual timing: ${subjectKey}`)
      let sourceFiles = [...shared, ...extraFiles], markers = []
      if (definition) {
        const path = `packages/battle-fx/src/moves/restored/${move.fxId}${phase === 'prepare' ? '-prepare' : ''}.js`
        sourceFiles.push({ path, sha256: sha256(await readLocal(root, path)) })
        markers.push({ id: phase === 'prepare' ? 'prepared' : 'impact', label: phase === 'prepare' ? 'Prepared result cue' : 'Result impact cue', timeSeconds: timing.contact, kind: 'result', source: REGISTRY })
        if (timing.recovery != null) markers.push({ id: 'recovery', label: 'Recovery result cue', timeSeconds: timing.recovery, kind: 'result', source: REGISTRY })
      }
      const visualRevision = sha256(Buffer.from(JSON.stringify({ kind: definition ? 'collection-visual-v1' : 'collection-no-visual-v1', subjectKey, sourceFiles })))
      visualRevisions[subjectKey] = visualRevision
      subjects.push({ id: move.id, kind: 'move', name: move.name, phase, fxId: definition ? move.fxId : null,
        visualSubject: definition ? phase === 'prepare' ? 'source' : definition.subject ?? 'target' : null,
        visualRevision, sourceFiles, durationSeconds: timing?.duration ?? null, markers,
        assetIds: move.assetIds, status: move.status,
        notes: [...move.notes, ...(definition ? [] : ['No registered animation: audio-only technical inventory, not paired approval.']),
          ...(phase === 'prepare' ? ['Preparation candidates have no assigned sound role; part numbers cannot establish a phase.'] : []),
          'Technical energy measurements are candidate guides, not listening evidence or semantic sound cues.'] })
    }
  }
  for (const event of Object.values(catalog.events)) {
    events[event.id] = { id: event.id, assetIds: event.assetIds, status: event.status }
    const subjectKey = `event:${event.id}:attack`, original = pilotSubjects.get(subjectKey)
    if (original) { subjects.push(original); visualRevisions[subjectKey] = original.visualRevision; continue }
    const sourceFiles = [...shared.filter(row => row.path.startsWith('apps/sfx-bench') || row.path.endsWith('/review.js')), ...extraFiles]
    const visualRevision = sha256(Buffer.from(JSON.stringify({ kind: 'collection-audio-only-event-v1', subjectKey, sourceFiles })))
    visualRevisions[subjectKey] = visualRevision
    subjects.push({ id: event.id, kind: 'event', name: event.id.replace(/^battle\./, '').replaceAll('.', ' '), phase: 'attack',
      fxId: null, visualRevision, sourceFiles, durationSeconds: null, markers: [], assetIds: event.assetIds, status: event.status,
      notes: [...event.notes, 'Audio-only event study: no lifecycle visual is represented; paired approval is unavailable.'] })
  }
  const collectionRevision = sha256(Buffer.from(JSON.stringify({ visualRevisions, extraFiles, assets: Object.values(assets).map(asset => [asset.id, asset.sha256]) })))
  return { schemaVersion: 1, stage: 'D', status: 'technical-drafts-only', auditLockSha256: pilot.auditLockSha256,
    provenance: pilot.provenance, decoderReference: pilot.decoderReference, collectionRevision,
    subjects, assets, moves, events, visualRevisions,
    summary: { assetCount: Object.keys(assets).length, movePolicyCount: Object.keys(moves).length,
      animatedMoveCount: subjects.filter(row => row.kind === 'move' && row.fxId && row.phase === 'attack').length,
      preparationCount: subjects.filter(row => row.phase === 'prepare').length,
      noVisualMoveCount: subjects.filter(row => row.kind === 'move' && !row.fxId).length,
      eventCount: Object.keys(events).length } }
}
