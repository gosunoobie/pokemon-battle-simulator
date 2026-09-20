import test from 'node:test'
import assert from 'node:assert/strict'
import { createMoveAudio } from '../apps/shared/battle/moveAudio.js'
import { createBattleAudio } from '../apps/shared/battle/audio.js'
import { createSimulationAudio } from '../apps/simulation/src/audio.js'
import { createPreviewAudio } from '../apps/game/src/presentation/audio.js'
import { ACCEPTED_SFX_RUNTIME_CATALOG, getAcceptedFxSoundPlan, getAcceptedMoveSoundPlan } from '@battle/battle-sfx/accepted-runtime'
import { getMoveSoundPlan } from '@battle/battle-sfx/runtime'

const browsers = {
  'newer Chrome': 'Mozilla/5.0 Chrome/153.0.0.0 Safari/537.36',
  Safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  Firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:145.0) Gecko/20100101 Firefox/145.0',
}
const plans = Object.values(ACCEPTED_SFX_RUNTIME_CATALOG.moves)
const layers = plan => [plan, ...(plan.accent ? [plan.accent] : [])]
const duration = info => info.sampleFrames / info.sampleRate
function harness(sampleRate = 48000) {
  const infos = Object.fromEntries(plans.flatMap(plan => layers(plan).map(layer => [layer.assetId, {
    sampleRate,
    sampleFrames: Math.round(layer.nativeCompatibility.sampleFrames / layer.nativeCompatibility.sampleRate * sampleRate),
  }])))
  const voices = [], loads = [], resolved = []
  let state = { enabled: true, volume: .6, suspended: false, status: 'ready' }, onState = () => {}
  const publish = patch => { state = { ...state, ...patch }; onState(state) }
  const player = {
    readyInfo: id => infos[id] ?? null,
    contextTime: () => 10,
    preload(ids) { loads.push([...ids]); return Promise.resolve() },
    playSegment(id, options) {
      if (!state.enabled || state.suspended) return null
      let resolve
      const voice = { id, options, reason: null, finished: new Promise(done => { resolve = done }),
        cancel() { if (!voice.reason) { voice.reason = 'cancelled'; resolve({ reason: 'cancelled' }) } },
      }
      voices.push(voice); return voice
    },
    stopScope(scope) { voices.filter(voice => voice.options.scope === scope).forEach(voice => voice.cancel()) },
    stop() { voices.forEach(voice => voice.cancel()) },
    getState: () => state,
    setEnabled: enabled => publish({ enabled }),
    setVolume: volume => publish({ volume }),
    setSuspended: suspended => publish({ suspended }),
    setCategoryEnabled() {},
    unlock: () => Promise.resolve(true),
    dispose() { player.stop() },
  }
  return { player, infos, voices, loads, resolved,
    playerFactory(config) {
      onState = config.onState
      for (const id of Object.keys(infos)) resolved.push(config.resolveAsset(id))
      return player
    },
  }
}
const start = run => run.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: 1000 })
const createAudio = (h, userAgent, options = {}) => createMoveAudio({ player: h.player, userAgent,
  getPlan: getAcceptedFxSoundPlan, getCanonicalPlan: getAcceptedMoveSoundPlan, now: () => 1000, ...options })

function assertRegions(h, plan, voices) {
  const expected = [...plan.segments.map(segment => ({ assetId: plan.assetId, segment })), ...(plan.accent ? [plan.accent] : [])]
  assert.equal(voices.length, expected.length, `${plan.fxId} must play its entire approved mix`)
  for (const [index, voice] of voices.entries()) {
    const { assetId, segment } = expected[index]
    assert.equal(voice.id, assetId)
    assert.equal(voice.options.startSeconds, segment.startSeconds, 'approved seconds are not reinterpreted as decoder frames')
    assert.equal(voice.options.endSeconds, segment.endSeconds ?? duration(h.infos[assetId]))
    const expectedWhen = 10 + segment.cueSeconds / plan.visualRate - (segment.soundAnchorSeconds - segment.startSeconds)
    assert.ok(Math.abs((voice.options.when ?? 10) - expectedWhen) < 1e-9, `${plan.fxId} must retain its approved cue alignment`)
    assert.equal(voice.options.gainDb, segment.gainDb)
    assert.equal(voice.options.category, 'sfx')
    assert.equal(voice.options.playbackRate, undefined, 'no pitch or playback-speed workaround')
    assert.equal(voice.options.taperEdits, plan.taperEdits)
  }
}

