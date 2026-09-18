import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSyncFeedback, syncFeedbackIssues } from '../apps/sfx-bench/src/syncFeedback.js'
import { planSyncAudition } from '../apps/sfx-bench/src/sync.js'

const manifest = { id: 'sync-test', revision: 'revision-1', moves: ['move-a', 'move-b'].map(id => ({ id, visual: { durationSeconds: 2 } })) }
const native = { sampleRate: 48000, sampleFrames: 48000, durationSeconds: 1, userAgent: 'Test browser' }
function fixture() {
  return { schemaVersion: 1, kind: 'battle-sfx-sync-feedback', batchId: manifest.id, revision: manifest.revision,
    records: manifest.moves.map(move => ({ moveId: move.id, verdict: 'keep', notes: `Keep notes for ${move.id}`, native: null,
      plan: { visualRate: 1, segments: [{ startSeconds: 0, endSeconds: null, soundAnchorSeconds: 0, cueSeconds: 0, gainDb: -3 }] } })) }
}

test('a cleared tuning field saves, reloads and exports without losing either move’s notes', () => {
  const state = fixture()
  state.records[0].plan.segments[0].cueSeconds = ''
  const saved = JSON.stringify(normalizeSyncFeedback(state, manifest))
  const reloaded = normalizeSyncFeedback(JSON.parse(saved), manifest)
  assert.equal(reloaded.records[0].plan.segments[0].cueSeconds, '')
  assert.equal(reloaded.records[0].notes, 'Keep notes for move-a')
  assert.equal(reloaded.records[1].notes, 'Keep notes for move-b')
  assert.equal(reloaded.records[0].verdict, 'unreviewed')
  assert.equal(reloaded.records[1].verdict, 'keep')
  assert.doesNotThrow(() => JSON.stringify(normalizeSyncFeedback(reloaded, manifest)))
  assert.throws(() => planSyncAudition(reloaded.records[0].plan, native, manifest.moves[0].visual), /invalid numbers/)
})

test('out-of-range draft tuning is retained without becoming playable or reviewed', () => {
  const state = fixture()
  state.records[0].plan.visualRate = .1
  state.records[1].plan.segments[0].cueSeconds = -2
  const normalized = normalizeSyncFeedback(state, manifest)
  assert.equal(normalized.records[0].plan.visualRate, .1)
  assert.equal(normalized.records[1].plan.segments[0].cueSeconds, -2)
  assert.ok(normalized.records.every(record => record.verdict === 'unreviewed'))
  assert.ok(normalized.records.every((record, index) => syncFeedbackIssues(record, manifest.moves[index].visual).length))
})

test('known native-buffer bounds remain strict when draft feedback is reloaded', () => {
  const state = fixture()
  state.records[0].native = native
  state.records[0].plan.segments[0].endSeconds = 1.1
  const normalized = normalizeSyncFeedback(state, manifest)
  assert.equal(normalized.records[0].verdict, 'unreviewed')
  assert.equal(normalized.records[0].plan.segments[0].endSeconds, 1.1)
  assert.match(syncFeedbackIssues(normalized.records[0], manifest.moves[0].visual).join(' '), /outside this native recording/)
})

test('valid feedback round-trips with independent copies and unchanged verdicts', () => {
  const state = fixture()
  state.records[0].native = native
  const normalized = normalizeSyncFeedback(state, manifest)
  assert.deepEqual(normalized, state)
  normalized.records[0].notes = 'Changed after reload'
  normalized.records[0].plan.visualRate = .9
  assert.equal(state.records[0].notes, 'Keep notes for move-a')
  assert.equal(state.records[0].plan.visualRate, 1)
})

