import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { readApprovedRollout, compileRolloutRuntime, ROLLOUT_APPROVAL, ROLLOUT_IDS } from '../sync-rollout.mjs'
import { generateAcceptedRuntime } from '../accepted-runtime.mjs'
import { createCollectionManifest } from '../collection.mjs'
import { createSyncBatchManifest } from '../sync-batch.mjs'
import { sha256 } from '../mp3.mjs'
import { planSyncAudition } from '../../../apps/sfx-bench/src/sync.js'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const read = path => readFile(join(root, path))
const approvalBytes = await read(ROLLOUT_APPROVAL), approval = JSON.parse(approvalBytes)
const snapshots = new Map(await Promise.all(approval.batches.map(async entry => [entry.id, JSON.parse(await read(entry.manifest.path))])))
const feedbackBytes = await read(approval.feedback.path), feedback = JSON.parse(feedbackBytes)
const rollout = await readApprovedRollout(), manifest = await createCollectionManifest()
const catalogs = compileRolloutRuntime({ rollout, manifest })
const inputs = () => ({ rollout: { ...structuredClone(rollout), approvalBytes: Buffer.from(rollout.approvalBytes) }, manifest: structuredClone(manifest) })

async function fixture() {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'sfx-rollout-evidence-')))
  const paths = [...new Set([ROLLOUT_APPROVAL, approval.feedback.path, ...approval.batches.map(entry => entry.manifest.path), ...approval.playbackPins.map(pin => pin.path)])]
  for (const path of paths) { await mkdir(dirname(join(directory,path)), { recursive:true }); await copyFile(join(root,path),join(directory,path)) }
  return { root:directory,
    async write(path,value) { await writeFile(join(directory,path), Buffer.isBuffer(value) ? value : JSON.stringify(value)) },
    async reset() {
      for (const path of [ROLLOUT_APPROVAL,approval.feedback.path,...approval.batches.map(entry => entry.manifest.path)]) await copyFile(join(root,path),join(directory,path))
    },
    async dispose() { await rm(directory,{ recursive:true,force:true }) },
  }
}

test('rollout generator produces 44 winners and 45 verified assets, preserving prior batches and only Ancient Power supersession', async () => {
  const result = await generateAcceptedRuntime({ check:true })
  assert.equal(Object.keys(result.catalog.moves).length,44)
  assert.equal(Object.keys(result.catalog.assets).length,45)
  assert.equal(Object.keys(result.catalog.fxMoves).length,44)
  assert.deepEqual(result.catalog.provenance.batches.map(batch => batch.batchId), ['sync-001','sync-002','sync-003','sync-004','sync-005','sync-006','sync-007'])
  assert.deepEqual(result.catalog.provenance.supersedes, [{ moveId:'ancientpower',previousBatch:'sync-004',selectedBatch:'sync-006' }])
  const occurrences = new Map()
  for (const id of ['001','002','003']) {
    const prior = JSON.parse(await read(`tools/audio-import/review/sync-batch-${id}.final.json`))
    for (const move of prior.moves) {
      const selected=result.catalog.moves[move.id]
      assert.deepEqual(selected.segments,move.plan.segments);assert.equal(selected.visualRate,move.plan.visualRate)
      assert.equal(selected.visualRevision,move.visual.visualRevision);assert.equal(selected.visualDurationSeconds,move.visual.durationSeconds)
      assert.equal(selected.nativeCompatibility.sampleFrames,move.native.sampleFrames)
      occurrences.set(move.id,[`sync-${id}`])
    }
  }
  for(const batch of catalogs) for(const [id,plan] of Object.entries(batch.moves)) {
    occurrences.set(id,[...(occurrences.get(id)??[]),batch.provenance.batchId])
    if(batch.provenance.batchId==='sync-004'&&id==='ancientpower')continue
    assert.deepEqual(result.catalog.moves[id],plan)
  }
  assert.deepEqual([...occurrences].filter(([,batches])=>batches.length>1), [['ancientpower',['sync-004','sync-006']]])
  const ancient=catalogs.find(batch=>batch.provenance.batchId==='sync-006').moves.ancientpower
  assert.deepEqual(result.catalog.moves.ancientpower,ancient)
  assert.equal(ancient.visualAccent.id,'batch-six-ancientpower-v2')
  assert.equal(result.catalog.fxMoves['ancient-power'],'ancientpower')
  assert.equal(result.catalog.moves.psychic.accent.assetId,'source.hit-normal-damage')
  assert.doesNotMatch(result.generated,/previousReview|baseline|feedbackRecords|userAgent|sound_effects/)
  for(const asset of Object.values(result.catalog.assets)) {
    const bytes=await read(`public/audio/sfx/${asset.file}`)
    assert.equal(bytes.length,asset.bytes);assert.equal(sha256(bytes),asset.sha256)
  }
})

