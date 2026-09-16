import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_HOST_CAPACITY, resolveHostCapacity } from '../apps/server/capacity.js'

test('host allocates a bounded combined solo and multiplayer count before either service starts', () => {
  const resolved = resolveHostCapacity()
  assert.deepEqual(resolved.capacity, { total: 24, solo: 14, multiplayer: 10 })
  assert.equal(resolved.serviceOptions.maxSessions + resolved.multiplayerOptions.policy.maxActiveMatches, 24)
  assert(Object.isFrozen(DEFAULT_HOST_CAPACITY))
  assert(Object.isFrozen(resolved.capacity))
  assert.throws(() => resolveHostCapacity({ serviceOptions: { maxSessions: 24 } }), /exceed/)
  assert.throws(() => resolveHostCapacity({ multiplayerOptions: { policy: { maxActiveMatches: 11 } } }), /exceed/)
  const partition = resolveHostCapacity({ serviceOptions: { maxSessions: 20 }, multiplayerOptions: { policy: { maxActiveMatches: 4 } } })
  assert.deepEqual(partition.capacity, { total: 24, solo: 20, multiplayer: 4 })
})

test('host capacity preserves injected dependencies and independent policy without modifying caller options', () => {
  const clock = () => 1000
  const engineFactory = { create() {} }
  const serviceOptions = { publicOrigin: 'https://battle.example', maxSessions: 2, ttlMs: 5000 }
  const multiplayerOptions = { clock, engineFactory, policy: { maxActiveMatches: 3, decisionMs: 1000 } }
  const resolved = resolveHostCapacity({ serviceOptions, multiplayerOptions, maxActiveBattles: 5 })
  assert.deepEqual(resolved.serviceOptions, serviceOptions)
  assert.equal(resolved.multiplayerOptions.clock, clock)
  assert.equal(resolved.multiplayerOptions.engineFactory, engineFactory)
  assert.deepEqual(resolved.multiplayerOptions.policy, { maxActiveMatches: 3, decisionMs: 1000 })
  assert.notEqual(resolved.serviceOptions, serviceOptions)
  assert.notEqual(resolved.multiplayerOptions.policy, multiplayerOptions.policy)
  assert.deepEqual(multiplayerOptions.policy, { maxActiveMatches: 3, decisionMs: 1000 })
  assert.equal(Object.isFrozen(multiplayerOptions.policy), false)
})

test('host refuses invalid and overflowing operator capacity instead of silently admitting more battles', () => {
  for (const maxActiveBattles of [0, -1, 1.5, Infinity, NaN, '24', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => resolveHostCapacity({ maxActiveBattles }), TypeError)
  }
  for (const value of [null, 0, -1, 1.5, Infinity, '10', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => resolveHostCapacity({ serviceOptions: { maxSessions: value } }), TypeError)
    assert.throws(() => resolveHostCapacity({ multiplayerOptions: { policy: { maxActiveMatches: value } } }), TypeError)
  }
  assert.throws(() => resolveHostCapacity({ serviceOptions: null }), TypeError)
  assert.throws(() => resolveHostCapacity({ multiplayerOptions: { policy: [] } }), TypeError)
  assert.throws(() => resolveHostCapacity({ maxActiveBattles: Number.MAX_SAFE_INTEGER, serviceOptions: { maxSessions: Number.MAX_SAFE_INTEGER }, multiplayerOptions: { policy: { maxActiveMatches: 1 } } }), /exceed/)
})
