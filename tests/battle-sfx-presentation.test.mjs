import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleState, resolveMove, MOVE_RULES } from '@battle/battle-core'
import { createPreviewState } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'

const clone = value => structuredClone(value)
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
const start = Object.freeze({ type: 'start', timelineSeconds: 0, observedAtMs: 100, durationSeconds: 1, reducedMotion: false })
const frame = Object.freeze({ type: 'frame', timelineSeconds: 0.4, observedAtMs: 500, durationSeconds: 1, reducedMotion: false })
const pokemon = (memberId, species) => ({ memberId, species, name: species, active: true, hp: { current: 100, max: 100 },
  hpPrecision: 'exact', fainted: false, condition: null, stages: {}, volatiles: [], moves: [], item: null, ability: null })

function batchFor({ seat = 'p1', actor = 'source', move = 'Tackle', facts } = {}) {
  const other = seat === 'p1' ? 'p2' : 'p1'
  const own = `${seat}:1`, opponent = `${other}:revealed:1`
  const source = actor === 'source' ? own : opponent, target = actor === 'source' ? opponent : own
  const before = { matchId: 'sfx-battle', seat, cursor: 10, turn: 1,
    own: { active: own, team: [pokemon(own, 'Charizard')] },
    opponent: { active: opponent, known: [pokemon(opponent, 'Venusaur')] },
    weather: null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], result: null, complete: true,
    decision: { id: 'turn-one', kind: 'move', moves: [] } }
  const events = [event(11, 'move', source, move, target), ...(facts ?? [event(12, '-damage', target, '60/100')])]
  const after = clone(before)
  after.cursor = events.at(-1).cursor
  if (!facts) (actor === 'source' ? after.opponent.known[0] : after.own.team[0]).hp.current = 60
  return { before, after, events }
}

function soundRecorder() {
  const scopes = []
  function onMove(request) {
    const value = { request, events: [], finishes: [], cancellations: 0 }
    scopes.push(value)
    return {
      onPresentation: cue => value.events.push(cue),
      finish: result => { value.finishes.push(result); return new Promise(() => {}) },
      cancel: () => { value.cancellations++ },
    }
  }
  return { scopes, onMove }
}

function simulation(overrides = {}, { manual = false } = {}) {
  const audio = soundRecorder(), displays = [], plays = [], scene = {}, entered = deferred()
  const presenter = createSimulationPresenter({
    getScene: () => scene, ensureScene: async () => {}, onDisplay: value => displays.push(clone(value)),
    onMove: audio.onMove,
    loadFx: async () => ({ play(request, options) {
      const done = deferred(), value = { request, options, done, cancellations: 0 }
      plays.push(value)
      entered.resolve()
      if (!manual) done.resolve({ status: 'completed' })
      return { finished: done.promise, cancel() { value.cancellations++ } }
    } }),
    ...overrides,
  })
  return { presenter, ...audio, displays, plays, ready: entered.promise }
}

function preview(overrides = {}, { manual = false } = {}) {
  const audio = soundRecorder(), displays = [], plays = [], scene = {}, entered = deferred()
  const presenter = createPresenter({
    getScene: () => scene, onDisplay: value => displays.push(value), onMove: audio.onMove,
    loadFx: async () => ({ play(request, options) {
      const done = deferred(), value = { request, options, done, cancellations: 0 }
      plays.push(value)
      entered.resolve()
      if (!manual) done.resolve({ status: 'completed' })
      return { finished: done.promise, cancel() { value.cancellations++ } }
    } }),
    ...overrides,
  })
  return { presenter, ...audio, displays, plays, ready: entered.promise }
}
const transaction = (moveId = 'tackle', sourceId = 'source') => resolveMove(createBattleState(), { moveId, sourceId, targetId: sourceId === 'source' ? 'target' : 'source' })

