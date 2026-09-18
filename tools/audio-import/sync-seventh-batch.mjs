import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assert, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { planSyncAudition } from '../../apps/sfx-bench/src/sync.js'

const ids = ['sing', 'grass-whistle', 'attract', 'morning-sun', 'moonlight', 'confuse-ray']
export const SEVENTH_FILES = Object.freeze([
  'tools/audio-import/sync-seventh-batch.mjs',
  'tools/audio-import/review/sync-batch-007.request-01.md',
  'tools/audio-import/review/sync-batch-007.originals.json',
  'tools/audio-import/review/sync-batch-007.healing-measurements.json',
  'tools/audio-import/review/sync-batch-007.confusion-measurements.json',
  'apps/sfx-bench/src/batchSevenVisual.js',
  ...ids.map(id => `packages/battle-fx/src/review-batch-seven/${id}.js`),
])
const hash = value => sha256(Buffer.from(JSON.stringify(value)))

/** Keep the opening recipes and extend their authored motion through the sounds. */
export async function reviseSeventhBatch({ root, batch, revisionPins }) {
  assert(batch.id === 'sync-007', 'Unsupported seventh batch')
  const originals = JSON.parse(await readLocal(root, SEVENTH_FILES[2]))
  assert(originals.kind === 'battle-sfx-original-visual-pins' && originals.schemaVersion === 1
    && originals.playbackPins.length === ids.length, 'Invalid seventh-batch originals')
  for (const [index, pin] of originals.playbackPins.entries()) {
    assert(pin.path === `packages/battle-fx/src/moves/restored/${ids[index]}.js`
      && pin.sha256 === sha256(await readLocal(root, pin.path)), `Seventh-batch original changed: ${pin.path}`)
  }
  const pins = SEVENTH_FILES.map(path => {
    const pin = revisionPins.find(row => row.path === path)
    assert(pin && /^[a-f0-9]{64}$/.test(pin.sha256), `Missing seventh-batch source: ${path}`)
    return pin
  })
  const healing = JSON.parse(await readLocal(root, SEVENTH_FILES[3]))
  const confusion = JSON.parse(await readLocal(root, SEVENTH_FILES[4]))
  for (const evidence of [healing, confusion]) assert(evidence.provenance.referenceReportSha256
    === revisionPins.find(pin => pin.path === evidence.provenance.referenceReport)?.sha256, 'Seventh-batch section measurements changed')
  const moves = await Promise.all(batch.moves.map(async move => {
    const path = `packages/battle-fx/src/review-batch-seven/${move.fxId}.js`, pin = pins.find(row => row.path === path)
    const { timing } = await import(`${pathToFileURL(resolve(root, path)).href}?review=${pin.sha256}`)
    const originalContact = move.visual.markers.find(marker => marker.id === 'impact').timeSeconds
    const soundDuration = move.asset.decoded.sampleFrames / move.asset.decoded.sampleRate
    assert(timing.contact === originalContact && timing.duration >= soundDuration
      && timing.duration - soundDuration <= .011, `Seventh-batch timing must preserve contact and match the full recording: ${move.id}`)
    const markers = [{ id: 'impact', label: 'Result impact cue', timeSeconds: timing.contact }, ...(timing.markers ?? [])]
    assert(new Set(markers.map(m => m.id)).size === markers.length && markers.every(m => /^[a-z][a-z0-9-]*$/.test(m.id)
      && typeof m.label === 'string' && Number.isFinite(m.timeSeconds) && m.timeSeconds >= 0 && m.timeSeconds <= timing.duration), 'Invalid seventh-batch markers')
    const section = healing.moves.find(item => item.moveId === move.fxId) ?? (move.id === 'confuseray' ? confusion : null)
    if (section) {
      assert(section.source.sha256 === move.asset.sha256 && section.source.pcmSha256 === move.asset.decoded.pcmSha256,
        `Seventh-batch sound section source changed: ${move.id}`)
      if (move.id === 'confuseray') {
        assert(markers.find(marker => marker.id === 'ducks-start')?.timeSeconds === section.computedAlignment.offsetSeconds,
          'Confusion ducks must enter at the measured ending section')
        for (const [index, rise] of section.computedAlignment.matchedRises.entries()) assert(markers.find(marker => marker.id === `duck-bob-${index + 1}`)?.timeSeconds === rise.timeSeconds,
          'Confusion ducks lost an ending sound accent')
      } else assert(markers.find(marker => marker.id === 'heal')?.timeSeconds === section.suffixAlignment.part2StartInFullSeconds
        && markers.find(marker => marker.id === 'heal-crest')?.timeSeconds === section.strongestHealingWindow.sourceTimeSeconds,
      'Healing finish must retain its measured suffix and crest')
    }
    const visualRevision = hash({ original: move.visual.visualRevision, pin,
      factory: pins.find(row => row.path.endsWith('batchSevenVisual.js')),
      evidence: pins.filter(row => row.path.endsWith('-measurements.json')) })
    const visual = { visualRevision, durationSeconds: timing.duration, markers: markers.sort((a,b) => a.timeSeconds - b.timeSeconds) }
    const [segment] = move.candidate.segments
    assert(move.candidate.visualRate === 1 && move.candidate.segments.length === 1 && segment.startSeconds === 0
      && segment.endSeconds === null && segment.cueSeconds === segment.soundAnchorSeconds
      && segment.gainDb === move.baseline.segments[0].gainDb, 'Seventh batch retains the original whole recording at zero delay')
    const [region] = planSyncAudition(move.candidate, move.asset.decoded, visual)
    assert(region.delaySeconds === 0 && region.endSeconds <= timing.duration, 'Seventh-batch sound must fit its extended motion')
    return { ...move, originalVisual: move.visual, visual, visualAccent: { id: `batch-seven-${move.id}-v1`, revision: visualRevision } }
  }))
  return { ...batch, moves, defaultMoveId: 'sing', reviewPlayback: 'batch-seven-v1', revision: hash({ previous: batch.revision, pins, moves }) }
}