test('all Batch 4–7 compiled plans retain exact approved visual, native, source and candidate data with Batch 5 tapers only', () => {
  assert.deepEqual(rollout.batches.map(batch=>batch.id),Object.keys(ROLLOUT_IDS))
  for(const [index,batch] of rollout.batches.entries()) {
    const snapshot=snapshots.get(batch.id),catalog=catalogs[index]
    assert.equal(batch.status,'accepted');assert.equal(batch.reviewedRevision,snapshot.revision)
    assert.deepEqual(batch.moves.map(move=>move.id),ROLLOUT_IDS[batch.id])
    assert.deepEqual(batch.approval,approval.approval)
    for(const move of batch.moves) {
      const captured=snapshot.moves.find(row=>row.id===move.id)
      const record=batch.id==='sync-007'?feedback.records.find(row=>row.moveId===move.id):snapshot.feedbackRecords?.find(row=>row.moveId===move.id)
      const plan=captured.plan??captured.candidate,native=captured.native??record.native,compiled=catalog.moves[move.id]
      assert.deepEqual(move.plan,plan);assert.deepEqual(move.native,native)
      for(const key of ['asset','visual','visualAccent','notes'])assert.deepEqual(move[key],captured[key])
      assert.deepEqual(compiled.segments,plan.segments);assert.equal(compiled.visualRate,plan.visualRate)
      assert.equal(compiled.playbackRate,1);assert.equal(compiled.assetId,captured.asset.id)
      assert.equal(compiled.visualRevision,captured.visual.visualRevision);assert.equal(compiled.visualDurationSeconds,captured.visual.durationSeconds)
      assert.deepEqual(compiled.visualAccent,captured.visualAccent)
      assert.deepEqual(compiled.nativeCompatibility,{ browser:'Chrome',version:'152.0.0.0',sampleRate:native.sampleRate,sampleFrames:native.sampleFrames })
      assert.equal(compiled.taperEdits,batch.id==='sync-005'?true:undefined)
      assert.equal(Object.hasOwn(compiled,'taperEdits'),batch.id==='sync-005')
      const regions=planSyncAudition(plan,native,captured.visual)
      assert.ok(regions.every(region=>region.gainDb<=0&&region.delaySeconds+region.endSeconds-region.startSeconds<=120))
      const asset=catalog.assets[compiled.assetId]
      assert.equal(asset.file,`${captured.asset.sha256}.mp3`);assert.equal(asset.sha256,captured.asset.sha256)
      assert.equal(asset.reference.sampleFrames,captured.asset.decoded.sampleFrames)
    }
  }
  const five=catalogs[1].moves
  assert.equal(five.eruption.visualAccent.id,'batch-five-eruption-v4');assert.equal(five.blizzard.visualAccent.id,'batch-five-blizzard-v4')
  assert.equal(five.fireblast.visualAccent.id,'batch-five-fireblast-v3')
  assert.deepEqual(five.eruption.segments,[{startSeconds:2.86,endSeconds:6.67,soundAnchorSeconds:3.08,cueSeconds:.94,gainDb:0}])
})

