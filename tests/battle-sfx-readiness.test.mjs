import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleState, resolveMove } from '@battle/battle-core'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'
import { createBattleAudio } from '../apps/shared/battle/audio.js'
import { createPreviewAudio } from '../apps/game/src/presentation/audio.js'
import { createSimulationAudio } from '../apps/simulation/src/audio.js'
import { getAcceptedMoveSoundPlan } from '@battle/battle-sfx/accepted-runtime'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const member = (memberId, species) => ({ memberId, species, name: species, active: true,
  hp: { current: 100, max: 100 }, hpPrecision: 'exact', fainted: false,
  condition: null, stages: {}, volatiles: [], moves: [], item: null, ability: null })

function serverBatch() {
  const before = { matchId: 'uncached-sound', seat: 'p2', cursor: 10, turn: 1,
    own: { active: 'p2:1', team: [member('p2:1', 'Venusaur')] },
    opponent: { active: 'p1:revealed:1', known: [member('p1:revealed:1', 'Charizard')] },
    weather: null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], result: null,
    complete: true, decision: { id: 'decision', kind: 'move', moves: [] } }
  const after = structuredClone(before)
  after.cursor = 12; after.own.team[0].hp.current = 60
  const protocol = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
  return { before, after, events: [protocol(11, 'move', 'p1:revealed:1', 'Flamethrower', 'p2:1'),
    protocol(12, '-damage', 'p2:1', '60/100')] }
}

function harness(kind, ready) {
  const plays = [], clocks = [], displays = [], sounds = [], entered = deferred()
  const input = kind === 'server' ? serverBatch()
    : resolveMove(createBattleState(), { moveId: 'flamethrower', sourceId: 'target', targetId: 'source' })
  const callbacks = {
    getScene: () => ({}),
    onDisplay(value) { displays.push(kind === 'server' ? value : value.state) },
    onMove(request) {
      const sound = { request, cancellations: 0, finishes: [], ready,
        onPresentation(cue) { clocks.push(cue) },
        finish(result) { sound.finishes.push(result) },
        cancel() { sound.cancellations++ } }
      sounds.push(sound); entered.resolve(); return sound
    },
    loadFx: async () => ({
      play(request, options) {
        plays.push(request)
        options.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
        options.onCue({ type: 'impact' })
        return { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
      },
    }),
  }
  const presenter = kind === 'server' ? createSimulationPresenter(callbacks) : createPresenter(callbacks)
  return { input, plays, clocks, displays, sounds, presenter, entered: entered.promise,
    present: () => kind === 'server' ? presenter.present(input) : presenter.enqueue(input) }
}

test('first-use recordings become ready before either host starts the real visual clock', async () => {
  for (const kind of ['server', 'preview']) {
    const loading = deferred(), h = harness(kind, loading.promise), original = structuredClone(h.input)
    const pending = h.present()
    await h.entered; await tick()
    assert.equal(h.plays.length, 0, kind)
    assert.equal(h.clocks.length, 0, 'preloading never invents a visual start')
    assert.ok(!h.displays.includes(h.input.after), 'only presentation is waiting; input stays committed')
    loading.resolve(true)
    assert.equal((await pending).status, 'completed')
    assert.equal(h.plays.length, 1); assert.equal(h.clocks.length, 1)
    assert.equal(h.clocks[0].timelineSeconds, 0)
    assert.equal(h.plays[0].sourceId, 'target', 'the far-side move uses the same readiness path')
    assert.deepEqual(h.displays.at(-1), h.input.after)
    assert.deepEqual(h.input, original)
    h.presenter.destroy()
  }
})

test('offline and absent optional readiness never fail or suppress either host visual', async () => {
  for (const kind of ['server', 'preview']) for (const offline of [false, true]) {
    const loading = deferred(), h = harness(kind, offline ? loading.promise : undefined)
    const pending = h.present(); await h.entered
    if (offline) loading.reject(new Error('Sound download unavailable'))
    assert.equal((await pending).status, 'completed')
    assert.equal(h.plays.length, 1); assert.equal(h.sounds[0].finishes.length, 1)
    assert.deepEqual(h.displays.at(-1), h.input.after)
    h.presenter.destroy()
  }
})

test('slow audio gets at most 500 ms before visual playback continues without a delayed replay', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const kind of ['server', 'preview']) {
    const loading = deferred(), h = harness(kind, loading.promise), pending = h.present()
    await h.entered; await tick()
    t.mock.timers.tick(499); await tick()
    assert.equal(h.plays.length, 0, kind)
    t.mock.timers.tick(1)
    assert.equal((await pending).status, 'completed')
    assert.equal(h.plays.length, 1); assert.equal(h.clocks.length, 1)
    loading.resolve(true); await tick()
    assert.equal(h.plays.length, 1); assert.equal(h.clocks.length, 1)
    assert.deepEqual(h.displays.at(-1), h.input.after)
    h.presenter.destroy()
  }
})

