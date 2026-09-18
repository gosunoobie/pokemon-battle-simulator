import test from 'node:test'
import assert from 'node:assert/strict'
import { createMoveAudio } from '../apps/shared/battle/moveAudio.js'
import { createBattleAudio } from '../apps/shared/battle/audio.js'
import { createReviewedBattleFx } from '../apps/shared/battle/reviewedFx.js'
import { ACCEPTED_SFX_RUNTIME_CATALOG, getAcceptedMoveSoundPlan, getAcceptedFxSoundPlan } from '@battle/battle-sfx/accepted-runtime'
import { technicalSoundPack } from '../apps/shared/battle/draftSoundPack.js'

const CHROME = 'Mozilla/5.0 Chrome/152.0.0.0 Safari/537.36'
const infos = () => Object.fromEntries(Object.values(ACCEPTED_SFX_RUNTIME_CATALOG.moves).flatMap(plan => [plan, ...(plan.accent ? [plan.accent] : [])].map(layer => [layer.assetId,
  { sampleRate: layer.nativeCompatibility.sampleRate, sampleFrames: layer.nativeCompatibility.sampleFrames }])))
function harness() {
  const native = infos(), voices = [], loads = []
  let time = 10, state = { enabled: true, volume: .6, suspended: false, status: 'ready' }
  const player = {
    readyInfo: id => native[id] ?? null,
    contextTime: () => time,
    preload(ids) { loads.push(ids); return Promise.resolve() },
    playSegment(id, options) {
      let resolve
      const voice = { id, options, reason: null, finished: new Promise(done => { resolve = done }),
        end(reason = 'ended') { if (voice.reason) return; voice.reason = reason; resolve({ reason }) },
        cancel() { voice.end('cancelled') },
      }
      voices.push(voice); return voice
    },
    stopScope(scope) { voices.filter(row => row.options.scope === scope).forEach(row => row.cancel()) },
    stop() { voices.forEach(row => row.cancel()) },
    getState: () => state,
    setEnabled(value) { state = { ...state, enabled: value } },
    setSuspended() {}, setCategoryEnabled() {},
    unlock: () => Promise.resolve(true), dispose() { player.stop() },
  }
  return { player, native, voices, loads, advance(seconds) { time += seconds } }
}
const start = run => run.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: 1000 })
const moveAudio = (h, options = {}) => createMoveAudio({ player: h.player, userAgent: CHROME,
  getPlan: getAcceptedFxSoundPlan, getCanonicalPlan: getAcceptedMoveSoundPlan, now: () => 1000, ...options })

test('all eighteen accepted finals schedule exact auditioned native regions, attenuation and cosmetic delays', () => {
  const h = harness(), audio = moveAudio(h), plans = Object.values(ACCEPTED_SFX_RUNTIME_CATALOG.moves)
  assert.equal(plans.length, 18)
  for (const plan of plans) {
    const first = h.voices.length, run = audio.begin({ moveId: plan.fxId })
    start(run)
    const voices = h.voices.slice(first)
    const expected = [...plan.segments.map(segment => ({ assetId: plan.assetId, segment })), ...(plan.accent ? [plan.accent] : [])]
    assert.equal(voices.length, expected.length, plan.moveId)
    voices.forEach((voice, index) => {
      const { segment: region, assetId } = expected[index]
      assert.equal(voice.id, assetId)
      assert.equal(voice.options.startSeconds, region.startSeconds)
      assert.equal(voice.options.endSeconds, region.endSeconds ?? h.native[assetId].sampleFrames / h.native[assetId].sampleRate)
      assert.ok(Math.abs(voice.options.when - (10 + region.cueSeconds / plan.visualRate - (region.soundAnchorSeconds - region.startSeconds))) < 1e-9)
      assert.equal(voice.options.gainDb, region.gainDb)
      assert.equal(voice.options.playbackRate, undefined)
    })
    run.finish({ status: 'completed' })
  }
  const thunder = h.voices.find(voice => voice.id === 'source.thunderbolt')
  assert.ok(Math.abs(thunder.options.when - 10 + thunder.options.endSeconds - 2) < 1e-9)
  const kicks = h.voices.filter(voice => voice.id === 'source.triple-kick-1hit')
  assert.deepEqual(kicks.map(voice => Number((voice.options.when - 10).toFixed(2))), [.24, .58, .94])
  audio.dispose()
})