test('final Batch 4, 5 and 7 pages preserve review playback routing and Batch 7 carries the captured keep decisions', async () => {
  for(const id of ['sync-004','sync-005','sync-007']) {
    const batch=rollout.batches.find(batch=>batch.id===id),served=await createSyncBatchManifest({ batch:id }),snapshot=snapshots.get(id)
    assert.equal(served.status,'accepted');assert.equal(served.reviewPlayback,snapshot.reviewPlayback)
    assert.equal(batch.reviewPlayback,snapshot.reviewPlayback);assert.deepEqual(served.moves,batch.moves)
    assert.equal(served.feedbackRecords,undefined);assert.equal(served.defaultMoveId,undefined)
    for(const move of served.moves) for(const key of ['candidate','baseline','previousReview'])assert.equal(Object.hasOwn(move,key),false)
  }
  assert.equal(rollout.batches[1].reviewPlayback,'batch-five-feedback-v4')
  assert.equal(rollout.batches[3].reviewPlayback,'batch-seven-v1')
  assert.equal(sha256(feedbackBytes),approval.feedback.sha256)
  assert.equal(feedback.revision,snapshots.get('sync-007').revision)
  assert.deepEqual(feedback.records.map(record=>record.moveId),ROLLOUT_IDS['sync-007'])
  assert.ok(feedback.records.every(record=>record.verdict==='keep'))
  for(const move of rollout.batches[3].moves) {
    const capture=feedback.records.find(record=>record.moveId===move.id)
    assert.deepEqual(move.plan,capture.plan);assert.deepEqual(move.native,capture.native);assert.deepEqual(move.visualAccent,capture.visualAccent)
  }
  // Rollout approval does not rewrite older recorded verdicts into fabricated keeps.
  const snapshot=snapshots.get('sync-005')
  assert.ok(snapshot.feedbackRecords.some(record=>record.verdict!=='keep'))
  assert.equal(sha256(approvalBytes),sha256(rollout.approvalBytes))
})

test('altered audio source, PCM, mapping, browser and invalid plans are rejected by runtime compilation', () => {
  const cases=[
    ['source SHA',v=>{v.rollout.batches[0].moves[0].asset.sha256='0'.repeat(64)}],
    ['source bytes',v=>{v.rollout.batches[0].moves[0].asset.bytes++}],
    ['source PCM',v=>{v.rollout.batches[0].moves[0].asset.decoded.pcmSha256='0'.repeat(64)}],
    ['manifest source',v=>{v.manifest.assets[v.rollout.batches[0].moves[0].asset.id].sha256='0'.repeat(64)}],
    ['FX mapping',v=>{v.rollout.batches[0].moves[0].fxId='invented'}],
    ['unselected source',v=>{v.rollout.batches[0].moves[0].asset.id='source.hit-normal-damage'}],
    ['Firefox decoder',v=>{v.rollout.batches[0].moves[0].native.userAgent='Firefox/155.0'}],
    ['Edge decoder',v=>{v.rollout.batches[0].moves[0].native.userAgent+=' Edg/152.0.0.0'}],
    ['native frame mismatch',v=>{v.rollout.batches[0].moves[0].native.sampleFrames+=1000}],
    ['invalid visual duration',v=>{v.rollout.batches[0].moves[0].visual.durationSeconds=0}],
    ['invalid visual rate',v=>{v.rollout.batches[0].moves[0].plan.visualRate=.5}],
    ['audio beyond source',v=>{v.rollout.batches[0].moves[0].plan.segments[0].endSeconds=120}],
    ['negative start',v=>{v.rollout.batches[0].moves[0].plan.segments[0].startSeconds=-1}],
    ['anchor beyond visual',v=>{v.rollout.batches[0].moves[0].plan.segments[0].cueSeconds=121}],
  ]
  for(const [label,mutate] of cases){const input=inputs();mutate(input);assert.throws(()=>compileRolloutRuntime(input),undefined,label)}
})

test('rollout compilation rejects positive gain and delayed endings beyond the production 120 second bound', () => {
  const amplified=inputs()
  amplified.rollout.batches[0].moves[0].plan.segments[0].gainDb=1
  assert.throws(()=>compileRolloutRuntime(amplified),/attenuation-only|bounded/)
  const delayed=inputs(),move=delayed.rollout.batches[0].moves[0]
  move.visual.durationSeconds=120;move.plan.visualRate=.75
  move.plan.segments=[{startSeconds:0,endSeconds:null,soundAnchorSeconds:0,cueSeconds:120,gainDb:0}]
  assert.ok(planSyncAudition(move.plan,move.native,move.visual)[0].delaySeconds>120,
    'the audition-valid plan exceeds the production scheduling bound')
  assert.throws(()=>compileRolloutRuntime(delayed),/attenuation-only|bounded/)
})

