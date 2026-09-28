import test from 'node:test'
import assert from 'node:assert/strict'
import { createEngineFactory } from '../packages/battle-engine/src/index.js'
import { createTeamFixture, createTeamSet } from '../packages/battle-engine/fixtures/team-fixtures.js'
import { deriveHitSequence } from '../apps/shared/battle/hits.js'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'

const factory = createEngineFactory()
const seats = ['p1', 'p2']
const team = lead => [lead, ...createTeamFixture().filter(row => row.species !== lead.species).slice(0, 5)]
const opcode = row => row.args?.opcode
const fields = row => row.args?.fields ?? []
const getMember = (view, id) => [...view.own.team, ...view.opponent.known].find(row => row.memberId === id)

function fixture(t, move, target, seed = 1) {
  const battle = factory.create({ matchId: 'multihit-integration', seed: [seed, 2, 3, 4], teams: {
    p1: team(createTeamSet('Smeargle', 'Own Tempo', [move, 'Splash'])), p2: team(target),
  } })
  t.after(() => battle.dispose())
  let turn = 0
  return { battle, play(p1 = 1, p2 = 1) {
    turn++
    const before = Object.fromEntries(seats.map(seat => [seat, battle.getPlayerView(seat)]))
    for (const [seat, slot] of [['p1', p1], ['p2', p2]]) {
      const decision = battle.getDecision(seat)
      assert.equal(decision.kind, 'move')
      const result = battle.submitDecision(seat, { commandId: `${seat}-turn-${turn}`, decisionId: decision.id,
        action: { kind: 'move', slot } })
      assert.equal(result.accepted, true)
    }
    return Object.fromEntries(seats.map(seat => [seat, { before: before[seat], after: battle.getPlayerView(seat),
      events: battle.getEvents(seat, before[seat].cursor) }]))
  } }
}

function moveGroup(batch, name) {
  const start = batch.events.findIndex(row => opcode(row) === 'move' && fields(row)[1] === name)
  assert.ok(start >= 0)
  const end = batch.events.findIndex((row, index) => index > start && ['move', 'faint', 'upkeep', 'turn'].includes(opcode(row)))
  return batch.events.slice(start, end < 0 ? undefined : end)
}

async function present(t, batch, options = {}) {
  const hits = [], requests = [], faints = [], messages = [], all = [], beforeRecovery = []
  let hitCue = false
  const presenter = createSimulationPresenter({ getScene: () => ({}), ensureScene: async () => {},
    onDisplay(view, displayOptions) {
      const row = { view: structuredClone(view), options: displayOptions }
      all.push(row)
      if (hitCue) hits.push(row)
    },
    onMessage: text => messages.push(text),
    faintScene: async (_view, { actorIds }) => { faints.push(actorIds); return { status: 'completed' } },
    loadFx: async () => ({ play(request, callbacks) {
      requests.push(request)
      return { finished: Promise.resolve().then(() => {
        for (let hitIndex = 1; hitIndex <= (request.hitCount ?? 0); hitIndex++) {
          hitCue = true; callbacks.onCue({ type: 'hit', hitIndex }); hitCue = false
        }
        callbacks.onCue({ type: 'impact' })
        if (request.hitCount) beforeRecovery.push(structuredClone(faints))
        return { status: 'completed' }
      }), cancel() {} }
    } }), ...options,
  })
  t.after(() => presenter.destroy())
  assert.equal((await presenter.present(batch)).status, 'completed')
  assert.deepEqual(all.at(-1).view, batch.after)
  return { hits, requests, faints, messages, beforeRecovery }
}

test('real Substitute absorption and breaking each consume a contact before ordinary damage from either seat', async t => {
  const f = fixture(t, 'Fury Swipes', createTeamSet('Abra', 'Synchronize', ['Substitute']), 3)
  const batches = f.play()
  for (const seat of seats) {
    const batch = batches[seat], group = moveGroup(batch, 'Fury Swipes'), targetId = fields(group[0])[2]
    const sequence = deriveHitSequence(group, 'fury-swipes')
    assert.equal(sequence.count, 4)
    assert.deepEqual(sequence.steps.map(step => step.filter(row => ['-activate', '-end', '-damage'].includes(opcode(row))).map(opcode)),
      [['-activate'], ['-end'], ['-damage'], ['-damage']])
    const h = await present(t, batch)
    const recipients = h.hits.map(row => getMember(row.view, targetId))
    assert.equal(h.hits.length, 4)
    assert.ok(recipients[0].volatiles.includes('Substitute'))
    assert.ok(!recipients[1].volatiles.includes('Substitute'))
    assert.equal(recipients[0].hp.current, recipients[1].hp.current, 'the second contact only breaks the Substitute')
    assert.ok(recipients[2].hp.current < recipients[1].hp.current)
    assert.ok(recipients[3].hp.current < recipients[2].hp.current)
    assert.equal(recipients[0].hpPrecision, seat === 'p1' ? 'public' : 'exact')
    assert.ok(h.messages.includes('Hit 4 times!'))
  }
})

