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

test('a fresh battle awaits both opening releases without loading move effects or changing the server view', async () => {
  const entered = deferred(), released = deferred(), options = [], batch = { before: null, after: fixture().before }
  const saved = clone(batch)
  const h = harness({ ensureScene: async (view, config) => { options.push(config); entered.resolve(); await released.promise },
    loadFx: () => { throw new Error('Opening is not a move') } })
  let completed = false
  const pending = h.presenter.present(batch, { reducedMotion: true }).then(result => { completed = true; return result })
  await entered.promise
  assert.equal(completed, false)
  assert.deepEqual(options[0].entryActorIds, ['source', 'target'])
  assert.equal(options[0].reducedMotion, true)
  assert.equal(options[0].signal.aborted, false)
  released.resolve()
  assert.equal((await pending).status, 'completed')
  assert.deepEqual(h.displays.at(-1), batch.after)
  assert.deepEqual(batch, saved)
  assert.equal(options.length, 1, 'final reconciliation does not repeat the opening')
})

test('switch and forced replacement releases finish before the next attack from either seat', async () => {
  for (const [opcode, seat, expected] of [['switch', 'p1', 'source'], ['drag', 'p1', 'source'], ['switch', 'p2', 'target']]) {
    const batch = fixture(), entered = deferred(), released = deferred(), phases = []
    batch.before.seat = seat; batch.after.seat = seat
    if (seat === 'p2') for (const view of [batch.before, batch.after]) {
      const own = view.own, opponent = view.opponent
      view.own = { active: opponent.active, team: opponent.known }
      view.opponent = { active: own.active, known: own.team }
    }
    const switchedSide = seat === 'p1' ? batch.after.own : batch.after.opponent
    switchedSide.active = 'p1:2'
    for (const member of switchedSide.team ?? switchedSide.known) member.active = member.memberId === 'p1:2'
    batch.events = [event(11, opcode, 'p1:2', 'Blastoise, L100', '320/320'),
      event(12, 'move', 'p2:revealed:1', 'Razor Leaf', 'p1:2')]
    const h = harness({ ensureScene: async (view, config) => {
      if (config.entryActorIds.length) { phases.push('release'); assert.deepEqual(config.entryActorIds, [expected]); entered.resolve(); await released.promise; phases.push('released') }
    }, loadFx: async () => ({ play() { phases.push('move'); return { finished: Promise.resolve({ status: 'completed' }) } } }) })
    const pending = h.presenter.present(batch)
    await entered.promise
    assert.deepEqual(phases, ['release'], 'move cannot play while incoming sprite is inside the ball')
    released.resolve(); await pending
    assert.deepEqual(phases, ['release', 'released', 'move'])
    assert.deepEqual(h.displays.at(-1), batch.after)
  }
})

test('effects off and form/identity corrections never request a Poké Ball release', async () => {
  const options = [], h = harness({ ensureScene: async (view, config) => options.push(config) })
  const batch = fixture()
  await h.presenter.present({ before: null, after: batch.after }, { effectsEnabled: false })
  for (const opcode of ['detailschange', '-formechange', '-transform', 'replace']) {
    batch.events = [event(11, opcode, 'p1:1', 'Blastoise, L100', '300/300')]
    await h.presenter.present(batch)
  }
  assert.ok(options.length > 0)
  assert.ok(options.every(config => config.entryActorIds.length === 0))
})

test('skip and timeout abort an entry and reconcile the final lineup without another release', async () => {
  for (const stop of ['skip', 'timeout']) {
    const entered = deferred(), calls = [], after = fixture().after
    const h = harness({ timeoutMs: stop === 'timeout' ? 15 : 7500, ensureScene: async (view, config) => {
      calls.push(config)
      if (config.entryActorIds.length) { entered.resolve(); await new Promise(() => {}) }
    } })
    const pending = h.presenter.present({ before: null, after })
    await entered.promise
    if (stop === 'skip') h.presenter.skip()
    assert.equal((await pending).status, stop === 'skip' ? 'skipped' : 'failed')
    assert.equal(calls[0].signal.aborted, true)
    assert.ok(calls.slice(1).every(config => config.entryActorIds.length === 0))
    assert.deepEqual(h.displays.at(-1), after)
  }
})

