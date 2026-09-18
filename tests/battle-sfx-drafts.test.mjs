import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createMoveAudio } from '../apps/shared/battle/moveAudio.js'
import { createBattleAudio } from '../apps/shared/battle/audio.js'
import { createSimulationAudio } from '../apps/simulation/src/audio.js'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'
import { createPreviewAudio } from '../apps/game/src/presentation/audio.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
import { createPreviewTransaction } from '../apps/game/src/previewState.js'
import { MOVES } from '../apps/game/src/moveCatalog.js'
import { getMoveSoundPlan } from '../packages/battle-sfx/src/runtime.js'
import { DRAFT_SFX_RUNTIME_CATALOG, getDraftMoveSoundPlan, getDraftFxSoundPlan } from '../packages/battle-sfx/src/draft-runtime.js'

const CHROME = 'Mozilla/5.0 Chrome/152.0.0.0 Safari/537.36'
const FIREFOX = 'Mozilla/5.0 Firefox/145.0'
const SAFARI = 'Mozilla/5.0 Version/19.0 Safari/605.1.15'
const tick = () => new Promise(resolve => setImmediate(resolve))
const technicalPlan = () => ({ moveId: 'bodyslam', fxId: 'body-slam', phase: 'attack', assetId: 'source.body-slam',
  reviewStatus: 'technical-draft', playbackPolicy: 'whole-native-buffer-at-visual-start', nativeCompatibility: null,
  reference: { sampleRate: 44100, sampleFrames: 67473 }, playbackRate: 1,
  segments: [{ startFrame: 0, endFrame: 67473, sourceAnchorFrame: 0, visualAnchorSeconds: 0, gainDb: -.8, nativeOffsetSeconds: 0 }],
})

function playerHarness(infos = { 'source.body-slam': { sampleRate: 48000, sampleFrames: 73440, durationSeconds: 1.53 },
  'source.slam': { sampleRate: 48000, sampleFrames: Math.round(getDraftMoveSoundPlan('slam').reference.sampleFrames / getDraftMoveSoundPlan('slam').reference.sampleRate * 48000) } }) {
  const loads = [], voices = [], stoppedScopes = [], categories = new Map()
  let time = 10, listener = () => {}, state = { enabled: true, volume: .6, suspended: false, status: 'ready' }
  const update = patch => { state = { ...state, ...patch }; listener(state) }
  const player = {
    readyInfo: id => infos[id] ?? null, contextTime: () => time,
    preload(ids, options) { loads.push({ ids: [...ids], options }); return Promise.resolve(ids.map(() => true)) },
    playSegment(id, options) {
      if (!state.enabled || state.suspended || categories.get(options.category) === false) return null
      let resolve
      const row = { id, options, reason: null, finished: new Promise(done => { resolve = done }),
        end(reason = 'ended') { if (!row.reason) { row.reason = reason; resolve({ reason }) } },
        cancel() { row.end('cancelled') },
      }
      voices.push(row); return row
    },
    stopScope(scope) { stoppedScopes.push(scope); voices.filter(row => row.options.scope === scope).forEach(row => row.cancel()) },
    stop() { voices.forEach(row => row.cancel()) },
    unlock() { update({ status: 'ready' }); return Promise.resolve(true) },
    getState: () => state,
    setEnabled: enabled => update({ enabled }), setVolume: volume => update({ volume }),
    setSuspended: suspended => update({ suspended }),
    setCategoryEnabled(category, value) {
      categories.set(category, value)
      if (!value) voices.filter(row => row.options.category === category).forEach(row => row.cancel())
    },
    play: () => true, dispose() { player.stop() },
  }
  return { player, infos, loads, voices, stoppedScopes, bind: fn => { listener = fn }, advance: seconds => { time += seconds } }
}

function moveHarness({ plan = technicalPlan(), infos, ...options } = {}) {
  const fake = playerHarness(infos)
  const getPlan = (id, { phase = 'attack', outcome = 'hit', mode = 'normal' } = {}) =>
    ['bodyslam', 'body-slam'].includes(id) && phase === 'attack' && outcome === 'hit' && mode === 'normal' ? plan : getMoveSoundPlan(id, { phase, outcome, mode })
  const audio = createMoveAudio({ player: fake.player, getPlan, getCanonicalPlan: getPlan,
    userAgent: FIREFOX, allowTechnicalDrafts: true, now: () => 1000, ...options })
  return { ...fake, audio, start: (run, patch = {}) => run?.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: 1000, ...patch }) }
}

