import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBattleLog, createSimulationPresenter } from '../apps/simulation/src/presentation.js'

const clone = value => structuredClone(value)
const pokemon = (memberId, species, hp, active = true) => ({ memberId, species, name: species, active,
  hp: { current: hp, max: hp }, hpPrecision: memberId.startsWith('p1:') ? 'exact' : 'public',
  fainted: false, condition: null, stages: {}, volatiles: [], moves: [], item: null, ability: null })
function fixture() {
  const before = { matchId: 'test', seat: 'p1', cursor: 10, turn: 1,
    own: { active: 'p1:1', team: [pokemon('p1:1', 'Charizard', 300), pokemon('p1:2', 'Blastoise', 320, false)] },
    opponent: { active: 'p2:revealed:1', known: [pokemon('p2:revealed:1', 'Venusaur', 48)] },
    weather: null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], result: null, complete: true,
    decision: { id: 'turn-one', kind: 'move', moves: [] } }
  const after = clone(before)
  after.opponent.known[0].hp.current = 30
  after.own.team[0].hp.current = 240
  after.cursor = 15; after.turn = 2; after.decision.id = 'turn-two'
  const events = [event(11, 'move', 'p1:1', 'Flamethrower', 'p2:revealed:1'),
    event(12, '-damage', 'p2:revealed:1', '30/48'),
    event(13, 'move', 'p2:revealed:1', 'Razor Leaf', 'p1:1'),
    event(14, '-damage', 'p1:1', '240/300'), event(15, 'turn', '2')]
  return { before, after, events }
}
const event = (cursor, opcode, ...fields) => ({ cursor, type: opcode === 'move' ? 'move' : 'protocol', args: { opcode, fields } })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
function harness(overrides = {}) {
  const displays = [], requests = [], ensured = [], messages = [], cancelled = []
  const callbacks = {
    getScene: () => ({ id: 'scene' }), ensureScene: async view => ensured.push(clone(view)),
    onDisplay: view => displays.push(clone(view)), onMessage: text => messages.push(text),
    loadFx: async () => ({ play(request, options) {
      requests.push(request); options.onCue({ type: request.phase === 'prepare' ? 'prepared' : 'impact' })
      return { finished: Promise.resolve({ status: 'completed' }), cancel() { cancelled.push(request.moveId) } }
    } }), ...overrides,
  }
  return { presenter: createSimulationPresenter(callbacks), displays, requests, ensured, messages, cancelled }
}

test('effects off commits the server view without loading FX or mutating inputs', async () => {
  const batch = fixture(), saved = clone(batch)
  const h = harness({ loadFx: () => { throw new Error('FX should not load') } })
  assert.equal((await h.presenter.present(batch, { effectsEnabled: false })).status, 'skipped')
  assert.deepEqual(h.displays.at(-1), batch.after)
  assert.deepEqual(batch, saved)
  assert.equal(h.ensured.at(-1).cursor, batch.after.cursor)
})

test('both sides animate in protocol order with stable scene identities and impact snapshots', async () => {
  const batch = fixture(), h = harness()
  assert.equal((await h.presenter.present(batch)).status, 'completed')
  assert.deepEqual(h.requests.map(({ moveId, sourceId, targetIds }) => ({ moveId, sourceId, targetIds })), [
    { moveId: 'flamethrower', sourceId: 'source', targetIds: ['target'] },
    { moveId: 'razor-leaf', sourceId: 'target', targetIds: ['source'] },
  ])
  assert.equal(h.displays[0].opponent.known[0].hp.current, 30)
  assert.equal(h.displays[0].own.team[0].hp.current, 300)
  assert.equal(h.displays[1].own.team[0].hp.current, 240)
  assert.deepEqual(h.displays.at(-1), batch.after)
  assert.ok(h.requests.every(request => !('hp' in request) && !('state' in request)))
})

test('completion without an impact cue still reveals committed HP', async () => {
  const batch = fixture(), h = harness({ loadFx: async () => ({ play: () => ({ finished: Promise.resolve({ status: 'completed' }) }) }) })
  await h.presenter.present(batch)
  assert.ok(h.displays.some(view => view.cursor === 12 && view.opponent.known[0].hp.current === 30))
  assert.deepEqual(h.displays.at(-1), batch.after)
})

test('failure during FX loading reconciles immediately and a future batch can retry', async () => {
  let loads = 0
  const h = harness({ loadFx: async () => { if (++loads === 1) throw new Error('offline'); return { play: () => ({ finished: Promise.resolve({ status: 'completed' }) }) } } })
  const batch = fixture()
  assert.equal((await h.presenter.present(batch)).status, 'failed')
  assert.deepEqual(h.displays.at(-1), batch.after)
  assert.equal((await h.presenter.present(batch)).status, 'completed')
  assert.equal(loads, 2)
})

test('a failed effect cancels playback and does not prevent the authoritative result', async () => {
  let cancelled = 0
  const h = harness({ loadFx: async () => ({ play: () => ({ finished: Promise.reject(new Error('asset failed')), cancel() { cancelled++ } }) }) })
  const batch = fixture()
  assert.equal((await h.presenter.present(batch)).status, 'failed')
  assert.equal(cancelled, 1)
  assert.deepEqual(h.displays.at(-1), batch.after)
})