test('skip, reset and teardown promptly cancel a pending warmup and reject late visual starts', async () => {
  for (const kind of ['server', 'preview']) for (const action of ['skip', 'reset', 'destroy']) {
    const loading = deferred(), h = harness(kind, loading.promise), pending = h.present()
    await h.entered; await tick()
    if (action === 'reset') h.presenter.reset(h.input.before)
    else h.presenter[action]()
    assert.equal((await pending).status, action === 'skip' ? 'skipped' : 'cancelled')
    assert.equal(h.sounds[0].cancellations, 1)
    const displayCount = h.displays.length
    loading.resolve(true); await tick()
    assert.equal(h.plays.length, 0); assert.equal(h.clocks.length, 0)
    assert.equal(h.displays.length, displayCount, 'late audio cannot publish an old battle view')
    h.presenter.destroy()
  }
})

function realAudioHarness(kind) {
  const plan = getAcceptedMoveSoundPlan('flamethrower'), loads = [], voices = [], stoppedScopes = [], infos = new Map()
  const loadingEntered = deferred(), plays = [], state = { enabled: true, volume: .6, status: 'ready', suspended: false }
  let resolveAsset
  const player = {
    getState: () => state,
    readyInfo: id => infos.get(id), contextTime: () => 10,
    setSuspended() {}, setCategoryEnabled() {}, unlock: () => Promise.resolve(true),
    preload(ids, options = {}) {
      const loading = deferred(), row = { ids, options, loading, cancelled: false }
      loads.push(row)
      if (options.scope) loadingEntered.resolve(row)
      return loading.promise
    },
    playSegment(id, options) {
      if (!infos.has(id)) return null
      const done = deferred(), voice = { id, options, finished: done.promise, cancelled: false,
        cancel() { voice.cancelled = true; done.resolve({ reason: 'cancelled' }) } }
      voices.push(voice); return voice
    },
    stopScope(scope) {
      stoppedScopes.push(scope)
      for (const row of loads) if (row.options.scope === scope) { row.cancelled = true; row.loading.resolve(false) }
      for (const voice of voices) if (voice.options.scope === scope) voice.cancel()
    },
    stop() {
      for (const row of loads) { row.cancelled = true; row.loading.resolve(false) }
      for (const voice of voices) voice.cancel()
    },
    dispose() { player.stop() },
  }
  const createAudio = kind === 'preview' ? createPreviewAudio : kind === 'simulation' ? createSimulationAudio : createBattleAudio
  const audio = createAudio({ storage: null, document: null,
    userAgent: 'Mozilla/5.0 Version/18.6 Safari/605.1.15',
    playerFactory(configuration) { resolveAsset = configuration.resolveAsset; return player } })
  const input = kind === 'preview'
    ? resolveMove(createBattleState(), { moveId: 'flamethrower', sourceId: 'target', targetId: 'source' })
    : serverBatch()
  const scope = kind === 'preview' ? null : audio.begin(input.after, input.events)
  const callbacks = { getScene: () => ({}), onDisplay() {},
    onMove: request => kind === 'preview' ? audio.previewMove(request) : scope.move(request),
    loadFx: async () => ({ play(request, options) {
      plays.push(request)
      options.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
      options.onCue({ type: 'impact' })
      return { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
    } }),
  }
  const presenter = kind === 'preview' ? createPresenter(callbacks) : createSimulationPresenter(callbacks)
  return { plan, audio, player, presenter, plays, voices, loads, stoppedScopes, loadingEntered: loadingEntered.promise,
    selectedAsset: () => resolveAsset(plan.assetId),
    present: () => kind === 'preview' ? presenter.enqueue(input) : presenter.present(input),
    finishLoad() {
      // A different native output rate still represents the same recording.
      const sampleRate = 44100
      infos.set(plan.assetId, { sampleRate,
        sampleFrames: Math.round(plan.nativeCompatibility.sampleFrames / plan.nativeCompatibility.sampleRate * sampleRate) })
      for (const row of loads) if (!row.cancelled && row.ids.includes(plan.assetId)) row.loading.resolve(true)
    },
    dispose() { presenter.destroy(); audio.dispose() },
  }
}

test('actual solo, private and preview audio warm the selected recording before scheduling its first voice', async () => {
  for (const kind of ['simulation', 'multiplayer', 'preview']) {
    const h = realAudioHarness(kind), pending = h.present(), loading = await h.loadingEntered
    await tick()
    assert.deepEqual(loading.ids, [h.plan.assetId], kind)
    assert.equal(loading.options.priority, 1)
    assert.ok(loading.options.scope?.soundRun > 0)
    assert.match(h.selectedAsset().url, /^\/audio\/sfx\/[a-f0-9]{64}\.mp3$/)
    assert.equal(h.plays.length, 0); assert.equal(h.voices.length, 0)
    h.finishLoad()
    assert.equal((await pending).status, 'completed', kind)
    assert.equal(h.plays.length, 1); assert.equal(h.voices.length, 1)
    assert.equal(h.voices[0].id, h.plan.assetId)
    assert.equal(h.voices[0].options.scope, loading.options.scope)
    assert.equal(h.voices[0].options.startSeconds, h.plan.segments[0].startSeconds)
    assert.equal(h.voices[0].options.gainDb, h.plan.segments[0].gainDb)
    assert.equal(h.audio.diagnostics().sfx.started, 1)
    assert.equal(h.audio.diagnostics().sfx.cacheMiss, 0)
    h.dispose()
  }
})

test('actual audio timeout and skip cancel scoped loading and never play a late decoded recording', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const kind of ['simulation', 'multiplayer', 'preview']) for (const action of ['timeout', 'skip']) {
    const h = realAudioHarness(kind), pending = h.present(), loading = await h.loadingEntered
    await tick()
    if (action === 'skip') h.presenter.skip()
    else t.mock.timers.tick(500)
    assert.equal((await pending).status, action === 'skip' ? 'skipped' : 'completed', `${kind} ${action}`)
    assert.ok(h.stoppedScopes.includes(loading.options.scope))
    assert.equal(loading.cancelled, true)
    assert.equal(h.plays.length, action === 'skip' ? 0 : 1)
    assert.equal(h.voices.length, 0)
    h.finishLoad(); await tick()
    assert.equal(h.voices.length, 0)
    assert.equal(h.audio.diagnostics().sfx.started, 0)
    assert.equal(h.audio.diagnostics().sfx.cacheMiss, action === 'skip' ? 0 : 1)
    h.dispose()
  }
})