test('real Static status belongs to the triggering contact and survives subsequent hit snapshots', async t => {
  const f = fixture(t, 'Double Slap', createTeamSet('Pikachu', 'Static', ['Tail Whip']))
  const batches = f.play()
  for (const seat of seats) {
    const batch = batches[seat], group = moveGroup(batch, 'Double Slap'), sourceId = fields(group[0])[0]
    const sequence = deriveHitSequence(group, 'double-slap')
    assert.equal(sequence.count, 4)
    assert.equal(sequence.steps[0].some(row => opcode(row) === '-status' && fields(row)[0] === sourceId), true)
    assert.equal(sequence.steps[1][0].args.opcode, '-crit', 'critical marker belongs to its upcoming hit')
    const h = await present(t, batch)
    assert.equal(h.hits.length, 4)
    assert.ok(h.hits.every(row => getMember(row.view, sourceId).condition === 'par'))
  }
})

test('real Rough Skin knockout stops at four contacts, shows both HP changes, then faints the source after recovery', async t => {
  const f = fixture(t, 'Double Slap', createTeamSet('Sharpedo', 'Rough Skin', ['Hydro Pump', 'Leer']), 3)
  f.play(2, 1)
  const batches = f.play(1, 2)
  for (const seat of seats) {
    const batch = batches[seat], group = moveGroup(batch, 'Double Slap'), sourceId = fields(group[0])[0]
    const sequence = deriveHitSequence(group, 'double-slap')
    assert.equal(sequence.count, 4)
    assert.ok(sequence.steps.every(step => step.filter(row => opcode(row) === '-damage').length === 2),
      'source ability damage is a consequence of one contact, never another contact')
    const h = await present(t, batch), actorId = seat === 'p1' ? 'source' : 'target'
    assert.equal(h.requests.find(row => row.moveId === 'double-slap').hitCount, 4)
    assert.equal(h.hits.length, 4)
    assert.ok(h.hits.slice(0, -1).every(row => !getMember(row.view, sourceId).fainted))
    assert.equal(getMember(h.hits[3].view, sourceId).hp.current, 0)
    assert.deepEqual(h.hits[3].options.retainFaintedActorIds, [actorId])
    assert.deepEqual(h.beforeRecovery, [[]])
    assert.deepEqual(h.faints, [[actorId]])
  }
})

test('real six-member Beat Up keeps every contact including repeated rounded HP and viewer-specific privacy', async t => {
  const f = fixture(t, 'Beat Up', createTeamSet('Blastoise', 'Torrent', ['Tail Whip']))
  const batches = f.play()
  const hps = {}
  for (const seat of seats) {
    const batch = batches[seat], group = moveGroup(batch, 'Beat Up'), targetId = fields(group[0])[2]
    const sequence = deriveHitSequence(group, 'beat-up')
    assert.equal(sequence.count, 6)
    assert.ok(sequence.steps.every(step => step.filter(row => opcode(row) === '-activate' && fields(row)[1] === 'move: Beat Up').length === 1))
    const h = await present(t, batch)
    assert.equal(h.hits.length, 6)
    hps[seat] = h.hits.map(row => getMember(row.view, targetId).hp.current)
  }
  assert.equal(hps.p1[4], hps.p1[5], 'two real hits round to the same public HP bar')
  assert.ok(hps.p2[4] > hps.p2[5], 'only the target owner receives the actual HP change')
})

test('real Triple Kick reports one landed hit without a subsequent miss event', async t => {
  const f = fixture(t, 'Triple Kick', createTeamSet('Blastoise', 'Torrent', ['Tail Whip']))
  const batches = f.play()
  for (const seat of seats) {
    const group = moveGroup(batches[seat], 'Triple Kick')
    assert.equal(group.some(row => opcode(row) === '-miss'), false)
    assert.equal(deriveHitSequence(group, 'triple-kick').count, 1)
    const h = await present(t, batches[seat])
    assert.equal(h.hits.length, 1)
    assert.ok(h.messages.includes('Hit 1 time!'))
  }
})
