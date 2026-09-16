import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationPresenter } from '../apps/simulation/src/presentation.js'

const clone = value => structuredClone(value)
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const event = (cursor, opcode, ...fields) => ({ cursor, type: opcode === 'move' ? 'move' : 'protocol', args: { opcode, fields } })
function fixture() {
  const member = (memberId, species, hp, active = true) => ({ memberId, species, name: species, active,
    hp: { current: hp, max: hp }, hpPrecision: memberId.startsWith('p1:') ? 'exact' : 'public',
    fainted: false, condition: null, stages: {}, volatiles: [], moves: [] })
  const before = { matchId: 'impact-battle', seat: 'p1', complete: true, cursor: 10, turn: 1, result: null,
    own: { active: 'p1:1', team: [member('p1:1', 'Charizard', 300), member('p1:2', 'Blastoise', 320, false)] },
    opponent: { active: 'p2:revealed:1', known: [member('p2:revealed:1', 'Venusaur', 48)] },
    sideConditions: { p1: [], p2: [] }, fieldConditions: [],
  }
  const after = clone(before)
  after.opponent.known[0].hp.current = 30
  after.own.team[0].hp.current = 240
  after.cursor = 17; after.turn = 2
  return { before, after, events: [
    event(11, 'move', 'p1:1', 'Flamethrower', 'p2:revealed:1'),
    event(12, '-supereffective', 'p2:revealed:1'), event(13, '-damage', 'p2:revealed:1', '30/48'),
    event(14, 'move', 'p2:revealed:1', 'Razor Leaf', 'p1:1'),
    event(15, '-resisted', 'p1:1'), event(16, '-damage', 'p1:1', '240/300'), event(17, 'turn', '2'),
  ] }
}
function firstAttack() {
  const batch = fixture()
  batch.after.own.team[0].hp.current = 300
  batch.after.cursor = 13; batch.after.turn = 1
  batch.events = batch.events.slice(0, 3)
  return batch
}
function knockout() {
  const batch = firstAttack()
  Object.assign(batch.after.opponent.known[0], { hp: { current: 0, max: 48 }, fainted: true, active: false })
  batch.after.opponent.active = null
  batch.after.cursor = 15
  batch.after.result = { kind: 'win', winnerSeat: 'p1', reason: 'battle' }
  batch.events[2] = event(13, '-damage', 'p2:revealed:1', '0 fnt')
  batch.events.push(event(14, 'faint', 'p2:revealed:1'), { cursor: 15, type: 'result', args: batch.after.result })
  return batch
}
function harness({ automaticFx = false, automaticImpact = false, playImpact, timeoutMs = 7500, omitImpact = false } = {}) {
  const displayed = [], ensured = [], attacks = [], impacts = [], faints = []
  const callbacks = {
    getScene: () => ({ id: 'stub-scene' }),
    ensureScene: async (view, options) => { ensured.push({ view: clone(view), options }) },
    onDisplay: (view, options) => displayed.push({ view: clone(view), options }),
    faintScene: (view, options) => { const done = deferred(); faints.push({ view, options, done }); return done.promise },
    loadFx: async () => ({ play(request, options) {
      const done = deferred(), attack = { request, options, done, cancelled: 0 }
      attacks.push(attack)
      if (automaticFx) { options.onCue({ type: request.phase === 'prepare' ? 'prepared' : 'impact' }); done.resolve({ status: 'completed' }) }
      return { finished: done.promise, cancel() { attack.cancelled++ } }
    } }),
    timeoutMs,
  }
  if (!omitImpact) callbacks.playImpact = playImpact ?? ((feedback, options) => {
    const done = deferred(), impact = { feedback: clone(feedback), options, done, cancelled: 0, displayAtStart: clone(displayed.at(-1)?.view) }
    impacts.push(impact)
    if (automaticImpact) done.resolve({ status: 'completed' })
    return { finished: done.promise, cancel() { impact.cancelled++ } }
  })
  return { presenter: createSimulationPresenter(callbacks), displayed, ensured, attacks, impacts, faints }
}