test('explicitly opted-in technical drafts use the full actual native buffer at normal speed on different decoders', () => {
  for (const userAgent of [FIREFOX, SAFARI, CHROME]) for (const sampleRate of [44100, 48000]) {
    const sampleFrames = sampleRate === 44100 ? 67473 : 73440
    const h = moveHarness({ userAgent, infos: { 'source.body-slam': { sampleRate, sampleFrames, durationSeconds: sampleFrames / sampleRate } } })
    assert.deepEqual(h.audio.warm(['Body Slam']), ['source.body-slam'])
    assert.equal(h.voices.length, 0, 'preloading never starts playback')
    const run = h.audio.begin({ moveId: 'body-slam' }); h.start(run)
    assert.equal(h.voices.length, 1)
    assert.equal(h.voices[0].options.startSeconds, 0)
    assert.equal(h.voices[0].options.endSeconds, sampleFrames / sampleRate)
    assert.equal(h.voices[0].options.gainDb, -.8)
    assert.equal(h.voices[0].options.when, undefined, 'whole draft starts at the observed animation start')
    assert.equal(h.voices[0].options.playbackRate, undefined, 'no playback-rate adjustment is requested')
    run.finish({ status: 'completed' })
    assert.equal(h.voices[0].reason, null, 'a visual completion allows the remaining original tail')
    h.audio.dispose()
  }
})

test('draft playback cannot bypass explicit opt-in or weaken existing listening-approved decoder requirements', () => {
  const disabled = moveHarness({ allowTechnicalDrafts: false })
  assert.deepEqual(disabled.audio.warm(['bodyslam']), [])
  disabled.start(disabled.audio.begin({ moveId: 'body-slam' }))
  assert.equal(disabled.voices.length, 0); assert.equal(disabled.loads.length, 0)
  disabled.audio.dispose()
  const approved = getMoveSoundPlan('tackle')
  for (const userAgent of [FIREFOX, SAFARI, CHROME.replace('152.', '153.')]) {
    const h = moveHarness({ userAgent, infos: { [approved.assetId]: { sampleRate: 48000, sampleFrames: approved.nativeCompatibility.sampleFrames } } })
    assert.deepEqual(h.audio.warm(['tackle']), [])
    h.start(h.audio.begin({ moveId: 'tackle' })); assert.equal(h.voices.length, 0)
    h.audio.dispose()
  }
})

test('drafts fail closed for malformed or edited region policies and invalid native buffer metadata', () => {
  const mutations = [
    plan => { plan.reviewStatus = 'approved' },
    plan => { plan.playbackPolicy = 'trim-to-reference-region' },
    plan => { plan.playbackRate = 1.2 },
    plan => { plan.segments[0].startFrame = 1 },
    plan => { plan.segments[0].endFrame-- },
    plan => { plan.segments[0].sourceAnchorFrame = 1 },
    plan => { plan.segments[0].visualAnchorSeconds = .1 },
    plan => { plan.segments[0].nativeOffsetSeconds = .001 },
    plan => { plan.segments[0].gainDb = 1 },
    plan => { plan.segments[0].gainDb = NaN },
    plan => { plan.segments.push({ ...plan.segments[0] }) },
  ]
  for (const mutate of mutations) {
    const plan = technicalPlan(); mutate(plan)
    const h = moveHarness({ plan }); h.start(h.audio.begin({ moveId: 'body-slam' }))
    assert.equal(h.voices.length, 0, JSON.stringify(plan))
    h.audio.dispose()
  }
  for (const info of [{ sampleRate: 0, sampleFrames: 73440 }, { sampleRate: NaN, sampleFrames: 73440 },
    { sampleRate: 48000, sampleFrames: 0 }, { sampleRate: 48000, sampleFrames: -1 },
    { sampleRate: 48000, sampleFrames: 73440.5 }, { sampleRate: 48000, sampleFrames: Infinity },
    { sampleRate: 48000, sampleFrames: 48000 * 200 }, { sampleRate: 48000, sampleFrames: 96000 }]) {
    const h = moveHarness({ infos: { 'source.body-slam': info } }); h.start(h.audio.begin({ moveId: 'body-slam' }))
    assert.equal(h.voices.length, 0, JSON.stringify(info)); h.audio.dispose()
  }
})

