import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createBattleState, resolveMove } from '@battle/battle-core'
import { MOVES } from '../apps/game/src/moveCatalog.js'
import { createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'

const component = readFileSync(new URL('../apps/game/src/components/BattleDemo.vue', import.meta.url), 'utf8')
// Exercise the component's real host binding without mounting its scene renderer.
const onMoveExpression = component.match(/onMove:\s*([\s\S]*?),\n\s*getScene:/)?.[1]
assert.ok(onMoveExpression, 'BattleDemo supplies a presenter audio binding')
const bindMove = (battleAudio, moves = MOVES) => new Function('battleAudio', 'MOVES', `return (${onMoveExpression})`)(battleAudio, moves)
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
const transaction = (moveId = 'flamethrower') => resolveMove(createBattleState(), { moveId, sourceId: 'source', targetId: 'target' })

function harness(overrides = {}, { throwImpact = false } = {}) {
  const ready = deferred(), scopes = [], plays = [], displays = [], errors = [], order = []
  const battleAudio = { previewMove(request) {
    const scope = { request, impacts: 0, effectSounds: 0, cancellations: 0, finishes: [], clocks: [] }
    scopes.push(scope)
    return {
      onPresentation(cue) { scope.clocks.push(cue) },
      onImpact() {
        scope.impacts++; order.push('impact')
        if (throwImpact) throw new Error('Impact audio unavailable')
        if (request.effectiveness === 'super-effective') scope.effectSounds++
      },
      finish(result) { scope.finishes.push(result); order.push('finish'); return new Promise(() => {}) },
      cancel() { scope.cancellations++; order.push('cancel') },
    }
  } }
  const presenter = createPresenter({
    getScene: () => ({}), deadlineMs: 1000, onMove: bindMove(battleAudio),
    onError: error => errors.push(error),
    onDisplay(value) { displays.push(value); order.push(value.animate ? 'reveal' : 'display') },
    loadFx: async () => ({ play(request, options) {
      const done = deferred(), play = { request, options, done, cancellations: 0 }
      plays.push(play); ready.resolve()
      return { finished: done.promise, cancel() { play.cancellations++ } }
    } }),
    ...overrides,
  })
  return { presenter, scopes, plays, displays, errors, order, ready: ready.promise }
}

test('preview host uses only the requested move’s strict existing effectiveness flag', () => {
  const requests = [], sentinel = {}, onMove = bindMove({ previewMove(request) { requests.push(request); return sentinel } })
  for (const moveId of ['flamethrower', 'tackle', 'unknown-move']) {
    const request = Object.freeze({ moveId, phase: 'attack', mode: 'normal', outcome: 'hit' })
    assert.equal(onMove(request), sentinel)
    assert.deepEqual(requests.at(-1), { ...request, effectiveness: moveId === 'flamethrower' ? 'super-effective' : null })
    assert.equal(Object.hasOwn(request, 'effectiveness'), false)
  }
  const strict = bindMove({ previewMove: request => request }, [
    { id: 'false-flag', effective: false, type: 'Fire' }, { id: 'truthy-flag', effective: 'true', type: 'Fire' },
    { id: 'no-flag', type: 'Fire' }, { id: 'true-flag', effective: true, type: 'Normal' },
  ])
  for (const moveId of ['false-flag', 'truthy-flag', 'no-flag', 'true-flag']) {
    assert.equal(strict({ moveId, effectiveness: 'super-effective' }).effectiveness, moveId === 'true-flag' ? 'super-effective' : null)
  }
})

test('successful effective and normal attacks notify impact once without altering committed results or awaiting tails', async () => {
  for (const moveId of ['flamethrower', 'tackle']) {
    const tx = transaction(moveId), saved = structuredClone(tx), h = harness(), pending = h.presenter.enqueue(tx)
    await h.ready
    const play = h.plays[0], scope = h.scopes[0]
    assert.equal(scope.impacts, 0)
    assert.equal(Object.hasOwn(play.request, 'effectiveness'), false, 'effectiveness stays out of FX')
    play.options.onPresentation({ type: 'start', timelineSeconds: 0 })
    play.options.onCue({ type: 'recovery' })
    assert.equal(scope.impacts, 0)
    assert.equal(h.displays.at(-1).state, tx.before)
    play.options.onCue({ type: 'impact' }); play.options.onCue({ type: 'impact' }); play.options.onCue({ type: 'recovery' })
    assert.equal(scope.impacts, 1)
    assert.equal(scope.effectSounds, moveId === 'flamethrower' ? 1 : 0)
    assert.equal(h.displays.at(-1).state, tx.after)
    assert.equal(h.displays.filter(value => value.animate).length, 1)
    play.done.resolve({ status: 'completed' })
    assert.deepEqual(await pending, { status: 'completed' })
    assert.equal(scope.impacts, 1); assert.equal(scope.cancellations, 0)
    assert.deepEqual(scope.finishes, [{ status: 'completed' }])
    play.options.onCue({ type: 'impact' })
    assert.equal(scope.impacts, 1); assert.deepEqual(tx, saved)
    h.presenter.destroy()
  }
})

test('successful missing-cue completion notifies once at logical result reveal before letting the audio tail finish', async () => {
  const tx = transaction(), h = harness(), pending = h.presenter.enqueue(tx)
  await h.ready
  assert.equal(h.scopes[0].impacts, 0); assert.equal(h.displays.at(-1).state, tx.before)
  h.plays[0].done.resolve({ status: 'completed' })
  assert.equal((await pending).status, 'completed')
  assert.equal(h.scopes[0].impacts, 1)
  assert.deepEqual(h.order.slice(-3), ['impact', 'finish', 'display'])
  assert.equal(h.displays.at(-1).state, tx.after); assert.equal(h.scopes[0].cancellations, 0)
  h.plays[0].options.onCue({ type: 'impact' })
  assert.equal(h.scopes[0].impacts, 1)
  h.presenter.destroy()
})

test('preparations and unsuccessful outcomes never notify effectiveness even with erroneous impact cues', async () => {
  const preparation = createPreviewTransaction(MOVES.find(move => move.id === 'fly'), { phase: 'prepare' })
  const failed = transaction('rest')
  assert.equal(failed.event.outcome, 'failed')
  for (const tx of [preparation, failed, ...['miss', 'immune'].map(outcome => {
    const base = transaction()
    return { ...base, after: base.before, event: { ...base.event, outcome } }
  })]) {
    const saved = structuredClone(tx), h = harness(), pending = h.presenter.enqueue(tx)
    await h.ready
    h.plays[0].options.onCue({ type: 'impact' }); h.plays[0].options.onCue({ type: 'prepared' })
    h.plays[0].done.resolve({ status: 'completed' })
    await pending
    assert.ok(h.scopes.every(scope => scope.impacts === 0))
    assert.equal(h.scopes.length, tx.event.phase === 'prepare' ? 1 : 0)
    assert.equal(h.displays.at(-1).state, tx.after); assert.deepEqual(tx, saved)
    h.presenter.destroy()
  }
})

test('skipped, cancelled, timed-out and failed clips do not invent impact sounds and reject late callbacks', async () => {
  for (const mode of ['skip', 'reset', 'destroy', 'deadline', 'failed', 'returned-skip', 'returned-cancel']) {
    const tx = transaction(), h = harness({ deadlineMs: mode === 'deadline' ? 20 : 1000 }), pending = h.presenter.enqueue(tx)
    await h.ready
    const play = h.plays[0], scope = h.scopes[0]
    if (mode === 'skip') h.presenter.skip()
    if (mode === 'reset') h.presenter.reset(tx.before)
    if (mode === 'destroy') h.presenter.destroy()
    if (mode === 'failed') play.done.resolve({ status: 'failed' })
    if (mode === 'returned-skip') play.done.resolve({ status: 'skipped' })
    if (mode === 'returned-cancel') play.done.resolve({ status: 'cancelled' })
    const result = await pending
    assert.notEqual(result.status, 'completed', mode)
    assert.equal(scope.impacts, 0, mode); assert.equal(scope.cancellations, 1, mode)
    assert.deepEqual(scope.finishes, [])
    play.options.onCue({ type: 'impact' }); play.done.resolve({ status: 'completed' }); await tick()
    assert.equal(scope.impacts, 0, mode)
    if (!['reset', 'destroy'].includes(mode)) assert.equal(h.displays.at(-1).state, tx.after)
    h.presenter.destroy()
  }
})

test('effects-off and unavailable FX reconcile the result without creating an impact audio scope', async () => {
  for (const mode of ['off', 'scene', 'import-failure']) {
    const h = harness({ ...(mode === 'scene' ? { getScene: () => null } : {}),
      ...(mode === 'import-failure' ? { loadFx: async () => { throw new Error('Import unavailable') } } : {}) })
    const tx = transaction()
    assert.notEqual((await h.presenter.enqueue(tx, { effectsEnabled: mode !== 'off' })).status, 'completed')
    assert.equal(h.scopes.length, 0); assert.equal(h.plays.length, 0)
    assert.equal(h.displays.at(-1).state, tx.after)
    h.presenter.destroy()
  }
})

test('reset after impact cancels its sound scope once and stale cues cannot affect a replacement', async () => {
  const tx = transaction(), h = harness(), first = h.presenter.enqueue(tx)
  await h.ready
  const old = h.plays[0]
  old.options.onCue({ type: 'impact' }); h.presenter.reset(tx.before)
  assert.equal((await first).status, 'cancelled')
  assert.equal(h.scopes[0].impacts, 1); assert.equal(h.scopes[0].cancellations, 1)
  const next = h.presenter.enqueue(transaction('tackle')); await tick()
  old.options.onCue({ type: 'impact' }); old.done.resolve({ status: 'completed' })
  assert.equal(h.scopes[1].impacts, 0); assert.equal(h.scopes[1].cancellations, 0)
  h.plays[1].options.onCue({ type: 'impact' }); h.plays[1].done.resolve({ status: 'completed' })
  await next
  assert.equal(h.scopes[0].impacts, 1); assert.equal(h.scopes[0].cancellations, 1)
  assert.equal(h.scopes[1].impacts, 1); assert.equal(h.scopes[1].cancellations, 0)
  h.presenter.destroy()
})

test('an optional impact audio error cannot prevent result reveal or cause duplicate attempts', async () => {
  for (const cue of [true, false]) {
    const tx = transaction(), h = harness({}, { throwImpact: true }), pending = h.presenter.enqueue(tx)
    await h.ready
    if (cue) { h.plays[0].options.onCue({ type: 'impact' }); h.plays[0].options.onCue({ type: 'impact' }) }
    h.plays[0].done.resolve({ status: 'completed' })
    assert.equal((await pending).status, 'completed')
    assert.equal(h.scopes[0].impacts, 1); assert.equal(h.errors.length, 1)
    assert.equal(h.displays.at(-1).state, tx.after); assert.equal(h.scopes[0].cancellations, 0)
    h.presenter.destroy()
  }
})
