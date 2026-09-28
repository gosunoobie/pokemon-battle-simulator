import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyMoveOutcome, cosmeticMoveRequest } from '../apps/shared/battle/outcomes.js'
import { deriveMoveImpact } from '../apps/shared/battle/impact.js'

const event = (opcode, ...fields) => ({ cursor: 10, args: { opcode, fields } })
const move = (name = 'Swagger', target = 'p2:revealed:1') => event('move', 'p1:1', name, target)
const before = { matchId: 'outcomes', own: { active: 'p1:1', team: [{ memberId: 'p1:1', hp: { current: 100, max: 100 } }] },
  opponent: { active: 'p2:revealed:1', known: [{ memberId: 'p2:revealed:1', hp: { current: 48, max: 48 }, hpPrecision: 'public' }] } }

test('partial stat and field success keeps casting and cannot label the entire move ineffective', () => {
  for (const [name, stat, amount] of [['Swagger', 'atk', '2'], ['Flatter', 'spa', '1']]) {
    const facts = [move(name), event('-boost', 'p2:revealed:1', stat, amount),
      event('-immune', 'p2:revealed:1', 'confusion', '[from] ability: Own Tempo')]
    const outcome = classifyMoveOutcome(facts)
    assert.equal(outcome.failed, false); assert.equal(outcome.partial, true)
    assert.equal(deriveMoveImpact(facts, before), null)
    facts[1] = event('-boost', 'p2:revealed:1', stat, '0')
    assert.equal(classifyMoveOutcome(facts).failed, true, 'a zero stage change is not partial success')
  }
  const perish = [move('Perish Song', 'p1:1'), event('-start', 'p1:1', 'perish3'),
    event('-immune', 'p2:revealed:1', '[from] ability: Soundproof')]
  assert.equal(classifyMoveOutcome(perish).partial, true)
  assert.equal(deriveMoveImpact(perish, before), null)
})

test('actual misses, protections and immunity remain failures without manufacturing success from reactions', () => {
  for (const failure of [event('-miss', 'p1:1', 'p2:revealed:1'), event('-immune', 'p2:revealed:1'),
    event('-fail', 'p2:revealed:1'), event('-block', 'p2:revealed:1'), event('-notarget'),
    event('-activate', 'p2:revealed:1', 'move: Protect'), event('-activate', 'p2:revealed:1', 'Detect'),
    event('-activate', 'p2:revealed:1', 'move: Safeguard'), event('-activate', 'p2:revealed:1', 'move: Mist'),
    event('-activate', 'p2:revealed:1', 'Substitute', '[block]')]) {
    assert.equal(classifyMoveOutcome([move('Toxic'), failure]).failed, true)
  }
  const absorbed = [move('Surf'), event('-immune', 'p2:revealed:1'),
    event('-heal', 'p2:revealed:1', '48/48', '[from] ability: Water Absorb'),
    event('-ability', 'p2:revealed:1', 'Water Absorb', '[from] ability: Water Absorb')]
  assert.equal(classifyMoveOutcome(absorbed).failed, true)
  assert.equal(deriveMoveImpact(absorbed, before).kind, 'immune')
  assert.equal(classifyMoveOutcome([move('Splash'), event('-nothing')]).failed, false, 'casting-only moves retain their animation')
})

test('an earlier hit or substitute damage remains successful when a later hit or secondary fails', () => {
  for (const success of [event('-damage', 'p2:revealed:1', '40/48'), event('-hitcount', 'p2:revealed:1', '2'),
    event('-activate', 'p2:revealed:1', 'Substitute', '[damage]')]) {
    const result = classifyMoveOutcome([move('Triple Kick'), success, event('-miss', 'p1:1', 'p2:revealed:1')])
    assert.equal(result.failed, false); assert.equal(result.partial, true)
  }
  assert.equal(classifyMoveOutcome([move(), event('-damage', 'p2:revealed:1', '40/48', '[from] brn'),
    event('-immune', 'p2:revealed:1')]).failed, true)
  for (const value of [null, undefined, [], {}, [null]]) assert.equal(classifyMoveOutcome(value).failed, false)
})

test('special routes use public move facts and preserve both seats and ordinary offensive targeting', () => {
  for (const seat of ['p1', 'p2']) {
    const sourceId = seat === 'p1' ? 'source' : 'target'
    const curse = [move('Curse', 'p1:1'), event('-unboost', 'p1:1', 'spe', '1'), event('-boost', 'p1:1', 'atk', '1')]
    assert.deepEqual(cosmeticMoveRequest(curse, { id: 'curse' }, seat), { sourceId, targetIds: [], variant: 'self-setup' })
    for (const target of ['', '[notarget]', 'p1:1']) assert.deepEqual(
      cosmeticMoveRequest([move('Mirror Move', target)], { id: 'mirror-move' }, seat),
      { sourceId, targetIds: [], variant: 'source-cast' })
    const ghost = [move('Curse'), event('-start', 'p2:revealed:1', 'Curse', '[of] p1:1')]
    assert.deepEqual(cosmeticMoveRequest(ghost, { id: 'curse' }, seat), { sourceId, targetIds: [sourceId === 'source' ? 'target' : 'source'] })
  }
  assert.equal(cosmeticMoveRequest([move('Curse', 'p1:1'), event('-fail', 'p1:1')], { id: 'curse' }).variant, undefined)
  assert.equal(cosmeticMoveRequest([move('Mirror Move', 'p1:1'), event('-fail', 'p1:1')], { id: 'mirror-move' }).variant, undefined)
})