test('draft cache misses, late presentation, duplicates and unsupported visual outcomes never schedule later playback', async () => {
  const h = moveHarness(), info = h.infos['source.body-slam']
  delete h.infos['source.body-slam']
  const missed = h.audio.begin({ moveId: 'body-slam', key: 'battle:1:move' }); h.start(missed)
  h.infos['source.body-slam'] = info
  await tick()
  h.start(missed); h.start(h.audio.begin({ moveId: 'body-slam', key: 'battle:1:move' }))
  const late = h.audio.begin({ moveId: 'body-slam', key: 'battle:2:move' }); h.start(late, { observedAtMs: 899 })
  h.start(late)
  for (const request of [{ phase: 'prepare' }, { mode: 'reduced' }, { mode: 'instant' }, { outcome: 'miss' }, { outcome: 'fail' }, { outcome: 'immune' }]) {
    const run = h.audio.begin({ moveId: 'body-slam', ...request }); h.start(run); run.finish({ status: 'completed' })
  }
  const reduced = h.audio.begin({ moveId: 'body-slam' }); h.start(reduced, { reducedMotion: true })
  assert.equal(h.voices.length, 0); assert.equal(h.loads.length, 0)
  const fresh = h.audio.begin({ moveId: 'body-slam', key: 'battle:3:move' }); h.start(fresh); h.start(fresh)
  assert.equal(h.voices.length, 1)
  h.voices[0].end(); await tick()
  h.start(h.audio.begin({ moveId: 'body-slam', key: 'battle:3:move' }))
  assert.equal(h.voices.length, 1)
  h.audio.dispose()
})

test('technical drafts require a real animation start and a valid running audio clock', () => {
  for (const timelineSeconds of [.001, -1, NaN, undefined]) {
    const h = moveHarness(); h.start(h.audio.begin({ moveId: 'body-slam' }), { timelineSeconds })
    assert.equal(h.voices.length, 0); h.audio.dispose()
  }
  for (const contextTime of [null, undefined, -1, NaN, Infinity]) {
    const h = moveHarness(); h.player.contextTime = () => contextTime
    h.start(h.audio.begin({ moveId: 'body-slam' })); assert.equal(h.voices.length, 0); h.audio.dispose()
  }
})

test('technical draft drift, failure, supersession and disposal cancel only owned sources', async () => {
  const h = moveHarness(), old = h.audio.begin({ moveId: 'body-slam' }), replacement = h.audio.begin({ moveId: 'body-slam' })
  h.start(old); h.start(replacement); h.advance(.5)
  old.onPresentation({ type: 'frame', timelineSeconds: .1 })
  assert.equal(h.voices[0].reason, 'cancelled'); assert.equal(h.voices[1].reason, null)
  replacement.onPresentation({ type: 'frame', timelineSeconds: .5 }); replacement.finish({ status: 'completed' })
  old.cancel(); assert.equal(h.voices[1].reason, null)
  h.audio.stop(); assert.equal(h.voices[1].reason, 'cancelled')
  const failed = h.audio.begin({ moveId: 'body-slam' }); h.start(failed); failed.finish({ status: 'failed' })
  assert.equal(h.voices.at(-1).reason, 'cancelled')
  const disposed = h.audio.begin({ moveId: 'body-slam' }); h.start(disposed); h.audio.dispose()
  assert.equal(h.voices.at(-1).reason, 'cancelled'); h.start(disposed)
  await tick(); assert.equal(h.audio.diagnostics().activeRuns, 0)
})

