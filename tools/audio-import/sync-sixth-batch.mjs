import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assert, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { planSyncAudition } from '../../apps/sfx-bench/src/sync.js'

export const SIXTH_FILES = Object.freeze([
  'tools/audio-import/sync-sixth-batch.mjs',
  'tools/audio-import/review/sync-batch-006.request-01.md',
  'tools/audio-import/review/sync-batch-006.leaf-blade-measurements.json',
  'apps/sfx-bench/src/batchSixVisual.js',
  'packages/battle-fx/assets/rock.svg',
  ...['leaf-blade','tri-attack','meteor-mash','ancient-power','sacred-fire'].map(id => `packages/battle-fx/src/review-batch-six/${id}.js`),
])
const hash = value => sha256(Buffer.from(JSON.stringify(value)))

/** Five explicitly requested review recipes; production assets and recordings stay pinned. */
export async function reviseSixthBatch({ root, batch, revisionPins }) {
  assert(batch.id === 'sync-006', 'Unsupported sixth batch')
  const leafEvidence = JSON.parse(await readLocal(root, 'tools/audio-import/review/sync-batch-006.leaf-blade-measurements.json'))
  const pins = SIXTH_FILES.map(path => {
    const pin = revisionPins.find(row => row.path === path)
    assert(pin && /^[a-f0-9]{64}$/.test(pin.sha256), `Missing sixth-batch source: ${path}`)
    return pin
  })
  const moves = await Promise.all(batch.moves.map(async move => {
    const path = `packages/battle-fx/src/review-batch-six/${move.fxId}.js`, pin = pins.find(row => row.path === path)
    const { timing } = await import(`${pathToFileURL(resolve(root, path)).href}?review=${pin.sha256}`)
    assert(Number.isFinite(timing.contact) && timing.contact > 0 && Number.isFinite(timing.duration) && timing.duration >= timing.contact && timing.duration <= 12, 'Invalid sixth-batch timing')
    const markers = [{ id: 'impact', label: 'Result impact cue', timeSeconds: timing.contact }, ...(timing.markers ?? [])]
    assert(new Set(markers.map(m => m.id)).size === markers.length && markers.every(m => /^[a-z][a-z0-9-]*$/.test(m.id) && typeof m.label === 'string' && Number.isFinite(m.timeSeconds) && m.timeSeconds >= 0 && m.timeSeconds <= timing.duration), 'Invalid sixth-batch markers')
    const visualRevision = hash({ original: move.visual.visualRevision, pin,
      factory: pins.find(row => row.path.endsWith('batchSixVisual.js')),
      ...(move.id === 'ancientpower' ? { rock: pins.find(row => row.path.endsWith('rock.svg')) } : {}) })
    const visual = { visualRevision, durationSeconds: timing.duration, markers: markers.sort((a,b) => a.timeSeconds - b.timeSeconds) }
    assert(move.candidate.visualRate === 1 && move.candidate.segments.length === 1 && move.candidate.segments[0].startSeconds === 0 && move.candidate.segments[0].endSeconds === null, 'Sixth batch retains complete native recordings')
    const regions = planSyncAudition(move.candidate, move.asset.decoded, visual)
    assert(regions.every(r => r.delaySeconds + r.endSeconds - r.startSeconds <= timing.duration), 'Sixth-batch sound outlasts its animation')
    if (move.id === 'leafblade') {
      assert(leafEvidence.kind === 'leaf-blade-native-section-energy-evidence' && leafEvidence.source.sha256 === move.asset.sha256 && leafEvidence.source.pcmSha256 === move.asset.decoded.pcmSha256, 'Leaf Blade section evidence is stale')
      assert(leafEvidence.provenance.referenceReportSha256 === revisionPins.find(pin => pin.path === leafEvidence.provenance.referenceReport)?.sha256 && leafEvidence.sections.length === 3, 'Leaf Blade reference analysis changed')
      for (const section of leafEvidence.sections) {
        const marker = markers.find(m => m.id === section.id)
        const audioAccent = section.strongestEnergyWindow.startFrame / move.asset.decoded.sampleRate + regions[0].delaySeconds
        assert(marker && Math.abs(marker.timeSeconds - audioAccent) < 1e-9 && marker.timeSeconds === section.visualAccentSeconds, 'Leaf Blade strike lost its source accent')
      }
      assert(timing.contact === leafEvidence.playback.resultCueSeconds && timing.duration === leafEvidence.playback.visualDurationSeconds, 'Leaf Blade result timing changed')
    }
    if (move.id === 'ancientpower') {
      assert(timing.contact === 1.34 && timing.duration === 2.4 && Math.abs(regions[0].delaySeconds - .1) < 1e-9, 'Ancient Power must retain its reviewed timing')
    }
    return { ...move, originalVisual: move.visual, visual, visualAccent: { id: `batch-six-${move.id}-v1`, revision: visualRevision } }
  }))
  return { ...batch, moves, defaultMoveId: 'leafblade', reviewPlayback: 'batch-six-v1', revision: hash({ previous: batch.revision, pins, moves }) }
}