for (const [browser, userAgent] of Object.entries(browsers)) {
  for (const sampleRate of [44100, 48000]) {
    test(`all 44 approved moves warm and retain their accepted regions on ${browser} at ${sampleRate} Hz`, () => {
      assert.equal(plans.length, 44)
      const h = harness(sampleRate), audio = createAudio(h, userAgent)
      for (let offset = 0; offset < plans.length; offset += 16) {
        const batch = plans.slice(offset, offset + 16)
        assert.deepEqual(audio.warm(batch.map(plan => plan.moveId)), [...new Set(batch.flatMap(plan => layers(plan).map(layer => layer.assetId)))])
      }
      for (const plan of plans) {
        const first = h.voices.length, run = audio.begin({ moveId: plan.fxId })
        start(run); assertRegions(h, plan, h.voices.slice(first))
        run.finish({ status: 'completed' })
      }
      assert.equal(audio.diagnostics().started, 44)
      assert.equal(audio.diagnostics().unsupported, 0)
      assert.equal(audio.diagnostics().cacheMiss, 0)
      audio.dispose()
    })
  }
}

test('Psychic accepts independent native sample rates while preserving the exact approved two-layer mix', () => {
  const plan = getAcceptedMoveSoundPlan('psychic')
  for (const sampleRate of [44100, 48000]) {
    const h = harness(sampleRate), otherRate = sampleRate === 44100 ? 48000 : 44100
    h.infos[plan.accent.assetId] = { sampleRate: otherRate,
      sampleFrames: Math.round(plan.accent.nativeCompatibility.sampleFrames / plan.accent.nativeCompatibility.sampleRate * otherRate) }
    const audio = createAudio(h, browsers.Safari), run = audio.begin({ moveId: 'psychic' })
    start(run); assertRegions(h, plan, h.voices)
    assert.equal(h.voices[0].options.scope, h.voices[1].options.scope)
    run.finish({ status: 'completed' })
    assert.ok(h.voices.every(voice => voice.reason === null), 'normal completion keeps both natural tails')
    run.cancel(); assert.ok(h.voices.every(voice => voice.reason === 'cancelled'))
    audio.dispose()
  }
})

test('malformed, missing or duration-incompatible Psychic buffers reject every layer before a voice starts', () => {
  const plan = getAcceptedMoveSoundPlan('psychic')
  const mutations = [
    (_info, h, id) => { delete h.infos[id] },
    info => { info.sampleRate = 7999 },
    info => { info.sampleRate = 192001 },
    info => { info.sampleRate = 44100.5 },
    info => { info.sampleFrames = 0 },
    info => { info.sampleFrames = 1.5 },
    info => { info.sampleFrames += Math.ceil(info.sampleRate * .101) },
    info => { info.sampleFrames -= Math.ceil(info.sampleRate * .101) },
  ]
  for (const layer of layers(plan)) {
    for (const mutate of mutations) {
      const h = harness(44100), audio = createAudio(h, browsers.Firefox)
      mutate(h.infos[layer.assetId], h, layer.assetId)
      start(audio.begin({ moveId: 'psychic' }))
      assert.equal(h.voices.length, 0, `${layer.assetId}: no partially validated mix`)
      audio.dispose()
    }
  }
})

test('invalid accepted trims or layers fail atomically on every supported browser', () => {
  const mutations = [
    plan => { plan.segments[0].startSeconds = -1 },
    plan => { plan.segments[0].endSeconds = 20 },
    plan => { plan.segments[0].soundAnchorSeconds = -1 },
    plan => { plan.segments[0].cueSeconds = 0 },
    plan => { plan.accent.segment.endSeconds = .01 },
    plan => { plan.accent.segment.gainDb = 1 },
    plan => { plan.accent.nativeCompatibility.sampleFrames = 0 },
    plan => { plan.accent.nativeCompatibility.sampleRate = 7999 },
    plan => { plan.visualRate = 0 },
    plan => { plan.playbackRate = 2 },
  ]
  for (const userAgent of Object.values(browsers)) {
    for (const mutate of mutations) {
      const plan = structuredClone(getAcceptedMoveSoundPlan('psychic')); mutate(plan)
      const h = harness(44100), audio = createAudio(h, userAgent, { getPlan: () => plan })
      start(audio.begin({ moveId: 'psychic' }))
      assert.equal(h.voices.length, 0)
      assert.equal(audio.diagnostics().unsupported, 1)
      audio.dispose()
    }
  }
})