const member = (memberId, species) => ({ memberId, species, moves: [], hp: { current: 100 }, fainted: false })
const view = (cursor = 1) => ({ matchId: 'draft-battle', cursor,
  decision: { moves: [{ id: 'slam' }, { id: 'tackle' }] },
  own: { active: 'p1:1', team: [member('p1:1', 'Charizard')] },
  opponent: { active: 'p2:1', known: [member('p2:1', 'Venusaur')] },
})
const soundPack = {
  getFxSoundPlan: (id, options) => id === 'slam' && (!options || Object.entries(options).every(([key, value]) => ({ phase: 'attack', outcome: 'hit', mode: 'normal' })[key] === value)) ? getDraftMoveSoundPlan('slam') : null,
  getMoveSoundPlan: id => id === 'slam' ? getDraftMoveSoundPlan('slam') : null,
  getSoundAsset: id => id === 'source.slam' ? { id, url: '/audio/sfx/slam-test.mp3' } : null,
}
function battleHarness({ technicalSoundPack = null, userAgent = FIREFOX, ...options } = {}) {
  const fake = playerHarness(), events = new Map()
  const doc = { hidden: false, addEventListener: (id, fn) => events.set(id, fn), removeEventListener: id => events.delete(id) }
  let resolveAsset
  const audio = createBattleAudio({ document: doc, storage: null, userAgent, technicalSoundPack,
    playerFactory({ onState, resolveAsset: resolve }) { fake.bind(onState); resolveAsset = resolve; return fake.player }, ...options })
  return { ...fake, audio, doc, events, resolve: id => resolveAsset(id),
    start: run => run?.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() }) }
}

test('shared host defaults do not expose, preload or play drafts; injected simulation pack alone enables them', () => {
  for (const enabled of [false, true]) {
    const h = battleHarness({ technicalSoundPack: enabled ? soundPack : null })
    const batch = h.audio.begin(view())
    assert.equal(Boolean(h.resolve('source.slam')), enabled)
    assert.equal(h.loads.some(row => row.ids.includes('source.slam')), enabled)
    assert.equal(h.audio.getState().sfxAvailable, enabled, 'default approved pack remains unavailable on Firefox')
    assert.equal(h.voices.length, 0)
    h.start(batch.move({ moveId: 'slam', cursor: 1 }))
    assert.equal(h.voices.length, enabled ? 1 : 0)
    h.audio.dispose()
  }
})

test('draft opt-in preserves approved plan and asset precedence', () => {
  const approved = getMoveSoundPlan('tackle'), poisonedPack = {
    getMoveSoundPlan: () => technicalPlan(), getFxSoundPlan: () => technicalPlan(),
    getSoundAsset: () => ({ id: 'wrong', url: '/wrong.mp3' }),
  }
  const h = battleHarness({ technicalSoundPack: poisonedPack, userAgent: CHROME })
  h.infos[approved.assetId] = { sampleRate: 48000, sampleFrames: approved.nativeCompatibility.sampleFrames }
  h.audio.warmMoves(['tackle'])
  assert.equal(h.resolve(approved.assetId).id, approved.assetId)
  assert.notEqual(h.resolve(approved.assetId).url, '/wrong.mp3')
  assert.deepEqual(h.loads.at(-1).ids, [approved.assetId])
  const batch = h.audio.begin(view()); h.start(batch.move({ moveId: 'tackle', cursor: 2 }))
  assert.equal(h.voices.length, 1); assert.equal(h.voices[0].id, approved.assetId)
  assert.equal(h.voices[0].options.gainDb, 0)
  h.audio.dispose()
})

test('simulation draft host keeps mute, background, reset, failed loads and the global SFX kill switch nonblocking', async () => {
  for (const action of ['global-off', 'mute', 'sfx-mute', 'hidden', 'sync', 'stop', 'dispose']) {
    const h = battleHarness({ technicalSoundPack: soundPack, sfxEnabled: action !== 'global-off' })
    const batch = h.audio.begin(view()), run = batch.move({ moveId: 'slam', cursor: 1 }); h.start(run)
    if (action === 'global-off') {
      assert.equal(h.voices.length, 0)
      assert.equal(h.loads.some(row => row.ids.includes('source.slam')), false)
      assert.equal(h.audio.getState().sfxAvailable, false)
    } else {
      assert.equal(h.voices.length, 1, action); run.finish({ status: 'completed' })
      if (action === 'mute') { h.audio.setEnabled(false); h.audio.setEnabled(true) }
      if (action === 'sfx-mute') { h.audio.setSfxEnabled(false); h.audio.setSfxEnabled(true) }
      if (action === 'hidden') { h.doc.hidden = true; h.events.get('visibilitychange')(); h.doc.hidden = false; h.events.get('visibilitychange')() }
      if (action === 'sync') h.audio.sync(view(2))
      if (action === 'stop') h.audio.stop()
      if (action === 'dispose') h.audio.dispose()
      assert.equal(h.voices[0].reason, 'cancelled', action)
      h.start(run); assert.equal(h.voices.length, 1, 'stale callbacks never replay')
    }
    await tick(); h.audio.dispose()
  }
  const h = battleHarness({ technicalSoundPack: soundPack })
  h.player.preload = () => Promise.reject(new Error('offline'))
  delete h.infos['source.slam']
  const batch = h.audio.begin(view()); h.start(batch.move({ moveId: 'slam', cursor: 1 }))
  await tick(); assert.equal(h.voices.length, 0); h.audio.dispose()
})

