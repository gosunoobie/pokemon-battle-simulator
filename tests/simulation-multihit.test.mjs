import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveHitSequence } from '../apps/shared/battle/hits.js'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'
import { createProjection } from '../packages/battle-engine/src/projection.js'

const clone = value => structuredClone(value)
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
const own = 'p1:1', opponent = 'p2:revealed:1'
function fixture({ count = 3, name = 'Bullet Seed', reverse = false, seat = 'p1', knockout = false } = {}) {
  const pokemon = (memberId, exact) => ({ memberId, species: 'Venusaur', name: 'Venusaur', hp: { current: 48, max: 48 },
    hpPrecision: exact ? 'exact' : 'public', active: true, fainted: false, condition: null, stages: {}, volatiles: [], moves: [] })
  const before = { matchId: 'hits', seat: 'p1', cursor: 10, own: { active: own, team: [pokemon(own, true)] },
    opponent: { active: opponent, known: [pokemon(opponent, false)] }, weather: null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], result: null }
  if (seat === 'p2') {
    before.seat = 'p2'; before.own = { active: 'p2:1', team: [pokemon('p2:1', true)] }
    before.opponent = { active: 'p1:revealed:1', known: [pokemon('p1:revealed:1', false)] }
  }
  const source = reverse ? before.opponent.active : before.own.active
  const target = reverse ? before.own.active : before.opponent.active
  const events = [event(11, 'move', source, name, target)]
  for (let i = 0; i < count; i++) events.push(event(12 + i, '-damage', target, knockout && i === count - 1 ? '0 fnt' : `${48 - 3 * (i + 1)}/48`))
  events.push(event(12 + count, '-hitcount', target, String(count)))
  const after = clone(before), recipient = reverse ? after.own.team[0] : after.opponent.known[0]
  recipient.hp.current = knockout ? 0 : 48 - count * 3; recipient.fainted = knockout
  if (knockout) {
    events.push(event(13 + count, 'faint', target)); recipient.active = false
    if (reverse) after.own.active = null
    else after.opponent.active = null
  }
  after.cursor = events.at(-1).cursor
  return { before, after, events }
}
function harness(extra = {}) {
  const attacks = [], displays = [], messages = [], sounds = [], faints = []
  const presenter = createSimulationPresenter({ getScene: () => ({}), ensureScene: async () => {},
    onDisplay: (view, options) => displays.push({ view: clone(view), options }), onMessage: text => messages.push(text),
    onMove: request => { sounds.push(request); return null }, faintScene: async (view, options) => { faints.push(options.actorIds); return { status: 'completed' } },
    loadFx: async () => ({ play(request, options) {
      const done = deferred(), attack = { request, options, done, cancelled: 0 }
      attacks.push(attack)
      return { finished: done.promise, cancel: () => { attack.cancelled++ } }
    } }), ...extra,
  })
  return { presenter, attacks, displays, messages, sounds, faints }
}

test('one through six reported hits reveal distinct server snapshots from both seats and field positions', async () => {
  for (const seat of ['p1', 'p2']) for (const reverse of [false, true]) for (let count = 1; count <= 6; count++) {
    const batch = fixture({ count, name: count === 6 ? 'Beat Up' : 'Bullet Seed', reverse, seat }), saved = clone(batch), h = harness()
    try {
      const pending = h.presenter.present(batch); await tick()
      const attack = h.attacks[0]
      assert.equal(attack.request.hitCount, count); assert.equal(h.sounds[0].hitCount, count)
      assert.equal(attack.request.sourceId, reverse ? 'target' : 'source')
      assert.ok(!('state' in attack.request) && !('hp' in attack.request))
      for (let index = 1; index <= count; index++) {
        attack.options.onCue({ type: 'hit', hitIndex: index })
        const view = h.displays.at(-1).view
        assert.equal((reverse ? view.own.team[0] : view.opponent.known[0]).hp.current, 48 - index * 3)
        const length = h.displays.length
        attack.options.onCue({ type: 'hit', hitIndex: index })
        attack.options.onCue({ type: 'hit', hitIndex: index + 2 })
        assert.equal(h.displays.length, length, 'duplicates and out-of-order callbacks cannot reveal extra damage')
      }
      attack.options.onCue({ type: 'impact' }); attack.done.resolve({ status: 'completed' })
      assert.equal((await pending).status, 'completed')
      assert.ok(h.messages.includes(`Hit ${count} ${count === 1 ? 'time' : 'times'}!`))
      assert.deepEqual(h.displays.at(-1).view, batch.after); assert.deepEqual(batch, saved)
    } finally { h.presenter.destroy() }
  }
})

test('Substitute absorption, breaking, unchanged public HP and per-hit secondary effects retain their order', () => {
  const group = [event(11, 'move', own, 'Bullet Seed', opponent),
    event(12, '-activate', opponent, 'Substitute', '[damage]'),
    event(13, '-crit', opponent), event(14, '-end', opponent, 'Substitute'),
    event(15, '-supereffective', opponent), event(16, '-damage', opponent, '48/48'),
    event(17, '-status', own, 'par'), event(18, '-heal', opponent, '48/48', '[from] item: Sitrus Berry'),
    event(19, '-crit', opponent), event(20, '-damage', opponent, '42/48'), event(21, '-hitcount', opponent, '4')]
  const result = deriveHitSequence(group, 'bullet-seed')
  assert.equal(result.count, 4)
  assert.deepEqual(result.steps.map(step => step.map(row => row.cursor)), [[11, 12], [13, 14], [15, 16, 17, 18], [19, 20, 21]])
  assert.deepEqual(deriveHitSequence([...group.slice(0, -1), event(21, '-hitcount', opponent, '5')], 'bullet-seed'), { count: 5, steps: null })
  assert.equal(deriveHitSequence(group, 'ember'), null)
  assert.equal(deriveHitSequence([...group.slice(0, -1), event(21, '-hitcount', opponent, '999')], 'bullet-seed'), null)
})

