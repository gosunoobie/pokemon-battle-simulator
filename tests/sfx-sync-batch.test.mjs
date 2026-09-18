import test from 'node:test'
import assert from 'node:assert/strict'
import { planSyncAudition, validateSyncPlan, SYNC_LIMITS } from '../apps/sfx-bench/src/sync.js'

const native = { sampleRate: 48000, sampleFrames: 96000, durationSeconds: 2 }
const options = { durationSeconds: 2.25 }
const segment = patch => ({ startSeconds: 0, endSeconds: null, soundAnchorSeconds: 0, cueSeconds: 0, gainDb: -2, ...patch })
const plan = (patch = {}) => ({ visualRate: 1, segments: [segment()], ...patch })

test('sync baseline keeps actual native duration and normal audio playback without using reference frame counts', () => {
  for (const sampleRate of [44100, 48000]) {
    const info = { sampleRate, sampleFrames: sampleRate * 2, durationSeconds: 2 }
    assert.deepEqual(planSyncAudition(plan(), info, options), [{ startSeconds: 0, endSeconds: 2, delaySeconds: 0, gainDb: -2 }])
  }
  const shorter = { sampleRate: 48000, sampleFrames: 95040, durationSeconds: 1.98 }
  assert.equal(planSyncAudition(plan(), shorter, options)[0].endSeconds, 1.98)
})

test('sync candidates align each original-rate sound anchor against the chosen visual rate', () => {
  const candidate = plan({ visualRate: .8, segments: [
    segment({ startSeconds: .1, endSeconds: .5, soundAnchorSeconds: .2, cueSeconds: .5 }),
    segment({ startSeconds: .1, endSeconds: .5, soundAnchorSeconds: .2, cueSeconds: .84, gainDb: -3 }),
    segment({ startSeconds: .1, endSeconds: .5, soundAnchorSeconds: .2, cueSeconds: 1.2, gainDb: -4 }),
  ] })
  const regions = planSyncAudition(candidate, native, options)
  assert.equal(regions.length, 3)
  for (let i = 0; i < regions.length; i++) {
    const source = candidate.segments[i], region = regions[i]
    assert.equal(region.startSeconds, .1); assert.equal(region.endSeconds, .5)
    assert.equal(region.delaySeconds, source.cueSeconds / .8 - .1)
    assert.equal(region.gainDb, source.gainDb)
    assert.equal(region.playbackRate, undefined, 'sound is never pitch shifted with visual rate')
  }
  assert.deepEqual(validateSyncPlan(candidate, options), candidate)
})

test('invalid regions, sound anchors, rates, gains and cue times fail before audio scheduling', () => {
  for (const value of [undefined, NaN, Infinity, 0, .74, 1.26]) assert.throws(() => validateSyncPlan(plan({ visualRate: value }), options), /Visual rate/)
  for (const regions of [undefined, [], Array.from({ length: 9 }, () => segment())]) assert.throws(() => validateSyncPlan(plan({ segments: regions }), options), /regions/)
  for (const patch of [{ startSeconds: -.1 }, { startSeconds: NaN }, { endSeconds: undefined }, { endSeconds: 0 },
    { endSeconds: 121 }, { soundAnchorSeconds: -.1 }, { soundAnchorSeconds: 120 },
    { soundAnchorSeconds: .5, endSeconds: .5 }, { cueSeconds: -.1 }, { cueSeconds: 2.3 }, { cueSeconds: Infinity },
    { gainDb: -61 }, { gainDb: 7 }, { gainDb: NaN }]) {
    assert.throws(() => validateSyncPlan(plan({ segments: [segment(patch)] }), options), /Region 1/)
  }
  assert.throws(() => validateSyncPlan(plan({ segments: [segment({ soundAnchorSeconds: .2, cueSeconds: .1 })] }), options), /before the animation/)
  assert.throws(() => validateSyncPlan(plan({ visualRate: 1.25, segments: [segment({ soundAnchorSeconds: .5, cueSeconds: .5 })] }), options), /before the animation/)
  for (const durationSeconds of [0, NaN, Infinity, 121]) assert.throws(() => validateSyncPlan(plan(), { durationSeconds }), /duration/)
})

test('native buffer boundaries are explicit and never silently truncated or stretched to fit a candidate', () => {
  for (const patch of [{ endSeconds: 2.01 }, { startSeconds: 2, soundAnchorSeconds: 2, cueSeconds: 2 },
    { soundAnchorSeconds: 2, cueSeconds: 2 }]) {
    assert.throws(() => planSyncAudition(plan({ segments: [segment(patch)] }), native, options), /outside this native recording/)
  }
  for (const info of [null, { ...native, durationSeconds: 1.9 }, { ...native, sampleRate: 0 },
    { ...native, sampleRate: 7999 }, { ...native, sampleFrames: .5 }, { ...native, sampleFrames: Infinity }]) {
    assert.throws(() => planSyncAudition(plan(), info, options), /native recording/)
  }
})

test('validation produces independent editable data without modifying or approving its input', () => {
  const original = plan(), snapshot = structuredClone(original), validated = validateSyncPlan(original, options)
  validated.segments[0].gainDb = -5
  assert.deepEqual(original, snapshot)
  assert.equal(validated.status, undefined); assert.equal(validated.approvalFingerprint, undefined)
  assert.equal(SYNC_LIMITS.maxSegments, 8)
})