test('server move audio prepares both seats without sounding before the actual FX clock starts', async () => {
  for (const seat of ['p1', 'p2']) for (const actor of ['source', 'target']) {
    const batch = batchFor({ seat, actor }), saved = clone(batch), h = simulation({}, { manual: true })
    const pending = h.presenter.present(batch)
    await h.ready
    assert.equal(h.scopes.length, 1)
    assert.deepEqual(h.scopes[0].request, { moveId: 'tackle', cursor: 11, phase: 'attack', mode: 'normal', outcome: 'hit' })
    assert.equal(h.plays[0].request.sourceId, actor)
    assert.deepEqual(h.scopes[0].events, [], 'onMove only prepares the sound scope')
    h.plays[0].options.onPresentation(start)
    h.plays[0].options.onPresentation(frame)
    assert.deepEqual(h.scopes[0].events, [start, frame])
    assert.equal(h.displays.length, 0, 'cosmetic clock frames cannot reveal committed HP')
    h.plays[0].options.onCue({ type: 'impact' })
    assert.equal((actor === 'source' ? h.displays.at(-1).opponent.known[0] : h.displays.at(-1).own.team[0]).hp.current, 60)
    h.plays[0].done.resolve({ status: 'completed' })
    assert.deepEqual(await pending, { status: 'completed' })
    assert.deepEqual(h.scopes[0].finishes, [{ status: 'completed' }])
    assert.equal(h.scopes[0].cancellations, 0, 'normal result cleanup must allow an already sounding tail')
    assert.deepEqual(h.displays.at(-1), batch.after); assert.deepEqual(batch, saved)
    h.presenter.destroy()
  }
})

test('server effects-off, missing scenes, failed moves and unknown effects never create a move sound scope', async () => {
  for (const mode of ['off', 'scene', '-fail', '-immune', '-miss', 'unknown', 'prepare-unsupported']) {
    const facts = mode.startsWith('-') ? [event(12, mode, 'p2:revealed:1')] : mode === 'prepare-unsupported' ? [event(12, '-prepare', 'p1:1', 'Tackle')] : undefined
    const batch = batchFor({ facts, move: mode === 'unknown' ? 'Unknown Future Move' : 'Tackle' })
    const saved = clone(batch), h = simulation(mode === 'scene' ? { getScene: () => null } : {})
    const result = await h.presenter.present(batch, { effectsEnabled: mode !== 'off' })
    assert.equal(result.status, mode === 'off' ? 'skipped' : 'completed')
    assert.equal(h.scopes.length, 0, mode); assert.equal(h.plays.length, 0, mode)
    assert.deepEqual(h.displays.at(-1), batch.after); assert.deepEqual(batch, saved)
    h.presenter.destroy()
  }
})

test('server preparation and reduced motion retain explicit modes so unapproved sound plans can stay silent', async () => {
  for (const phase of ['attack', 'prepare']) {
    const facts = phase === 'prepare' ? [event(12, '-prepare', 'p1:1', 'Fly')] : undefined
    const batch = batchFor({ move: 'Fly', facts }), h = simulation()
    assert.deepEqual(await h.presenter.present(batch, { reducedMotion: true }), { status: 'completed' })
    assert.equal(h.scopes[0].request.phase, phase)
    assert.equal(h.scopes[0].request.mode, 'reduced')
    assert.deepEqual(h.scopes[0].events, [], 'a plan request never invents a presentation start')
    assert.deepEqual(h.displays.at(-1), batch.after); h.presenter.destroy()
  }
})

test('a completed server move cannot forward retained clock events into the next sound scope', async () => {
  const batch = batchFor(), h = simulation({}, { manual: true })
  batch.events.push(event(13, 'move', 'p2:revealed:1', 'Tackle', 'p1:1'), event(14, '-damage', 'p1:1', '80/100'))
  batch.after.own.team[0].hp.current = 80; batch.after.cursor = 14
  const pending = h.presenter.present(batch)
  await h.ready
  const old = h.plays[0]
  old.options.onPresentation(start); old.done.resolve({ status: 'completed' }); await tick()
  assert.equal(h.plays.length, 2)
  old.options.onPresentation(frame)
  assert.deepEqual(h.scopes[0].events, [start])
  assert.deepEqual(h.scopes[1].events, [])
  h.plays[1].options.onPresentation(start); h.plays[1].done.resolve({ status: 'completed' })
  assert.deepEqual(await pending, { status: 'completed' })
  assert.deepEqual(h.scopes[1].events, [start]); assert.ok(h.scopes.every(value => value.cancellations === 0))
  assert.deepEqual(h.displays.at(-1), batch.after); h.presenter.destroy()
})