test('draft server events are deduplicated across reconnect and old cancellation cannot stop a new batch', async () => {
  const h = battleHarness({ technicalSoundPack: soundPack }), old = h.audio.begin(view())
  const oldRun = old.move({ moveId: 'slam', cursor: 1 }); h.start(oldRun)
  h.voices[0].end(); await tick(); h.audio.sync(view())
  const repeated = h.audio.begin(view()); h.start(repeated.move({ moveId: 'slam', cursor: 1 }))
  assert.equal(h.voices.length, 1)
  const fresh = h.audio.begin(view(2)); h.start(fresh.move({ moveId: 'slam', cursor: 2 }))
  assert.equal(h.voices.length, 2)
  old.cancel(); oldRun.cancel(); repeated.cancel()
  assert.equal(h.voices[1].reason, null); h.audio.dispose()
})

test('simulation and move preview opt into drafts while multiplayer keeps the approved-only shared host', async () => {
  const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')
  const [solo, multiplayer, preview, shared] = await Promise.all([
    read('apps/simulation/src/App.vue'), read('apps/multiplayer/src/App.vue'),
    read('apps/game/src/components/BattleDemo.vue'), read('apps/shared/battle/audio.js'),
  ])
  assert.match(solo, /createSimulationAudio\(\)/)
  assert.match(preview, /createPreviewAudio\(\)/)
  assert.match(multiplayer, /createBattleAudio\(\)/)
  assert.doesNotMatch(multiplayer, /createSimulationAudio|createPreviewAudio|technicalSoundPack|draftSoundPack/)
  assert.doesNotMatch(shared, /from\s+['"][^'"]*(?:draft|simulation)[^'"]*['"]/, 'the approved-only shared host must not import the draft catalog')
})

test('simulation composition selects actual drafts and its rollout switch restores the approved-only behavior', () => {
  for (const draftSfxEnabled of [true, false]) {
    const h = playerHarness(), audio = createSimulationAudio({ draftSfxEnabled, userAgent: FIREFOX, document: null, storage: null,
      playerFactory({ onState }) { h.bind(onState); return h.player } })
    const batch = audio.begin(view()), run = batch.move({ moveId: 'slam', cursor: 1 })
    run?.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
    assert.equal(h.voices.length, draftSfxEnabled ? 1 : 0)
    if (draftSfxEnabled) assert.equal(h.voices[0].options.gainDb, getDraftMoveSoundPlan('slam').segments[0].gainDb)
    assert.equal(audio.getState().sfxAvailable, draftSfxEnabled)
    audio.dispose()
  }
})

test('preview composition selects the same drafts with independent rollout and global sound switches', () => {
  for (const [draftSfxEnabled, sfxEnabled] of [[true, true], [false, true], [true, false]]) {
    const h = playerHarness(), audio = createPreviewAudio({ draftSfxEnabled, sfxEnabled, userAgent: FIREFOX, document: null, storage: null,
      playerFactory({ onState }) { h.bind(onState); return h.player } })
    const run = audio.previewMove({ moveId: 'slam' })
    run?.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
    assert.equal(h.voices.length, draftSfxEnabled && sfxEnabled ? 1 : 0)
    assert.equal(audio.getState().sfxAvailable, draftSfxEnabled && sfxEnabled)
    if (h.voices.length) assert.equal(h.voices[0].options.gainDb, getDraftMoveSoundPlan('slam').segments[0].gainDb)
    audio.dispose()
  }
})

test('unlock and unmute preserve preview FX identifier warm-up, including the Vice Grip alias', async () => {
  const h = playerHarness(), audio = createPreviewAudio({ userAgent: FIREFOX, document: null, storage: null,
    playerFactory({ onState }) { h.bind(onState); return h.player } })
  const id = getDraftFxSoundPlan('vice-grip').assetId
  assert.equal(getDraftMoveSoundPlan('vicegrip'), null, 'the FX identifier differs from the canonical data ID')
  audio.warmMoves(['vice-grip'], { fxIds: true })
  assert.deepEqual(h.loads.at(-1).ids, [id])
  h.loads.length = 0
  await audio.unlock()
  assert.ok(h.loads.some(row => row.ids.includes(id)), 'audio unlocked after move selection must still warm the selected FX asset')
  audio.setSfxEnabled(false); h.loads.length = 0; audio.setSfxEnabled(true); await tick()
  assert.ok(h.loads.some(row => row.ids.includes(id)), 'unmuting must also retain the FX lookup mode')
  audio.begin({ ...view(), decision: { moves: [{ id: 'visegrip' }] } })
  h.loads.length = 0; await audio.unlock()
  assert.ok(h.loads.some(row => row.ids.includes(id)), 'server decisions restore canonical lookup when a shared host is reused')
  assert.equal(h.voices.length, 0, 'warming and unlock never play a sound')
  audio.dispose()
})

function previewHarness() {
  const plan = getDraftFxSoundPlan('slam'), h = playerHarness({ [plan.assetId]: {
    sampleRate: 48000, sampleFrames: Math.round(plan.reference.sampleFrames / plan.reference.sampleRate * 48000),
  } })
  const audio = createPreviewAudio({ userAgent: FIREFOX, document: null, storage: null,
    playerFactory({ onState }) { h.bind(onState); return h.player } })
  const plays = [], displays = []
  const presenter = createPresenter({ getScene: () => ({}), onDisplay: value => displays.push(value), onMove: request => audio.previewMove(request),
    loadFx: async () => ({ play(request, options) {
      let resolve
      const value = { request, options, finished: new Promise(done => { resolve = done }), finish: result => resolve(result), cancel() {} }
      plays.push(value); return value
    } }),
  })
  return { ...h, audio, presenter, plays, displays,
    start: play => play.options.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() }),
    dispose() { presenter.destroy(); audio.dispose() },
  }
}
const previewTransaction = (moveId = 'slam', sourceId = 'source', phase = 'attack') => createPreviewTransaction(MOVES.find(move => move.id === moveId),
  { sourceId, targetId: sourceId === 'source' ? 'target' : 'source', phase })