test('impact feedback starts once at the HP cue for both directions and only its remaining duration delays the next action', async () => {
  const h = harness(), batch = fixture(), saved = clone(batch)
  try {
    const pending = h.presenter.present(batch, { reducedMotion: true })
    await tick()
    assert.equal(h.impacts.length, 0)
    const first = h.attacks[0]
    assert.equal(first.request.sourceId, 'source')
    first.options.onCue({ type: 'impact' }); first.options.onCue({ type: 'impact' })
    assert.equal(h.impacts.length, 1, 'repeated cosmetic contact must not replay feedback')
    assert.equal(h.impacts[0].displayAtStart.opponent.known[0].hp.current, 30)
    assert.equal(h.impacts[0].displayAtStart.own.team[0].hp.current, 300)
    assert.deepEqual(h.impacts[0].feedback, {
      key: 'impact-battle:11:impact', kind: 'super-effective', label: 'Super effective!',
      actorId: 'target', memberId: 'p2:revealed:1', damageText: '≈ −38% HP',
    })
    assert.equal(h.impacts[0].options.reducedMotion, true)
    assert.equal(h.impacts[0].options.signal.aborted, false)
    h.impacts[0].done.resolve({ status: 'completed' })
    await tick()
    assert.equal(h.attacks.length, 1, 'finishing the label cannot truncate attack recovery')
    first.done.resolve({ status: 'completed' })
    await tick()
    assert.equal(h.attacks.length, 2)
    const second = h.attacks[1]
    assert.equal(second.request.sourceId, 'target')
    second.options.onCue({ type: 'impact' }); second.options.onCue({ type: 'impact' })
    assert.equal(h.impacts.length, 2)
    assert.equal(h.impacts[1].displayAtStart.own.team[0].hp.current, 240)
    assert.deepEqual(h.impacts[1].feedback, {
      key: 'impact-battle:14:impact', kind: 'resisted', label: 'Not very effective…',
      actorId: 'source', memberId: 'p1:1', damageText: '−60 HP',
    })
    second.done.resolve({ status: 'completed' })
    let settled = false
    pending.then(() => { settled = true })
    await tick()
    assert.equal(settled, false, 'a label still being shown must finish before the next group')
    h.impacts[1].done.resolve({ status: 'completed' })
    assert.equal((await pending).status, 'completed')
    assert.deepEqual(h.displayed.at(-1).view, batch.after)
    assert.deepEqual(batch, saved)
  } finally { h.presenter.destroy() }
})

test('an immunity is presented before the next action without playing successful-hit attack artwork', async () => {
  const h = harness(), batch = fixture()
  batch.events = [event(11, 'move', 'p1:1', 'Thunderbolt', 'p2:revealed:1'), event(12, '-immune', 'p2:revealed:1'), ...batch.events.slice(3)]
  batch.after.opponent.known[0].hp.current = 48
  try {
    const pending = h.presenter.present(batch)
    await tick()
    assert.equal(h.attacks.length, 0, 'immune damage must not run Thunderbolt hit FX')
    assert.equal(h.impacts.length, 1)
    assert.equal(h.impacts[0].displayAtStart.opponent.known[0].hp.current, 48)
    assert.equal(h.impacts[0].feedback.kind, 'immune')
    assert.equal(h.impacts[0].feedback.actorId, 'target')
    assert.equal(h.impacts[0].feedback.damageText, null)
    h.impacts[0].done.resolve({ status: 'completed' })
    await tick()
    assert.equal(h.attacks.length, 1)
    assert.equal(h.attacks[0].request.moveId, 'razor-leaf')
    h.attacks[0].options.onCue({ type: 'impact' })
    h.attacks[0].done.resolve({ status: 'completed' })
    h.impacts[1].done.resolve({ status: 'completed' })
    assert.equal((await pending).status, 'completed')
    assert.deepEqual(h.displayed.at(-1).view, batch.after)
  } finally { h.presenter.destroy() }
})

