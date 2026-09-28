import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleState, resolveMove } from '@battle/battle-core'
import { MOVES } from '../apps/game/src/moveCatalog.js'
import { createPreviewTransaction } from '../apps/game/src/previewState.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'

const WEATHER_MOVES = { 'rain-dance': 'rain', 'sunny-day': 'sun', sandstorm: 'sandstorm', hail: 'hail' }
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const transaction = (moveId, sourceId = 'source') => createPreviewTransaction(MOVES.find(move => move.id === moveId), { sourceId })

function harness(overrides = {}) {
  const scene = {}, displays = [], busy = [], errors = [], weatherPlays = [], movePlays = [], sounds = []
  let weatherImports = 0, moveImports = 0
  const presenter = createPresenter({
    getScene: () => scene, deadlineMs: 1000,
    onDisplay: display => displays.push(display), onBusy: value => busy.push(value), onError: error => errors.push(error),
    onMove: request => { sounds.push(request); return null },
    loadWeather: async () => {
      weatherImports++
      return { playWeatherContinuation(request, options) {
        const done = deferred(), play = { request, options, done, cancelled: 0 }
        weatherPlays.push(play)
        return { finished: done.promise, cancel: () => play.cancelled++ }
      } }
    },
    loadFx: async () => {
      moveImports++
      return { play(request, options) {
        movePlays.push({ request, options })
        return { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
      } }
    },
    ...overrides,
  })
  return { scene, presenter, displays, busy, errors, weatherPlays, movePlays, sounds,
    get weatherImports() { return weatherImports }, get moveImports() { return moveImports } }
}

test('each weather continuation displays committed weather before loading without another move or cast sound', async () => {
  for (const [moveId, weatherId] of Object.entries(WEATHER_MOVES)) for (const sourceId of ['source', 'target']) {
    const tx = transaction(moveId, sourceId), saved = structuredClone(tx), h = harness()
    try {
      for (let index = 0; index < 2; index++) {
        const run = h.presenter.enqueue(tx, { weatherContinuation: true, visualSeed: 42 })
        assert.equal(h.displays.at(-1).state, tx.after, 'badge appears before module loading or playback')
        assert.equal(h.displays.at(-1).state.weather, weatherId)
        assert.equal(h.displays.at(-1).animate, false)
        assert.notEqual(h.displays.at(-1).message, tx.event.usedMessage)
        await tick()
        const play = h.weatherPlays[index]
        assert.deepEqual(play.request, { weatherId, visualSeed: 42 })
        assert.equal(play.options.scene, h.scene)
        assert.equal(play.options.signal.aborted, false)
        assert.equal(play.options.onCue, undefined, 'continuation has no gameplay reveal cues')
        play.done.resolve({ status: 'completed' })
        assert.equal((await run).status, 'completed')
        assert.equal(h.displays.at(-1).state, tx.after)
        assert.match(h.displays.at(-1).message, /Weather preview only/)
        assert.equal(h.busy.at(-1), false)
      }
      assert.equal(h.weatherImports, 1)
      assert.equal(h.moveImports, 0)
      assert.deepEqual(h.movePlays, [])
      assert.deepEqual(h.sounds, [])
      assert.deepEqual(tx, saved)
      assert.deepEqual(tx.after, resolveMove(tx.before, { moveId, sourceId }).after)
      assert.deepEqual(tx.after.actors, tx.before.actors, 'no residual damage or turn rules added')
      assert.equal(tx.after.revision, tx.before.revision + 1, 'replaying committed display does not resolve again')
    } finally { h.presenter.destroy() }
  }
})

test('weather preview reduced motion reaches its dedicated renderer and preserves all actor fields', async () => {
  const h = harness(), tx = transaction('hail')
  try {
    const run = h.presenter.enqueue(tx, { weatherContinuation: true, reducedMotion: true })
    await tick()
    assert.equal(h.weatherPlays[0].options.reducedMotion, true)
    h.weatherPlays[0].done.resolve({ status: 'completed' })
    await run
    assert.equal(h.displays.at(-1).state, tx.after)
    assert.equal(h.displays.every(display => !display.animate), true)
    assert.deepEqual(h.sounds, [])
  } finally { h.presenter.destroy() }
})

test('weather preview off, unavailable scene, renderer errors, skip and timeout reconcile the same committed weather', async () => {
  for (const mode of ['off', 'no-scene', 'import-error', 'renderer-error', 'failed', 'skip', 'timeout']) {
    const tx = transaction('sandstorm'), h = harness({
      ...(mode === 'timeout' ? { deadlineMs: 20 } : {}),
      ...(mode === 'no-scene' ? { getScene: () => null } : {}),
      ...(mode === 'import-error' ? { loadWeather: async () => { throw Error('import unavailable') } } : {}),
      ...(mode === 'renderer-error' ? { loadWeather: async () => ({ playWeatherContinuation() { throw Error('renderer failed') } }) } : {}),
    })
    try {
      const run = h.presenter.enqueue(tx, { weatherContinuation: true, effectsEnabled: mode !== 'off' })
      await tick()
      if (mode === 'failed') h.weatherPlays[0].done.resolve({ status: 'failed' })
      if (mode === 'skip') h.presenter.skip()
      const result = await run
      assert.equal(result.status, ['off', 'no-scene', 'skip'].includes(mode) ? 'skipped' : 'failed', mode)
      assert.equal(h.displays.at(-1).state, tx.after, mode)
      assert.equal(h.displays.at(-1).state.weather, 'sandstorm')
      assert.equal(h.busy.at(-1), false)
      assert.deepEqual(h.sounds, [])
      assert.equal(h.moveImports, 0)
      if (['off', 'no-scene'].includes(mode)) assert.equal(h.weatherImports, 0)
      if (h.weatherPlays.length) {
        assert.equal(h.weatherPlays[0].options.signal.aborted, true)
        assert.equal(h.weatherPlays[0].cancelled, 1)
      }
    } finally { h.presenter.destroy() }
  }
})

test('reset and destruction cancel active weather and block late imports and completion from replacing a fresh preview', async () => {
  for (const action of ['reset', 'destroy']) for (const stage of ['loading', 'playing']) {
    const importDone = deferred(), latePlays = [], h = harness(stage === 'loading' ? { loadWeather: () => importDone.promise } : {})
    const tx = transaction('rain-dance'), fresh = createBattleState()
    const run = h.presenter.enqueue(tx, { weatherContinuation: true })
    await tick()
    const play = h.weatherPlays[0]
    if (action === 'reset') h.presenter.reset(fresh, 'Fresh preview.')
    else h.presenter.destroy()
    const displayCount = h.displays.length
    importDone.resolve({ playWeatherContinuation() { latePlays.push(true); return { finished: Promise.resolve({ status: 'completed' }), cancel() {} } } })
    play?.done.resolve({ status: 'completed' })
    assert.equal((await run).status, 'cancelled')
    await tick()
    assert.equal(h.displays.at(-1).state, action === 'reset' ? fresh : tx.after)
    if (action === 'reset') assert.equal(h.displays.at(-1).message, 'Fresh preview.')
    assert.equal(h.displays.length, displayCount)
    assert.deepEqual(latePlays, [])
    if (play) { assert.equal(play.options.signal.aborted, true); assert.equal(play.cancelled, 1) }
    h.presenter.destroy()
  }
})

test('a timed-out continuation does not disable ordinary move effects and retry restores weather playback', async () => {
  const h = harness({ deadlineMs: 20 }), tx = transaction('rain-dance')
  try {
    assert.equal((await h.presenter.enqueue(tx, { weatherContinuation: true })).status, 'failed')
    assert.equal((await h.presenter.enqueue(transaction('tackle'))).status, 'completed')
    assert.equal(h.movePlays.length, 1)
    assert.equal(h.sounds.length, 1)
    assert.equal((await h.presenter.enqueue(tx, { weatherContinuation: true })).status, 'skipped')
    assert.equal(h.weatherPlays.length, 1)
    h.presenter.retryEffects()
    const run = h.presenter.enqueue(tx, { weatherContinuation: true }); await tick()
    assert.equal(h.weatherImports, 2)
    h.weatherPlays[1].done.resolve({ status: 'completed' })
    assert.equal((await run).status, 'completed')
  } finally { h.presenter.destroy() }
})

test('only successful weather-setting transactions support continuation, and ordinary casts keep their existing impact reveal', async () => {
  const h = harness()
  try {
    const rain = transaction('rain-dance')
    const invalid = [transaction('tackle'), { ...rain, after: rain.before },
      { ...rain, event: { ...rain.event, outcome: 'failed' } }]
    for (const tx of invalid) assert.equal((await h.presenter.enqueue(tx, { weatherContinuation: true })).status, 'skipped')
    assert.equal(h.weatherImports, 0)
    assert.equal(h.moveImports, 0)
    assert.equal(h.sounds.length, 0)
    const run = h.presenter.enqueue(rain)
    assert.equal(h.displays.at(-1).state, rain.before)
    await run
    assert.equal(h.movePlays[0].request.moveId, 'rain-dance')
    assert.equal(h.weatherImports, 0)
    assert.equal(h.sounds.length, 1)
    assert.equal(h.displays.at(-1).state, rain.after)
    assert.equal(h.displays.at(-1).message, rain.event.resultMessage)
  } finally { h.presenter.destroy() }
})