test('Beat Up activation markers belong to their following hit; attributed damage is never an extra contact', () => {
  const group = [event(11, 'move', own, 'Beat Up', opponent), event(12, '-activate', own, 'move: Beat Up', '[of] ally'),
    event(13, '-damage', opponent, '45/48'), event(14, '-damage', own, '42/48', '[from] ability: Rough Skin'),
    event(15, '-activate', own, 'move: Beat Up', '[of] ally2'), event(16, '-damage', opponent, '42/48'), event(17, '-hitcount', opponent, '2')]
  assert.deepEqual(deriveHitSequence(group, 'beat-up').steps.map(step => step.map(row => row.cursor)), [[11, 12, 13, 14], [15, 16, 17]])
})

test('Triple Kick uses the engine-reported partial count without needing a later miss event', async () => {
  for (const count of [1, 2]) {
    const h = harness(), pending = h.presenter.present(fixture({ name: 'Triple Kick', count })); await tick()
    assert.equal(h.attacks[0].request.hitCount, count)
    h.attacks[0].done.resolve({ status: 'completed' }); await pending; h.presenter.destroy()
  }
})

test('early knockout retains the outgoing actor until the actual final contact and attack recovery', async () => {
  const batch = fixture({ count: 1, name: 'Double Kick', knockout: true }), h = harness()
  const pending = h.presenter.present(batch); await tick()
  const attack = h.attacks[0]; assert.equal(attack.request.hitCount, 1)
  attack.options.onCue({ type: 'hit', hitIndex: 1 })
  assert.deepEqual(h.displays.at(-1).options.retainFaintedActorIds, ['target'])
  assert.equal(h.displays.at(-1).view.opponent.known[0].hp.current, 0)
  assert.equal(h.faints.length, 0)
  attack.options.onCue({ type: 'impact' }); await tick(); assert.equal(h.faints.length, 0)
  attack.done.resolve({ status: 'completed' }); await pending
  assert.deepEqual(h.faints, [['target']]); h.presenter.destroy()
})

test('missing cues, reduced motion, effects off, skip, reset and timeout reconcile without replaying later hits', async () => {
  for (const mode of ['missing', 'reduced', 'off', 'skip', 'reset', 'timeout']) {
    const batch = fixture(), h = harness(mode === 'timeout' ? { timeoutMs: 20 } : {})
    const pending = h.presenter.present(batch, { effectsEnabled: mode !== 'off', reducedMotion: mode === 'reduced' }); await tick()
    const attack = h.attacks[0]
    if (attack) {
      if (mode === 'reduced') attack.options.onCue({ type: 'impact' })
      else attack.options.onCue({ type: 'hit', hitIndex: 1 })
      if (mode === 'skip') h.presenter.skip()
      else if (mode === 'reset') h.presenter.reset({ ...batch.after, matchId: 'replacement' })
      else if (mode !== 'timeout') attack.done.resolve({ status: 'completed' })
    }
    const result = await pending
    assert.equal(result.status, { off: 'skipped', skip: 'skipped', reset: 'cancelled', timeout: 'failed' }[mode] ?? 'completed')
    assert.deepEqual(h.displays.at(-1).view, mode === 'reset' ? { ...batch.after, matchId: 'replacement' } : batch.after)
    const length = h.displays.length
    attack?.options.onCue({ type: 'hit', hitIndex: 2 }); attack?.options.onCue({ type: 'impact' })
    attack?.done.resolve({ status: 'completed' }); await tick()
    assert.equal(h.displays.length, length); h.presenter.destroy()
  }
})

test('real protocol projection preserves both seats’ per-hit HP privacy and Substitute contact facts', () => {
  const projection = createProjection({ matchId: 'projected-hits' })
  projection.consume('update', '|switch|p1a: p1-1|Venusaur, L100|48/48\n|switch|p2a: p2-1|Blastoise, L100|48/48')
  projection.consume('update', '|move|p1a: p1-1|Bullet Seed|p2a: p2-1\n|-activate|p2a: p2-1|Substitute|[damage]\n|-end|p2a: p2-1|Substitute\n|split|p2\n|-damage|p2a: p2-1|211/300\n|-damage|p2a: p2-1|34/48\n|-hitcount|p2a: p2-1|3')
  for (const seat of ['p1', 'p2']) {
    const events = projection.getEvents(seat), group = events.slice(events.findIndex(row => row.args.opcode === 'move'))
    const hits = deriveHitSequence(group, 'bullet-seed')
    assert.equal(hits.count, 3); assert.equal(hits.steps.length, 3)
    const damage = group.find(row => row.args.opcode === '-damage')
    assert.equal(damage.args.fields[1], seat === 'p1' ? '34/48' : '211/300')
    assert.ok(group.every((row, index) => !index || row.cursor > group[index - 1].cursor))
  }
})
