import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createBattleState, resolveMove } from '@battle/battle-core'
import { createReviewedBattleFx } from '../apps/shared/battle/reviewedFx.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'
import attract, { timing } from '../packages/battle-fx/src/review-batch-seven/attract.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const request = { moveId: 'attract', sourceId: 'source', targetIds: ['target'], visualSeed: 17 }
const plan = { visualDurationSeconds: timing.duration, visualRate: 1 }
const getPlan = (id, options) => options.phase === 'attack' && options.outcome === 'hit' ? plan : null

test('reviewed budgets use paced wall duration, preserve explicit overrides and keep reduced/unsupported playback short', () => {
  const plays = []
  const createClockedFx = () => ({ play: (request, options) => { plays.push(options); return {} }, dispose() {} })
  const fx = createReviewedBattleFx({ createClockedFx, getPlan })
  assert.equal(fx.getPresentationDeadlineMs(request), 7510)
  fx.play(request)
  assert.equal(plays[0].deadlineMs, 7510)
  assert.equal(plays[0].visualRate, 1)
  const slow = createReviewedBattleFx({ createClockedFx, getPlan: () => ({ visualDurationSeconds: 4.9, visualRate: .75 }) })
  assert.equal(slow.getPresentationDeadlineMs(request), 8034)
  for (const [move, options] of [[request, { reducedMotion: true }], [{ ...request, phase: 'prepare' }, {}], [{ ...request, outcome: 'miss' }, {}]]) {
    assert.equal(fx.getPresentationDeadlineMs(move, options), 6000)
  }
  const explicit = createReviewedBattleFx({ createClockedFx, getPlan, deadlineMs: 120 })
  assert.equal(explicit.getPresentationDeadlineMs(request), 120)
  explicit.play(request, { deadlineMs: 45 })
  assert.equal(plays.at(-1).deadlineMs, 45)
  fx.dispose(); slow.dispose(); explicit.dispose()
})

function runtime({ assetLoader, moveId = 'attract', deadlineMs } = {}) {
  const timelines = [], events = [], cues = []
  const scene = createSceneGraph({ textures: { charizard: Texture.WHITE, venusaur: Texture.WHITE } })
  const fx = createReviewedBattleFx({ getPlan, ...(deadlineMs === undefined ? {} : { deadlineMs }),
    createFx: options => createBattleFx({ ...options, assetLoader, glowTexture: Texture.WHITE,
      effects: { [moveId]: { contact: timing.contact, duration: timing.duration, build: attract } } }),
    timelineEngine: { timeline(options) {
      const raw = gsap.timeline({ ...options, paused: true })
      raw.play = () => raw
      timelines.push(raw)
      return raw
    } },
  })
  return { fx, scene, timelines, events, cues,
    play: (overrides = {}, options = {}) => fx.play({ ...request, moveId, ...overrides }, { scene,
      onPresentation: value => events.push(value), onCue: value => cues.push(value), ...options }),
    dispose() { fx.dispose(); scene.dispose(); gsap.ticker.sleep() },
  }
}

test('actual Attract completes its final orbit past the old six-second deadline from either side', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const sourceId of ['source', 'target']) {
    const h = runtime()
    try {
      const handle = h.play({ sourceId, targetIds: [sourceId === 'source' ? 'target' : 'source'] })
      let result; handle.finished.then(value => { result = value })
      await tick()
      assert.equal(h.events[0].durationSeconds, 6.01)
      h.timelines[0].time(5.9, false)
      assert.ok(h.scene.effects.getChildByLabel('attract-orbit', true).alpha > 0, 'final hearts still fade at 5.9 seconds')
      t.mock.timers.tick(6501); await tick()
      assert.equal(result, undefined, 'neither the old six-second FX limit nor time passage truncates the new clip')
      h.timelines[0].time(6.01, false)
      assert.deepEqual(await handle.finished, { status: 'completed' })
      assert.deepEqual(h.cues, [{ type: 'impact' }])
      assert.equal(h.scene.effects.children.length, 0)
      for (const actor of h.scene.actors.values()) {
        assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
        assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0)
      }
    } finally { h.dispose() }
  }
})

test('per-play and factory deadlines reach the owned runtime and a cancelled pending load cannot start later', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const perPlay of [false, true]) {
    const h = runtime({ deadlineMs: perPlay ? undefined : 25 })
    try {
      const handle = h.play({}, perPlay ? { deadlineMs: 25 } : {})
      await tick(); t.mock.timers.tick(25)
      assert.equal((await handle.finished).status, 'failed')
      assert.equal(h.scene.effects.children.length, 0)
    } finally { h.dispose() }
  }
  const asset = deferred(), h = runtime({ moveId: 'surf', assetLoader: () => asset.promise })
  try {
    const controller = new AbortController(), handle = h.play({}, { signal: controller.signal })
    await tick(); controller.abort()
    assert.deepEqual(await handle.finished, { status: 'cancelled' })
    asset.resolve(Texture.WHITE); await tick(); t.mock.timers.tick(8000)
    assert.deepEqual(h.events, []); assert.deepEqual(h.cues, []); assert.equal(h.timelines.length, 0)
    assert.equal(h.scene.effects.children.length, 0)
  } finally { h.dispose() }
})

