import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleState, resolveMove } from '@battle/battle-core'
import { MOVES } from '../apps/game/src/moveCatalog.js'
import { createPreviewTransaction } from '../apps/game/src/previewState.js'
import { withPreviewHits } from '../apps/game/src/previewHits.js'
import { createPresenter } from '../apps/game/src/presentation/presenter.js'

const samples = {
  'double-slap': 2, 'comet-punch': 3, 'fury-attack': 4, 'fury-swipes': 3,
  'arm-thrust': 3, 'bullet-seed': 5, 'pin-missile': 4, 'spike-cannon': 3,
  'icicle-spear': 3, barrage: 5, 'bone-rush': 3, 'rock-blast': 3,
  'double-kick': 2, twineedle: 2, bonemerang: 2, 'triple-kick': 3, 'beat-up': 4,
}
const move = id => MOVES.find(item => item.id === id)
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

function harness(overrides = {}) {
  const displays = [], plays = [], sounds = [], busy = [], errors = []
  const presenter = createPresenter({
    getScene: () => ({}), deadlineMs: 1000,
    onDisplay: value => displays.push(value), onBusy: value => busy.push(value), onError: error => errors.push(error),
    onMove: request => {
      const sound = { request, clocks: [], impacts: 0, cancelled: 0, finished: 0 }
      sounds.push(sound)
      return { onPresentation: value => sound.clocks.push(value), onImpact: () => sound.impacts++,
        cancel: () => sound.cancelled++, finish: () => sound.finished++ }
    },
    loadFx: async () => ({ play(request, options) {
      const done = deferred(), play = { request, options, done, cancelled: 0 }
      plays.push(play)
      return { finished: done.promise, cancel: () => play.cancelled++ }
    } }),
    ...overrides,
  })
  return { presenter, displays, plays, sounds, busy, errors }
}

test('all 17 move-preview samples preserve core results and expose frozen hit snapshots from either side', () => {
  for (const [moveId, count] of Object.entries(samples)) for (const sourceId of ['source', 'target']) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const actors = [
      { id: 'source', name: 'Near', hp: 300, maxHp: 300, condition: 'poison', defenseStage: 2 },
      { id: 'target', name: 'Far', hp: 300, maxHp: 300, condition: 'burn', attackStage: -1 },
    ]
    const tx = createPreviewTransaction(move(moveId), { sourceId, targetId, actors })
    const plain = resolveMove(tx.before, { moveId, sourceId, targetId })
    assert.deepEqual(tx.event, plain.event, `${moveId}: preview must not add battle-rule hit events`)
    assert.deepEqual(tx.after, plain.after, `${moveId}: fixed committed total stays unchanged`)
    assert.equal(Object.hasOwn(plain, 'presentation'), false)
    assert.equal(tx.after.revision, tx.before.revision + 1)
    assert.equal(tx.presentation.hitCount, count, moveId)
    assert.equal(tx.presentation.hits.length, count)
    assert.ok(Object.isFrozen(tx) && Object.isFrozen(tx.presentation) && Object.isFrozen(tx.presentation.hits))
    let previousHp = tx.before.actors[targetId].hp
    for (const [index, hit] of tx.presentation.hits.entries()) {
      const hp = hit.state.actors[targetId].hp
      assert.ok(Object.isFrozen(hit) && Object.isFrozen(hit.state) && Object.isFrozen(hit.state.actors))
      assert.ok(Object.values(hit.state.actors).every(Object.isFrozen))
      assert.ok(hp < previousHp && hp >= tx.after.actors[targetId].hp, `${moveId} hit ${index + 1}`)
      assert.deepEqual(hit.state.actors[sourceId], tx.before.actors[sourceId])
      assert.deepEqual({ ...hit.state.actors[targetId], hp: previousHp }, { ...tx.before.actors[targetId], hp: previousHp })
      assert.equal(typeof hit.message, 'string'); assert.ok(hit.message.length > 0)
      previousHp = hp
    }
    assert.equal(tx.presentation.hits.at(-1).state, tx.after)
    assert.match(tx.presentation.resultMessage, new RegExp(`Hit ${count} times`, 'i'))
    assert.equal(tx.before.actors[targetId].hp, 300)
  }
})

