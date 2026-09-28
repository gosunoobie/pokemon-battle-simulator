import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'

const clone = value => structuredClone(value)
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
const own = 'p1:1', opponent = 'p2:revealed:1'
const weathers = [['RainDance', 'rain', 'Rain Dance', 'rain-dance'], ['SunnyDay', 'sun', 'Sunny Day', 'sunny-day'], ['Sandstorm', 'sandstorm', 'Sandstorm', 'sandstorm'], ['Hail', 'hail', 'Hail', 'hail']]
function fixture(weather = 'RainDance', upkeep = true) {
  const member = (id, max) => ({ memberId: id, species: 'Venusaur', name: 'Venusaur', active: true, hp: { current: max, max },
    hpPrecision: id === own ? 'exact' : 'public', fainted: false, condition: null, stages: {}, volatiles: [], moves: [], item: null, ability: null })
  const before = { matchId: 'weather-continuation', seat: 'p1', cursor: 10, turn: 2,
    own: { active: own, team: [member(own, 320)] }, opponent: { active: opponent, known: [member(opponent, 48)] },
    weather: upkeep ? weather : null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], result: null, complete: true }
  const after = clone(before); after.weather = weather; after.cursor = 11
  const events = [event(11, '-weather', weather, ...(upkeep ? ['[upkeep]'] : []))]
  return { before, after, events }
}
function harness({ manual = false, loadWeather, ...overrides } = {}) {
  const clips = [], moves = [], displays = [], ensured = [], messages = [], actions = []
  let imports = 0
  // A field-only continuation must work even if there are no actor adapters.
  const scene = { id: 'weather-field', actor() { throw new Error('Weather must not request an actor') } }
  const module = { playWeatherContinuation(request, options) {
    actions.push('weather'); const done = deferred(), clip = { request, options, done, cancelled: 0 }
    clips.push(clip)
    return { finished: manual ? done.promise : Promise.resolve({ status: 'completed' }), cancel() { clip.cancelled++ } }
  } }
  const presenter = createSimulationPresenter({ getScene: () => scene,
    ensureScene: async (view, options) => { actions.push('scene'); ensured.push({ view: clone(view), options }) },
    onDisplay: (view, options) => displays.push({ view: clone(view), options }), onMessage: value => messages.push(value),
    loadFx: async () => ({ play(request, options) {
      actions.push('move'); moves.push(request); options.onCue({ type: 'impact' })
      return { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
    } }),
    loadWeather: async () => { imports++; return loadWeather ? loadWeather(module, imports) : module }, ...overrides,
  })
  return { presenter, clips, moves, displays, ensured, messages, actions, scene, module, get imports() { return imports } }
}

test('all four authoritative upkeep events play a field continuation before following residual HP facts', async () => {
  for (const [weather, weatherId] of weathers) for (const reducedMotion of [false, true]) {
    const batch = fixture(weather), h = harness({ manual: true })
    batch.events.push(event(12, '-damage', own, '300/320', `[from] ${weather}`), event(13, 'turn', '3'))
    batch.after.own.team[0].hp.current = 300; batch.after.cursor = 13; batch.after.turn = 3
    const expected = clone(batch)
    try {
      const pending = h.presenter.present(batch, { reducedMotion }); await tick()
      assert.equal(h.clips.length, 1)
      const clip = h.clips[0]
      assert.deepEqual(clip.request, { weatherId, visualSeed: 11 })
      assert.equal(clip.options.scene, h.scene); assert.equal(clip.options.reducedMotion, reducedMotion)
      assert.ok(clip.options.signal instanceof AbortSignal)
      assert.ok(!h.displays.some(row => row.view.own.team[0].hp.current === 300), 'residual damage waits for field cue completion')
      assert.equal(h.moves.length, 0)
      clip.done.resolve({ status: 'completed' })
      assert.equal((await pending).status, 'completed')
      assert.deepEqual(h.displays.at(-1).view, batch.after); assert.deepEqual(batch, expected)
    } finally { h.presenter.destroy() }
  }
})

test('standalone weather starts and replacements animate without a move or actor requirement', async () => {
  for (const [weather, weatherId] of weathers) {
    const batch = fixture(weather, false), h = harness()
    batch.before.weather = 'RainDance'
    batch.before.own = { active: null, team: [] }; batch.before.opponent = { active: null, known: [] }
    batch.after.own = clone(batch.before.own); batch.after.opponent = clone(batch.before.opponent)
    batch.events[0].args.fields.push('[from] ability: Drought', `[of] ${opponent}`)
    try {
      assert.equal((await h.presenter.present(batch)).status, 'completed')
      assert.deepEqual(h.clips.map(clip => clip.request), [{ weatherId, visualSeed: 11 }])
      assert.equal(h.moves.length, 0); assert.deepEqual(h.displays.at(-1).view, batch.after)
    } finally { h.presenter.destroy() }
  }
})

test('a full weather move casts once while its later upkeep uses the short continuation', async () => {
  for (const [weather, weatherId, name, moveId] of weathers) {
    const batch = fixture(weather, false), h = harness()
    batch.events = [event(11, 'move', own, name, own), event(12, '-weather', weather), event(13, '-weather', weather, '[upkeep]')]
    batch.after.cursor = 13
    try {
      assert.equal((await h.presenter.present(batch)).status, 'completed')
      assert.deepEqual(h.moves.map(move => move.moveId), [moveId])
      assert.deepEqual(h.clips.map(clip => clip.request), [{ weatherId, visualSeed: 13 }])
      assert.deepEqual(h.actions.filter(action => action !== 'scene'), ['move', 'weather'])
    } finally { h.presenter.destroy() }
  }
  const batch = fixture('SunnyDay', false), h = harness()
  batch.events = [event(11, 'move', own, 'Skill Swap', opponent), event(12, '-weather', 'SunnyDay', '[from] ability: Drought', `[of] ${own}`)]
  batch.after.cursor = 12
  try {
    assert.equal((await h.presenter.present(batch)).status, 'completed')
    assert.deepEqual(h.moves.map(move => move.moveId), ['skill-swap'])
    assert.deepEqual(h.clips.map(clip => clip.request), [{ weatherId: 'sun', visualSeed: 12 }])
    assert.deepEqual(h.actions.filter(action => action !== 'scene'), ['move', 'weather'])
  } finally { h.presenter.destroy() }
})

test('weather ending, unsupported weather, repeated cursors and reconnect snapshots cannot replay weather art', async () => {
  for (const mode of ['none', 'unknown', 'historical', 'reconnect']) {
    const batch = fixture(), h = harness()
    if (mode === 'none') { batch.events = [event(11, '-weather', 'none')]; batch.after.weather = null }
    if (mode === 'unknown') { batch.events = [event(11, '-weather', 'FutureWeather', '[upkeep]')]; batch.after.weather = 'FutureWeather' }
    if (mode === 'historical') { batch.events[0].cursor = 10; batch.after.cursor = 10 }
    if (mode === 'reconnect') { batch.before = null; batch.events = [] }
    try {
      assert.equal((await h.presenter.present(batch)).status, 'completed')
      assert.equal(h.imports, 0); assert.equal(h.clips.length, 0)
      assert.deepEqual(h.displays.at(-1).view, batch.after)
    } finally { h.presenter.destroy() }
  }
  const batch = fixture(), h = harness()
  batch.events.push(clone(batch.events[0]))
  try {
    await h.presenter.present(batch); assert.equal(h.clips.length, 1, 'duplicate cursors animate once')
    await h.presenter.present({ before: batch.after, after: batch.after, events: batch.events })
    assert.equal(h.clips.length, 1, 'already displayed cursors never replay')
  } finally { h.presenter.destroy() }
})

test('weather expiry retains the badge through the last move recovery, then announces and displays normal weather', async () => {
  for (const [weather] of weathers) for (const reducedMotion of [false, true]) {
    const recovery = deferred(), batch = fixture(weather)
    const h = harness({ loadFx: async () => ({ play(_request, options) {
      options.onCue({ type: 'impact' })
      return { finished: recovery.promise, cancel() {} }
    } }) })
    batch.before.turn = 5
    batch.events = [event(11, 'move', own, 'Splash', own), event(12, '-nothing'),
      event(13, '-weather', 'none'), event(14, 'upkeep'), event(15, 'turn', '6')]
    batch.after.weather = null; batch.after.turn = 6; batch.after.cursor = 15
    try {
      const pending = h.presenter.present(batch, { reducedMotion }); await tick()
      assert.equal(h.displays.at(-1).view.weather, weather, 'weather is still active at the final move impact')
      assert.equal(h.displays.at(-1).view.cursor, 12, 'expiry is not included in the preceding impact snapshot')
      assert.ok(!h.messages.includes('The weather returned to normal.'))
      recovery.resolve({ status: 'completed' })
      assert.equal((await pending).status, 'completed')
      assert.equal(h.displays.find(row => row.view.weather === null).view.cursor, 13)
      assert.equal(h.messages.filter(text => text === 'The weather returned to normal.').length, 1)
      assert.equal(h.imports, 0, 'expiry never starts another weather clip')
      assert.deepEqual(h.displays.at(-1).view, batch.after)
    } finally { h.presenter.destroy() }
  }
})

test('a new opening ability weather starts once after entries; unrelated or absent history never replays it', async () => {
  const batch = fixture('RainDance', false), entered = deferred(), h = harness({ manual: true,
    ensureScene: () => entered.promise })
  batch.before = null; batch.after.turn = 1
  batch.events = [event(9, 'switch', own, 'Kyogre, L100', '320/320'), event(10, '-weather', 'RainDance', '[from] ability: Drizzle', `[of] ${own}`), event(11, 'turn', '1')]
  try {
    const pending = h.presenter.present(batch); await tick(); assert.equal(h.clips.length, 0)
    entered.resolve(); await tick()
    assert.deepEqual(h.clips.map(clip => clip.request), [{ weatherId: 'rain', visualSeed: 10 }])
    h.clips[0].done.resolve({ status: 'completed' }); assert.equal((await pending).status, 'completed')
  } finally { h.presenter.destroy() }
  for (const events of [[], [event(10, '-weather', 'SunnyDay')], [event(10, '-weather', 'RainDance', '[upkeep]')]]) {
    const h = harness()
    try { await h.presenter.present({ ...batch, events }); assert.equal(h.imports, 0) }
    finally { h.presenter.destroy() }
  }
  for (const after of [{ ...batch.after, turn: 4 }, { ...batch.after, result: { kind: 'win', winnerSeat: 'p1' } }]) {
    const h = harness()
    try { await h.presenter.present({ ...batch, after }); assert.equal(h.imports, 0, 'later-turn or completed snapshot is not a new opening') }
    finally { h.presenter.destroy() }
  }
})

test('effects off commits weather and residual state without importing a continuation', async () => {
  const batch = fixture('Sandstorm'), h = harness({ loadWeather() { throw new Error('Effects off must not import weather') } })
  batch.events.push(event(12, '-damage', own, '300/320', '[from] Sandstorm'))
  batch.after.cursor = 12; batch.after.own.team[0].hp.current = 300
  try {
    assert.equal((await h.presenter.present(batch, { effectsEnabled: false })).status, 'skipped')
    assert.equal(h.imports, 0); assert.equal(h.clips.length, 0); assert.deepEqual(h.displays.at(-1).view, batch.after)
  } finally { h.presenter.destroy() }
})

test('skip, reset, deadline and failed weather playback reconcile server state and cancel the owned continuation', async () => {
  for (const mode of ['skip', 'reset', 'deadline', 'failure']) {
    const batch = fixture('Hail'), h = harness({ manual: true, ...(mode === 'deadline' ? { timeoutMs: 20 } : {}) })
    batch.events.push(event(12, '-damage', own, '300/320', '[from] Hail')); batch.after.cursor = 12; batch.after.own.team[0].hp.current = 300
    try {
      const pending = h.presenter.present(batch); await tick()
      assert.equal(h.clips.length, 1)
      if (mode === 'skip') h.presenter.skip()
      if (mode === 'reset') h.presenter.reset({ ...batch.after, matchId: 'replacement' })
      if (mode === 'failure') h.clips[0].done.resolve({ status: 'failed' })
      const result = await pending
      assert.equal(result.status, { skip: 'skipped', reset: 'cancelled', deadline: 'failed', failure: 'failed' }[mode])
      assert.ok(h.clips[0].cancelled >= 1)
      assert.ok(h.clips[0].options.signal.aborted)
      assert.deepEqual(h.displays.at(-1).view, mode === 'reset' ? { ...batch.after, matchId: 'replacement' } : batch.after)
      const count = h.displays.length; h.clips[0].done.resolve({ status: 'completed' }); await tick()
      assert.equal(h.displays.length, count, 'late weather completion cannot revive stale display')
    } finally { h.presenter.destroy() }
  }
})

test('weather import failures retry in future batches, and a cancelled pending import never starts its old clip', async () => {
  const batch = fixture(), h = harness({ loadWeather: (module, attempt) => { if (attempt === 1) throw new Error('offline'); return module } })
  try {
    assert.equal((await h.presenter.present(batch)).status, 'failed'); assert.deepEqual(h.displays.at(-1).view, batch.after)
    const next = { before: clone(batch.after), after: { ...clone(batch.after), cursor: 12 }, events: [event(12, '-weather', 'RainDance', '[upkeep]')] }
    assert.equal((await h.presenter.present(next)).status, 'completed')
    assert.equal(h.imports, 2); assert.deepEqual(h.clips.map(clip => clip.request.visualSeed), [12])
  } finally { h.presenter.destroy() }
  const loading = deferred(), late = harness({ loadWeather: () => loading.promise })
  try {
    const pending = late.presenter.present(batch); await tick(); late.presenter.skip()
    assert.equal((await pending).status, 'skipped'); assert.deepEqual(late.displays.at(-1).view, batch.after)
    loading.resolve(late.module); await tick(); assert.equal(late.clips.length, 0)
  } finally { late.presenter.destroy() }
})
