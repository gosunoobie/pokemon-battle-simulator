import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual as equal } from 'node:util'
import { assert, readLocal } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { normalizeSyncFeedback } from '../../apps/sfx-bench/src/syncFeedback.js'
import { planSyncAudition } from '../../apps/sfx-bench/src/sync.js'

const CHANGED = ['leafblade','ancientpower','sacredfire']
export const SIXTH_SECOND_FILES = Object.freeze([
  'tools/audio-import/review/sync-batch-006.feedback-01.json',
  'tools/audio-import/review/sync-batch-006.review-01.json',
  'tools/audio-import/review/sync-batch-006.manifest-01.json',
  'tools/audio-import/sync-sixth-second-revision.mjs',
  'apps/sfx-bench/src/batchSixVisualV2.js',
  'packages/battle-fx/src/assets.js',
  ...['leaf-blade','ancient-power','sacred-fire'].map(id => `packages/battle-fx/src/review-batch-six-v2/${id}.js`),
])
const hash = value => sha256(Buffer.from(JSON.stringify(value)))
const notes = {
  leafblade: ['Only the upper curved green blade remains, with its white edge. The two strikes, opposite cuts, cross finish and sound timing are unchanged.'],
  ancientpower: ['Five rocks use the same rendered texture as Rock Slide at twice the previous size. A wider, evenly spaced orbit passes behind and in front of the user before the original five launches and impacts.'],
  sacredfire: ['The approved purple charging flames stay intact. A Dragon Breath-style stream releases toward the opponent, then the same purple flame material forms a larger crown with doubled flame dimensions and even spacing.'],
}

export async function reviseSixthBatchAgain({ root, batch, revisionPins }) {
  const [feedbackBytes,captureBytes,manifestBytes] = await Promise.all(SIXTH_SECOND_FILES.slice(0,3).map(path => readLocal(root,path)))
  const feedback=JSON.parse(feedbackBytes),capture=JSON.parse(captureBytes),prior=JSON.parse(manifestBytes)
  assert(batch.id==='sync-006' && capture.schemaVersion===1 && capture.kind==='battle-sfx-sync-review-capture', 'Invalid sixth-batch review capture')
  assert(capture.source.name==='sync-006-feedback.json' && capture.source.sha256===sha256(feedbackBytes), 'Captured sixth-batch feedback changed')
  assert(capture.manifestPath===SIXTH_SECOND_FILES[2] && capture.manifestSha256===sha256(manifestBytes) && feedback.revision===prior.revision, 'Captured sixth-batch manifest changed')
  assert(equal(normalizeSyncFeedback(feedback,prior),feedback), 'Sixth-batch feedback contains invalid tuning')
  assert(equal(prior.moves.map(m=>m.id),batch.moves.map(m=>m.id)), 'Sixth-batch review must retain its five moves')
  assert(equal(feedback.records.map(r=>r.moveId),batch.moves.map(m=>m.id)), 'Sixth-batch feedback order changed')
  for(const pin of capture.playbackPins) assert(equal(revisionPins.find(current=>current.path===pin.path),pin), `Reviewed sixth-batch playback changed: ${pin.path}`)
  const pins=SIXTH_SECOND_FILES.map(path=>{
    const pin=revisionPins.find(pin=>pin.path===path)
    assert(pin && /^[a-f0-9]{64}$/.test(pin.sha256),`Missing sixth revision provenance: ${path}`);return pin
  })
  const moves=await Promise.all(batch.moves.map(async(move,index)=>{
    const previous=prior.moves[index],record=feedback.records.find(r=>r.moveId===move.id),changed=CHANGED.includes(move.id)
    for(const field of ['id','fxId','asset','visual','visualAccent','candidate','originalVisual','baseline'])
      assert(equal(move[field],previous[field]),`Reviewed proposal changed: ${move.id}/${field}`)
    assert(record?.native && record.verdict===(changed?'adjust-animation':'keep') && equal(record.plan,previous.candidate), 'Sixth revision must preserve all five reviewed sound plans')
    let visual=previous.visual,visualAccent=previous.visualAccent
    if(changed){
      const path=`packages/battle-fx/src/review-batch-six-v2/${move.fxId}.js`,pin=pins.find(p=>p.path===path)
      const {timing}=await import(`${pathToFileURL(resolve(root,path)).href}?revision=${pin.sha256}`)
      assert(timing.contact===previous.visual.markers.find(m=>m.id==='impact').timeSeconds && timing.duration===previous.visual.durationSeconds, 'Sixth revision must keep contact and duration')
      const markers=[{id:'impact',label:'Result impact cue',timeSeconds:timing.contact},...(timing.markers??[])]
      assert(new Set(markers.map(m=>m.id)).size===markers.length && markers.every(m=>typeof m.label==='string' && Number.isFinite(m.timeSeconds) && m.timeSeconds>=0 && m.timeSeconds<=timing.duration), 'Invalid sixth revision markers')
      const revision=hash({previous:previous.visual.visualRevision,pin,factory:pins.find(p=>p.path.endsWith('batchSixVisualV2.js')),assets:pins.find(p=>p.path.endsWith('/assets.js'))})
      visual={durationSeconds:timing.duration,visualRevision:revision,markers};visualAccent={id:`batch-six-${move.id}-v2`,revision}
    }
    for(const native of [record.native,move.asset.decoded]){
      const regions=planSyncAudition(record.plan,native,visual)
      assert(regions.every(r=>r.delaySeconds+r.endSeconds-r.startSeconds<=visual.durationSeconds+1e-9),'Revised sound outlasts its animation')
    }
    return {...move,visual,visualAccent,notes:notes[move.id]??previous.notes,
      previousVisual:previous.visual,previousVisualAccent:previous.visualAccent,previousPlayback:prior.reviewPlayback,
      previousReview:{verdict:record.verdict,notes:record.notes,plan:record.plan,changed,revision:feedback.revision}}
  }))
  const feedbackRecords=moves.map((move,index)=>({moveId:move.id,plan:move.candidate,verdict:move.previousReview.changed?'unreviewed':'keep',
    notes:feedback.records[index].notes,native:feedback.records[index].native,visualAccent:move.visualAccent}))
  return {...batch,moves,feedbackRecords,defaultMoveId:'leafblade',reviewPlayback:'batch-six-feedback-v2',revision:hash({reviewed:prior.revision,pins,moves})}
}