test('low-HP preview samples stop at the contact that reaches the already-committed knockout', () => {
  for (const [moveId, count] of Object.entries(samples)) for (const sourceId of ['source', 'target']) {
    const targetId = sourceId === 'source' ? 'target' : 'source', sample = move(moveId)
    const firstDamage = Math.round(sample.damage / count)
    for (const hp of [1, firstDamage, firstDamage + 1]) {
      const actors = [{ id: sourceId, name: 'User', hp: 200, maxHp: 200 }, { id: targetId, name: 'Target', hp, maxHp: 200 }]
      const tx = createPreviewTransaction(sample, { sourceId, targetId, actors })
      const expectedCount = hp <= firstDamage ? 1 : 2
      assert.equal(tx.presentation.hitCount, expectedCount, `${moveId} against ${hp} HP`)
      assert.equal(tx.presentation.hits.length, expectedCount)
      assert.equal(tx.presentation.hits.at(-1).state, tx.after)
      assert.equal(tx.after.actors[targetId].hp, 0)
      assert.ok(tx.presentation.hits.slice(0, -1).every(hit => hit.state.actors[targetId].hp > 0))
      assert.match(tx.presentation.resultMessage, new RegExp(`Hit ${expectedCount} ${expectedCount === 1 ? 'time' : 'times'}`, 'i'))
      assert.deepEqual(tx.after, resolveMove(tx.before, { moveId, sourceId, targetId }).after)
    }
  }
})

test('ordinary moves and preparation clips remain aggregate previews without hit metadata', () => {
  for (const id of ['tackle', 'thrash', 'drill-peck', 'fury-cutter', 'rollout', 'ice-ball', 'ember', 'tri-attack', 'swift', 'rest']) {
    const tx = createPreviewTransaction(move(id))
    assert.equal(Object.hasOwn(tx, 'presentation'), false, `${id} is not a counted move`)
  }
  const tx = createPreviewTransaction(move('fly'), { phase: 'prepare' })
  assert.equal(Object.hasOwn(tx, 'presentation'), false)
  assert.equal(tx.after, tx.before)
})

test('missed, failed, immune and zero-damage outcomes never acquire illustrative hit sequences', () => {
  const sample = move('bullet-seed'), before = createBattleState()
  const tx = resolveMove(before, { moveId: sample.id, sourceId: 'source', targetId: 'target' })
  for (const outcome of ['failed', 'miss', 'immune']) {
    const unsuccessful = Object.freeze({ ...tx, after: before, event: Object.freeze({ ...tx.event, outcome }) })
    assert.equal(withPreviewHits(unsuccessful, sample), unsuccessful)
  }
  const unchanged = Object.freeze({ ...tx, after: before })
  assert.equal(withPreviewHits(unchanged, sample), unchanged)
  const successful = withPreviewHits(tx, sample)
  assert.equal(successful.event, tx.event)
  assert.deepEqual(successful.presentation.hits.map(hit => hit.state.actors.target.hp), [150, 140, 130, 120, 110])
})

test('preview presenter forwards counts and reveals each contact once, then the complete result', async () => {
  for (const [moveId, count] of Object.entries(samples)) for (const sourceId of ['source', 'target']) {
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const tx = createPreviewTransaction(move(moveId), { sourceId, targetId }), saved = structuredClone(tx), h = harness()
    try {
      const pending = h.presenter.enqueue(tx); await tick()
      const play = h.plays[0], sound = h.sounds[0]
      assert.equal(play.request.hitCount, count); assert.equal(sound.request.hitCount, count)
      assert.equal(play.request.sourceId, sourceId); assert.deepEqual(play.request.targetIds, [targetId])
      for (const key of ['state', 'actors', 'hp', 'hits', 'presentation']) assert.equal(Object.hasOwn(play.request, key), false)
      assert.equal(h.displays.at(-1).state, tx.before)
      play.options.onCue({ type: 'impact' })
      play.options.onCue({ type: 'hit', hitIndex: 0 })
      play.options.onCue({ type: 'hit', hitIndex: 1.5 })
      play.options.onCue({ type: 'hit', hitIndex: count + 1 })
      assert.equal(h.displays.at(-1).state, tx.before, 'early and malformed cues cannot reveal damage')
      for (let index = 1; index <= count; index++) {
        play.options.onCue({ type: 'hit', hitIndex: index })
        const display = h.displays.at(-1), hit = tx.presentation.hits[index - 1]
        assert.equal(display.state, hit.state); assert.equal(display.message, hit.message)
        assert.equal(display.animate, true); assert.equal(display.hitStep, true)
        const length = h.displays.length
        play.options.onCue({ type: 'hit', hitIndex: index })
        play.options.onCue({ type: 'hit', hitIndex: index + 2 })
        if (index < count) play.options.onCue({ type: 'impact' })
        assert.equal(h.displays.length, length, 'duplicates, gaps and premature impact are ignored')
      }
      play.options.onPresentation({ type: 'start', timelineSeconds: 0, hitTimes: [0.3, 0.6] })
      assert.equal(sound.clocks.length, 1)
      play.options.onCue({ type: 'impact' })
      assert.equal(h.displays.at(-1).state, tx.after)
      assert.equal(h.displays.at(-1).message, tx.presentation.resultMessage)
      assert.equal(sound.impacts, 1)
      play.done.resolve({ status: 'completed' }); assert.equal((await pending).status, 'completed')
      assert.equal(h.displays.at(-1).state, tx.after); assert.equal(h.busy.at(-1), false)
      assert.equal(h.displays.at(-1).message, tx.presentation.resultMessage)
      assert.equal(sound.finished, 1); assert.equal(sound.cancelled, 0)
      assert.deepEqual(tx, saved)
    } finally { h.presenter.destroy() }
  }
})