test('unregistered effects and missing impact cues still reveal feedback with the committed damage', async () => {
  for (const unregistered of [false, true]) {
    const h = harness(), batch = firstAttack()
    if (unregistered) batch.events[0].args.fields[1] = 'Powder Snow'
    try {
      const pending = h.presenter.present(batch)
      await tick()
      if (!unregistered) {
        assert.equal(h.impacts.length, 0)
        h.attacks[0].done.resolve({ status: 'completed' })
        await tick()
      } else assert.equal(h.attacks.length, 0)
      assert.equal(h.impacts.length, 1)
      assert.equal(h.impacts[0].displayAtStart.opponent.known[0].hp.current, 30)
      h.impacts[0].done.resolve({ status: 'completed' })
      assert.equal((await pending).status, 'completed')
      assert.deepEqual(h.displayed.at(-1).view, batch.after)
    } finally { h.presenter.destroy() }
  }
})

test('a knockout retains its outgoing actor until attack recovery and impact feedback finish before fainting', async () => {
  const h = harness(), batch = knockout()
  try {
    const pending = h.presenter.present(batch)
    await tick()
    h.attacks[0].options.onCue({ type: 'impact' })
    assert.equal(h.impacts[0].displayAtStart.opponent.known[0].hp.current, 0)
    assert.deepEqual(h.displayed.at(-1).options.retainFaintedActorIds, ['target'])
    h.attacks[0].done.resolve({ status: 'completed' })
    await tick()
    assert.equal(h.faints.length, 0, 'feedback must remain visible before the outgoing faint begins')
    h.impacts[0].done.resolve({ status: 'completed' })
    await tick()
    assert.equal(h.faints.length, 1)
    assert.deepEqual(h.faints[0].options.actorIds, ['target'])
    h.faints[0].done.resolve({ status: 'completed' })
    assert.equal((await pending).status, 'completed')
    assert.deepEqual(h.displayed.at(-1).view, batch.after)
  } finally { h.presenter.destroy() }
})

test('skip cancels feedback and old contact callbacks cannot label a replacement', async () => {
  const h = harness(), batch = fixture()
  batch.after.own.active = 'p1:2'
  batch.after.own.team[0].active = false; batch.after.own.team[1].active = true
  batch.after.cursor = 18
  batch.events.push(event(18, 'switch', 'p1:2', 'Blastoise, L100', '320/320'))
  try {
    const pending = h.presenter.present(batch)
    await tick()
    h.attacks[0].options.onCue({ type: 'impact' })
    h.presenter.skip()
    assert.equal((await pending).status, 'skipped')
    assert.equal(h.impacts[0].cancelled, 1)
    assert.equal(h.impacts[0].options.signal.aborted, true)
    assert.equal(h.attacks[0].cancelled, 1)
    assert.equal(h.attacks.length, 1)
    assert.deepEqual(h.displayed.at(-1).view, batch.after)
    assert.equal(h.ensured.at(-1).view.own.active, 'p1:2')
    const displayCount = h.displayed.length
    h.attacks[0].options.onCue({ type: 'impact' })
    h.attacks[0].done.resolve({ status: 'completed' }); h.impacts[0].done.resolve({ status: 'completed' })
    await tick()
    assert.equal(h.impacts.length, 1)
    assert.equal(h.displayed.length, displayCount)
  } finally { h.presenter.destroy() }
})

test('reset, destroy and a newer presentation cancel active feedback and invalidate late cues', async () => {
  for (const action of ['reset', 'destroy', 'present']) {
    const h = harness(), batch = firstAttack(), fresh = clone(batch.before)
    fresh.matchId = `replacement-${action}`
    try {
      const pending = h.presenter.present(batch)
      await tick()
      h.attacks[0].options.onCue({ type: 'impact' })
      if (action === 'reset') h.presenter.reset(fresh)
      if (action === 'destroy') h.presenter.destroy()
      if (action === 'present') await h.presenter.present({ before: null, after: fresh, events: [] }, { effectsEnabled: false })
      assert.equal((await pending).status, 'cancelled')
      assert.equal(h.impacts[0].cancelled, 1)
      assert.equal(h.impacts[0].options.signal.aborted, true)
      const displayCount = h.displayed.length
      h.attacks[0].options.onCue({ type: 'impact' })
      h.attacks[0].done.resolve({ status: 'completed' }); h.impacts[0].done.resolve({ status: 'completed' })
      await tick()
      assert.equal(h.impacts.length, 1)
      assert.equal(h.displayed.length, displayCount)
      if (action !== 'destroy') assert.deepEqual(h.displayed.at(-1).view, fresh)
    } finally { h.presenter.destroy() }
  }
})

