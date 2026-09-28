import test from 'node:test'
import assert from 'node:assert/strict'
import { createProjection } from '../packages/battle-engine/src/projection.js'
import { sideConditionLabels } from '../apps/shared/battle/viewLabels.js'

test('Spikes layer counts are public immutable protocol facts independent of the existing side-condition list', () => {
  const projection = createProjection({ matchId: 'spikes' })
  const fresh = projection.getView('p1')
  for (let n = 1; n <= 3; n++) {
    projection.consume('update', '|-sidestart|p2: p2|Spikes')
    for (const seat of ['p1', 'p2']) {
      const view = projection.getView(seat)
      assert.deepEqual(view.sideConditions.p2, ['Spikes']); assert.equal(view.sideConditionLayers.p2.Spikes, n)
      assert.ok(Object.isFrozen(view.sideConditionLayers.p2))
      assert.deepEqual(sideConditionLabels(view), [`${seat === 'p2' ? 'Your side' : 'Opponent'}: Spikes (${n} ${n === 1 ? 'layer' : 'layers'})`])
    }
  }
  assert.deepEqual(fresh.sideConditionLayers, { p1: {}, p2: {} })
  projection.consume('update', '|-fail|p1a: p1-1')
  assert.equal(projection.getView('p1').sideConditionLayers.p2.Spikes, 3)
  projection.consume('update', '|-sidestart|p1: p1|Reflect\n|-swapsideconditions')
  assert.equal(projection.getView('p1').sideConditionLayers.p1.Spikes, 3)
  assert.deepEqual(projection.getView('p1').sideConditionLayers.p2, {})
  projection.consume('update', '|-sideend|p1: p1|Spikes')
  assert.deepEqual(projection.getView('p1').sideConditionLayers, { p1: {}, p2: {} })
  assert.deepEqual(sideConditionLabels(projection.getView('p1')), ['Opponent: Reflect'])
})

test('checkpoint recovery preserves existing counts and reconstructs pre-feature checkpoints from public events', () => {
  const projection = createProjection({ matchId: 'spikes-checkpoint' })
  projection.consume('update', '|-sidestart|p2: p2|Spikes\n|-sidestart|p2: p2|Spikes\n|-sidestart|p1: p1|Spikes\n|-sideend|p1: p1|Spikes')
  const state = projection.exportState()
  assert.deepEqual(createProjection({ state }).getView('p1'), projection.getView('p1'))
  for (const viewer of Object.values(state.viewers)) delete viewer.sideConditionLayers
  const restored = createProjection({ state })
  assert.deepEqual(restored.getView('p1').sideConditionLayers, { p1: {}, p2: { Spikes: 2 } })
  restored.consume('update', '|-sidestart|p2: p2|Spikes')
  assert.equal(restored.getView('p1').sideConditionLayers.p2.Spikes, 3)
})