test('reset during opening aborts the release and prevents a late scene completion from repainting', async () => {
  const entered = deferred(), finish = deferred(), batch = fixture()
  let signal
  const h = harness({ ensureScene: async (view, config) => { signal = config.signal; entered.resolve(); await finish.promise } })
  const pending = h.presenter.present({ before: null, after: batch.after })
  await entered.promise
  h.presenter.reset(batch.before)
  assert.equal(signal.aborted, true)
  assert.equal((await pending).status, 'cancelled')
  finish.resolve(); await tick()
  assert.deepEqual(h.displays.at(-1), batch.before)
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

function knockoutBatch() {
  const batch = fixture()
  batch.after = clone(batch.before)
  const defeated = batch.after.opponent.known[0]
  defeated.hp.current = 0; defeated.fainted = true; defeated.active = false
  batch.after.opponent.known.push(pokemon('p2:revealed:2', 'Gengar', 48))
  batch.after.opponent.active = 'p2:revealed:2'; batch.after.cursor = 15
  batch.events = [event(11, 'move', 'p1:1', 'Flamethrower', 'p2:revealed:1'),
    event(12, '-damage', 'p2:revealed:1', '0 fnt'), event(13, 'faint', 'p2:revealed:1'),
    event(14, 'switch', 'p2:revealed:2', 'Gengar, L100', '48/48'), event(15, 'turn', '2')]
  batch.after.turn = 2
  return batch
}

test('zero HP is revealed at impact, then faint waits for attack recovery and precedes replacement entry', async () => {
  const attackReady = deferred(), attackDone = deferred(), faintReady = deferred(), faintDone = deferred()
  const published = [], entries = [], faintRequests = [], batch = knockoutBatch(), saved = clone(batch)
  const h = harness({
    onDisplay: (view, options) => published.push({ view: clone(view), options }),
    ensureScene: async (view, options) => entries.push({ view: clone(view), options }),
    loadFx: async () => ({ play(request, options) {
      options.onCue({ type: 'impact' }); attackReady.resolve()
      return { finished: attackDone.promise }
    } }),
    faintScene: async (view, options) => { faintRequests.push({ view: clone(view), options }); faintReady.resolve(); return faintDone.promise },
  })
  const pending = h.presenter.present(batch, { reducedMotion: true })
  await attackReady.promise
  assert.equal(published.at(-1).view.opponent.known[0].hp.current, 0)
  assert.deepEqual(published.at(-1).options.retainFaintedActorIds, ['target'])
  assert.equal(faintRequests.length, 0, 'the attack still owns the posed actor')
  attackDone.resolve({ status: 'completed' }); await faintReady.promise
  assert.deepEqual(faintRequests[0].options.actorIds, ['target'])
  assert.equal(faintRequests[0].options.reducedMotion, true)
  assert.equal(faintRequests[0].view.opponent.active, 'p2:revealed:1')
  assert.ok(published.every(({ view }) => view.opponent.known.length === 1), 'future opponent remains unrevealed during faint')
  assert.ok(entries.every(({ options }) => !options.entryActorIds.length), 'replacement has not entered')
  faintDone.resolve({ status: 'completed' })
  assert.equal((await pending).status, 'completed')
  assert.equal(faintRequests.length, 1, 'the following faint opcode does not repeat the clip')
  assert.ok(entries.some(({ view, options }) => view.opponent.active === 'p2:revealed:2' && options.entryActorIds[0] === 'target'))
  assert.deepEqual(published.at(-1).view, batch.after)
  assert.equal(published.at(-1).options, undefined, 'final reconciliation never retains defeated artwork')
  assert.deepEqual(batch, saved)
})

test('own-side residual damage, direct faint and simultaneous knockouts each retire the correct field actors once', async () => {
  for (const kind of ['residual', 'direct', 'both', 'unregistered']) {
    const batch = fixture(), retired = [], retained = []
    batch.after = clone(batch.before)
    const targets = kind === 'both' ? ['p1:1', 'p2:revealed:1'] : ['p1:1']
    for (const id of targets) {
      const side = id.startsWith('p1') ? batch.after.own : batch.after.opponent
      const member = (side.team ?? side.known).find(member => member.memberId === id)
      member.hp.current = 0; member.fainted = true; member.active = false; side.active = null
    }
    batch.events = kind === 'direct' ? [event(11, 'faint', 'p1:1')] : kind === 'residual'
      ? [event(11, '-damage', 'p1:1', '0 fnt', '[from] psn'), event(12, 'faint', 'p1:1')]
      : [event(11, 'move', 'p1:1', kind === 'both' ? 'Explosion' : 'Unregistered Move', 'p2:revealed:1'),
        ...targets.map((id, i) => event(12 + i, '-damage', id, '0 fnt')),
        ...targets.map((id, i) => event(14 + i, 'faint', id))]
    batch.after.cursor = batch.events.at(-1).cursor
    const h = harness({ faintScene: async (view, options) => { retired.push(options.actorIds); return { status: 'completed' } },
      onDisplay: (view, options) => { if (options?.retainFaintedActorIds.length) retained.push(options.retainFaintedActorIds) } })
    assert.equal((await h.presenter.present(batch)).status, 'completed', kind)
    assert.deepEqual(retired, [kind === 'both' ? ['source', 'target'] : ['source']], kind)
    assert.deepEqual(retained, retired, kind)
  }
})

test('effects-off and initial sync do not replay old knockouts', async () => {
  const batch = knockoutBatch(), h = harness({ faintScene: () => { throw new Error('No faint should play') } })
  assert.equal((await h.presenter.present(batch, { effectsEnabled: false })).status, 'skipped')
  assert.equal((await h.presenter.present({ before: null, after: batch.after })).status, 'completed')
  assert.deepEqual(h.displays.at(-1), batch.after)
})

test('skip, timeout and transition failure reconcile the same final knockout and replacement', async () => {
  for (const mode of ['skip', 'timeout', 'rejected', 'failed']) {
    const started = deferred(), batch = knockoutBatch()
    let faintSignal
    const h = harness({ timeoutMs: 25, faintScene: async (view, options) => {
      faintSignal = options.signal; started.resolve()
      if (mode === 'rejected') throw new Error('Failed to load transition')
      if (mode === 'failed') return { status: 'failed' }
      return new Promise(() => {})
    } })
    const pending = h.presenter.present(batch)
    await started.promise
    if (mode === 'skip') h.presenter.skip()
    assert.equal((await pending).status, mode === 'skip' ? 'skipped' : 'failed')
    assert.equal(faintSignal.aborted, true)
    assert.deepEqual(h.displays.at(-1), batch.after)
    assert.deepEqual(h.ensured.at(-1), batch.after)
  }
})

test('reset during faint cancels its signal and ignores the old completion', async () => {
  const started = deferred(), finish = deferred(), batch = knockoutBatch()
  let faintSignal
  const h = harness({ faintScene: async (view, options) => { faintSignal = options.signal; started.resolve(); return finish.promise } })
  const pending = h.presenter.present(batch)
  await started.promise
  h.presenter.reset(batch.before)
  assert.equal(faintSignal.aborted, true)
  assert.equal((await pending).status, 'cancelled')
  finish.resolve({ status: 'completed' }); await tick()
  assert.deepEqual(h.displays.at(-1), batch.before)
  assert.ok(h.ensured.every(view => view.opponent.active !== 'p2:revealed:2'))
})