test('a sub-sample explicit endpoint overrun clamps to the native tail while larger overruns remain invalid', () => {
  for (const sampleRate of [44100, 48000]) {
    for (const extraSamples of [.5, 1.5]) {
      const h = harness(sampleRate), plan = structuredClone(getAcceptedMoveSoundPlan('thunderbolt'))
      const nativeDuration = duration(h.infos[plan.assetId])
      plan.segments[0].endSeconds = nativeDuration + extraSamples / sampleRate
      const audio = createAudio(h, browsers.Firefox, { getPlan: () => plan })
      start(audio.begin({ moveId: 'thunderbolt' }))
      assert.equal(h.voices.length, extraSamples < 1 ? 1 : 0)
      if (h.voices.length) assert.equal(h.voices[0].options.endSeconds, nativeDuration)
      audio.dispose()
    }
  }
})

for (const [name, factory, usesPreview] of [
  ['private multiplayer', createBattleAudio, false],
  ['solo simulator', createSimulationAudio, false],
  ['move preview', createPreviewAudio, true],
]) {
  test(`${name} warms and starts all accepted finals on Safari without requiring a technical fallback`, () => {
    const h = harness(44100), audio = factory({ playerFactory: h.playerFactory, storage: null, document: null, userAgent: browsers.Safari })
    for (let offset = 0; offset < plans.length; offset += 16) {
      const batch = plans.slice(offset, offset + 16)
      const warmed = audio.warmMoves(batch.map(plan => plan.fxId), { fxIds: true })
      assert.deepEqual(warmed, [...new Set(batch.flatMap(plan => layers(plan).map(layer => layer.assetId)))])
    }
    assert.ok(h.resolved.every(asset => asset?.url === `/audio/sfx/${asset.sha256}.mp3`))
    assert.equal(audio.getState().sfxAvailable, true)
    const scope = usesPreview ? null : audio.begin({ matchId: `native-${name}`, cursor: 1, own: { team: [] }, opponent: { known: [] }, decision: { moves: [{ id: 'psychic' }] } })
    assert.ok(h.loads.some(ids => ids.includes('source.psychic') && ids.includes('source.hit-normal-damage')))
    for (const [index, plan] of plans.entries()) {
      const first = h.voices.length, request = { moveId: plan.fxId, cursor: index + 1 }
      const run = usesPreview ? audio.previewMove(request) : scope.move(request)
      run.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
      assertRegions(h, plan, h.voices.slice(first))
      run.finish({ status: 'completed' })
    }
    assert.equal(audio.diagnostics().sfx.started, 44)
    audio.dispose()
  })
}

test('incompatible accepted audio never falls back to an older pilot or technical recording', () => {
  for (const userAgent of Object.values(browsers)) {
    const h = harness(), fallbackCalls = []
    h.infos['source.absorb'].sampleFrames += 9600
    const technicalSoundPack = {
      getFxSoundPlan(id) { fallbackCalls.push(id); return null },
      getMoveSoundPlan(id) { fallbackCalls.push(id); return null },
      getSoundAsset() { return null },
    }
    const audio = createBattleAudio({ playerFactory: h.playerFactory, storage: null, document: null, userAgent, technicalSoundPack })
    assert.deepEqual(audio.warmMoves(['absorb'], { fxIds: true }), ['source.absorb'])
    const run = audio.previewMove({ moveId: 'absorb' })
    run.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
    assert.equal(h.voices.length, 0)
    assert.deepEqual(fallbackCalls, [])
    assert.equal(audio.diagnostics().sfx.unsupported, 1)
    audio.dispose()
  }
})

test('unaccepted pilot recordings retain their separate decoder restriction', () => {
  const plan = getMoveSoundPlan('tackle')
  for (const userAgent of Object.values(browsers)) {
    const h = harness()
    h.infos[plan.assetId] = { sampleRate: plan.nativeCompatibility.sampleRate, sampleFrames: plan.nativeCompatibility.sampleFrames }
    const audio = createMoveAudio({ player: h.player, userAgent, now: () => 1000 })
    assert.deepEqual(audio.warm(['tackle']), [])
    start(audio.begin({ moveId: 'tackle' }))
    assert.equal(h.voices.length, 0)
    audio.dispose()
  }
})