test('accepted native decoder evidence is strict and never falls back to an old technical or pilot plan', () => {
  for (const userAgent of ['Mozilla/5.0 Firefox/145.0', CHROME, CHROME.replace('152.', '153.')]) {
    const h = harness(), audio = createBattleAudio({ playerFactory: () => h.player, userAgent,
      technicalSoundPack, storage: null, document: null })
    if (userAgent === CHROME) h.native['source.body-slam'].sampleFrames++
    audio.warmMoves(['body-slam', 'absorb'], { fxIds: true })
    for (const moveId of ['body-slam', 'absorb']) {
      const run = audio.previewMove({ moveId })
      run.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
    }
    if (userAgent === CHROME) {
      assert.equal(h.voices.length, 1)
      assert.equal(h.voices[0].id, 'source.absorb')
      assert.ok(h.voices[0].options.when > 10, 'accepted delayed Absorb replaces the earlier pilot at time zero')
    } else {
      assert.equal(h.voices.length, 0, 'unsupported accepted moves stay silent instead of using old drafts')
      assert.equal(h.loads.flat().some(id => id === 'source.body-slam' || id === 'source.absorb'), false)
    }
    audio.dispose()
  }
})

test('accepted Triple Kick owns all three scheduled voices and stale or drifting playback cancels them together', () => {
  const h = harness(), audio = moveAudio(h), old = audio.begin({ moveId: 'triple-kick', key: 'turn:1' })
  start(old); assert.equal(h.voices.length, 3)
  const fresh = audio.begin({ moveId: 'body-slam', key: 'turn:2' }); start(fresh)
  h.advance(.5)
  old.onPresentation({ type: 'frame', timelineSeconds: .1 })
  assert.ok(h.voices.slice(0, 3).every(voice => voice.reason === 'cancelled'))
  assert.equal(h.voices[3].reason, null)
  fresh.onPresentation({ type: 'frame', timelineSeconds: .5 })
  assert.equal(h.voices[3].reason, null, 'elapsed cosmetic time follows the audio clock at the accepted 90% visual pace')
  start(audio.begin({ moveId: 'triple-kick', key: 'turn:1' }))
  assert.equal(h.voices.length, 4)
  audio.dispose(); assert.equal(h.voices[3].reason, 'cancelled')
})

test('invalid accepted region bounds, negative delays and gain or pace changes fail closed', () => {
  const original = getAcceptedMoveSoundPlan('thunderbolt')
  for (const change of [plan => { plan.visualRate = 0 }, plan => { plan.playbackRate = 2 },
    plan => { plan.segments[0].startSeconds = -1 }, plan => { plan.segments[0].endSeconds = 4 },
    plan => { plan.segments[0].soundAnchorSeconds = 2 }, plan => { plan.segments[0].cueSeconds = .1 },
    plan => { plan.segments[0].gainDb = 1 }, plan => { plan.segments = [] }]) {
    const plan = structuredClone(original); change(plan)
    const h = harness(), audio = moveAudio(h, { getPlan: () => plan })
    start(audio.begin({ moveId: plan.fxId })); assert.equal(h.voices.length, 0)
    assert.equal(audio.diagnostics().unsupported, 1); audio.dispose()
  }
})