test('reduced-motion preview reveals the full committed result at its single impact', async () => {
  const tx = createPreviewTransaction(move('bullet-seed')), h = harness()
  try {
    const pending = h.presenter.enqueue(tx, { reducedMotion: true }); await tick()
    const play = h.plays[0]
    assert.equal(play.options.reducedMotion, true); assert.equal(h.sounds[0].request.mode, 'reduced')
    play.options.onCue({ type: 'hit', hitIndex: 1 })
    assert.equal(h.displays.at(-1).state, tx.before)
    play.options.onCue({ type: 'impact' })
    assert.equal(h.displays.at(-1).state, tx.after)
    assert.equal(h.displays.at(-1).message, tx.presentation.resultMessage)
    play.done.resolve({ status: 'completed' }); await pending
  } finally { h.presenter.destroy() }
})

test('every preview exit reconciles fixed totals and ignores all late contact callbacks', async () => {
  for (const mode of ['complete', 'missing-cues', 'skip', 'failed', 'deadline', 'effects-off', 'import-failure']) {
    const tx = createPreviewTransaction(move('bullet-seed')), h = harness({
      ...(mode === 'deadline' ? { deadlineMs: 20 } : {}),
      ...(mode === 'import-failure' ? { loadFx: async () => { throw new Error('Renderer unavailable') } } : {}),
    })
    try {
      const pending = h.presenter.enqueue(tx, { effectsEnabled: mode !== 'effects-off' }); await tick()
      const play = h.plays[0]
      if (play) {
        if (mode !== 'missing-cues') play.options.onCue({ type: 'hit', hitIndex: 1 })
        if (mode === 'skip') h.presenter.skip()
        else if (mode === 'failed') play.done.resolve({ status: 'failed' })
        else if (mode !== 'deadline') play.done.resolve({ status: 'completed' })
      }
      const expected = { skip: 'skipped', failed: 'failed', deadline: 'failed', 'effects-off': 'skipped', 'import-failure': 'failed' }[mode] ?? 'completed'
      assert.equal((await pending).status, expected, mode)
      assert.equal(h.displays.at(-1).state, tx.after, mode)
      assert.equal(h.displays.at(-1).message, tx.presentation.resultMessage, mode)
      assert.equal(h.busy.at(-1), false)
      const length = h.displays.length
      play?.options.onCue({ type: 'hit', hitIndex: 2 }); play?.options.onCue({ type: 'impact' })
      play?.done.resolve({ status: 'completed' }); await tick()
      assert.equal(h.displays.length, length, mode)
      if (['effects-off', 'import-failure'].includes(mode)) assert.equal(h.sounds.length, 0)
    } finally { h.presenter.destroy() }
  }
})

test('changing the preview attacker cancels an old hit sequence without overwriting its replacement', async () => {
  const tx = createPreviewTransaction(move('double-kick')), replacement = createBattleState(), h = harness()
  try {
    const oldPending = h.presenter.enqueue(tx); await tick()
    const old = h.plays[0]; old.options.onCue({ type: 'hit', hitIndex: 1 })
    h.presenter.reset(replacement, 'Far-side preview selected.')
    assert.equal((await oldPending).status, 'cancelled')
    assert.equal(h.displays.at(-1).state, replacement)
    assert.equal(h.sounds[0].cancelled, 1)
    const next = createPreviewTransaction(move('bullet-seed'), { sourceId: 'target', targetId: 'source' })
    const pending = h.presenter.enqueue(next); await tick()
    old.options.onCue({ type: 'hit', hitIndex: 2 }); old.options.onCue({ type: 'impact' })
    old.done.resolve({ status: 'completed' }); await tick()
    assert.equal(h.displays.at(-1).state, next.before)
    const play = h.plays[1]; play.options.onCue({ type: 'hit', hitIndex: 1 })
    assert.equal(h.displays.at(-1).state, next.presentation.hits[0].state)
    assert.equal(h.displays.at(-1).state.actors.target.hp, next.before.actors.target.hp)
    play.done.resolve({ status: 'completed' }); await pending
    assert.equal(h.displays.at(-1).state, next.after)
  } finally { h.presenter.destroy() }
})