test('server skip, reset, destroy, deadline and failed FX cancel sound exactly once and discard stale clocks', async () => {
  for (const mode of ['skip', 'reset', 'destroy', 'deadline', 'failure']) {
    const batch = batchFor(), saved = clone(batch), h = simulation({ timeoutMs: mode === 'deadline' ? 15 : 1000 }, { manual: true })
    const pending = h.presenter.present(batch)
    await h.ready
    const playback = h.plays[0], scope = h.scopes[0]
    playback.options.onPresentation(start)
    if (mode === 'skip') h.presenter.skip()
    if (mode === 'reset') h.presenter.reset(batch.before)
    if (mode === 'destroy') h.presenter.destroy()
    if (mode === 'failure') playback.done.resolve({ status: 'failed' })
    const result = await pending
    assert.equal(result.status, mode === 'skip' ? 'skipped' : ['reset', 'destroy'].includes(mode) ? 'cancelled' : 'failed')
    assert.equal(scope.cancellations, 1, mode)
    assert.deepEqual(scope.finishes, [], mode)
    playback.options.onPresentation(frame); playback.done.resolve({ status: 'completed' }); await tick()
    assert.deepEqual(scope.events, [start]); assert.deepEqual(batch, saved)
    if (!['reset', 'destroy'].includes(mode)) assert.deepEqual(h.displays.at(-1), batch.after)
    h.presenter.destroy()
  }
})

test('unavailable server FX cannot prepare sound before loading succeeds', async () => {
  for (const loadFx of [async () => null, async () => { throw new Error('FX unavailable') }]) {
    const batch = batchFor(), h = simulation({ loadFx })
    assert.equal((await h.presenter.present(batch)).status, 'failed')
    assert.equal(h.scopes.length, 0)
    assert.deepEqual(h.displays.at(-1), batch.after); h.presenter.destroy()
  }
})

test('server sound callbacks may throw without changing authoritative battle results', async () => {
  for (const failure of ['prepare', 'clock', 'finish', 'cancel']) {
    const batch = batchFor(), h = simulation({ onMove() {
      if (failure === 'prepare') throw new Error('No audio device')
      return { onPresentation() { if (failure === 'clock') throw new Error('Audio schedule failed') },
        finish() { if (failure === 'finish') throw new Error('Audio tail unavailable') },
        cancel() { if (failure === 'cancel') throw new Error('Audio cleanup failed') } }
    } }, { manual: true })
    const pending = h.presenter.present(batch); await h.ready
    h.plays[0].options.onPresentation?.(start)
    if (failure === 'cancel') h.presenter.skip()
    else h.plays[0].done.resolve({ status: 'completed' })
    assert.equal((await pending).status, failure === 'cancel' ? 'skipped' : 'completed')
    assert.deepEqual(h.displays.at(-1), batch.after); h.presenter.destroy()
  }
})