test('real preview presenter starts draft sound only with its visual clock on either side and preserves committed results', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = previewHarness(), tx = previewTransaction('slam', sourceId), original = structuredClone(tx)
    const pending = h.presenter.enqueue(tx); await tick()
    assert.equal(h.plays.length, 1); assert.equal(h.plays[0].request.sourceId, sourceId)
    assert.equal(h.voices.length, 0, 'preparing presentation does not start the sound')
    h.start(h.plays[0]); assert.equal(h.voices.length, 1)
    assert.equal(h.displays.at(-1).state, tx.before, 'cosmetic clock cannot reveal committed damage')
    h.plays[0].options.onCue({ type: 'impact' })
    assert.equal(h.displays.at(-1).state, tx.after)
    h.plays[0].finish({ status: 'completed' }); assert.equal((await pending).status, 'completed')
    assert.equal(h.voices[0].reason, null, 'normal visual completion keeps the original recording tail')
    assert.deepEqual(tx, original); assert.equal(h.displays.at(-1).state, tx.after); h.dispose()
  }
})

test('preview preparation, reduced motion and effects-off never start technical move playback', async () => {
  for (const mode of ['prepare', 'reduced', 'off']) {
    const h = previewHarness(), tx = mode === 'prepare' ? previewTransaction('bounce', 'source', 'prepare') : previewTransaction()
    const pending = h.presenter.enqueue(tx, { effectsEnabled: mode !== 'off', reducedMotion: mode === 'reduced' })
    await tick()
    if (mode !== 'off') { h.start(h.plays[0]); h.plays[0].finish({ status: 'completed' }) }
    assert.equal((await pending).status, mode === 'off' ? 'skipped' : 'completed')
    assert.equal(h.voices.length, 0); assert.equal(h.displays.at(-1).state, tx.after); h.dispose()
  }
})