test('preview retains the full default render deadline after loading while explicit deadlines still bound the whole job', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const explicit of [false, true]) {
    const loading = deferred(), done = deferred(), entered = deferred(), playing = deferred()
    let cancellations = 0
    const presenter = createPresenter({ ...(explicit ? { deadlineMs: 600 } : {}),
      getScene: () => ({}), onDisplay() {},
      onMove() { entered.resolve(); return { ready: loading.promise, cancel() { cancellations++ } } },
      loadFx: async () => ({ play() { playing.resolve(); return { finished: done.promise, cancel() {} } } }),
    })
    const tx = resolveMove(createBattleState(), { moveId: 'attract', sourceId: 'source', targetId: 'target' })
    const pending = presenter.enqueue(tx)
    await entered.promise; await tick()
    t.mock.timers.tick(499); loading.resolve(true); await playing.promise
    if (explicit) {
      t.mock.timers.tick(102)
      assert.equal((await pending).status, 'failed')
      assert.equal(cancellations, 1)
    } else {
      t.mock.timers.tick(6010)
      done.resolve({ status: 'completed' })
      assert.equal((await pending).status, 'completed', 'a 6.01 s clip keeps its rendering allowance after warmup')
      assert.equal(cancellations, 0)
    }
    presenter.destroy()
  }
})