test('an effect failure also reconciles a later replacement’s artwork', async () => {
  const batch = fixture(), h = harness({ loadFx: async () => { throw new Error('offline') } })
  batch.after.own.active = 'p1:2'; batch.after.own.team[0].active = false; batch.after.own.team[1].active = true
  assert.equal((await h.presenter.present(batch)).status, 'failed')
  assert.equal(h.ensured.at(-1).own.active, 'p1:2')
})

test('a deadline bounds a hanging effect load', async () => {
  const batch = fixture(), h = harness({ loadFx: () => new Promise(() => {}), timeoutMs: 15 })
  assert.equal((await h.presenter.present(batch)).status, 'failed')
  assert.deepEqual(h.displays.at(-1), batch.after)
})

test('a deadline bounds a hanging scene and never loads an effect', async () => {
  let loads = 0
  const batch = fixture(), h = harness({ ensureScene: () => new Promise(() => {}), loadFx: async () => { loads++ }, timeoutMs: 15 })
  assert.equal((await h.presenter.present(batch)).status, 'failed')
  assert.equal(loads, 0)
  assert.deepEqual(h.displays.at(-1), batch.after)
})

test('skip cancels the whole remaining batch and rebuilds the final scene', async () => {
  const entered = deferred(), finish = deferred()
  let cancelled = 0, calls = 0, cue
  const h = harness({ loadFx: async () => ({ play(request, options) {
    calls++; cue = options.onCue; entered.resolve()
    return { finished: finish.promise, cancel() { cancelled++ } }
  } }) })
  const batch = fixture(), pending = h.presenter.present(batch)
  await entered.promise
  h.presenter.skip()
  assert.equal((await pending).status, 'skipped')
  assert.equal(calls, 1); assert.ok(cancelled >= 1)
  assert.deepEqual(h.displays.at(-1), batch.after)
  assert.equal(h.ensured.at(-1).cursor, batch.after.cursor)
  const count = h.displays.length
  cue({ type: 'impact' }); finish.resolve({ status: 'completed' }); await tick()
  assert.equal(h.displays.length, count)
})

test('reset guards late effect loads and new-match display from stale callbacks', async () => {
  const loading = deferred(), entered = deferred()
  let plays = 0
  const h = harness({ loadFx: () => { entered.resolve(); return loading.promise } })
  const batch = fixture(), pending = h.presenter.present(batch)
  await entered.promise
  const fresh = { ...clone(batch.before), matchId: 'new-match' }
  h.presenter.reset(fresh)
  assert.equal((await pending).status, 'cancelled')
  loading.resolve({ play() { plays++ } }); await tick()
  assert.equal(plays, 0)
  assert.deepEqual(h.displays.at(-1), fresh)
})

test('reset during playback cancels and invalidates retained impact callbacks', async () => {
  const entered = deferred(), finish = deferred()
  let cue
  const h = harness({ loadFx: async () => ({ play(request, options) { cue = options.onCue; entered.resolve(); return { finished: finish.promise, cancel() {} } } }) })
  const batch = fixture(), pending = h.presenter.present(batch)
  await entered.promise; h.presenter.reset(batch.before)
  assert.equal((await pending).status, 'cancelled')
  cue({ type: 'impact' }); finish.resolve({ status: 'completed' }); await tick()
  assert.deepEqual(h.displays.at(-1), batch.before)
})

test('switches establish their new actor before subsequent attacks', async () => {
  const batch = fixture(), sceneSpecies = []
  const h = harness({ ensureScene: async view => { sceneSpecies.push(view.own.team.find(member => member.memberId === view.own.active)?.species) } })
  batch.events = [event(11, 'switch', 'p1:2', 'Blastoise, L100', '320/320'),
    event(12, 'move', 'p2:revealed:1', 'Razor Leaf', 'p1:2'), event(13, '-damage', 'p1:2', '240/320')]
  batch.after.own.active = 'p1:2'; batch.after.own.team[0].active = false; batch.after.own.team[1].active = true
  batch.after.own.team[1].hp.current = 240; batch.after.cursor = 13
  await h.presenter.present(batch)
  assert.deepEqual(sceneSpecies, ['Blastoise', 'Blastoise', 'Blastoise'])
  assert.equal(h.displays[0].own.team[1].hp.current, 320)
  assert.equal(h.displays[1].own.team[1].hp.current, 240)
  assert.equal(h.requests[0].sourceId, 'target')
})