test('preview sound clocks do not replace impact/recovery cues or await audio tails', async () => {
  const move = MOVE_RULES.find(value => value.id === 'absorb')
  const before = createPreviewState(move), tx = resolveMove(before, { moveId: 'absorb', sourceId: 'source', targetId: 'target' })
  const saved = clone(tx), h = preview({}, { manual: true }), pending = h.presenter.enqueue(tx)
  await h.ready
  assert.equal(h.scopes[0].request.moveId, 'absorb')
  assert.equal(h.scopes[0].request.mode, 'normal')
  assert.equal(h.scopes[0].request.phase, 'attack')
  assert.equal(h.scopes[0].request.outcome, 'hit')
  assert.deepEqual(h.scopes[0].events, [])
  h.plays[0].options.onPresentation(start); h.plays[0].options.onPresentation(frame)
  assert.equal(h.displays.at(-1).state, tx.before)
  h.plays[0].options.onCue({ type: 'recovery' })
  assert.equal(h.displays.at(-1).state, tx.before)
  h.plays[0].options.onCue({ type: 'impact' })
  assert.equal(h.displays.at(-1).state.actors.target.hp, tx.after.actors.target.hp)
  assert.equal(h.displays.at(-1).state.actors.source.hp, tx.before.actors.source.hp)
  h.plays[0].options.onCue({ type: 'recovery' })
  assert.equal(h.displays.at(-1).state, tx.after)
  h.plays[0].done.resolve({ status: 'completed' })
  assert.deepEqual(await pending, { status: 'completed' })
  assert.deepEqual(h.scopes[0].events, [start, frame])
  assert.deepEqual(h.scopes[0].finishes, [{ status: 'completed' }]); assert.equal(h.scopes[0].cancellations, 0)
  assert.deepEqual(tx, saved); h.presenter.destroy()
})

test('preview uses either actor and explicit reduced/prepare modes without inventing sound starts', async () => {
  for (const sourceId of ['source', 'target']) {
    const tx = transaction('tackle', sourceId), h = preview()
    assert.equal((await h.presenter.enqueue(tx, { reducedMotion: true })).status, 'completed')
    assert.equal(h.plays[0].request.sourceId, sourceId)
    assert.equal(h.scopes[0].request.mode, 'reduced')
    assert.deepEqual(h.scopes[0].events, []); assert.equal(h.displays.at(-1).state, tx.after)
    h.presenter.destroy()
  }
  const tx = transaction('fly'), h = preview()
  const preparation = { ...tx, after: tx.before, event: { ...tx.event, phase: 'prepare' } }
  await h.presenter.enqueue(preparation)
  assert.equal(h.scopes[0].request.phase, 'prepare'); assert.equal(h.displays.at(-1).state, tx.before)
  h.presenter.destroy()
})

test('preview effects-off, missing scene, failed outcome and unavailable FX create no sound scope', async () => {
  for (const mode of ['off', 'scene', 'failed', 'null-fx', 'load-error']) {
    const tx = transaction(mode === 'failed' ? 'rest' : 'tackle'), h = preview({ ...(mode === 'scene' ? { getScene: () => null } : {}),
      ...(mode === 'null-fx' ? { loadFx: async () => null } : {}),
      ...(mode === 'load-error' ? { loadFx: async () => { throw new Error('FX unavailable') } } : {}) })
    if (mode === 'failed') assert.equal(tx.event.outcome, 'failed')
    await h.presenter.enqueue(tx, { effectsEnabled: mode !== 'off' })
    assert.equal(h.scopes.length, 0, mode); assert.equal(h.displays.at(-1).state, tx.after)
    h.presenter.destroy()
  }
})

test('preview skip, reset, destroy, deadline and failed playback cancel audio and ignore retained clocks', async () => {
  for (const mode of ['skip', 'reset', 'destroy', 'deadline', 'failure']) {
    const tx = transaction(), saved = clone(tx), h = preview({ deadlineMs: mode === 'deadline' ? 15 : 1000 }, { manual: true })
    const pending = h.presenter.enqueue(tx); await h.ready
    const playback = h.plays[0], scope = h.scopes[0]
    playback.options.onPresentation(start)
    if (mode === 'skip') h.presenter.skip()
    if (mode === 'reset') h.presenter.reset(tx.before)
    if (mode === 'destroy') h.presenter.destroy()
    if (mode === 'failure') playback.done.resolve({ status: 'failed' })
    assert.equal((await pending).status, mode === 'skip' ? 'skipped' : ['reset', 'destroy'].includes(mode) ? 'cancelled' : 'failed')
    assert.equal(scope.cancellations, 1, mode); assert.deepEqual(scope.finishes, [])
    playback.options.onPresentation(frame); playback.done.resolve({ status: 'completed' }); await tick()
    assert.deepEqual(scope.events, [start]); assert.deepEqual(tx, saved)
    if (!['reset', 'destroy'].includes(mode)) assert.equal(h.displays.at(-1).state, tx.after)
    h.presenter.destroy()
  }
})