test('a deadline cancels hanging feedback after attack recovery and reconciles the authoritative view', async () => {
  const h = harness({ timeoutMs: 15 }), batch = firstAttack()
  try {
    const pending = h.presenter.present(batch)
    await tick()
    h.attacks[0].options.onCue({ type: 'impact' })
    h.attacks[0].done.resolve({ status: 'completed' })
    assert.equal((await pending).status, 'failed')
    assert.equal(h.impacts[0].cancelled, 1)
    assert.equal(h.impacts[0].options.signal.aborted, true)
    assert.deepEqual(h.displayed.at(-1).view, batch.after)
    h.impacts[0].done.resolve({ status: 'completed' })
    await tick()
    assert.equal(h.impacts.length, 1)
  } finally { h.presenter.destroy() }
})

test('missing, throwing and rejecting cosmetic feedback cannot prevent authoritative results', async () => {
  for (const mode of ['missing', 'throw', 'reject']) {
    let cancelled = 0
    const playImpact = mode === 'throw' ? () => { throw new Error('Optional overlay failed') }
      : () => ({ finished: Promise.reject(new Error('Optional overlay failed')), cancel() { cancelled++ } })
    const h = harness({ automaticFx: true, playImpact, omitImpact: mode === 'missing' }), batch = fixture(), saved = clone(batch)
    try {
      const result = await h.presenter.present(batch)
      assert.equal(result.status, 'completed')
      assert.equal(h.attacks.length, 2, 'optional label failure must not discard the following attack')
      assert.deepEqual(h.displayed.at(-1).view, batch.after)
      assert.deepEqual(h.ensured.at(-1).view, batch.after)
      assert.deepEqual(batch, saved)
      if (mode === 'reject') assert(cancelled > 0, 'failed handles must be cleaned up')
    } finally { h.presenter.destroy() }
  }
})

test('failed attack playback cancels its already-visible label and commits the final result', async () => {
  for (const reject of [false, true]) {
    const h = harness(), batch = fixture()
    try {
      const pending = h.presenter.present(batch)
      await tick()
      h.attacks[0].options.onCue({ type: 'impact' })
      if (reject) h.attacks[0].done.reject(new Error('Attack renderer failed'))
      else h.attacks[0].done.resolve({ status: 'failed' })
      assert.equal((await pending).status, 'failed')
      assert.equal(h.impacts[0].cancelled, 1)
      assert.equal(h.impacts[0].options.signal.aborted, true)
      assert.equal(h.attacks[0].cancelled, 1)
      assert.deepEqual(h.displayed.at(-1).view, batch.after)
      assert.deepEqual(h.ensured.at(-1).view, batch.after)
      const displayCount = h.displayed.length
      h.impacts[0].done.resolve({ status: 'completed' })
      h.attacks[0].options.onCue({ type: 'impact' })
      await tick()
      assert.equal(h.impacts.length, 1)
      assert.equal(h.displayed.length, displayCount)
    } finally { h.presenter.destroy() }
  }
})

test('effects off, reconnect, preparation, residual and neutral damage do not emit impact feedback', async () => {
  for (const mode of ['off', 'reconnect', 'prepare', 'residual', 'neutral']) {
    const h = harness({ automaticFx: true, automaticImpact: true }), batch = firstAttack()
    if (mode === 'reconnect') batch.before = null
    if (mode === 'prepare') {
      batch.after = clone(batch.before); batch.after.cursor = 12
      batch.events = [event(11, 'move', 'p1:1', 'Fly', 'p2:revealed:1'), event(12, '-prepare', 'p1:1', 'Fly', 'p2:revealed:1')]
    }
    if (mode === 'residual') batch.events = [event(13, '-damage', 'p2:revealed:1', '30/48', '[from] psn')]
    if (mode === 'neutral') batch.events = [batch.events[0], batch.events[2]]
    try {
      await h.presenter.present(batch, { effectsEnabled: mode !== 'off' })
      assert.equal(h.impacts.length, 0, mode)
      assert.deepEqual(h.displayed.at(-1).view, batch.after)
    } finally { h.presenter.destroy() }
  }
})