test('reviewed visuals keep accepted pace independent of sound, with normal pace for reduced motion and untouched moves', () => {
  const calls = [], factoryOptions = [], handle = { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
  let disposals = 0
  const fx = createReviewedBattleFx({ now: () => 1000, createClockedFx(options) {
    factoryOptions.push(options)
    return { play(request, options) { calls.push({ request, options }); return handle }, dispose() { disposals++ } }
  } })
  const scene = {}, onCue = () => {}
  assert.equal(fx.play({ moveId: 'body-slam' }, { scene, onCue }), handle)
  assert.equal(calls.at(-1).options.visualRate, .9)
  assert.equal(calls.at(-1).options.scene, scene); assert.equal(calls.at(-1).options.onCue, onCue)
  for (const [moveId, visualRate] of [['ice-beam', .8], ['flamethrower', .75], ['giga-drain', .8], ['psychic', 1]]) {
    fx.play({ moveId }); assert.equal(calls.at(-1).options.visualRate, visualRate)
  }
  for (const [request, options] of [[{ moveId: 'body-slam' }, { reducedMotion: true }],
    [{ moveId: 'body-slam', phase: 'prepare' }, {}], [{ moveId: 'body-slam', outcome: 'miss' }, {}], [{ moveId: 'tackle' }, {}]]) {
    fx.play(request, options); assert.equal(calls.at(-1).options.visualRate, 1)
  }
  assert.equal(typeof factoryOptions[0].now, 'function')
  fx.dispose(); assert.equal(disposals, 1)
})

test('accepted Psychic warms both recordings and owns two native-speed voices on one clock', async () => {
  const h = harness(), audio = moveAudio(h)
  assert.deepEqual(audio.warm(['psychic', 'psychic']), ['source.psychic', 'source.hit-normal-damage'])
  assert.deepEqual(h.loads, [['source.psychic', 'source.hit-normal-damage']])
  const run = audio.begin({ moveId: 'psychic', key: 'psychic:1' })
  start(run)
  assert.equal(h.voices.length, 2)
  const [base, accent] = h.voices
  assert.equal(base.options.scope, accent.options.scope)
  assert.ok(Math.abs(base.options.when - 10.06) < 1e-9)
  assert.ok(Math.abs(accent.options.when - 10.85) < 1e-9)
  assert.equal(accent.options.gainDb, -6)
  assert.equal(accent.options.startSeconds, 0)
  assert.equal(accent.options.endSeconds, 43348 / 48000)
  run.finish({ status: 'completed' })
  assert.equal(base.reason, null); assert.equal(accent.reason, null)
  run.cancel()
  assert.equal(base.reason, 'cancelled'); assert.equal(accent.reason, 'cancelled')
  start(audio.begin({ moveId: 'psychic', key: 'psychic:1' }))
  assert.equal(h.voices.length, 2, 'duplicate result must not replay either layer')
  audio.dispose()
})

test('accepted Psychic fails closed for missing, changed or unsupported accent buffers and invalid regions', () => {
  for (const change of [
    h => { delete h.native['source.hit-normal-damage'] },
    h => { h.native['source.hit-normal-damage'].sampleFrames++ },
    h => { h.native['source.hit-normal-damage'].sampleRate = 44100 },
  ]) {
    const h = harness(); change(h)
    const audio = moveAudio(h); start(audio.begin({ moveId: 'psychic' }))
    assert.equal(h.voices.length, 0, 'neither layer starts until both native recordings validate')
    audio.dispose()
  }
  for (const change of [
    plan => { plan.accent.nativeCompatibility.version = '153.0.0.0' },
    plan => { plan.accent.segment.gainDb = 1 },
    plan => { plan.accent.segment.cueSeconds = 0 },
    plan => { plan.accent.segment.endSeconds = 9 },
    plan => { plan.segments = Array(8).fill(plan.segments[0]) },
  ]) {
    const plan = structuredClone(getAcceptedMoveSoundPlan('psychic')); change(plan)
    const h = harness(), audio = moveAudio(h, { getPlan: () => plan })
    start(audio.begin({ moveId: 'psychic' })); assert.equal(h.voices.length, 0)
    audio.dispose()
  }
})

test('accepted layered playback cancels both voices on drift, failure and superseding host runs', () => {
  const h = harness(), audio = moveAudio(h), run = audio.begin({ moveId: 'psychic' })
  start(run); h.advance(.6)
  run.onPresentation({ type: 'frame', timelineSeconds: .1 })
  assert.ok(h.voices.every(voice => voice.reason === 'cancelled'))
  const next = audio.begin({ moveId: 'psychic' }); start(next); next.finish({ status: 'failed' })
  assert.ok(h.voices.every(voice => voice.reason === 'cancelled'))
  audio.dispose()
  const host = createBattleAudio({ playerFactory: () => h.player, userAgent: CHROME, storage: null, document: null, technicalSoundPack })
  const stale = host.previewMove({ moveId: 'psychic' })
  stale.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
  host.previewMove({ moveId: 'ice-beam' })
  assert.ok(h.voices.every(voice => voice.reason === 'cancelled'))
  stale.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
  assert.equal(h.voices.length, 6, 'cancelled old run cannot restart its accepted accent')
  host.dispose()
})
