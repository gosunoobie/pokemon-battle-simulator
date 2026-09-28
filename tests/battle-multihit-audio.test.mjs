import test from 'node:test'
import assert from 'node:assert/strict'
import { createMoveAudio } from '../apps/shared/battle/moveAudio.js'
import { getFxSoundPlan } from '../packages/battle-sfx/src/runtime.js'
import { getAcceptedFxSoundPlan } from '../packages/battle-sfx/src/accepted-runtime.js'
import { getDraftFxSoundPlan } from '../packages/battle-sfx/src/draft-runtime.js'

const CHROME = 'Mozilla/5.0 Chrome/152.0.0.0 Safari/537.36'
const tick = () => new Promise(resolve => setImmediate(resolve))
const planFor = id => getAcceptedFxSoundPlan(id) ?? getFxSoundPlan(id) ?? getDraftFxSoundPlan(id)
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)

function harness(t) {
  const voices = [], cached = new Map()
  let time = 10
  const player = {
    readyInfo: id => cached.get(id) ?? null,
    contextTime: () => time,
    preload: async () => {},
    stopScope(scope) { voices.filter(voice => voice.options.scope === scope).forEach(voice => voice.cancel()) },
    playSegment(id, options) {
      let resolve
      const voice = { id, options, createdAt: time, reason: null,
        finished: new Promise(done => { resolve = done }),
        end(reason = 'ended') { if (!voice.reason) { voice.reason = reason; resolve({ reason }) } },
        cancel() { voice.end('cancelled') },
      }
      voices.push(voice)
      return voice
    },
  }
  const audio = createMoveAudio({ player, getPlan: planFor, getCanonicalPlan: planFor,
    allowTechnicalDrafts: true, userAgent: CHROME, now: () => 1000 })
  t.after(() => audio.dispose())
  function begin(moveId, hitCount, hitTimes, extra = {}) {
    const plan = planFor(moveId), measured = plan.nativeCompatibility ?? plan.reference
    cached.set(plan.assetId, { sampleRate: measured.sampleRate, sampleFrames: measured.sampleFrames })
    const run = audio.begin({ moveId, ...(hitCount === undefined ? {} : { hitCount }), ...extra })
    const cue = { type: 'start', timelineSeconds: 0, observedAtMs: 1000, durationSeconds: 4,
      ...(hitTimes === undefined ? {} : { hitTimes }) }
    run.onPresentation(cue)
    return { run, cue, plan }
  }
  return { audio, voices, begin,
    frame(run, seconds, clockSeconds = seconds) { time = 10 + clockSeconds; run.onPresentation({ type: 'frame', timelineSeconds: seconds }) },
  }
}

test('five Bullet Seed contacts schedule one-hit recordings from the observed clock without occupying all future voices', async t => {
  const h = harness(t), hits = [.7, 1.1, 1.5, 1.9, 2.3]
  const { run, cue } = h.begin('bullet-seed', hits.length, hits)
  assert.equal(h.voices.length, 0, 'wind-up allocates no distant future voices')
  for (const [index, contact] of hits.entries()) {
    h.frame(run, contact - .06)
    assert.equal(h.voices.length, index + 1)
    const voice = h.voices[index]
    assert.equal(voice.id, 'source.bullet-seed-1hit')
    close(voice.options.startSeconds, 0)
    close(voice.options.when, 10 + contact)
    assert.ok(voice.createdAt >= 10 + contact - .08)
    run.onPresentation(cue)
    h.frame(run, contact)
    assert.equal(h.voices.length, index + 1, 'duplicate observations do not replay a contact')
    voice.end()
    await tick()
    assert.equal(h.audio.diagnostics().activeRuns, index === hits.length - 1 ? 0 : 1,
      'pending contacts retain ownership after earlier voices end')
  }
  run.finish({ status: 'completed' })
  assert.equal(h.audio.diagnostics().started, 1)
})

test('Triple Kick uses the approved .26 second source anchor against actual wall-clock contacts and partial hit counts', t => {
  for (const hits of [[.625], [.625, 1.05], [.625, 1.05, 1.5]]) {
    const h = harness(t), { run } = h.begin('triple-kick', hits.length, hits)
    for (const contact of hits) h.frame(run, contact - .26 - .04)
    assert.equal(h.voices.length, hits.length)
    h.voices.forEach((voice, index) => {
      assert.equal(voice.id, 'source.triple-kick-1hit')
      close(voice.options.when, 10 + hits[index] - .26)
      close(voice.options.endSeconds, 26731 / 48000)
      assert.equal(voice.options.gainDb, 0)
    })
    run.finish({ status: 'completed' })
    h.frame(run, 3)
    assert.equal(h.voices.length, hits.length, 'a shortened sequence has no remaining approved-default strikes')
  }
})