test('structural corruption, arbitrary values and oversized notes are still rejected', () => {
  const cases = [
    state => { state.records[0].plan.segments[0].cueSeconds = { value: 1 } },
    state => { state.records[0].plan.segments[0].cueSeconds = 'not a number' },
    state => { state.records[0].plan.visualRate = Infinity },
    state => { state.records[0].plan.extra = true },
    state => { state.records[0].notes = 'x'.repeat(4001) },
    state => { state.records[0].native = { ...native, sampleFrames: 1 } },
    state => { state.records[0].verdict = 'approved' },
  ]
  for (const mutate of cases) { const state = fixture(); mutate(state); assert.throws(() => normalizeSyncFeedback(state, manifest), /Invalid saved/) }
})

test('wrong revisions and duplicated or missing moves cannot replace the saved batch', () => {
  const state = fixture()
  assert.throws(() => normalizeSyncFeedback({ ...state, revision: 'older' }, manifest), /different batch revision/)
  assert.throws(() => normalizeSyncFeedback({ ...state, records: [state.records[0]] }, manifest), /different batch revision/)
  assert.throws(() => normalizeSyncFeedback({ ...state, records: [state.records[0], state.records[0]] }, manifest), /Invalid saved feedback/)
})

function accentedFixture() {
  const state = fixture(), subject = structuredClone(manifest)
  subject.moves[0].accent = { asset: { id: 'source.hit-normal-damage', sha256: 'a'.repeat(64) } }
  state.records[0].accent = { assetId: subject.moves[0].accent.asset.id, sha256: subject.moves[0].accent.asset.sha256,
    segment: { startSeconds: 0, endSeconds: null, soundAnchorSeconds: .1, cueSeconds: .95, gainDb: -6 }, native: null }
  return { state, subject }
}

test('new impact accent cannot inherit an old keep and stores its independent native measurement', () => {
  const { state, subject } = accentedFixture()
  const initial = normalizeSyncFeedback(state, subject)
  assert.equal(initial.records[0].verdict, 'unreviewed')
  assert.equal(initial.records[1].verdict, 'keep')
  assert.equal(initial.records[0].notes, state.records[0].notes)
  state.records[0].accent.native = { ...native, sampleFrames: 24000, durationSeconds: .5 }
  assert.equal(normalizeSyncFeedback(state, subject).records[0].verdict, 'unreviewed')
  state.records[0].native = native
  const reviewed = normalizeSyncFeedback(state, subject)
  assert.equal(reviewed.records[0].verdict, 'keep')
  assert.equal(reviewed.records[0].accent.native.durationSeconds, .5)
  assert.deepEqual(reviewed.records[0].native, native)
})

test('accent tuning drafts retain notes, clear verdicts and respect their own native bounds', () => {
  const { state, subject } = accentedFixture()
  state.records[0].accent.native = native
  state.records[0].accent.segment.cueSeconds = ''
  const draft = normalizeSyncFeedback(state, subject)
  assert.equal(draft.records[0].accent.segment.cueSeconds, '')
  assert.equal(draft.records[0].verdict, 'unreviewed')
  assert.equal(draft.records[0].notes, state.records[0].notes)
  state.records[0].accent.segment.cueSeconds = .95
  state.records[0].accent.segment.endSeconds = 1.1
  assert.equal(normalizeSyncFeedback(state, subject).records[0].verdict, 'unreviewed')
  assert.match(syncFeedbackIssues(state.records[0], subject.moves[0].visual).join(' '), /outside this native recording/)
})

test('accent asset identity, measurements and structure must match the current subject', () => {
  for (const mutate of [
    state => { state.records[0].accent.assetId = 'unrelated-source' },
    state => { state.records[0].accent.sha256 = 'b'.repeat(64) },
    state => { state.records[0].accent.native = { ...native, sampleFrames: 1 } },
    state => { delete state.records[0].accent },
    state => { state.records[1].accent = structuredClone(state.records[0].accent) },
  ]) {
    const { state, subject } = accentedFixture(); mutate(state)
    assert.throws(() => normalizeSyncFeedback(state, subject), /Invalid saved/)
  }
})