test('a knockout finishes before replacing its sprite, without showing future opponent details', async () => {
  const batch = fixture(), activeAtPlayback = []
  let currentScene
  const h = harness({ ensureScene: async view => { currentScene = clone(view) }, loadFx: async () => ({ play(request, options) {
    activeAtPlayback.push(currentScene.opponent.active)
    options.onCue({ type: 'impact' })
    return { finished: Promise.resolve({ status: 'completed' }) }
  } }) })
  batch.events = [event(11, 'move', 'p1:1', 'Flamethrower', 'p2:revealed:1'),
    event(12, '-damage', 'p2:revealed:1', '0 fnt'), event(13, 'faint', 'p2:revealed:1'),
    event(14, 'switch', 'p2:revealed:2', 'Gengar, L100', '48/48'), event(15, '-ability', 'p2:revealed:2', 'Levitate')]
  batch.after.opponent.known[0].hp.current = 0; batch.after.opponent.known[0].active = false; batch.after.opponent.known[0].fainted = true
  batch.after.opponent.known.push({ ...pokemon('p2:revealed:2', 'Gengar', 48), ability: 'Levitate' }); batch.after.opponent.active = 'p2:revealed:2'
  await h.presenter.present(batch)
  assert.deepEqual(activeAtPlayback, ['p2:revealed:1'])
  assert.equal(h.displays[0].opponent.known.length, 1)
  assert.equal(h.displays.find(view => view.cursor === 14).opponent.known[1].ability, null)
  assert.deepEqual(h.displays.at(-1), batch.after)
})

test('miss, failure and immunity never play a successful-hit recipe', async () => {
  for (const opcode of ['-miss', '-fail', '-immune', '-block', '-notarget']) {
    const batch = fixture(), h = harness()
    batch.events = [batch.events[0], event(12, opcode, 'p2:revealed:1')]
    await h.presenter.present(batch)
    assert.equal(h.requests.length, 0, opcode)
    assert.deepEqual(h.displays.at(-1), batch.after)
  }
})

test('preparation uses the independent preparation recipe and skips unsupported preparation art', async () => {
  for (const name of ['Fly', 'Solar Beam']) {
    const batch = fixture(), h = harness()
    batch.events = [event(11, 'move', 'p1:1', name, 'p2:revealed:1', '[still]'), event(12, '-prepare', 'p1:1', name)]
    await h.presenter.present(batch, { reducedMotion: true })
    if (name === 'Fly') assert.equal(h.requests[0].phase, 'prepare')
    else assert.equal(h.requests.length, 0)
  }
})

test('a multi-hit move that landed before a later miss still presents the successful damage', async () => {
  const batch = fixture(), h = harness()
  batch.events = [event(11, 'move', 'p1:1', 'Triple Kick', 'p2:revealed:1'),
    event(12, '-damage', 'p2:revealed:1', '46/48'), event(13, '-miss', 'p1:1', 'p2:revealed:1')]
  await h.presenter.present(batch)
  assert.equal(h.requests[0].moveId, 'triple-kick')
  assert.equal(h.displays[0].opponent.known[0].hp.current, 46)
})

test('residual HP is revealed after move completion, outside its impact group', async () => {
  const batch = fixture(), seenAtImpact = []
  const h = harness({ loadFx: async () => ({ play(request, options) {
    options.onCue({ type: 'impact' }); seenAtImpact.push(h.displays.at(-1).own.team[0].hp.current)
    return { finished: Promise.resolve({ status: 'completed' }) }
  } }) })
  batch.events = [batch.events[0], batch.events[1], event(13, '-damage', 'p1:1', '282/300 psn', '[from] psn')]
  await h.presenter.present(batch)
  assert.deepEqual(seenAtImpact, [300])
  assert.ok(h.displays.some(view => view.own.team[0].hp.current === 282))
})

test('canonical Showdown Vise Grip maps to the preserved Vice Grip effect', async () => {
  const batch = fixture(), h = harness()
  batch.events = [event(11, 'move', 'p1:1', 'Vise Grip', 'p2:revealed:1')]
  await h.presenter.present(batch)
  assert.equal(h.requests[0].moveId, 'vice-grip')
})

test('friendly battle log uses actor names, filters duplicate and already-seen cursors, and leaves inputs unchanged', () => {
  const batch = fixture(), original = clone(batch)
  const log = buildBattleLog([event(9, 'move', 'p1:1', 'Old Move', 'p2:revealed:1'), ...batch.events, batch.events[0]], batch.before, batch.after)
  assert.equal(log.length, 5)
  assert.equal(log[0].text, 'Charizard used Flamethrower!')
  assert.equal(log[2].text, 'The opposing Venusaur used Razor Leaf!')
  assert.ok(log.every(entry => !/p[12]:/.test(entry.text)))
  assert.deepEqual(batch, original)
})

test('destroy disposes a late-loaded runtime and never repaints a detached page', async () => {
  const loading = deferred(), entered = deferred()
  let disposed = 0
  const h = harness({ loadFx: () => { entered.resolve(); return loading.promise } })
  const pending = h.presenter.present(fixture())
  await entered.promise; h.presenter.destroy()
  assert.equal((await pending).status, 'cancelled')
  loading.resolve({ dispose() { disposed++ } }); await tick()
  assert.equal(disposed, 1)
  assert.equal(h.displays.length, 0)
  assert.equal((await h.presenter.present(fixture())).status, 'cancelled')
})