test('each explicitly selected one-hit recording follows its actual count without authored sound trims', t => {
  for (const id of ['double-slap', 'comet-punch', 'fury-attack', 'fury-swipes', 'arm-thrust',
    'pin-missile', 'spike-cannon', 'icicle-spear', 'barrage', 'bone-rush', 'rock-blast', 'double-kick', 'twineedle', 'bonemerang']) {
    const h = harness(t), { run, plan } = h.begin(id, 2, [.7, 1.1])
    h.frame(run, .64); h.frame(run, 1.04)
    assert.equal(h.voices.length, 2, id)
    h.voices.forEach((voice, index) => {
      assert.equal(voice.id, plan.assetId)
      close(voice.options.startSeconds, 0)
      assert.equal(voice.options.gainDb, plan.segments[0].gainDb)
      close(voice.options.when, 10 + [.7, 1.1][index])
    })
  }
})

test('Beat Up preserves one existing recording because no individual strike region is verified', t => {
  const h = harness(t), hits = [.5, .7, .9, 1.1, 1.3, 1.5]
  const { run, plan } = h.begin('beat-up', hits.length, hits)
  for (const contact of hits) h.frame(run, contact)
  assert.equal(h.voices.length, 1)
  assert.equal(h.voices[0].id, 'source.beat-up')
  assert.equal(h.voices[0].options.when, undefined)
  assert.equal(h.voices[0].options.startSeconds, 0)
  close(h.voices[0].options.endSeconds, plan.reference.sampleFrames / plan.reference.sampleRate)
})

test('uncounted callers preserve their existing start-time and approved three-kick playback', t => {
  for (const [id, expected] of [['bullet-seed', 1], ['triple-kick', 3], ['beat-up', 1]]) {
    const h = harness(t)
    h.begin(id)
    assert.equal(h.voices.length, expected)
    if (id === 'triple-kick') h.voices.forEach((voice, index) => close(voice.options.when, 10 + [.24, .58, .94][index]))
    else assert.equal(h.voices[0].options.when, undefined)
  }
})

test('cancellation, failure, clock drift and dropped frames clear pending hits and every owned voice', t => {
  for (const stop of [({ run }) => run.cancel(), ({ run }) => run.finish({ status: 'failed' }),
    ({ h }) => h.audio.stop(), ({ h, run }) => h.frame(run, .7, 1), ({ h, run }) => h.frame(run, 1.4)]) {
    const h = harness(t), { run } = h.begin('double-slap', 3, [.5, 1, 1.5])
    h.frame(run, .44)
    assert.equal(h.voices.length, 1)
    stop({ h, run })
    assert.equal(h.voices[0].reason, 'cancelled')
    h.frame(run, 1.5)
    assert.equal(h.voices.length, 1, 'cancelled queue cannot revive')
    assert.equal(h.audio.diagnostics().activeRuns, 0)
  }
})

test('natural completion permits heard tails but stops unscheduled contacts and still owns cancellation', async t => {
  const h = harness(t), { run } = h.begin('double-kick', 2, [.5, 1])
  h.frame(run, .44)
  run.finish({ status: 'completed' })
  assert.equal(h.voices[0].reason, null)
  h.frame(run, .94)
  assert.equal(h.voices.length, 1)
  assert.equal(h.audio.diagnostics().activeRuns, 1)
  h.audio.stop()
  assert.equal(h.voices[0].reason, 'cancelled')
  await tick()
  assert.equal(h.audio.diagnostics().activeRuns, 0)
})

test('malformed counts or clocks fail silent before allocation and reduced motion remains silent', t => {
  for (const [count, hits] of [[0, []], [6, [.3, .5, .7, .9, 1.1, 1.3]], [2, [.5]], [2, [.5, .5]],
    [2, [.5, NaN]], [2, [-.5, .5]], [2, [.5, 5]], [2, undefined]]) {
    const h = harness(t)
    h.begin('bullet-seed', count, hits)
    assert.equal(h.voices.length, 0)
    assert.equal(h.audio.diagnostics().unsupported, 1)
  }
  const h = harness(t)
  const { run } = h.begin('triple-kick', 1, [.2])
  assert.equal(h.voices.length, 0, 'a source anchor before timeline zero cannot be scheduled')
  run.cancel()
  const reduced = h.audio.begin({ moveId: 'triple-kick', hitCount: 2 })
  reduced.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: 1000, reducedMotion: true })
  assert.equal(h.voices.length, 0)
})