test('a valid unrelated dependency cannot replace a required playback path while retaining 73 unique pins', async () => {
  const copy=await fixture()
  try {
    const changed=structuredClone(approval)
    changed.playbackPins[0]={path:approval.feedback.path,sha256:sha256(feedbackBytes)}
    assert.equal(changed.playbackPins.length,73)
    assert.equal(new Set(changed.playbackPins.map(pin=>pin.path)).size,73)
    assert.equal(sha256(await readFile(join(copy.root,changed.playbackPins[0].path))),changed.playbackPins[0].sha256)
    await copy.write(ROLLOUT_APPROVAL,changed)
    await assert.rejects(readApprovedRollout({root:copy.root}),/playback evidence/)
  } finally {await copy.dispose()}
})

test('approval, manifests, recipe and rock bytes and captured feedback tampering reject without touching checkout evidence', async () => {
  const copy=await fixture()
  try {
    assert.equal((await readApprovedRollout({root:copy.root})).batches.length,4)
    for(const [label,mutate] of [
      ['approval source',v=>{v.approval.source='automatic-analysis'}],
      ['empty approval',v=>{v.approval.text=' '}],
      ['invalid date',v=>{v.approval.date='yesterday'}],
      ['batch order',v=>{v.batches.reverse()}],
      ['extra supersession',v=>{v.supersedes.push({moveId:'ember',previousBatch:'sync-004',selectedBatch:'sync-007'})}],
      ['wrong supersession',v=>{v.supersedes[0].selectedBatch='sync-007'}],
      ['missing dependency',v=>{v.playbackPins.pop()}],
      ['duplicate dependency',v=>{v.playbackPins[0]=v.playbackPins[1]}],
      ['changed dependency hash',v=>{v.playbackPins[0].sha256='0'.repeat(64)}],
      ['changed reviewed revision',v=>{v.batches[0].reviewedRevision='0'.repeat(64)}],
      ['changed manifest hash',v=>{v.batches[0].manifest.sha256='0'.repeat(64)}],
      ['changed feedback hash',v=>{v.feedback.sha256='0'.repeat(64)}],
    ]) {
      await copy.reset();const changed=structuredClone(approval);mutate(changed);await copy.write(ROLLOUT_APPROVAL,changed)
      await assert.rejects(readApprovedRollout({root:copy.root}),undefined,label)
    }
    for(const path of ['packages/battle-fx/src/review-batch-five-v4/eruption.js','packages/battle-fx/assets/rock.svg',approval.feedback.path,approval.batches[3].manifest.path]) {
      await copy.reset();const original=await read(path);await copy.write(path,Buffer.concat([original,Buffer.from('\n')]))
      await assert.rejects(readApprovedRollout({root:copy.root}),undefined,path)
      await copy.write(path,original)
    }
  } finally {await copy.dispose()}
  assert.equal(sha256(await read(ROLLOUT_APPROVAL)),sha256(approvalBytes))
  assert.equal(sha256(await read(approval.feedback.path)),sha256(feedbackBytes))
})

test('coherently rehashed unfinished keeps, changed candidate plans and mismatched visual feedback cannot fabricate Batch 7 approval', async () => {
  const copy=await fixture()
  try {
    for(const [label,mutate] of [
      ['unreviewed',v=>{v.records[0].verdict='unreviewed'}],
      ['different valid plan',v=>{v.records[0].plan.segments[0].cueSeconds+=.01}],
      ['invalid native capture',v=>{v.records[0].native.sampleFrames=0}],
      ['wrong visual accent',v=>{v.records[0].visualAccent.revision='0'.repeat(64)}],
      ['wrong capture revision',v=>{v.revision='0'.repeat(64)}],
      ['missing captured move',v=>{v.records.pop()}],
    ]) {
      await copy.reset();const changed=structuredClone(feedback),final=structuredClone(approval);mutate(changed)
      const bytes=Buffer.from(JSON.stringify(changed));final.feedback.sha256=sha256(bytes)
      await copy.write(approval.feedback.path,bytes);await copy.write(ROLLOUT_APPROVAL,final)
      await assert.rejects(readApprovedRollout({root:copy.root}),undefined,label)
    }
  } finally {await copy.dispose()}
})