const pokemon = (memberId, species) => ({ memberId, species, name: species, active: true, hp: { current: 100, max: 100 },
  hpPrecision: 'exact', fainted: false, condition: null, stages: {}, volatiles: [], moves: [], item: null, ability: null })
function serverBatch(seat) {
  const other = seat === 'p1' ? 'p2' : 'p1', own = `${seat}:1`, opponent = `${other}:revealed:1`
  const before = { matchId: 'deadline', seat, cursor: 10, turn: 1,
    own: { active: own, team: [pokemon(own, 'Charizard')] }, opponent: { active: opponent, known: [pokemon(opponent, 'Venusaur')] },
    weather: null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], result: null, complete: true,
    decision: { id: 'decision', kind: 'move', moves: [] } }
  const after = structuredClone(before); after.cursor = 11
  return { before, after, events: [{ cursor: 11, type: 'protocol', args: { opcode: 'move', fields: [own, 'Attract', opponent] } }] }
}

function host(kind, { timeout, loaded = Promise.resolve(), seat = 'p1', advertised = 7510 } = {}) {
  const finished = deferred(), plays = [], displays = []
  let cancellations = 0, soundsCancelled = 0, soundsCompleted = 0
  const callbacks = { getScene: () => ({}), onDisplay: value => displays.push(value),
    onMove: () => ({ cancel() { soundsCancelled++ }, finish() { soundsCompleted++ } }),
    loadFx: async () => { await loaded; return {
      getPresentationDeadlineMs: () => advertised,
      play(request, options) { plays.push({ request, options }); return { finished: finished.promise, cancel() { cancellations++ } } },
    } },
  }
  const input = kind === 'preview' ? resolveMove(createBattleState(), { moveId: 'attract', sourceId: 'source', targetId: 'target' }) : serverBatch(seat)
  const presenter = kind === 'preview'
    ? createPresenter({ ...callbacks, ...(timeout === undefined ? {} : { deadlineMs: timeout }) })
    : createSimulationPresenter({ ...callbacks, ...(timeout === undefined ? {} : { timeoutMs: timeout }) })
  const pending = kind === 'preview' ? presenter.enqueue(input) : presenter.present(input)
  let result; pending.then(value => { result = value })
  return { presenter, pending, finished, plays, displays, input, get result() { return result },
    get cancellations() { return cancellations }, get soundsCancelled() { return soundsCancelled }, get soundsCompleted() { return soundsCompleted } }
}

test('preview and both server seats allow the reviewed load margin and finish instead of hitting their old outer limits', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const [kind, seat] of [['preview', 'p1'], ['server', 'p1'], ['server', 'p2']]) {
    const loaded = deferred(), h = host(kind, { seat, loaded: loaded.promise })
    try {
      await tick(); t.mock.timers.tick(6000)
      assert.equal(h.plays.length, 0, 'module loading stays separate from the longer playback budget')
      loaded.resolve()
      await tick(); assert.equal(h.plays.length, 1)
      t.mock.timers.tick(7800); await tick()
      assert.equal(h.result, undefined, `${kind}/${seat} reserves the full FX budget and outer cleanup margin`)
      h.plays[0].options.onCue({ type: 'impact' })
      h.finished.resolve({ status: 'completed' })
      assert.deepEqual(await h.pending, { status: 'completed' })
      assert.equal(h.soundsCompleted, 1); assert.equal(h.soundsCancelled, 0)
      assert.deepEqual(kind === 'preview' ? h.displays.at(-1).state : h.displays.at(-1), h.input.after)
    } finally { h.presenter.destroy() }
  }
})

test('default extended host budgets still expire and explicit outer timeouts stay authoritative through loading', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const kind of ['preview', 'server']) {
    for (const explicit of [false, true]) {
      const h = host(kind, { timeout: explicit ? 25 : undefined })
      try {
        await tick(); t.mock.timers.tick(explicit ? 25 : 8010); await tick()
        assert.equal((await h.pending).status, 'failed')
        assert.equal(h.cancellations, 1); assert.equal(h.soundsCancelled, 1)
        assert.deepEqual(kind === 'preview' ? h.displays.at(-1).state : h.displays.at(-1), h.input.after)
      } finally { h.presenter.destroy() }
    }
    const loaded = deferred(), h = host(kind, { timeout: 25, loaded: loaded.promise })
    try {
      await tick(); t.mock.timers.tick(25); await tick()
      assert.equal((await h.pending).status, 'failed')
      loaded.resolve(); await tick()
      assert.deepEqual(h.plays, [], 'late loading cannot bypass a caller timeout')
    } finally { h.presenter.destroy() }
  }
})

test('longer default host budgets do not delay skip cancellation or let stale loading start', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const kind of ['preview', 'server']) for (const pendingLoad of [false, true]) {
    const loaded = deferred(), h = host(kind, { loaded: pendingLoad ? loaded.promise : Promise.resolve() })
    try {
      await tick(); h.presenter.skip()
      assert.equal((await h.pending).status, 'skipped')
      loaded.resolve(); await tick(); t.mock.timers.tick(9000); await tick()
      assert.equal(h.plays.length, pendingLoad ? 0 : 1)
      assert.equal(h.cancellations, pendingLoad ? 0 : 1)
    } finally { h.presenter.destroy() }
  }
})