test('preview optional sound exceptions never fail a completed or skipped committed transaction', async () => {
  for (const failure of ['prepare', 'clock', 'finish', 'cancel']) {
    const tx = transaction(), h = preview({ onMove() {
      if (failure === 'prepare') throw new Error('Audio unavailable')
      return { onPresentation() { if (failure === 'clock') throw new Error('Clock observer unavailable') },
        finish() { if (failure === 'finish') throw new Error('Tail unavailable') },
        cancel() { if (failure === 'cancel') throw new Error('Cancel unavailable') } }
    } }, { manual: true })
    const pending = h.presenter.enqueue(tx); await h.ready
    h.plays[0].options.onPresentation?.(start)
    if (failure === 'cancel') h.presenter.skip()
    else h.plays[0].done.resolve({ status: 'completed' })
    assert.equal((await pending).status, failure === 'cancel' ? 'skipped' : 'completed')
    assert.equal(h.displays.at(-1).state, tx.after); h.presenter.destroy()
  }
})

test('late FX imports after reconnect/reset do not prepare or start sound in either presenter', async () => {
  for (const kind of ['server', 'preview']) {
    const loading = deferred(), entered = deferred()
    const overrides = { loadFx: () => { entered.resolve(); return loading.promise } }
    const h = kind === 'server' ? simulation(overrides) : preview(overrides)
    const value = kind === 'server' ? batchFor() : transaction()
    const pending = kind === 'server' ? h.presenter.present(value) : h.presenter.enqueue(value)
    await entered.promise
    h.presenter.reset(value.before)
    assert.equal((await pending).status, 'cancelled')
    let latePlays = 0
    loading.resolve({ play() { latePlays++; return { finished: Promise.resolve({ status: 'completed' }) } } })
    await tick()
    assert.equal(latePlays, 0); assert.equal(h.scopes.length, 0)
    const display = kind === 'server' ? h.displays.at(-1) : h.displays.at(-1).state
    assert.deepEqual(display, value.before); h.presenter.destroy()
  }
})

test('skipped FX close prepared sound scopes without marking a completed audio tail', async () => {
  for (const kind of ['server', 'preview']) {
    const h = kind === 'server' ? simulation({}, { manual: true }) : preview({}, { manual: true })
    const value = kind === 'server' ? batchFor() : transaction()
    const pending = kind === 'server' ? h.presenter.present(value) : h.presenter.enqueue(value)
    await h.ready; h.plays[0].done.resolve({ status: 'skipped' })
    assert.equal((await pending).status, kind === 'server' ? 'completed' : 'skipped')
    assert.equal(h.scopes[0].cancellations, 1); assert.deepEqual(h.scopes[0].finishes, [])
    h.plays[0].options.onPresentation(start)
    assert.deepEqual(h.scopes[0].events, [])
    const display = kind === 'server' ? h.displays.at(-1) : h.displays.at(-1).state
    assert.deepEqual(display, value.after); h.presenter.destroy()
  }
})

test('completed preview callbacks cannot attach an old clock to a queued replacement', async () => {
  const h = preview({}, { manual: true }), one = transaction(), two = transaction('flamethrower', 'target')
  const first = h.presenter.enqueue(one), second = h.presenter.enqueue(two)
  await h.ready
  const old = h.plays[0]
  old.options.onPresentation(start); old.done.resolve({ status: 'completed' }); await first; await tick()
  old.options.onPresentation(frame)
  assert.deepEqual(h.scopes[0].events, [start]); assert.deepEqual(h.scopes[1].events, [])
  h.plays[1].options.onPresentation(start); h.plays[1].done.resolve({ status: 'completed' })
  assert.deepEqual(await second, { status: 'completed' })
  assert.deepEqual(h.scopes[1].events, [start]); assert.ok(h.scopes.every(value => value.cancellations === 0))
  assert.equal(h.displays.at(-1).state, two.after); h.presenter.destroy()
})