test('preview skip and move or source resets cancel draft playback and discard stale callbacks', async () => {
  for (const action of ['skip', 'move-change', 'source-change']) {
    const h = previewHarness(), tx = previewTransaction(), pending = h.presenter.enqueue(tx); await tick()
    const old = h.plays[0]; h.start(old); assert.equal(h.voices.length, 1)
    h.audio.stop()
    if (action === 'skip') h.presenter.skip()
    else h.presenter.reset(previewTransaction(action === 'move-change' ? 'stomp' : 'slam', action === 'source-change' ? 'target' : 'source').before)
    assert.equal((await pending).status, action === 'skip' ? 'skipped' : 'cancelled')
    assert.equal(h.voices[0].reason, 'cancelled')
    const fresh = h.presenter.enqueue(previewTransaction('slam', 'target')); await tick(); h.start(h.plays[1])
    assert.equal(h.voices.length, 2); assert.equal(h.voices[1].reason, null)
    old.options.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() }); old.options.onCue({ type: 'impact' })
    old.finish({ status: 'completed' }); assert.equal(h.voices.length, 2); assert.equal(h.voices[1].reason, null)
    h.plays[1].finish({ status: 'completed' }); await fresh; h.dispose()
  }
})

test('all selected draft plans accept bounded whole decodes at 44.1 and 48 kHz and keep authored attenuation', () => {
  const plans = Object.values(DRAFT_SFX_RUNTIME_CATALOG.moves)
  assert.equal(plans.length, 323)
  for (const sampleRate of [44100, 48000]) {
    const infos = Object.fromEntries(plans.map(plan => [plan.assetId, { sampleRate,
      sampleFrames: Math.round(plan.reference.sampleFrames / plan.reference.sampleRate * sampleRate) }]))
    const h = moveHarness({ infos, getPlan: getDraftFxSoundPlan, getCanonicalPlan: getDraftMoveSoundPlan })
    for (const plan of plans) {
      const before = h.voices.length, run = h.audio.begin({ moveId: plan.fxId }); h.start(run)
      assert.equal(h.voices.length, before + 1, `${plan.moveId} at ${sampleRate}`)
      const voice = h.voices.at(-1)
      assert.equal(voice.options.endSeconds, infos[plan.assetId].sampleFrames / sampleRate)
      assert.equal(voice.options.gainDb, plan.segments[0].gainDb)
      assert.ok(voice.options.gainDb <= 0 && voice.options.gainDb >= -60)
      run.cancel()
    }
    h.audio.dispose()
  }
})

test('server Present healing is silent while damage uses the draft, without changing presentation state', async () => {
  for (const outcome of ['heal', 'damage']) {
    const plan = getDraftMoveSoundPlan('present'), h = playerHarness({ [plan.assetId]: {
      sampleRate: 48000, sampleFrames: Math.round(plan.reference.sampleFrames / plan.reference.sampleRate * 48000),
    } })
    const audio = createSimulationAudio({ userAgent: FIREFOX, document: null, storage: null,
      playerFactory({ onState }) { h.bind(onState); return h.player } })
    const before = { ...view(10), seat: 'p1', weather: null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], result: null }
    before.opponent.known[0].hp = { current: 50, max: 100 }
    const after = structuredClone(before); after.cursor = 12; after.opponent.known[0].hp.current = outcome === 'heal' ? 75 : 25
    const events = [{ cursor: 11, type: 'protocol', args: { opcode: 'move', fields: ['p1:1', 'Present', 'p2:1'] } },
      { cursor: 12, type: 'protocol', args: { opcode: `-${outcome}`, fields: ['p2:1', `${after.opponent.known[0].hp.current}/100`] } }]
    const original = structuredClone({ before, after, events }), displays = [], requests = [], batch = audio.begin(after, events)
    const presenter = createSimulationPresenter({ getScene: () => ({}), ensureScene: async () => {},
      onDisplay: value => displays.push(value), onMove: request => batch.move(request),
      loadFx: async () => ({ play(request, options) {
        requests.push(request)
        options.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
        options.onCue({ type: 'impact' })
        return { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
      } }),
    })
    assert.equal((await presenter.present({ before, after, events })).status, 'completed')
    assert.equal(h.voices.length, outcome === 'damage' ? 1 : 0, outcome)
    assert.equal(requests.length, 1, 'the existing animation remains unchanged')
    assert.deepEqual(displays.at(-1), after); assert.deepEqual({ before, after, events }, original)
    presenter.destroy(); audio.dispose()
  }
})
